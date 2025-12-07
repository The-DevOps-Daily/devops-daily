import fs from 'fs/promises';
import path from 'path';
import type { QuizConfig } from './quiz-types';

const QUIZZES_DIR = path.join(process.cwd(), 'content', 'quizzes');

// Cache for quizzes to avoid re-reading files on every request
let quizzesCache: QuizConfig[] | null = null;
let lastCacheTime = 0;
// During build, use infinite cache; during runtime, use 5-minute cache
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

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

/**
 * Get all available quiz configurations
 */
export async function getAllQuizzes(): Promise<QuizConfig[]> {
  // Check if cache is still valid
  const now = Date.now();
  if (quizzesCache && now - lastCacheTime < CACHE_DURATION) {
    return quizzesCache;
  }

  try {
    const files = await fs.readdir(QUIZZES_DIR);
    const quizFiles = files.filter((file) => file.endsWith('.json'));

    const quizzes = await Promise.all(
      quizFiles.map(async (file) => {
        const filePath = path.join(QUIZZES_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const quiz = JSON.parse(content) as QuizConfig;
        return processQuiz(quiz);
      })
    );

    // Update cache
    quizzesCache = quizzes;
    lastCacheTime = now;

    return quizzes;
  } catch (error) {
    console.error('Error loading quizzes:', error);
    return [];
  }
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

  // If not in cache, try to load directly (fallback)
  try {
    const filePath = path.join(QUIZZES_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const quiz = JSON.parse(content) as QuizConfig;
    return processQuiz(quiz);
  } catch (error) {
    console.error(`Error loading quiz ${id}:`, error);
    return null;
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
  }>
> {
  try {
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
    }));
  } catch (error) {
    console.error('Error loading quiz metadata:', error);
    return [];
  }
}

/**
 * Get unique categories from all quizzes
 */
export async function getQuizCategories(): Promise<string[]> {
  const quizzes = await getAllQuizzes();
  const categories = new Set(quizzes.map((quiz) => quiz.category));
  return Array.from(categories).sort();
}
