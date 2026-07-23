import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { TeamMember, AgentState, AgentStatus, Subtask, EstimatorOutput, RiskFlaggerOutput, KanbanTask } from '../types';
import { apiFetch, setOn403Handler } from '../lib/apiClient';

export interface Proposal {
  explanation: string;
  targetLines: string;
  suggestedCode: string;
  agentName: 'Planner' | 'Estimator' | 'Risk-Flagger';
}

export interface TerminalLine {
  text: string;
  type: 'input' | 'output' | 'error' | 'agent' | 'system';
}

interface WorkspaceContextType {
  teamMembers: TeamMember[];
  planner: AgentState;
  estimator: AgentState;
  riskFlagger: AgentState;
  plannerOutput: Subtask[] | null;
  estimatorOutput: EstimatorOutput[] | EstimatorOutput | null;
  riskFlaggerOutput: RiskFlaggerOutput | null;
  isRunActive: boolean;
  error: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedFile: string;
  setSelectedFile: (file: string) => void;
  fileContents: Record<string, string>;
  setFileContents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentProposal: Proposal | null;
  setCurrentProposal: (proposal: Proposal | null) => void;
  apiKeysStatus: { connected: boolean; provider: 'gemini' | 'openai' | 'anthropic' | null };
  saveApiKey: (provider: 'gemini' | 'openai' | 'anthropic', key: string) => Promise<boolean>;
  disconnectApiKey: () => Promise<void>;
  terminalLines: TerminalLine[];
  addTerminalLine: (line: TerminalLine) => void;
  clearTerminal: () => void;
  isAgentResponding: boolean;
  triggerAgentQuery: (codeSnippet: string, userPrompt: string, source: 'code_view' | 'terminal') => Promise<Proposal | null>;
  wsConnected: boolean;
  connecting: boolean;
  handleRunAgents: (taskDescription: string) => void;
  tasks: KanbanTask[];
  createTask: (title: string, description: string, column?: string) => Promise<void>;
  updateTask: (id: string, updated: Partial<KanbanTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  conflictNotification: string | null;
  clearConflictNotification: () => void;
  broadcastFileEdit: (fileName: string, content: string) => void;
  authenticatedUserEmail: string | null;
  setAuthenticatedUserEmail: (email: string | null) => void;
  roomCode: string | null;
  setRoomCode: (code: string | null) => void;
  displayName: string | null;
  setDisplayName: (name: string | null) => void;
  createRoom: (displayName: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  joinRoom: (code: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState('coding');
  const [selectedFile, setSelectedFile] = useState('server.ts');
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [isAgentResponding, setIsAgentResponding] = useState(false);
  const [authenticatedUserEmail, setAuthenticatedUserEmailState] = useState<string | null>(() => {
    return sessionStorage.getItem('samanvay_auth_email') || null;
  });

  const [roomCode, setRoomCodeState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) {
        sessionStorage.setItem('samanvay_room', urlRoom.toUpperCase());
        return urlRoom.toUpperCase();
      }
    }
    return typeof window !== 'undefined' ? (sessionStorage.getItem('samanvay_room') || null) : null;
  });

