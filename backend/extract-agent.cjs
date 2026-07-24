const fs = require('fs');

const serverContent = fs.readFileSync('server.ts', 'utf8');

// Extract /api/files/save
const fileSaveStart = serverContent.indexOf('// File edits tracking & conflict logging endpoint (requires roomCode)');
const orchestrateStart = serverContent.indexOf('// Real-time SSE Multi-Agent Orchestration endpoint');
const runAgentsEnd = serverContent.indexOf('// WebSocket Connection Logic');

const agentCode = serverContent.slice(fileSaveStart, runAgentsEnd);

const finalAgentRouter = `import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "../src/lib/db";
import { requireRoomMembership } from "../src/lib/auth";
import { decrypt } from "../src/lib/crypto";
import { broadcastToRoom, socketPresences, fileEdits, conflictLog } from "../server";

const router = Router();
const agentRateLimits = new Map<string, { count: number; resetAt: number }>();

// Map all these routes to router instead of app
` + agentCode.replace(/app\.(post|get|delete|put)\("\/api\//g, 'router.$1("/');

fs.writeFileSync('routes/agent.routes.ts', finalAgentRouter);

// Export fileEdits and conflictLog in server.ts
let newServerContent = serverContent.replace(
  'const fileEdits: Record<string, { email: string; content: string; timestamp: number }> = {};\nconst conflictLog: any[] = [];',
  'export const fileEdits: Record<string, { email: string; content: string; timestamp: number }> = {};\nexport const conflictLog: any[] = [];'
);

// Remove the extracted routes from server.ts
newServerContent = newServerContent.replace(agentCode, '');
fs.writeFileSync('server.ts', newServerContent);

console.log('agent.routes.ts created and extracted.');
