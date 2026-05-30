export type QuestionType =
  | 'GUESS_THE_OWNER'
  | 'TOP_ARTIST_MATCH'
  | 'MOST_LIKELY_TO'
  | 'RECENT_TRACK';

export interface Artist {
  id: string;
  name: string;
  genres: string[];
}

export interface Track {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  artists: Artist[];
  albumArt?: string;
}

export interface PlayerMusicData {
  userId: string;
  displayName: string;
  topArtists: Artist[];
  topTracks: Track[];
  recentlyPlayed: Track[];
}

export interface QuestionGenConfig {
  questionCount: number;
  genres: string[] | 'all';
  enabledTypes: QuestionType[];
}

export interface QuestionGenInput {
  players: PlayerMusicData[];
  config: QuestionGenConfig;
}

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  speaker?: {
    userId: string;
    displayName: string;
  };
  prompt: string;
  options: { id: string; label: string }[];
  correctAnswerId: string;
  spotifyUri?: string;
  previewUrl?: string;
  albumArt?: string;
  duration?: number;
  genre?: string;
}

export interface QuestionGenerator {
  type: QuestionType;
  canGenerate: (input: QuestionGenInput) => boolean;
  generate: (input: QuestionGenInput) => GeneratedQuestion | null;
}
