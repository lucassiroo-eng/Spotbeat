import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { generateQuestions, GeneratedQuestion } from '@spotbeat/question-engine';
import { getSession } from '../../lib/sessions';
import { db } from '../../lib/db';
import {
  rooms, deviceChoices, sessionToGame, socketMeta,
  gameQuestions, currentQuestionIdx, questionAnswers, questionTimers, questionStartTimes,
  broadcast, sendTo,
} from '../../lib/game-state';
import { getUserData } from '../../lib/spotify-sync';

type WsMessage = { type: string; payload?: Record<string, unknown> };

const QUESTION_TIME_LIMIT = 20_000;
const REVEAL_PAUSE = 3_000;

function broadcastQuestion(gameCode: string, idx: number, questions: GeneratedQuestion[]): void {
  const existing = questionTimers.get(gameCode);
  if (existing) clearTimeout(existing);

  const q = questions[idx];

  // Track when this question was sent (for response_ms)
  if (!questionStartTimes.has(gameCode)) questionStartTimes.set(gameCode, new Map());
  questionStartTimes.get(gameCode)!.set(q.id, Date.now());

  broadcast(gameCode, {
    type: 'question:new',
    payload: {
      question: {
        id: q.id, type: q.type, prompt: q.prompt, options: q.options,
        spotifyUri: q.spotifyUri, previewUrl: q.previewUrl,
      },
      questionIndex: idx,
      totalQuestions: questions.length,
      timeLimit: QUESTION_TIME_LIMIT,
    },
  });

  const timer = setTimeout(() => endQuestion(gameCode, idx), QUESTION_TIME_LIMIT);
  questionTimers.set(gameCode, timer);
}

function endQuestion(gameCode: string, idx: number): void {
  const questions = gameQuestions.get(gameCode);
  if (!questions || idx >= questions.length) return;

  const q = questions[idx];
  const qAnswers = questionAnswers.get(gameCode)?.get(q.id) ?? new Map<string, string>();

  const gameRow = db.prepare('SELECT id FROM games WHERE code = ?').get(gameCode) as { id: string } | undefined;

  // Award points and log events
  for (const [userId, answerId] of qAnswers) {
    const isCorrect = answerId === q.correctAnswerId;
    if (isCorrect && gameRow) {
      db.prepare(`
        UPDATE game_players SET score = score + 1000
        WHERE game_id = ? AND user_id = ?
      `).run(gameRow.id, userId);
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
    FROM game_players gp
    JOIN users u ON u.id = gp.user_id
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
      db.prepare(`UPDATE games SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP WHERE code = ?`).run(gameCode);
      broadcast(gameCode, { type: 'game:ended', payload: { scores: updatedScores } });
      gameQuestions.delete(gameCode);
      currentQuestionIdx.delete(gameCode);
      questionAnswers.delete(gameCode);
      questionTimers.delete(gameCode);
      questionStartTimes.delete(gameCode);
    }
  }, REVEAL_PAUSE);
}

