# System Architecture: CONVENE

This document provides a detailed overview of the CONVENE system architecture, its components, and how they interact to provide a seamless human-agent collaborative workspace.

## 1. High-Level Architecture

CONVENE utilizes a modern decoupled architecture consisting of a React frontend and an Express/Node.js backend, communicating via REST and WebSockets.

```mermaid
graph TD
    Client[Frontend Client (React/Vite)]
    
    subgraph Backend [Backend Server (Express/Node.js)]
        REST_API[REST API endpoints]
        WS_Server[WebSocket Server]
        SSE_Server[Server-Sent Events]
    end
    
    DB[(PostgreSQL + Prisma)]
    LLM[Google Gemini API]

    Client <-->|REST / HTTP| REST_API
    Client <-->|ws://| WS_Server
    Client <-->|text/event-stream| SSE_Server
    
    REST_API <--> DB
    WS_Server <--> DB
    
    REST_API <-->|REST/gRPC| LLM
    SSE_Server <-->|Streaming| LLM
```

## 2. Frontend Architecture

The frontend is built with React 19 and Vite.

* **Workspace Context (`WorkspaceContext.tsx`):** The central state management hub. It holds the state for the active room, authenticated user, connected WebSocket status, active tab (Coding, Kanban, etc.), and agent outputs.
* **Co-Coding Lab (`CoCodingLab.tsx`):** Integrates `@monaco-editor/react` to provide a robust code editing experience. It handles file selection and sends real-time code changes to the backend.
* **Component-Based UI:** The UI is modular, utilizing components like `InputPanel`, `AgentStatusPanel`, and `ResultsPanel` to keep the codebase maintainable. Styling is powered by Tailwind CSS.

## 3. Backend Architecture

The backend operates as a unified API server serving REST requests, Server-Sent Events (SSE), and WebSockets.

### 3.1. REST API
* **`/api/auth`**: Handles user authentication, session token generation (via JWT), and cookie management.
* **`/api/rooms`**: Manages room creation, joining, and validation.
* **`/api/tasks`**: CRUD operations for the Kanban board tasks.
* **`/api/keys`**: Securely handles adding and retrieving user-provided API keys using encryption.

### 3.2. Real-time Communication (WebSockets)
* **Presence Sync:** The WebSocket server tracks connected clients in `socketPresences`. It broadcasts `PRESENCE_UPDATE` events to notify room members of who is currently online and active.
* **File Edits & Conflicts:** Real-time file changes are broadcast via WebSockets. The server maintains an in-memory `fileEdits` object to track who edited what. If multiple users edit the same file rapidly, a `CONFLICT_LOG` event is triggered.

### 3.3. Database Schema (Prisma)
The primary relational models include:
* **`User`**: System users (email, displayName, passwordHash).
* **`Room`**: Collaborative workspaces (code, createdBy).
* **`RoomMember`**: Junction table mapping Users to Rooms.
* **`Task`**: Kanban items tied to a specific room, supporting subtasks and agent reasoning via JSON.
* **`ApiKey`**: Encrypted API keys provided by users for specific rooms.

## 4. Multi-Agent Orchestration

CONVENE integrates closely with the Google Gemini API (via `@google/genai`) to power intelligent agents.

### 4.1. Specialized Agents
* **Planner**: Analyzes tasks and breaks them down into subtasks.
* **Estimator**: Evaluates required effort, time, and resources.
* **Risk-Flagger**: Identifies potential technical or project risks.

### 4.2. Execution Flow
1. **Triggering:** The client sends an orchestration request (`/api/orchestrate` or via WS `RUN_AGENTS`).
2. **Context Assembly:** The backend fetches the user's API key (either room-specific or falling back to the system `GEMINI_API_KEY`).
3. **LLM Query:** The backend formats the prompt with system instructions tailored to the specific agent role and queries Gemini.
4. **Streaming Delivery:** For complex orchestrations, the backend streams the agent's reasoning back to the client using Server-Sent Events (SSE), providing a real-time typing effect in the UI.

## 5. Security & Authentication

* **JWT Sessions:** Users receive HttpOnly cookies containing JSON Web Tokens after authenticating.
* **Room Validation:** Middleware (`requireRoomMembership`) ensures that API requests correspond to a room the user is actively a part of.
* **Encryption:** API keys are stored in the database using strong symmetric encryption (`crypto.ts` utilizing `aes-256-gcm`), ensuring that plain text keys are never exposed.
