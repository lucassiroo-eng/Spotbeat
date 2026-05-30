import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { generateQuestions } from '@spotbeat/question-engine';
import { getSession } from '../../lib/sessions';
import { db } from '../../lib/db';
import {
  rooms, deviceChoices, sessionToGame, socketMeta,
  gameQuestions, currentQuestionIdx, questionAnswers,
  broadcast, sendTo,
} from '../../lib/game-state';
import { getUserData } from '../../lib/spotify-sync';
import { addBotToGame } from '../../lib/bot';
import { broadcastQuestion, endQuestion, tryEarlyAdvance, QUESTION_TIME_LIMIT } from '../../lib/game-loop';

type WsMessage = { type: string; payload?: Record<string, unknown> };

function handle(ws: WebSocket, raw: string): void {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw) as WsMessage;
  } catch {
    sendTo(ws, { type: 'error', payload: { message: 'invalid_json' } });
    return;
  }
  handleMessage(ws, msg);
}

function handleMessage(ws: WebSocket, msg: WsMessage): void {
  try {

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
        // Catch up reconnecting player with the active question
        const idx = currentQuestionIdx.get(gameCode);
        const questions = gameQuestions.get(gameCode);
        if (idx !== undefined && questions && idx < questions.length) {
          const q = questions[idx];
          sendTo(ws, {
            type: 'question:new',
            payload: {
              question: { id: q.id, type: q.type, prompt: q.prompt, options: q.options, spotifyUri: q.spotifyUri, previewUrl: q.previewUrl, albumArt: q.albumArt },
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
        FROM game_players gp JOIN users u ON u.id = gp.user_id WHERE gp.game_id = ?
      `).all(game.id) as { userId: string; displayName: string }[];

      const players = gamePlayers.map(p => {
        const data = getUserData(p.userId);
        return {
          userId: p.userId,
          displayName: p.displayName,
          topArtists: (data?.topArtists ?? []).map(a => ({ id: a.id, name: a.name, genres: a.genres ?? [] })),
          topTracks: (data?.topTracks ?? []).map(t => ({
            id: t.id, name: t.name, uri: t.uri,
            duration_ms: t.duration_ms, preview_url: t.preview_url,
            albumArt: t.album?.images?.[0]?.url,
            artists: t.artists.map(a => ({ id: a.id, name: a.name, genres: a.genres ?? [] })),
          })),
          recentlyPlayed: (data?.recentlyPlayed ?? []).map(t => ({
            id: t.id, name: t.name, uri: t.uri,
            duration_ms: t.duration_ms, preview_url: t.preview_url,
            albumArt: t.album?.images?.[0]?.url,
            artists: t.artists.map(a => ({ id: a.id, name: a.name, genres: a.genres ?? [] })),
          })),
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
          enabledTypes: (gameConfig.enabledTypes ?? ['GUESS_THE_OWNER', 'TOP_ARTIST_MATCH', 'MOST_LIKELY_TO', 'ODD_ONE_OUT', 'GENRE_GUESS']) as never,
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

      const audioMasterId = (gameConfig as { audioMasterId?: string }).audioMasterId ?? game.host_user_id;
      broadcast(meta.gameCode, { type: 'game:started', payload: { audioMasterId } });
      setTimeout(() => broadcastQuestion(meta.gameCode, 0, questions), 2000);
      break;
    }

    case 'bot:add': {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      const session = getSession(meta.sessionId);
      if (!session?.userId) return;
      const game = db.prepare('SELECT * FROM games WHERE code = ?').get(meta.gameCode) as {
        id: string; host_user_id: string; status: string;
      } | undefined;
      if (!game || game.status !== 'LOBBY') {
        sendTo(ws, { type: 'error', payload: { message: 'game_not_in_lobby' } });
        return;
      }
      if (game.host_user_id !== session.userId) {
        sendTo(ws, { type: 'error', payload: { message: 'not_host' } });
        return;
      }
      addBotToGame(game.id, meta.gameCode);
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
      tryEarlyAdvance(meta.gameCode);
      break;
    }
  }
  } catch (err) {
    console.error('[ws] unhandled error in message handler', err);
    sendTo(ws, { type: 'error', payload: { message: (err as Error).message ?? 'internal_error' } });
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
        const session = getSession(meta.sessionId);
        if (session?.userId) {
          broadcast(meta.gameCode, {
            type: 'player:left',
            payload: { userId: session.userId, displayName: session.displayName ?? '' },
          });
        }
      }
    });

    ws.on('error', (err) => console.error('[ws] socket error', err));
  });
}