  const [displayName, setDisplayNameState] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? (sessionStorage.getItem('samanvay_display_name') || null) : null;
  });

  const setRoomCode = (code: string | null) => {
    setRoomCodeState(code);
    if (code) {
      sessionStorage.setItem('samanvay_room', code);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('room') !== code) {
          params.set('room', code);
          window.history.replaceState(null, '', `?${params.toString()}`);
        }
      }
    } else {
      sessionStorage.removeItem('samanvay_room');
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.delete('room');
        const search = params.toString();
        window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
      }
    }
  };

  const setDisplayName = (name: string | null) => {
    setDisplayNameState(name);
    if (name) {
      sessionStorage.setItem('samanvay_display_name', name);
    } else {
      sessionStorage.removeItem('samanvay_display_name');
    }
  };

  const fetchRoomMembers = (code?: string) => {
    const activeCode = code || roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return;
    apiFetch(`/api/rooms/${encodeURIComponent(activeCode)}/members`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.members) {
          setTeamMembers(data.members);
        }
      })
      .catch((err) => console.error("Error loading room members", err));
  };

  const createRoom = async (creatorName: string): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      setDisplayName(creatorName);
      const res = await apiFetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", displayName: creatorName })
      });
      if (!res.ok) {
        const errData = await res.json();
        return { success: false, error: errData.error || "Failed to create room." };
      }
      const data = await res.json();
      if (data.success && data.room) {
        setRoomCode(data.room.code);
        fetchRoomMembers(data.room.code);
        fetchTasks(data.room.code);
        fetchKeysStatus(data.room.code);
        return { success: true, code: data.room.code };
      }
      return { success: false, error: "Invalid response from server." };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error while creating room." };
    }
  };

  const joinRoom = async (code: string, userName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) {
        return { success: false, error: "Please enter a valid room code." };
      }
      const res = await apiFetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", roomCode: normalizedCode, displayName: userName })
      });
      if (!res.ok) {
        const errData = await res.json();
        return { success: false, error: errData.error || "Room not found — check the code and try again." };
      }
      const data = await res.json();
      if (data.success && data.room) {
        setDisplayName(userName);
        setRoomCode(data.room.code);
        fetchRoomMembers(data.room.code);
        fetchTasks(data.room.code);
        fetchKeysStatus(data.room.code);
        return { success: true };
      }
      return { success: false, error: "Room not found — check the code and try again." };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error while joining room." };
    }
  };

  const setAuthenticatedUserEmail = (email: string | null) => {
    setAuthenticatedUserEmailState(email);
    if (email) {
      sessionStorage.setItem('samanvay_auth_email', email);
    } else {
      sessionStorage.removeItem('samanvay_auth_email');
      setRoomCode(null);
      setDisplayName(null);
      setTeamMembers([]);
    }
  };

  // API keys server-side status
  const [apiKeysStatus, setApiKeysStatus] = useState<{ connected: boolean; provider: 'gemini' | 'openai' | 'anthropic' | null }>({
    connected: false,
    provider: null
  });

  const fetchKeysStatus = (code?: string) => {
    const activeCode = code || roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return;
    apiFetch(`/api/keys/status?roomCode=${encodeURIComponent(activeCode)}`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (data) {
          setApiKeysStatus({
            connected: data.connected,
            provider: data.provider
          });
        }
      })
      .catch(err => console.error("Error loading keys status", err));
  };

  const saveApiKey = async (provider: 'gemini' | 'openai' | 'anthropic', key: string): Promise<boolean> => {
    const activeCode = roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return false;
    try {
      const res = await apiFetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key, roomCode: activeCode })
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeysStatus({
          connected: data.connected,
          provider: data.provider
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error saving key", err);
      return false;
    }
  };

  const disconnectApiKey = async () => {
    const activeCode = roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return;
    try {
      const res = await apiFetch(`/api/keys?roomCode=${encodeURIComponent(activeCode)}`, { method: 'DELETE' });
      if (res.ok) {
        setApiKeysStatus({ connected: false, provider: null });
      }
    } catch (err) {
      console.error("Error disconnecting keys", err);
    }
  };

  // Initial file contents
  const [fileContents, setFileContents] = useState<Record<string, string>>({
    'server.ts': `import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// TODO: Integrate multi-agent auth gateway
app.get("/api/health", (req, res) => {
  res.json({ status: "alive" });
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Server active on port 3000");
});`,
    'schema.ts': `import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id"),
  column: text("column").default("todo"),
  source: text("source").default("human"),
  createdAt: timestamp("created_at").defaultNow(),
});`,
    'firebase.config.ts': `import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: "samanvay-sandbox.firebaseapp.com",
  projectId: "samanvay-sandbox",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);`,
  });

  // Team presence state — starts empty, populated strictly from backend room member queries
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Tasks database sync
  const [tasks, setTasks] = useState<KanbanTask[]>([]);

  const fetchTasks = (code?: string) => {
    const activeCode = code || roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return;
    apiFetch(`/api/tasks?roomCode=${encodeURIComponent(activeCode)}`)
      .then(res => {
        if (!res.ok) return [];
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setTasks(data);
        }
      })
      .catch(err => console.error("Error loading tasks", err));
  };

  useEffect(() => {
    const activeCode = roomCode || sessionStorage.getItem('samanvay_room');
    if (activeCode) {
      fetchRoomMembers(activeCode);
      fetchTasks(activeCode);
      fetchKeysStatus(activeCode);
    }
  }, [roomCode]);

  const createTask = async (title: string, description: string, column: any = 'todo') => {
    const activeCode = roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return;
    const newTask = {
      id: `task-${Date.now()}`,
      roomCode: activeCode,
      title,
      description,
      column,
      source: 'human',
      subtasks: [],
    };
    try {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error("Error creating task", err);
    }
  };

  const updateTask = async (id: string, updated: Partial<KanbanTask>) => {
    const activeCode = roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return;
    try {
      const currentTask = tasks.find(t => t.id === id);
      if (!currentTask) return;
      const merged = { ...currentTask, ...updated, roomCode: activeCode };

      const res = await apiFetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error("Error updating task", err);
    }
  };

  const deleteTask = async (id: string) => {
    const activeCode = roomCode || sessionStorage.getItem('samanvay_room');
    if (!activeCode) return;
    try {
      const res = await apiFetch(`/api/tasks/${id}?roomCode=${encodeURIComponent(activeCode)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error("Error deleting task", err);
    }
  };

  // Conflict Notification banner
  const [conflictNotification, setConflictNotification] = useState<string | null>(null);
  const clearConflictNotification = () => setConflictNotification(null);

  const broadcastFileEdit = async (fileName: string, content: string) => {
    const activeCode = roomCode || sessionStorage.getItem('samanvay_room');
    if (!authenticatedUserEmail || !activeCode) return;
    try {
      await apiFetch('/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, content, email: authenticatedUserEmail, roomCode: activeCode }),
      });
    } catch (err) {
      console.error("Error sending file edit save to backend", err);
    }
  };

  // Agent Status State Machine
  const [planner, setPlanner] = useState<AgentState>({ status: 'idle', logs: [], progress: 0 });
  const [estimator, setEstimator] = useState<AgentState>({ status: 'idle', logs: [], progress: 0 });
  const [riskFlagger, setRiskFlagger] = useState<AgentState>({ status: 'idle', logs: [], progress: 0 });

  const [plannerOutput, setPlannerOutput] = useState<Subtask[] | null>(null);
  const [estimatorOutput, setEstimatorOutput] = useState<EstimatorOutput | null>(null);
  const [riskFlaggerOutput, setRiskFlaggerOutput] = useState<RiskFlaggerOutput | null>(null);
  const [isRunActive, setIsRunActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Terminal Lines
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { text: 'SAMANVAY Secure Multi-Agent Collaboration Shell v1.0.0', type: 'system' },
    { text: 'Connected to sandboxed dev environment. Port 3000 bound.', type: 'system' },
    { text: 'Type "help" to see available terminal commands or start instructions with "vibe <prompt>"', type: 'system' },
  ]);

  const addTerminalLine = (line: TerminalLine) => {
    setTerminalLines((prev) => [...prev, line]);
  };

  const clearTerminal = () => {
    setTerminalLines([]);
  };

  // WebSocket connection lifecycle
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);

  const mapPresenceMembers = (wsMembers: any[]) => {
    const currentRoomCode = (sessionStorage.getItem('samanvay_room') || roomCode || '').toUpperCase();
    
    // Filter wsMembers to only those in our current room
    const filteredWsMembers = wsMembers.filter(w => {
      const wRoom = (w.roomCode || '').toUpperCase();
      return wRoom === currentRoomCode;
    });

    setTeamMembers(prevMembers => {
      if (prevMembers.length === 0) {
        fetchRoomMembers(currentRoomCode);
      }

      const updated = prevMembers.map(m => {
        const match = filteredWsMembers.find(w => {
          const wEmail = w.email?.toLowerCase();
          const wName = w.displayName?.toLowerCase();
          const mName = m.name.toLowerCase();
          return (wEmail && mName.includes(wEmail.split('@')[0])) || (wName && mName.includes(wName));
        });

        if (match) {
          return {
            ...m,
            status: (match.status as any) || 'active',
            cursorPosition: match.cursorPosition || m.cursorPosition,
          };
        }
        return m;
      });

      filteredWsMembers.forEach(w => {
        const wEmail = w.email?.toLowerCase();
        const wName = (w.displayName || w.email?.split('@')[0] || '').toLowerCase();
        const exists = updated.some(m => m.name.toLowerCase().includes(wName) || (wEmail && m.name.toLowerCase().includes(wEmail.split('@')[0])));
        
        if (!exists && wName) {
          const capitalized = wName.charAt(0).toUpperCase() + wName.slice(1);
          updated.push({
            id: `m-ws-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            name: capitalized,
            role: 'Collaborator',
            avatarColor: 'bg-purple-300 text-purple-950',
            status: (w.status as any) || 'active',
            cursorPosition: w.cursorPosition,
          });
        }
      });

      return updated;
    });
  };

  useEffect(() => {
    const currentRoom = roomCode || sessionStorage.getItem('samanvay_room');
    if (!authenticatedUserEmail || !currentRoom) {
      setWsConnected(false);
      setConnecting(false);
      return;
    }

    setConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setConnecting(false);
      // Immediately register presence on connection
      ws.send(JSON.stringify({
        type: 'PRESENCE_SYNC',
        email: authenticatedUserEmail,
        displayName: displayName || sessionStorage.getItem('samanvay_display_name') || '',
        roomCode: currentRoom,
        status: 'active',
        cursorPosition: `viewing ${selectedFile}`
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'PRESENCE_UPDATE':
            mapPresenceMembers(message.members || []);
            break;
          case 'TASK_MUTATION':
            setTasks(message.tasks || []);
            break;
          case 'CONFLICT_LOG':
            if (message.conflict.user !== authenticatedUserEmail) {
              setConflictNotification(`This file was just saved by another user (${message.conflict.user}) — please reload or review edits to prevent overwriting.`);
            }
            break;
          case 'STATUS':
            if (message.agent === 'planner') {
              setPlanner(prev => ({ ...prev, status: message.status, progress: message.progress ?? prev.progress }));
            } else if (message.agent === 'estimator') {
              setEstimator(prev => ({ ...prev, status: message.status, progress: message.progress ?? prev.progress }));
            } else if (message.agent === 'riskFlagger') {
              setRiskFlagger(prev => ({ ...prev, status: message.status, progress: message.progress ?? prev.progress }));
            }
            break;
          case 'LOG':
            if (message.agent === 'planner') {
              setPlanner(prev => ({ ...prev, logs: [...prev.logs, message.message] }));
            } else if (message.agent === 'estimator') {
              setEstimator(prev => ({ ...prev, logs: [...prev.logs, message.message] }));
            } else if (message.agent === 'riskFlagger') {
              setRiskFlagger(prev => ({ ...prev, logs: [...prev.logs, message.message] }));
            }
            break;
          case 'OUTPUT_PLANNER':
            setPlannerOutput(message.data);
            break;
          case 'OUTPUT_ESTIMATOR':
            setEstimatorOutput(message.data);
            break;
          case 'OUTPUT_RISK_FLAGGER':
            setRiskFlaggerOutput(message.data);
            break;
          case 'ERROR':
            setError(message.error);
            setIsRunActive(false);
            break;
        }
      } catch (err) {
        console.error("WS error parsing message", err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setConnecting(false);
    };

    ws.onerror = () => {
      setConnecting(false);
    };

    return () => {
      ws.close();
    };
  }, [authenticatedUserEmail, selectedFile, roomCode, displayName]);

  // Synchronize dynamic presence status periodically
  useEffect(() => {
    const currentRoom = roomCode || sessionStorage.getItem('samanvay_room');
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && authenticatedUserEmail && currentRoom) {
        wsRef.current.send(JSON.stringify({
          type: 'PRESENCE_SYNC',
          email: authenticatedUserEmail,
          displayName: displayName || sessionStorage.getItem('samanvay_display_name') || '',
          roomCode: currentRoom,
          status: 'active',
          cursorPosition: `editing ${selectedFile}`
        }));
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [authenticatedUserEmail, selectedFile, roomCode, displayName]);

  const handleRunAgents = (taskDescription: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setError(null);
    setPlannerOutput(null);
    setEstimatorOutput(null);
    setRiskFlaggerOutput(null);
    setIsRunActive(true);

    setPlanner({ status: 'thinking', logs: ['Spawning Planner agent...'], progress: 10 });
    setEstimator({ status: 'idle', logs: [], progress: 0 });
    setRiskFlagger({ status: 'idle', logs: [], progress: 0 });

    wsRef.current.send(
      JSON.stringify({
        type: 'RUN_AGENTS',
        task: taskDescription,
      })
    );
  };

  const handleOrchestrationMessage = (parsed: any) => {
    switch (parsed.type) {
      case 'STATUS':
        if (parsed.agent === 'planner') {
          setPlanner(prev => ({ ...prev, status: parsed.status, progress: parsed.progress ?? prev.progress }));
        } else if (parsed.agent === 'estimator') {
          setEstimator(prev => ({ ...prev, status: parsed.status, progress: parsed.progress ?? prev.progress }));
        } else if (parsed.agent === 'riskFlagger') {
          setRiskFlagger(prev => ({ ...prev, status: parsed.status, progress: parsed.progress ?? prev.progress }));
        }
        break;
      case 'LOG':
        if (parsed.agent === 'planner') {
          setPlanner(prev => ({ ...prev, logs: [...prev.logs, parsed.message] }));
        } else if (parsed.agent === 'estimator') {
          setEstimator(prev => ({ ...prev, logs: [...prev.logs, parsed.message] }));
        } else if (parsed.agent === 'riskFlagger') {
          setRiskFlagger(prev => ({ ...prev, logs: [...prev.logs, parsed.message] }));
        }
        break;
      case 'OUTPUT_PLANNER':
        setPlannerOutput(parsed.data);
        break;
      case 'OUTPUT_ESTIMATOR':
        setEstimatorOutput(parsed.data);
        break;
      case 'OUTPUT_RISK_FLAGGER':
        setRiskFlaggerOutput(parsed.data);
        break;
      case 'ERROR':
        setError(parsed.error);
        break;
    }
  };

  // Shared function to query API Route and trigger state transitions
  const triggerAgentQuery = async (codeSnippet: string, userPrompt: string, source: 'code_view' | 'terminal'): Promise<Proposal | null> => {
    if (isAgentResponding) return null;

    setIsAgentResponding(true);
    setCurrentProposal(null);
    setError(null);
    setPlannerOutput(null);
    setEstimatorOutput(null);
    setRiskFlaggerOutput(null);

    // Initialize agent thinking states cascade style
    setPlanner({ status: 'thinking', logs: ['Spawning Planner worker...', 'Parsing targeted workspace lines...'], progress: 20 });
    setEstimator({ status: 'thinking', logs: ['Standing by for Planner blueprints...'], progress: 10 });
    setRiskFlagger({ status: 'thinking', logs: ['Standing by for Estimator metrics...'], progress: 5 });

    if (source === 'terminal') {
      addTerminalLine({ text: `vibe: ${userPrompt}`, type: 'input' });
      addTerminalLine({ text: 'AI Agents triggered on selection. Decomposing solution plan...', type: 'system' });
    }

    try {
      const response = await apiFetch('/api/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: userPrompt,
          code: codeSnippet,
          fileName: selectedFile
        }),
      });

      if (!response.body) {
        throw new Error("Failed to initialize Server-Sent-Events stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(cleanLine.substring(6));
              handleOrchestrationMessage(parsed);
            } catch (e) {
              console.error("Error parsing SSE line:", cleanLine, e);
            }
          }
        }
      }

      // Query the targeted single-agent patch fallback to present the co-coding overlay
      const res = await apiFetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: codeSnippet,
          prompt: userPrompt,
          fileName: selectedFile,
        }),
      });

      if (!res.ok) {
        throw new Error(`Fallback co-coding lookup failed: ${res.statusText}`);
      }

      const data = await res.json();

      const proposal: Proposal = {
        explanation: data.explanation || 'No explanation provided.',
        targetLines: data.targetLines || '',
        suggestedCode: data.suggestedCode || '',
        agentName: data.agentName || 'Planner',
      };

      setCurrentProposal(proposal);

      if (source === 'terminal') {
        addTerminalLine({ text: `Agent suggestion loaded: ${proposal.explanation}`, type: 'agent' });
        addTerminalLine({ text: `Target replacement: "${proposal.targetLines}"`, type: 'agent' });
        addTerminalLine({ text: 'Diff overlaid on editor. Approve or Reject change to proceed.', type: 'system' });
      } else {
        addTerminalLine({ text: `Agent [${proposal.agentName}] suggested a modification to ${selectedFile}.`, type: 'system' });
      }

      return proposal;

    } catch (err: any) {
      console.error(err);
      setPlanner({ status: 'error', logs: [`Error: ${err.message}`], progress: 0 });
      setEstimator({ status: 'error', logs: [`Pipeline failure triggered.`], progress: 0 });
      setRiskFlagger({ status: 'error', logs: [`Safety scan disrupted.`], progress: 0 });

      addTerminalLine({ text: `Agent error: ${err.message || 'Unknown network error'}`, type: 'error' });
      return null;
    } finally {
      setIsAgentResponding(false);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        teamMembers,
        planner,
        estimator,
        riskFlagger,
        plannerOutput,
        estimatorOutput,
        riskFlaggerOutput,
        isRunActive,
        error,
        activeTab,
        setActiveTab,
        selectedFile,
        setSelectedFile,
        fileContents,
        setFileContents,
        currentProposal,
        setCurrentProposal,
        apiKeysStatus,
        saveApiKey,
        disconnectApiKey,
        terminalLines,
        addTerminalLine,
        clearTerminal,
        isAgentResponding,
        triggerAgentQuery,
        wsConnected,
        connecting,
        handleRunAgents,
        tasks,
        createTask,
        updateTask,
        deleteTask,
        conflictNotification,
        clearConflictNotification,
        broadcastFileEdit,
        authenticatedUserEmail,
        setAuthenticatedUserEmail,
        roomCode,
        setRoomCode,
        displayName,
        setDisplayName,
        createRoom,
        joinRoom,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
