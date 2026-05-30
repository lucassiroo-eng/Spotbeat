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

function capitalize(s: string): string {
  return s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export const mostLikelyToGenerator: QuestionGenerator = {
  type: 'MOST_LIKELY_TO',

  canGenerate(input: QuestionGenInput): boolean {
    if (input.players.length < 2) return false;
    const playersWithGenres = input.players.filter(p => p.topArtists.some(a => (a.genres ?? []).length > 0));
    if (playersWithGenres.length < 2) return false;
    // Need at least one genre shared by 2+ players (makes it a real competition)
    const genreCounts = new Map<string, number>();
    for (const p of playersWithGenres) {
      for (const g of new Set(p.topArtists.flatMap(a => a.genres ?? []))) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }
    return [...genreCounts.values()].some(c => c >= 2);
  },

  generate(input: QuestionGenInput): GeneratedQuestion | null {
    // Build genre → count of matching artists per player
    const genreCounts = new Map<string, number>();
    for (const p of input.players) {
      for (const g of new Set(p.topArtists.flatMap(a => a.genres ?? []))) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }

    const sharedGenres = [...genreCounts.entries()]
      .filter(([, c]) => c >= 2)
      .map(([g]) => g);
    if (sharedGenres.length === 0) return null;

    const genre = sharedGenres[Math.floor(Math.random() * sharedGenres.length)];

    const playerScores = input.players.map(p => ({
      player: p,
      count: p.topArtists.filter(a => (a.genres ?? []).includes(genre)).length,
    }));
    const maxCount = Math.max(...playerScores.map(s => s.count));
    if (maxCount === 0) return null;

    const winners = playerScores.filter(s => s.count === maxCount);
    const winner = winners[Math.floor(Math.random() * winners.length)].player;

    const options = shuffle(input.players.map(p => ({ id: p.userId, label: p.displayName })));

    return {
      id: randomUUID(),
      type: 'MOST_LIKELY_TO',
      prompt: `Who listens to the most ${capitalize(genre)} music?`,
      options,
      correctAnswerId: winner.userId,
    };
  },
};
