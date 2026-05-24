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

export const oddOneOutGenerator: QuestionGenerator = {
  type: 'ODD_ONE_OUT',

  canGenerate(input: QuestionGenInput): boolean {
    if (input.players.length < 2) return false;
    const hasTarget = input.players.some(p => p.topArtists.length >= 3);
    const playersWithArtists = input.players.filter(p => p.topArtists.length >= 1);
    return hasTarget && playersWithArtists.length >= 2;
  },

  generate(input: QuestionGenInput): GeneratedQuestion | null {
    const targets = input.players.filter(p => p.topArtists.length >= 3);
    if (targets.length === 0) return null;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const targetIds = new Set(target.topArtists.map(a => a.id));

    // Distractor: an artist from another player not in target's list
    const distractors = input.players
      .filter(p => p.userId !== target.userId)
      .flatMap(p => p.topArtists)
      .filter(a => !targetIds.has(a.id));

    if (distractors.length === 0) return null;

    const distractor = distractors[Math.floor(Math.random() * distractors.length)];
    const real = shuffle([...target.topArtists]).slice(0, 3);

    const options = shuffle([
      ...real.map(a => ({ id: a.id, label: a.name })),
      { id: distractor.id, label: distractor.name },
    ]);

    return {
      id: randomUUID(),
      type: 'ODD_ONE_OUT',
      prompt: `Which of these is NOT in ${target.displayName}'s top artists?`,
      options,
      correctAnswerId: distractor.id,
    };
  },
};
