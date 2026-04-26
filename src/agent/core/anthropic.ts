/**
 * LLM access layer — multi-provider via OpenAI-compatible API.
 *
 * Supported providers:
 *  - ollama:    local, free, unlimited (default) — http://localhost:11434/v1
 *  - openai:    cloud, requires user OPENAI_API_KEY
 *  - anthropic: cloud, requires user ANTHROPIC_API_KEY (uses Claude's
 *               OpenAI-compatible endpoint at api.anthropic.com/v1)
 *  - gemini:    cloud, requires GEMINI_API_KEY (Google's OpenAI-compat)
 *  - groq:      cloud, requires GROQ_API_KEY (fast Llama hosting)
 *
 * Provider + model are forwarded per-request via headers; getClient() reads
 * them out of the AsyncLocalStorage and returns the right OpenAI instance.
 */

import OpenAI from 'openai';
import { AsyncLocalStorage } from 'async_hooks';

export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'groq';

export interface RequestContext {
  apiKey?: string;          // legacy/anthropic
  elevenlabs?: string;
  openai?: string;
  anthropic?: string;
  gemini?: string;
  groq?: string;
  huggingface?: string;
  tavily?: string;
  notion?: string;
  slackBot?: string;
  telegramBot?: string;
  githubToken?: string;
  // Provider routing
  provider?: LLMProvider;
  modelOverride?: string;   // explicit model id (e.g. "gpt-4o", "claude-sonnet-4-5")
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function withApiKey<T>(apiKey: string | undefined, fn: () => T): T {
  return requestContext.run({ apiKey }, fn);
}

export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}

export function getUserKey(name: keyof RequestContext): string | undefined {
  const v = requestContext.getStore()?.[name];
  return typeof v === 'string' ? v : undefined;
}

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';

interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
}

function resolveProvider(): { provider: LLMProvider; cfg: ProviderConfig } {
  const ctx = requestContext.getStore();
  const provider: LLMProvider = ctx?.provider ?? 'ollama';

  switch (provider) {
    case 'openai': {
      const key = ctx?.openai || process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OpenAI selected but no API key set. Add it in Settings → API Keys.');
      return { provider, cfg: { baseURL: 'https://api.openai.com/v1', apiKey: key, defaultModel: 'gpt-4o-mini' } };
    }
    case 'anthropic': {
      const key = ctx?.anthropic || ctx?.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('Anthropic selected but no API key set.');
      // Anthropic exposes an OpenAI-compatible endpoint at /v1
      return { provider, cfg: { baseURL: 'https://api.anthropic.com/v1', apiKey: key, defaultModel: 'claude-sonnet-4-5' } };
    }
    case 'gemini': {
      const key = ctx?.gemini || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Gemini selected but no API key set.');
      return { provider, cfg: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: key, defaultModel: 'gemini-2.5-flash' } };
    }
    case 'groq': {
      const key = ctx?.groq || process.env.GROQ_API_KEY;
      if (!key) throw new Error('Groq selected but no API key set.');
      return { provider, cfg: { baseURL: 'https://api.groq.com/openai/v1', apiKey: key, defaultModel: 'llama-3.3-70b-versatile' } };
    }
    case 'ollama':
    default:
      return { provider: 'ollama', cfg: { baseURL: OLLAMA_BASE, apiKey: 'ollama', defaultModel: process.env.OLLAMA_CHAT_MODEL || 'gemma4:e4b' } };
  }
}

export function getClient(): OpenAI {
  const { cfg } = resolveProvider();
  return new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
}

export function getModelFor(role: 'chat' | 'planner' | 'fast'): string {
  const ctx = requestContext.getStore();
  if (ctx?.modelOverride) return ctx.modelOverride;
  const { provider, cfg } = resolveProvider();
  if (provider !== 'ollama') return cfg.defaultModel;
  // Ollama-specific role splits via env
  if (role === 'planner') return process.env.OLLAMA_PLANNER_MODEL || cfg.defaultModel;
  if (role === 'fast')    return process.env.OLLAMA_FAST_MODEL    || cfg.defaultModel;
  return process.env.OLLAMA_CHAT_MODEL || cfg.defaultModel;
}

// Legacy named exports — now resolve dynamically per-request
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
