# CONVENE

A real-time, multi-agent collaborative workspace where teams build software alongside AI.

Built as a personal full-stack project exploring seamless LLM API integration in multiplayer environments.

🔗 **Live demo:**https://convene-blue.vercel.app/
🔗 **Backend API:** https://convene-g4t6.onrender.com
## For reviewers — start here
Fastest path, no install. Open the live dashboard:

- **Multi-Presence Workspace** — See real-time presence indicators, cursor tracking, and live synchronization across multiple clients using WebSockets.
- **Co-Coding Lab** — A collaborative code editor with built-in conflict resolution and edit tracking.
- **Multi-Agent Orchestration** — The heart of the platform. Trigger the "Realtime Workspace Pipeline" to engage specialized Gemini-powered agents (Planner, Estimator, Risk-Flagger) that stream reasoning back via Server-Sent Events (SSE).
- **Kanban & Budgeting** — Integrated task tracking and project budgeting tools that the AI agents can contextualize.

## Run it yourself, ~5 minutes

```bash
git clone https://github.com/hoursgotviral-dev/CONVENE.git
cd CONVENE

# 1. Start the backend
cd backend
npm install
# Set up .env with DATABASE_URL and GEMINI_API_KEY
npx prisma db push
npm run dev # http://localhost:3000

# 2. Start the frontend
cd ../frontend
npm install
npm run dev # http://localhost:5173
```

## The problem
When teams build software with AI today, the process is heavily fragmented.
1. A developer copies code from their IDE into ChatGPT or Claude.
2. The AI generates a response without broader project context.
3. The developer pastes it back.
4. Teammates have no visibility into what the AI suggested, why it was chosen, or how it affects the project plan.

**What it means:** Context is lost, collaboration is asynchronous, and AI operates in a silo away from the actual workspace.

## What we're building
CONVENE bridges the gap between multiplayer collaboration and intelligent agent orchestration.

- It provides a shared **Room** where developers code together.
- It introduces **Specialized Agents** (Planner, Estimator, Risk-Flagger) that analyze the live workspace in real-time.
- If multiple developers edit the same file rapidly, the **Conflict Engine** logs and resolves overwrites.
- The agents stream their reasoning back to the entire room instantly using **SSE (Server-Sent Events)**, ensuring everyone is on the same page.

## Architecture

**Design principle**
Determinism for state, LLMs for reasoning. The real-time synchronization, cursor tracking, and file edit conflict resolution are handled purely via standard WebSockets and Node.js logic. The LLM (Google Gemini) is invoked strictly for orchestration and reasoning, keeping the collaborative foundation fast and auditable.

**Flow**
```text
Live Workspace (React) ──┐
                         ├──> WebSockets (Presence, Edits)
    Collaborator B ──────┘
                         │
               trigger Agent Pipeline
                         ▼
             ┌────── CONVENE Backend ──────┐
             │ Orchestrator & Rate Limiter │
             └───────────┬─────────────────┘
                         │ 
               REST/gRPC │ (Task, Context)
                         ▼
                  Google Gemini API
          (Planner, Estimator, Risk-Flagger)
                         │
             SSE Streams │ (Real-time JSON/Markdown)
                         ▼
               Live Workspace (React)
```

## The custom agents

| Name | Role |
|------|------|
| **Planner** | Analyzes the current task and breaks it down into actionable subtasks. |
| **Estimator** | Evaluates the required effort, time, and resources for the proposed plan. |
| **Risk-Flagger** | Identifies potential technical debt, security issues, or project risks in the workspace. |

## Safety properties
Enforced in code and covered by architecture design:

- **Isolated Rooms:** All collaborative activities and agent contexts are strictly isolated within specific Room IDs. Users must authenticate and join a room.
- **Encrypted Keys:** Users can provide their own LLM API keys. These are stored using symmetric AES-256-GCM encryption and decrypted only at the moment of API invocation.
- **Conflict Logging:** If two users edit the same file within a 15-second window, the system detects the overwrite, records the original author, and broadcasts a conflict banner to the room.
- **Rate Limiting:** Agent invocations are rate-limited per room to prevent API abuse and control costs.

## Stack

| Concern | Choice | Why |
|---------|--------|-----|
| **Backend** | Node.js + Express | Fast asynchronous handling, native WebSocket support, and easy SSE streaming. |
| **Frontend** | React + Vite | Clean, rapid client-side rendering with Tailwind CSS for modern aesthetics. |
| **Real-time** | WebSockets + SSE | WebSockets for low-latency bidirectional presence; SSE for unidirectional agent streaming. |
| **Database** | PostgreSQL + Prisma | Relational integrity for Users, Rooms, Tasks, and encrypted API keys. |
| **LLM** | Google Gemini API | Powerful reasoning engine with structured JSON output capabilities. |

## Project structure
```text
backend/
  routes/
    agent.routes.ts        # Agent orchestration, SSE, & WebSockets
    auth.routes.ts         # JWT Session management
    rooms.routes.ts        # Workspace isolation logic
  src/lib/
    crypto.ts              # AES-256-GCM encryption for API keys
  server.ts                # WS server, Presence mapping, Conflict tracking
frontend/
  src/
    components/            # UI Panels (CoCodingLab, AgentStatusPanel)
    context/               # WorkspaceContext for real-time state
```

## Documents

| Document | Contents |
|----------|----------|
| `README.md` | This file. Setup, pitch, and high-level architecture. |
| `ARCHITECTURE.md` | Full design, data model, component interaction, and security. |
