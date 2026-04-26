'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '@/store/agent';
import { useAgent } from '@/hooks/useAgent';
import { MessageBubble, StreamingBubble } from './MessageBubble';
import { FloatingInput } from './FloatingInput';
import { ActivityTimeline } from '@/components/agent/ActivityTimeline';

const SUGGESTION_CHIPS = [
  { icon: '🔍', text: 'Research a topic in depth' },
  { icon: '💻', text: 'Write and run code for me' },
  { icon: '📊', text: 'Analyze a dataset' },
  { icon: '✍️', text: 'Draft a document or report' },
  { icon: '🌐', text: 'Browse the web and summarize' },
  { icon: '🎯', text: 'Create a project plan' },
];

export function ChatWorkspace() {
  const { messages, streamingText, isStreaming } = useAgentStore();
  const { sendMessage } = useAgent();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Listen for recipe run events (dispatched from settings)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ prompt: string }>;
      if (ce.detail?.prompt) sendMessage(ce.detail.prompt);
    };
    window.addEventListener('nexus:run-recipe', handler);
    return () => window.removeEventListener('nexus:run-recipe', handler);
  }, [sendMessage]);

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-full bg-[#272728]">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center min-h-full px-6 py-16"
          >
            <h1 className="text-3xl font-semibold text-[#dadada] mb-2 text-center">
              What can I do for you?
            </h1>
            <p className="text-sm text-[#7f7f7f] mb-10 text-center">
              Your autonomous AI agent — plan, research, code, and execute.
            </p>

            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTION_CHIPS.map(chip => (
                <button
                  key={chip.text}
                  onClick={() => sendMessage(chip.text)}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1e1e1f] border border-[rgba(255,255,255,0.08)] text-left hover:border-[rgba(255,255,255,0.16)] hover:bg-[#252527] transition-all group"
                >
                  <span className="text-base shrink-0">{chip.icon}</span>
                  <span className="text-sm text-[#acacac] group-hover:text-[#dadada] transition-colors leading-snug">{chip.text}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="px-6 py-6 space-y-4 max-w-3xl mx-auto w-full">
            <AnimatePresence>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </AnimatePresence>

            {isStreaming && streamingText && (
              <StreamingBubble text={streamingText} />
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ActivityTimeline />
      <FloatingInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
