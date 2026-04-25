import { NextRequest, NextResponse } from 'next/server';
import { loadUserProfile, saveUserProfile } from '@/agent/memory/store';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await loadUserProfile();
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Partial<Awaited<ReturnType<typeof loadUserProfile>>>;
  const current = await loadUserProfile();
  const updated = {
    ...current,
    ...body,
    preferences: { ...current.preferences, ...(body.preferences ?? {}) },
    updatedAt: Date.now(),
  };
  await saveUserProfile(updated);
  return NextResponse.json({ profile: updated });
}
