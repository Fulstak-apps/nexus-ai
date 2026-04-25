import { ToolCall, ToolResult, ToolName } from '@/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Sandbox root — all file operations are constrained here
export const SANDBOX_ROOT = path.join(process.cwd(), '.nexus-sandbox');

export async function listSandbox(): Promise<Array<{ name: string; size: number; modifiedAt: number; isDirectory: boolean }>> {
  try {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    const names = await fs.readdir(SANDBOX_ROOT);
    const items = await Promise.all(names.map(async n => {
      const stat = await fs.stat(path.join(SANDBOX_ROOT, n));
      return {
        name: n,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        isDirectory: stat.isDirectory(),
      };
    }));
    return items.sort((a, b) => b.modifiedAt - a.modifiedAt);
  } catch {
    return [];
  }
}

export async function readSandboxFile(name: string): Promise<string | null> {
  try {
    const p = path.resolve(SANDBOX_ROOT, name);
    if (!p.startsWith(SANDBOX_ROOT)) return null;
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeSandboxFile(name: string, content: string): Promise<void> {
  await fs.mkdir(SANDBOX_ROOT, { recursive: true });
  const p = path.resolve(SANDBOX_ROOT, name);
  if (!p.startsWith(SANDBOX_ROOT)) throw new Error('Path escape blocked');
  await fs.writeFile(p, content, 'utf-8');
}

async function ensureSandbox() {
  await fs.mkdir(SANDBOX_ROOT, { recursive: true });
}

function sandboxPath(p: string): string {
  const resolved = path.resolve(SANDBOX_ROOT, p.replace(/^\//, ''));
  if (!resolved.startsWith(SANDBOX_ROOT)) {
    throw new Error(`Path escape attempt blocked: ${p}`);
  }
  return resolved;
}

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function handleFileRead(params: Record<string, unknown>): Promise<unknown> {
  await ensureSandbox();
  const filePath = sandboxPath(String(params.path));
  const content = await fs.readFile(filePath, 'utf-8');
  return { content, bytes: content.length };
}

async function handleFileWrite(params: Record<string, unknown>): Promise<unknown> {
  await ensureSandbox();
  const filePath = sandboxPath(String(params.path));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, String(params.content), 'utf-8');
  return { written: true, path: filePath, bytes: String(params.content).length };
}

async function handleFileDelete(params: Record<string, unknown>): Promise<unknown> {
  if (!params.confirm) throw new Error('Deletion requires confirm: true');
  await ensureSandbox();
  const filePath = sandboxPath(String(params.path));
  await fs.unlink(filePath);
  return { deleted: true, path: filePath };
}

async function handleCodeExecute(params: Record<string, unknown>): Promise<unknown> {
  const lang = String(params.language).toLowerCase();
  const code = String(params.code);
  const timeout = Number(params.timeout ?? 30) * 1000;

  if (!['python', 'node', 'python3'].includes(lang)) {
    throw new Error(`Unsupported language: ${lang}`);
  }

  await ensureSandbox();
  const ext = lang.startsWith('python') ? 'py' : 'js';
  const scriptPath = path.join(SANDBOX_ROOT, `exec_${Date.now()}.${ext}`);

  try {
    await fs.writeFile(scriptPath, code, 'utf-8');
    const cmd = lang.startsWith('python') ? `python3 "${scriptPath}"` : `node "${scriptPath}"`;
    const { stdout, stderr } = await execAsync(cmd, { timeout });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } finally {
    await fs.unlink(scriptPath).catch(() => {});
  }
}

async function handleHttpRequest(params: Record<string, unknown>): Promise<unknown> {
  const { url, method = 'GET', headers = {}, body } = params as {
    url: string; method: string; headers?: Record<string, string>; body?: string;
  };

  const response = await fetch(url, {
    method,
    headers: { 'User-Agent': 'Nexus-AI/1.0', ...headers },
    body: body ?? undefined,
  });

  const text = await response.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = null; }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: json ?? text,
  };
}

async function handleWebSearch(params: Record<string, unknown>): Promise<unknown> {
  const query = String(params.query);
  const maxResults = Number(params.maxResults ?? 5);

  const { getUserKey } = await import('../core/anthropic');
  const tavilyKey = getUserKey('tavily') || process.env.TAVILY_API_KEY;

  if (tavilyKey) {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
    });
    const data = await r.json() as { results: Array<{ title: string; url: string; content: string }>; answer?: string };
    return {
      query,
      answer: data.answer,
      results: (data.results ?? []).map(x => ({ title: x.title, url: x.url, snippet: x.content })),
    };
  }

  // Fallback: scrape DuckDuckGo HTML endpoint
  const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    },
  });
  const html = await resp.text();

  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    const url = decodeURIComponent(match[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]);
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();
    if (url.startsWith('http')) {
      results.push({ title, url, snippet });
    }
  }

  return { query, results, source: 'duckduckgo' };
}

