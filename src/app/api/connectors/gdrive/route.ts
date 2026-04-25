/**
 * Google Drive connector.
 *
 * GET  /api/connectors/gdrive?action=list&q=…&max=20      → list files
 * GET  /api/connectors/gdrive?action=read&id=…            → download file content
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { google } from 'googleapis';

export const runtime = 'nodejs';

async function getDrive() {
  const session = await auth();
  if (!session?.accessToken || session.provider !== 'google') {
    throw new Error('Not signed in with Google. Connect Drive in Settings → Connectors.');
  }
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function GET(req: NextRequest) {
  try {
    const drive = await getDrive();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'list';

    if (action === 'list') {
      const q = searchParams.get('q') ?? '';
      const max = Math.min(Number(searchParams.get('max') ?? 20), 100);
      const r = await drive.files.list({
        q: q ? `name contains '${q.replace(/'/g, "\\'")}' and trashed=false` : 'trashed=false',
        pageSize: max,
        fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, owners(displayName))',
        orderBy: 'modifiedTime desc',
      });
      return Response.json({ files: r.data.files ?? [] });
    }

    if (action === 'read') {
      const id = searchParams.get('id');
      if (!id) return new Response('Missing id', { status: 400 });
      const meta = await drive.files.get({ fileId: id, fields: 'name, mimeType' });
      const mime = meta.data.mimeType ?? '';

      // Google Docs → export as text
      if (mime.startsWith('application/vnd.google-apps')) {
        const exportMime = mime.includes('document') ? 'text/plain'
          : mime.includes('spreadsheet') ? 'text/csv'
          : mime.includes('presentation') ? 'text/plain'
          : 'text/plain';
        const r = await drive.files.export({ fileId: id, mimeType: exportMime }, { responseType: 'text' });
        return Response.json({ name: meta.data.name, mime: exportMime, content: r.data });
      }

      const r = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'text' });
      return Response.json({ name: meta.data.name, mime, content: r.data });
    }

    return new Response('Unknown action', { status: 400 });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 401 });
  }
}
