'use client';

import { useEffect } from 'react';
import { useAgentStore } from '@/store/agent';
import { exportCurrentSession } from '@/lib/exportSession';
import { toast } from '@/components/ui/Toast';

/**
 * Global keyboard shortcuts. Mounted once at the app root.
 * - ⌘K  → command palette (handled in CommandPalette component itself)
 * - ⌘N  → new session
 * - ⌘,  → open settings
 * - ⌘B  → toggle sidebar
 * - ⌘E  → export current session
 * - ⌘/  → shortcuts overlay (handled in ShortcutsOverlay)
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'n' && !inField) {
        e.preventDefault();
        useAgentStore.getState().newSession();
        toast.success('New session created');
        return;
      }

      if (e.key === ',') {
        e.preventDefault();
        useAgentStore.getState().openSettings();
        return;
      }

      if (e.key === 'b') {
        e.preventDefault();
        const { sidebarOpen, setSidebarOpen } = useAgentStore.getState();
        setSidebarOpen(!sidebarOpen);
        return;
      }

      if (e.key === 'e' && !inField) {
        e.preventDefault();
        const { sessions, activeSessionId, messagesBySession } = useAgentStore.getState();
        const session = sessions.find((s) => s.id === activeSessionId);
        const messages = activeSessionId ? messagesBySession[activeSessionId] ?? [] : [];
        const ok = exportCurrentSession(session, messages);
        if (ok) toast.success('Session exported', `${messages.length} messages downloaded as Markdown`);
        else toast.warn('Nothing to export', 'This session has no messages yet');
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
