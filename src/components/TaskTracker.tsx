import React, { useState } from 'react';
import { KanbanTask, TeamMember } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Sparkles, 
  Plus, 
  User, 
  Trash2,
  Check,
  Zap
} from 'lucide-react';

interface TaskTrackerProps {
  teamMembers: TeamMember[];
}

export const TaskTracker: React.FC<TaskTrackerProps> = ({ teamMembers }) => {
  const { tasks, createTask, updateTask, deleteTask } = useWorkspace();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskCol, setNewTaskCol] = useState<'backlog' | 'todo' | 'in_progress'>('todo');

  const getAssignee = (id?: string) => {
    return teamMembers.find(m => m.id === id);
  };

  const handleCreateTaskLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await createTask(newTaskTitle, newTaskDesc, newTaskCol);
    setNewTaskTitle('');
    setNewTaskDesc('');
  };

  const handleRequestAgentTask = async () => {
    // Generate an agent-suggested task and send to database endpoint
    const mockSuggestions = [
      {
        title: '[Agent Proposal] Configure WebSocket heartbeats',
        description: 'Send client ping frames every 30 seconds. Kill stale, unacknowledged socket connections gracefully.',
        reasoning: 'Websocket logs show idle connections are being timed out prematurely by nginx proxies after 60s.',
        subtasks: [
          { id: 'as-1', text: 'Setup server interval ping trigger', done: false, source: 'agent' as const },
          { id: 'as-2', text: 'Listen for client-side pong reply', done: false, source: 'agent' as const },
        ]
      },
      {
        title: '[Agent Proposal] Audit env variables leak risk',
        description: 'Scan production scripts to verify no private keys or database passwords are hardcoded.',
        reasoning: 'Security guidelines highlight that committing plaintext API tokens triggers sandbox safety locks.',
        subtasks: [
          { id: 'as-3', text: 'Setup pre-commit scanner hooks', done: false, source: 'agent' as const },
        ]
      }
    ];

    const pick = mockSuggestions[Math.floor(Math.random() * mockSuggestions.length)];
    const generated: KanbanTask = {
      id: `task-${Date.now()}`,
      title: pick.title,
      description: pick.description,
      column: 'backlog',
      source: 'agent_suggested',
      agentReasoning: pick.reasoning,
      isApprovedByHuman: false,
      subtasks: pick.subtasks,
    };

    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generated),
      });
    } catch (err) {
      console.error("Error pushing agent-suggested task to server", err);
    }
  };

  const handleApproveAgentTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    await updateTask(taskId, {
      isApprovedByHuman: true,
      title: task.title.replace('[Agent Proposal] ', '')
    });
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedSubtasks = task.subtasks.map(s => {
      if (s.id === subtaskId) {
        return { ...s, done: !s.done };
      }
      return s;
    });
    await updateTask(taskId, { subtasks: updatedSubtasks });
  };

  const changeColumn = async (taskId: string, newCol: KanbanTask['column']) => {
    await updateTask(taskId, { column: newCol });
  };

  const handleDeleteTaskLocal = async (taskId: string) => {
    await deleteTask(taskId);
  };

  const columns: { id: KanbanTask['column']; title: string; color: string }[] = [
    { id: 'backlog', title: 'Sandboxed Backlog', color: 'border-neutral-850 bg-neutral-900/10' },
    { id: 'todo', title: 'To Do', color: 'border-neutral-850 bg-neutral-900/10' },
    { id: 'in_progress', title: 'Active Coding', color: 'border-neutral-850 bg-neutral-900/10' },
    { id: 'review', title: 'Code Review', color: 'border-neutral-850 bg-neutral-900/10' },
    { id: 'done', title: 'Released Done', color: 'border-emerald-950 bg-emerald-950/5' },
  ];

  return (
    <div id="task-tracker-container" className="space-y-6 select-none">
      
      {/* Top action bars */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-sys-panel p-4 border border-sys-border rounded-2xl">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider font-display">
            Multi-Author Project Kanban
          </h2>
          <p className="text-xs text-neutral-400 font-sans">
            Tracks current tasks. Agent generated tasks are bounded by dotted lines and require human approval.
          </p>
        </div>

        <div className="flex gap-2">
          {/* Quick AI Task Generator button */}
          <button
            onClick={handleRequestAgentTask}
            className="px-3.5 py-2 bg-bg-dark hover:bg-bg-dark/80 border border-agent/30 hover:border-agent/60 text-xs text-agent font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-agent/5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-agent" />
            Request AI Suggestions
          </button>
        </div>
      </div>

      {/* Grid of Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 overflow-x-auto pb-4 scrollbar-none">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.column === col.id);
          return (
            <div 
              key={col.id} 
              className={`p-3 border rounded-2xl flex flex-col gap-3 min-h-[500px] min-w-[240px] ${col.color}`}
            >
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-neutral-300 font-display">
                  {col.title}
                </span>
                <span className="text-[10px] font-mono bg-bg-dark border border-sys-border text-neutral-400 px-1.5 py-0.5 rounded-lg">
                  {colTasks.length}
                </span>
              </div>

              {/* Task list container */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px] pr-0.5 custom-scrollbar">
                {colTasks.map(task => {
                  const assignee = getAssignee(task.assigneeId);
                  const isAgentSuggested = task.source === 'agent_suggested';
                  const isApproved = task.isApprovedByHuman;

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-2xl transition-all relative group flex flex-col justify-between gap-3 ${
                        isAgentSuggested
                          ? 'bg-sys-panel bg-agent/[0.04] border-y border-r border-sys-border border-l-4 border-l-agent pl-3 shadow-sm shadow-agent/5'
                          : 'bg-sys-panel border border-sys-border hover:border-sys-border-hover'
                      }`}
                    >
                      {/* Source badge label */}
                      <div className="flex items-center justify-between">
                        {isAgentSuggested ? (
                          <span className="text-[9px] bg-agent/10 text-agent font-bold px-1.5 py-0.5 rounded-lg border border-agent/20 flex items-center gap-1 uppercase tracking-wider">
                            <Sparkles className="w-2.5 h-2.5" />
                            AGENT {isApproved ? 'APPROVED' : 'PROPOSAL'}
                          </span>
                        ) : (
                          <span className="text-[9px] bg-bg-dark text-neutral-400 font-semibold px-1.5 py-0.5 rounded-lg border border-sys-border uppercase tracking-wider">
                            HUMAN ZONE
                          </span>
                        )}

                        {/* Drag dummy / quick move menu */}
                        <div className="flex gap-1">
                          <select
                            value={task.column}
                            onChange={(e) => changeColumn(task.id, e.target.value as KanbanTask['column'])}
                            className="bg-bg-dark text-[10px] text-neutral-400 font-mono border border-sys-border rounded-lg p-0.5 focus:outline-none focus:border-sys-border-hover cursor-pointer"
                          >
                            <option value="backlog">Backlog</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">Coding</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </select>
                          <button
                            onClick={() => handleDeleteTaskLocal(task.id)}
                            className="text-neutral-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Header copy */}
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">
                          {task.title}
                        </h4>
                        <p className="text-[11px] text-neutral-400 leading-normal font-sans">
                          {task.description}
                        </p>
                      </div>

                      {/* AI Agent Reasoning Text Panel */}
                      {isAgentSuggested && !isApproved && task.agentReasoning && (
                        <div className="p-2 bg-bg-dark/80 border border-agent/10 text-[10px] text-agent leading-normal rounded-lg italic">
                          💡 {task.agentReasoning}
                        </div>
                      )}

                      {/* Subtasks checklists */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider block">
                            Subtasks checklist
                          </span>
                          <div className="space-y-1">
                            {task.subtasks.map(sub => (
                              <button
                                key={sub.id}
                                onClick={() => toggleSubtask(task.id, sub.id)}
                                className="w-full flex items-start gap-2 text-left text-[11px] text-neutral-400 hover:text-white transition-colors group/sub cursor-pointer bg-transparent border-none p-0"
                              >
                                <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  sub.done 
                                    ? 'bg-human border-human text-white' 
                                    : 'border-sys-border bg-bg-dark group-hover/sub:border-neutral-500'
                                }`}>
                                  {sub.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className={sub.done ? 'line-through text-neutral-500 font-medium' : 'font-medium'}>
                                  {sub.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Approvals/Assignee row */}
                      <div className="pt-2 border-t border-sys-border flex items-center justify-between">
                        {isAgentSuggested && !isApproved ? (
                          <button
                            onClick={() => handleApproveAgentTask(task.id)}
                            className="w-full py-1 bg-human hover:bg-human/90 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Zap className="w-3 h-3" />
                            Approve as Task
                          </button>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              {assignee ? (
                                <>
                                  <div className={`w-5 h-5 rounded-full ${assignee.avatarColor} text-neutral-950 font-bold text-[9px] flex items-center justify-center`}>
                                    {assignee.name.substring(0,2).toUpperCase()}
                                  </div>
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    {assignee.name}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] text-neutral-500 font-mono italic flex items-center gap-1">
                                  <User className="w-3 h-3" /> Unassigned
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-mono text-neutral-600">
                              ID: {task.id}
                            </span>
                          </>
                        )}
                      </div>

                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="p-8 border border-dashed border-sys-border rounded-2xl text-center text-[10px] text-neutral-600 font-mono">
                    Empty Column
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual human task creator form - HUMAN ZONE SIGNATURE */}
      <div className="p-5 bg-sys-panel border border-sys-border rounded-2xl max-w-xl relative overflow-hidden">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-human rounded-r-md" />
        <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider mb-3 font-display">
          Create New Project Task
        </h3>
        <form onSubmit={handleCreateTaskLocal} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task Title (e.g., Audit firestore rule validation)"
              className="w-full px-3 py-2 bg-bg-dark border border-sys-border rounded-lg text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-human focus:border-human"
            />
            <select
              value={newTaskCol}
              onChange={(e) => setNewTaskCol(e.target.value as any)}
              className="w-full px-3 py-2 bg-bg-dark border border-sys-border rounded-lg text-xs text-neutral-400 focus:outline-none focus:ring-1 focus:ring-human focus:border-human cursor-pointer"
            >
              <option value="backlog">Target: Backlog</option>
              <option value="todo">Target: To Do</option>
              <option value="in_progress">Target: Coding</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Optional short descriptive copy..."
              className="flex-1 px-3 py-2 bg-bg-dark border border-sys-border rounded-lg text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-human focus:border-human"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-human hover:bg-human/90 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
