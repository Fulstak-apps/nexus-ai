import { NextRequest, NextResponse } from 'next/server';
import { listSandbox, readSandboxFile, writeSandboxFile, SANDBOX_ROOT } from '@/agent/tools/executor';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');

  if (file) {
    const content = await readSandboxFile(file);
    if (content === null) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ file, content });
  }

  const items = await listSandbox();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  // Accepts either JSON { name, content } or multipart form data (file upload)
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const target = path.resolve(SANDBOX_ROOT, safeName);
    if (!target.startsWith(SANDBOX_ROOT)) {
      return NextResponse.json({ error: 'bad path' }, { status: 400 });
    }
    await fs.writeFile(target, buf);
    return NextResponse.json({ uploaded: true, name: safeName, size: buf.length });
  }

  const { name, content } = await req.json() as { name: string; content: string };
  if (!name || typeof content !== 'string') {
    return NextResponse.json({ error: 'name and content required' }, { status: 400 });
  }
  await writeSandboxFile(name, content);
  return NextResponse.json({ written: true, name });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const target = path.resolve(SANDBOX_ROOT, file);
  if (!target.startsWith(SANDBOX_ROOT)) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }
  try {
    await fs.unlink(target);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'delete failed' }, { status: 500 });
  }
}
