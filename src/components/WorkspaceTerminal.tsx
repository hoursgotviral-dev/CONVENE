import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { useWorkspace } from '../context/WorkspaceContext';
import { Terminal as TerminalIcon, ShieldAlert } from 'lucide-react';

interface WorkspaceTerminalProps {
  height: number;
  setHeight: (height: number) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const WorkspaceTerminal: React.FC<WorkspaceTerminalProps> = ({
  height,
  setHeight,
  isOpen,
  setIsOpen,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { triggerAgentQuery, fileContents, selectedFile, apiKeysStatus } = useWorkspace();

  const fileContentsRef = useRef(fileContents);
  fileContentsRef.current = fileContents;
  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;
  const apiKeysStatusRef = useRef(apiKeysStatus);
  apiKeysStatusRef.current = apiKeysStatus;

  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (termRef.current && isOpen && termRef.current.element) {
      const rows = Math.max(4, Math.floor(height / 22));
      try {
        const elem = termRef.current.element;
        const core = (termRef.current as any)._core;
        // Verify xterm is fully initialized and attached in DOM with valid services
        if (elem && elem.clientWidth > 0 && core && core._renderService && core._charSizeService) {
          termRef.current.resize(termRef.current.cols, rows);
        }
      } catch (err) {
        console.warn('Failed to resize xterm dynamically', err);
      }
    }
  }, [height, isOpen]);

