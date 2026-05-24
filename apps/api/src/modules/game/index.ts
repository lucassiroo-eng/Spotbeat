import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireSession } from '../../lib/sessions';
import { db } from '../../lib/db';

const router = Router();

const DEFAULT_CONFIG = {
  questionCount: 10,
  genres: 'all',
  enabledTypes: ['GUESS_THE_OWNER', 'TOP_ARTIST_MATCH'],
};

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function getSessionId(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const v = req.headers['x-session-id'];
  return typeof v === 'string' ? v : undefined;
}

// POST /api/games — host creates a new game
router.post('/', (req, res) => {
  let session: ReturnType<typeof requireSession>;
  try {
    session = requireSession(getSessionId(req));
  } catch {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  if (!session.userId) {
    return res.status(202).json({ error: 'sync_pending', message: 'Profile sync not yet complete, retry in a moment' });
  }

  let code = generateCode();
  // Ensure uniqueness (extremely unlikely collision but correct)
  while (db.prepare('SELECT 1 FROM games WHERE code = ?').get(code)) {
    code = generateCode();
  }

  const gameId = randomUUID();
  db.prepare(`
    INSERT INTO games (id, code, host_user_id, config, created_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(gameId, code, session.userId, JSON.stringify(DEFAULT_CONFIG));

  db.prepare(`
    INSERT OR IGNORE INTO game_players (id, game_id, user_id, joined_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(randomUUID(), gameId, session.userId);

  res.status(201).json({ gameId, code });
});

// GET /api/games/:code — lobby state
router.get('/:code', (req, res) => {
  try {
    requireSession(getSessionId(req));
  } catch {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const game = db.prepare('SELECT * FROM games WHERE code = ?').get(req.params.code) as {
    id: string; code: string; status: string; host_user_id: string; config: string;
  } | undefined;
  if (!game) return res.status(404).json({ error: 'game_not_found' });

  const players = db.prepare(`
    SELECT u.id AS userId, u.display_name AS displayName, gp.score
    FROM game_players gp
    JOIN users u ON u.id = gp.user_id
    WHERE gp.game_id = ?
  `).all(game.id);

  res.json({
    id: game.id,
    code: game.code,
    status: game.status,
    hostUserId: game.host_user_id,
    config: JSON.parse(game.config),
    players,
  });
});

const configSchema = z.object({
  questionCount: z.number().int().min(5).max(20).optional(),
  genres: z.union([z.array(z.string()), z.literal('all')]).optional(),
  enabledTypes: z.array(z.string()).min(1).optional(),
});

// PATCH /api/games/:code/config — host updates config
router.patch('/:code/config', (req, res) => {
  let session: ReturnType<typeof requireSession>;
  try {
    session = requireSession(getSessionId(req));
  } catch {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const game = db.prepare('SELECT * FROM games WHERE code = ?').get(req.params.code) as {
    id: string; host_user_id: string; config: string; status: string;
  } | undefined;
  if (!game) return res.status(404).json({ error: 'game_not_found' });
  if (game.host_user_id !== session.userId) return res.status(403).json({ error: 'not_host' });
  if (game.status !== 'LOBBY') return res.status(409).json({ error: 'game_already_started' });

  const parse = configSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_config', details: parse.error.flatten() });

  const current = JSON.parse(game.config);
  const updated = { ...current, ...parse.data };
  db.prepare('UPDATE games SET config = ? WHERE id = ?').run(JSON.stringify(updated), game.id);

  res.json({ config: updated });
});

// POST /api/games/:code/answer — Phase 4
router.post('/:code/answer', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

export default router;
