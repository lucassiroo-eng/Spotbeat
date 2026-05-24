import { createContext, useContext, useReducer, Dispatch } from 'react';

export type GameStatus = 'IDLE' | 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';

export interface Player {
  userId: string;
  displayName: string;
  score: number;
  ready: boolean;
}

export interface GameState {
  sessionId: string | null;
  gameCode: string | null;
  status: GameStatus;
  players: Player[];
  isHost: boolean;
}

const initialState: GameState = {
  sessionId: null,
  gameCode: null,
  status: 'IDLE',
  players: [],
  isHost: false,
};

export type GameAction =
  | { type: 'SESSION_SET'; sessionId: string }
  | { type: 'GAME_JOINED'; gameCode: string; isHost: boolean }
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_READY'; userId: string }
  | { type: 'GAME_STARTED' }
  | { type: 'GAME_FINISHED' }
  | { type: 'RESET' };

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SESSION_SET':
      return { ...state, sessionId: action.sessionId };
    case 'GAME_JOINED':
      return { ...state, gameCode: action.gameCode, isHost: action.isHost, status: 'LOBBY' };
    case 'PLAYER_JOINED':
      return { ...state, players: [...state.players, action.player] };
    case 'PLAYER_READY':
      return {
        ...state,
        players: state.players.map(p => p.userId === action.userId ? { ...p, ready: true } : p),
      };
    case 'GAME_STARTED':
      return { ...state, status: 'IN_PROGRESS' };
    case 'GAME_FINISHED':
      return { ...state, status: 'FINISHED' };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export const GameContext = createContext<{ state: GameState; dispatch: Dispatch<GameAction> } | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export function createGameStore() {
  return useReducer(reducer, initialState);
}
