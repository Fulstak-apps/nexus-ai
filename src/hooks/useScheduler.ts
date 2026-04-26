'use client';

/**
 * Client-side scheduled task runner.
 * Polls every 60s, fires tasks whose nextRun has elapsed.
 * Mount once at the app root.
 */

import { useEffect } from 'react';
import { useAgentStore } from '@/store/agent';

export function useScheduler() {
  const { updateScheduledTask } = useAgentStore();

  useEffect(() => {
    const run = async () => {
      const now = Date.now();
      const tasks = useAgentStore.getState().scheduledTasks;

      for (const task of tasks) {
        if (!task.enabled) continue;

        const intervalMs = (Number(task.cronLike) || 60) * 60 * 1000;
        const nextRun = task.nextRun ?? (task.lastRun ? task.lastRun + intervalMs : now);

        if (now < nextRun) continue;

        // Fire the task
        const k = useAgentStore.getState().apiKeys;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(k.anthropic   ? { 'x-anthropic-key':  k.anthropic }  : {}),
          ...(k.tavily      ? { 'x-tavily-key':     k.tavily }     : {}),
          ...(k.notion      ? { 'x-notion-key':     k.notion }     : {}),
          ...(k.slackBot    ? { 'x-slack-key':      k.slackBot }   : {}),
          ...(k.telegramBot ? { 'x-telegram-key':   k.telegramBot }: {}),
          ...(k.githubToken ? { 'x-github-key':     k.githubToken }: {}),
        };

        const ranAt = Date.now();
        updateScheduledTask(task.id, {
          lastRun: ranAt,
          nextRun: ranAt + intervalMs,
        });

        fetch('/api/scheduled', {
          method: 'POST',
          headers,
          body: JSON.stringify({ task }),
        }).catch(console.error);
      }
    };

    run();
    const interval = setInterval(run, 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
