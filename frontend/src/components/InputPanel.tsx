import React, { useState } from 'react';
import { Play, Sparkles, Terminal } from 'lucide-react';

interface InputPanelProps {
  onRun: (taskDescription: string) => void;
  isLoading: boolean;
}

const TEMPLATES = [
  {
    label: '🛒 E-Commerce App',
    text: 'Build a full-stack e-commerce store with Stripe integration, product catalog, user authentication, and a shopping cart with persistent local storage.',
  },
  {
    label: '🎮 Multiplayer Chess',
    text: 'Develop a real-time multiplayer chess game utilizing WebSockets for moves and match pairing, coupled with a standard leaderboard and Elo tracking.',
  },
  {
    label: '🩺 Medical Booking',
    text: 'Create a medical appointment booking system with automated email alerts, calendar synchronization, and roles for patients, doctors, and staff.',
  },
];

export const InputPanel: React.FC<InputPanelProps> = ({ onRun, isLoading }) => {
  const [task, setTask] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim() || isLoading) return;
    onRun(task);
  };

  const handleTemplateClick = (text: string) => {
    if (isLoading) return;
    setTask(text);
  };

  return (
    <div id="input-panel-container" className="bg-sys-panel border border-sys-border rounded-2xl p-5 shadow-2xl relative overflow-hidden select-none">
      {/* Absolute background accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-human/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center gap-2 mb-4 border-b border-sys-border pb-3">
        <Terminal className="w-5 h-5 text-human" />
        <h2 className="text-sm font-bold text-neutral-100 tracking-wider uppercase font-display">
          Task Description
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="task-textarea" className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">
            Define your project or system specifications
          </label>
          <textarea
            id="task-textarea"
            className="w-full h-32 bg-bg-dark text-neutral-200 border border-sys-border rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-human focus:border-human placeholder-neutral-600 transition-all font-sans resize-none"
            placeholder="Describe what you want to build (e.g., 'A personal CRM dashboard with contact management and automated follow-up emails'...)"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* Templates */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-agent" />
            Quick Templates
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                id={`template-${idx}`}
                type="button"
                onClick={() => handleTemplateClick(tmpl.text)}
                disabled={isLoading}
                className="text-left text-xs bg-bg-dark/60 hover:bg-bg-dark border border-sys-border text-neutral-300 hover:text-white py-2 px-3 rounded-lg transition-all line-clamp-1 truncate duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Run Button */}
        <button
          id="run-agents-btn"
          type="submit"
          disabled={isLoading || !task.trim()}
          className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold tracking-wide uppercase text-sm transition-all duration-300 ${
            isLoading || !task.trim()
              ? 'bg-sys-panel/60 text-neutral-500 border border-sys-border cursor-not-allowed'
              : 'bg-human hover:bg-human/90 text-white shadow-lg shadow-human/10 cursor-pointer active:scale-[0.99]'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Orchestrating Agents...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Agents</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
