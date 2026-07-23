import React, { useState } from 'react';
import { TeamMember, AgentState, AgentStatus } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Users, 
  Sparkles, 
  Cpu, 
  Terminal, 
  Activity, 
  ShieldCheck, 
  Coins, 
  BrainCircuit,
  Menu,
  X
} from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';

interface WorkspaceSidebarProps {
  teamMembers: TeamMember[];
  planner: AgentState;
  estimator: AgentState;
  riskFlagger: AgentState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  authenticatedUserEmail: string | null;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  teamMembers: propTeamMembers,
  planner: propPlanner,
  estimator: propEstimator,
  riskFlagger: propRiskFlagger,
  activeTab: propActiveTab,
  setActiveTab: propActiveTabFn,
  authenticatedUserEmail,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  let context: any = null;
  try {
    context = useWorkspace();
  } catch (e) {
    // fallback
  }

  const shouldReduceMotion = useReducedMotion();

  const activeTab = context ? context.activeTab : propActiveTab;
  const setActiveTab = context ? context.setActiveTab : propActiveTabFn;
  const teamMembers = context ? context.teamMembers : propTeamMembers;

  const planner = context && (context.planner.status === 'thinking' || context.isAgentResponding) ? context.planner : propPlanner;
  const estimator = context && (context.estimator.status === 'thinking' || context.isAgentResponding) ? context.estimator : propEstimator;
  const riskFlagger = context && (context.riskFlagger.status === 'thinking' || context.isAgentResponding) ? context.riskFlagger : propRiskFlagger;

  const tabs = [
    { id: 'coding', label: 'Co-Coding Lab', icon: Terminal, desc: 'Multiplayer Live Editor' },
    { id: 'kanban', label: 'Plan & Kanban', icon: Users, desc: 'Hybrid Task Workflows' },
    { id: 'budget', label: 'Decision Matrix', icon: Coins, desc: 'Agent Projections' },
    { id: 'orchestrator', label: 'Agent Pipeline', icon: Cpu, desc: 'Realtime WebSocket Logs' },
  ];

