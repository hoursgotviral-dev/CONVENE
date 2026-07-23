import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { SamanvayMark } from './SamanvayMark';
import { Copy, Check, ArrowRight, Plus, LogIn, User, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LandingPage: React.FC = () => {
  const { 
    createRoom, 
    joinRoom, 
    displayName: contextDisplayName,
    setDisplayName: setContextDisplayName,
    authenticatedUserEmail 
  } = useWorkspace();

  const [name, setName] = useState(contextDisplayName || '');
  const [roomInput, setRoomInput] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setNameError(false);
    if (!name.trim()) {
      setNameError(true);
      setError('Please enter a display name first.');
      return;
    }

    setLoading(true);
    const result = await createRoom(name.trim());
    setLoading(false);

    if (result.success && result.code) {
      setCreatedRoomCode(result.code);
    } else {
      setError(result.error || 'Failed to create room. Please try again.');
    }
  };

  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setNameError(false);
    
    if (!name.trim()) {
      setNameError(true);
      setError('Please enter a display name first.');
      return;
    }

    const code = roomInput.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }

    setLoading(true);
    const result = await joinRoom(code, name.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Room not found — check the code and try again.');
    }
  };

  const handleCopy = () => {
    if (createdRoomCode) {
      navigator.clipboard.writeText(createdRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnterWorkspace = () => {
    if (createdRoomCode) {
      // Joins the created room workspace
      joinRoom(createdRoomCode, name.trim());
    }
  };

  const isJoinDisabled = roomInput.trim().length !== 6 || loading;

  return (
    <div className="min-h-screen bg-[#0D0E12] text-neutral-100 flex flex-col justify-between p-4 md:p-8 relative overflow-hidden font-sans select-none">
      
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-4 z-10">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/5 border border-white/10 rounded-2xl shadow-lg">
            <SamanvayMark className="w-8 h-8" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold font-display tracking-[0.2em] text-white uppercase leading-none">
              SAMANVAY
            </span>
            <span className="text-[9px] font-mono text-indigo-400 font-medium tracking-widest mt-1">
              COORDINATION MATRIX
            </span>
          </div>
        </div>
        
        {authenticatedUserEmail && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-neutral-400">
              {authenticatedUserEmail}
            </span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto my-8 z-10">
        
        {/* Brand Banner / Title */}
        <div className="text-center mb-10 max-w-xl">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white mb-3"
          >
            Human-Agent Orchestration
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-neutral-400 text-sm md:text-base leading-relaxed"
          >
            Coordinate in real time with autonomous cognitive agents to plan, estimate, cost, and execute software.
          </motion.p>
        </div>

        {/* Display Name Step */}
        <div className="w-full max-w-md bg-white/[0.02] border border-white/5 p-5 rounded-2xl mb-8 shadow-2xl backdrop-blur-lg">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              1. Your Display Name
            </label>
            {name.trim() && (
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                <Check className="w-2.5 h-2.5" /> Ready
              </span>
            )}
          </div>
          
          <div className="relative">
            <input 
              type="text" 
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
                setError(null);
                setContextDisplayName(e.target.value);
              }}
              placeholder="e.g. Lead Architect, Sarah Connor"
              className={`w-full bg-[#14151B] border rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 transition-all ${
                nameError 
                  ? 'border-rose-500/50 focus:ring-rose-500/50' 
                  : 'border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/30'
              }`}
              maxLength={25}
            />
          </div>
          <p className="text-[10px] text-neutral-500 mt-2 font-sans">
            This name identifies you in the workspace sidebar, chats, and active cursor indicators.
          </p>
        </div>

        {/* Dynamic State: Room Created Screen */}
        <AnimatePresence mode="wait">
          {createdRoomCode ? (
            <motion.div 
              key="created"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white/[0.02] border border-indigo-500/20 p-8 rounded-2xl shadow-2xl text-center backdrop-blur-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
              
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
                <Sparkles className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-bold font-display text-white mb-1">
                Room Initialized Successfully
              </h2>
              <p className="text-neutral-400 text-xs mb-6">
                Your collaboration room has been generated and is ready.
              </p>

              {/* Large Room Code Display */}
              <div className="bg-[#14151B] border border-white/5 rounded-2xl p-5 mb-4 relative group">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-2">
                  Room Access Code
                </span>
                <div className="font-mono text-3xl font-bold tracking-[0.2em] text-white select-all">
                  {createdRoomCode}
                </div>
              </div>

              {/* Copy and Actions */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-4 rounded-lg border border-white/10 hover:border-white/20 transition-all text-sm cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied Code!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-indigo-400" />
                      <span>Copy Room Code</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleEnterWorkspace}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-indigo-600/15 transition-all text-sm cursor-pointer"
                >
                  <span>Launch Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[10px] text-neutral-500 mt-5">
                Share this 6-character code with your team to let them join this active session.
              </p>
            </motion.div>
          ) : (
            /* Portals Side-by-Side */
            <motion.div 
              key="portals"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {/* Portal A: Create Room */}
              <div className="bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-6 md:p-8 flex flex-col justify-between transition-all group relative overflow-hidden">
                {/* Visual Motif: Generative pattern overlay */}
                <div className="absolute top-[-10%] right-[-10%] w-[120px] h-[120px] bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
                
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-indigo-400 font-mono text-xs font-bold uppercase tracking-widest">
                      PORTAL 01
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" />
                  </div>
                  
                  <h3 className="text-xl font-bold font-display text-white mb-2 flex items-center gap-2">
                    Create a room
                  </h3>
                  <p className="text-neutral-400 text-xs leading-relaxed mb-6">
                    Initialize a fresh human-agent workspace and obtain a unique, shareable room code for your teammates.
                  </p>
                </div>

                <div className="mt-4">
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 text-white font-bold py-3 px-4 rounded-lg transition-all text-sm cursor-pointer group-hover:bg-indigo-600/10 group-hover:border-indigo-600/30"
                  >
                    <Plus className="w-4 h-4 text-indigo-400" />
                    <span>{loading ? 'Initializing...' : 'Create Room'}</span>
                  </button>
                </div>
              </div>

              {/* Portal B: Join Room */}
              <div className="bg-[#111218] border border-white/5 focus-within:border-indigo-500/20 rounded-2xl p-6 md:p-8 flex flex-col justify-between transition-all group relative overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[120px] h-[120px] bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-indigo-400 font-mono text-xs font-bold uppercase tracking-widest">
                      PORTAL 02
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" />
                  </div>
                  
                  <h3 className="text-xl font-bold font-display text-white mb-2">
                    Join a room
                  </h3>
                  <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                    Enter an active 6-character room access code shared by your project team to instantly participate.
                  </p>
                </div>

                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={roomInput}
                      onChange={(e) => {
                        setRoomInput(e.target.value.toUpperCase().slice(0, 6));
                        setError(null);
                      }}
                      placeholder="ENTER CODE"
                      className="w-full bg-[#181920] border border-white/5 rounded-lg px-4 py-3 text-center text-sm font-mono tracking-[0.3em] uppercase text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                      maxLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isJoinDisabled}
                    className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition-all text-sm cursor-pointer ${
                      isJoinDisabled 
                        ? 'bg-white/5 text-neutral-500 border border-transparent cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                    }`}
                  >
                    {loading ? (
                      <span>Validating...</span>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Join Room</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Errors and Validations */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 flex items-center gap-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-4 py-3 rounded-2xl text-xs max-w-md w-full"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Footer / System Credits */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between py-4 border-t border-white/5 text-[10px] font-mono text-neutral-600 gap-2 mt-8 z-10">
        <div>
          &copy; {new Date().getFullYear()} SAMANVAY SYSTEM. ALL SERVICES NOMINAL.
        </div>
        <div className="flex items-center gap-4">
          <span>SECURED CHANNELS</span>
          <span>&middot;</span>
          <span>AGENT DEPLOYMENTS ACTIVE</span>
        </div>
      </footer>
    </div>
  );
};
