'use client';

import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['⌘', 'K'], label: 'Open command palette' },
  { keys: ['⌘', '/'], label: 'Show shortcuts' },
  { keys: ['⌘', 'N'], label: 'New session' },
  { keys: ['⌘', ','], label: 'Open settings' },
  { keys: ['⌘', 'B'], label: 'Toggle sidebar' },
  { keys: ['⌘', 'E'], label: 'Export current session' },
  { keys: ['Esc'], label: 'Close modals' },
  { keys: ['↑', '↓'], label: 'Navigate sessions' },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] rounded-2xl border border-white/10 bg-[#1a1a1c] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-white/70" />
            <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-sm py-1.5">
              <span className="text-white/70">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded border border-white/15 bg-white/5 text-xs font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-white/40 text-center">Press ⌘/ to toggle</p>
      </div>
    </div>
  );
}