  const getStatusColor = (status: 'active' | 'idle' | 'offline') => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'idle': return 'bg-amber-500';
      case 'offline': return 'bg-neutral-600';
    }
  };

  const getAgentBadge = (status: AgentStatus) => {
    switch (status) {
      case 'thinking':
        return (
          <span className="text-[10px] bg-amber-500/10 text-[#F5A623] border border-[#F5A623]/20 px-2 py-0.5 rounded-full font-semibold font-mono animate-pulse">
            THINKING
          </span>
        );
      case 'done':
        return (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold font-mono">
            IDLE / DONE
          </span>
        );
      case 'error':
        return (
          <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-semibold font-mono">
            CRITICAL_ERR
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700/50 px-2 py-0.5 rounded-full font-semibold font-mono">
            STANDBY
          </span>
        );
    }
  };

  // Render the full width content inside the sidebar/drawer
  const renderFullSidebarContent = (isDrawer = false) => {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Tab Navigation Menu */}
        <div className="p-4 border-b border-sys-border space-y-1">
          <span className="text-[10px] text-neutral-500 font-mono font-bold uppercase tracking-widest block px-2 mb-2">
            Workspace Hub
          </span>
          <div className="flex flex-col gap-1 w-full">
            {tabs.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (isDrawer) setDrawerOpen(false);
                  }}
                  className={`text-left px-3 py-2.5 rounded-2xl transition-all flex items-start gap-3 group relative cursor-pointer ${
                    isActive 
                      ? 'bg-human/10 text-white border border-human/20 shadow-lg shadow-human/5' 
                      : 'text-neutral-400 hover:text-white hover:bg-bg-dark/40 border border-transparent'
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-colors shrink-0 ${
                    isActive ? 'bg-human text-white' : 'bg-bg-dark text-neutral-400 group-hover:text-white group-hover:bg-sys-border'
                  }`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold font-display block">
                      {tab.label}
                    </span>
                    <span className="text-[9px] text-neutral-500 leading-tight block">
                      {tab.desc}
                    </span>
                  </div>
                  {isActive && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-human rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Human presence panel */}
        <div className="p-4 border-b border-sys-border flex-1 overflow-y-auto space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] text-neutral-500 font-mono font-bold uppercase tracking-widest">
                Human Team
              </span>
              <span className="text-[10px] font-mono bg-bg-dark px-1.5 py-0.5 rounded-lg text-neutral-400">
                {teamMembers.filter(m => m.status !== 'offline').length} / {teamMembers.length}
              </span>
            </div>

            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-bg-dark/40 transition-colors group border border-transparent hover:border-sys-border"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <div className={`w-8 h-8 rounded-full ${member.avatarColor} text-neutral-950 font-bold text-xs flex items-center justify-center font-display`}>
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                        {member.status !== 'offline' && !shouldReduceMotion && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${getStatusColor(member.status)} opacity-75`} />
                        )}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${getStatusColor(member.status)} border-2 border-sys-panel`} />
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-200 block group-hover:text-white transition-colors">
                        {member.name}
                      </span>
                      <span className="text-[10px] text-neutral-500 block">
                        {member.role}
                      </span>
                    </div>
                  </div>
                  {member.cursorPosition && (
                    <span className="text-[9px] font-mono text-neutral-400 bg-bg-dark px-1.5 py-0.5 rounded-lg border border-sys-border">
                      {member.cursorPosition}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Agents panel */}
        <div className="p-4 bg-sys-panel space-y-3 border-t border-sys-border shrink-0">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] text-agent font-mono font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-spin-slow text-agent" />
              <span>AI Workers</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Planner Agent */}
            <motion.div
              layout={!shouldReduceMotion}
              animate={{
                borderColor: planner.status === 'thinking' ? '#F5A623' : 'rgba(31, 34, 47, 0.5)',
                backgroundColor: planner.status === 'thinking' ? 'rgba(245, 166, 35, 0.05)' : 'rgba(13, 14, 18, 0.4)',
              }}
              transition={{ duration: 0.3 }}
              className="p-3 border border-dashed rounded-2xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors duration-350 ${
                planner.status === 'thinking' ? 'bg-agent/20 text-agent' : 'bg-bg-dark text-neutral-400'
              }`}>
                <BrainCircuit className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-neutral-200">Planner</span>
                  {getAgentBadge(planner.status)}
                </div>
                <p className="text-[10px] text-neutral-500 leading-normal">
                  {planner.status === 'thinking' ? 'Decomposing goals...' : 'Hierarchical decomposition.'}
                </p>
                {planner.status === 'thinking' && (
                  <div className="w-full bg-bg-dark rounded-full h-1 overflow-hidden mt-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${planner.progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="bg-agent h-full"
                    />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Estimator Agent */}
            <motion.div
              layout={!shouldReduceMotion}
              animate={{
                borderColor: estimator.status === 'thinking' ? '#F5A623' : 'rgba(31, 34, 47, 0.5)',
                backgroundColor: estimator.status === 'thinking' ? 'rgba(245, 166, 35, 0.05)' : 'rgba(13, 14, 18, 0.4)',
              }}
              transition={{ duration: 0.3 }}
              className="p-3 border border-dashed rounded-2xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors duration-350 ${
                estimator.status === 'thinking' ? 'bg-agent/20 text-agent' : 'bg-bg-dark text-neutral-400'
              }`}>
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-neutral-200">Estimator</span>
                  {getAgentBadge(estimator.status)}
                </div>
                <p className="text-[10px] text-neutral-500 leading-normal">
                  {estimator.status === 'thinking' ? 'Projecting rates...' : 'Labor cost projections.'}
                </p>
                {estimator.status === 'thinking' && (
                  <div className="w-full bg-bg-dark rounded-full h-1 overflow-hidden mt-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${estimator.progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="bg-agent h-full"
                    />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Risk-Flagger Agent */}
            <motion.div
              layout={!shouldReduceMotion}
              animate={{
                borderColor: riskFlagger.status === 'thinking' ? '#F5A623' : 'rgba(31, 34, 47, 0.5)',
                backgroundColor: riskFlagger.status === 'thinking' ? 'rgba(245, 166, 35, 0.05)' : 'rgba(13, 14, 18, 0.4)',
              }}
              transition={{ duration: 0.3 }}
              className="p-3 border border-dashed rounded-2xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors duration-350 ${
                riskFlagger.status === 'thinking' ? 'bg-agent/20 text-agent' : 'bg-bg-dark text-neutral-400'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-neutral-200">Risk-Flagger</span>
                  {getAgentBadge(riskFlagger.status)}
                </div>
                <p className="text-[10px] text-neutral-500 leading-normal">
                  {riskFlagger.status === 'thinking' ? 'Auditing safety...' : 'System risk audits.'}
                </p>
                {riskFlagger.status === 'thinking' && (
                  <div className="w-full bg-bg-dark rounded-full h-1 overflow-hidden mt-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${riskFlagger.progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="bg-agent h-full"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Sidebar Shell: w-16 (icon rail) below lg (1024px), w-72 (full) on lg and above */}
      <div 
        id="workspace-sidebar" 
        className="w-16 lg:w-72 bg-sys-panel border-r border-sys-border flex flex-col h-full shrink-0 transition-all duration-300 select-none"
      >
        {/* DESKTOP (lg and above): full sidebar content */}
        <div className="hidden lg:block h-full">
          {renderFullSidebarContent(false)}
        </div>

        {/* TABLET & MOBILE (< lg / 1024px): Icon-only vertical rail */}
        <div className="flex lg:hidden flex-col h-full items-center py-4 justify-between">
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Drawer Toggle Menu Button */}
            <button 
              onClick={() => setDrawerOpen(true)}
              className="p-2.5 rounded-lg bg-bg-dark text-neutral-400 hover:text-white hover:bg-sys-border border border-sys-border transition-colors cursor-pointer"
              title="Open full workspace drawer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="w-8 h-[1px] bg-sys-border" />

            {/* Vertical Tab Icons */}
            <div className="flex flex-col gap-2 w-full px-2">
              {tabs.map((tab) => {
                const IconComp = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`p-2.5 rounded-lg transition-all flex items-center justify-center group relative cursor-pointer ${
                      isActive 
                        ? 'bg-human/10 text-white border border-human/20 shadow-md shadow-human/5' 
                        : 'text-neutral-400 hover:text-white hover:bg-bg-dark/40 border border-transparent'
                    }`}
                    title={tab.label}
                  >
                    <IconComp className="w-4 h-4" />
                    {isActive && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-human rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="w-8 h-[1px] bg-sys-border" />

            {/* Compact Human Team Avatar Badges */}
            <div className="flex flex-col gap-2">
              {teamMembers.slice(0, 4).map((member) => (
                <div key={member.id} className="relative group" title={`${member.name} (${member.role})`}>
                  <div className={`w-8 h-8 rounded-full ${member.avatarColor} text-neutral-950 font-bold text-[10px] flex items-center justify-center font-display border border-sys-border/40`}>
                    {member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor(member.status)}`} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Compact AI Workers Status Badges */}
          <div className="flex flex-col gap-3">
            <div className="w-8 h-[1px] bg-sys-border mx-auto" />
            <div 
              className={`p-2 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                planner.status === 'thinking' ? 'border-agent bg-agent/10 text-agent animate-pulse' : 'border-sys-border text-neutral-500 hover:text-neutral-300'
              }`}
              onClick={() => setDrawerOpen(true)}
              title={`Planner Status: ${planner.status.toUpperCase()}`}
            >
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div 
              className={`p-2 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                estimator.status === 'thinking' ? 'border-agent bg-agent/10 text-agent animate-pulse' : 'border-sys-border text-neutral-500 hover:text-neutral-300'
              }`}
              onClick={() => setDrawerOpen(true)}
              title={`Estimator Status: ${estimator.status.toUpperCase()}`}
            >
              <Activity className="w-4 h-4" />
            </div>
            <div 
              className={`p-2 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                riskFlagger.status === 'thinking' ? 'border-agent bg-agent/10 text-agent animate-pulse' : 'border-sys-border text-neutral-500 hover:text-neutral-300'
              }`}
              onClick={() => setDrawerOpen(true)}
              title={`Risk-Flagger Status: ${riskFlagger.status.toUpperCase()}`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Slide-Over Overlay Drawer (shown below lg when drawerOpen is true) */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Dark Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 z-45"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative z-50 w-72 bg-sys-panel border-r border-sys-border flex flex-col h-full shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-sys-border flex items-center justify-between bg-bg-dark/30 shrink-0">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-human" />
                  <span className="text-[11px] text-neutral-300 font-mono font-bold uppercase tracking-wider">Workspace Menu</span>
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)} 
                  className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-bg-dark/50 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Full Sidebar Content inside drawer */}
              <div className="flex-1 overflow-y-auto">
                {renderFullSidebarContent(true)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