async function handleWebFetch(params: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(String(params.url), {
    headers: { 'User-Agent': 'Nexus-AI/1.0' },
  });
  const html = await response.text();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
  return { url: params.url, text, status: response.status };
}

async function handleBrowserNavigate(params: Record<string, unknown>): Promise<unknown> {
  const url = String(params.url);
  const extractMode = String(params.extract ?? 'all');

  // Try Playwright first (handles JS-rendered pages, allows follow-up click/fill)
  try {
    const { browserNavigate } = await import('./browser');
    return await browserNavigate(url, extractMode);
  } catch (err) {
    // If Playwright fails (binary missing, sandboxed env), fall back to fetch+regex
    console.warn('[browser_navigate] Playwright failed, falling back to fetch:', err instanceof Error ? err.message : err);
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const html = await response.text();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  // Extract headings
  const headings: string[] = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const text = hMatch[2].replace(/<[^>]+>/g, '').trim();
    if (text) headings.push(`H${hMatch[1]}: ${text}`);
  }

  // Extract links
  const links: Array<{ text: string; href: string }> = [];
  if (extractMode === 'all' || extractMode === 'links') {
    const linkRegex = /<a[^>]+href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let lMatch;
    const base = new URL(url);
    while ((lMatch = linkRegex.exec(html)) !== null && links.length < 30) {
      const href = lMatch[1].startsWith('http') ? lMatch[1] : `${base.origin}${lMatch[1]}`;
      const text = lMatch[2].replace(/<[^>]+>/g, '').trim();
      if (text && href) links.push({ text: text.slice(0, 80), href });
    }
  }

  // Extract forms
  const forms: Array<{ action: string; method: string; fields: string[] }> = [];
  if (extractMode === 'all' || extractMode === 'forms') {
    const formRegex = /<form[^>]*action="([^"]*)"[^>]*method="([^"]*)"[^>]*>([\s\S]*?)<\/form>/gi;
    let fMatch;
    while ((fMatch = formRegex.exec(html)) !== null) {
      const fieldRegex = /(?:name|id)="([^"]+)"/gi;
      const fields: string[] = [];
      let fldMatch;
      while ((fldMatch = fieldRegex.exec(fMatch[3])) !== null) {
        if (!fields.includes(fldMatch[1])) fields.push(fldMatch[1]);
      }
      forms.push({ action: fMatch[1], method: fMatch[2], fields });
    }
  }

  // Extract main text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);

  return {
    url,
    status: response.status,
    title,
    headings: headings.slice(0, 20),
    links: links.slice(0, 30),
    forms,
    text,
  };
}

