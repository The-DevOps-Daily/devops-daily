import path from 'path';
import type { QuizConfig } from './quiz-types';
import { createCachedLoader, isFileNotFound, readJsonFile, readJsonFiles } from './content-loader';

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
