# CONVENE Workspace

**CONVENE** is a Real-time Human-Agent Collaboration Hub. It is a unified workspace where teams can coordinate alongside AI agents to tackle tasks like co-coding, project planning, and task tracking. 

## 🚀 Features

* **Multi-Presence Workspace:** Real-time synchronization of users in rooms using WebSockets.
* **Co-Coding Lab:** Collaborative code editor with file edit tracking and conflict resolution.
* **Multi-Agent Orchestration:** Interact with specialized AI agents (Planner, Estimator, Risk-Flagger) powered by the Google Gemini API.
* **Kanban Task Tracker:** Track tasks and orchestrate workflows within your room.
* **Budget & Decision Tools:** Utilities to track project budgets and decisions.
* **Real-time Pipeline:** Direct streaming of AI agent outputs via Server-Sent Events (SSE).

## 🛠️ Technology Stack

**Frontend:**
* React 19 + Vite
* Tailwind CSS + Framer Motion for styling and animations
* Monaco Editor (Code Editing) & Xterm.js (Terminal)
* Lucide React for Icons

**Backend:**
* Node.js + Express
* WebSocket (`ws`) for real-time presence and collaboration
* Prisma + PostgreSQL for database and persistence
* Google GenAI SDK (`@google/genai`) for LLM agent integration

## 📦 Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* PostgreSQL database

### Installation

1. **Clone the repository** (if you haven't already).

2. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

### Environment Configuration

In the `backend` directory, create a `.env` file based on your environment:
```env
# Database connection string
DATABASE_URL="postgresql://user:password@localhost:5432/convene?schema=public"

# Google Gemini API Key (Can also be configured per-room via the UI)
GEMINI_API_KEY="your_google_genai_api_key"

# Frontend Origin for CORS
FRONTEND_ORIGIN="http://localhost:5173"
```

### Database Setup

Run Prisma migrations to set up your PostgreSQL database schema:
```bash
cd backend
npx prisma migrate dev
```

### Running the Application

1. **Start the Backend Server:**
   ```bash
   cd backend
   npm run dev
   ```
   *The backend server will start on port 3000.*

2. **Start the Frontend Development Server:**
   ```bash
   cd frontend
   npm run dev
   ```
   *The frontend will start typically on port 5173.*

3. Open your browser and navigate to `http://localhost:5173`. 
4. Sign in with your email, create or join a room, and start collaborating!

## 🔐 Security & API Keys

- **Room Isolation:** All collaborative activities are isolated within specific rooms. You must join a room with a valid code.
- **Custom API Keys:** Users can securely add their own LLM API keys via the "API Keys" onboarding modal. These are stored encrypted in the database.

## 📄 License
Convene © 2026. All rights reserved.