async function handleDataAnalyze(params: Record<string, unknown>): Promise<unknown> {
  let rawData = String(params.data);
  const task = String(params.task ?? 'summary');

  // If it looks like a file path, try to load from sandbox
  if (rawData.length < 200 && !rawData.includes('\n') && !rawData.startsWith('{') && !rawData.startsWith('[')) {
    const fromFile = await readSandboxFile(rawData);
    if (fromFile) rawData = fromFile;
  }

  // Auto-detect format
  const formatHint = String(params.format ?? '');
  const isJson = formatHint === 'json' || (rawData.trimStart().startsWith('{') || rawData.trimStart().startsWith('['));

  let parsed: unknown[] = [];

  if (isJson) {
    const j = JSON.parse(rawData);
    parsed = Array.isArray(j) ? j : [j];
  } else {
    // CSV parsing
    const lines = rawData.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV requires at least a header row + data row');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    parsed = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    });
  }

  const rows = parsed as Record<string, unknown>[];
  if (!rows.length) throw new Error('No data rows found');

  const columns = Object.keys(rows[0]);

  // Compute numeric stats per column
  const stats: Record<string, unknown> = {};
  for (const col of columns) {
    const vals = rows.map(r => r[col]).filter(v => v !== '' && v !== null && v !== undefined);
    const nums = vals.map(v => parseFloat(String(v))).filter(n => !isNaN(n));

    if (nums.length > 0) {
      const sorted = [...nums].sort((a, b) => a - b);
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length;
      stats[col] = {
        type: 'numeric',
        count: nums.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: Math.round(mean * 100) / 100,
        median: sorted[Math.floor(sorted.length / 2)],
        stddev: Math.round(Math.sqrt(variance) * 100) / 100,
        // Detect outliers using IQR
        outliers: task === 'outliers' || task === 'all' ? (() => {
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          return nums.filter(n => n < q1 - 1.5 * iqr || n > q3 + 1.5 * iqr).slice(0, 10);
        })() : undefined,
      };
    } else {
      const freq: Record<string, number> = {};
      for (const v of vals) { const s = String(v); freq[s] = (freq[s] ?? 0) + 1; }
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
      stats[col] = {
        type: 'categorical',
        count: vals.length,
        unique: Object.keys(freq).length,
        topValues: top.map(([val, cnt]) => ({ val, cnt })),
      };
    }
  }

  return {
    rows: rows.length,
    columns: columns.length,
    columnNames: columns,
    stats,
    sample: rows.slice(0, 3),
  };
}

