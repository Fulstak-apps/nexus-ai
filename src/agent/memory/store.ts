/**
 * Persistent memory store with real semantic-ish search.
 *
 * Embedding: bag-of-words hash vectors over a 512-dim space.
 *   Works for typical-length memories, survives stopwords, and is fully
 *   deterministic + dependency-free. Swap for Voyage/OpenAI in production.
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { MemoryEntry, UserProfile } from '@/types';
import { randomUUID } from 'crypto';

const MEMORY_DIR = path.join(process.cwd(), '.nexus-memory');
const ENTRIES_FILE = path.join(MEMORY_DIR, 'entries.json');
const PROFILE_FILE = path.join(MEMORY_DIR, 'profile.json');

const EMBED_DIM = 512;

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','for','of','to','in','on','at',
  'by','with','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','must','shall','can',
  'i','you','he','she','it','we','they','them','us','me','my','your','his','her',
  'its','our','their','this','that','these','those','as','from','so','not','no',
]);

// ─── Embedding ────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function hashToken(token: string): number {
  const h = createHash('md5').update(token).digest();
  // Use first 4 bytes as uint32
  return ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
}

function embed(text: string): number[] {
  const vec = new Array(EMBED_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  // Unigrams
  for (const tok of tokens) {
    const idx = hashToken(tok) % EMBED_DIM;
    const sign = (hashToken(tok + '_sign') % 2) === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  // Bigrams for phrase context
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = tokens[i] + '_' + tokens[i + 1];
    const idx = hashToken(bg) % EMBED_DIM;
    vec[idx] += 0.5;
  }

  // L2 normalize
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // Vectors are pre-normalized
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function ensureDir() {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
}

async function loadEntries(): Promise<MemoryEntry[]> {
  try {
    const raw = await fs.readFile(ENTRIES_FILE, 'utf-8');
    return JSON.parse(raw) as MemoryEntry[];
  } catch {
    return [];
  }
}

async function saveEntries(entries: MemoryEntry[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(ENTRIES_FILE, JSON.stringify(entries, null, 2));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function addMemory(
  content: string,
  type: MemoryEntry['type'],
  metadata: Record<string, unknown> = {},
): Promise<MemoryEntry> {
  const entries = await loadEntries();
  const entry: MemoryEntry = {
    id: randomUUID(),
    content,
    type,
    embedding: embed(content),
    metadata,
    createdAt: Date.now(),
  };
  entries.push(entry);
  if (entries.length > 1000) entries.splice(0, entries.length - 1000);
  await saveEntries(entries);
  return entry;
}

export async function searchMemory(
  query: string,
  topK = 5,
  typeFilter?: MemoryEntry['type'],
): Promise<MemoryEntry[]> {
  const entries = await loadEntries();
  if (!entries.length) return [];
  const queryVec = embed(query);

  return entries
    .filter(e => !typeFilter || e.type === typeFilter)
    .map(e => ({
      entry: e,
      score: e.embedding ? cosineSimilarity(queryVec, e.embedding) : 0,
    }))
    .filter(s => s.score > 0.05) // Only meaningful matches
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.entry);
}

export async function listAllMemories(limit = 50): Promise<MemoryEntry[]> {
  const entries = await loadEntries();
  return entries.slice(-limit).reverse();
}

export async function clearMemories(): Promise<void> {
  await ensureDir();
  await fs.writeFile(ENTRIES_FILE, '[]');
}

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await fs.readFile(PROFILE_FILE, 'utf-8');
    return JSON.parse(raw) as UserProfile;
  } catch {
    return {
      id: randomUUID(),
      preferences: {},
      writingStyle: 'concise and technical',
      recurringGoals: [],
      updatedAt: Date.now(),
    };
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await ensureDir();
  await fs.writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

export async function summarizeOldSessions(): Promise<string> {
  const entries = await loadEntries();
  const sessions = entries.filter(e => e.type === 'session').slice(-5);
  if (!sessions.length) return '';
  return sessions.map(s => `- ${s.content}`).join('\n');
}

export async function memoryStats(): Promise<{ total: number; byType: Record<string, number> }> {
  const entries = await loadEntries();
  const byType: Record<string, number> = {};
  for (const e of entries) byType[e.type] = (byType[e.type] ?? 0) + 1;
  return { total: entries.length, byType };
}
