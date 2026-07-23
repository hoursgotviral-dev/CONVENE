import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { prisma } from "./src/lib/db";
import {
  hashPassword,
  comparePassword,
  generateSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  AuthenticatedRequest
} from "./src/lib/auth";
import { TeamMember } from "./src/types";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Authentication Endpoints
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, displayName, name } = req.body;
    const finalName = displayName || name || "";

    // Server-side input validation
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    if (!finalName.trim()) {
      return res.status(400).json({ error: "Display name is required." });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(400).json({ error: "An account with this email address already exists. Please log in." });
    }

    // Hash password and save User to database
    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: finalName.trim(),
      },
    });

    // Generate JWT and set httpOnly cookie
    const token = generateSessionToken({ userId: newUser.id, email: newUser.email });
    setSessionCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Database error creating account. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Query User by email in PostgreSQL database
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    // HTTP 401 if user does not exist - DO NOT AUTO-SUCCEED
    if (!user) {
      return res.status(401).json({
        error: "No account found with this email address. Please switch to the Sign Up tab to create an account.",
      });
    }

    // Verify password hash - HTTP 401 on mismatch
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Incorrect password. Please try again.",
      });
    }

    // Generate JWT and set httpOnly cookie
    const token = generateSessionToken({ userId: user.id, email: user.email });
    setSessionCookie(res, token);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Database error verifying credentials. Please try again." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true });
});

app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

// WebSocket presences tracking map
const socketPresences = new Map<any, { email: string; displayName?: string; roomCode?: string; status: string; cursorPosition?: string }>();

// Helper to broadcast only to WebSocket clients in a specific room
function broadcastToRoom(roomCode: string, msg: any) {
  const targetCode = roomCode.trim().toUpperCase();
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const presence = socketPresences.get(client);
      if (presence && (presence.roomCode || '').toUpperCase() === targetCode) {
        client.send(payload);
      }
    }
  });
}

// In-memory key storage
let storedKeys: Record<string, string> = {
  gemini: process.env.GEMINI_API_KEY || "",
  openai: "",
  anthropic: "",
};

// In-memory conflict log and file editor tracking
const fileEdits: Record<string, { email: string; content: string; timestamp: number }> = {};
const conflictLog: any[] = [];

// Initialize Gemini SDK with telemetry User-Agent
let ai: GoogleGenAI | null = null;
if (storedKeys.gemini) {
  console.log("Initializing Gemini Client...");
  ai = new GoogleGenAI({
    apiKey: storedKeys.gemini,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.log("No GEMINI_API_KEY found in process.env. Utilizing smart simulated coordination fallback.");
}

// Helper for generating unique room codes
async function generateUniqueRoomCode(): Promise<string> {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let attempts = 0;
  while (attempts < 100) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
    attempts++;
  }
  throw new Error("Unable to generate unique room code");
}

// Single Room Endpoint: POST /api/rooms (body: { action: 'create' | 'join', roomCode?, displayName })
app.post("/api/rooms", async (req, res) => {
  try {
    const { action, roomCode, displayName, createdBy } = req.body;
    const userDisplayName = displayName || createdBy || "Anonymous Developer";
    const authUserEmail = req.cookies?.samanvay_session ? verifySessionToken(req.cookies.samanvay_session)?.email : null;

    if (!action || (action !== "create" && action !== "join")) {
      return res.status(400).json({ error: "Action must be 'create' or 'join'." });
    }

    let user = authUserEmail
      ? await prisma.user.findUnique({ where: { email: authUserEmail } })
      : null;

    if (!user) {
      const fallbackEmail = `${userDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dev'}@dev.samanvay.local`;
      user = await prisma.user.upsert({
        where: { email: fallbackEmail },
        update: { displayName: userDisplayName },
        create: {
          email: fallbackEmail,
          passwordHash: "external_session",
          displayName: userDisplayName,
        },
      });
    }

    if (action === "create") {
      const code = await generateUniqueRoomCode();
      const room = await prisma.room.create({
        data: {
          code,
          createdBy: userDisplayName,
        },
      });

      await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
          status: "active",
        },
      });

      return res.status(201).json({
        success: true,
        room: {
          id: room.id,
          code: room.code,
          created_at: room.createdAt.toISOString(),
          created_by: room.createdBy,
        },
      });
    }

    if (action === "join") {
      if (!roomCode || typeof roomCode !== "string") {
        return res.status(400).json({ error: "roomCode is required to join a room." });
      }

      const normalizedCode = roomCode.trim().toUpperCase();
      const room = await prisma.room.findUnique({
        where: { code: normalizedCode },
      });

      if (!room) {
        return res.status(404).json({
          exists: false,
          error: "Room not found — check the code and try again.",
        });
      }

      const existingMember = await prisma.roomMember.findFirst({
        where: { roomId: room.id, userId: user.id },
      });

      if (existingMember) {
        await prisma.roomMember.update({
          where: { id: existingMember.id },
          data: { status: "active", joinedAt: new Date() },
        });
      } else {
        await prisma.roomMember.create({
          data: {
            roomId: room.id,
            userId: user.id,
            status: "active",
          },
        });
      }

      await prisma.room.update({
        where: { id: room.id },
        data: { lastActiveAt: new Date() },
      });

      return res.json({
        success: true,
        exists: true,
        room: {
          id: room.id,
          code: room.code,
          created_at: room.createdAt.toISOString(),
          created_by: room.createdBy,
        },
      });
    }
  } catch (err: any) {
    console.error("Room API error:", err);
    return res.status(500).json({ error: "Failed to process room request." });
  }
});

