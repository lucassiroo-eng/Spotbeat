import { QuestionGenInput, GeneratedQuestion, QuestionGenerator } from './types';
import { randomUUID } from 'crypto';

export * from './types';

const generators: QuestionGenerator[] = [
  // Phase 3: register generators here
  // e.g. guessTheOwnerGenerator, topArtistMatchGenerator, ...
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
    if (question) {
      questions.push({ ...question, id: randomUUID() });
    }
  }

  return questions;
}
