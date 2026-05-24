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

export const genreGuessGenerator: QuestionGenerator = {
  type: 'GENRE_GUESS',

  canGenerate(input: QuestionGenInput): boolean {
    const allGenres = new Set(input.players.flatMap(p => p.topArtists.flatMap(a => a.genres)));
    const artistsWithGenres = input.players.flatMap(p => p.topArtists).filter(a => a.genres.length > 0);
    return artistsWithGenres.length >= 1 && allGenres.size >= 4;
  },

  generate(input: QuestionGenInput): GeneratedQuestion | null {
    const artistsWithGenres = input.players.flatMap(p => p.topArtists).filter(a => a.genres.length > 0);
    if (artistsWithGenres.length === 0) return null;

    const artist = artistsWithGenres[Math.floor(Math.random() * artistsWithGenres.length)];
    const correctGenre = artist.genres[0];

    const distractorPool = shuffle([
      ...new Set(
        input.players.flatMap(p => p.topArtists).flatMap(a => a.genres).filter(g => g !== correctGenre)
      ),
    ]).slice(0, 3);

    if (distractorPool.length < 3) return null;

    const correctId = `g_${correctGenre.replace(/\W+/g, '_')}`;
    const options = shuffle([
      { id: correctId, label: capitalize(correctGenre) },
      ...distractorPool.map(g => ({ id: `g_${g.replace(/\W+/g, '_')}`, label: capitalize(g) })),
    ]);

    return {
      id: randomUUID(),
      type: 'GENRE_GUESS',
      prompt: `What genre best describes "${artist.name}"?`,
      options,
      correctAnswerId: correctId,
      genre: correctGenre,
    };
  },
};
