import { Router } from 'express';

const router = Router();

// POST /api/auth/spotify/callback — Phase 1
router.post('/spotify/callback', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

// POST /api/auth/disconnect — Phase 1
router.post('/disconnect', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

export default router;
