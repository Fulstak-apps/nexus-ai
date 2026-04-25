/**
 * Scheduled task runner.
 *
 * POST /api/scheduled  { task: ScheduledTask }
 *   → Runs the task's prompt through the agent and returns the result.
 *
 * The client polls this from a useEffect on a schedule, calling it
 * when a task's next-run time has elapsed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAgentLoop } from '@/agent/core/loop';
import { withRequestContext, RequestContext } from '@/agent/core/anthropic';
import { ScheduledTask } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { task } = await req.json() as { task: ScheduledTask };

  if (!task?.prompt?.trim()) {
    return NextResponse.json({ error: 'task.prompt required' }, { status: 400 });
  }

  const userKeys: RequestContext = {
    apiKey:      req.headers.get('x-anthropic-key')  || undefined,
    elevenlabs:  req.headers.get('x-elevenlabs-key') || undefined,
    tavily:      req.headers.get('x-tavily-key')     || undefined,
    notion:      req.headers.get('x-notion-key')     || undefined,
    slackBot:    req.headers.get('x-slack-key')      || undefined,
    telegramBot: req.headers.get('x-telegram-key')   || undefined,
    githubToken: req.headers.get('x-github-key')     || undefined,
  };

  let result = '';

  await withRequestContext(userKeys, async () => {
    for await (const event of runAgentLoop(task.prompt, [])) {
      if (event.type === 'message') {
        result = event.message.content;
      } else if (event.type === 'token') {
        result += event.text;
      }
    }
  });

  return NextResponse.json({
    taskId: task.id,
    result: result || 'Completed with no text output.',
    ranAt: Date.now(),
  });
}
