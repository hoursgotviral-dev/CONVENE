import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { WorkspaceTerminal } from './WorkspaceTerminal';

interface TerminalPaneProps {
  panelTab: 'terminal' | 'problems' | 'output' | 'debug_console';
  setPanelTab: (tab: 'terminal' | 'problems' | 'output' | 'debug_console') => void;
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  terminalHeight: number;
  setTerminalHeight: (height: number) => void;
  problems: Array<{
    id: string;
    severity: 'error' | 'warning';
    message: string;
    file: string;
    line: string;
    source: string;
  }>;
  debugConsoleLines: Array<{ text: string; type: string }>;
  debugInput: string;
  setDebugInput: (input: string) => void;
  handleDebugSubmit: (e: React.FormEvent) => void;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  panelTab,
  setPanelTab,
  terminalOpen,
  setTerminalOpen,
  terminalHeight,
  setTerminalHeight,
  problems,
  debugConsoleLines,
  debugInput,
  setDebugInput,
  handleDebugSubmit,
}) => {
  return (
    <div
      style={{ height: `${terminalHeight}px` }}
      className="shrink-0 flex flex-col bg-[#11121a] border-t border-sys-border overflow-hidden relative"
    >
      <div className="h-1 bg-indigo-500/20 hover:bg-indigo-500 cursor-row-resize absolute top-0 left-0 right-0 z-30 transition-colors" />

      <div className="h-9 bg-[#0e0f16] border-b border-sys-border/60 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-4 text-[10px] font-mono font-bold">
          <button
            onClick={() => setPanelTab('terminal')}
            className={`py-1.5 relative transition-all cursor-pointer ${
              panelTab === 'terminal' ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            TERMINAL
            {panelTab === 'terminal' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />
            )}
          </button>
          <button
            onClick={() => setPanelTab('problems')}
            className={`py-1.5 relative transition-all cursor-pointer flex items-center gap-1 ${
              panelTab === 'problems' ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            PROBLEMS
            <span className={`text-[9px] px-1 rounded-full ${
              problems.length > 0 ? 'bg-rose-500 text-white font-bold' : 'bg-neutral-800 text-neutral-400'
            }`}>
              {problems.length}
            </span>
            {panelTab === 'problems' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />
            )}
          </button>
          <button
            onClick={() => setPanelTab('output')}
            className={`py-1.5 relative transition-all cursor-pointer ${
              panelTab === 'output' ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            OUTPUT
            {panelTab === 'output' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />
            )}
          </button>
          <button
            onClick={() => setPanelTab('debug_console')}
            className={`py-1.5 relative transition-all cursor-pointer ${
              panelTab === 'debug_console' ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            DEBUG CONSOLE
            {panelTab === 'debug_console' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-600 font-mono">Height:</span>
          <input
            type="range"
            min="110"
            max="300"
            value={terminalHeight}
            onChange={(e) => setTerminalHeight(parseInt(e.target.value))}
            className="w-16 h-1 bg-neutral-800 rounded-lg appearance-none accent-indigo-500 cursor-row-resize"
          />
          <span className="text-[9px] text-neutral-400 font-mono w-6 text-right">{terminalHeight}px</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative p-3">
        {panelTab === 'terminal' && (
          <div className="h-full relative overflow-y-auto pr-1">
            <WorkspaceTerminal
              height={terminalHeight - 48}
              setHeight={setTerminalHeight}
              isOpen={terminalOpen}
              setIsOpen={setTerminalOpen}
            />
          </div>
        )}

        {panelTab === 'problems' && (
          <div className="h-full overflow-y-auto font-mono text-[11px] space-y-1.5">
            {problems.length > 0 ? (
              problems.map((p, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-rose-500/5 rounded-lg border border-rose-500/20 text-rose-400">
                  {p.severity === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span className="font-bold uppercase text-[9px] px-1 rounded bg-rose-500/20 mr-1.5">{p.severity}</span>
                    <span>{p.message}</span>
                    <div className="text-[10px] text-neutral-500 mt-1 flex gap-2">
                      <span>Source: {p.source}</span>
                      <span>•</span>
                      <span>File: {p.file}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 py-6">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <span className="text-xs text-neutral-300 font-semibold">No problems have been detected in this workspace.</span>
                <p className="text-[10px] text-neutral-500">Collaborative bracket syntax linter checks completed.</p>
              </div>
            )}
          </div>
        )}

        {panelTab === 'output' && (
          <div className="h-full overflow-y-auto font-mono text-[11px] text-neutral-400 space-y-1 p-1">
            <span className="text-[9px] font-mono text-neutral-600 block">[system] Streaming Live Samanvay Workspace event telemetry:</span>
            <p className="text-indigo-400">[info] Port 3000 mapped successfully to sandbox proxy container.</p>
            <p className="text-neutral-500">[info] Connecting to secure room workspace broadcast service...</p>
            <p className="text-emerald-400">[info] Live sync established. 0 latency. Host: 0.0.0.0</p>
            <p className="text-[#F5A623]">[telemetry] Detected active code changes on client component.</p>
            <p className="text-neutral-500">[system] Subscribed to workspace co-author presence events.</p>
          </div>
        )}

        {panelTab === 'debug_console' && (
          <div className="h-full flex flex-col font-mono text-[11px]">
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {debugConsoleLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`py-0.5 px-1 ${
                    line.type === 'input'
                      ? 'text-indigo-400 font-semibold'
                      : line.type === 'error'
                      ? 'text-rose-400'
                      : line.type === 'system'
                      ? 'text-neutral-500 italic border-b border-neutral-900 pb-1'
                      : 'text-neutral-300'
                  }`}
                >
                  {line.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleDebugSubmit} className="mt-2 flex border-t border-neutral-900 pt-2 shrink-0">
              <span className="text-indigo-400 mr-2 font-bold select-none">&gt;</span>
              <input
                type="text"
                value={debugInput}
                onChange={(e) => setDebugInput(e.target.value)}
                placeholder="Type variable to query (e.g. selectedFile, help) or calculation..."
                className="flex-1 bg-transparent border-none text-white focus:outline-none font-mono text-[11px]"
              />
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