async function handleImageGenerate(params: Record<string, unknown>): Promise<unknown> {
  const prompt = String(params.prompt);
  const style = String(params.style ?? 'realistic');
  const size = String(params.size ?? 'square');

  const sizeMap: Record<string, string> = {
    square: '1024x1024',
    landscape: '1792x1024',
    portrait: '1024x1792',
  };

  const dalleSize = sizeMap[size] ?? '1024x1024';
  const enhancedPrompt = style !== 'realistic' ? `${prompt}, ${style} style` : prompt;

  if (process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: dalleSize,
        response_format: 'b64_json',
      }),
    });

    const data = await r.json() as { data?: Array<{ b64_json: string }>; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data returned');

    await ensureSandbox();
    const filename = `image_${Date.now()}.png`;
    const imgPath = path.join(SANDBOX_ROOT, filename);
    await fs.writeFile(imgPath, Buffer.from(b64, 'base64'));

    return { filename, size: dalleSize, prompt: enhancedPrompt, saved: true };
  }

  // Free fallback: Pollinations.ai (no API key, no rate limits for casual use)
  const [w, h] = dalleSize.split('x').map(Number);
  const seed = Math.floor(Math.random() * 1_000_000);
  const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true`;

  const imgResp = await fetch(pollUrl, {
    headers: { 'User-Agent': 'Nexus-AI/1.0' },
  });

  if (!imgResp.ok) {
    throw new Error(`Image generation failed: ${imgResp.status} ${imgResp.statusText}`);
  }

  const buf = Buffer.from(await imgResp.arrayBuffer());
  await ensureSandbox();
  const filename = `image_${Date.now()}.png`;
  await fs.writeFile(path.join(SANDBOX_ROOT, filename), buf);

  return {
    filename,
    size: dalleSize,
    prompt: enhancedPrompt,
    saved: true,
    provider: 'pollinations',
    bytes: buf.length,
  };
}

async function handleBrowserClick(params: Record<string, unknown>): Promise<unknown> {
  const { browserClick } = await import('./browser');
  return await browserClick(String(params.selector));
}

async function handleBrowserFill(params: Record<string, unknown>): Promise<unknown> {
  const { browserFill } = await import('./browser');
  return await browserFill(String(params.selector), String(params.value));
}

async function handleBrowserScreenshot(params: Record<string, unknown>): Promise<unknown> {
  const { browserScreenshot } = await import('./browser');
  return await browserScreenshot(Boolean(params.fullPage));
}

async function handleStockQuote(params: Record<string, unknown>): Promise<unknown> {
  const symbol = String(params.symbol).toUpperCase();
  const range = String(params.range ?? '1mo');
  const interval = range === '1d' ? '5m' : range === '5d' ? '15m' : range === '1mo' ? '1d' : range === '3mo' ? '1d' : '1wk';

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'application/json',
    },
  });
  if (!r.ok) throw new Error(`Yahoo Finance error: ${r.status} ${r.statusText}`);
  const data = await r.json() as {
    chart: {
      result?: Array<{
        meta: { regularMarketPrice: number; previousClose: number; currency: string; exchangeName: string; symbol: string; longName?: string; shortName?: string; regularMarketDayHigh?: number; regularMarketDayLow?: number; fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number };
        timestamp?: number[];
        indicators: { quote: Array<{ close?: (number | null)[]; open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; volume?: (number | null)[] }> };
      }>;
      error?: { description: string };
    };
  };

  if (data.chart.error) throw new Error(data.chart.error.description);
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`No data for ${symbol}`);

  const meta = result.meta;
  const change = meta.regularMarketPrice - meta.previousClose;
  const changePct = (change / meta.previousClose) * 100;

  const closes = result.indicators.quote[0]?.close ?? [];
  const timestamps = result.timestamp ?? [];
  const history = timestamps.map((t, i) => ({
    t: new Date(t * 1000).toISOString(),
    close: closes[i],
  })).filter(p => p.close != null);

  return {
    symbol: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    exchange: meta.exchangeName,
    currency: meta.currency,
    price: Math.round(meta.regularMarketPrice * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePct * 100) / 100,
    dayHigh: meta.regularMarketDayHigh,
    dayLow: meta.regularMarketDayLow,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    range,
    historyPoints: history.length,
    historyTail: history.slice(-20),
  };
}

async function handleTtsGenerate(params: Record<string, unknown>): Promise<unknown> {
  const text = String(params.text);
  const voice = String(params.voice ?? 'Rachel');
  const { getUserKey } = await import('../core/anthropic');
  const apiKey = getUserKey('elevenlabs') || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs key not set. Add it in Settings → API Keys.');
  }

  // Resolve voice name → ID via voices list, fall back to Rachel default
  const VOICE_DEFAULTS: Record<string, string> = {
    Rachel: '21m00Tcm4TlvDq8ikWAM',
    Adam: 'pNInz6obpgDQGcFmaJgB',
    Bella: 'EXAVITQu4vr4xnSDxMAl',
    Antoni: 'ErXwobaYiN019PkySvjV',
    Elli: 'MF3mGyEYCl7XYWbV9V6O',
    Josh: 'TxGEqnHWrfWFTfGW9XjX',
  };
  const voiceId = VOICE_DEFAULTS[voice] ?? voice;

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!r.ok) throw new Error(`ElevenLabs error: ${r.status} ${await r.text().catch(() => r.statusText)}`);

  const buf = Buffer.from(await r.arrayBuffer());
  await ensureSandbox();
  const filename = `tts_${Date.now()}.mp3`;
  await fs.writeFile(path.join(SANDBOX_ROOT, filename), buf);

  return { filename, voice, voiceId, bytes: buf.length, characters: text.length, saved: true };
}

async function handleSpawnAgent(params: Record<string, unknown>): Promise<unknown> {
  const task = String(params.task);
  const role = String(params.role ?? 'assistant');
  const context = params.context ? String(params.context) : '';

  // Import here to avoid circular dependency
  const { runSubAgent } = await import('../orchestrator/sub-agent');
  return await runSubAgent(task, role, context);
}

async function handleCreatePresentation(params: Record<string, unknown>): Promise<unknown> {
  const title = String(params.title);
  const sectionsRaw = String(params.sections);
  const theme = String(params.theme ?? 'dark');

  interface Section { title: string; content: string; bullets?: string[]; notes?: string }
  let sections: Section[];
  try {
    sections = JSON.parse(sectionsRaw);
  } catch {
    throw new Error('sections must be a valid JSON array');
  }

  const themes: Record<string, { bg: string; fg: string; accent: string; slide: string; header: string }> = {
    dark: {
      bg: '#0f0f1a',
      fg: '#e2e8f0',
      accent: '#4F8EF7',
      slide: '#1a1a2e',
      header: '#4F8EF7',
    },
    light: {
      bg: '#f8fafc',
      fg: '#1e293b',
      accent: '#2563eb',
      slide: '#ffffff',
      header: '#2563eb',
    },
    corporate: {
      bg: '#1e3a5f',
      fg: '#f1f5f9',
      accent: '#38bdf8',
      slide: '#1e3a5f',
      header: '#38bdf8',
    },
    minimal: {
      bg: '#ffffff',
      fg: '#111827',
      accent: '#111827',
      slide: '#ffffff',
      header: '#111827',
    },
  };

  const t = themes[theme] ?? themes.dark;

  const slideHtml = sections.map((s, i) => `
    <div class="slide" id="slide-${i + 1}">
      <div class="slide-number">${i + 1} / ${sections.length}</div>
      <h2 class="slide-title">${s.title}</h2>
      <div class="slide-content">
        ${s.content ? `<p class="slide-text">${s.content}</p>` : ''}
        ${s.bullets && s.bullets.length ? `<ul class="slide-bullets">${s.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
      </div>
      ${s.notes ? `<div class="slide-notes">Notes: ${s.notes}</div>` : ''}
    </div>
  `).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${t.bg}; color: ${t.fg}; font-family: 'Segoe UI', system-ui, sans-serif; }
  .deck { width: 100%; }
  .slide {
    display: none;
    min-height: 100vh;
    padding: 60px 80px;
    background: ${t.slide};
    position: relative;
    flex-direction: column;
    justify-content: center;
  }
  .slide.active { display: flex; }
  .slide-number {
    position: absolute;
    bottom: 24px;
    right: 40px;
    font-size: 13px;
    opacity: 0.4;
  }
  .slide-title {
    font-size: 42px;
    font-weight: 700;
    color: ${t.header};
    margin-bottom: 32px;
    line-height: 1.2;
  }
  .slide-content { flex: 1; }
  .slide-text { font-size: 22px; line-height: 1.6; opacity: 0.9; margin-bottom: 20px; }
  .slide-bullets { list-style: none; space-y: 12px; }
  .slide-bullets li {
    font-size: 20px;
    padding: 8px 0 8px 32px;
    position: relative;
    opacity: 0.9;
    line-height: 1.5;
  }
  .slide-bullets li::before {
    content: '▸';
    color: ${t.accent};
    position: absolute;
    left: 0;
    font-size: 16px;
  }
  .slide-notes {
    position: absolute;
    bottom: 60px;
    left: 80px;
    right: 80px;
    font-size: 13px;
    opacity: 0.4;
    font-style: italic;
    border-top: 1px solid currentColor;
    padding-top: 8px;
  }
  nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
  }
  button {
    background: ${t.accent};
    color: #fff;
    border: none;
    padding: 8px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }
  button:disabled { opacity: 0.3; cursor: default; }
  .cover {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, ${t.bg} 0%, ${t.slide} 100%);
    text-align: center;
    padding: 60px;
  }
  .cover h1 { font-size: 56px; font-weight: 800; color: ${t.accent}; margin-bottom: 16px; line-height: 1.1; }
  .cover p { font-size: 22px; opacity: 0.6; margin-bottom: 40px; }
  .cover .start-btn { font-size: 16px; padding: 12px 40px; }
