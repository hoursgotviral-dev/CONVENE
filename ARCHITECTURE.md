# Architecture — CONVENE

## Table of Contents
1. [What This Is](#1-what-this-is)
2. [High-Level Design](#2-high-level-design)
3. [System Components](#3-system-components)
4. [Data Model — The Contract](#4-data-model--the-contract)
5. [Tech Stack](#5-tech-stack)
6. [Key Design Decisions & Rationale](#6-key-design-decisions--rationale)
7. [Failure Modes and Handling](#7-failure-modes-and-handling)

## 1. What This Is
### Purpose
CONVENE is a real-time, multiplayer collaborative workspace that integrates intelligent AI agents into the software development lifecycle. Rather than treating AI as a separate chatbot window, CONVENE embeds agents directly into the team's shared environment (code editor, kanban board, budgeting tools). 

### Objectives
The primary objectives of CONVENE are to:
- Synchronize state and presence across multiple users in real-time.
- Resolve file edit conflicts gracefully without data loss.
- Provide contextual AI agents (Planner, Estimator, Risk-Flagger) that can analyze the live workspace.
- Ensure all API keys and user data are securely isolated per room.

### Scope
The system functions as a collaborative IDE and project management hub. 
It does not:
- Execute code in a sandboxed environment.
- Replace full version control (it tracks live edits, not commits).
- Operate without a user-provided LLM API key or a default system key.

## 2. High-Level Design

```text
                        ┌─────────────────────────┐
                        │      Client Browser      │
                        │   (React / Vite App)     │
                        └────────────┬─────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │ HTTP (REST)       │ WebSockets (ws://)│ SSE (text/event-stream)
                 ▼                   ▼                   ▼
   ┌──────────────────────────────────────────────────────────┐
   │                       CONVENE Backend                    │
   │                                                          │
   │  ┌────────────────────┐      ┌──────────────────────┐    │
   │  │   Auth & Rooms     │      │  WebSocket Server    │    │
   │  │  - JWT sessions    │      │  - Presence sync     │    │
   │  │  - Room validation │      │  - File edit tracking│    │
   │  └──────────┬─────────┘      └──────────┬───────────┘    │
   │             │                           │                │
   │  ┌──────────▼─────────┐      ┌──────────▼───────────┐    │
   │  │   Agent Routes     │      │   Conflict Engine    │    │
   │  │  - SSE Streaming   │      │  - Time-window diffs │    │
   │  │  - LLM Integration │      │  - Overwrite logging │    │
   │  └──────────┬─────────┘      └──────────────────────┘    │
   └─────────────┼────────────────────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │  Google Gemini API   │
      │  (External Service)  │
      └──────────────────────┘
```

### System Workflow
1. A user authenticates and joins a specific **Room** using a room code.
2. The client establishes a **WebSocket connection** to sync presence and cursor positions with other room members.
3. Users collaboratively edit files or modify Kanban tasks; changes are broadcast via WebSockets.
4. If an edit conflict occurs (two users edit the same file rapidly), the **Conflict Engine** resolves it and alerts the room.
5. A user triggers the **Agent Pipeline** (e.g., asking the Planner for subtasks).
6. The backend retrieves the encrypted API key, decrypts it, and queries the **Gemini API**.
7. The agent's reasoning is streamed back to the client in real-time via **Server-Sent Events (SSE)**.

## 3. System Components

### 3.1 frontend/
**Purpose:** Presents the collaborative workspace, editor, and agent outputs.
**Responsibilities:**
- Manages global state via `WorkspaceContext`.
- Renders the Co-Coding Lab using Monaco Editor.
- Displays live presence (who is online, who is typing).
- Consumes SSE streams to render agent thoughts sequentially.

### 3.2 backend/server.ts
**Purpose:** The entry point for the Node.js application, managing HTTP routes and the WebSocket server.
**Responsibilities:**
- Mounts REST routers (auth, rooms, keys, tasks, agents).
- Maintains the in-memory `socketPresences` map.
- Broadcasts messages strictly to clients within the same `roomCode`.

### 3.3 backend/routes/agent.routes.ts
**Purpose:** Orchestrates the multi-agent AI pipeline.
**Responsibilities:**
- Receives natural language prompts and current workspace context.
- Formats structured system instructions for the Planner, Estimator, and Risk-Flagger.
- Handles rate limiting to prevent API abuse.
- Streams responses back to the client using SSE headers.

### 3.4 backend/src/lib/crypto.ts
**Purpose:** Secures sensitive credentials.
**Responsibilities:**
- Encrypts user-provided LLM API keys using `aes-256-gcm`.
- Decrypts keys just-in-time when an agent needs to make an API call.

## 4. Data Model — The Contract

The PostgreSQL database (managed via Prisma) acts as the source of truth for persistent data.

- **User:** `id`, `email`, `passwordHash`, `displayName`
- **Room:** `id`, `code`, `createdBy`
- **RoomMember:** Junction mapping Users to Rooms, with a `status`.
- **Task:** Kanban items belonging to a Room, supporting JSON `subtasks` and `agentReasoning`.
- **ApiKey:** Room-specific LLM keys, stored with an encrypted `key` and `provider`.

## 5. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend API** | Node.js + Express | Fast asynchronous I/O, native support for SSE and WebSockets. |
| **Real-time** | `ws` (WebSockets) | Lightweight, low-latency bidirectional communication for presence and live edits. |
| **Database** | PostgreSQL + Prisma | Strong relational integrity; Prisma offers excellent TypeScript safety. |
| **Frontend** | React + Vite | Fast client-side rendering; Vite provides a rapid development loop. |
| **Code Editor** | Monaco Editor | The same engine powering VS Code, providing syntax highlighting and cursor tracking capabilities. |
| **LLM Provider** | Google GenAI API | Gemini models provide fast, structured JSON generation and reasoning capabilities. |

## 6. Key Design Decisions & Rationale

- **Server-Sent Events (SSE) over WebSockets for AI streaming.** While WebSockets are used for presence and file edits (which are bidirectional and continuous), SSE is used for streaming the AI's response. SSE is natively unidirectional, simpler to implement for text streams, and works perfectly with standard HTTP proxies.
- **In-Memory Conflict Engine.** Tracking file edits and conflicts in memory (`fileEdits` object in `server.ts`) instead of the database prevents severe database thrashing. Real-time collaboration generates thousands of keystrokes; writing each to a database is unacceptably slow.
- **Room-Based Isolation.** Every WebSocket broadcast and API request is scoped to a specific `roomCode`. This prevents data leakage across different collaborative sessions.
- **AES-256-GCM for API Keys.** Storing raw API keys is a massive security risk. We encrypt them symmetrically before database insertion. GCM mode provides both confidentiality and authenticity.
- **Specialized Agents instead of a monolithic prompt.** Breaking the AI into a Planner, Estimator, and Risk-Flagger allows each prompt to be highly focused. It reduces hallucinations and makes the UI cleaner (each agent gets its own panel).

## 7. Failure Modes and Handling

| Failure | Handling |
|---------|----------|
| **LLM API times out / fails** | The backend catches the exception, sends an error event via SSE, and the frontend displays a graceful error boundary rather than crashing. |
| **WebSocket disconnects** | The frontend detects the closure and attempts to reconnect. The backend removes the stale client from `socketPresences` and broadcasts an updated roster to the room. |
| **File Edit Conflict** | If User B overwrites User A within 15 seconds, the backend allows it but logs a `CONFLICT_LOG` event, showing a non-intrusive banner on the frontend so users can manually reconcile. |
| **Missing API Key** | If no key is set for the room, the backend immediately returns a `402 Payment Required` status, prompting the frontend to open the API Keys onboarding modal. |
