import React, { useState } from 'react';
import {
  ListChecks,
  TrendingUp,
  AlertTriangle,
  Layers,
  Clock,
  DollarSign,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Loader2,
  Terminal,
  Activity,
  Award,
  Sparkles
} from 'lucide-react';
import { Subtask, EstimatorOutput, RiskFlaggerOutput, AgentStatus, AgentState } from '../types';

interface ResultsPanelProps {
  planner: AgentState;
  estimator: AgentState;
  riskFlagger: AgentState;
  plannerStatus: AgentStatus;
  estimatorStatus: AgentStatus;
  riskFlaggerStatus: AgentStatus;
  plannerOutput: Subtask[] | null;
  estimatorOutput: EstimatorOutput[] | EstimatorOutput | null;
  riskFlaggerOutput: RiskFlaggerOutput | null;
  isRunActive: boolean;
  error: string | null;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  planner,
  estimator,
  riskFlagger,
  plannerStatus,
  estimatorStatus,
  riskFlaggerStatus,
  plannerOutput,
  estimatorOutput,
  riskFlaggerOutput,
  isRunActive,
  error,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    planner: true,
    estimator: true,
    risk: true,
  });

  const toggleExpand = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getSeverityStyle = (severity: 'Low' | 'Medium' | 'High' | 'Critical') => {
    switch (severity) {
      case 'Critical':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'High':
        return 'bg-agent/10 text-agent border border-agent/20';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Low':
      default:
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  // Helper for Category badge styling
  const getCategoryStyle = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('front') || cat.includes('ui') || cat.includes('ux')) {
      return 'bg-human/10 text-human border border-human/20';
    } else if (cat.includes('back') || cat.includes('api') || cat.includes('server')) {
      return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
    } else if (cat.includes('data') || cat.includes('db') || cat.includes('sql')) {
      return 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
    } else if (cat.includes('test') || cat.includes('qa') || cat.includes('spec')) {
      return 'bg-agent/10 text-agent border border-agent/20';
    }
    return 'bg-bg-dark text-neutral-400 border border-sys-border';
  };

  const isCompleted = plannerOutput && estimatorOutput && riskFlaggerOutput;

  // Render empty state
  if (!isRunActive && !isCompleted && !error) {
    return (
      <div id="results-empty-state" className="bg-sys-panel border border-sys-border rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center text-center min-h-[580px] select-none">
        <div className="w-16 h-16 rounded-full bg-bg-dark flex items-center justify-center border border-sys-border mb-4 animate-pulse">
          <Layers className="w-8 h-8 text-neutral-600 animate-spin-slow" />
        </div>
        <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-widest font-display">Awaiting Agent Orchestration</h3>
        <p className="text-xs text-neutral-400 max-w-sm mt-2 leading-relaxed">
          Submit your design parameters or type commands on the left. The live multi-agent pipeline will execute and stream insights here.
        </p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div id="results-error-state" className="bg-sys-panel border border-rose-950 rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center text-center min-h-[580px] select-none">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-400" />
        </div>
        <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider font-display">Orchestration Error</h3>
        <p className="text-xs text-rose-500 max-w-md mt-2 font-mono whitespace-pre-wrap bg-bg-dark/80 p-4 rounded-lg border border-rose-950/40">
          {error}
        </p>
      </div>
    );
  }

  // Cast estimatorOutput safely
  const resolvedEstimator: EstimatorOutput | null = estimatorOutput
    ? (Array.isArray(estimatorOutput) ? estimatorOutput[0] : estimatorOutput) as EstimatorOutput
    : null;

  return (
    <div id="results-panel-container" className="space-y-6 select-none">
      
      {/* Reasoning Chain Title Header */}
      <div className="bg-sys-panel p-4 border border-sys-border rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-human/10 text-human border border-human/25 rounded-lg">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-display flex items-center gap-1.5">
              Live Orchestration Reasoning Chain
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono font-bold uppercase animate-pulse">Real-Time Sync</span>
            </h3>
            <p className="text-[10px] text-neutral-500 font-sans mt-0.5">
              Authentic pipeline steps with active background telemetry logs and output.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunActive && (
            <span className="flex items-center gap-1 text-[10px] text-agent font-mono font-semibold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              RUNNING_STREAM
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-semibold">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              VERIFIED_SEALED
            </span>
          )}
        </div>
      </div>

      {/* Bento Cards Container */}
      <div className="space-y-4">
        
        {/* CARD 1: PLANNER AGENT */}
        <div className="bg-sys-panel bg-agent/[0.04] border border-sys-border border-l-4 border-l-agent rounded-2xl overflow-hidden shadow-xl relative pl-1">
          <button
            onClick={() => toggleExpand('planner')}
            className="w-full px-5 py-4 bg-transparent flex items-center justify-between text-left cursor-pointer hover:bg-sys-panel/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${
                plannerStatus === 'thinking' ? 'bg-agent/10 text-agent border-agent/20 animate-pulse' :
                plannerStatus === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                'bg-bg-dark text-neutral-500 border-sys-border'
              }`}>
                <ListChecks className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider font-display flex items-center gap-2">
                  Step 1: Planner Agent
                  <span className="text-[8px] bg-agent/10 text-agent font-mono font-bold px-1.5 py-0.5 rounded-lg border border-agent/20 uppercase tracking-widest flex items-center gap-1 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" /> Agent
                  </span>
                </span>
                <p className="text-[10px] text-neutral-500 mt-0.5 font-sans">
                  Deconstructs inputs into actionable development task cards.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className={`px-2 py-0.5 rounded-lg font-bold uppercase ${
                plannerStatus === 'thinking' ? 'text-agent bg-agent/10' :
                plannerStatus === 'done' ? 'text-emerald-400 bg-emerald-500/10' :
                'text-neutral-600 bg-bg-dark'
              }`}>
                {plannerStatus === 'thinking' ? 'thinking' : plannerStatus === 'done' ? 'completed' : 'standby'}
              </span>
              {expanded.planner ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
            </div>
          </button>

          {expanded.planner && (
            <div className="p-5 pt-1 space-y-4 animate-fadeIn">
              {/* Agent Logs */}
              <div className="bg-bg-dark/80 border border-sys-border rounded-lg p-3.5 space-y-2">
                <span className="text-[9px] font-mono font-bold text-human uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-human" /> Background Telemetry Trace
                </span>
                <div className="font-mono text-[10px] text-neutral-400 space-y-1.5 max-h-24 overflow-y-auto">
                  {planner.logs && planner.logs.length > 0 ? (
                    planner.logs.map((log, idx) => (
                      <p key={idx} className="leading-relaxed">
                        <span className="text-neutral-600">[{new Date().toLocaleTimeString()}]</span> {log}
                      </p>
                    ))
                  ) : (
                    <p className="text-neutral-600 italic">No telemetry generated yet.</p>
                  )}
                </div>
              </div>

              {/* Outputs */}
              {plannerOutput ? (
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Structured Output (Blueprints)</span>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {plannerOutput.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 bg-bg-dark border border-sys-border rounded-lg space-y-2 hover:border-sys-border transition-all group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white transition-all leading-normal">
                            {task.title}
                          </h4>
                          <span className={`text-[9px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded-lg border shrink-0 ${getCategoryStyle(task.category)}`}>
                            {task.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                          {task.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-600 italic">Awaiting Planner step completion...</p>
              )}
            </div>
          )}
        </div>

        {/* CARD 2: ESTIMATOR AGENT */}
        <div className="bg-sys-panel bg-agent/[0.04] border border-sys-border border-l-4 border-l-agent rounded-2xl overflow-hidden shadow-xl relative pl-1">
          <button
            onClick={() => toggleExpand('estimator')}
            className="w-full px-5 py-4 bg-transparent flex items-center justify-between text-left cursor-pointer hover:bg-sys-panel/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${
                estimatorStatus === 'thinking' ? 'bg-agent/10 text-agent border-agent/20 animate-pulse' :
                estimatorStatus === 'done' ? 'bg-human/10 text-human border-human/15' :
                'bg-bg-dark text-neutral-500 border-sys-border'
              }`}>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider font-display flex items-center gap-2">
                  Step 2: Estimator Agent
                  <span className="text-[8px] bg-agent/10 text-agent font-mono font-bold px-1.5 py-0.5 rounded-lg border border-agent/20 uppercase tracking-widest flex items-center gap-1 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" /> Agent
                  </span>
                </span>
                <p className="text-[10px] text-neutral-500 mt-0.5 font-sans">
                  Forecasts development hours and labor cost envelopes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className={`px-2 py-0.5 rounded-lg font-bold uppercase ${
                estimatorStatus === 'thinking' ? 'text-agent bg-agent/10' :
                estimatorStatus === 'done' ? 'text-emerald-400 bg-emerald-500/10' :
                'text-neutral-600 bg-bg-dark'
              }`}>
                {estimatorStatus === 'thinking' ? 'thinking' : estimatorStatus === 'done' ? 'completed' : 'standby'}
              </span>
              {expanded.estimator ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
            </div>
          </button>

          {expanded.estimator && (
            <div className="p-5 pt-1 space-y-4 animate-fadeIn">
              {/* Agent Logs */}
              <div className="bg-bg-dark/80 border border-sys-border rounded-lg p-3.5 space-y-2">
                <span className="text-[9px] font-mono font-bold text-human uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-human" /> Background Telemetry Trace
                </span>
                <div className="font-mono text-[10px] text-neutral-400 space-y-1.5 max-h-24 overflow-y-auto">
                  {estimator.logs && estimator.logs.length > 0 ? (
                    estimator.logs.map((log, idx) => (
                      <p key={idx} className="leading-relaxed">
                        <span className="text-neutral-600">[{new Date().toLocaleTimeString()}]</span> {log}
                      </p>
                    ))
                  ) : (
                    <p className="text-neutral-600 italic">No telemetry generated yet.</p>
                  )}
                </div>
              </div>

              {/* Outputs */}
              {resolvedEstimator ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg-dark border border-sys-border p-4 rounded-lg text-center">
                      <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider block">Calculated Effort</span>
                      <span className="text-lg font-bold font-mono text-neutral-100 mt-1 block">{resolvedEstimator.totalHours} Hrs</span>
                    </div>
                    <div className="bg-bg-dark border border-sys-border p-4 rounded-lg text-center">
                      <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider block">Labor Envelope</span>
                      <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">${resolvedEstimator.totalCost?.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Labor Categories */}
                  {resolvedEstimator.breakdown && (
                    <div className="space-y-3 bg-bg-dark border border-sys-border rounded-lg p-4">
                      <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Estimated Category Breakdown</span>
                      <div className="space-y-3">
                        {resolvedEstimator.breakdown.map((item, idx) => {
                          const maxHours = Math.max(...resolvedEstimator.breakdown.map((b) => b.hours));
                          const percentage = maxHours > 0 ? (item.hours / maxHours) * 100 : 0;

                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-300 font-medium font-sans">{item.category}</span>
                                <span className="text-neutral-400 font-mono text-[10px] font-semibold">
                                  {item.hours} hrs <span className="text-neutral-700 font-normal">|</span> <span className="text-emerald-400 font-bold">${item.cost?.toLocaleString()}</span>
                                </span>
                              </div>
                              <div className="w-full bg-sys-panel rounded-full h-2 overflow-hidden border border-sys-border">
                                <div
                                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 italic">Awaiting Estimator step completion...</p>
              )}
            </div>
          )}
        </div>

        {/* CARD 3: RISK-FLAGGER AGENT */}
        <div className="bg-sys-panel bg-agent/[0.04] border border-sys-border border-l-4 border-l-agent rounded-2xl overflow-hidden shadow-xl relative pl-1">
          <button
            onClick={() => toggleExpand('risk')}
            className="w-full px-5 py-4 bg-transparent flex items-center justify-between text-left cursor-pointer hover:bg-sys-panel/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${
                riskFlaggerStatus === 'thinking' ? 'bg-agent/10 text-agent border-agent/20 animate-pulse' :
                riskFlaggerStatus === 'done' ? 'bg-rose-500/10 text-rose-400 border-rose-500/15' :
                'bg-bg-dark text-neutral-500 border-sys-border'
              }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider font-display flex items-center gap-2">
                  Step 3: Risk-Flagger Agent
                  <span className="text-[8px] bg-agent/10 text-agent font-mono font-bold px-1.5 py-0.5 rounded-lg border border-agent/20 uppercase tracking-widest flex items-center gap-1 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" /> Agent
                  </span>
                </span>
                <p className="text-[10px] text-neutral-500 mt-0.5 font-sans">
                  Audits logic architectures for safety, security, and mitigation paths.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className={`px-2 py-0.5 rounded-lg font-bold uppercase ${
                riskFlaggerStatus === 'thinking' ? 'text-agent bg-agent/10' :
                riskFlaggerStatus === 'done' ? 'text-emerald-400 bg-emerald-500/10' :
                'text-neutral-600 bg-bg-dark'
              }`}>
                {riskFlaggerStatus === 'thinking' ? 'thinking' : riskFlaggerStatus === 'done' ? 'completed' : 'standby'}
              </span>
              {expanded.risk ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
            </div>
          </button>

          {expanded.risk && (
            <div className="p-5 pt-1 space-y-4 animate-fadeIn">
              {/* Agent Logs */}
              <div className="bg-bg-dark/80 border border-sys-border rounded-lg p-3.5 space-y-2">
                <span className="text-[9px] font-mono font-bold text-human uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-human" /> Background Telemetry Trace
                </span>
                <div className="font-mono text-[10px] text-neutral-400 space-y-1.5 max-h-24 overflow-y-auto">
                  {riskFlagger.logs && riskFlagger.logs.length > 0 ? (
                    riskFlagger.logs.map((log, idx) => (
                      <p key={idx} className="leading-relaxed">
                        <span className="text-neutral-600">[{new Date().toLocaleTimeString()}]</span> {log}
                      </p>
                    ))
                  ) : (
                    <p className="text-neutral-600 italic">No telemetry generated yet.</p>
                  )}
                </div>
              </div>

              {/* Outputs */}
              {riskFlaggerOutput ? (
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Structured Output (Threat Diagnostics)</span>
                  <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                    {riskFlaggerOutput.risks.map((risk) => (
                      <div
                        key={risk.id}
                        className="p-4 bg-bg-dark border border-sys-border rounded-lg space-y-3 hover:border-sys-border transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-xs font-bold text-neutral-200 leading-normal">
                            {risk.risk}
                          </span>
                          <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded-lg ${getSeverityStyle(risk.severity)}`}>
                            {risk.severity}
                          </span>
                        </div>
                        
                        {/* Mitigation directive */}
                        <div className="bg-bg-dark border border-sys-border/60 rounded-lg p-3 text-xs leading-normal font-sans">
                          <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                            MITIGATION DIRECTIVE
                          </span>
                          <p className="text-neutral-400">
                            {risk.mitigation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-600 italic">Awaiting Risk-Flagger step completion...</p>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
