/**
 * Telegram connector. Uses bot token from Settings → API Keys.
 *
 * GET  /api/connectors/telegram?action=me
 * POST /api/connectors/telegram   { action: "send", chatId, text }
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

function getToken(req: NextRequest): string {
  const t = req.headers.get('x-telegram-key') ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('Telegram bot token missing. Add it in Settings → API Keys.');
  return t;
}

async function tg(token: string, method: string, body?: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json() as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) throw new Error(`Telegram error: ${data.description ?? 'unknown'}`);
  return data.result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'me';
    const token = getToken(req);
    if (action === 'me') return Response.json({ me: await tg(token, 'getMe') });
    if (action === 'updates') return Response.json({ updates: await tg(token, 'getUpdates') });
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
    const body = await req.json() as { action: 'send'; chatId: string | number; text: string };
    if (body.action !== 'send') return new Response('Unknown action', { status: 400 });
    const result = await tg(token, 'sendMessage', { chat_id: body.chatId, text: body.text });
    return Response.json({ sent: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = /missing|token|key|auth|unauthor/i.test(msg);
    return new Response(msg, { status: isAuth ? 401 : 500 });
  }
}
