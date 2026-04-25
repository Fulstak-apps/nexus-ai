'use client';

import { create } from 'zustand';
import { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'warn';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  ttl: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'ttl'> & { ttl?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: ({ kind, title, body, ttl = 5000 }) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, kind, title, body, ttl }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helpers
export const toast = {
  success: (title: string, body?: string) => useToast.getState().push({ kind: 'success', title, body }),
  error:   (title: string, body?: string) => useToast.getState().push({ kind: 'error', title, body, ttl: 8000 }),
  info:    (title: string, body?: string) => useToast.getState().push({ kind: 'info', title, body }),
  warn:    (title: string, body?: string) => useToast.getState().push({ kind: 'warn', title, body }),
};

const KIND_STYLES: Record<ToastKind, { icon: React.ComponentType<{ size?: number }>; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' },
  error:   { icon: AlertCircle, cls: 'border-red-500/40 bg-red-500/10 text-red-200' },
  info:    { icon: Info, cls: 'border-sky-500/40 bg-sky-500/10 text-sky-200' },
  warn:    { icon: AlertTriangle, cls: 'border-amber-500/40 bg-amber-500/10 text-amber-200' },
};

function ToastView({ t }: { t: ToastItem }) {
  const dismiss = useToast((s) => s.dismiss);
  const { icon: Icon, cls } = KIND_STYLES[t.kind];

  useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), t.ttl);
    return () => clearTimeout(id);
  }, [t.id, t.ttl, dismiss]);

  return (
    <div className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md w-80 ${cls}`}>
      <Icon size={18} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{t.title}</div>
        {t.body && <div className="text-xs opacity-80 mt-0.5 break-words">{t.body}</div>}
      </div>
      <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => <ToastView key={t.id} t={t} />)}
    </div>
  );
}