// GET /api/rooms/:code/members returning real RoomMember rows joined with User
app.get("/api/rooms/:code/members", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = await prisma.room.findUnique({
      where: { code },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const members = await prisma.roomMember.findMany({
      where: { roomId: room.id },
    });

    const userIds = members.map((m) => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const avatarColors = [
      'bg-indigo-300 text-indigo-950',
      'bg-emerald-300 text-emerald-950',
      'bg-cyan-300 text-cyan-950',
      'bg-amber-300 text-amber-950',
      'bg-purple-300 text-purple-950',
      'bg-rose-300 text-rose-950',
    ];

    const teamMembers: TeamMember[] = members.map((member, index) => {
      const user = userMap.get(member.userId);
      const name = user?.displayName || user?.email.split('@')[0] || 'Member';
      const isCreator = user?.displayName === room.createdBy || user?.email === room.createdBy;

      return {
        id: member.id,
        name,
        role: isCreator ? 'Lead Architect' : 'Collaborator',
        avatarColor: avatarColors[index % avatarColors.length],
        status: (member.status === 'idle' || member.status === 'offline') ? member.status : 'active',
      };
    });

    return res.json({ success: true, members: teamMembers });
  } catch (err: any) {
    console.error("Room members fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch room members." });
  }
});

// API Key Status endpoint (requires roomCode, backed by Prisma)
app.get("/api/keys/status", async (req, res) => {
  const roomCode = String(req.query.roomCode || '').trim().toUpperCase();
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const key = await prisma.apiKey.findFirst({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
    });

    if (key) {
      return res.json({
        connected: true,
        provider: key.provider,
      });
    }

    const systemProvider = process.env.GEMINI_API_KEY ? 'gemini' : null;
    return res.json({
      connected: !!systemProvider,
      provider: systemProvider,
    });
  } catch (err: any) {
    console.error("Error checking key status:", err);
    return res.status(500).json({ error: "Failed to check API key status." });
  }
});

// Save API Key endpoint (requires roomCode, backed by Prisma)
app.post("/api/keys", async (req, res) => {
  const { provider, key, roomCode } = req.body;
  const normalizedCode = String(roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }
  if (!provider || !key) {
    return res.status(400).json({ error: "Provider and key are required." });
  }
  if (provider !== "gemini" && provider !== "openai" && provider !== "anthropic") {
    return res.status(400).json({ error: "Invalid provider." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.apiKey.upsert({
      where: {
        roomId_provider: {
          roomId: room.id,
          provider,
        },
      },
      update: { key },
      create: {
        roomId: room.id,
        provider,
        key,
      },
    });

    return res.json({ success: true, connected: true, provider });
  } catch (err: any) {
    console.error("Error saving API key:", err);
    return res.status(500).json({ error: "Failed to save API key." });
  }
});

// Disconnect API Keys endpoint (requires roomCode, backed by Prisma)
app.delete("/api/keys", async (req, res) => {
  const normalizedCode = String(req.query.roomCode || req.body?.roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.apiKey.deleteMany({
      where: { roomId: room.id },
    });

    return res.json({ success: true, connected: false });
  } catch (err: any) {
    console.error("Error deleting API keys:", err);
    return res.status(500).json({ error: "Failed to disconnect API keys." });
  }
});

// Tasks List endpoint (requires roomCode, backed by Prisma)
app.get("/api/tasks", async (req, res) => {
  const roomCode = String(req.query.roomCode || '').trim().toUpperCase();
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const dbTasks = await prisma.task.findMany({
      where: { roomId: room.id },
    });

    const tasks = dbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    return res.json(tasks);
  } catch (err: any) {
    console.error("Error loading tasks:", err);
    return res.status(500).json({ error: "Failed to load tasks." });
  }
});

// Create Task endpoint (requires roomCode, backed by Prisma)
app.post("/api/tasks", async (req, res) => {
  const { roomCode, title, description, column, source, assigneeId, agentReasoning, isApprovedByHuman, subtasks } = req.body;
  const normalizedCode = String(roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.task.create({
      data: {
        roomId: room.id,
        title: title || "New Task",
        description: description || "",
        assigneeId: assigneeId || null,
        column: column || "todo",
        source: source || "human",
        agentReasoning: agentReasoning || null,
        isApprovedByHuman: isApprovedByHuman ?? null,
        subtasks: subtasks || [],
      },
    });

    const allDbTasks = await prisma.task.findMany({ where: { roomId: room.id } });
    const tasks = allDbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    broadcastToRoom(normalizedCode, { type: 'TASK_MUTATION', tasks });
    return res.json({ success: true, tasks });
  } catch (err: any) {
    console.error("Error creating task:", err);
    return res.status(500).json({ error: "Failed to create task." });
  }
});

// Update Task endpoint (requires roomCode, backed by Prisma)
app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const normalizedCode = String(req.body.roomCode || req.query.roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const { title, description, column, source, assigneeId, agentReasoning, isApprovedByHuman, subtasks } = req.body;

    await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(column !== undefined && { column }),
        ...(source !== undefined && { source }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(agentReasoning !== undefined && { agentReasoning }),
        ...(isApprovedByHuman !== undefined && { isApprovedByHuman }),
        ...(subtasks !== undefined && { subtasks }),
      },
    });

    const allDbTasks = await prisma.task.findMany({ where: { roomId: room.id } });
    const tasks = allDbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    broadcastToRoom(normalizedCode, { type: 'TASK_MUTATION', tasks });
    return res.json({ success: true, tasks });
  } catch (err: any) {
    console.error("Error updating task:", err);
    return res.status(500).json({ error: "Failed to update task." });
  }
});

