/**
 * LLM access layer — backed by Ollama (OpenAI-compatible API).
 *
 * Exposes:
 *  - getClient()         → OpenAI instance pointed at Ollama
 *  - generate()          → simple text-in / text-out completion
 *  - withRequestContext  → wrap an incoming request so getClient() picks up its key
 *  - getUserKey(name)    → read other forwarded keys (elevenlabs, notion, …)
 *  - toOpenAITools()     → convert TOOL_REGISTRY to OpenAI tool definitions
 */

import OpenAI from 'openai';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  apiKey?: string;      // unused for Ollama (local), kept for compat
  elevenlabs?: string;
  openai?: string;
  huggingface?: string;
  tavily?: string;
  notion?: string;
  slackBot?: string;
  telegramBot?: string;
  githubToken?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function withApiKey<T>(apiKey: string | undefined, fn: () => T): T {
  return requestContext.run({ apiKey }, fn);
}

export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}

export function getUserKey(name: keyof RequestContext): string | undefined {
  return requestContext.getStore()?.[name];
}

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';

export function getClient(): OpenAI {
  return new OpenAI({
    baseURL: OLLAMA_BASE,
    apiKey: 'ollama', // required by SDK but ignored by Ollama
  });
}

export const CHAT_MODEL    = process.env.OLLAMA_CHAT_MODEL    || 'gemma4:e4b';
export const PLANNER_MODEL = process.env.OLLAMA_PLANNER_MODEL || 'gemma4:e4b';
export const FAST_MODEL    = process.env.OLLAMA_FAST_MODEL    || 'gemma4:e4b';

// ─── Tool definitions (OpenAI format) ────────────────────────────────────────

export function toOpenAITools(
  tools: Array<{
    name: string;
    description: string;
    params: Record<string, { type: string; description?: string; required?: boolean }>;
  }>,
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(t.params).map(([k, v]) => [
            k,
            { type: v.type, description: v.description ?? '' },
          ]),
        ),
        required: Object.entries(t.params)
          .filter(([, v]) => v.required)
          .map(([k]) => k),
      },
    },
  }));
}

// Alias kept so old import sites still compile
export const toGeminiFunctionDeclarations = toOpenAITools;

// ─── Simple text generation ──────────────────────────────────────────────────

export async function generate(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const client = getClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.prompt });

  const res = await client.chat.completions.create({
    model: opts.model ?? PLANNER_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? 2048,
  });

  return res.choices[0]?.message?.content ?? '';
}
