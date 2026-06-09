import path from 'path';
import type { QuizConfig } from './quiz-types';
import { createCachedLoader, isFileNotFound, readJsonFile, readJsonFiles } from './content-loader';
import { rankRelatedByScore } from './related-content';

const QUIZZES_DIR = path.join(process.cwd(), 'content', 'quizzes');

/**
 * Process a quiz to ensure all required fields are calculated
 */
function processQuiz(quiz: QuizConfig): QuizConfig {
  // Calculate total points if not provided
  if (!quiz.totalPoints) {
    quiz.totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
  }

  // Calculate difficulty distribution
  if (!quiz.metadata.difficultyLevels) {
    quiz.metadata.difficultyLevels = {
      beginner: quiz.questions.filter((q) => q.difficulty === 'beginner').length,
      intermediate: quiz.questions.filter((q) => q.difficulty === 'intermediate').length,
      advanced: quiz.questions.filter((q) => q.difficulty === 'advanced').length,
    };
  }

  return quiz;
}

const loadQuizzes = createCachedLoader(() =>
  readJsonFiles<QuizConfig>(QUIZZES_DIR, (quiz) => processQuiz(quiz))
);

/**
 * Get all available quiz configurations
 */
export async function getAllQuizzes(): Promise<QuizConfig[]> {
  return loadQuizzes();
}

/**
 * Get a specific quiz by ID
 */
export async function getQuizById(id: string): Promise<QuizConfig | null> {
  // Try to get from cache first
  const quizzes = await getAllQuizzes();
  const cachedQuiz = quizzes.find((q) => q.id === id);

  if (cachedQuiz) {
    return cachedQuiz;
  }

  try {
    const quiz = await readJsonFile<QuizConfig>(path.join(QUIZZES_DIR, `${id}.json`));
    return processQuiz(quiz);
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Get quiz metadata for listing purposes (without full question data)
 */
export async function getQuizMetadata(): Promise<
  Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    icon: string;
    totalQuestions: number;
    totalPoints: number;
    estimatedTime: string;
    theme: QuizConfig['theme'];
    difficultyLevels: QuizConfig['metadata']['difficultyLevels'];
    createdDate?: string;
  }>
> {
  const quizzes = await getAllQuizzes();
  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    icon: quiz.icon,
    totalQuestions: quiz.questions.length,
    totalPoints: quiz.totalPoints,
    estimatedTime: quiz.metadata.estimatedTime,
    theme: quiz.theme,
    difficultyLevels: quiz.metadata.difficultyLevels,
    createdDate: quiz.metadata.createdDate,
  }));
}

/**
 * Get unique categories from all quizzes
 */
export async function getQuizCategories(): Promise<string[]> {
  const quizzes = await getAllQuizzes();
  const categories = new Set(quizzes.map((quiz) => quiz.category));
  return Array.from(categories).sort();
}

/**
 * Get related quizzes based on category, tags, and difficulty
 */
export async function getRelatedQuizzes(
  currentId: string,
  category: string,
  limit = 3
): Promise<QuizConfig[]> {
  const quizzes = await getAllQuizzes();
  const currentQuiz = quizzes.find((q) => q.id === currentId);
  const currentTags = currentQuiz?.metadata?.tags || [];

  // Similar difficulty distribution (closer is better, max 3 points)
  const difficultySimilarity = (quiz: QuizConfig): number => {
    if (!currentQuiz?.metadata.difficultyLevels || !quiz.metadata.difficultyLevels) {
      return 0;
    }
    const currentDiff = currentQuiz.metadata.difficultyLevels;
    const quizDiff = quiz.metadata.difficultyLevels;
    const totalDiff =
      Math.abs(currentDiff.beginner - quizDiff.beginner) +
      Math.abs(currentDiff.intermediate - quizDiff.intermediate) +
      Math.abs(currentDiff.advanced - quizDiff.advanced);
    if (totalDiff <= 3) return 3;
    if (totalDiff <= 6) return 2;
    if (totalDiff <= 9) return 1;
    return 0;
  };

  const candidates = quizzes
    .filter((quiz) => quiz.id !== currentId)
    .map((quiz) => ({
      item: quiz,
      tags: quiz.metadata?.tags,
      sameCategory: quiz.category === category,
      date: quiz.metadata.createdDate || null,
      extraScore: difficultySimilarity(quiz),
    }));

  return rankRelatedByScore(currentTags, candidates, { limit, recencyWindowDays: 90 });
}
