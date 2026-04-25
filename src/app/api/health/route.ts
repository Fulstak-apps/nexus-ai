import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
const SANDBOX_ROOT = path.join(process.cwd(), '.nexus-sandbox');

interface CheckResult { ok: boolean; latencyMs?: number; detail?: string }

async function checkOllama(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const r = await fetch(`${OLLAMA_BASE}/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return { ok: false, detail: `HTTP ${r.status}`, latencyMs: Date.now() - start };
    const data = await r.json() as { data?: Array<{ id: string }> };
    return {
      ok: true,
      latencyMs: Date.now() - start,
      detail: `${data.data?.length ?? 0} models loaded`,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkSandbox(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    const probe = path.join(SANDBOX_ROOT, '.health-probe');
    await fs.writeFile(probe, 'ok');
    await fs.unlink(probe);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const [ollama, sandbox] = await Promise.all([checkOllama(), checkSandbox()]);
  const memory = process.memoryUsage();
  const uptime = Math.round(process.uptime());

  const overall = ollama.ok && sandbox.ok;

  return NextResponse.json(
    {
      status: overall ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { ollama, sandbox },
      runtime: {
        uptimeSeconds: uptime,
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
        nodeVersion: process.version,
      },
    },
    { status: overall ? 200 : 503 },
  );
}
