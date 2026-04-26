import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SANDBOX_ROOT } from '@/agent/tools/executor';

export const runtime = 'nodejs';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.mp4':  'video/mp4',
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.map(decodeURIComponent).join('/');

  const target = path.resolve(SANDBOX_ROOT, rel);
  if (!target.startsWith(SANDBOX_ROOT)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Block internal sync files
  if (rel.startsWith('_') || rel.includes('/_')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      return new NextResponse('Not a file', { status: 400 });
    }
    const buf = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream';

    // Use Uint8Array view to satisfy Next.js BodyInit type
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
