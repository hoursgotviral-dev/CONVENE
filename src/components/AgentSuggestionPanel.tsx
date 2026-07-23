import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Sparkles, X, Check } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

interface AgentSuggestionPanelProps {
  editorRef: React.MutableRefObject<any>;
}

export const AgentSuggestionPanel: React.FC<AgentSuggestionPanelProps> = ({ editorRef }) => {
  const { currentProposal, setCurrentProposal, selectedFile, fileContents, setFileContents, broadcastFileEdit } = useWorkspace();
  const shouldReduceMotion = useReducedMotion();

  const applyProposal = () => {
    if (!currentProposal) return;
    const currentCode = fileContents[selectedFile] || '';

    let newCode = currentCode;
    const target = currentProposal.targetLines;
    const replacement = currentProposal.suggestedCode;

    if (target && currentCode.includes(target)) {
      newCode = currentCode.replace(target, replacement);
    } else {
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        const selectedText = editorRef.current.getModel().getValueInRange(selection);
        if (selectedText && selectedText.trim()) {
          const range = new (window as any).monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          );
          editorRef.current.executeEdits('agent', [
            { range, text: replacement, forceMoveMarkers: true }
          ]);
          newCode = editorRef.current.getValue();
        } else {
          newCode = currentCode + '\n\n' + replacement;
        }
      } else {
        newCode = currentCode + '\n\n' + replacement;
      }
    }

    setFileContents((prev) => ({
      ...prev,
      [selectedFile]: newCode,
    }));
    broadcastFileEdit(selectedFile, newCode);
    setCurrentProposal(null);
  };

  return (
    <AnimatePresence>
      {currentProposal && (
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20, scale: shouldReduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 15, scale: shouldReduceMotion ? 1 : 0.98 }}
          transition={{ type: 'spring', stiffness: 350, damping: 24 }}
          className="absolute bottom-4 left-4 right-4 bg-[#0e1017]/95 border-2 border-dashed border-indigo-500/40 rounded-xl p-4 shadow-2xl z-20 backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">
                  AI Proposal from: {currentProposal.agentName}
                </span>
                <p className="text-xs text-neutral-300 mt-1 leading-normal font-sans">
                  {currentProposal.explanation}
                </p>
              </div>
            </div>
            <button
              onClick={() => setCurrentProposal(null)}
              className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <pre className="p-3 bg-[#07080b] border border-sys-border rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-32">
              {currentProposal.suggestedCode}
            </pre>
          </div>

          <div className="mt-3.5 flex items-center justify-between border-t border-sys-border/50 pt-3">
            <span className="text-[10px] font-mono text-neutral-500">
              Unsaved proposal edits.
            </span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setCurrentProposal(null)}
                className="px-3 py-1.5 text-xs bg-transparent hover:bg-neutral-800 border border-sys-border text-neutral-400 hover:text-white rounded-lg transition-all cursor-pointer font-semibold"
              >
                Reject
              </button>
              <button
                onClick={applyProposal}
                className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Patch</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
