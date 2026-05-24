import { useEffect, useRef, useCallback } from 'react';

type ServerMessage = { type: string; payload?: unknown };
type MessageHandler = (msg: ServerMessage) => void;

// In prod set VITE_API_URL=https://api.yourdomain.com — WS derives from it.
// In dev leave it unset; the Vite proxy forwards ws://127.0.0.1:5173/ws → :3000.
const WS_BASE = (() => {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) return apiUrl.replace(/^http/, 'ws');
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}`;
})();

export function useWebSocket(gameCode: string | undefined, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify({ type, payload }));
  }, []);

  useEffect(() => {
    if (!gameCode) return;

    const ws = new WebSocket(`${WS_BASE}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const sessionId = sessionStorage.getItem('session_id');
      ws.send(JSON.stringify({ type: 'lobby:join', payload: { sessionId, gameCode } }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        handlerRef.current(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = (err) => console.error('[ws] error', err);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [gameCode]);

  return { send };
}