// Delete Task endpoint (requires roomCode, backed by Prisma)
app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const normalizedCode = String(req.query.roomCode || req.body?.roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.task.delete({ where: { id } });

    const allDbTasks = await prisma.task.findMany({ where: { roomId: room.id } });
    const tasks = allDbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    broadcastToRoom(normalizedCode, { type: 'TASK_MUTATION', tasks });
    return res.json({ success: true, tasks });
  } catch (err: any) {
    console.error("Error deleting task:", err);
    return res.status(500).json({ error: "Failed to delete task." });
  }
});

// File edits tracking & conflict logging endpoint (requires roomCode)
app.post("/api/files/save", (req, res) => {
  const { fileName, content, email, roomCode } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }
  if (!fileName || !email) {
    return res.status(400).json({ error: "Filename and user email are required." });
  }

  const previousEdit = fileEdits[fileName];
  if (previousEdit && previousEdit.email !== email && (Date.now() - previousEdit.timestamp < 15000)) {
    const conflict = {
      id: `conflict-${Date.now()}`,
      file: fileName,
      user: previousEdit.email,
      overwriter: email,
      timestamp: new Date().toISOString()
    };
    conflictLog.push(conflict);
    broadcastToRoom(roomCode, { type: 'CONFLICT_LOG', conflict });
    console.log(`[CONFLICT DETECTED] ${fileName} overwritten by ${email}. Original writer was ${previousEdit.email}.`);
  }

  fileEdits[fileName] = { email, content, timestamp: Date.now() };
  res.json({ success: true });
});

// Real-time SSE Multi-Agent Orchestration endpoint
app.post("/api/orchestrate", async (req, res) => {
  const { task } = req.body;
  const activePrompt = task || "Analyze current workspace requirements";

  console.log(`SSE Orchestration endpoint triggered: "${activePrompt.substring(0, 40)}..."`);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const sendEvent = (msg: any) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  try {
    const mockWs = {
      send: (dataStr: string) => {
        try {
          const parsed = JSON.parse(dataStr);
          sendEvent(parsed);
        } catch (e) {
          sendEvent({ type: "LOG", message: dataStr });
        }
      },
      readyState: 1
    } as any;

    await runAgents(mockWs, activePrompt);
    res.end();
  } catch (err: any) {
    console.error("SSE Orchestration error:", err);
    sendEvent({ type: "ERROR", error: err.message });
    res.end();
  }
});