  useEffect(() => {
    if (!terminalRef.current || !isOpen) return;

    let isDisposed = false;
    let isWriting = false;

    // Create terminal instance
    const term = new Terminal({
      theme: {
        background: '#0D0E12',
        foreground: '#D4D4D8',
        cursor: '#6366F1',
        selectionBackground: '#6366F150',
      },
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontSize: 11,
      cursorBlink: true,
      rows: Math.max(4, Math.floor(height / 22)),
    });

    termRef.current = term;
    term.open(terminalRef.current);

    term.writeln('\x1b[35m=== SAMANVAY Co-Coding Terminal v1.0.0 ===\x1b[0m');
    term.writeln('Connected to secure sandboxed environment. Port 3000 open.');
    term.writeln('Type \x1b[36mhelp\x1b[0m for commands or \x1b[33mvibe <instruction>\x1b[0m to patch selected file.');
    term.write('\n\x1b[32m$ \x1b[0m');

    let currentInput = '';

    const writeStreaming = (text: string, delay = 5) => {
      return new Promise<void>((resolve) => {
        let index = 0;
        const interval = setInterval(() => {
          if (isDisposed) {
            clearInterval(interval);
            resolve();
            return;
          }
          if (index < text.length) {
            term.write(text[index]);
            index++;
          } else {
            clearInterval(interval);
            resolve();
          }
        }, delay);
      });
    };

    const writeLineByLine = async (lines: string[], delay = 20) => {
      for (const line of lines) {
        if (isDisposed) return;
        term.writeln(line);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    };

    const disposable = term.onKey(({ key, domEvent }) => {
      if (isWriting) return; // Prevent raw command inputs while active operations run

      const char = key;
      if (domEvent.keyCode === 13) { // Enter
        term.write('\r\n');
        handleCommand(currentInput.trim());
        currentInput = '';
      } else if (domEvent.keyCode === 8) { // Backspace
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1);
          term.write('\b \b'); // backspace, write space, backspace
        }
      } else if (domEvent.keyCode >= 37 && domEvent.keyCode <= 40) {
        // Ignore arrow keys for simplicity
      } else {
        currentInput += char;
        term.write(char);
      }
    });

    const handleCommand = async (commandLine: string) => {
      if (!commandLine) {
        term.write('\x1b[32m$ \x1b[0m');
        return;
      }

      const args = commandLine.split(' ');
      const baseCmd = args[0].toLowerCase();

      if (baseCmd === 'help') {
        isWriting = true;
        const lines = [
          'Available commands:',
          '  \x1b[36mhelp\x1b[0m               Show this guide',
          '  \x1b[36mclear\x1b[0m              Clear terminal lines',
          '  \x1b[36mls\x1b[0m                 List files in sandbox workspace',
          '  \x1b[36mcat <file>\x1b[0m         Read content of a specific file',
          '  \x1b[36mstatus\x1b[0m             Inspect connected multi-agent status',
          '  \x1b[36mapikey\x1b[0m             Display onboarded API keys status',
          '  \x1b[33mvibe <prompt>\x1b[0m      Ask AI Agent to patch selected file code'
        ];
        await writeLineByLine(lines, 20);
        isWriting = false;
        term.write('\x1b[32m$ \x1b[0m');
      } else if (baseCmd === 'clear') {
        term.clear();
        term.write('\x1b[32m$ \x1b[0m');
      } else if (baseCmd === 'ls') {
        isWriting = true;
        term.writeln('Listing directory contents:');
        const files = Object.keys(fileContentsRef.current).map((file) => `  - \x1b[34m${file}\x1b[0m  (TypeScript source)`);
        await writeLineByLine(files, 30);
        isWriting = false;
        term.write('\x1b[32m$ \x1b[0m');
      } else if (baseCmd === 'cat') {
        const target = args[1];
        if (!target) {
          term.writeln('\x1b[31mUsage: cat <filename>\x1b[0m');
          term.write('\x1b[32m$ \x1b[0m');
        } else if (!fileContentsRef.current[target]) {
          term.writeln(`\x1b[31mFile "${target}" not found in sandbox explorer.\x1b[0m`);
          term.write('\x1b[32m$ \x1b[0m');
        } else {
          isWriting = true;
          const lines = fileContentsRef.current[target].split('\n');
          await writeLineByLine(lines, 10);
          isWriting = false;
          term.write('\x1b[32m$ \x1b[0m');
        }
      } else if (baseCmd === 'status') {
        isWriting = true;
        const lines = [
          'Agent Pipeline Status:',
          '  Planner:     \x1b[32mStandby / Idle\x1b[0m',
          '  Estimator:   \x1b[32mStandby / Idle\x1b[0m',
          '  Risk-Flagger:\x1b[32mStandby / Idle\x1b[0m'
        ];
        await writeLineByLine(lines, 25);
        isWriting = false;
        term.write('\x1b[32m$ \x1b[0m');
      } else if (baseCmd === 'apikey') {
        isWriting = true;
        term.writeln('\r\n\x1b[1;34m[API Key Diagnostic]\x1b[0m');
        if (apiKeysStatusRef.current?.connected) {
          term.writeln(`Status: \x1b[32mConnected\x1b[0m`);
          term.writeln(
            `Provider: \x1b[36m${(apiKeysStatusRef.current.provider || 'UNKNOWN').toUpperCase()}\x1b[0m`
          );
        } else {
          await writeLineByLine([
            'Status: \x1b[33mDEMO MODE (Using smart server simulation)\x1b[0m',
            'Configure keys in Settings Modal to trigger live LLM calls.'
          ], 25);
        }
        isWriting = false;
        term.write('\x1b[32m$ \x1b[0m');
      } else if (baseCmd === 'vibe') {
        const promptText = args.slice(1).join(' ');
        if (!promptText) {
          term.writeln('\x1b[31mUsage: vibe <prompt instructions for AI agent>\x1b[0m');
          term.write('\x1b[32m$ \x1b[0m');
        } else {
          isWriting = true;
          term.writeln(`\x1b[33mDispatching prompt to co-coding agent for file: "${selectedFileRef.current}"...\x1b[0m`);
          term.writeln(`Prompt: "${promptText}"`);
          term.writeln('\x1b[32m[Planner] Analyzing requirement decomposition...\x1b[0m');
          
          const currentCode = fileContentsRef.current[selectedFileRef.current] || '';
          const proposal = await triggerAgentQuery(currentCode, promptText, 'terminal');
          
          if (proposal) {
            term.writeln('');
            await writeStreaming(`\x1b[35m[Agent: ${proposal.agentName}] Proposal explanation:\x1b[0m\r\n`, 8);
            
            const explanationLines = proposal.explanation.split('\n');
            for (const line of explanationLines) {
              await writeStreaming(`  ${line}\r\n`, 4);
            }
            
            await writeStreaming(`\r\n\x1b[33m[Agent] Target code selection to replace:\x1b[0m\r\n`, 8);
            const targetLines = proposal.targetLines.split('\n');
            for (const line of targetLines) {
              await writeStreaming(`  \x1b[90m${line}\x1b[0m\r\n`, 3);
            }

            await writeStreaming(`\r\n\x1b[32m✔ Diff successfully overlaid in Monaco Editor.\x1b[0m\r\n`, 8);
            await writeStreaming(`\x1b[32m✔ Review suggestions in the code overlay pane to Approve or Reject.\x1b[0m\r\n`, 8);
          } else {
            term.writeln('\x1b[31mError: Agent failed to return a valid proposal.\x1b[0m');
          }
          isWriting = false;
          term.write('\x1b[32m$ \x1b[0m');
        }
      } else {
        term.writeln(`bash: command not found: ${baseCmd}. Type "help" for a list of valid commands.`);
        term.write('\x1b[32m$ \x1b[0m');
      }
    };

    return () => {
      isDisposed = true;
      disposable.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      style={{ height: `${height}px` }}
      className="bg-bg-dark border border-sys-border rounded-2xl flex flex-col relative overflow-hidden"
    >
      <div className="bg-sys-panel px-4 py-2 flex items-center justify-between border-b border-sys-border shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-300">
            Interactive Workspace Shell (xterm.js)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-neutral-500 font-mono">
            Focus: {selectedFile}
          </span>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-[10px] text-[#5f5af6] hover:text-[#7d79f8] transition-colors cursor-pointer font-mono bg-transparent border-none p-0"
          >
            [hide]
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 p-3 overflow-hidden text-left bg-bg-dark" />
    </div>
  );
};
