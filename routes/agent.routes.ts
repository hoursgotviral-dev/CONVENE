import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "../src/lib/db";
import { requireRoomMembership } from "../src/lib/auth";
import { decrypt } from "../src/lib/crypto";
import { broadcastToRoom, socketPresences, fileEdits, conflictLog } from "../server";

const router = Router();
// Map all these routes to router instead of app
// File edits tracking & conflict logging endpoint (requires roomCode)
router.post("/files/save", requireRoomMembership, (req: any, res: any) => {
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
router.post("/orchestrate", async (req, res) => {
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

const agentRateLimits = new Map<string, { count: number; resetAt: number }>();

// REST Route for targeted co-coding assistant
router.post("/agent", requireRoomMembership, async (req: any, res: any) => {
  const roomId = req.roomContext.roomId;
  const now = Date.now();
  let limit = agentRateLimits.get(roomId);
  if (!limit || limit.resetAt < now) {
    limit = { count: 0, resetAt: now + 5 * 60 * 1000 };
  }
  if (limit.count >= 20) {
    return res.status(429).json({ error: "Rate limit exceeded. Max 20 requests per 5 minutes per room." });
  }
  limit.count++;
  agentRateLimits.set(roomId, limit);

  const { code, prompt, fileName, apiKey, provider, roomCode } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode is required in the body." });
  }
  console.log(`Agent query received on /api/agent. Prompt: "${prompt}", Provider: ${provider || 'default (gemini)'}`);

  try {
    let explanation = "";
    let suggestedCode = "";
    let targetLines = "";
    let agentName: "Planner" | "Estimator" | "Risk-Flagger" = "Planner";

    let activeProvider = provider || 'gemini';
    let activeKey = apiKey;

    if (!activeKey) {
      const dbKey = await prisma.apiKey.findFirst({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
      });

      if (!dbKey) {
        return res.status(402).json({ error: "Connect an API key for this room to use the agent." });
      }

      activeProvider = dbKey.provider;
      const decryptedKey = decrypt(dbKey.key);
      activeKey = (decryptedKey === 'system' || decryptedKey === 'SYSTEM_DEFAULT') ? process.env.GEMINI_API_KEY : decryptedKey;
      
      if (!activeKey) {
        return res.status(402).json({ error: "Connect an API key for this room to use the agent." });
      }
    }

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
        targetLines = code.includes("app.get") ? 'router.get("/health", (req, res) => {\n  res.json({ status: "alive" });\n});' : code;
        suggestedCode = `router.get("/health", (req, res) => {
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
async function getPlannerFromGemini(task: string, aiClient: GoogleGenAI): Promise<any[]> {
  if (!aiClient) throw new Error("Gemini client is uninitialized.");

  const response = await aiClient.models.generateContent({
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

async function getEstimatorFromGemini(task: string, plannerOutput: any[], aiClient: GoogleGenAI): Promise<any> {
  if (!aiClient) throw new Error("Gemini client is uninitialized.");

  const response = await aiClient.models.generateContent({
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

async function getRiskFlaggerFromGemini(task: string, plannerOutput: any[], estimatorOutput: any, aiClient: GoogleGenAI): Promise<any> {
  if (!aiClient) throw new Error("Gemini client is uninitialized.");

  const response = await aiClient.models.generateContent({
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
  let aiClient: GoogleGenAI | null = null;

  if (targetRoomCode) {
    const room = await prisma.room.findUnique({ where: { code: targetRoomCode } });
    if (room) {
      const dbKey = await prisma.apiKey.findFirst({
        where: { roomId: room.id },
        orderBy: { createdAt: 'desc' },
      });
      if (dbKey) {
        const decryptedKey = decrypt(dbKey.key);
        const activeKey = (decryptedKey === 'system' || decryptedKey === 'SYSTEM_DEFAULT') ? process.env.GEMINI_API_KEY : decryptedKey;
        if (activeKey && dbKey.provider === 'gemini') {
          aiClient = new GoogleGenAI({ apiKey: activeKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
        }
      }
    }
  }

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
    if (aiClient) {
      plannerOutput = await getPlannerFromGemini(task, aiClient);
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
    if (aiClient) {
      estimatorOutput = await getEstimatorFromGemini(task, plannerOutput, aiClient);
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
    if (aiClient) {
      riskFlaggerOutput = await getRiskFlaggerFromGemini(task, plannerOutput, estimatorOutput, aiClient);
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

export default router;
export { runAgents };