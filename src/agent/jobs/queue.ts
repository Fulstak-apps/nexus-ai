/**
 * Background Job Queue
 *
 * Jobs persist to disk in .nexus-jobs/ so they survive client disconnects.
 * The agent API route writes jobs here; the /api/jobs route polls them.
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { BackgroundJob, JobStatus, AgentMode } from '@/types';

const JOBS_DIR = path.join(process.cwd(), '.nexus-jobs');

async function ensureJobsDir() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
}

async function jobPath(id: string) {
  return path.join(JOBS_DIR, `${id}.json`);
}

export async function createJob(
  title: string,
  description: string,
  mode: AgentMode = 'background',
): Promise<BackgroundJob> {
  await ensureJobsDir();
  const job: BackgroundJob = {
    id: randomUUID(),
    title,
    description,
    status: 'queued',
    progress: 0,
    createdAt: Date.now(),
    mode,
  };
  await fs.writeFile(await jobPath(job.id), JSON.stringify(job, null, 2), 'utf-8');
  return job;
}

export async function updateJob(id: string, updates: Partial<BackgroundJob>): Promise<void> {
  const p = await jobPath(id);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const job: BackgroundJob = JSON.parse(raw);
    const updated = { ...job, ...updates };
    await fs.writeFile(p, JSON.stringify(updated, null, 2), 'utf-8');
  } catch {
    // job may not exist if deleted
  }
}

export async function getJob(id: string): Promise<BackgroundJob | null> {
  try {
    const raw = await fs.readFile(await jobPath(id), 'utf-8');
    return JSON.parse(raw) as BackgroundJob;
  } catch {
    return null;
  }
}

export async function listJobs(): Promise<BackgroundJob[]> {
  await ensureJobsDir();
  try {
    const files = await fs.readdir(JOBS_DIR);
    const jobs = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          try {
            const raw = await fs.readFile(path.join(JOBS_DIR, f), 'utf-8');
            return JSON.parse(raw) as BackgroundJob;
          } catch {
            return null;
          }
        })
    );
    return jobs
      .filter((j): j is BackgroundJob => j !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteJob(id: string): Promise<void> {
  try {
    await fs.unlink(await jobPath(id));
  } catch {
    // already deleted
  }
}

export async function clearCompletedJobs(): Promise<number> {
  const jobs = await listJobs();
  const done = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');
  await Promise.all(done.map(j => deleteJob(j.id)));
  return done.length;
}

export async function markJobRunning(id: string): Promise<void> {
  await updateJob(id, { status: 'running' as JobStatus, startedAt: Date.now(), progress: 5 });
}

export async function markJobProgress(id: string, progress: number): Promise<void> {
  await updateJob(id, { progress: Math.min(99, Math.max(0, progress)) });
}

export async function markJobComplete(id: string, result: string): Promise<void> {
  await updateJob(id, {
    status: 'completed' as JobStatus,
    progress: 100,
    result,
    completedAt: Date.now(),
  });
}

export async function markJobFailed(id: string, error: string): Promise<void> {
  await updateJob(id, {
    status: 'failed' as JobStatus,
    error,
    completedAt: Date.now(),
  });
}
