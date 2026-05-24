import { WebSocket } from 'ws';
import { GeneratedQuestion } from '@spotbeat/question-engine';

// gameCode → set of connected sockets
export const rooms = new Map<string, Set<WebSocket>>();

// gameCode → userId → deviceId
export const deviceChoices = new Map<string, Map<string, string>>();

// sessionId → gameCode (for broadcasting player:ready after sync)
export const sessionToGame = new Map<string, string>();

// socket → { sessionId, gameCode } (for disconnect cleanup)
export const socketMeta = new Map<WebSocket, { sessionId: string; gameCode: string }>();

// gameCode → ordered questions for the active game
export const gameQuestions = new Map<string, GeneratedQuestion[]>();

// gameCode → index of the currently active question
export const currentQuestionIdx = new Map<string, number>();

// gameCode → questionId → userId → answerId
export const questionAnswers = new Map<string, Map<string, Map<string, string>>>();

// gameCode → active question timer handle
export const questionTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
