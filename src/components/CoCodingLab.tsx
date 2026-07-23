import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { motion, useReducedMotion } from 'motion/react';
import {
  Terminal,
  Sparkles,
  Play,
  Check,
  RefreshCw,
  FileCode,
  Users,
  X,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Settings,
  Search as SearchIcon,
  GitBranch,
  PlayCircle,
  Blocks,
  AlertCircle,
  FileText,
  Info,
  ExternalLink,
  MessageSquare,
  Bug,
  AlertTriangle,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { EditorPane } from './EditorPane';
import { AgentSuggestionPanel } from './AgentSuggestionPanel';
import { TerminalPane } from './TerminalPane';

export const CoCodingLab: React.FC = () => {
  const {
    selectedFile,
    setSelectedFile,
    fileContents,
    currentProposal,
    setCurrentProposal,
    isAgentResponding,
    triggerAgentQuery,
    teamMembers,
  } = useWorkspace();

  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'search' | 'git' | 'debug' | 'agents'>('explorer');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [panelTab, setPanelTab] = useState<'terminal' | 'problems' | 'output' | 'debug_console'>('terminal');

  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [commitMessage, setCommitMessage] = useState('feat: build collaborative workspace');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const [initialContents] = useState<Record<string, string>>(() => ({ ...fileContents }));

  const [debugConsoleLines, setDebugConsoleLines] = useState<any[]>([
    { text: 'Samanvay Co-Coding Debug Console v1.0.0. Type variables to inspect.', type: 'system' }
  ]);
  const [debugInput, setDebugInput] = useState('');

  const [openEditorsExpanded, setOpenEditorsExpanded] = useState(true);
  const [fileTreeExpanded, setFileTreeExpanded] = useState(true);
  const [coAuthorsExpanded, setCoAuthorsExpanded] = useState(true);
  const [srcFolderExpanded, setSrcFolderExpanded] = useState(true);

  const editorRef = useRef<any>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  const files = [
    { name: 'server.ts', lang: 'typescript', size: '2.4 KB' },
    { name: 'schema.ts', lang: 'typescript', size: '1.2 KB' },
    { name: 'firebase.config.ts', lang: 'typescript', size: '0.8 KB' },
  ];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      editorRef.current = null;
    };
  }, []);

  const getBraceProblems = () => {
    const content = fileContents[selectedFile] || '';
    const problems = [];

    const openCurly = (content.match(/\{/g) || []).length;
    const closeCurly = (content.match(/\}/g) || []).length;
    if (openCurly !== closeCurly) {
      problems.push({
        id: 'curly',
        severity: 'error' as const,
        message: `Curly braces are unbalanced: ${openCurly} open vs ${closeCurly} closed.`,
        file: selectedFile,
        line: 'Ln 1',
        source: 'samanvay-linter',
      });
    }

    const openSquare = (content.match(/\[/g) || []).length;
    const closeSquare = (content.match(/\]/g) || []).length;
    if (openSquare !== closeSquare) {
      problems.push({
        id: 'square',
        severity: 'error' as const,
        message: `Square brackets are unbalanced: ${openSquare} open vs ${closeSquare} closed.`,
        file: selectedFile,
        line: 'Ln 1',
        source: 'samanvay-linter',
      });
    }

    const openParen = (content.match(/\(/g) || []).length;
    const closeParen = (content.match(/\)/g) || []).length;
    if (openParen !== closeParen) {
      problems.push({
        id: 'paren',
        severity: 'warning' as const,
        message: `Parentheses are unbalanced: ${openParen} open vs ${closeParen} closed.`,
        file: selectedFile,
        line: 'Ln 1',
        source: 'samanvay-linter',
      });
    }

    return problems;
  };

  const problems = getBraceProblems();

  const getSearchMatches = () => {
    if (!searchQuery.trim()) return [];
    const results: { file: string; line: number; text: string }[] = [];
    Object.entries(fileContents).forEach(([file, content]) => {
      const lines = (content as string).split('\n');
      lines.forEach((lineText, index) => {
        if (lineText.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({
            file,
            line: index + 1,
            text: lineText.trim(),
          });
        }
      });
    });
    return results;
  };

  const searchResults = getSearchMatches();

  const getModifiedFiles = () => {
    return files.filter(f => fileContents[f.name] !== initialContents[f.name]).map(f => f.name);
  };

  const modifiedFiles = getModifiedFiles();

  const handleAskAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    let targetCode = fileContents[selectedFile] || '';
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const selectedText = editorRef.current.getModel().getValueInRange(selection);
      if (selectedText.trim()) {
        targetCode = selectedText;
      }
    }

    await triggerAgentQuery(targetCode, aiPrompt, 'code_view');
    setAiPrompt('');
  };

  const handleDebugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debugInput.trim()) return;

    const cmd = debugInput.trim();
    const newLines = [...debugConsoleLines, { text: `> ${cmd}`, type: 'input' }];

    let responseText = '';
    const lowerCmd = cmd.toLowerCase();

    if (lowerCmd === 'clear') {
      setDebugConsoleLines([]);
      setDebugInput('');
      return;
    } else if (lowerCmd === 'help') {
      responseText = 'Samanvay Sandbox Variables to inspect:\n  - selectedFile : Current active file name\n  - fileContents : Map of all sandbox source code\n  - teamMembers  : Connected co-authors metadata\n  - clear        : Clear this debug console log';
    } else if (lowerCmd === 'selectedfile') {
      responseText = `"${selectedFile}"`;
    } else if (lowerCmd === 'filecontents') {
      responseText = JSON.stringify(fileContents, null, 2);
    } else if (lowerCmd === 'teammembers') {
      responseText = JSON.stringify(teamMembers, null, 2);
    } else {
      try {
        if (/^[0-9+\-*/().\s]+$/.test(cmd)) {
          const result = eval(cmd);
          responseText = String(result);
        } else {
          responseText = `Result: Command run in Sandbox environment successfully. Output variable: "${cmd}"`;
        }
      } catch (err: any) {
        responseText = `ReferenceError: ${cmd} is not defined (Sandbox Mock)`;
      }
    }

    setDebugConsoleLines([...newLines, { text: responseText, type: 'output' }]);
    setDebugInput('');
  };

  const triggerDiagnostics = () => {
    setIsDebugging(true);
    setPanelTab('terminal');
    setDebugConsoleLines(prev => [
      ...prev,
      { text: `[diagnostics] Running workspace compilation test...`, type: 'system' }
    ]);

    setTimeout(() => {
      setIsDebugging(false);
      setDebugConsoleLines(prev => [
        ...prev,
        { text: `[diagnostics] Compilation complete. 0 errors, 0 warnings.`, type: 'system' }
      ]);
    }, 1200);
  };

  const handleGitCommit = () => {
    if (modifiedFiles.length === 0) return;
    setIsCommitting(true);
    setTimeout(() => {
      setIsCommitting(false);
      setCommitMessage('feat: sync collaborative workspace');
      setDebugConsoleLines(prev => [
        ...prev,
        { text: `[git] git add .`, type: 'system' },
        { text: `[git] git commit -m "${commitMessage}"`, type: 'system' },
        { text: `[git] git push origin main`, type: 'system' },
        { text: `[git] Successfully synchronized room sandbox repository with the live agent pipeline!`, type: 'system' }
      ]);
      alert("Changes Committed & Synced Successfully!");
    }, 1500);
  };

  const handleActivityTabClick = (tab: 'explorer' | 'search' | 'git' | 'debug' | 'agents') => {
    if (activeSidebarTab === tab) {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    } else {
      setActiveSidebarTab(tab);
      setIsSidebarCollapsed(false);
    }
  };

  return (
    <div className="flex flex-col h-[750px] bg-[#0c0d12] rounded-2xl border border-sys-border overflow-hidden relative shadow-2xl font-sans select-none">

      <div className="h-10 bg-[#0e0f16] border-b border-sys-border px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="text-[11px] font-mono font-medium text-neutral-400 ml-3 truncate max-w-[180px] sm:max-w-none">
            Co-Coding Lab — {selectedFile}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-md font-semibold tracking-wider">
            SANDBOX ENVIRONMENT
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-row min-h-0 relative">

        <div className="w-14 bg-[#0e0f16] border-r border-sys-border flex flex-col justify-between items-center py-4 shrink-0">
          <div className="flex flex-col gap-4 items-center w-full">
            <button
              onClick={() => handleActivityTabClick('explorer')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
                activeSidebarTab === 'explorer' && !isSidebarCollapsed
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-neutral-500 hover:text-white hover:bg-neutral-800/40'
              }`}
              title="Explorer"
            >
              <FileCode className="w-5 h-5" />
              {activeSidebarTab === 'explorer' && !isSidebarCollapsed && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-indigo-500 rounded-r" />
              )}
            </button>

            <button
              onClick={() => handleActivityTabClick('search')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
                activeSidebarTab === 'search' && !isSidebarCollapsed
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-neutral-500 hover:text-white hover:bg-neutral-800/40'
              }`}
              title="Search"
            >
              <SearchIcon className="w-5 h-5" />
              {searchResults.length > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-indigo-500 text-white text-[8px] font-mono font-bold h-3.5 px-1 rounded-full flex items-center justify-center min-w-[14px]">
                  {searchResults.length}
                </span>
              )}
              {activeSidebarTab === 'search' && !isSidebarCollapsed && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-indigo-500 rounded-r" />
              )}
            </button>

            <button
              onClick={() => handleActivityTabClick('git')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
                activeSidebarTab === 'git' && !isSidebarCollapsed
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-neutral-500 hover:text-white hover:bg-neutral-800/40'
              }`}
              title="Source Control"
            >
              <GitBranch className="w-5 h-5" />
              {modifiedFiles.length > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[8px] font-mono font-bold h-3.5 px-1 rounded-full flex items-center justify-center min-w-[14px]">
                  {modifiedFiles.length}
                </span>
              )}
              {activeSidebarTab === 'git' && !isSidebarCollapsed && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-indigo-500 rounded-r" />
              )}
            </button>

            <button
              onClick={() => handleActivityTabClick('debug')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
                activeSidebarTab === 'debug' && !isSidebarCollapsed
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-neutral-500 hover:text-white hover:bg-neutral-800/40'
              }`}
              title="Run and Debug Diagnostics"
            >
              <PlayCircle className="w-5 h-5" />
              {activeSidebarTab === 'debug' && !isSidebarCollapsed && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-indigo-500 rounded-r" />
              )}
            </button>

            <button
              onClick={() => handleActivityTabClick('agents')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
                activeSidebarTab === 'agents' && !isSidebarCollapsed
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-neutral-500 hover:text-white hover:bg-neutral-800/40'
              }`}
              title="AI Agents Telemetry"
            >
              <Blocks className="w-5 h-5 text-indigo-400 animate-pulse" />
              {activeSidebarTab === 'agents' && !isSidebarCollapsed && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-indigo-500 rounded-r" />
              )}
            </button>
          </div>

          <div className="flex flex-col gap-4 items-center w-full">
            <div title="Settings" className="cursor-pointer">
              <Settings className="w-5 h-5 text-neutral-600 hover:text-neutral-300 transition-colors" />
            </div>
            <div title="Account" className="cursor-pointer">
              <Users className="w-5 h-5 text-neutral-600 hover:text-neutral-300 transition-colors" />
            </div>
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div className="w-60 bg-[#131420] border-r border-sys-border flex flex-col min-h-0 shrink-0 select-none">

            {activeSidebarTab === 'explorer' && (
              <div className="flex flex-col h-full overflow-y-auto">
                <div className="h-10 px-4 border-b border-sys-border flex items-center justify-between shrink-0 bg-[#0f1018]">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                    Explorer
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 rounded-md font-semibold uppercase">
                    Workspace
                  </span>
                </div>

                <div className="border-b border-sys-border/50">
                  <button
                    onClick={() => setOpenEditorsExpanded(!openEditorsExpanded)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-neutral-800/30 font-semibold transition-all cursor-pointer"
                  >
                    {openEditorsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
                    <span className="text-[10px] font-mono tracking-wide text-neutral-400 uppercase">Open Editors</span>
                  </button>
                  {openEditorsExpanded && (
                    <div className="px-5 pb-2.5 pt-0.5 space-y-1">
                      <button
                        onClick={() => setSelectedFile(selectedFile)}
                        className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-mono bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 flex items-center justify-between"
                      >
                        <span className="truncate">{selectedFile}</span>
                        <X className="w-3 h-3 text-neutral-500 hover:text-rose-400" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-b border-sys-border/50">
                  <button
                    onClick={() => setFileTreeExpanded(!fileTreeExpanded)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-neutral-800/30 font-semibold transition-all cursor-pointer"
                  >
                    {fileTreeExpanded ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
                    <span className="text-[10px] font-mono tracking-wide text-neutral-400 uppercase">Samanvay Workspace</span>
                  </button>
                  {fileTreeExpanded && (
                    <div className="px-4 pb-3 pt-1 font-mono text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5 text-neutral-300 py-1">
                        <FolderOpen className="w-4 h-4 text-indigo-400" />
                        <span className="font-semibold">samanvay-workspace</span>
                      </div>

                      <div className="pl-3.5 space-y-1">
                        <button
                          onClick={() => setSrcFolderExpanded(!srcFolderExpanded)}
                          className="flex items-center gap-1.5 text-neutral-300 hover:text-white py-1 transition-colors w-full text-left cursor-pointer"
                        >
                          {srcFolderExpanded ? <ChevronDown className="w-3 h-3 text-neutral-500" /> : <ChevronRight className="w-3 h-3 text-neutral-500" />}
                          {srcFolderExpanded ? <FolderOpen className="w-3.5 h-3.5 text-amber-500" /> : <Folder className="w-3.5 h-3.5 text-amber-500" />}
                          <span className="font-medium">src</span>
                        </button>

                        {srcFolderExpanded && (
                          <div className="pl-4 space-y-1 border-l border-neutral-800/60 ml-1.5">
                            {files.map((file) => (
                              <button
                                key={file.name}
                                onClick={() => {
                                  setSelectedFile(file.name);
                                  setCurrentProposal(null);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-all border cursor-pointer ${
                                  selectedFile === file.name
                                    ? 'bg-indigo-600/15 text-white font-semibold border-indigo-500/20'
                                    : 'text-neutral-400 hover:bg-neutral-800/20 hover:text-white border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <FileCode className={`w-3.5 h-3.5 ${selectedFile === file.name ? 'text-indigo-400' : 'text-neutral-500'}`} />
                                  <span>{file.name}</span>
                                </div>
                                <span className="text-[9px] text-neutral-600">{file.size}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto border-t border-sys-border bg-[#0f1018]/40">
                  <button
                    onClick={() => setCoAuthorsExpanded(!coAuthorsExpanded)}
                    className="w-full flex items-center gap-1.5 px-3 py-2.5 text-left hover:bg-neutral-800/30 font-semibold transition-all cursor-pointer"
                  >
                    {coAuthorsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
                    <span className="text-[10px] font-mono tracking-wide text-neutral-400 uppercase flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Co-Authors</span>
                    </span>
                  </button>
                  {coAuthorsExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-2 max-h-48 overflow-y-auto">
                      {teamMembers.filter(m => m.status !== 'offline' && m.id !== 'm-1').map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-[11px] font-mono">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-neutral-300 font-semibold">{m.name.split(' ')[0]}</span>
                          </div>
                          <span className="text-[9px] text-neutral-500 bg-[#0c0d12] border border-sys-border px-1.5 py-0.5 rounded-md">
                            {m.cursorPosition ? m.cursorPosition.replace('viewing ', '') : 'active'}
                          </span>
                        </div>
                      ))}
                      {teamMembers.filter(m => m.status !== 'offline' && m.id !== 'm-1').length === 0 && (
                        <p className="text-[10px] text-neutral-500 font-mono italic px-1.5">No other users active</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSidebarTab === 'search' && (
              <div className="flex flex-col h-full p-4 overflow-y-auto space-y-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                  Search in Files
                </span>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search query..."
                    className="w-full bg-[#0c0d12] border border-sys-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {searchQuery && (
                    <div className="text-[10px] font-mono text-neutral-500 px-1">
                      Found {searchResults.length} matches in project
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {searchResults.map((match, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedFile(match.file);
                        if (editorRef.current) {
                          editorRef.current.revealLine(match.line);
                          editorRef.current.setPosition({ lineNumber: match.line, column: 1 });
                        }
                      }}
                      className="w-full text-left p-2 bg-[#0c0d12]/40 hover:bg-[#0c0d12]/90 border border-sys-border/50 hover:border-indigo-500/30 rounded-lg transition-all cursor-pointer block"
                    >
                      <div className="text-[10px] font-mono font-bold text-indigo-400 flex items-center justify-between">
                        <span>{match.file}</span>
                        <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 rounded-md">Ln {match.line}</span>
                      </div>
                      <p className="text-[11px] font-mono text-neutral-300 mt-1 truncate bg-neutral-900/40 p-1.5 rounded-md border border-neutral-800/40">
                        {match.text}
                      </p>
                    </button>
                  ))}
                  {searchQuery && searchResults.length === 0 && (
                    <div className="text-center text-xs text-neutral-500 italic pt-4">
                      No matching lines found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSidebarTab === 'git' && (
              <div className="flex flex-col h-full p-4 overflow-y-auto space-y-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                  Source Control
                </span>

                <div className="bg-[#0c0d12] rounded-xl p-3 border border-sys-border/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono text-neutral-300">Repository</span>
                    <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-500/20">samanvay-git*</span>
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500">
                    Your sandbox is in sync with collaborative Git.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Commit Message</label>
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-[#0c0d12] border border-sys-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[64px]"
                  />
                  <button
                    onClick={handleGitCommit}
                    disabled={isCommitting || modifiedFiles.length === 0}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:border-transparent text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                  >
                    {isCommitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Pushing changes...</span>
                      </>
                    ) : (
                      <>
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Commit & Sync ({modifiedFiles.length})</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block pt-2">Pending Changes</span>
                  {modifiedFiles.map(file => (
                    <div key={file} className="p-2 bg-[#0c0d12]/50 border border-sys-border rounded-lg flex items-center justify-between text-xs font-mono">
                      <span className="text-neutral-300">{file}</span>
                      <span className="text-[9px] bg-amber-500/10 text-[#F5A623] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-md uppercase font-semibold text-[9px]">Modified</span>
                    </div>
                  ))}
                  {modifiedFiles.length === 0 && (
                    <div className="text-center text-xs text-neutral-500 italic pt-6">
                      No changes detected. Edit any file to stage.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSidebarTab === 'debug' && (
              <div className="flex flex-col h-full p-4 overflow-y-auto space-y-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                  Run & Debug
                </span>

                <div className="bg-[#0c0d12] rounded-xl p-3 border border-sys-border space-y-3">
                  <div className="text-xs font-bold text-white flex items-center justify-between">
                    <span>Active Launch config:</span>
                  </div>
                  <pre className="text-[10px] font-mono text-neutral-400 p-2 bg-neutral-900 rounded border border-neutral-800">
                    {`{\n  "type": "node",\n  "request": "launch",\n  "name": "Samanvay Sandbox"\n}`}
                  </pre>
                </div>

                <button
                  onClick={triggerDiagnostics}
                  disabled={isDebugging}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDebugging ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Diagnostics Running...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run Workspace Diagnostics</span>
                    </>
                  )}
                </button>

                <div className="text-[10px] font-mono text-neutral-500 space-y-1">
                  <span className="block uppercase tracking-wider text-neutral-400 font-semibold">Environment stats:</span>
                  <p>Process PID: 3000</p>
                  <p>Memory Usage: 142 MB</p>
                  <p>Node runtime: Node 18.x</p>
                </div>
              </div>
            )}

            {activeSidebarTab === 'agents' && (
              <div className="flex flex-col h-full p-4 overflow-y-auto space-y-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                  AI Agents Status
                </span>

                <div className="space-y-3">
                  <div className="p-3 bg-[#0c0d12]/60 rounded-xl border border-sys-border/60">
                    <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                      <span className="font-bold text-white">Planner</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">ONLINE</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-normal font-mono">
                      Core Agent: Deconstructs tasks into executable steps.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0c0d12]/60 rounded-xl border border-sys-border/60">
                    <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                      <span className="font-bold text-white">Estimator</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">ONLINE</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-normal font-mono">
                      Analytic Agent: Predicts labor metrics and dependencies.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0c0d12]/60 rounded-xl border border-sys-border/60">
                    <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                      <span className="font-bold text-white">Risk-Flagger</span>
                      <span className="text-[9px] bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20 px-2 py-0.5 rounded-full font-bold">STANDBY</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-normal font-mono">
                      Safety Agent: Evaluates security boundaries & API flags.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 h-full relative">

          <div className="h-10 bg-[#0e0f16] border-b border-sys-border flex items-center justify-between shrink-0 pl-1.5">
            <div className="flex items-center gap-1 overflow-x-auto max-w-full">
              {files.map((file) => {
                const isActive = selectedFile === file.name;
                return (
                  <button
                    key={file.name}
                    onClick={() => {
                      setSelectedFile(file.name);
                      setCurrentProposal(null);
                    }}
                    className={`h-10 px-4 flex items-center gap-2 text-xs font-mono border-r border-sys-border transition-all cursor-pointer relative ${
                      isActive
                        ? 'bg-[#181a26] text-white font-semibold'
                        : 'bg-[#0f1018]/60 text-neutral-400 hover:text-white hover:bg-neutral-800/20'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-indigo-500" />
                    )}
                    <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400 animate-pulse' : 'text-neutral-500'}`} />
                    <span>{file.name}</span>

                    {fileContents[file.name] !== initialContents[file.name] ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1" title="Unsaved edits in sandbox" />
                    ) : (
                      <X className="w-3 h-3 text-neutral-500 hover:text-white hover:bg-neutral-800/60 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 shrink-0 pr-4">
              <button
                onClick={() => setTerminalOpen(!terminalOpen)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] border rounded-md transition-all cursor-pointer font-mono font-bold bg-transparent ${
                  terminalOpen
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                    : 'bg-neutral-900 border-sys-border text-neutral-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3 h-3" />
                <span>SHELL {terminalOpen ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          <div className="h-6.5 bg-[#12131b] border-b border-sys-border flex items-center px-4 font-mono text-[10px] text-neutral-500 shrink-0 select-none">
            <span className="hover:text-neutral-300 cursor-pointer">samanvay-workspace</span>
            <ChevronRight className="w-3 h-3 mx-1 text-neutral-600" />
            <span className="hover:text-neutral-300 cursor-pointer">src</span>
            <ChevronRight className="w-3 h-3 mx-1 text-neutral-600" />
            <span className="text-neutral-300 font-semibold">{selectedFile}</span>
          </div>

          <div className="flex-1 min-h-0 relative bg-[#181a26]">
            <EditorPane
              ref={editorRef}
              cursorPos={cursorPos}
              setCursorPos={setCursorPos}
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              isAgentResponding={isAgentResponding}
              handleAskAgent={handleAskAgent}
            />

            <div className="absolute top-4 right-4 pointer-events-none z-10 flex flex-col items-end gap-1 font-mono text-[9px] select-none">
              {teamMembers.filter(m => m.status !== 'offline' && m.id !== 'm-1').map(m => (
                <div key={m.id} className="flex items-center gap-1.5 bg-[#0e0f16]/95 border border-sys-border text-indigo-400 px-2.5 py-1 rounded-full backdrop-blur-sm shadow-lg animate-fadeIn font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{m.name.split(' ')[0]} : editing</span>
                </div>
              ))}
            </div>

            <AgentSuggestionPanel editorRef={editorRef} />
          </div>

          {terminalOpen && (
            <TerminalPane
              panelTab={panelTab}
              setPanelTab={setPanelTab}
              terminalOpen={terminalOpen}
              setTerminalOpen={setTerminalOpen}
              terminalHeight={terminalHeight}
              setTerminalHeight={setTerminalHeight}
              problems={problems}
              debugConsoleLines={debugConsoleLines}
              debugInput={debugInput}
              setDebugInput={setDebugInput}
              handleDebugSubmit={handleDebugSubmit}
            />
          )}
        </div>
      </div>

      <div className="h-6.5 bg-[#4f46e5] text-white px-4 flex items-center justify-between text-[11px] font-mono shrink-0 select-none shadow-inner">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1 bg-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
            <GitBranch className="w-3 h-3" />
            <span>main*</span>
          </div>
          <div className="flex items-center gap-1.5 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
            <span>connected</span>
          </div>
          <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
            <span className="font-bold">ⓧ</span>
            <span>{problems.filter(p => p.severity === 'error').length}</span>
            <span className="font-bold ml-1">⚠</span>
            <span>{problems.filter(p => p.severity === 'warning').length}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
            Ln {cursorPos.line}, Col {cursorPos.column}
          </span>
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer hidden sm:inline">
            Spaces: 2
          </span>
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer hidden md:inline">
            UTF-8
          </span>
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
            TypeScript JSX
          </span>
          <div className="bg-indigo-700/80 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest hidden lg:inline">
            Co-Coding Session
          </div>
        </div>
      </div>
    </div>
  );
};
