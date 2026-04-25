/**
 * Notion connector. Uses the integration token from Settings → API Keys.
 *
 * GET  /api/connectors/notion?action=search&q=…
 * GET  /api/connectors/notion?action=page&id=…
 * POST /api/connectors/notion   { action: "create", parentId, title, content }
 */

import { NextRequest } from 'next/server';
import { Client } from '@notionhq/client';

export const runtime = 'nodejs';

function getClient(req: NextRequest): Client {
  const token = req.headers.get('x-notion-key') ?? process.env.NOTION_TOKEN;
  if (!token) throw new Error('Notion token missing. Add it in Settings → API Keys.');
  return new Client({ auth: token });
}

export async function GET(req: NextRequest) {
  try {
    const notion = getClient(req);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'search';

    if (action === 'search') {
      const q = searchParams.get('q') ?? '';
      const r = await notion.search({ query: q, page_size: 20 });
      return Response.json({
        results: r.results.map(item => {
          const obj = item as { id: string; object: string; properties?: Record<string, unknown>; url?: string; last_edited_time?: string };
          return {
            id: obj.id,
            type: obj.object,
            url: obj.url,
            updatedAt: obj.last_edited_time,
            // Best-effort title extraction
            title: extractTitle(obj.properties),
          };
        }),
      });
    }

    if (action === 'page') {
      const id = searchParams.get('id');
      if (!id) return new Response('Missing id', { status: 400 });
      const page = await notion.pages.retrieve({ page_id: id });
      const blocks = await notion.blocks.children.list({ block_id: id, page_size: 100 });
      return Response.json({ page, blocks: blocks.results });
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
    const notion = getClient(req);
    const body = await req.json() as { action: 'create'; parentId: string; title: string; content?: string };
    if (body.action !== 'create') return new Response('Unknown action', { status: 400 });

    const page = await notion.pages.create({
      parent: { page_id: body.parentId },
      properties: {
        title: { title: [{ text: { content: body.title } }] },
      },
      children: body.content ? [{
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: body.content } }] },
      }] : [],
    });

    return Response.json({ created: true, id: page.id, url: 'url' in page ? page.url : null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = /missing|token|key|auth|unauthor/i.test(msg);
    return new Response(msg, { status: isAuth ? 401 : 500 });
  }
}

function extractTitle(properties: Record<string, unknown> | undefined): string {
  if (!properties) return '';
  for (const v of Object.values(properties)) {
    const prop = v as { type?: string; title?: Array<{ plain_text?: string }> };
    if (prop?.type === 'title' && prop.title?.length) {
      return prop.title.map(t => t.plain_text ?? '').join('');
    }
  }
  return '';
}