</style>
</head>
<body>
<div id="cover" class="cover">
  <h1>${title}</h1>
  <p>${sections.length} slides</p>
  <button class="start-btn" onclick="goTo(1)">Start Presentation →</button>
</div>
<div class="deck" id="deck" style="display:none">
${slideHtml}
</div>
<nav id="nav" style="display:none">
  <button onclick="prev()" id="prevBtn">← Prev</button>
  <span id="counter" style="display:flex;align-items:center;color:${t.fg};opacity:0.6;font-size:14px;"></span>
  <button onclick="next()" id="nextBtn">Next →</button>
</nav>
<script>
  let current = 1;
  const total = ${sections.length};
  function goTo(n) {
    document.getElementById('cover').style.display = 'none';
    document.getElementById('deck').style.display = 'block';
    document.getElementById('nav').style.display = 'flex';
    document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
    current = Math.max(1, Math.min(n, total));
    document.getElementById('slide-' + current).classList.add('active');
    document.getElementById('prevBtn').disabled = current === 1;
    document.getElementById('nextBtn').disabled = current === total;
    document.getElementById('counter').textContent = current + ' / ' + total;
  }
  function prev() { goTo(current - 1); }
  function next() { goTo(current + 1); }
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') next();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'Escape') { document.getElementById('cover').style.display='flex'; document.getElementById('deck').style.display='none'; document.getElementById('nav').style.display='none'; }
  });
