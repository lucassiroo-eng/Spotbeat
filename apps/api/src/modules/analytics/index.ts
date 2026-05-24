import { Router } from 'express';

const router = Router();

// GET /api/admin/analytics — Phase 5
router.get('/', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

export default router;
