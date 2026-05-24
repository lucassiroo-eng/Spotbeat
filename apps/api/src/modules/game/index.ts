import { Router } from 'express';

const router = Router();

// POST /api/games — Phase 2
router.post('/', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

// GET /api/games/:code — Phase 2
router.get('/:code', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

// PATCH /api/games/:code/config — Phase 2
router.patch('/:code/config', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

// POST /api/games/:code/answer — Phase 4
router.post('/:code/answer', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

export default router;
