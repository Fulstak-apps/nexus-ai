'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace';
import { CommandPalette } from '@/components/command/CommandPalette';
import { TopBar } from '@/components/layout/TopBar';
import { SettingsModal } from '@/components/layout/SettingsModal';
import { useAgentStore } from '@/store/agent';
import { useScheduler } from '@/hooks/useScheduler';

export default function Home() {
  useScheduler();

  useEffect(() => {
    // Read synchronously from store so Strict Mode double-fire is safe:
    // first run: null → creates session; second run: ID exists → skips.
    const { activeSessionId, newSession, skills, personalization } = useAgentStore.getState();
    if (!activeSessionId) newSession();

    // Sync personalization + enabled skills to sandbox so the server-side
    // agent loop picks them up on every request (not only after a settings visit).
    const enabledSkills = skills.filter(s => s.enabled).map(s => ({ name: s.name, description: s.description }));
    fetch('/api/sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '_skills.json', content: JSON.stringify(enabledSkills) }),
    }).catch(() => {});
    fetch('/api/sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '_personalization.json',
        content: JSON.stringify({
          aboutYou: personalization?.aboutYou ?? '',
          customInstructions: personalization?.customInstructions ?? '',
        }),
      }),
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#272728]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-hidden">
          <ChatWorkspace />
        </main>
      </div>

      <CommandPalette />
      <SettingsModal />
    </div>
  );
}
