import { randomUUID } from 'crypto';
import { QuestionGenerator, QuestionGenInput, GeneratedQuestion } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const recentTrackGenerator: QuestionGenerator = {
  type: 'RECENT_TRACK',

  canGenerate(input: QuestionGenInput): boolean {
    return input.players.length >= 2 && input.players.some(p => p.recentlyPlayed.length > 0);
  },

  generate(input: QuestionGenInput): GeneratedQuestion | null {
    const eligible = input.players.filter(p => p.recentlyPlayed.length > 0);
    if (eligible.length === 0) return null;

    const owner = eligible[Math.floor(Math.random() * eligible.length)];
    const track = owner.recentlyPlayed[Math.floor(Math.random() * owner.recentlyPlayed.length)];
    const artistName = track.artists[0]?.name ?? 'Unknown Artist';

    const options = shuffle(input.players.map(p => ({ id: p.userId, label: p.displayName })));

    return {
      id: randomUUID(),
      type: 'RECENT_TRACK',
      prompt: `Who recently listened to "${track.name}" by ${artistName}?`,
      options,
      correctAnswerId: owner.userId,
      spotifyUri: track.uri,
      previewUrl: track.preview_url ?? undefined,
    };
  },
};
