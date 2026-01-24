/**
 * Utility functions and types for interview questions
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type ExperienceTier = 'junior' | 'mid' | 'senior';

export interface CodeExample {
  language: string;
  code: string;
  label?: string;
}

export interface InterviewQuestion {
  id: string;
  slug: string;
  title: string;
  question: string;
  answer: string;
  explanation?: string;
  category: string;
  difficulty: Difficulty;
  tier: ExperienceTier;
  tags: string[];
  codeExamples?: CodeExample[];
  followUpQuestions?: string[];
  commonMistakes?: string[];
  relatedTopics?: string[];
  resources?: Array<{
    title: string;
    url: string;
  }>;
}

export interface InterviewQuestionProgress {
  [questionId: string]: {
    reviewed: boolean;
    confident: boolean;
    reviewedAt?: string;
  };
}

export interface QuizModeState {
  currentIndex: number;
  answers: Record<string, boolean>; // questionId -> correct/incorrect
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface QuizModeResult {
  correct: number;
  total: number;
  percentage: number;
  timeSpent?: number; // in seconds
}

const STORAGE_PREFIX = 'interview_progress_';
const QUIZ_MODE_PREFIX = 'interview_quiz_';

/**
 * Get interview progress from localStorage
 */
export const getInterviewProgress = (category?: string): InterviewQuestionProgress => {
  if (typeof window === 'undefined') return {};
  
  const key = category ? `${STORAGE_PREFIX}${category}` : `${STORAGE_PREFIX}all`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : {};
};

/**
 * Save interview progress to localStorage
 */
export const saveInterviewProgress = (
  progress: InterviewQuestionProgress,
  category?: string
): void => {
  if (typeof window === 'undefined') return;
  
  const key = category ? `${STORAGE_PREFIX}${category}` : `${STORAGE_PREFIX}all`;
  localStorage.setItem(key, JSON.stringify(progress));
};

/**
 * Mark a question as reviewed
 */
export const markQuestionReviewed = (
  questionId: string,
  confident: boolean,
  category?: string
): void => {
  const progress = getInterviewProgress(category);
  progress[questionId] = {
    reviewed: true,
    confident,
    reviewedAt: new Date().toISOString(),
  };
  saveInterviewProgress(progress, category);
};

/**
 * Calculate progress percentage
 */
export const calculateInterviewProgress = (
  questions: InterviewQuestion[],
  progress: InterviewQuestionProgress
): { reviewed: number; confident: number; total: number } => {
  const total = questions.length;
  const reviewed = questions.filter(q => progress[q.id]?.reviewed).length;
  const confident = questions.filter(q => progress[q.id]?.confident).length;
  
  return { reviewed, confident, total };
};

/**
 * Reset interview progress
 */
export const resetInterviewProgress = (category?: string): void => {
  if (typeof window === 'undefined') return;
  
  const key = category ? `${STORAGE_PREFIX}${category}` : `${STORAGE_PREFIX}all`;
  localStorage.removeItem(key);
};

/**
 * Get difficulty color class
 */
export const getDifficultyColor = (difficulty: Difficulty): string => {
  switch (difficulty) {
    case 'beginner':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'advanced':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

/**
 * Get tier color class
 */
export const getTierColor = (tier: ExperienceTier): string => {
  switch (tier) {
    case 'junior':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'mid':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'senior':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

/**
 * Get tier label
 */
export const getTierLabel = (tier: ExperienceTier): string => {
  switch (tier) {
    case 'junior':
      return 'Junior';
    case 'mid':
      return 'Mid-Level';
    case 'senior':
      return 'Senior';
    default:
      return tier;
  }
};

/**
 * Get quiz mode state from localStorage
 */
export const getQuizModeState = (category?: string): QuizModeState | null => {
  if (typeof window === 'undefined') return null;
  
  const key = category ? `${QUIZ_MODE_PREFIX}${category}` : `${QUIZ_MODE_PREFIX}all`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

/**
 * Save quiz mode state to localStorage
 */
export const saveQuizModeState = (state: QuizModeState, category?: string): void => {
  if (typeof window === 'undefined') return;
  
  const key = category ? `${QUIZ_MODE_PREFIX}${category}` : `${QUIZ_MODE_PREFIX}all`;
  localStorage.setItem(key, JSON.stringify(state));
};

/**
 * Clear quiz mode state
 */
export const clearQuizModeState = (category?: string): void => {
  if (typeof window === 'undefined') return;
  
  const key = category ? `${QUIZ_MODE_PREFIX}${category}` : `${QUIZ_MODE_PREFIX}all`;
  localStorage.removeItem(key);
};

/**
 * Calculate quiz result from state
 */
export const calculateQuizResult = (state: QuizModeState): QuizModeResult => {
  const answers = Object.values(state.answers);
  const correct = answers.filter(Boolean).length;
  const total = answers.length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  let timeSpent: number | undefined;
  if (state.startedAt && state.completedAt) {
    timeSpent = Math.round(
      (new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()) / 1000
    );
  }
  
  return { correct, total, percentage, timeSpent };
};

/**
 * Get score rating based on percentage
 */
export const getScoreRating = (percentage: number): { label: string; emoji: string } => {
  if (percentage >= 90) return { label: 'Expert!', emoji: '🏆' };
  if (percentage >= 75) return { label: 'Great job!', emoji: '⭐' };
  if (percentage >= 60) return { label: 'Good effort!', emoji: '👍' };
  if (percentage >= 40) return { label: 'Keep practicing!', emoji: '📚' };
  return { label: 'Review the material', emoji: '💪' };
};
