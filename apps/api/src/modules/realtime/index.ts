import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { getSession } from '../../lib/sessions';
import { db } from '../../lib/db';
import {
  rooms, deviceChoices, sessionToGame, socketMeta, broadcast, sendTo,
} from '../../lib/game-state';

type WsMessage = { type: string; payload?: Record<string, unknown> };

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
      if (game.status !== 'LOBBY') {
        sendTo(ws, { type: 'error', payload: { message: 'game_already_started' } });
        return;
      }

      // Add to DB if not already a player
      db.prepare(`
        INSERT OR IGNORE INTO game_players (id, game_id, user_id, joined_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(randomUUID(), game.id, session.userId);

      // Register in rooms and maps
      if (!rooms.has(gameCode)) rooms.set(gameCode, new Set());
      rooms.get(gameCode)!.add(ws);
      sessionToGame.set(sessionId, gameCode);
      socketMeta.set(ws, { sessionId, gameCode });

      // Tell everyone a player joined
      broadcast(gameCode, {
        type: 'player:joined',
        payload: { userId: session.userId, displayName: session.displayName },
      });

      // If music data was already synced before this join, signal ready immediately
      const { getUserData } = require('../../lib/spotify-sync') as typeof import('../../lib/spotify-sync');
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
        id: string; host_user_id: string; status: string;
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

      db.prepare(`UPDATE games SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(game.id);
      broadcast(meta.gameCode, { type: 'game:started', payload: {} });
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

    // Phase 4: answer:submit
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
