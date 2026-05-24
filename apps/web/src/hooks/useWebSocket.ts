import { useEffect, useRef, useCallback } from 'react';

type MessageHandler = (msg: { type: string; payload?: unknown }) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);

  const send = useCallback((type: string, payload?: unknown) => {
    wsRef.current?.send(JSON.stringify({ type, payload }));
  }, []);

  useEffect(() => {
    // Phase 2: connect to ws://127.0.0.1:3000
    return () => wsRef.current?.close();
  }, [onMessage]);

  return { send };
}
