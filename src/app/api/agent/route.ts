import { NextRequest } from 'next/server';
import { runAgentLoop } from '@/agent/core/loop';
import { Message, AgentMode } from '@/types';
import { createJob, markJobRunning, markJobProgress, markJobComplete, markJobFailed } from '@/agent/jobs/queue';
import { withRequestContext, RequestContext } from '@/agent/core/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { message, history, mode = 'normal', modelId } = await req.json() as {
    message: string;
    history: Message[];
    mode?: AgentMode;
    modelId?: 'lite' | 'pro' | 'max';
  };

  const MODEL_MAP: Record<string, string> = {
    lite: 'qwen3.5:4b',
    pro:  'gemma4:e4b',
    max:  'qwen3-coder:30b',
  };
  const chatModel = modelId ? (MODEL_MAP[modelId] ?? undefined) : undefined;

  if (!message?.trim()) {
    return new Response('Message required', { status: 400 });
  }

  // User-supplied keys from API Keys settings page (forwarded as headers)
  const userKeys: RequestContext = {
    apiKey:        req.headers.get('x-anthropic-key')   || undefined,
    elevenlabs:    req.headers.get('x-elevenlabs-key')  || undefined,
    openai:        req.headers.get('x-openai-key')      || undefined,
    huggingface:   req.headers.get('x-hf-key')          || undefined,
    tavily:        req.headers.get('x-tavily-key')      || undefined,
    notion:        req.headers.get('x-notion-key')      || undefined,
    slackBot:      req.headers.get('x-slack-key')       || undefined,
    telegramBot:   req.headers.get('x-telegram-key')    || undefined,
    githubToken:   req.headers.get('x-github-key')      || undefined,
  };

  const encoder = new TextEncoder();

  // Background mode: create a job, run async, return job ID immediately
  if (mode === 'background') {
    const job = await createJob(
      message.slice(0, 80),
      message,
      'background',
    );

    // Run in background without awaiting
    (async () => {
      await withRequestContext(userKeys, async () => {
        try {
          await markJobRunning(job.id);
          let progress = 10;
          let finalText = '';

          for await (const event of runAgentLoop(message, history, chatModel)) {
            if (event.type === 'phase') {
              progress = event.phase === 'planning' ? 20 : event.phase === 'executing' ? 50 : event.phase === 'reflecting' ? 80 : progress;
              await markJobProgress(job.id, progress);
            } else if (event.type === 'token') {
              finalText += event.text;
            } else if (event.type === 'message') {
              finalText = event.message.content;
            }
          }

          await markJobComplete(job.id, finalText || 'Completed.');
        } catch (err) {
          await markJobFailed(job.id, err instanceof Error ? err.message : String(err));
        }
      });
    })();

    return new Response(JSON.stringify({ jobId: job.id, status: 'queued' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Normal / research mode: stream SSE
  const stream = new ReadableStream({
    async start(controller) {
      await withRequestContext(userKeys, async () => {
        try {
          for await (const event of runAgentLoop(message, history, chatModel)) {
            const line = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(line));
          }
        } catch (err) {
          const errorEvent = { type: 'error', message: err instanceof Error ? err.message : String(err) };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
