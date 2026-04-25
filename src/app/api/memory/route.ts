import { NextRequest, NextResponse } from 'next/server';
import { listAllMemories, searchMemory, clearMemories, memoryStats, addMemory } from '@/agent/memory/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const stats = searchParams.get('stats') === '1';

  if (stats) {
    return NextResponse.json(await memoryStats());
  }

  if (q) {
    const results = await searchMemory(q, 20);
    return NextResponse.json({ results });
  }

  const memories = await listAllMemories(100);
  return NextResponse.json({ memories });
}

export async function POST(req: NextRequest) {
  const { content, type = 'insight', metadata } = await req.json() as {
    content: string; type?: 'task'|'insight'|'preference'|'session'; metadata?: Record<string, unknown>;
  };
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });
  const entry = await addMemory(content, type, metadata ?? {});
  return NextResponse.json({ entry });
}

export async function DELETE() {
  await clearMemories();
  return NextResponse.json({ cleared: true });
}
