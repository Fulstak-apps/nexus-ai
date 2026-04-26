/**
 * Central agent execution loop.
 * Streams events back via an async generator so the API route
 * can forward them to the UI as Server-Sent Events.
 *
 * Uses Ollama's OpenAI-compatible API.
 * For models that don't support native tool calling (e.g. deepseek-r1),
 * falls back to prompt-engineering: tools are described in the system prompt
 * and the model emits <tool_call>{...}</tool_call> XML blocks.
 */

import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { Message, Plan, PlanStep, ToolCall } from '@/types';
import { buildPlan, getNextExecutableStep } from '../planner';
import { executeTool } from '../tools/executor';
import { reflectOnStep, reflectOnSession } from '../reflection';
import { addMemory, searchMemory, summarizeOldSessions, loadUserProfile } from '../memory/store';
import { TOOL_REGISTRY } from '../tools/registry';
import { getClient, CHAT_MODEL, toOpenAITools } from './anthropic';

// ─── Event Types ──────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'phase'; phase: string }
  | { type: 'plan'; plan: Plan }
  | { type: 'step_start'; step: PlanStep }
  | { type: 'step_complete'; step: PlanStep }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'tool_result'; callId: string; output: unknown; error?: string }
  | { type: 'token'; text: string }
  | { type: 'message'; message: Message }
  | { type: 'reflection'; stepId: string; quality: string }
  | { type: 'ask_human'; question: string; options?: string[] }
  | { type: 'terminated'; summary: string; success: boolean }
  | { type: 'usage'; tokens: { input: number; output: number; total: number } }
  | { type: 'done'; finalMessage: string }
  | { type: 'error'; message: string };

// ─── Tool-call parser (prompt-engineering fallback) ───────────────────────────
// Handles multiple formats DeepSeek R1 might emit:
//   1. <tool_call>{...}</tool_call>
//   2. ```json\n{...}\n```
//   3. Raw JSON objects with "name" + "params"/"arguments" keys

function tryParseToolCallObj(raw: string): { name: string; params: Record<string, unknown> } | null {
  try {
    const obj = JSON.parse(raw.trim()) as Record<string, unknown>;
    if (typeof obj.name === 'string') {
      const params = (obj.params ?? obj.arguments ?? obj.input ?? {}) as Record<string, unknown>;
      return { name: obj.name, params };
    }
  } catch { /* not valid JSON */ }
  return null;
}

function parseToolCalls(text: string): Array<{ name: string; params: Record<string, unknown> }> {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const seen = new Set<string>();

  const add = (call: { name: string; params: Record<string, unknown> }) => {
    const key = JSON.stringify(call);
    if (!seen.has(key)) { seen.add(key); calls.push(call); }
  };

  // 1. <tool_call>...</tool_call>
  const xmlRe = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let m: RegExpExecArray | null;
  while ((m = xmlRe.exec(text)) !== null) {
    const c = tryParseToolCallObj(m[1]);
    if (c) add(c);
  }

  // 2. ```json ... ``` or ``` ... ``` blocks
  const mdRe = /```(?:json)?\s*([\s\S]*?)```/g;
  while ((m = mdRe.exec(text)) !== null) {
    const c = tryParseToolCallObj(m[1]);
    if (c) add(c);
  }

  // 3. Entire text is a bare JSON object / array of objects (last resort)
  if (calls.length === 0) {
    const trimmed = text.trim();
    // Try parsing the whole thing as JSON
    const c = tryParseToolCallObj(trimmed);
    if (c) { add(c); }
    else {
      // Try as array of tool calls
      try {
        const arr = JSON.parse(trimmed) as unknown[];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const ic = tryParseToolCallObj(JSON.stringify(item));
            if (ic) add(ic);
          }
        }
      } catch { /* not an array */ }
    }
  }

  return calls;
}

function stripToolCalls(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
    .trim();
}

// ─── Tool descriptions for system prompt (prompt-engineering fallback) ────────

