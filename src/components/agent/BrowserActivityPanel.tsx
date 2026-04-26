'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore, BrowserActivityItem } from '@/store/agent';
import { Globe, Search, Download, MousePointerClick, Type, Camera, X, ChevronRight, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

const KIND_META: Record<BrowserActivityItem['kind'], { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string }> = {
  search:     { icon: Search,             label: 'Search',     color: 'text-sky-500' },
  fetch:      { icon: Download,           label: 'Fetch',      color: 'text-violet-500' },
  navigate:   { icon: Globe,              label: 'Browse',     color: 'text-emerald-500' },
  click:      { icon: MousePointerClick,  label: 'Click',      color: 'text-amber-500' },
  fill:       { icon: Type,               label: 'Type',       color: 'text-amber-500' },
  screenshot: { icon: Camera,             label: 'Screenshot', color: 'text-pink-500' },
};

function StatusDot({ status }: { status: BrowserActivityItem['status'] }) {
  if (status === 'pending') return <Loader2 className="w-3 h-3 animate-spin text-sky-500" />;
  if (status === 'success') return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
  return <AlertCircle className="w-3 h-3 text-red-500" />;
}

export function BrowserActivityPanel() {
  const { browserActivity, browserPanelOpen, setBrowserPanelOpen, clearBrowserActivity } = useAgentStore();
  const [selected, setSelected] = useState<string | null>(null);

  // Auto-select latest activity with screenshot
  useEffect(() => {
    const latest = [...browserActivity].reverse().find(a => a.screenshot);
    if (latest && !selected) setSelected(latest.id);
    // If selected is gone (cleared), reset
    if (selected && !browserActivity.find(a => a.id === selected)) setSelected(null);
  }, [browserActivity, selected]);

  if (!browserPanelOpen || browserActivity.length === 0) return null;

  const current = browserActivity.find(a => a.id === selected) ?? browserActivity[browserActivity.length - 1];

  const hostname = (url?: string) => {
    if (!url) return '';
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 40); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-12 right-3 bottom-3 w-[400px] z-40 flex flex-col rounded-2xl bg-[#1e1e1f] border border-[rgba(255,255,255,0.10)] shadow-[0_24px_64px_rgba(0,0,0,0.4)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(255,255,255,0.06)] bg-[#181819]">
          <Globe className="w-4 h-4 text-emerald-500" />
          <div className="text-sm font-semibold text-[#dadada] flex-1">Live Browser</div>
          <button
            onClick={clearBrowserActivity}
            title="Clear"
            className="text-[10px] text-[#7f7f7f] hover:text-[#dadada] px-2 py-0.5 rounded hover:bg-[rgba(255,255,255,0.06)]"
          >
            Clear
          </button>
          <button
            onClick={() => setBrowserPanelOpen(false)}
            title="Hide"
            className="p-1 rounded hover:bg-[rgba(255,255,255,0.06)]"
          >
            <X className="w-3.5 h-3.5 text-[#7f7f7f]" />
          </button>
        </div>

        {/* Current preview */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {current?.screenshot ? (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Address bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252527] border-b border-[rgba(255,255,255,0.06)]">
                <StatusDot status={current.status} />
                <div className="flex-1 text-xs text-[#acacac] truncate font-mono">
                  {current.url ?? current.query ?? '—'}
                </div>
                {current.url && (
                  <a
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in new tab"
                    className="opacity-60 hover:opacity-100"
                  >
                    <ExternalLink className="w-3 h-3 text-[#dadada]" />
                  </a>
                )}
              </div>
              {/* Screenshot */}
              <div className="flex-1 min-h-0 overflow-auto bg-[#0f0f12]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/preview/${encodeURIComponent(current.screenshot)}`}
                  alt={current.title ?? current.url ?? 'screenshot'}
                  className="w-full h-auto block"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#7f7f7f] p-6 text-center">
              {current?.status === 'pending'
                ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
                : current?.kind === 'search'
                  ? <span>Searched: <span className="text-[#dadada]">&ldquo;{current.query}&rdquo;</span></span>
                  : <span>No preview available</span>
              }
            </div>
          )}
        </div>

        {/* Activity log (timeline) */}
        <div className="border-t border-[rgba(255,255,255,0.06)] max-h-[180px] overflow-y-auto bg-[#181819]">
          {[...browserActivity].reverse().map(a => {
            const Meta = KIND_META[a.kind];
            const Icon = Meta.icon;
            const isActive = a.id === current?.id;
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${isActive ? 'bg-[rgba(255,255,255,0.06)]' : 'hover:bg-[rgba(255,255,255,0.04)]'}`}
              >
                <Icon size={14} className={`${Meta.color} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#dadada]">{Meta.label}</span>
                    <StatusDot status={a.status} />
                  </div>
                  <div className="text-[11px] text-[#7f7f7f] truncate">
                    {a.kind === 'search' ? a.query : hostname(a.url) || '—'}
                  </div>
                  {a.title && <div className="text-[10px] text-[#5f5f5f] truncate">{a.title}</div>}
                </div>
                <ChevronRight className="w-3 h-3 text-[#5f5f5f] mt-1 shrink-0" />
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
