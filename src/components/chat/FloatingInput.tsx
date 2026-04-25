'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Send, Zap, Paperclip, Mic, MicOff, Search, Clock, ChevronDown, Globe, Mail, FolderOpen } from 'lucide-react';
import { useAgentStore } from '@/store/agent';
import { AgentMode } from '@/types';

interface FloatingInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string; message?: string }) => void) | null;
  onstart: (() => void) | null;
}

const CONNECTOR_ICONS: Record<string, React.ElementType> = {
  browser: Globe,
  gmail: Mail,
  gdrive: FolderOpen,
  'gdrive-picker': FolderOpen,
};

const MODE_ICONS: Record<AgentMode, React.ElementType> = {
  normal: Zap,
  research: Search,
  background: Clock,
};

const MODE_COLORS: Record<AgentMode, string> = {
  normal: '#1a93fe',
  research: '#A855F7',
  background: '#06B6D4',
};

export function FloatingInput({ onSend, disabled, placeholder }: FloatingInputProps) {
  const [value, setValue] = useState('');
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseValueRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { agentMode, setAgentMode, connectors, openSettings } = useAgentStore();
  const visibleConnectors = connectors.slice(0, 6);
  const ModeIcon = MODE_ICONS[agentMode];
  const modeColor = MODE_COLORS[agentMode];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance };
    if (W.SpeechRecognition ?? W.webkitSpeechRecognition) setSpeechSupported(true);
  }, []);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    const final = uploadedName ? `${trimmed}\n\n[Attached: ${uploadedName}]` : trimmed;
    onSend(final);
    setValue('');
    setUploadedName(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  async function toggleMic() {
    setMicError(null);
    if (!speechSupported) {
      setMicError('Speech recognition not supported in this browser. Try Chrome or Safari.');
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }

    // Proactively request mic permission so we can show a clear error
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // we only needed the prompt
      } catch (err) {
        setMicError(err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Allow it in your browser settings.'
          : 'Could not access microphone.');
        return;
      }
    }

    const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;

    // Snapshot the text BEFORE recording starts so we can REPLACE not APPEND
    baseValueRef.current = value;

    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      // Walk all results and concatenate; replace transcript portion of value
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const base = baseValueRef.current;
      const combined = base ? `${base.replace(/\s+$/, '')} ${transcript}` : transcript;
      setValue(combined);
      requestAnimationFrame(handleInput);
    };

    rec.onstart = () => setRecording(true);
    rec.onend = () => setRecording(false);
    rec.onerror = (e) => {
      setRecording(false);
      const code = e?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setMicError('Microphone permission denied.');
      } else if (code === 'no-speech') {
        // benign, just stop quietly
      } else if (code) {
        setMicError(`Mic error: ${code}`);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Failed to start recording.');
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/sandbox', { method: 'POST', body: fd });
      const data = await r.json();
      if (data.name) setUploadedName(data.name);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const placeholderText = placeholder ?? (
    agentMode === 'research' ? 'What should I research?' :
    agentMode === 'background' ? 'Describe a task to run in the background…' :
    'What do you want Nexus to do?'
  );

  return (
    <div className="px-4 pb-4 pt-2">
      {/* Attached file badge */}
      {uploadedName && (
        <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(26,147,254,0.10)] border border-[rgba(26,147,254,0.20)] text-[#1a93fe] text-xs">
          <Paperclip className="w-3 h-3" />
          <span className="font-mono flex-1 truncate">{uploadedName}</span>
          <button onClick={() => setUploadedName(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Mode menu */}
      <AnimatePresence>
        {showModeMenu && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mb-2 bg-[#383739] border border-[rgba(255,255,255,0.10)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-1.5 space-y-0.5"
          >
            {(['normal', 'research', 'background'] as AgentMode[]).map(mode => {
              const Icon = MODE_ICONS[mode];
              const labels = { normal: 'Normal', research: 'Research', background: 'Background' };
              const descs = { normal: 'Standard agent with tools', research: 'Deep web research', background: 'Runs after you close the tab' };
              return (
                <button
                  key={mode}
                  onClick={() => { setAgentMode(mode); setShowModeMenu(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                    agentMode === mode ? 'bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[rgba(255,255,255,0.04)]',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" style={{ color: MODE_COLORS[mode] }} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#dadada]">{labels[mode]}</div>
                    <div className="text-[10px] text-[#7f7f7f]">{descs[mode]}</div>
                  </div>
                  {agentMode === mode && <div className="w-1.5 h-1.5 rounded-full bg-[#1a93fe]" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connector bar */}
      <AnimatePresence>
        {showConnectors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              {visibleConnectors.map(c => {
                const Icon = CONNECTOR_ICONS[c.id] ?? Globe;
                return (
                  <button
                    key={c.id}
                    onClick={() => openSettings('connectors')}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors hover:opacity-80',
                      c.connected
                        ? 'bg-[rgba(26,147,254,0.10)] border-[rgba(26,147,254,0.25)] text-[#1a93fe]'
                        : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] text-[#7f7f7f]',
                    )}>
                    <span className="text-xs">{c.icon}</span>
                    <Icon className="w-3 h-3" />
                    <span>{c.name}</span>
                    {c.connected && <span className="w-1.5 h-1.5 rounded-full bg-[#25ba3b]" />}
                  </button>
                );
              })}
              <button
                onClick={() => openSettings('connectors')}
                className="text-xs text-[#1a93fe] px-2 py-1 hover:opacity-80"
              >
                Manage…
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input box */}
      <div className={cn(
        'bg-[#1e1e1f] border rounded-2xl transition-all',
        value && !disabled ? 'border-[rgba(255,255,255,0.16)]' : 'border-[rgba(255,255,255,0.08)]',
      )}>
        <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholderText}
          className="w-full bg-transparent outline-none text-sm text-[#dadada] leading-relaxed px-4 pt-3.5 pb-2 resize-none max-h-[180px] overflow-auto placeholder:text-[#5f5f5f]"
        />

        {/* Bottom toolbar */}
        <div className="flex items-center gap-1 px-3 pb-2.5">
          {/* Mode button */}
          <button
            onClick={() => { setShowModeMenu(v => !v); setShowConnectors(false); }}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors',
              showModeMenu ? 'bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[rgba(255,255,255,0.06)]',
            )}
          >
            <ModeIcon className="w-3.5 h-3.5" style={{ color: modeColor }} />
            <span style={{ color: modeColor }} className="font-medium capitalize">{agentMode}</span>
          </button>

          {/* Connectors button */}
          <button
            onClick={() => { setShowConnectors(v => !v); setShowModeMenu(false); }}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
              showConnectors ? 'bg-[rgba(255,255,255,0.08)] text-[#dadada]' : 'text-[#7f7f7f] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#acacac]',
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Connect</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', showConnectors && 'rotate-180')} />
          </button>

          {/* File attach */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
            className="p-1.5 rounded-lg text-[#7f7f7f] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#acacac] transition-colors"
          >
            <Paperclip className={cn('w-3.5 h-3.5', uploading && 'animate-pulse')} />
          </button>

          {/* Mic */}
          <button
            onClick={toggleMic}
            disabled={!speechSupported}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              recording ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-[#7f7f7f] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#acacac]',
              !speechSupported && 'opacity-30 cursor-not-allowed',
            )}
          >
            {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <div className="flex-1" />

          {/* Send */}
          <motion.button
            whileHover={!disabled && value.trim() ? { scale: 1.05 } : undefined}
            whileTap={!disabled && value.trim() ? { scale: 0.95 } : undefined}
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
              value.trim() && !disabled
                ? 'bg-[#1a93fe] text-white shadow-[0_0_12px_rgba(26,147,254,0.3)]'
                : 'bg-[rgba(255,255,255,0.06)] text-[#5f5f5f]',
            )}
          >
            {disabled
              ? <Zap className="w-3.5 h-3.5 animate-pulse" />
              : agentMode === 'background' ? <Clock className="w-3.5 h-3.5" />
              : agentMode === 'research' ? <Search className="w-3.5 h-3.5" />
              : <Send className="w-3.5 h-3.5" />
            }
          </motion.button>
        </div>
      </div>

      <div className="text-center mt-1.5">
        <span className="text-[10px] text-[#5f5f5f]">
          Enter to send · Shift+Enter for newline
          {recording && ' · 🔴 Listening'}
        </span>
        {micError && (
          <div className="mt-1 text-[10px] text-[#f25a5a]">{micError}</div>
        )}
      </div>
    </div>
  );
}
