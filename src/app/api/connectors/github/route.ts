/**
 * GitHub connector.
 *
 * GET /api/connectors/github?action=repos
 * GET /api/connectors/github?action=read&owner=…&repo=…&path=…
 * GET /api/connectors/github?action=search&q=…
 *
 * Uses the user's session OAuth token (preferred) or falls back to a PAT
 * passed via x-github-key header.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { Octokit } from '@octokit/rest';

export const runtime = 'nodejs';

async function getOctokit(req: NextRequest): Promise<Octokit> {
  const session = await auth();
  let token: string | undefined;
  if (session?.provider === 'github' && session.accessToken) {
    token = session.accessToken;
  } else {
    token = req.headers.get('x-github-key') ?? undefined;
  }
  if (!token) throw new Error('Not signed in with GitHub. Connect in Settings → Connectors, or paste a PAT in Settings → API Keys.');
  return new Octokit({ auth: token });
}

export async function GET(req: NextRequest) {
  try {
    const octokit = await getOctokit(req);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'repos';

    if (action === 'repos') {
      const r = await octokit.repos.listForAuthenticatedUser({ per_page: 50, sort: 'updated' });
      return Response.json({
        repos: r.data.map(repo => ({
          name: repo.full_name,
          private: repo.private,
          description: repo.description,
          url: repo.html_url,
          updatedAt: repo.updated_at,
          stars: repo.stargazers_count,
          language: repo.language,
        })),
      });
    }

    if (action === 'read') {
      const owner = searchParams.get('owner');
      const repo = searchParams.get('repo');
      const filePath = searchParams.get('path') ?? '';
      if (!owner || !repo) return new Response('Missing owner/repo', { status: 400 });
      const r = await octokit.repos.getContent({ owner, repo, path: filePath });
      if (Array.isArray(r.data)) {
        return Response.json({
          type: 'directory',
          entries: r.data.map(e => ({ name: e.name, path: e.path, type: e.type, size: e.size })),
        });
      }
      if ('content' in r.data) {
        const content = Buffer.from(r.data.content, 'base64').toString('utf-8');
        return Response.json({ type: 'file', name: r.data.name, path: r.data.path, size: r.data.size, content });
      }
      return new Response('Unsupported content', { status: 400 });
    }

    if (action === 'search') {
      const q = searchParams.get('q');
      if (!q) return new Response('Missing q', { status: 400 });
      const r = await octokit.search.repos({ q, per_page: 20 });
      return Response.json({
        results: r.data.items.map(repo => ({
          name: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          stars: repo.stargazers_count,
          language: repo.language,
        })),
      });
    }

    return new Response('Unknown action', { status: 400 });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 401 });
  }
}
