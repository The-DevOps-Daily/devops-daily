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
    createdDate?: string;
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
      createdDate: quiz.metadata.createdDate,
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
  
  // Filter out current quiz
  const candidateQuizzes = quizzes.filter((quiz) => quiz.id !== currentId);
  
  // Score each candidate quiz
  const scoredQuizzes = candidateQuizzes.map((quiz) => {
    let score = 0;
    
    // Tag matches (highest priority: 10 points per matching tag)
    if (quiz.metadata?.tags && currentTags.length > 0) {
      const matchingTags = quiz.metadata.tags.filter((tag) => currentTags.includes(tag));
      score += matchingTags.length * 10;
    }
    
    // Same category (5 points)
    if (quiz.category === category) {
      score += 5;
    }
    
    // Similar difficulty distribution (1 point per matching level)
    if (currentQuiz?.metadata.difficultyLevels && quiz.metadata.difficultyLevels) {
      const currentDiff = currentQuiz.metadata.difficultyLevels;
      const quizDiff = quiz.metadata.difficultyLevels;
      
      // Compare difficulty distributions (closer is better)
      const beginnerDiff = Math.abs(currentDiff.beginner - quizDiff.beginner);
      const intermediateDiff = Math.abs(currentDiff.intermediate - quizDiff.intermediate);
      const advancedDiff = Math.abs(currentDiff.advanced - quizDiff.advanced);
      
      // Award points for similar difficulty (max 3 points)
      const totalDiff = beginnerDiff + intermediateDiff + advancedDiff;
      if (totalDiff <= 3) score += 3;
      else if (totalDiff <= 6) score += 2;
      else if (totalDiff <= 9) score += 1;
    }
    
    // Recency bonus (2 points for quizzes created within last 90 days)
    if (quiz.metadata.createdDate) {
      const quizDate = new Date(quiz.metadata.createdDate).getTime();
      const daysSinceCreated = (Date.now() - quizDate) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated < 90) {
        score += 2;
      }
    }
    
    return { quiz, score };
  });
  
  // Sort by score (descending) and return top results
  return scoredQuizzes
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ quiz }) => quiz);
}
