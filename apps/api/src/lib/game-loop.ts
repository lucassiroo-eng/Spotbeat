import { randomUUID } from 'crypto';
import { GeneratedQuestion } from '@spotbeat/question-engine';
import { db } from './db';
import {
  gameQuestions, currentQuestionIdx, questionAnswers, questionTimers, questionStartTimes,
  rooms, broadcast,
} from './game-state';
import { botGames } from './bot';

export const QUESTION_TIME_LIMIT = 20_000;
const REVEAL_PAUSE = 3_000;

export function broadcastQuestion(gameCode: string, idx: number, questions: GeneratedQuestion[]): void {
  const existing = questionTimers.get(gameCode);
  if (existing) clearTimeout(existing);

  const q = questions[idx];

  if (!questionStartTimes.has(gameCode)) questionStartTimes.set(gameCode, new Map());
  questionStartTimes.get(gameCode)!.set(q.id, Date.now());

  broadcast(gameCode, {
    type: 'question:new',
    payload: {
      question: {
        id: q.id, type: q.type, prompt: q.prompt, options: q.options,
        spotifyUri: q.spotifyUri, previewUrl: q.previewUrl,
        albumArt: q.albumArt, trackName: q.trackName, artistName: q.artistName,
      },
      questionIndex: idx,
      totalQuestions: questions.length,
      timeLimit: QUESTION_TIME_LIMIT,
    },
  });

  const timer = setTimeout(() => endQuestion(gameCode, idx), QUESTION_TIME_LIMIT);
  questionTimers.set(gameCode, timer);

  scheduleBotAnswers(gameCode, q);
}

function scheduleBotAnswers(gameCode: string, q: GeneratedQuestion): void {
  const bots = botGames.get(gameCode);
  if (!bots || bots.size === 0) return;

  for (const botId of bots) {
    const delay = 1500 + Math.random() * 3000; // 1.5 – 4.5 s
    setTimeout(() => {
      const idx = currentQuestionIdx.get(gameCode);
      if (idx === undefined) return;
      const questions = gameQuestions.get(gameCode);
      if (!questions || idx >= questions.length || questions[idx].id !== q.id) return;

      if (!questionAnswers.has(gameCode)) questionAnswers.set(gameCode, new Map());
      const gameMap = questionAnswers.get(gameCode)!;
      if (!gameMap.has(q.id)) gameMap.set(q.id, new Map());
      const qMap = gameMap.get(q.id)!;
      if (qMap.has(botId)) return;

      const pick = q.options[Math.floor(Math.random() * q.options.length)];
      qMap.set(botId, pick.id);
      // Don't call tryEarlyAdvance — bot answers shouldn't override the real players' pace
    }, delay);
  }
}

export function endQuestion(gameCode: string, idx: number): void {
  const questions = gameQuestions.get(gameCode);
  if (!questions || idx >= questions.length) return;

  const q = questions[idx];
  const qAnswers = questionAnswers.get(gameCode)?.get(q.id) ?? new Map<string, string>();
  const gameRow = db.prepare('SELECT id FROM games WHERE code = ?').get(gameCode) as { id: string } | undefined;

  for (const [userId, answerId] of qAnswers) {
    const isCorrect = answerId === q.correctAnswerId;
    if (isCorrect && gameRow) {
      db.prepare('UPDATE game_players SET score = score + 1000 WHERE game_id = ? AND user_id = ?')
        .run(gameRow.id, userId);
    }
    if (gameRow) {
      const startTime = questionStartTimes.get(gameCode)?.get(q.id);
      db.prepare(`
        INSERT INTO game_events (id, game_id, question_id, user_id, type, payload, response_ms, is_correct)
        VALUES (?, ?, ?, ?, 'answer', ?, ?, ?)
      `).run(
        randomUUID(), gameRow.id, q.id, userId,
        JSON.stringify({ answerId }),
        startTime ? Date.now() - startTime : null,
        isCorrect ? 1 : 0,
      );
    }
  }

  const updatedScores = db.prepare(`
    SELECT u.id AS userId, u.display_name AS displayName, gp.score
    FROM game_players gp JOIN users u ON u.id = gp.user_id
    WHERE gp.game_id = (SELECT id FROM games WHERE code = ?)
    ORDER BY gp.score DESC
  `).all(gameCode) as { userId: string; displayName: string; score: number }[];

  const correctOption = q.options.find(o => o.id === q.correctAnswerId);
  broadcast(gameCode, {
    type: 'question:end',
    payload: { correctAnswerId: q.correctAnswerId, correctLabel: correctOption?.label ?? '', scores: updatedScores },
  });

  setTimeout(() => {
    const nextIdx = idx + 1;
    if (nextIdx < questions.length) {
      currentQuestionIdx.set(gameCode, nextIdx);
      broadcastQuestion(gameCode, nextIdx, questions);
    } else {
      db.prepare("UPDATE games SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP WHERE code = ?")
        .run(gameCode);
      broadcast(gameCode, { type: 'game:ended', payload: { scores: updatedScores } });
      gameQuestions.delete(gameCode);
      currentQuestionIdx.delete(gameCode);
      questionAnswers.delete(gameCode);
      questionTimers.delete(gameCode);
      questionStartTimes.delete(gameCode);
      botGames.delete(gameCode);
    }
  }, REVEAL_PAUSE);
}

// Called after recording an answer — advances early if all players have answered.
export function tryEarlyAdvance(gameCode: string): void {
  const idx = currentQuestionIdx.get(gameCode);
  if (idx === undefined) return;
  const questions = gameQuestions.get(gameCode);
  if (!questions || idx >= questions.length) return;
  const q = questions[idx];
  const qAnswers = questionAnswers.get(gameCode)?.get(q.id);
  const room = rooms.get(gameCode);
  if (room && qAnswers && qAnswers.size >= room.size) {
    const timer = questionTimers.get(gameCode);
    if (timer) { clearTimeout(timer); questionTimers.delete(gameCode); }
    endQuestion(gameCode, idx);
  }
}
