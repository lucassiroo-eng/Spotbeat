import { Router } from 'express';
import { db } from '../../lib/db';

const router = Router();

router.get('/', (req, res) => {
  const pw = req.headers['x-admin-password'];
  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const totalGames = (db.prepare(
    "SELECT COUNT(*) AS n FROM games WHERE status = 'FINISHED'"
  ).get() as { n: number }).n;

  const totalAnswers = (db.prepare(
    "SELECT COUNT(*) AS n FROM game_events WHERE type = 'answer'"
  ).get() as { n: number }).n;

  const totalCorrect = (db.prepare(
    "SELECT COUNT(*) AS n FROM game_events WHERE type = 'answer' AND is_correct = 1"
  ).get() as { n: number }).n;

  const byType = db.prepare(`
    SELECT q.type, COUNT(*) AS total, SUM(ge.is_correct) AS correct,
           ROUND(AVG(ge.response_ms)) AS avg_ms
    FROM game_events ge
    JOIN questions q ON q.id = ge.question_id
    WHERE ge.type = 'answer'
    GROUP BY q.type
    ORDER BY total DESC
  `).all() as { type: string; total: number; correct: number; avg_ms: number }[];

  const recentGames = db.prepare(`
    SELECT g.code, g.started_at, g.finished_at,
           COUNT(DISTINCT gp.user_id) AS player_count,
           MAX(gp.score) AS top_score
    FROM games g
    LEFT JOIN game_players gp ON gp.game_id = g.id
    WHERE g.status = 'FINISHED'
    GROUP BY g.id
    ORDER BY g.finished_at DESC
    LIMIT 20
  `).all() as {
    code: string; started_at: string; finished_at: string;
    player_count: number; top_score: number;
  }[];

  res.json({ totalGames, totalAnswers, totalCorrect, byType, recentGames });
});

export default router;
