'use client';

import { useState } from 'react';
import { useAgentStore } from '@/store/agent';
import { cn } from '@/lib/utils';
import { ChevronDown, Zap, Cpu, Cloud, Sparkles, KeyRound } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Provider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'groq';

interface ModelEntry {
  provider: Provider;
  id: string;
  label: string;
  badge?: string;
}

// Curated list. Users can override via env if they want a different model.
export const PROVIDER_MODELS: Record<Provider, ModelEntry[]> = {
  ollama: [
    { provider: 'ollama', id: 'qwen3.5:4b',      label: 'Qwen 3.5 (4B)',     badge: 'Fast' },
    { provider: 'ollama', id: 'gemma4:e4b',      label: 'Gemma 4 (8B)',      badge: 'Default' },
    { provider: 'ollama', id: 'qwen3-coder:30b', label: 'Qwen3 Coder 30B',   badge: 'Max' },
    { provider: 'ollama', id: 'deepseek-r1:8b',  label: 'DeepSeek R1 (8B)',  badge: 'Reasoning' },
    { provider: 'ollama', id: 'deepseek-r1:14b', label: 'DeepSeek R1 (14B)', badge: 'Reasoning' },
  ],
  openai: [
    { provider: 'openai', id: 'gpt-4o',       label: 'GPT-4o',       badge: 'Flagship' },
    { provider: 'openai', id: 'gpt-4o-mini',  label: 'GPT-4o mini',  badge: 'Fast' },
    { provider: 'openai', id: 'gpt-4.1',      label: 'GPT-4.1',      badge: 'New' },
    { provider: 'openai', id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', badge: 'Fast' },
    { provider: 'openai', id: 'o3-mini',      label: 'o3-mini',      badge: 'Reasoning' },
  ],
  anthropic: [
    { provider: 'anthropic', id: 'claude-sonnet-4-5',     label: 'Claude Sonnet 4.5', badge: 'Default' },
    { provider: 'anthropic', id: 'claude-opus-4-5',       label: 'Claude Opus 4.5',   badge: 'Max' },
    { provider: 'anthropic', id: 'claude-haiku-4-5',      label: 'Claude Haiku 4.5',  badge: 'Fast' },
  ],
  gemini: [
    { provider: 'gemini', id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', badge: 'Fast' },
    { provider: 'gemini', id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   badge: 'Default' },
    { provider: 'gemini', id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro',   badge: 'Stable' },
  ],
  groq: [
    { provider: 'groq', id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', badge: 'Default' },
    { provider: 'groq', id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  badge: 'Instant' },
    { provider: 'groq', id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',  badge: 'Long-ctx' },
  ],
};

const PROVIDER_META: Record<Provider, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; keyName: 'openai' | 'anthropic' | 'gemini' | 'groq' | null }> = {
  ollama:    { label: 'Ollama',    icon: Cpu,       color: 'text-emerald-500', keyName: null },
  openai:    { label: 'OpenAI',    icon: Sparkles,  color: 'text-sky-500',     keyName: 'openai' },
  anthropic: { label: 'Anthropic', icon: Cloud,     color: 'text-amber-500',   keyName: 'anthropic' },
  gemini:    { label: 'Gemini',    icon: Cloud,     color: 'text-violet-500',  keyName: 'gemini' },
  groq:      { label: 'Groq',      icon: Cloud,     color: 'text-pink-500',    keyName: 'groq' },
};

export function TopBar() {
  const { usageStats, openSettings, userProfile, llmProvider, llmModel, setLLM, apiKeys } = useAgentStore();
  const [showModelMenu, setShowModelMenu] = useState(false);

  const all: ModelEntry[] = Object.values(PROVIDER_MODELS).flat();
  const current = all.find(m => m.provider === llmProvider && m.id === llmModel)
    ?? PROVIDER_MODELS.ollama[1];

  const remaining = Math.max(0, usageStats.creditsTotal - usageStats.creditsUsed);

  const initials = userProfile.name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const providerHasKey = (p: Provider) => {
    const meta = PROVIDER_META[p];
    if (!meta.keyName) return true;
    return Boolean(apiKeys[meta.keyName]);
  };

  return (
    <header className="h-11 flex items-center justify-between px-3 shrink-0 bg-[#212122] border-b border-[rgba(255,255,255,0.06)]">

      {/* Left: model picker */}
      <div className="relative">
        <button
          onClick={() => setShowModelMenu(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          {(() => { const I = PROVIDER_META[llmProvider].icon; return <I size={14} className={PROVIDER_META[llmProvider].color} />; })()}
          <span className="text-sm font-medium text-[#dadada]">{current.label}</span>
          <span className="text-[10px] text-[#7f7f7f]">· {PROVIDER_META[llmProvider].label}</span>
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
                className="absolute top-full left-0 mt-1 w-72 max-h-[480px] overflow-y-auto bg-[#383739] border border-[rgba(255,255,255,0.10)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 p-1.5"
              >
                {(Object.keys(PROVIDER_MODELS) as Provider[]).map(prov => {
                  const meta = PROVIDER_META[prov];
                  const Icon = meta.icon;
                  const hasKey = providerHasKey(prov);
                  return (
                    <div key={prov} className="mb-1.5 last:mb-0">
                      <div className="flex items-center justify-between px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <Icon size={12} className={meta.color} />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7f7f]">{meta.label}</span>
                        </div>
                        {!hasKey && meta.keyName && (
                          <button
                            onClick={() => { setShowModelMenu(false); openSettings('api-keys'); }}
                            className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300"
                          >
                            <KeyRound size={10} /> Add key
                          </button>
                        )}
                      </div>
                      {PROVIDER_MODELS[prov].map(m => {
                        const isSelected = m.provider === llmProvider && m.id === llmModel;
                        const disabled = !hasKey;
                        return (
                          <button
                            key={`${m.provider}-${m.id}`}
                            disabled={disabled}
                            onClick={() => { setLLM(m.provider, m.id); setShowModelMenu(false); }}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors',
                              isSelected ? 'bg-[rgba(255,255,255,0.10)]' : 'hover:bg-[rgba(255,255,255,0.05)]',
                              disabled && 'opacity-40 cursor-not-allowed',
                            )}
                          >
                            <span className="text-sm text-[#dadada]">{m.label}</span>
                            {m.badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[#acacac]">{m.badge}</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
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
          title={`Tokens — in: ${usageStats.tokensIn ?? 0} · out: ${usageStats.tokensOut ?? 0} · saved: ${usageStats.tokensSaved ?? 0}`}
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

// Legacy export for any old imports — derived from PROVIDER_MODELS
export const MODELS = PROVIDER_MODELS.ollama.slice(0, 3).map((m, i) => ({
  id: (['lite', 'pro', 'max'] as const)[i],
  label: m.label,
  tag: m.badge ?? '',
  ollamaId: m.id,
}));
