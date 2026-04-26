'use client';

import { useCallback } from 'react';
import { useAgentStore } from '@/store/agent';
import { Message, Plan, ThinkingPhase, SubAgent } from '@/types';
import { toast } from '@/components/ui/Toast';

function uuid(): string {
  return typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function useAgent() {
  const {
    messages, addMessage, setPhase, setCurrentPlan,
    setIsStreaming, appendStreamToken, clearStreamingText,
    updatePlanStep, isStreaming, agentMode,
    upsertAgent, setActiveAgents, setResearchPhase,
    incrementUsage, selectedModelId,
  } = useAgentStore();

  const sendMessage = useCallback(async (text: string) => {
    if (isStreaming) return;

    const userMsg: Message = {
      id: uuid(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setIsStreaming(true);
    clearStreamingText();
    setPhase('thinking');

    // Pull user-supplied keys from store (Settings → API Keys)
    const k = useAgentStore.getState().apiKeys;
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(k.anthropic   ? { 'x-anthropic-key':  k.anthropic }   : {}),
      ...(k.elevenlabs  ? { 'x-elevenlabs-key': k.elevenlabs }  : {}),
      ...(k.openai      ? { 'x-openai-key':     k.openai }      : {}),
      ...(k.huggingface ? { 'x-hf-key':         k.huggingface } : {}),
      ...(k.tavily      ? { 'x-tavily-key':     k.tavily }      : {}),
      ...(k.notion      ? { 'x-notion-key':     k.notion }      : {}),
      ...(k.slackBot    ? { 'x-slack-key':      k.slackBot }    : {}),
      ...(k.telegramBot ? { 'x-telegram-key':   k.telegramBot } : {}),
      ...(k.githubToken ? { 'x-github-key':     k.githubToken } : {}),
    };

    try {
      // ── Background mode ──────────────────────────────────────────────────
      if (agentMode === 'background') {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ message: text, history: messages, mode: 'background' }),
        });
        const data = await response.json() as { jobId: string; status: string };

        const confirmMsg: Message = {
          id: uuid(),
          role: 'assistant',
          content: `Task queued as a background job (ID: \`${data.jobId}\`). It will run in the background — check the **Jobs** tab for status and results.`,
          timestamp: Date.now(),
        };
        addMessage(confirmMsg);
        setPhase('idle');
        setIsStreaming(false);
        return;
      }

      // ── Research mode ────────────────────────────────────────────────────
      if (agentMode === 'research') {
        const response = await fetch('/api/research', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ query: text, depth: 'deep' }),
        });

        if (!response.body) throw new Error('No response body');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let reportContent = '';

        setPhase('executing');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;

            try {
              const event = JSON.parse(data) as { type: string; [k: string]: unknown };

              if (event.type === 'research_phase') {
                setResearchPhase(event.phase as string);
              } else if (event.type === 'research_done') {
                const rpt = event.report as { report: string; sources: unknown[]; keyFindings: string[] };
                reportContent = `## Research Report\n\n${rpt.report}\n\n---\n*${rpt.sources.length} sources analyzed*`;
                setResearchPhase(null);
              }
            } catch { /* skip */ }
          }
        }

        const finalMsg: Message = {
          id: uuid(),
          role: 'assistant',
          content: reportContent || 'Research complete. Check the Files tab for the saved report.',
          timestamp: Date.now(),
        };
        addMessage(finalMsg);
        incrementUsage(25);
        setPhase('idle');
        setIsStreaming(false);
        return;
      }

      // ── Normal mode (SSE streaming) ───────────────────────────────────────
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message: text, history: messages, mode: 'normal', modelId: selectedModelId }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const event = JSON.parse(data) as { type: string; [key: string]: unknown };

            if (event.type === 'phase') {
              setPhase(event.phase as ThinkingPhase);
            } else if (event.type === 'plan') {
              setCurrentPlan(event.plan as Plan);
            } else if (event.type === 'step_start' || event.type === 'step_complete') {
              updatePlanStep(
                (event.step as Plan['steps'][0]).id,
                event.step as Partial<Plan['steps'][0]>,
              );
            } else if (event.type === 'token') {
              appendStreamToken(event.text as string);
            } else if (event.type === 'message') {
              clearStreamingText();
              addMessage(event.message as Message);
            } else if (event.type === 'orchestrator_agents') {
              setActiveAgents(event.data as SubAgent[]);
            } else if (event.type === 'orchestrator_agent_done') {
              upsertAgent(event.data as SubAgent);
            } else if (event.type === 'usage') {
              const t = event.tokens as { input?: number; output?: number };
              useAgentStore.getState().recordTokenUsage(t?.input ?? 0, t?.output ?? 0);
            } else if (event.type === 'ask_human') {
              const question = String(event.question ?? '');
              const options = Array.isArray(event.options) ? (event.options as string[]) : undefined;
              toast.info('Agent has a question', question);
              useAgentStore.getState().setPendingQuestion({ question, options });
            } else if (event.type === 'terminated') {
              toast.success('Task complete', String(event.summary ?? ''));
            } else if (event.type === 'done') {
              incrementUsage();
              setPhase('idle');
              setIsStreaming(false);
            } else if (event.type === 'error') {
              console.error('Agent error:', event.message);
              toast.error('Agent error', String(event.message ?? 'Unknown error'));
              setPhase('idle');
              setIsStreaming(false);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Connection failed', err instanceof Error ? err.message : 'Could not reach agent');
    } finally {
      setPhase('idle');
      setIsStreaming(false);
    }
  }, [messages, isStreaming, agentMode, addMessage, setPhase, setCurrentPlan, setIsStreaming,
      appendStreamToken, clearStreamingText, updatePlanStep, upsertAgent, setActiveAgents,
      setResearchPhase, incrementUsage, selectedModelId]);

  return { sendMessage, isStreaming };
}
