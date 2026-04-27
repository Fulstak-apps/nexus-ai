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

    // Pull user-supplied keys + selected provider/model from store
    const state = useAgentStore.getState();
    const k = state.apiKeys;
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-llm-provider': state.llmProvider,
      ...(state.llmModel ? { 'x-llm-model': state.llmModel } : {}),
      ...(k.anthropic   ? { 'x-anthropic-key':  k.anthropic }   : {}),
      ...(k.elevenlabs  ? { 'x-elevenlabs-key': k.elevenlabs }  : {}),
      ...(k.openai      ? { 'x-openai-key':     k.openai }      : {}),
      ...(k.gemini      ? { 'x-gemini-key':     k.gemini }      : {}),
      ...(k.groq        ? { 'x-groq-key':       k.groq }        : {}),
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
            } else if (event.type === 'tool_call') {
              const call = event.call as { id: string; tool: string; params: Record<string, unknown>; startedAt: number };
              const browserKinds: Record<string, 'navigate' | 'click' | 'fill' | 'screenshot' | 'fetch' | 'search'> = {
                browser_navigate: 'navigate', browser_click: 'click', browser_fill: 'fill',
                browser_screenshot: 'screenshot', browser_type: 'fill',
                browser_evaluate: 'fetch', browser_wait_for: 'navigate',
                browser_scroll: 'navigate',
                web_fetch: 'fetch', web_search: 'search',
              };
              const kind = browserKinds[call.tool];
              if (kind) {
                useAgentStore.getState().pushBrowserActivity({
                  id: call.id,
                  kind,
                  url: call.params.url ? String(call.params.url) : undefined,
                  query: call.params.query ? String(call.params.query) : undefined,
                  status: 'pending',
                  startedAt: call.startedAt,
                });
              }
            } else if (event.type === 'tool_result') {
              const callId = String(event.callId ?? '');
              const out = event.output as { url?: string; title?: string; screenshot?: string; _compression?: { tokensSaved?: number } } | null;
              const err = event.error as string | undefined;
              useAgentStore.getState().updateBrowserActivity(callId, {
                status: err ? 'error' : 'success',
                error: err,
                url: out?.url,
                title: out?.title,
                screenshot: out?.screenshot,
                completedAt: Date.now(),
              });
              const saved = out?._compression?.tokensSaved;
              if (typeof saved === 'number' && saved > 0) {
                useAgentStore.getState().recordTokensSaved(saved);
              }
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
