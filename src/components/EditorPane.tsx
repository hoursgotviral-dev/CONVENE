import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { RefreshCw, Play, Sparkles } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

interface EditorPaneProps {
  cursorPos: { line: number; column: number };
  setCursorPos: (pos: { line: number; column: number }) => void;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  isAgentResponding: boolean;
  handleAskAgent: (e: React.FormEvent) => Promise<void>;
}

interface EditorPaneRef {
  revealLine: (line: number) => void;
  setPosition: (pos: { lineNumber: number; column: number }) => void;
}

export const EditorPane = forwardRef<EditorPaneRef, EditorPaneProps>(({
  cursorPos,
  setCursorPos,
  aiPrompt,
  setAiPrompt,
  isAgentResponding,
  handleAskAgent,
}, ref) => {
  const { selectedFile, fileContents, setFileContents, broadcastFileEdit, teamMembers } = useWorkspace();
  const editorRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    revealLine: (line: number) => editorRef.current?.revealLine(line),
    setPosition: (pos: { lineNumber: number; column: number }) => editorRef.current?.setPosition(pos),
  }));

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;

    editor.updateOptions({
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      minimap: { enabled: false },
      lineHeight: 20,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 12, bottom: 12 },
      wordWrap: 'on',
      fontLigatures: true,
    });

    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });
  };

  return (
    <div className="flex-1 min-h-0 relative bg-[#181a26]">
      <Editor
        height="100%"
        defaultLanguage="typescript"
        value={fileContents[selectedFile] || ''}
        onChange={(value) => {
          if (value !== undefined) {
            setFileContents((prev) => ({
              ...prev,
              [selectedFile]: value,
            }));
            broadcastFileEdit(selectedFile, value);
          }
        }}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        loading={
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c0d12] text-xs text-neutral-400 font-mono gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            Mounting Collaborative Sandbox Editor...
          </div>
        }
      />

      <div className="absolute top-4 right-4 pointer-events-none z-10 flex flex-col items-end gap-1 font-mono text-[9px] select-none">
        {teamMembers.filter(m => m.status !== 'offline' && m.id !== 'm-1').map(m => (
          <div key={m.id} className="flex items-center gap-1.5 bg-[#0e0f16]/95 border border-sys-border text-indigo-400 px-2.5 py-1 rounded-full backdrop-blur-sm shadow-lg animate-fadeIn font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{m.name.split(' ')[0]} : editing</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-[#0e0f16]/90 border border-sys-border rounded-xl p-3 shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500" />
          <form onSubmit={handleAskAgent} className="flex gap-2.5 items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask Convene Agent to refactor, write helper functions or debug..."
                disabled={isAgentResponding}
                className="w-full pl-9 pr-3 py-2 bg-[#08090d] border border-sys-border/60 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isAgentResponding || !aiPrompt.trim()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              {isAgentResponding ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Thinking...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Ask Copilot</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});
