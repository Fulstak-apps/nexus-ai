'use client';

/**
 * Browser push notifications when long-running agent tasks complete or
 * the agent asks a question.
 *
 * Fires only if:
 *   - Notification permission has been granted, AND
 *   - The page/tab is hidden (user is doing something else), AND
 *   - The task ran for at least 8 seconds (avoid spam on instant replies)
 */

import { useEffect, useRef } from 'react';
import { useAgentStore } from '@/store/agent';

export function useAgentNotifications() {
  const { isStreaming, pendingQuestion, messages } = useAgentStore();
  const startedAtRef = useRef<number | null>(null);
  const wasStreamingRef = useRef(false);

  // Track when streaming starts
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      startedAtRef.current = Date.now();
    }
    // Streaming just ended → maybe notify
    if (!isStreaming && wasStreamingRef.current && startedAtRef.current) {
      const duration = Date.now() - startedAtRef.current;
      if (duration > 8_000 && document.hidden && Notification.permission === 'granted') {
        const last = messages[messages.length - 1];
        const body = last?.content?.slice(0, 160) ?? 'Your task is complete.';
        try {
          new Notification('Nexus · Task complete', {
            body,
            icon: '/icon.svg',
            tag: 'nexus-task-done',
          });
        } catch { /* notifications can fail silently */ }
      }
      startedAtRef.current = null;
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, messages]);

  // Notify when agent asks a question while page is hidden
  useEffect(() => {
    if (pendingQuestion && document.hidden && Notification.permission === 'granted') {
      try {
        new Notification('Nexus needs your input', {
          body: pendingQuestion.question.slice(0, 160),
          icon: '/icon.svg',
          tag: 'nexus-ask-human',
          requireInteraction: true,
        });
      } catch { /* silent */ }
    }
  }, [pendingQuestion]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