</script>
</body>
</html>`;

  await ensureSandbox();
  const filename = `presentation_${Date.now()}.html`;
  await writeSandboxFile(filename, html);

  return {
    filename,
    slides: sections.length,
    title,
    theme,
    saved: true,
    note: `Open ${filename} from the Files tab to view the presentation`,
  };
}

// ─── OpenManus-style tools ────────────────────────────────────────────────────

async function handleBash(params: Record<string, unknown>): Promise<unknown> {
  const command = String(params.command);
  const timeout = Number(params.timeout ?? 60) * 1000;
  const cwd = params.cwd ? sandboxPath(String(params.cwd)) : SANDBOX_ROOT;
  await ensureSandbox();

  // Block obviously destructive commands by default
  const banned = /\brm\s+-rf\s+\/(?!\S*\.nexus-sandbox)|:\(\)\s*\{\s*:\|:&\s*\}|>\s*\/dev\/sd[a-z]/i;
  if (banned.test(command)) throw new Error('Refused: command pattern blocked');

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd,
      maxBuffer: 4 * 1024 * 1024,
      shell: '/bin/bash',
    });
    return { stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 4000), exitCode: 0, command };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean; message?: string };
    return {
      stdout: (e.stdout ?? '').slice(0, 8000),
      stderr: (e.stderr ?? e.message ?? '').slice(0, 4000),
      exitCode: e.code ?? 1,
      timedOut: !!e.killed,
      command,
    };
  }
}

async function handleStrReplace(params: Record<string, unknown>): Promise<unknown> {
  await ensureSandbox();
  const filePath = sandboxPath(String(params.path));
  const oldStr = String(params.old_str);
  const newStr = String(params.new_str);

  const content = await fs.readFile(filePath, 'utf-8');
  const occurrences = content.split(oldStr).length - 1;

  if (occurrences === 0) throw new Error('old_str not found in file');
  if (occurrences > 1) throw new Error(`old_str matches ${occurrences} times — must be unique. Add more surrounding context.`);

  const updated = content.replace(oldStr, newStr);
  await fs.writeFile(filePath, updated, 'utf-8');

  // Return a small diff context
  const idx = content.indexOf(oldStr);
  const before = content.slice(Math.max(0, idx - 60), idx);
  const after = content.slice(idx + oldStr.length, idx + oldStr.length + 60);
  return {
    edited: true,
    path: filePath,
    bytesBefore: content.length,
    bytesAfter: updated.length,
    context: `…${before}[${oldStr.slice(0, 40)}…→${newStr.slice(0, 40)}…]${after}…`,
  };
}

// ask_human is handled at the loop level — this is a stub so the registry
// resolves. The agent loop intercepts it and surfaces the question to the UI.
async function handleAskHuman(params: Record<string, unknown>): Promise<unknown> {
  return {
    pending: true,
    question: String(params.question),
    options: params.options ?? null,
    note: 'Question surfaced to user — agent should pause and await reply.',
  };
}

// terminate is handled by the loop too; stub returns the summary.
async function handleTerminate(params: Record<string, unknown>): Promise<unknown> {
  return {
    terminated: true,
    summary: String(params.summary),
    success: params.success !== false,
  };
}

async function handleChartCreate(params: Record<string, unknown>): Promise<unknown> {
  const title = String(params.title);
  const type = String(params.type).toLowerCase();
  const validTypes = ['line', 'bar', 'pie', 'doughnut', 'scatter'];
  if (!validTypes.includes(type)) throw new Error(`type must be one of ${validTypes.join(', ')}`);

  const labels = JSON.parse(String(params.labels)) as unknown[];
  const rawData = JSON.parse(String(params.data));

  let datasets: Array<{ label: string; data: number[]; backgroundColor?: string | string[]; borderColor?: string }>;
  const palette = ['#4F8EF7', '#22D3EE', '#A855F7', '#F472B6', '#FBBF24', '#34D399', '#F87171', '#60A5FA'];

  if (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === 'object' && rawData[0] !== null && 'data' in rawData[0]) {
    datasets = (rawData as Array<{ label: string; data: number[] }>).map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: type === 'pie' || type === 'doughnut' ? palette : palette[i % palette.length] + '80',
      borderColor: palette[i % palette.length],
    }));
  } else {
    datasets = [{
      label: title,
      data: rawData as number[],
      backgroundColor: type === 'pie' || type === 'doughnut' ? palette : palette[0] + '80',
      borderColor: palette[0],
    }];
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  body { background:#0f0f12; color:#e2e8f0; font-family:system-ui,sans-serif; margin:0; padding:40px; }
  .wrap { max-width:900px; margin:0 auto; background:#1a1a1f; border-radius:16px; padding:32px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  h1 { margin:0 0 24px; font-size:24px; font-weight:700; }
</style></head>
<body><div class="wrap"><h1>${title}</h1><canvas id="c"></canvas></div>
<script>
new Chart(document.getElementById('c'), {
  type: ${JSON.stringify(type)},
  data: { labels: ${JSON.stringify(labels)}, datasets: ${JSON.stringify(datasets)} },
  options: {
    responsive: true,
    plugins: { legend: { labels: { color:'#e2e8f0' } } },
    scales: ${type === 'pie' || type === 'doughnut' ? '{}' : `{
      x: { ticks: { color:'#94a3b8' }, grid: { color:'rgba(255,255,255,0.05)' } },
      y: { ticks: { color:'#94a3b8' }, grid: { color:'rgba(255,255,255,0.05)' } }
    }`}
  }
});
</script></body></html>`;

  await ensureSandbox();
  const filename = `chart_${Date.now()}.html`;
  await writeSandboxFile(filename, html);

  return { filename, type, title, points: Array.isArray(labels) ? labels.length : 0, saved: true };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

