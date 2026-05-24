import { Router } from 'express';
import { getSession } from '../../lib/sessions';
import { spotifyClient } from '../../lib/spotify-client';
import { refreshTokenIfNeeded } from '../../lib/spotify-refresh';

const router = Router();

function getSessionId(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const v = req.headers['x-session-id'];
  return typeof v === 'string' ? v : undefined;
}

// Returns the access token for the Web Playback SDK
router.get('/token', (req, res) => {
  const sessionId = getSessionId(req);
  const session = sessionId ? getSession(sessionId) : undefined;
  if (!session) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ token: session.accessToken });
});

// Lists the user's available Spotify devices
router.get('/devices', async (req, res) => {
  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ error: 'not_authenticated' });

  try {
    const token = await refreshTokenIfNeeded(sessionId);
    const { devices } = await spotifyClient.getDevices(token);
    res.json({ devices });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(500).json({ error: message });
  }
});

export default router;
