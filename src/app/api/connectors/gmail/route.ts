/**
 * Gmail connector.
 *
 * GET  /api/connectors/gmail?action=list&q=…&max=10  → recent inbox messages
 * POST /api/connectors/gmail   { action: "send", to, subject, body } → send mail
 *
 * Uses the OAuth access token from the user's NextAuth session (Google provider).
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { google } from 'googleapis';

export const runtime = 'nodejs';

async function getGmail() {
  const session = await auth();
  if (!session?.accessToken || session.provider !== 'google') {
    throw new Error('Not signed in with Google. Connect Gmail in Settings → Connectors.');
  }
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function GET(req: NextRequest) {
  try {
    const gmail = await getGmail();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'list';
    const q = searchParams.get('q') ?? '';
    const max = Math.min(Number(searchParams.get('max') ?? 10), 50);

    if (action === 'list') {
      const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: max });
      const ids = list.data.messages?.map(m => m.id!).filter(Boolean) ?? [];

      const messages = await Promise.all(ids.slice(0, max).map(async id => {
        const m = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] });
        const headers = m.data.payload?.headers ?? [];
        const h = (n: string) => headers.find(x => x.name?.toLowerCase() === n.toLowerCase())?.value ?? '';
        return {
          id,
          threadId: m.data.threadId,
          snippet: m.data.snippet,
          from: h('From'),
          to: h('To'),
          subject: h('Subject'),
          date: h('Date'),
          unread: m.data.labelIds?.includes('UNREAD') ?? false,
        };
      }));

      return Response.json({ messages, total: list.data.resultSizeEstimate });
    }

    if (action === 'profile') {
      const p = await gmail.users.getProfile({ userId: 'me' });
      return Response.json({ email: p.data.emailAddress, total: p.data.messagesTotal });
    }

    return new Response('Unknown action', { status: 400 });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gmail = await getGmail();
    const body = await req.json() as { action: 'send'; to: string; subject: string; body: string };

    if (body.action !== 'send') return new Response('Unknown action', { status: 400 });

    const raw = Buffer.from(
      `To: ${body.to}\r\nSubject: ${body.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body.body}`,
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return Response.json({ sent: true, id: sent.data.id });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }
}
