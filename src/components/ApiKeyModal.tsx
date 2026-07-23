import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { X, Key, ShieldAlert, CheckCircle, ExternalLink, Trash2 } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const { apiKeysStatus, saveApiKey, disconnectApiKey } = useWorkspace();
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [keyInput, setKeyInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!keyInput.trim()) {
      setValidationError('API key cannot be empty.');
      return;
    }

    if (keyInput.trim().length < 15) {
      setValidationError('Please enter a valid-looking API key.');
      return;
    }

    setSaving(true);
    const success = await saveApiKey(provider, keyInput.trim());
    setSaving(false);
    
    // Clear raw key from React local state immediately!
    setKeyInput('');

    if (success) {
      onClose();
    } else {
      setValidationError('Failed to store API Key securely on server.');
    }
  };

  const handleDisconnect = async () => {
    await disconnectApiKey();
    setKeyInput('');
    setValidationError('');
  };

  const getDocLink = () => {
    switch (provider) {
      case 'openai': return 'https://platform.openai.com/api-keys';
      case 'anthropic': return 'https://console.anthropic.com/settings/keys';
      case 'gemini':
      default:
        return 'https://aistudio.google.com/apikey';
    }
  };

  return (
    <div id="api-key-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-dark/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-sys-panel border border-sys-border rounded-2xl shadow-2xl shadow-black overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-sys-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-human" />
            <span className="text-sm font-bold font-display text-white">LLM Provider Configuration</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-bg-dark/50 transition-colors cursor-pointer bg-transparent border-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="px-6 py-3 border-b border-sys-border bg-bg-dark/30">
          {apiKeysStatus.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-semibold text-emerald-400 block">Connected Securely</span>
                  <p className="text-[10px] text-neutral-500">
                    Active provider: <span className="font-mono text-neutral-300 font-semibold">{apiKeysStatus.provider?.toUpperCase()}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 hover:border-rose-800 text-rose-400 rounded-lg transition-colors cursor-pointer font-medium"
              >
                <Trash2 className="w-3 h-3" />
                Disconnect Key
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-agent shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-agent block font-display">Not Connected (Demo Mode)</span>
                <p className="text-[10px] text-neutral-400">
                  Using smart backend simulations. Connect a provider key below to trigger live LLM refactoring.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-400 block font-display uppercase tracking-wider">
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as any);
                setValidationError('');
              }}
              className="w-full px-3 py-2 bg-bg-dark border border-sys-border rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-human focus:border-human transition-all font-sans cursor-pointer"
            >
              <option value="gemini">Google Gemini (Recommended)</option>
              <option value="openai">OpenAI (GPT Models)</option>
              <option value="anthropic">Anthropic (Claude Models)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-400 block font-display uppercase tracking-wider">
                API Key
              </label>
              <a 
                href={getDocLink()} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-human hover:underline flex items-center gap-1"
              >
                Get API Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setValidationError('');
                }}
                placeholder={`Paste your secret ${provider} key...`}
                className="w-full px-3 py-2.5 bg-bg-dark border border-sys-border rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-human focus:border-human transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white transition-colors cursor-pointer bg-transparent border-none"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            {validationError && (
              <p className="text-[10px] text-rose-400 font-mono mt-1">{validationError}</p>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-sys-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs bg-bg-dark hover:bg-bg-dark/80 border border-sys-border text-neutral-400 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs bg-human hover:bg-human/90 text-white font-bold rounded-lg shadow-lg shadow-human/10 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {saving ? 'Connecting...' : 'Save Keys'}
            </button>
          </div>
        </form>

        {/* Footer info banner */}
        <div className="px-6 py-4 bg-bg-dark border-t border-sys-border text-[10px] text-neutral-500 leading-normal font-sans font-medium">
          Keys are loaded entirely in-memory and proxied through our secure cloud server. We never log or cache secret keys.
        </div>
      </div>
    </div>
  );
};