const HANDLERS: Record<ToolName, (p: Record<string, unknown>) => Promise<unknown>> = {
  file_read: handleFileRead,
  file_write: handleFileWrite,
  file_delete: handleFileDelete,
  code_execute: handleCodeExecute,
  http_request: handleHttpRequest,
  web_search: handleWebSearch,
  web_fetch: handleWebFetch,
  browser_navigate: handleBrowserNavigate,
  data_analyze: handleDataAnalyze,
  image_generate: handleImageGenerate,
  spawn_agent: handleSpawnAgent,
  create_presentation: handleCreatePresentation,
  stock_quote: handleStockQuote,
  tts_generate: handleTtsGenerate,
  browser_click: handleBrowserClick,
  browser_fill: handleBrowserFill,
  browser_screenshot: handleBrowserScreenshot,
  bash: handleBash,
  str_replace: handleStrReplace,
  ask_human: handleAskHuman,
  terminate: handleTerminate,
  chart_create: handleChartCreate,
};

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const start = Date.now();
  const handler = HANDLERS[call.tool];

  if (!handler) {
    return {
      toolCallId: call.id,
      tool: call.tool,
      output: null,
      error: `Unknown tool: ${call.tool}`,
      durationMs: 0,
    };
  }

  try {
    const output = await handler(call.params);
    return {
      toolCallId: call.id,
      tool: call.tool,
      output,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      toolCallId: call.id,
      tool: call.tool,
      output: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
