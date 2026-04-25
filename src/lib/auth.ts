/**
 * NextAuth v5 configuration.
 *
 * Wires Google + GitHub OAuth. Persists provider access tokens and account
 * info in the JWT so backend connector routes can call provider APIs on
 * behalf of the user.
 *
 * Required env (set in .env.local):
 *   AUTH_SECRET             — random string (`openssl rand -base64 32`)
 *   AUTH_GOOGLE_ID          — OAuth client ID from console.cloud.google.com
 *   AUTH_GOOGLE_SECRET      — matching client secret
 *   AUTH_GITHUB_ID          — OAuth app ID from github.com/settings/developers
 *   AUTH_GITHUB_SECRET      — matching client secret
 *
 * Redirect URIs to register at each provider:
 *   http://localhost:3000/api/auth/callback/google
 *   http://localhost:3000/api/auth/callback/github
 */

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    provider?: string;
    error?: string;
  }

  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    expiresAt?: number;
    error?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          // Gmail (read + send) + Drive
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/drive.file',
          ].join(' '),
        },
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: { params: { scope: 'read:user user:email repo' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      const t = token as Record<string, unknown>;
      if (account) {
        t.accessToken = account.access_token;
        t.refreshToken = account.refresh_token;
        t.provider = account.provider;
        t.expiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
      }

      // Refresh Google token if expired
      const expiresAt = t.expiresAt as number | undefined;
      const refreshToken = t.refreshToken as string | undefined;
      if (t.provider === 'google' && expiresAt && Date.now() > expiresAt && refreshToken) {
        try {
          const r = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.AUTH_GOOGLE_ID ?? '',
              client_secret: process.env.AUTH_GOOGLE_SECRET ?? '',
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
            }),
          });
          const data = await r.json() as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string };
          if (data.access_token) {
            t.accessToken = data.access_token;
            t.expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
            if (data.refresh_token) t.refreshToken = data.refresh_token;
          } else {
            t.error = data.error ?? 'refresh_failed';
          }
        } catch (err) {
          t.error = err instanceof Error ? err.message : 'refresh_failed';
        }
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as Record<string, unknown>;
      session.accessToken = t.accessToken as string | undefined;
      session.provider = t.provider as string | undefined;
      session.error = t.error as string | undefined;
      return session;
    },
  },
  trustHost: true,
});
