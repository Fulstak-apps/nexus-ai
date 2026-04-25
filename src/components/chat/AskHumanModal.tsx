'use client';

import { useState, useEffect } from 'react';
import { useAgentStore } from '@/store/agent';
import { useAgent } from '@/hooks/useAgent';
import { HelpCircle, X, Send } from 'lucide-react';

export function AskHumanModal() {
  const { pendingQuestion, setPendingQuestion } = useAgentStore();
  const { sendMessage } = useAgent();
  const [reply, setReply] = useState('');

  useEffect(() => { setReply(''); }, [pendingQuestion]);

  if (!pendingQuestion) return null;

  const submit = (text: string) => {
    if (!text.trim()) return;
    setPendingQuestion(null);
    sendMessage(text);
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[480px] rounded-2xl border border-sky-500/30 bg-[#1a1a1c] p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2">
            <HelpCircle size={18} className="text-sky-400 mt-0.5" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-400/70">Agent question</div>
              <h2 className="text-base font-semibold text-white mt-0.5">{pendingQuestion.question}</h2>
            </div>
          </div>
          <button onClick={() => setPendingQuestion(null)} className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>

        {pendingQuestion.options && pendingQuestion.options.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {pendingQuestion.options.map((opt) => (
              <button
                key={opt}
                onClick={() => submit(opt)}
                className="rounded-full border border-white/15 bg-white/5 hover:bg-sky-500/20 hover:border-sky-500/40 px-3 py-1.5 text-sm text-white/80 hover:text-white transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        <textarea
          autoFocus
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(reply);
          }}
          placeholder="Type your reply… (⌘↵ to send)"
          rows={3}
          className="w-full rounded-lg bg-white/5 border border-white/10 focus:border-sky-500/50 outline-none p-3 text-sm text-white placeholder:text-white/40 resize-none"
        />

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => setPendingQuestion(null)}
            className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white"
          >
            Skip
          </button>
          <button
            onClick={() => submit(reply)}
            disabled={!reply.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 text-sm font-medium text-white"
          >
            <Send size={13} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
