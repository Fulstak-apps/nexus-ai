import { NextRequest, NextResponse } from 'next/server';
import { listJobs, getJob, deleteJob, clearCompletedJobs } from '@/agent/jobs/queue';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ job });
  }

  const jobs = await listJobs();
  return NextResponse.json({ jobs });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const clearDone = searchParams.get('clearDone');

  if (clearDone) {
    const count = await clearCompletedJobs();
    return NextResponse.json({ cleared: count });
  }

  if (id) {
    await deleteJob(id);
    return NextResponse.json({ deleted: true });
  }

  return NextResponse.json({ error: 'id or clearDone required' }, { status: 400 });
}
