export type AgentStatus = 'idle' | 'thinking' | 'done' | 'error';

export interface Subtask {
  id: string;
  title: string;
  description: string;
  category: string;
  isAgentGenerated?: boolean;
  approvedByHuman?: boolean;
}

export interface CostBreakdownItem {
  category: string;
  hours: number;
  cost: number;
}

export interface EstimatorOutput {
  totalHours: number;
  totalCost: number;
  breakdown: CostBreakdownItem[];
}

export interface RiskItem {
  id: string;
  risk: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  mitigation: string;
}

export interface RiskFlaggerOutput {
  risks: RiskItem[];
}

export interface AgentState {
  status: AgentStatus;
  logs: string[];
  progress: number; // 0 to 100
}

export interface SamanvayState {
  planner: AgentState;
  estimator: AgentState;
  riskFlagger: AgentState;
  plannerOutput: Subtask[] | null;
  estimatorOutput: EstimatorOutput | null;
  riskFlaggerOutput: RiskFlaggerOutput | null;
  isRunActive: boolean;
  error: string | null;
}

// Collaboration Team presence
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: 'active' | 'idle' | 'offline';
  cursorPosition?: string;
}

// Kanban Task
export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  assigneeId?: string;
  column: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  source: 'human' | 'agent_suggested';
  agentReasoning?: string;
  isApprovedByHuman?: boolean;
  subtasks: { id: string; text: string; done: boolean; source: 'human' | 'agent' }[];
}

// Budget Decision Option
export interface BudgetItem {
  id: string;
  item: string;
  allocated: number;
  agentRecommended: number;
  agentReasoning: string;
  approvedByHuman: boolean | null; // null = pending decision, true = approved agent, false = customized/overridden
  overriddenValue?: number;
}

export type WebSocketMessage =
  | { type: 'RESET' }
  | { type: 'ERROR'; error: string }
  | { type: 'STATUS'; agent: 'planner' | 'estimator' | 'riskFlagger'; status: AgentStatus; progress?: number }
  | { type: 'LOG'; agent: 'planner' | 'estimator' | 'riskFlagger'; message: string }
  | { type: 'OUTPUT_PLANNER'; data: Subtask[] }
  | { type: 'OUTPUT_ESTIMATOR'; data: EstimatorOutput }
  | { type: 'OUTPUT_RISK_FLAGGER'; data: RiskFlaggerOutput };

