import { Router } from 'express';

const router = Router();

// GET /api/spotify/token — Phase 4 (Web Playback SDK)
router.get('/token', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

// GET /api/spotify/devices — Phase 2
router.get('/devices', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

export default router;
