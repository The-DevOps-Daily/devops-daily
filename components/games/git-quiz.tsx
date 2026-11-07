'use client';

import GenericQuiz from '@/components/games/generic-quiz';
import gitQuiz from '@/content/quizzes/git-quiz.json';
import type { QuizConfig } from '@/lib/quiz-types';

/** The Git Command Quiz from content/quizzes/git-quiz.json, the same quiz as /games/git-quiz. */
export default function GitQuiz() {
  return <GenericQuiz quizConfig={gitQuiz as QuizConfig} />;
}
