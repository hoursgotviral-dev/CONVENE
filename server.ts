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
  AuthenticatedRequest,
  issueRoomSessionCookie,
  requireRoomMembership,
  RoomAuthenticatedRequest,
  verifyRoomCookie
} from "./src/lib/auth";
import { encrypt, decrypt } from "./src/lib/crypto";
import { TeamMember } from "./src/types";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());


import authRouter from "./routes/auth.routes";
import roomsRouter from "./routes/rooms.routes";
import keysRouter from "./routes/keys.routes";
import tasksRouter from "./routes/tasks.routes";
import agentRouter, { runAgents } from "./routes/agent.routes";

// WebSocket presences tracking map
export const socketPresences = new Map<any, { email: string; displayName?: string; roomCode?: string; status: string; cursorPosition?: string }>();

// Helper to broadcast only to WebSocket clients in a specific room
export function broadcastToRoom(roomCode: string, msg: any) {
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

// In-memory conflict log and file editor tracking
export const fileEdits: Record<string, { email: string; content: string; timestamp: number }> = {};
export const conflictLog: any[] = [];

app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/keys", keysRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api", agentRouter);

// WebSocket Connection Logic
wss.on("connection", (ws, req) => {
  const wsId = Math.random().toString(36).substring(2, 10);
  console.log(`WebSocket client connected. ID: ${wsId}`);
  const cookieHeader = req.headers.cookie;

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'RUN_AGENTS') {
        const task = data.task || '';
        const roomCode = (data.roomCode || socketPresences.get(ws)?.roomCode || '').toUpperCase();
        
        if (roomCode) {
          const context = await verifyRoomCookie(cookieHeader, roomCode);
          if (!context) {
            ws.close(4001, "Unauthorized");
            return;
          }
        }

        console.log(`Starting multi-agent orchestration for task in room [${roomCode}]: "${task.substring(0, 40)}..."`);
        await runAgents(ws as any, task, roomCode);
      } else if (data.type === 'PRESENCE_SYNC') {
        const { email, status, cursorPosition, displayName, roomCode } = data;
        const normalizedRoomCode = (roomCode || '').trim().toUpperCase();

        if (normalizedRoomCode) {
          const context = await verifyRoomCookie(cookieHeader, normalizedRoomCode);
          if (!context) {
            ws.close(4001, "Unauthorized");
            return;
          }
        }

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
