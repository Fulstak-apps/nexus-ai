/**
 * Smart output compression for shell tool results — RTK-inspired.
 * Reduces token consumption 60-90% on common dev commands by detecting
 * the command shape and applying targeted filters before the LLM sees it.
 *
 * Strategies:
 *   1. Smart Filtering — strip noise/boilerplate
 *   2. Grouping       — aggregate similar items
 *   3. Truncation     — keep head + tail, drop middle
 *   4. Deduplication  — collapse repeated lines with counts
 */

const APPROX_CHARS_PER_TOKEN = 4;

export function estimateTokens(s: string): number {
  return Math.ceil((s ?? '').length / APPROX_CHARS_PER_TOKEN);
}

export interface CompressedOutput {
  text: string;
  originalChars: number;
  compressedChars: number;
  tokensSaved: number;
  strategy: string;
}

interface Filter {
  match: (cmd: string) => boolean;
  apply: (stdout: string, cmd: string) => { text: string; strategy: string };
}

const FILTERS: Filter[] = [
  // ── git status ────────────────────────────────────────────────────────────
  {
    match: c => /^\s*git\s+status\b/.test(c),
    apply: (out) => {
      const lines = out.split('\n');
      const files: string[] = [];
      let branch = '';
      for (const l of lines) {
        const m = l.match(/^On branch\s+(\S+)/);
        if (m) { branch = m[1]; continue; }
        const f = l.match(/^\s*(modified|new file|deleted|renamed|both modified|untracked):\s+(.+)/);
        if (f) files.push(`${f[1].slice(0, 1).toUpperCase()} ${f[2]}`);
        else if (/^\s+(\S+\.\S+)\s*$/.test(l) && !l.includes(':')) {
          files.push(`? ${l.trim()}`);
        }
      }
      if (files.length === 0) return { text: `[${branch || 'git'}] clean`, strategy: 'git-status' };
      const header = branch ? `[${branch}]` : '';
      return { text: `${header} ${files.length} change(s)\n${files.slice(0, 50).join('\n')}${files.length > 50 ? `\n…+${files.length - 50} more` : ''}`, strategy: 'git-status' };
    },
  },

  // ── git log ───────────────────────────────────────────────────────────────
  {
    match: c => /^\s*git\s+log\b/.test(c),
    apply: (out) => {
      // Split on lines starting with "commit " to get per-commit blocks
      const blocks = out.split(/^commit\s+/m).filter(Boolean);
      const commits: Array<{ hash: string; subject: string; author?: string }> = [];
      for (const block of blocks) {
        const lines = block.split('\n');
        const hash = lines[0]?.trim().split(/\s+/)[0]?.slice(0, 7);
        if (!hash) continue;
        const authorLine = lines.find(l => l.startsWith('Author:'));
        const author = authorLine?.replace(/^Author:\s+/, '').split('<')[0].trim();
        // Subject = first non-empty line that's indented (commit message body starts there)
        const subjectLine = lines.find(l => /^\s{4,}\S/.test(l));
        const subject = subjectLine?.trim() ?? '(no message)';
        commits.push({ hash, subject, author });
      }
      if (commits.length === 0) return { text: out.slice(0, 1000), strategy: 'git-log' };
      const lines = commits.map(c => `${c.hash} ${c.subject}${c.author ? ` (${c.author})` : ''}`);
      return { text: lines.join('\n'), strategy: 'git-log' };
    },
  },

  // ── git add/commit/push/pull (terse confirmations) ───────────────────────
  {
    match: c => /^\s*git\s+(add|commit|push|pull)\b/.test(c),
    apply: (out, cmd) => {
      const op = cmd.match(/^\s*git\s+(\w+)/)?.[1] ?? 'git';
      // Pull
      if (op === 'pull') {
        const fs = (out.match(/(\d+)\s+files? changed/) ?? [])[1];
        const ins = (out.match(/(\d+)\s+insertion/) ?? [])[1];
        const del = (out.match(/(\d+)\s+deletion/) ?? [])[1];
        if (fs) return { text: `ok ${fs} files +${ins ?? 0} -${del ?? 0}`, strategy: 'git-terse' };
        if (/Already up to date/.test(out)) return { text: 'ok up-to-date', strategy: 'git-terse' };
      }
      // Commit
      if (op === 'commit') {
        const sha = (out.match(/\[\S+\s+([a-f0-9]+)\]/) ?? [])[1];
        if (sha) return { text: `ok ${sha}`, strategy: 'git-terse' };
      }
      // Push
      if (op === 'push') {
        const branch = (out.match(/->\s+(\S+)/) ?? [])[1];
        if (branch) return { text: `ok -> ${branch}`, strategy: 'git-terse' };
        if (/Everything up-to-date/.test(out)) return { text: 'ok up-to-date', strategy: 'git-terse' };
      }
      if (op === 'add') return { text: 'ok', strategy: 'git-terse' };
      return { text: out.slice(0, 600), strategy: 'git-terse' };
    },
  },

  // ── ls / tree ─────────────────────────────────────────────────────────────
  {
    match: c => /^\s*(ls|tree|find)\b/.test(c),
    apply: (out) => {
      const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 40) return { text: lines.join('\n'), strategy: 'ls-trim' };
      const head = lines.slice(0, 30);
      const tail = lines.slice(-5);
      return { text: `${head.join('\n')}\n…${lines.length - 35} more entries\n${tail.join('\n')}`, strategy: 'ls-trim' };
    },
  },

  // ── grep / rg — group by file ─────────────────────────────────────────────
  {
    match: c => /^\s*(grep|rg|ag|ack)\b/.test(c),
    apply: (out) => {
      const lines = out.split('\n').filter(Boolean);
      const byFile = new Map<string, number>();
      const samples: string[] = [];
      for (const l of lines) {
        const m = l.match(/^([^:]+):(\d+:)?(.+)$/);
        if (m) {
          byFile.set(m[1], (byFile.get(m[1]) ?? 0) + 1);
          if (samples.length < 20) samples.push(l.length > 200 ? l.slice(0, 200) + '…' : l);
        }
      }
      if (byFile.size === 0) return { text: lines.slice(0, 30).join('\n'), strategy: 'grep-group' };
      const summary = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([f, n]) => `${n}× ${f}`);
      return { text: `${lines.length} matches across ${byFile.size} file(s)\n${summary.join('\n')}\n--- samples ---\n${samples.join('\n')}`, strategy: 'grep-group' };
    },
  },

  // ── cat / head / tail / less — limit lines ───────────────────────────────
  {
    match: c => /^\s*(cat|head|tail|less|more)\b/.test(c),
    apply: (out) => {
      const MAX_LINES = 200;
      const lines = out.split('\n');
      if (lines.length <= MAX_LINES) return { text: out, strategy: 'cat-cap' };
      const head = lines.slice(0, 150);
      const tail = lines.slice(-30);
      return { text: `${head.join('\n')}\n… (${lines.length - 180} lines elided) …\n${tail.join('\n')}`, strategy: 'cat-cap' };
    },
  },

  // ── npm/yarn/pnpm test, jest, vitest — failures only ──────────────────────
  {
    match: c => /(jest|vitest|npm\s+test|pnpm\s+test|yarn\s+test|pytest|go\s+test|cargo\s+test)/.test(c),
    apply: (out) => {
      const lines = out.split('\n');
      // Keep summary + any line containing fail / error / FAIL / ✗ / ×
      const failRe = /\b(fail|error|FAILED|FAIL|✗|×|panic|Error:)/i;
      const summaryRe = /(passed|failed|tests?|suites?|tests run|coverage|time:)/i;
      const kept = lines.filter(l => failRe.test(l) || summaryRe.test(l));
      if (kept.length === 0) return { text: out.slice(-1500), strategy: 'test-fails' };
      return { text: kept.slice(0, 100).join('\n'), strategy: 'test-fails' };
    },
  },
];

