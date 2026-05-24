import { Router } from 'express';
import { z } from 'zod';
import { setSession, deleteSession } from '../../lib/sessions';
import { spotifyClient } from '../../lib/spotify-client';
import { syncUserData } from '../../lib/spotify-sync';
import { db } from '../../lib/db';

const router = Router();

const callbackSchema = z.object({
  code: z.string(),
  code_verifier: z.string(),
  session_id: z.string().uuid(),
  redirect_uri: z.string().url(),
});

router.post('/spotify/callback', async (req, res) => {
  const parse = callbackSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'invalid_request', details: parse.error.flatten() });
  }

  const { code, code_verifier, session_id, redirect_uri } = parse.data;

  // PKCE token exchange — no client_secret required
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      code_verifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({})) as { error_description?: string };
    console.error('[auth] token exchange failed', err);
    return res.status(401).json({ error: 'token_exchange_failed', message: err.error_description });
  }

  const token = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Fetch profile immediately so session has identity before returning
  const me = await spotifyClient.getMe(token.access_token);

  setSession(session_id, {
    userId: me.id,
    displayName: me.display_name,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  });

  db.prepare(`
    INSERT INTO users (id, display_name, country) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, country = excluded.country
  `).run(me.id, me.display_name, me.country ?? '');

  // Background: fetch top artists + tracks for question engine
  syncUserData(session_id).catch(err => console.error('[sync] failed', err));

  res.json({ ok: true });
});

router.post('/disconnect', (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) deleteSession(sessionId);
  res.json({ ok: true });
});

export default router;
