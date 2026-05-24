import { getSession, updateSession } from './sessions';

export async function refreshTokenIfNeeded(sessionId: string): Promise<string> {
  const session = getSession(sessionId);
  if (!session) throw new Error('session_not_found');

  if (Date.now() < session.expiresAt - 60_000) return session.accessToken;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string };
    throw new Error(err.error_description ?? 'token_refresh_failed');
  }

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  updateSession(sessionId, {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  });

  return data.access_token;
}
