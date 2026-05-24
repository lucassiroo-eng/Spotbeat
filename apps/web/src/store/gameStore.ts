import { createContext, useContext, useReducer, Dispatch, ReactNode, createElement } from 'react';

export type GameStatus = 'IDLE' | 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';

export interface GameState {
  sessionId: string | null;
  gameCode: string | null;
  status: GameStatus;
}

const initialState: GameState = {
  sessionId: sessionStorage.getItem('session_id'),
  gameCode: null,
  status: 'IDLE',
};

export type GameAction =
  | { type: 'GAME_JOINED'; gameCode: string }
  | { type: 'GAME_STARTED' }
  | { type: 'GAME_FINISHED' }
  | { type: 'RESET' };

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'GAME_JOINED':  return { ...state, gameCode: action.gameCode, status: 'LOBBY' };
    case 'GAME_STARTED': return { ...state, status: 'IN_PROGRESS' };
    case 'GAME_FINISHED': return { ...state, status: 'FINISHED' };
    case 'RESET': return { ...initialState };
    default: return state;
  }
}

const GameContext = createContext<{ state: GameState; dispatch: Dispatch<GameAction> } | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return createElement(GameContext.Provider, { value: { state, dispatch } }, children);
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
