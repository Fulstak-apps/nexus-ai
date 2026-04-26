'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Message, ToolCall } from '@/types';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn, formatTime } from '@/lib/utils';
import { ChevronDown, ChevronRight, User, Brain, Terminal } from 'lucide-react';
import { MarkdownBody } from './MarkdownBody';
import { MessageActions } from './MessageActions';

interface MessageBubbleProps {
  message: Message;
}

function ToolCallBadge({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="flex items-start gap-2 w-full text-left"
    >
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-teal/10 border border-accent-teal/20">
        <Terminal className="w-3 h-3 text-accent-teal" />
        <span className="text-[10px] font-mono font-medium text-accent-teal">{call.tool}</span>
        {open ? <ChevronDown className="w-2.5 h-2.5 text-accent-teal" /> : <ChevronRight className="w-2.5 h-2.5 text-accent-teal" />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 text-[10px] font-mono bg-black/5 dark:bg-white/5 rounded p-2 overflow-auto max-h-32 text-left"
          >
            {JSON.stringify(call.params, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>
    </button>
  );
}

function ReasoningSection({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] opacity-50 hover:opacity-80 transition-opacity"
      >
        <Brain className="w-3 h-3" />
        <span>Reasoning</span>
        {open ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 text-xs italic opacity-60 border-l-2 border-accent-purple/40 pl-2"
          >
            {reasoning}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1',
        isUser
          ? 'bg-gradient-to-br from-accent-blue to-accent-purple'
          : 'bg-gradient-to-br from-accent-teal to-accent-blue',
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Brain className="w-3.5 h-3.5 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        <GlassPanel
          variant={isUser ? 'elevated' : 'default'}
          className={cn(
            'px-4 py-3',
            isUser && 'bg-gradient-to-br from-accent-blue/20 to-accent-purple/10 border-accent-blue/20',
          )}
        >
          {/* Tool calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-1 mb-2">
              {message.toolCalls.map(call => (
                <ToolCallBadge key={call.id} call={call} />
              ))}
            </div>
          )}

          {/* Message text — markdown for assistant, plain for user */}
          {isUser
            ? <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
            : <MarkdownBody>{message.content}</MarkdownBody>
          }

          {/* Reasoning */}
          {message.reasoning && <ReasoningSection reasoning={message.reasoning} />}
        </GlassPanel>

        {/* Action toolbar */}
        <MessageActions message={message} />

        {/* Timestamp */}
        <div className={cn('text-[10px] opacity-30 px-1', isUser ? 'text-right' : 'text-left')}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </motion.div>
  );
}

export function StreamingBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-teal to-accent-blue flex items-center justify-center shrink-0 mt-1">
        <Brain className="w-3.5 h-3.5 text-white animate-pulse" />
      </div>
      <GlassPanel className="max-w-[75%] px-4 py-3">
        <div className="text-sm leading-relaxed">
          <MarkdownBody>{text}</MarkdownBody>
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="inline-block w-0.5 h-4 bg-accent-blue ml-0.5 align-text-bottom"
          />
        </div>
      </GlassPanel>
    </motion.div>
  );
}