function handle(ws: WebSocket, raw: string): void {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw) as WsMessage;
  } catch {
    sendTo(ws, { type: 'error', payload: { message: 'invalid_json' } });
    return;
  }

  switch (msg.type) {
    case 'lobby:join': {
      const { sessionId, gameCode } = (msg.payload ?? {}) as { sessionId?: string; gameCode?: string };
      if (!sessionId || !gameCode) {
        sendTo(ws, { type: 'error', payload: { message: 'missing_fields' } });
        return;
      }

      const session = getSession(sessionId);
      if (!session?.userId) {
        sendTo(ws, { type: 'error', payload: { message: 'not_authenticated' } });
        return;
      }

      const game = db.prepare('SELECT * FROM games WHERE code = ?').get(gameCode) as {
        id: string; status: string; host_user_id: string;
      } | undefined;
      if (!game) {
        sendTo(ws, { type: 'error', payload: { message: 'game_not_found' } });
        return;
      }

      if (!rooms.has(gameCode)) rooms.set(gameCode, new Set());
      rooms.get(gameCode)!.add(ws);
      sessionToGame.set(sessionId, gameCode);
      socketMeta.set(ws, { sessionId, gameCode });

      if (game.status === 'IN_PROGRESS') {
        const idx = currentQuestionIdx.get(gameCode);
        const questions = gameQuestions.get(gameCode);
        if (idx !== undefined && questions && idx < questions.length) {
          const q = questions[idx];
          sendTo(ws, {
            type: 'question:new',
            payload: {
              question: { id: q.id, type: q.type, prompt: q.prompt, options: q.options, spotifyUri: q.spotifyUri, previewUrl: q.previewUrl },
              questionIndex: idx,
              totalQuestions: questions.length,
              timeLimit: QUESTION_TIME_LIMIT,
            },
          });
        }
        return;
      }

      if (game.status !== 'LOBBY') {
        sendTo(ws, { type: 'error', payload: { message: 'game_finished' } });
        return;
      }

      db.prepare(`
        INSERT OR IGNORE INTO game_players (id, game_id, user_id, joined_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(randomUUID(), game.id, session.userId);

      broadcast(gameCode, {
        type: 'player:joined',
        payload: { userId: session.userId, displayName: session.displayName },
      });

      if (getUserData(session.userId)) {
        broadcast(gameCode, { type: 'player:ready', payload: { userId: session.userId } });
      }

      console.log(`[ws] ${session.displayName} joined room ${gameCode}`);
      break;
    }

    case 'device:select': {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      const { deviceId } = (msg.payload ?? {}) as { deviceId?: string };
      if (!deviceId) return;

      const session = getSession(meta.sessionId);
      if (!session?.userId) return;

      if (!deviceChoices.has(meta.gameCode)) deviceChoices.set(meta.gameCode, new Map());
      deviceChoices.get(meta.gameCode)!.set(session.userId, deviceId);
      sendTo(ws, { type: 'device:selected', payload: { deviceId } });
      break;
    }

    case 'game:start': {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      const session = getSession(meta.sessionId);
      if (!session?.userId) return;

      const game = db.prepare('SELECT * FROM games WHERE code = ?').get(meta.gameCode) as {
        id: string; host_user_id: string; status: string; config: string;
      } | undefined;
      if (!game) return;
      if (game.host_user_id !== session.userId) {
        sendTo(ws, { type: 'error', payload: { message: 'not_host' } });
        return;
      }
      if (game.status !== 'LOBBY') {
        sendTo(ws, { type: 'error', payload: { message: 'game_already_started' } });
        return;
      }

      const gamePlayers = db.prepare(`
        SELECT u.id AS userId, u.display_name AS displayName
        FROM game_players gp
        JOIN users u ON u.id = gp.user_id
        WHERE gp.game_id = ?
      `).all(game.id) as { userId: string; displayName: string }[];

      const players = gamePlayers.map(p => {
        const data = getUserData(p.userId);
        return {
          userId: p.userId,
          displayName: p.displayName,
          topArtists: (data?.topArtists ?? []).map(a => ({ id: a.id, name: a.name, genres: a.genres })),
          topTracks: (data?.topTracks ?? []).map(t => ({
            id: t.id, name: t.name, uri: t.uri,
            duration_ms: t.duration_ms, preview_url: t.preview_url,
            artists: t.artists.map(a => ({ id: a.id, name: a.name, genres: a.genres })),
          })),
          recentlyPlayed: [],
        };
      });

      const gameConfig = JSON.parse(game.config) as {
        questionCount?: number; genres?: string[] | 'all'; enabledTypes?: string[];
      };

      const questions = generateQuestions({
        players,
        config: {
          questionCount: gameConfig.questionCount ?? 10,
          genres: gameConfig.genres ?? 'all',
          enabledTypes: (gameConfig.enabledTypes ?? ['GUESS_THE_OWNER', 'TOP_ARTIST_MATCH']) as never,
        },
      });

      if (questions.length === 0) {
        sendTo(ws, { type: 'error', payload: { message: 'not_enough_music_data' } });
        return;
      }

      const insertQ = db.prepare(
        'INSERT INTO questions (id, game_id, type, order_index, payload, genre) VALUES (?, ?, ?, ?, ?, ?)'
      );
      questions.forEach((q, idx) => {
        insertQ.run(q.id, game.id, q.type, idx, JSON.stringify(q), q.genre ?? null);
      });

      db.prepare(`UPDATE games SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(game.id);

      gameQuestions.set(meta.gameCode, questions);
      currentQuestionIdx.set(meta.gameCode, 0);
      questionAnswers.set(meta.gameCode, new Map());

      broadcast(meta.gameCode, { type: 'game:started', payload: {} });
      setTimeout(() => broadcastQuestion(meta.gameCode, 0, questions), 2000);
      break;
    }

    case 'config:update': {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      const session = getSession(meta.sessionId);
      if (!session?.userId) return;

      const game = db.prepare('SELECT * FROM games WHERE code = ?').get(meta.gameCode) as {
        id: string; host_user_id: string; config: string;
      } | undefined;
      if (!game || game.host_user_id !== session.userId) return;

      const current = JSON.parse(game.config);
      const updated = { ...current, ...(msg.payload ?? {}) };
      db.prepare('UPDATE games SET config = ? WHERE id = ?').run(JSON.stringify(updated), game.id);
      broadcast(meta.gameCode, { type: 'config:updated', payload: updated });
      break;
    }

    case 'answer:submit': {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      const session = getSession(meta.sessionId);
      if (!session?.userId) return;

      const { answerId } = (msg.payload ?? {}) as { answerId?: string };
      if (!answerId) return;

      const idx = currentQuestionIdx.get(meta.gameCode);
      if (idx === undefined) return;
      const questions = gameQuestions.get(meta.gameCode);
      if (!questions || idx >= questions.length) return;

      const q = questions[idx];

      if (!questionAnswers.has(meta.gameCode)) questionAnswers.set(meta.gameCode, new Map());
      const gameMap = questionAnswers.get(meta.gameCode)!;
      if (!gameMap.has(q.id)) gameMap.set(q.id, new Map());
      const qMap = gameMap.get(q.id)!;

      if (qMap.has(session.userId)) return;

      qMap.set(session.userId, answerId);
      sendTo(ws, { type: 'answer:ack', payload: { correct: answerId === q.correctAnswerId } });

      const room = rooms.get(meta.gameCode);
      if (room && qMap.size >= room.size) {
        const timer = questionTimers.get(meta.gameCode);
        if (timer) {
          clearTimeout(timer);
          questionTimers.delete(meta.gameCode);
        }
        endQuestion(meta.gameCode, idx);
      }
      break;
    }
  }
}

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => handle(ws, raw.toString()));

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (meta) {
        rooms.get(meta.gameCode)?.delete(ws);
        sessionToGame.delete(meta.sessionId);
        socketMeta.delete(ws);
      }
    });

    ws.on('error', (err) => console.error('[ws] socket error', err));
  });
}
