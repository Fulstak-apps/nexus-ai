/**
 * Reports which OAuth providers are configured on the server.
 * The connectors UI calls this to know whether to show the OAuth button
 * or fall through to a PAT/API-key path.
 */

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  });
}
