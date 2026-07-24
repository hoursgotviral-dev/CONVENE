const fs = require('fs');

const serverContent = fs.readFileSync('server.ts', 'utf8');

// The marker where we start deleting explicit routes
const authStart = serverContent.indexOf('// Authentication Endpoints');
// The marker where we stop deleting explicit routes (and resume)
const wsStart = serverContent.indexOf('// WebSocket Connection Logic');

if (authStart === -1 || wsStart === -1) {
  console.error("Could not find markers!");
  process.exit(1);
}

const beforeAuth = serverContent.slice(0, authStart);
const afterWs = serverContent.slice(wsStart);

const routerImports = `
import authRouter from "./routes/auth.routes";
import roomsRouter from "./routes/rooms.routes";
import keysRouter from "./routes/keys.routes";
import tasksRouter from "./routes/tasks.routes";
import agentRouter from "./routes/agent.routes";

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

`;

// Let's remove the duplicated exports of socketPresences, broadcastToRoom, fileEdits, conflictLog from `beforeAuth` since we are redefining them in `routerImports` OR we can just replace the whole section cleanly.

// Actually, `beforeAuth` has lines 1-38, which is just imports and app setup.
// Wait, in my previous view, socketPresences and broadcastToRoom were around line 170. Which is AFTER `// Authentication Endpoints`. So they got caught in the deleted section. This means redefining them here is PERFECT.

// Let's verify what is in `beforeAuth` right now:
/*
import express from "express";
import path from "path";
...
app.use(express.json());
app.use(cookieParser());
*/

const finalContent = beforeAuth + routerImports + afterWs;

fs.writeFileSync('server.ts', finalContent);
console.log('Routes cleaned up in server.ts');
