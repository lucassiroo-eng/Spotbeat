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

export const topArtistMatchGenerator: QuestionGenerator = {
  type: 'TOP_ARTIST_MATCH',

  canGenerate(input: QuestionGenInput): boolean {
    return input.players.length >= 2 && input.players.some(p => p.topArtists.length > 0);
  },

  generate(input: QuestionGenInput): GeneratedQuestion | null {
    const eligible = input.players.filter(p => p.topArtists.length > 0);
    if (eligible.length === 0) return null;

    const owner = eligible[Math.floor(Math.random() * eligible.length)];
    const artist = owner.topArtists[Math.floor(Math.random() * owner.topArtists.length)];

    const options = shuffle(input.players.map(p => ({ id: p.userId, label: p.displayName })));

    return {
      id: randomUUID(),
      type: 'TOP_ARTIST_MATCH',
      prompt: `Which player's top artist is "${artist.name}"?`,
      options,
      correctAnswerId: owner.userId,
    };
  },
};
