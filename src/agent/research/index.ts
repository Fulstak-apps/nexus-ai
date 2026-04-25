/**
 * Deep Research Engine
 *
 * Iteratively searches, fetches, and analyzes sources to produce
 * a structured analyst-grade research report.
 */

import { randomUUID } from 'crypto';
import { ResearchReport, ResearchSource } from '@/types';
import { writeSandboxFile } from '../tools/executor';
import { generate, FAST_MODEL, PLANNER_MODEL } from '../core/anthropic';

type ResearchDepth = 'quick' | 'deep' | 'wide';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchWeb(query: string, maxResults = 6): Promise<SearchResult[]> {
  if (process.env.TAVILY_API_KEY) {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: 'advanced',
      }),
    });
    const data = await r.json() as { results: Array<{ title: string; url: string; content: string }> };
    return (data.results ?? []).map(x => ({ title: x.title, url: x.url, snippet: x.content }));
  }

  // DuckDuckGo fallback
  const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Nexus-Research/1.0)' },
  });
  const html = await resp.text();
  const results: SearchResult[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null && results.length < maxResults) {
    const url = decodeURIComponent(m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]);
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    const snippet = m[3].replace(/<[^>]+>/g, '').trim();
    if (url.startsWith('http')) results.push({ title, url, snippet });
  }
  return results;
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Nexus-Research/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  } catch {
    return '';
  }
}

async function generateSubQueries(query: string, depth: ResearchDepth): Promise<string[]> {
  if (depth === 'quick') return [query];

  const text = await generate({
    model: FAST_MODEL,
    system: 'Generate search sub-queries to comprehensively research a topic. Return ONLY a JSON array of strings, no markdown.',
    prompt: `Topic: "${query}"\nDepth: ${depth}\nGenerate ${depth === 'deep' ? '4' : '6'} targeted sub-queries that cover different angles.`,
    maxTokens: 512,
  });

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [query];
  try { return JSON.parse(match[0]) as string[]; }
  catch { return [query]; }
}

async function synthesizeReport(
  query: string,
  sources: ResearchSource[],
  depth: ResearchDepth,
): Promise<{ report: string; keyFindings: string[] }> {
  const sourcesText = sources
    .filter(s => s.fetched)
    .slice(0, 8)
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.fetched?.slice(0, 1500)}`)
    .join('\n\n---\n\n');

  const report = await generate({
    model: PLANNER_MODEL,
    system: `You are an expert research analyst. Produce a comprehensive, well-structured research report.
Format with: Executive Summary, Key Findings (as numbered list), Detailed Analysis (with sections), Conclusion, and Sources.
Be specific, cite sources by number [1], [2] etc. Focus on accuracy and insight.`,
    prompt: `Research Query: "${query}"\nDepth: ${depth}\n\nSource Material:\n${sourcesText || 'No sources fetched — use your knowledge.'}\n\nGenerate the research report now.`,
    maxTokens: 3000,
  });

  // Extract key findings
  const findingsMatch = report.match(/Key Findings[\s\S]*?(?=\n#|\n##|Detailed|$)/i);
  const keyFindings: string[] = [];
  if (findingsMatch) {
    const lines = findingsMatch[0].split('\n').filter(l => /^\d+\./.test(l.trim()));
    keyFindings.push(...lines.map(l => l.replace(/^\d+\.\s*/, '').trim()).slice(0, 5));
  }

  return { report, keyFindings };
}

export type ResearchEvent =
  | { type: 'research_start'; query: string; depth: ResearchDepth }
  | { type: 'research_phase'; phase: string }
  | { type: 'research_queries'; queries: string[] }
  | { type: 'research_source'; source: ResearchSource }
  | { type: 'research_token'; text: string }
  | { type: 'research_done'; report: ResearchReport };

export async function* runResearch(
  query: string,
  depth: ResearchDepth = 'deep',
): AsyncGenerator<ResearchEvent> {
  yield { type: 'research_start', query, depth };

  // Generate sub-queries
  yield { type: 'research_phase', phase: 'generating queries' };
  const subQueries = await generateSubQueries(query, depth);
  yield { type: 'research_queries', queries: subQueries };

  // Search for sources
  yield { type: 'research_phase', phase: 'searching' };
  const allSources: ResearchSource[] = [];
  const seen = new Set<string>();

  for (const q of subQueries) {
    const results = await searchWeb(q, depth === 'wide' ? 8 : 5);
    for (const r of results) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        allSources.push({ ...r });
        yield { type: 'research_source', source: { ...r } };
      }
    }
  }

  // Fetch page content for top sources
  yield { type: 'research_phase', phase: 'reading sources' };
  const fetchLimit = depth === 'quick' ? 3 : depth === 'deep' ? 6 : 10;
  const toFetch = allSources.slice(0, fetchLimit);

  await Promise.all(toFetch.map(async (source) => {
    source.fetched = await fetchPageText(source.url);
  }));

  // Synthesize report
  yield { type: 'research_phase', phase: 'synthesizing' };
  const { report, keyFindings } = await synthesizeReport(query, allSources, depth);

  // Save to sandbox
  const reportId = randomUUID();
  const filename = `research_${Date.now()}.md`;
  const fullReport = `# Research Report: ${query}\n\n**Depth:** ${depth} | **Sources:** ${allSources.length}\n\n${report}`;
  await writeSandboxFile(filename, fullReport);

  const researchReport: ResearchReport = {
    id: reportId,
    query,
    depth,
    sources: allSources,
    report,
    keyFindings,
    createdAt: Date.now(),
  };

  yield { type: 'research_done', report: researchReport };
}
