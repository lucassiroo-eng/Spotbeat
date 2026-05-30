import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireSession } from '../../lib/sessions';
import { db } from '../../lib/db';
import {
  gameQuestions, currentQuestionIdx, questionAnswers,
} from '../../lib/game-state';
import { tryEarlyAdvance } from '../../lib/game-loop';

const router = Router();

const DEFAULT_CONFIG = {
  questionCount: 10,
  genres: 'all',
  enabledTypes: ['GUESS_THE_OWNER', 'TOP_ARTIST_MATCH', 'MOST_LIKELY_TO', 'RECENT_TRACK'],
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

// GET /api/games/:code — lobby/game state
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
    FROM game_players gp JOIN users u ON u.id = gp.user_id WHERE gp.game_id = ?
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

  const updated = { ...JSON.parse(game.config), ...parse.data };
  db.prepare('UPDATE games SET config = ? WHERE id = ?').run(JSON.stringify(updated), game.id);
  res.json({ config: updated });
});

// POST /api/games/:code/answer — REST fallback for clients that lost their WS connection
router.post('/:code/answer', (req, res) => {
  let session: ReturnType<typeof requireSession>;
  try {
    session = requireSession(getSessionId(req));
  } catch {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  if (!session.userId) return res.status(401).json({ error: 'not_authenticated' });

  const { answerId } = req.body as { answerId?: string };
  if (!answerId) return res.status(400).json({ error: 'answerId_required' });

  const gameCode = req.params.code;
  const idx = currentQuestionIdx.get(gameCode);
  if (idx === undefined) return res.status(409).json({ error: 'no_active_question' });

  const questions = gameQuestions.get(gameCode);
  if (!questions || idx >= questions.length) return res.status(409).json({ error: 'no_active_question' });

  const q = questions[idx];

  if (!questionAnswers.has(gameCode)) questionAnswers.set(gameCode, new Map());
  const gameMap = questionAnswers.get(gameCode)!;
  if (!gameMap.has(q.id)) gameMap.set(q.id, new Map());
  const qMap = gameMap.get(q.id)!;

  if (qMap.has(session.userId)) return res.status(409).json({ error: 'already_answered' });

  qMap.set(session.userId, answerId);
  tryEarlyAdvance(gameCode);

  res.json({ correct: answerId === q.correctAnswerId });
});

export default router;
