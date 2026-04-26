'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Volume2, RefreshCw, Square } from 'lucide-react';
import { Message } from '@/types';
import { useAgent } from '@/hooks/useAgent';
import { useAgentStore } from '@/store/agent';

export function MessageActions({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { sendMessage } = useAgent();

  useEffect(() => () => {
    if (typeof window !== 'undefined' && utterRef.current) {
      window.speechSynthesis?.cancel();
    }
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const handleSpeak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = message.content
      .replace(/```[\s\S]*?```/g, '. Code block omitted.')
      .replace(/[*_`#~>\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const handleRegenerate = () => {
    // Rerun the previous user message
    const sid = useAgentStore.getState().activeSessionId;
    if (!sid) return;
    const msgs = useAgentStore.getState().messagesBySession[sid] ?? [];
    const idx = msgs.findIndex(m => m.id === message.id);
    if (idx === -1) return;
    // Find last user message before this assistant msg
    const userMsg = [...msgs.slice(0, idx)].reverse().find(m => m.role === 'user');
    if (userMsg) sendMessage(userMsg.content);
  };

  const isAssistant = message.role === 'assistant';

  return (
    <div className="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        title="Copy message"
        className="p-1 rounded text-[#7f7f7f] hover:text-[#dadada] hover:bg-white/5"
      >
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      </button>

      {isAssistant && (
        <button
          onClick={handleSpeak}
          title={speaking ? 'Stop' : 'Read aloud'}
          className="p-1 rounded text-[#7f7f7f] hover:text-[#dadada] hover:bg-white/5"
        >
          {speaking ? <Square size={12} className="text-sky-500" /> : <Volume2 size={12} />}
        </button>
      )}

      {isAssistant && (
        <button
          onClick={handleRegenerate}
          title="Regenerate response"
          className="p-1 rounded text-[#7f7f7f] hover:text-[#dadada] hover:bg-white/5"
        >
          <RefreshCw size={12} />
        </button>
      )}

      {message.tokens && (
        <span className="ml-1.5 text-[9px] text-[#5f5f5f] font-mono">
          {message.tokens.input}↑ {message.tokens.output}↓
        </span>
      )}
    </div>
  );
}
