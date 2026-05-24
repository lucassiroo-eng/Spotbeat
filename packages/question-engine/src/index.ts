import { QuestionGenInput, GeneratedQuestion } from './types';
import { guessTheOwnerGenerator } from './generators/guessTheOwner';
import { topArtistMatchGenerator } from './generators/topArtistMatch';
import { mostLikelyToGenerator } from './generators/mostLikelyTo';
import { oddOneOutGenerator } from './generators/oddOneOut';
import { genreGuessGenerator } from './generators/genreGuess';

export * from './types';

const generators = [
  guessTheOwnerGenerator,
  topArtistMatchGenerator,
  mostLikelyToGenerator,
  oddOneOutGenerator,
  genreGuessGenerator,
];

export function generateQuestions(input: QuestionGenInput): GeneratedQuestion[] {
  const { config } = input;
  const eligible = generators.filter(
    g => config.enabledTypes.includes(g.type) && g.canGenerate(input)
  );

  if (eligible.length === 0) return [];

  const questions: GeneratedQuestion[] = [];

  for (let i = 0; i < config.questionCount; i++) {
    const generator = eligible[i % eligible.length];
    const question = generator.generate(input);
    if (question) questions.push(question);
  }

  return questions;
}
