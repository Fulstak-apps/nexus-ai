'use client';

import { useState } from 'react';
import { useAgentStore } from '@/store/agent';
import { cn } from '@/lib/utils';
import { ChevronDown, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export const MODELS = [
  { id: 'lite' as const, label: 'Qwen 3.5 (4B)',    tag: 'Fast',      ollamaId: 'qwen3.5:4b' },
  { id: 'pro'  as const, label: 'Gemma 4 (8B)',     tag: 'Default',   ollamaId: 'gemma4:e4b' },
  { id: 'max'  as const, label: 'Qwen3 Coder 30B',  tag: 'Max',       ollamaId: 'qwen3-coder:30b' },
];

export function TopBar() {
  const { usageStats, openSettings, userProfile, selectedModelId, setSelectedModel } = useAgentStore();
  const [showModelMenu, setShowModelMenu] = useState(false);

  const selectedModel = MODELS.find(m => m.id === selectedModelId) ?? MODELS[1];
  const remaining = Math.max(0, usageStats.creditsTotal - usageStats.creditsUsed);

  const initials = userProfile.name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-11 flex items-center justify-between px-3 shrink-0 bg-[#212122] border-b border-[rgba(255,255,255,0.06)]">

      {/* Left: model picker */}
      <div className="relative">
        <button
          onClick={() => setShowModelMenu(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <span className="text-sm font-medium text-[#dadada]">{selectedModel.label}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-[#7f7f7f] transition-transform', showModelMenu && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {showModelMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-1 w-52 bg-[#383739] border border-[rgba(255,255,255,0.10)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50 overflow-hidden p-1"
              >
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModelMenu(false); }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                      selectedModel.id === m.id
                        ? 'bg-[rgba(255,255,255,0.08)]'
                        : 'hover:bg-[rgba(255,255,255,0.04)]',
                    )}
                  >
                    <span className="text-sm text-[#dadada]">{m.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[#acacac]">{m.tag}</span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Right: credits + avatar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => openSettings('usage')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          title={`${usageStats.creditsUsed} used · ${remaining} remaining`}
        >
          <Zap className="w-3.5 h-3.5 text-[#1a93fe]" />
          <span className="text-sm font-medium text-[#dadada]">{remaining.toLocaleString()}</span>
        </button>

        <button
          onClick={() => openSettings('account')}
          className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1a93fe] to-[#A855F7] flex items-center justify-center hover:opacity-90 transition-opacity text-white text-[10px] font-bold"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
