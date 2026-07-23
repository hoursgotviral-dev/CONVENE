import { useState } from 'react';
import { Cpu, RefreshCw, Key, LogOut, UserCheck, LogIn } from 'lucide-react';
import { InputPanel } from './components/InputPanel';
import { AgentStatusPanel } from './components/AgentStatusPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { AuthContainer } from './components/AuthContainer';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { CoCodingLab } from './components/CoCodingLab';
import { TaskTracker } from './components/TaskTracker';
import { BudgetDecision } from './components/BudgetDecision';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ApiKeyModal } from './components/ApiKeyModal';
import { LandingPage } from './components/LandingPage';
import { SamanvayMark } from './components/SamanvayMark';

function MainApp() {
  const {
    activeTab,
    setActiveTab,
    teamMembers,
    planner,
    estimator,
    riskFlagger,
    plannerOutput,
    estimatorOutput,
    riskFlaggerOutput,
    isRunActive,
    error,
    wsConnected,
    connecting,
    handleRunAgents,
    apiKeysStatus,
    conflictNotification,
    clearConflictNotification,
    authenticatedUserEmail,
    setAuthenticatedUserEmail,
    roomCode,
    setRoomCode,
    displayName,
    setDisplayName
  } = useWorkspace();

  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  if (!authenticatedUserEmail) {
    return <AuthContainer onSuccess={(email) => setAuthenticatedUserEmail(email)} />;
  }

  if (!roomCode || !displayName) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen bg-bg-dark bg-gradient-wash text-neutral-200 flex flex-col font-sans select-none antialiased">
      {/* Edit Conflict Notification Toast Banner */}
      {conflictNotification && (
        <div className="bg-agent text-bg-dark px-6 py-2.5 flex items-center justify-between text-xs font-semibold z-50 animate-fadeIn font-sans shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-bg-dark rounded-full animate-ping" />
            <span>{conflictNotification}</span>
          </div>
          <button
            onClick={clearConflictNotification}
            className="px-3 py-1 bg-bg-dark hover:bg-bg-dark/80 text-white font-bold text-[10px] uppercase rounded-lg transition-all border border-sys-border cursor-pointer"
          >
            Acknowledge & Dismiss
          </button>
        </div>
      )}

      {/* Upper bar */}
      <header className="border-b border-sys-border bg-sys-panel/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/5 border border-white/10 rounded-2xl shadow-lg">
            <SamanvayMark className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight text-neutral-100 font-display flex items-center gap-2">
              SAMANVAY <span className="text-[10px] bg-human/15 text-human px-2 py-0.5 rounded-full border border-human/20 font-bold font-mono">WORKSPACE</span>
            </h1>
            <p className="text-[10px] text-neutral-400 font-medium tracking-wide uppercase font-mono mt-0.5">
              Human-Agent Collaboration Hub
            </p>
          </div>
        </div>

        {/* User Info & Connection status badge */}
        <div className="flex items-center gap-3">
          
          {/* Room Code display & copy */}
          {roomCode && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomCode);
              }}
              title="Click to copy Room Code"
              className="flex items-center gap-2 bg-sys-panel hover:bg-bg-dark/40 border border-sys-border px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 transition-all cursor-pointer active:scale-95"
            >
              <span className="text-[10px] text-neutral-500 font-mono">ROOM:</span>
              <span className="text-xs font-mono font-bold text-indigo-400 tracking-wider uppercase">{roomCode}</span>
            </button>
          )}

          {/* User profile identifier */}
          <div className="hidden md:flex items-center gap-2 bg-sys-panel px-3 py-1.5 rounded-lg border border-sys-border">
            <UserCheck className="w-4 h-4 text-human" />
            <span className="text-xs text-neutral-300 font-mono font-medium max-w-[140px] truncate">
              {displayName || (authenticatedUserEmail ? authenticatedUserEmail.split('@')[0] : 'You')}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] border-r border-sys-border pr-3">
            {connecting ? (
              <span className="flex items-center gap-1.5 text-agent/80 font-semibold animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                CONNECTING
              </span>
            ) : wsConnected ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-500 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                OFFLINE
              </span>
            )}
          </div>

          {/* API Keys Configuration Onboarding */}
          <button
            onClick={() => setApiKeyModalOpen(true)}
            className="flex items-center gap-2 bg-sys-panel hover:bg-sys-panel/80 hover:text-white border border-sys-border px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 transition-all cursor-pointer active:scale-95 animate-fadeIn"
          >
            <Key className="w-3.5 h-3.5 text-human" />
            <span>API Keys</span>
            {apiKeysStatus.connected ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 border border-emerald-500/20" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-agent animate-pulse border border-agent/20" />
            )}
          </button>

          {/* Leave Room Button */}
          {roomCode && (
            <button
              onClick={() => setRoomCode(null)}
              className="flex items-center gap-2 bg-sys-panel hover:bg-sys-panel/80 hover:text-white border border-sys-border px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 transition-all cursor-pointer active:scale-95"
              title="Return to Room selection screen"
            >
              <LogOut className="w-3.5 h-3.5 text-neutral-500" />
              <span>Leave Room</span>
            </button>
          )}

          {/* Sign Out Button */}
          <button
            onClick={() => setAuthenticatedUserEmail(null)}
            className="flex items-center gap-2 bg-sys-panel hover:bg-sys-panel/80 hover:text-white border border-sys-border px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 transition-all cursor-pointer active:scale-95 animate-fadeIn"
          >
            <LogOut className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Persistent Multi-Presence Workspace Shell */}
      <div className="flex-1 flex flex-row min-h-0">
        
        {/* Left presence sidebar */}
        <WorkspaceSidebar
          teamMembers={teamMembers}
          planner={planner}
          estimator={estimator}
          riskFlagger={riskFlagger}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          authenticatedUserEmail={authenticatedUserEmail}
        />

        {/* Dynamic center workspace */}
        <main className="flex-1 p-6 overflow-y-auto bg-bg-dark/20">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {activeTab === 'coding' && (
              <div className="animate-fadeIn">
                <CoCodingLab />
              </div>
            )}

            {activeTab === 'kanban' && (
              <div className="animate-fadeIn">
                <TaskTracker teamMembers={teamMembers} />
              </div>
            )}

            {activeTab === 'budget' && (
              <div className="animate-fadeIn">
                <BudgetDecision />
              </div>
            )}

            {activeTab === 'orchestrator' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                {/* Left Side Controls & Logger */}
                <section className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-sys-panel p-4 border border-sys-border rounded-2xl">
                    <span className="text-[10px] text-neutral-400 font-mono font-bold uppercase tracking-widest block mb-1">
                      REALTIME WORKSPACE PIPELINE
                    </span>
                    <p className="text-xs text-neutral-400 leading-normal">
                      Trigger direct pipeline jobs on the live workspace. Generates real Planner, Estimator and Risk-Flagger models.
                    </p>
                  </div>
                  <InputPanel
                    onRun={handleRunAgents}
                    isLoading={isRunActive}
                  />
                  <AgentStatusPanel
                    planner={planner}
                    estimator={estimator}
                    riskFlagger={riskFlagger}
                  />
                </section>

                {/* Right Side Board Output */}
                <section className="lg:col-span-7 flex flex-col">
                  <ResultsPanel
                    planner={planner}
                    estimator={estimator}
                    riskFlagger={riskFlagger}
                    plannerStatus={planner.status}
                    estimatorStatus={estimator.status}
                    riskFlaggerStatus={riskFlagger.status}
                    plannerOutput={plannerOutput}
                    estimatorOutput={estimatorOutput}
                    riskFlaggerOutput={riskFlaggerOutput}
                    isRunActive={isRunActive}
                    error={error}
                  />
                </section>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Decorative footer */}
      <footer className="border-t border-sys-border bg-sys-panel/40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 gap-2 font-mono">
        <span>Samanvay © 2026. A unified workspace for human-agent coordination.</span>
        <span className="text-neutral-600">SECURE SHELL PIPELINE</span>
      </footer>

      {/* LLM Provider Onboarding Modal */}
      <ApiKeyModal isOpen={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <MainApp />
    </WorkspaceProvider>
  );
}
