import { WebSocket, WebSocketServer } from 'ws';

// rooms: gameCode → set of connected sockets
const rooms = new Map<string, Set<WebSocket>>();

export function broadcast(gameCode: string, message: object): void {
  const room = rooms.get(gameCode);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const socket of room) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    let currentRoom: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; payload?: Record<string, unknown> };

        if (msg.type === 'lobby:join') {
          const gameCode = msg.payload?.gameCode as string;
          if (!gameCode) return;

          if (!rooms.has(gameCode)) rooms.set(gameCode, new Set());
          rooms.get(gameCode)!.add(ws);
          currentRoom = gameCode;
          console.log(`[ws] socket joined room ${gameCode}`);
        }

        // Phase 2–4: handle config:update, device:select, game:start, answer:submit
      } catch {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'invalid_message' } }));
      }
    });

    ws.on('close', () => {
      if (currentRoom) rooms.get(currentRoom)?.delete(ws);
    });
  });
}
