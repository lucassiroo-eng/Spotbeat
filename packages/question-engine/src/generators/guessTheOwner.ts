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

export const guessTheOwnerGenerator: QuestionGenerator = {
  type: 'GUESS_THE_OWNER',

  canGenerate(input: QuestionGenInput): boolean {
    return input.players.length >= 2 && input.players.some(p => p.topTracks.length > 0);
  },

  generate(input: QuestionGenInput): GeneratedQuestion | null {
    const eligible = input.players.filter(p => p.topTracks.length > 0);
    if (eligible.length === 0) return null;

    const owner = eligible[Math.floor(Math.random() * eligible.length)];
    const track = owner.topTracks[Math.floor(Math.random() * owner.topTracks.length)];

    const options = shuffle(input.players.map(p => ({ id: p.userId, label: p.displayName })));

    const artistName = track.artists[0]?.name ?? 'Unknown';
    return {
      id: randomUUID(),
      type: 'GUESS_THE_OWNER',
      prompt: `"${track.name}" by ${artistName} is one of whose most-listened tracks?`,
      options,
      correctAnswerId: owner.userId,
      spotifyUri: track.uri,
      previewUrl: track.preview_url ?? undefined,
      albumArt: track.albumArt,
    };
  },
};
