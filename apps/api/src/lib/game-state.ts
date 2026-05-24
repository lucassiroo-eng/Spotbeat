import { WebSocket } from 'ws';

// gameCode → set of connected sockets
export const rooms = new Map<string, Set<WebSocket>>();

// gameCode → userId → deviceId
export const deviceChoices = new Map<string, Map<string, string>>();

// sessionId → gameCode (for broadcasting player:ready after sync)
export const sessionToGame = new Map<string, string>();

// socket → { sessionId, gameCode } (for disconnect cleanup)
export const socketMeta = new Map<WebSocket, { sessionId: string; gameCode: string }>();

export function broadcast(gameCode: string, message: object): void {
  const room = rooms.get(gameCode);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const socket of room) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

export function sendTo(socket: WebSocket, message: object): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