// REST Route for targeted co-coding assistant
app.post("/api/agent", async (req, res) => {
  const { code, prompt, fileName, apiKey, provider } = req.body;
  console.log(`Agent query received on /api/agent. Prompt: "${prompt}", Provider: ${provider || 'default (gemini)'}`);

  try {
    let explanation = "";
    let suggestedCode = "";
    let targetLines = "";
    let agentName: "Planner" | "Estimator" | "Risk-Flagger" = "Planner";

    const activeProvider = provider || 'gemini';
    const activeKey = apiKey || process.env.GEMINI_API_KEY;

    if (activeProvider === 'gemini' && activeKey) {
      const aiClient = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const sysInstruction = `You are the SAMANVAY Co-Coding Agent. You analyze the selected code block in the file "${fileName}" and fulfill the user's instructions.
You must respond with valid JSON containing the following properties:
- explanation (a brief 1-2 sentence explanation of your suggested changes)
- targetLines (the exact substring from the user's code to be replaced, or empty string to append to the end. THIS MUST MATCH A PART OF THE TARGET CODE EXACTLY FOR REPLACEMENT TO SUCCEED)
- suggestedCode (the replacement code block that solves the user prompt)
- agentName (one of: "Planner", "Estimator", "Risk-Flagger")

The user's instruction is: "${prompt}"

If the user request is a general question and doesn't require modifying the code, suggest a blank targetLines, and provide the explanation.
Always be extremely helpful, professional, and precise. Avoid any unnecessary text outside the JSON output.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { text: `Target Code:\n\`\`\`\n${code}\n\`\`\`` },
          { text: `User Prompt: ${prompt}` }
        ],
        config: {
          systemInstruction: sysInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING },
              targetLines: { type: Type.STRING },
              suggestedCode: { type: Type.STRING },
              agentName: { type: Type.STRING },
            },
            required: ["explanation", "targetLines", "suggestedCode", "agentName"],
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      explanation = result.explanation;
      suggestedCode = result.suggestedCode;
      targetLines = result.targetLines;
      agentName = result.agentName || "Planner";

    } else if (activeProvider === 'openai' && apiKey) {
      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are SAMANVAY Co-Coding Agent. You analyze the selected code block in the file "${fileName}" and fulfill the user's instructions.
You must respond with valid JSON containing:
{
  "explanation": "brief description of suggested change",
  "targetLines": "exact substring from the user's code to be replaced, or empty string to append",
  "suggestedCode": "the replacement code block",
  "agentName": "Planner"
}`
            },
            {
              role: "user",
              content: `Target Code:\n${code}\n\nInstruction: ${prompt}`
            }
          ]
        })
      });

      if (!openAiRes.ok) {
        throw new Error(`OpenAI request failed: ${openAiRes.statusText}`);
      }
      const data = await openAiRes.json();
      const content = data.choices?.[0]?.message?.content;
      const result = JSON.parse(content || "{}");
      explanation = result.explanation;
      suggestedCode = result.suggestedCode;
      targetLines = result.targetLines;
      agentName = result.agentName || "Planner";

    } else if (activeProvider === 'anthropic' && apiKey) {
      const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `You are SAMANVAY Co-Coding Agent. Analyze this code in "${fileName}":
\`\`\`
${code}
\`\`\`

User prompt: "${prompt}"

Provide your suggestion in JSON format with exactly these fields:
- explanation (brief description)
- targetLines (substring from the code to replace)
- suggestedCode (replacement code)
- agentName ("Planner" or "Estimator" or "Risk-Flagger")

Respond ONLY with valid JSON.`
            }
          ]
        })
      });

      if (!anthRes.ok) {
        throw new Error(`Anthropic request failed: ${anthRes.statusText}`);
      }
      const data = await anthRes.json();
      const textVal = data.content?.[0]?.text || "{}";
      const result = JSON.parse(textVal);
      explanation = result.explanation;
      suggestedCode = result.suggestedCode;
      targetLines = result.targetLines;
      agentName = result.agentName || "Planner";

    } else {
      console.log("No API key available, running simulated agent fallback...");
      agentName = Math.random() > 0.55 ? "Estimator" : "Risk-Flagger";

      const lowPrompt = prompt.toLowerCase();
      if (lowPrompt.includes("error") || lowPrompt.includes("catch") || lowPrompt.includes("handle")) {
        explanation = "Detected lack of error boundaries. Added robust try/catch block to prevent runtime crashes during heavy server load.";
        targetLines = code.includes("app.get") ? 'app.get("/api/health", (req, res) => {\n  res.json({ status: "alive" });\n});' : code;
        suggestedCode = `app.get("/api/health", (req, res) => {
  try {
    res.json({ status: "alive", diagnostics: "healthy", timestamp: Date.now() });
  } catch (err) {
    console.error("API error encountered:", err);
    res.status(500).json({ status: "failed", error: "Internal Gateway Error" });
  }
});`;
      } else if (lowPrompt.includes("schema") || lowPrompt.includes("database") || lowPrompt.includes("tasks")) {
        agentName = "Planner";
        explanation = "Added database model indices to prevent slow table scans when querying tasks by assigneeId.";
        targetLines = code.includes("export const tasks") ? `export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id"),
  column: text("column").default("todo"),
  source: text("source").default("human"),
  createdAt: timestamp("created_at").defaultNow(),
});` : code;
        suggestedCode = `export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id"),
  column: text("column").default("todo"),
  source: text("source").default("human"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return [
    index("assignee_idx").on(table.assigneeId),
  ];
});`;
      } else {
        explanation = `Simulated suggestion response for instruction: "${prompt}". Connected a custom API key to enable live model queries.`;
        targetLines = code.split("\n")[0] || "// TODO: Integrate multi-agent auth gateway";
        suggestedCode = `${targetLines}\n// Added by SAMANVAY multi-agent session helper\nconsole.log("Samanvay active worker session loaded.");`;
      }
    }

    res.json({
      explanation,
      suggestedCode,
      targetLines,
      agentName,
    });

  } catch (err: any) {
    console.error("Agent API endpoint failed:", err);
    res.status(500).json({ error: err.message || "Failed to process query." });
  }
});