export function compressBashOutput(stdout: string, command: string): CompressedOutput {
  const originalChars = stdout.length;

  for (const f of FILTERS) {
    if (f.match(command)) {
      const { text, strategy } = f.apply(stdout, command);
      const compressedChars = text.length;
      const tokensSaved = Math.max(0, estimateTokens(stdout) - estimateTokens(text));
      return { text, originalChars, compressedChars, tokensSaved, strategy };
    }
  }

  // Generic dedup: collapse repeated lines
  const lines = stdout.split('\n');
  if (lines.length > 60) {
    const out: string[] = [];
    let prev = '';
    let runLen = 0;
    for (const line of lines) {
      if (line === prev) runLen++;
      else {
        if (runLen > 1) out[out.length - 1] += `  (×${runLen})`;
        out.push(line);
        prev = line;
        runLen = 1;
      }
    }
    if (runLen > 1) out[out.length - 1] += `  (×${runLen})`;
    if (out.length < lines.length * 0.7) {
      const text = out.slice(0, 200).join('\n') + (out.length > 200 ? `\n…+${out.length - 200} more` : '');
      const tokensSaved = Math.max(0, estimateTokens(stdout) - estimateTokens(text));
      return { text, originalChars, compressedChars: text.length, tokensSaved, strategy: 'dedup' };
    }
  }

  // Hard cap at 8000 chars (truncation strategy)
  if (stdout.length > 8000) {
    const text = stdout.slice(0, 6000) + `\n… (truncated, original ${stdout.length} chars) …\n` + stdout.slice(-1500);
    const tokensSaved = Math.max(0, estimateTokens(stdout) - estimateTokens(text));
    return { text, originalChars, compressedChars: text.length, tokensSaved, strategy: 'truncate' };
  }

  return { text: stdout, originalChars, compressedChars: stdout.length, tokensSaved: 0, strategy: 'pass-through' };
}
