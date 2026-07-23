import React, { useEffect, useRef } from 'react';
import { Calendar, DollarSign, ShieldAlert, Cpu, CheckCircle, HelpCircle, Loader2, AlertCircle } from 'lucide-react';
import { AgentState, AgentStatus } from '../types';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface AgentStatusPanelProps {
  planner: AgentState;
  estimator: AgentState;
  riskFlagger: AgentState;
}

const AGENT_CONFIGS = {
  planner: {
    name: 'Planner Agent',
    role: 'Deconstructs goals into structured subtasks & technical modules.',
    icon: Calendar,
    color: 'emerald',
    ringColor: 'ring-emerald-500/20',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
  },
  estimator: {
    name: 'Estimator Agent',
    role: 'Projects implementation timelines, hourly efforts, and resource costs.',
    icon: DollarSign,
    color: 'cyan',
    ringColor: 'ring-cyan-500/20',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
  },
  riskFlagger: {
    name: 'Risk-Flagger Agent',
    role: 'Identifies systemic risks, compliance hurdles, and builds mitigations.',
    icon: ShieldAlert,
    color: 'rose',
    ringColor: 'ring-rose-500/20',
    bgColor: 'bg-rose-500/10',
    textColor: 'text-rose-400',
  },
};

export const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({ planner, estimator, riskFlagger }) => {
  const plannerLogEndRef = useRef<HTMLDivElement>(null);
  const estimatorLogEndRef = useRef<HTMLDivElement>(null);
  const riskFlaggerLogEndRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    plannerLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planner.logs]);

  useEffect(() => {
    estimatorLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [estimator.logs]);

  useEffect(() => {
    riskFlaggerLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [riskFlagger.logs]);

  const renderStatusPill = (status: AgentStatus) => {
    const variants = {
      initial: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.92 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.92 },
    };

    return (
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
          className="inline-flex"
        >
          {status === 'idle' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium font-mono bg-bg-dark text-neutral-400 border border-sys-border">
              <HelpCircle className="w-3.5 h-3.5" />
              IDLE
            </span>
          )}
          {status === 'thinking' && (
            <motion.span
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      backgroundColor: ['rgba(245, 158, 11, 0.05)', 'rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)'],
                      borderColor: ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.35)', 'rgba(245, 158, 11, 0.15)'],
                    }
              }
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium font-mono bg-agent/10 text-agent border border-agent/20"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              THINKING
            </motion.span>
          )}
          {status === 'done' && (
            <motion.span
              initial={shouldReduceMotion ? {} : { scale: 0.9 }}
              animate={shouldReduceMotion ? {} : { scale: [0.9, 1.05, 1] }}
              transition={{ type: 'spring', stiffness: 250, damping: 15 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              DONE
            </motion.span>
          )}
          {status === 'error' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5" />
              FAILED
            </span>
          )}
        </motion.span>
      </AnimatePresence>
    );
  };

  const renderAgentRow = (key: 'planner' | 'estimator' | 'riskFlagger', state: AgentState, logEndRef: React.RefObject<HTMLDivElement | null>) => {
    const config = AGENT_CONFIGS[key];
    const Icon = config.icon;
    const isThinking = state.status === 'thinking';
    const isDone = state.status === 'done';

    return (
      <motion.div
        id={`agent-row-${key}`}
        key={key}
        layout={!shouldReduceMotion}
        animate={{
          borderColor: isThinking
            ? 'rgba(245, 158, 11, 0.35)'
            : isDone
            ? 'rgba(16, 185, 129, 0.25)'
            : 'rgba(31, 34, 47, 0.7)',
          backgroundColor: isThinking
            ? 'rgba(245, 158, 11, 0.02)'
            : isDone
            ? 'rgba(16, 185, 129, 0.02)'
            : 'rgba(13, 14, 18, 0.4)',
          scale: isDone && !shouldReduceMotion ? [1, 1.008, 1] : 1,
        }}
        transition={{
          duration: 0.35,
          scale: { type: 'spring', stiffness: 300, damping: 20 }
        }}
        className="border border-sys-border rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start"
      >
        {/* Left Side: Avatar, Metadata, Status */}
        <div className="flex-1 min-w-[200px] space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${config.bgColor} ${config.textColor} ring-1 ${config.ringColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-200 tracking-wide font-display uppercase">{config.name}</h3>
              <p className="text-[11px] text-neutral-500 leading-tight mt-0.5 font-sans">{config.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {renderStatusPill(state.status)}
            <span className="text-xs font-mono text-neutral-500">{state.progress}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-bg-dark rounded-full h-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                state.status === 'error'
                  ? 'bg-rose-500'
                  : state.status === 'done'
                  ? 'bg-emerald-500'
                  : key === 'planner'
                  ? 'bg-emerald-400'
                  : key === 'estimator'
                  ? 'bg-cyan-400'
                  : 'bg-rose-400'
              }`}
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>

        {/* Right Side: scrolling log console */}
        <div className="flex-1 w-full self-stretch bg-bg-dark/90 border border-sys-border rounded-lg p-3 flex flex-col justify-between font-mono text-[11px] leading-relaxed select-text min-h-[90px] max-h-[140px] overflow-hidden">
          <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar">
            {state.logs.length === 0 ? (
              <span className="text-neutral-700 italic">Console output is currently offline. Waiting for stream...</span>
            ) : (
              state.logs.map((log, index) => (
                <div key={index} className="flex gap-2 items-start text-neutral-400">
                  <span className={`select-none ${config.textColor}`}>&gt;</span>
                  <span className="whitespace-pre-line">{log}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
          {state.status === 'thinking' && (
            <div className="mt-2 text-[10px] text-agent/80 animate-pulse flex items-center gap-1 justify-end font-mono">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-agent animate-ping" />
              STREAM_BUFFER_ACTIVE
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div id="agent-status-container" className="bg-sys-panel border border-sys-border rounded-2xl p-5 shadow-2xl relative select-none">
      <div className="flex items-center gap-2 mb-4 border-b border-sys-border pb-3">
        <Cpu className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-bold text-neutral-100 tracking-wider uppercase font-display">
          Live Agent Orchestrator
        </h2>
      </div>

      <div className="space-y-4">
        {renderAgentRow('planner', planner, plannerLogEndRef)}
        {renderAgentRow('estimator', estimator, estimatorLogEndRef)}
        {renderAgentRow('riskFlagger', riskFlagger, riskFlaggerLogEndRef)}
      </div>
    </div>
  );
};