// Helper: Promise-based sleep/delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Real Gemini API Orchestrations
async function getPlannerFromGemini(task: string): Promise<any[]> {
  if (!ai) throw new Error("Gemini client is uninitialized.");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `You are the Planner Agent for SAMANVAY, a multi-agent AI coordination dashboard.
Given the project request: "${task}", deconstruct it into a structured list of 4 to 6 logical subtasks.
Each subtask must contain:
- id (a short string, e.g. "task-1")
- title (a concise name, e.g. "Authentication Integration")
- description (a clear 1-2 sentence technical breakdown)
- category (MUST be exactly one of: "Frontend UI", "Backend API", "Database Systems", "QA Testing", "DevOps & Deployment")

Respond ONLY with valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subtasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ["id", "title", "description", "category"],
            },
          },
        },
        required: ["subtasks"],
      },
    },
  });

  const parsed = JSON.parse(response.text || "{}");
  return parsed.subtasks || [];
}

async function getEstimatorFromGemini(task: string, plannerOutput: any[]): Promise<any> {
  if (!ai) throw new Error("Gemini client is uninitialized.");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `You are the Estimator Agent for SAMANVAY, a multi-agent AI system.
Given the task description: "${task}" and the subtasks drafted by the Planner:
${JSON.stringify(plannerOutput, null, 2)}

Calculate the timeline effort and costs. Determine the hours and cost breakdown for each unique labor category involved in the planner's subtasks.
Standard developer rate is $100 per hour.
Ensure totalHours is equal to the sum of hours in the breakdown.
Ensure totalCost is equal to totalHours multiplied by 100.

Respond ONLY with valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          totalHours: { type: Type.INTEGER },
          totalCost: { type: Type.INTEGER },
          breakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                hours: { type: Type.INTEGER },
                cost: { type: Type.INTEGER },
              },
              required: ["category", "hours", "cost"],
            },
          },
        },
        required: ["totalHours", "totalCost", "breakdown"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

async function getRiskFlaggerFromGemini(task: string, plannerOutput: any[], estimatorOutput: any): Promise<any> {
  if (!ai) throw new Error("Gemini client is uninitialized.");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `You are the Risk-Flagger Agent for SAMANVAY, a multi-agent AI system.
Given the project request: "${task}", the subtasks:
${JSON.stringify(plannerOutput, null, 2)}
And the labor estimates:
${JSON.stringify(estimatorOutput, null, 2)}

Identify exactly 3 major technical, operational, or compliance risks associated with this implementation.
For each risk, provide:
- id (e.g. "risk-1")
- risk (a concise description of the threat)
- severity (MUST be exactly one of: "Low", "Medium", "High", "Critical")
- mitigation (a clear, actionable mitigation directive)

Respond ONLY with valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          risks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                risk: { type: Type.STRING },
                severity: { type: Type.STRING },
                mitigation: { type: Type.STRING },
              },
              required: ["id", "risk", "severity", "mitigation"],
            },
          },
        },
        required: ["risks"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

// Smart Simulated Coordination Fallbacks
function getPlannerSimulated(task: string): any[] {
  const t = task.toLowerCase();
  if (t.includes('e-commerce') || t.includes('shop') || t.includes('stripe') || t.includes('cart')) {
    return [
      { id: 'task-1', title: 'Stripe Gateway Integration', description: 'Configure Stripe billing webhooks, payment session intents, and card checkout flows.', category: 'Backend API' },
      { id: 'task-2', title: 'Product Inventory Schema', description: 'Design PostgreSQL relational schemas for SKU level tracking, categorization, and transaction locks.', category: 'Database Systems' },
      { id: 'task-3', title: 'Shopping Cart State Manager', description: 'Develop React custom hooks utilizing browser storage for persistent, responsive cart additions.', category: 'Frontend UI' },
      { id: 'task-4', title: 'Billing Security Verification Specs', description: 'Formulate Cypress automated tests auditing credit card validations, 3D secure overrides, and logging logs.', category: 'QA Testing' },
      { id: 'task-5', title: 'Containerized Production Deployment', description: 'Build automated Dockerized files, configure CDN edge cache rules, and setup HTTPS SSL encryption.', category: 'DevOps & Deployment' }
    ];
  } else if (t.includes('game') || t.includes('chess') || t.includes('socket') || t.includes('real-time')) {
    return [
      { id: 'task-1', title: 'WebSocket Server Setup', description: 'Initialize Socket.IO rooms, handle client-server connection heartbeats, and frame-rate loops.', category: 'Backend API' },
      { id: 'task-2', title: 'Matchmaking Redis Cache', description: 'Deploy in-memory structures for real-time player lobby listings and matchmaking Elo pairings.', category: 'Database Systems' },
      { id: 'task-3', title: 'Interactive Board Canvas', description: 'Build responsive 2D canvas boards, drag-and-drop mechanics, and client-side chess validation.', category: 'Frontend UI' },
      { id: 'task-4', title: 'High-Frequency Load Stressing', description: 'Run Artillery test cases simulating 5,000 concurrent socket connections on the gateway layer.', category: 'QA Testing' },
      { id: 'task-5', title: 'Inbound Sticky Session Routing', description: 'Deploy cloud load-balancers supporting cookie-based sticky sessions for unbroken client connections.', category: 'DevOps & Deployment' }
    ];
  } else if (t.includes('medical') || t.includes('booking') || t.includes('doctor') || t.includes('schedule')) {
    return [
      { id: 'task-1', title: 'Encrypted Patient Data Vault', description: 'Design SQL schemas with AES-256 field-level encryption targeting Personal Health Information (PHI).', category: 'Database Systems' },
      { id: 'task-2', title: 'Secure Appointment Express Logic', description: 'Formulate scheduling Express controller models enforcing resource constraints to prevent double-bookings.', category: 'Backend API' },
      { id: 'task-3', title: 'Consolidated Calendar Timeline', description: 'Develop full-screen scheduler widgets enabling drag-to-reschedule, provider filtering, and slot overlays.', category: 'Frontend UI' },
      { id: 'task-4', title: 'Audit Trail and Authorization Logging', description: 'Program Jest unit-tests tracking strict HIPAA action histories, role verifications, and sign-outs.', category: 'QA Testing' },
      { id: 'task-5', title: 'Private Cloud VPC Architecture', description: 'Deploy services inside closed VPC subnets, restricting inbound requests to managed HTTPS gates.', category: 'DevOps & Deployment' }
    ];
  } else {
    // Elegant Generic fallback
    return [
      { id: 'task-1', title: 'Relational Schema Design & Modeling', description: 'Draft comprehensive SQL entity relationships, configure keys, and map indexing criteria.', category: 'Database Systems' },
      { id: 'task-2', title: 'RESTful API Routing Framework', description: 'Implement secure Express endpoints with request body validation, logging, and CORS locks.', category: 'Backend API' },
      { id: 'task-3', title: 'Interactive Admin Management Console', description: 'Build a dynamic dashboard featuring real-time data table grids, metrics widgets, and filtering rails.', category: 'Frontend UI' },
      { id: 'task-4', title: 'End-to-End Core Lifecycle Automation', description: 'Write Cypress integration suites securing user signups, CRUD logs, and permission updates.', category: 'QA Testing' },
      { id: 'task-5', title: 'Continuous Integration Pipeline', description: 'Compile GitHub Actions scripts triggering automated builds, linter validations, and container registry drops.', category: 'DevOps & Deployment' }
    ];
  }
}

function getEstimatorSimulated(task: string, plannerOutput: any[]): any {
  const t = task.toLowerCase();
  let hoursBreakdown = [
    { category: 'Frontend UI', hours: 24, cost: 2400 },
    { category: 'Backend API', hours: 32, cost: 3200 },
    { category: 'Database Systems', hours: 16, cost: 1600 },
    { category: 'QA Testing', hours: 16, cost: 1600 },
    { category: 'DevOps & Deployment', hours: 12, cost: 1200 }
  ];

  if (t.includes('game') || t.includes('chess') || t.includes('socket')) {
    hoursBreakdown = [
      { category: 'Frontend UI', hours: 36, cost: 3600 },
      { category: 'Backend API', hours: 44, cost: 4400 },
      { category: 'Database Systems', hours: 20, cost: 2000 },
      { category: 'QA Testing', hours: 24, cost: 2400 },
      { category: 'DevOps & Deployment', hours: 16, cost: 1600 }
    ];
  } else if (t.includes('medical') || t.includes('booking')) {
    hoursBreakdown = [
      { category: 'Frontend UI', hours: 28, cost: 2800 },
      { category: 'Backend API', hours: 40, cost: 4000 },
      { category: 'Database Systems', hours: 32, cost: 3200 },
      { category: 'QA Testing', hours: 20, cost: 2000 },
      { category: 'DevOps & Deployment', hours: 20, cost: 2000 }
    ];
  }

  const totalHours = hoursBreakdown.reduce((sum, item) => sum + item.hours, 0);
  const totalCost = totalHours * 100;

  return {
    totalHours,
    totalCost,
    breakdown: hoursBreakdown
  };
}

function getRiskFlaggerSimulated(task: string, plannerOutput: any[], estimatorOutput: any): any {
  const t = task.toLowerCase();
  if (t.includes('e-commerce') || t.includes('shop') || t.includes('stripe') || t.includes('cart')) {
    return {
      risks: [
        { id: 'risk-1', risk: 'PCI Compliance and Local Card Leakage', severity: 'Critical', mitigation: 'Offload all credit card processing directly to Stripe Elements. Verify HTTPS headers and enforce secure cryptographic webhook validations.' },
        { id: 'risk-2', risk: 'Race Conditions on Inventory Updates', severity: 'High', mitigation: 'Employ serializable SQL transactions or select-for-update locks in the cart checkout routines to secure accurate SKU levels.' },
        { id: 'risk-3', risk: 'Payment Gateway Connection Outages', severity: 'Medium', mitigation: 'Incorporate client-side retry patterns and circuit-breaker designs in backend handlers to preserve cart state gracefully.' }
      ]
    };
  } else if (t.includes('game') || t.includes('chess') || t.includes('socket')) {
    return {
      risks: [
        { id: 'risk-1', risk: 'Inbound Chess Move Forgery', severity: 'Critical', mitigation: 'Perform chess.js state audits on the server before broadcasting moves to clients; never trust client algebraic logs.' },
        { id: 'risk-2', risk: 'WebSocket Storm and Port Congestion', severity: 'High', mitigation: 'Activate rate-limiting filters on socket subscriptions, rejecting clients generating more than 30 payloads/sec.' },
        { id: 'risk-3', risk: 'Matchmaker Redis Ticket Staleness', severity: 'Medium', mitigation: 'Implement short, 5-second TTL bounds on jugador ticket slots inside Redis keys to flush disconnected sessions.' }
      ]
    };
  } else if (t.includes('medical') || t.includes('booking')) {
    return {
      risks: [
        { id: 'risk-1', risk: 'HIPAA Integrity Deficiencies in transit', severity: 'Critical', mitigation: 'Ensure field-level database encryption for patient names and records, combined with strict end-to-end TLS 1.3.' },
        { id: 'risk-2', risk: 'Provider Double-Booking Race Conditions', severity: 'High', mitigation: 'Enforce SQL constraints on unique doctor-schedule intervals, rejecting secondary records trying to override open locks.' },
        { id: 'risk-3', risk: 'Idle Desk Terminal Access Leaks', severity: 'Medium', mitigation: 'Configure strict 15-minute idle sign-out boundaries on React authentication screens to limit client-record exposures.' }
      ]
    };
  } else {
    return {
      risks: [
        { id: 'risk-1', risk: 'SQL Injection via Unsanitized Parameters', severity: 'High', mitigation: 'Strictly avoid direct string concatenation. Use parameterized query models with ORMs or query builders.' },
        { id: 'risk-2', risk: 'CORS API Exposure', severity: 'Medium', mitigation: 'Explicitly configure Express server CORS parameters, rejecting request roots outside allowed app service locations.' },
        { id: 'risk-3', risk: 'Test Suite Failures in Pipeline Code', severity: 'Low', mitigation: 'Inject strict pre-commit hooks and blocking CI validations preventing merges when overall test coverage drops below 80%.' }
      ]
    };
  }
}

// Multi-agent runner
async function runAgents(ws: WebSocket, task: string, roomCode?: string) {
  const targetRoomCode = (roomCode || socketPresences.get(ws)?.roomCode || '').toUpperCase();

  const send = (msg: any) => {
    if (targetRoomCode) {
      broadcastToRoom(targetRoomCode, msg);
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  try {
    // 1. Reset state
    send({ type: 'RESET' });
    await delay(300);

    // 2. Planner Agent begins thinking
    send({ type: 'STATUS', agent: 'planner', status: 'thinking', progress: 5 });
    send({ type: 'LOG', agent: 'planner', message: 'Spawning Planner worker pool...' });
    await delay(500);
    send({ type: 'STATUS', agent: 'planner', status: 'thinking', progress: 20 });
    send({ type: 'LOG', agent: 'planner', message: 'Analyzing task specifications and boundaries...' });
    await delay(600);
    send({ type: 'STATUS', agent: 'planner', status: 'thinking', progress: 45 });
    send({ type: 'LOG', agent: 'planner', message: 'Generating system breakdown modules...' });
    await delay(700);
    send({ type: 'STATUS', agent: 'planner', status: 'thinking', progress: 75 });
    send({ type: 'LOG', agent: 'planner', message: 'Verifying task dependency branches...' });
    await delay(500);

    let plannerOutput: any[] = [];
    if (process.env.GEMINI_API_KEY) {
      plannerOutput = await getPlannerFromGemini(task);
    } else {
      plannerOutput = getPlannerSimulated(task);
    }

    send({ type: 'LOG', agent: 'planner', message: 'Decomposed planning blueprint compiled successfully.' });
    send({ type: 'STATUS', agent: 'planner', status: 'thinking', progress: 95 });
    await delay(400);
    send({ type: 'OUTPUT_PLANNER', data: plannerOutput });
    send({ type: 'STATUS', agent: 'planner', status: 'done', progress: 100 });
    await delay(400);

    // 3. Estimator Agent begins thinking
    send({ type: 'STATUS', agent: 'estimator', status: 'thinking', progress: 10 });
    send({ type: 'LOG', agent: 'estimator', message: 'Connecting with Planner channel...' });
    await delay(500);
    send({ type: 'STATUS', agent: 'estimator', status: 'thinking', progress: 35 });
    send({ type: 'LOG', agent: 'estimator', message: 'Calibrating hourly effort values for each planner subtask...' });
    await delay(650);
    send({ type: 'STATUS', agent: 'estimator', status: 'thinking', progress: 60 });
    send({ type: 'LOG', agent: 'estimator', message: 'Calculating cost rates (Developer baseline: $100/hr)...' });
    await delay(600);
    send({ type: 'STATUS', agent: 'estimator', status: 'thinking', progress: 85 });
    send({ type: 'LOG', agent: 'estimator', message: 'Formulating total project financial ledger...' });
    await delay(500);

    let estimatorOutput: any = null;
    if (process.env.GEMINI_API_KEY) {
      estimatorOutput = await getEstimatorFromGemini(task, plannerOutput);
    } else {
      estimatorOutput = getEstimatorSimulated(task, plannerOutput);
    }

    send({ type: 'LOG', agent: 'estimator', message: 'Estimated project ledgers sealed.' });
    send({ type: 'STATUS', agent: 'estimator', status: 'thinking', progress: 95 });
    await delay(400);
    send({ type: 'OUTPUT_ESTIMATOR', data: estimatorOutput });
    send({ type: 'STATUS', agent: 'estimator', status: 'done', progress: 100 });
    await delay(400);

    // 4. Risk-Flagger Agent begins thinking
    send({ type: 'STATUS', agent: 'riskFlagger', status: 'thinking', progress: 10 });
    send({ type: 'LOG', agent: 'riskFlagger', message: 'Initiating security and compliance threat registry scans...' });
    await delay(500);
    send({ type: 'STATUS', agent: 'riskFlagger', status: 'thinking', progress: 40 });
    send({ type: 'LOG', agent: 'riskFlagger', message: 'Inspecting drafted components and timeline constraints...' });
    await delay(650);
    send({ type: 'STATUS', agent: 'riskFlagger', status: 'thinking', progress: 75 });
    send({ type: 'LOG', agent: 'riskFlagger', message: 'Authoring action-ready mitigation directives...' });
    await delay(600);

    let riskFlaggerOutput: any = null;
    if (process.env.GEMINI_API_KEY) {
      riskFlaggerOutput = await getRiskFlaggerFromGemini(task, plannerOutput, estimatorOutput);
    } else {
      riskFlaggerOutput = getRiskFlaggerSimulated(task, plannerOutput, estimatorOutput);
    }

    send({ type: 'LOG', agent: 'riskFlagger', message: 'Risk audit complete. Directives mapped.' });
    send({ type: 'STATUS', agent: 'riskFlagger', status: 'thinking', progress: 95 });
    await delay(400);
    send({ type: 'OUTPUT_RISK_FLAGGER', data: riskFlaggerOutput });
    send({ type: 'STATUS', agent: 'riskFlagger', status: 'done', progress: 100 });

  } catch (err: any) {
    console.error("Orchestration failed:", err);
    send({ type: 'LOG', agent: 'planner', message: `Orchestration error encountered: ${err.message}` });
    send({ type: 'STATUS', agent: 'planner', status: 'error', progress: 0 });
    send({ type: 'STATUS', agent: 'estimator', status: 'error', progress: 0 });
    send({ type: 'STATUS', agent: 'riskFlagger', status: 'error', progress: 0 });
    send({ type: 'ERROR', error: `System Coordination Interrupted: ${err.message}` });
  }
}

// WebSocket Connection Logic
wss.on("connection", (ws) => {
  const wsId = Math.random().toString(36).substring(2, 10);
  console.log(`WebSocket client connected. ID: ${wsId}`);

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'RUN_AGENTS') {
        const task = data.task || '';
        const roomCode = (data.roomCode || socketPresences.get(ws)?.roomCode || '').toUpperCase();
        console.log(`Starting multi-agent orchestration for task in room [${roomCode}]: "${task.substring(0, 40)}..."`);
        await runAgents(ws, task, roomCode);
      } else if (data.type === 'PRESENCE_SYNC') {
        const { email, status, cursorPosition, displayName, roomCode } = data;
        const normalizedRoomCode = (roomCode || '').trim().toUpperCase();

        socketPresences.set(ws, {
          email: email || 'Anonymous User',
          displayName: displayName || '',
          roomCode: normalizedRoomCode,
          status: status || 'active',
          cursorPosition: cursorPosition || 'idle'
        });

        // Broadcast PRESENCE_UPDATE ONLY to clients connected to this roomCode
        if (normalizedRoomCode) {
          const roomActiveMembers = Array.from(socketPresences.values())
            .filter(p => p.roomCode === normalizedRoomCode);

          broadcastToRoom(normalizedRoomCode, {
            type: 'PRESENCE_UPDATE',
            members: roomActiveMembers
          });
        }
      }
    } catch (err) {
      console.error("WebSocket message processing error:", err);
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket client disconnected. ID: ${wsId}`);
    const disconnectedPresence = socketPresences.get(ws);
    const roomCode = disconnectedPresence?.roomCode;
    socketPresences.delete(ws);

    // Broadcast updated presences ONLY to clients in the disconnected user's roomCode
    if (roomCode) {
      const roomActiveMembers = Array.from(socketPresences.values())
        .filter(p => p.roomCode === roomCode);

      broadcastToRoom(roomCode, {
        type: 'PRESENCE_UPDATE',
        members: roomActiveMembers
      });
    }
  });
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
