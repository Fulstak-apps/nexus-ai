/**
 * Slack connector. Uses the bot token from Settings → API Keys (xoxb-…).
 *
 * GET  /api/connectors/slack?action=channels
 * POST /api/connectors/slack  { action: "post", channel, text }
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

function getToken(req: NextRequest): string {
  const t = req.headers.get('x-slack-key') ?? process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error('Slack bot token missing. Add it in Settings → API Keys.');
  return t;
}

async function slackCall(token: string, method: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json() as Record<string, unknown>;
  if (!data.ok) throw new Error(`Slack API error: ${data.error ?? 'unknown'}`);
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'channels';

    if (action === 'channels') {
      const r = await slackCall(token, 'conversations.list?exclude_archived=true&limit=200');
      const channels = (r.channels as Array<{ id: string; name: string; is_private: boolean; num_members: number }>) ?? [];
      return Response.json({ channels: channels.map(c => ({ id: c.id, name: c.name, isPrivate: c.is_private, members: c.num_members })) });
    }

    return new Response('Unknown action', { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = /missing|token|key|auth|unauthor/i.test(msg);
    return new Response(msg, { status: isAuth ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const body = await req.json() as { action: 'post'; channel: string; text: string };
    if (body.action !== 'post') return new Response('Unknown action', { status: 400 });
    const r = await slackCall(token, 'chat.postMessage', { channel: body.channel, text: body.text });
    return Response.json({ posted: true, ts: r.ts, channel: r.channel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = /missing|token|key|auth|unauthor/i.test(msg);
    return new Response(msg, { status: isAuth ? 401 : 500 });
  }
}