function buildToolsSystemSection(): string {
  const descs = TOOL_REGISTRY.map(t => {
    const params = Object.entries(t.params)
      .map(([k, v]) => `    "${k}": ${v.type}${v.required ? ' (required)' : ''} — ${v.description ?? ''}`)
      .join('\n');
    return `### ${t.name}\n${t.description}\nParams:\n${params}`;
  }).join('\n\n');

  return `## Available Tools
When you need to perform an action, emit a tool call using this exact format on its own line:
<tool_call>{"name": "tool_name", "params": {"key": "value"}}</tool_call>

You may emit multiple tool calls. After emitting them, STOP and wait — do not describe what you're about to do, just emit the tag.

${descs}`;
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

async function buildSystemPrompt(
  plan: Plan | null,
  userMessage: string,
  includeTools: boolean,
): Promise<string> {
  const profile = await loadUserProfile();
  const pastSessions = await summarizeOldSessions();
  const relevantMemories = await searchMemory(userMessage, 4);

  let customInstructions = '';
  let aboutYou = '';
  let enabledSkills: Array<{ name: string; description: string }> = [];
  try {
    const { readSandboxFile } = await import('../tools/executor');
    const personData = await readSandboxFile('_personalization.json');
    if (personData) {
      const p = JSON.parse(personData) as { aboutYou?: string; customInstructions?: string };
      aboutYou = p.aboutYou ?? '';
      customInstructions = p.customInstructions ?? '';
    }
    const skillsData = await readSandboxFile('_skills.json');
    if (skillsData) {
      enabledSkills = JSON.parse(skillsData) as Array<{ name: string; description: string }>;
    }
  } catch { /* missing files are fine */ }

  return `You are Nexus — an elite autonomous AI assistant. You plan, execute, and reflect with precision.

## User Profile
- Writing style preference: ${profile.writingStyle}
- Recurring goals: ${profile.recurringGoals.join(', ') || 'none yet'}
${aboutYou ? `- About the user: ${aboutYou}` : ''}

${customInstructions ? `## Custom Instructions\n${customInstructions}` : ''}

${pastSessions ? `## Past Session Insights\n${pastSessions}` : ''}

${relevantMemories.length ? `## Relevant Memory\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}` : ''}

${plan ? `## Active Plan\nGoal: ${plan.goal}\nSteps: ${plan.steps.map(s => `[${s.status}] ${s.title}`).join(' → ')}` : ''}

${enabledSkills.length ? `## Enabled Skills\nThe user has enabled these specialized capabilities — apply them when relevant:\n${enabledSkills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}` : ''}

${includeTools ? buildToolsSystemSection() : '## Behavior Rules\n- Use tools explicitly when needed — file_read/write, code_execute, http_request, web_search, web_fetch'}

## Behavior Rules
- Plan complex tasks before executing
- Think step by step; call tools as appropriate
- Be concise unless depth is needed
- After completing work, summarize what was accomplished`;
}

// ─── Main Agent Loop ──────────────────────────────────────────────────────────

export async function* runAgentLoop(
  userMessage: string,
  history: Message[],
  modelOverride?: string,
): AsyncGenerator<AgentEvent> {
  yield { type: 'phase', phase: 'thinking' };

  const needsPlan = userMessage.length > 80 ||
    /\b(build|create|analyze|research|write|implement|find|generate|design|fetch|scrape|scan)\b/i.test(userMessage);

  let plan: Plan | null = null;

  if (needsPlan) {
    yield { type: 'phase', phase: 'planning' };
    try {
      plan = await buildPlan(userMessage, history);
      yield { type: 'plan', plan };
    } catch (err) {
      yield { type: 'error', message: `Planning failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  const client = getClient();
  const model = modelOverride ?? CHAT_MODEL;
  const tools = toOpenAITools(TOOL_REGISTRY);

  // Detect tool calling support on first attempt
  let nativeTools = true;

  const buildMessages = async (useNativeTools: boolean) => {
    const systemPrompt = await buildSystemPrompt(plan, userMessage, !useNativeTools);
    const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];
    return msgs;
  };

  let messages = await buildMessages(true);

  yield { type: 'phase', phase: 'executing' };

  let finalText = '';
  let activeStepIndex = 0;
  const tokenUsage = { input: 0, output: 0, total: 0 };

  // Rough token estimator (1 token ~ 4 chars). Used when provider doesn't return usage.
  const estimateTokens = (s: string) => Math.ceil((s ?? '').length / 4);

  while (true) {
    if (plan) {
      const next = getNextExecutableStep(plan);
      if (next && next.status === 'pending') {
        next.status = 'executing';
        yield { type: 'step_start', step: next };
      }
    }

    // ── Attempt streaming completion ──────────────────────────────────────────
    let turnText = '';

    // Native tool calling path
    if (nativeTools) {
      let stream: Awaited<ReturnType<typeof client.chat.completions.create>> | null = null;
      try {
        stream = await client.chat.completions.create({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: 4096,
          stream: true,
          stream_options: { include_usage: true },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('does not support tools') || msg.includes('tool')) {
          // Fall back to prompt-engineering mode for this model
          nativeTools = false;
          messages = await buildMessages(false);
        } else {
          yield { type: 'error', message: msg };
          return;
        }
      }

      if (stream) {
        const toolCallAccum = new Map<number, { id: string; name: string; arguments: string }>();

        for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk & { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }>) {
          // Aggregate usage if reported (OpenAI returns it on the final chunk; Ollama may not)
          if (chunk.usage) {
            tokenUsage.input  += chunk.usage.prompt_tokens     ?? 0;
            tokenUsage.output += chunk.usage.completion_tokens ?? 0;
            tokenUsage.total  += chunk.usage.total_tokens      ?? 0;
          }

          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            turnText += delta.content;
            yield { type: 'token', text: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallAccum.has(tc.index)) {
                toolCallAccum.set(tc.index, { id: tc.id ?? randomUUID(), name: '', arguments: '' });
              }
              const acc = toolCallAccum.get(tc.index)!;
              if (tc.function?.name) acc.name += tc.function.name;
              if (tc.function?.arguments) acc.arguments += tc.function.arguments;
            }
          }
        }

        finalText += turnText;

        if (toolCallAccum.size === 0) {
          // No tool calls — done
          markStepsComplete(plan);
          for (const step of plan?.steps ?? []) {
            if (step.status === 'executing' || step.status === 'pending') {
              step.status = 'completed';
              yield { type: 'step_complete', step };
            }
          }
          break;
        }

        // Add assistant message with tool_calls
        const assistantToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
        for (const [, acc] of toolCallAccum) {
          assistantToolCalls.push({ id: acc.id, type: 'function', function: { name: acc.name, arguments: acc.arguments } });
        }
        messages.push({ role: 'assistant', content: turnText || null, tool_calls: assistantToolCalls });

        // Execute tools (single execution — accumulate result for both event + message)
        let terminateRequested = false;
        let terminateSummary = '';
        let terminateSuccess = true;

        for (const acc of toolCallAccum.values()) {
          let params: Record<string, unknown> = {};
          try { params = JSON.parse(acc.arguments || '{}') as Record<string, unknown>; } catch { /* ignore */ }
          const call: ToolCall = { id: acc.id, tool: acc.name as ToolCall['tool'], params, startedAt: Date.now() };

          yield { type: 'tool_call', call };
          const result = await executeTool(call);
          yield { type: 'tool_result', callId: acc.id, output: result.output, error: result.error };

          // Special handling for control-flow tools
          if (acc.name === 'terminate') {
            terminateRequested = true;
            terminateSummary = String(params.summary ?? '');
            terminateSuccess = params.success !== false;
          } else if (acc.name === 'ask_human') {
            yield {
              type: 'ask_human',
              question: String(params.question ?? ''),
              options: typeof params.options === 'string'
                ? (() => { try { return JSON.parse(params.options as string) as string[]; } catch { return undefined; } })()
                : undefined,
            };
          }

          const resultContent = result.error
            ? `Error: ${result.error}`
            : typeof result.output === 'string'
              ? result.output
              : JSON.stringify(result.output).slice(0, 8000);
          messages.push({ role: 'tool', tool_call_id: acc.id, content: resultContent });
        }

        if (terminateRequested) {
          yield { type: 'terminated', summary: terminateSummary, success: terminateSuccess };
          if (terminateSummary) finalText = (finalText + '\n\n' + terminateSummary).trim();
          markStepsComplete(plan);
          for (const step of plan?.steps ?? []) {
            if (step.status === 'executing' || step.status === 'pending') {
              step.status = 'completed';
              yield { type: 'step_complete', step };
            }
          }
          break;
        }

        // Step bookkeeping
        advanceStep(plan);
        if (plan) {
          const currentStep = plan.steps.find(s => s.status === 'executing');
          if (currentStep) {
            currentStep.status = 'completed';
            yield { type: 'step_complete', step: currentStep };
          }
        }

        activeStepIndex++;
        if (activeStepIndex > 15) {
          yield { type: 'error', message: 'Agent loop exceeded 15 tool iterations — stopping.' };
          break;
        }
        continue;
      }
    }

    // ── Prompt-engineering tool call path ─────────────────────────────────────
    {
      const stream = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          turnText += content;
          // Stream visible text (strip tool_call tags)
          yield { type: 'token', text: content };
        }
      }

      finalText += turnText;

      const calls = parseToolCalls(turnText);
      const visibleText = stripToolCalls(turnText);

      if (calls.length === 0) {
        if (plan) {
          for (const step of plan.steps) {
            if (step.status === 'executing' || step.status === 'pending') {
              step.status = 'completed';
              yield { type: 'step_complete', step };
            }
          }
        }
        break;
      }

      // Update final text to strip tool call tags
      finalText = finalText.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim() + (visibleText ? '' : '');

      // Add assistant turn to history
      messages.push({ role: 'assistant', content: turnText });

      // Execute each tool call
      let terminateRequestedPE = false;
      let terminateSummaryPE = '';
      for (const { name, params } of calls) {
        const callId = randomUUID();
        const call: ToolCall = {
          id: callId,
          tool: name as ToolCall['tool'],
          params,
          startedAt: Date.now(),
        };

        yield { type: 'tool_call', call };

        const result = await executeTool(call);

        yield { type: 'tool_result', callId, output: result.output, error: result.error };

        if (name === 'terminate') {
          terminateRequestedPE = true;
          terminateSummaryPE = String(params.summary ?? '');
        } else if (name === 'ask_human') {
          let opts: string[] | undefined;
          if (typeof params.options === 'string') {
            try { opts = JSON.parse(params.options) as string[]; } catch { /* ignore */ }
          }
          yield { type: 'ask_human', question: String(params.question ?? ''), options: opts };
        }

        const resultContent = result.error
          ? `Error: ${result.error}`
          : typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output).slice(0, 8000);

        // Feed result back as a user message
        messages.push({
          role: 'user',
          content: `Tool result for ${name}:\n${resultContent}`,
        });
      }

      if (terminateRequestedPE) {
        yield { type: 'terminated', summary: terminateSummaryPE, success: true };
        if (terminateSummaryPE) finalText = (finalText + '\n\n' + terminateSummaryPE).trim();
        if (plan) {
          for (const step of plan.steps) {
            if (step.status === 'executing' || step.status === 'pending') {
              step.status = 'completed';
              yield { type: 'step_complete', step };
            }
          }
        }
        break;
      }

      if (plan) {
        const currentStep = plan.steps.find(s => s.status === 'executing');
        if (currentStep) {
          currentStep.status = 'completed';
          yield { type: 'step_complete', step: currentStep };
        }
      }

      activeStepIndex++;
      if (activeStepIndex > 15) {
        yield { type: 'error', message: 'Agent loop exceeded 15 tool iterations — stopping.' };
        break;
      }
    }
  }

  // ── Reflection ──────────────────────────────────────────────────────────────
  if (plan) {
    yield { type: 'phase', phase: 'reflecting' };

    for (const step of plan.steps) {
      if (!step.reflection && step.status === 'completed') {
        const reflection = await reflectOnStep(step, finalText, plan.goal);
        step.reflection = reflection;
        yield { type: 'reflection', stepId: step.id, quality: reflection.quality };
      }
    }

    const sessionReflection = await reflectOnSession(plan);
    await addMemory(
      sessionReflection.summary,
      'session',
      { planId: plan.id, improvements: sessionReflection.improvements, goal: plan.goal },
    );
  }

  await addMemory(
    `User: "${userMessage.slice(0, 250)}" → Response: "${finalText.slice(0, 400)}"`,
    'task',
    { timestamp: Date.now() },
  );

  // Fallback token estimation if provider didn't return usage
  if (tokenUsage.total === 0) {
    const inputApprox  = estimateTokens(userMessage) + estimateTokens(history.map(h => h.content).join('\n'));
    const outputApprox = estimateTokens(finalText);
    tokenUsage.input  = inputApprox;
    tokenUsage.output = outputApprox;
    tokenUsage.total  = inputApprox + outputApprox;
  }
  yield { type: 'usage', tokens: { ...tokenUsage } };

  const finalMessage: Message = {
    id: randomUUID(),
    role: 'assistant',
    content: finalText,
    timestamp: Date.now(),
    planSnapshot: plan ?? undefined,
    tokens: { ...tokenUsage },
  };

  yield { type: 'message', message: finalMessage };
  yield { type: 'done', finalMessage: finalText };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function markStepsComplete(plan: Plan | null) {
  if (!plan) return;
  for (const step of plan.steps) {
    if (step.status === 'executing' || step.status === 'pending') {
      step.status = 'completed';
    }
  }
}

function advanceStep(_plan: Plan | null) { /* step tracking handled inline */ }

// (helper removed — tool execution is inlined to prevent double-execution)
