import type { QuizConfig } from './quiz-types';
import { getAllQuizzes } from './quiz-loader';

/**
 * Generate static params for all quiz pages
 * Use this in your quiz pages for static generation
 */
export async function generateQuizStaticParams() {
  const quizzes = await getAllQuizzes();

  return quizzes.map((quiz) => ({
    id: quiz.id,
    slug: quiz.id,
  }));
}

/**
 * Route mapping for quiz URLs
 * All quizzes now use the dynamic /quizzes/[slug] route
 */
export const QUIZ_ROUTES: Record<string, string> = {
  'git-quiz': '/quizzes/git-quiz',
  'docker-quiz': '/quizzes/docker-quiz',
  'devops-quiz': '/quizzes/devops-quiz',
  'kubernetes-quiz': '/quizzes/kubernetes-quiz',
  'terraform-quiz': '/quizzes/terraform-quiz',
  // Add more quiz routes here as you create them
  // 'aws-fundamentals': '/quizzes/aws-fundamentals',
  // 'ansible-basics': '/quizzes/ansible-basics',
  // 'jenkins-pipelines': '/quizzes/jenkins-pipelines',
};

/**
 * Get URL for a quiz by ID
 */
export function getQuizUrl(quizId: string): string {
  return QUIZ_ROUTES[quizId] || `/quizzes/${quizId}`;
}

/**
 * Get all quiz routes for sitemap generation
 */
export async function getAllQuizRoutes(): Promise<
  Array<{
    url: string;
    lastModified?: Date;
    changeFrequency: 'monthly' | 'weekly' | 'daily';
    priority: number;
  }>
> {
  const quizzes = await getAllQuizzes();

  return quizzes.map((quiz) => ({
    url: getQuizUrl(quiz.id),
    ...(quiz.metadata.createdDate ? { lastModified: new Date(quiz.metadata.createdDate) } : {}),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
}

/**
 * Quiz statistics and analytics
 */
export function getQuizStats(quiz: QuizConfig) {
  const difficulties = quiz.questions.map((q) => q.difficulty);
  const points = quiz.questions.map((q) => q.points);

  return {
    totalQuestions: quiz.questions.length,
    totalPoints: quiz.totalPoints || points.reduce((sum, p) => sum + p, 0),
    averagePoints: Math.round(points.reduce((sum, p) => sum + p, 0) / quiz.questions.length),
    difficulty: {
      beginner: difficulties.filter((d) => d === 'beginner').length,
      intermediate: difficulties.filter((d) => d === 'intermediate').length,
      advanced: difficulties.filter((d) => d === 'advanced').length,
    },
    estimatedTime: quiz.metadata.estimatedTime,
    category: quiz.category,
    dominantDifficulty: getDominantDifficulty(difficulties),
  };
}

/**
 * Get the dominant difficulty level for a quiz
 */
function getDominantDifficulty(difficulties: string[]): 'beginner' | 'intermediate' | 'advanced' {
  const counts = {
    beginner: difficulties.filter((d) => d === 'beginner').length,
    intermediate: difficulties.filter((d) => d === 'intermediate').length,
    advanced: difficulties.filter((d) => d === 'advanced').length,
  };

  return Object.entries(counts).reduce(
    (max, [key, value]) => (value > counts[max as keyof typeof counts] ? (key as any) : max),
    'beginner'
  );
}

/**
 * Filter quizzes by criteria
 */
export function filterQuizzes(
  quizzes: QuizConfig[],
  filters: {
    category?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    minQuestions?: number;
    maxQuestions?: number;
    minPoints?: number;
    maxPoints?: number;
  }
) {
  return quizzes.filter((quiz) => {
    const stats = getQuizStats(quiz);

    if (filters.category && quiz.category !== filters.category) {
      return false;
    }

    if (filters.difficulty && stats.dominantDifficulty !== filters.difficulty) {
      return false;
    }

    if (filters.minQuestions && stats.totalQuestions < filters.minQuestions) {
      return false;
    }

    if (filters.maxQuestions && stats.totalQuestions > filters.maxQuestions) {
      return false;
    }

    if (filters.minPoints && stats.totalPoints < filters.minPoints) {
      return false;
    }

    if (filters.maxPoints && stats.totalPoints > filters.maxPoints) {
      return false;
    }

    return true;
  });
}

/**
 * Sort quizzes by various criteria
 */
export function sortQuizzes(
  quizzes: QuizConfig[],
  sortBy: 'title' | 'category' | 'difficulty' | 'questions' | 'points' | 'newest',
  direction: 'asc' | 'desc' = 'asc'
) {
  const sorted = [...quizzes].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'difficulty':
        const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
        const aDiff = getDominantDifficulty(a.questions.map((q) => q.difficulty));
        const bDiff = getDominantDifficulty(b.questions.map((q) => q.difficulty));
        comparison = difficultyOrder[aDiff] - difficultyOrder[bDiff];
        break;
      case 'questions':
        comparison = a.questions.length - b.questions.length;
        break;
      case 'points':
        const aPoints = a.totalPoints || a.questions.reduce((sum, q) => sum + q.points, 0);
        const bPoints = b.totalPoints || b.questions.reduce((sum, q) => sum + q.points, 0);
        comparison = aPoints - bPoints;
        break;
      case 'newest':
        // If you add created/updated timestamps to quiz configs, use those here
        comparison = a.id.localeCompare(b.id); // Fallback to ID for now
        break;
    }

    return direction === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Create a quiz summary for display
 */
export function createQuizSummary(quiz: QuizConfig) {
  const stats = getQuizStats(quiz);

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    url: getQuizUrl(quiz.id),
    stats,
    theme: quiz.theme,
    icon: quiz.icon,
    badges: generateQuizBadges(quiz),
  };
}

/**
 * Generate display badges for a quiz
 */
function generateQuizBadges(quiz: QuizConfig): Array<{
  text: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  color?: string;
}> {
  const badges = [];
  const stats = getQuizStats(quiz);

  // Difficulty badge
  const difficultyColors = {
    beginner: 'bg-green-500',
    intermediate: 'bg-yellow-500',
    advanced: 'bg-red-500',
  };

  badges.push({
    text: stats.dominantDifficulty,
    variant: 'default' as const,
    color: difficultyColors[stats.dominantDifficulty],
  });

  // Length badge
  if (stats.totalQuestions >= 10) {
    badges.push({
      text: 'Comprehensive',
      variant: 'secondary' as const,
    });
  } else if (stats.totalQuestions <= 5) {
    badges.push({
      text: 'Quick',
      variant: 'outline' as const,
    });
  }

  // Points badge
  if (stats.totalPoints >= 100) {
    badges.push({
      text: 'High Value',
      variant: 'default' as const,
      color: 'bg-purple-500',
    });
  }

  return badges;
}

/**
 * Performance analysis for quiz completion
 */
export function analyzeQuizPerformance(
  quiz: QuizConfig,
  userAnswers: number[],
  timeSpent?: number
): {
  score: number;
  percentage: number;
  correctAnswers: number;
  incorrectAnswers: number;
  difficultyBreakdown: Record<string, { correct: number; total: number }>;
  timePerQuestion?: number;
  performance: 'excellent' | 'good' | 'needs-improvement' | 'poor';
} {
  const correctAnswers = userAnswers.filter(
    (answer, index) => answer === quiz.questions[index].correctAnswer
  ).length;

  const score = quiz.questions.reduce((sum, question, index) => {
    return sum + (userAnswers[index] === question.correctAnswer ? question.points : 0);
  }, 0);

  const percentage = Math.round((score / quiz.totalPoints) * 100);

  // Difficulty breakdown
  const difficultyBreakdown: Record<string, { correct: number; total: number }> = {
    beginner: { correct: 0, total: 0 },
    intermediate: { correct: 0, total: 0 },
    advanced: { correct: 0, total: 0 },
  };

  quiz.questions.forEach((question, index) => {
    difficultyBreakdown[question.difficulty].total++;
    if (userAnswers[index] === question.correctAnswer) {
      difficultyBreakdown[question.difficulty].correct++;
    }
  });

  // Performance rating
  let performance: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  if (percentage >= 90) performance = 'excellent';
  else if (percentage >= 75) performance = 'good';
  else if (percentage >= 60) performance = 'needs-improvement';
  else performance = 'poor';

  return {
    score,
    percentage,
    correctAnswers,
    incorrectAnswers: quiz.questions.length - correctAnswers,
    difficultyBreakdown,
    timePerQuestion: timeSpent ? Math.round(timeSpent / quiz.questions.length) : undefined,
    performance,
  };
}

/**
 * Generate quiz recommendations based on performance
 */
export function generateQuizRecommendations(
  completedQuiz: QuizConfig,
  performance: ReturnType<typeof analyzeQuizPerformance>,
  allQuizzes: QuizConfig[]
): QuizConfig[] {
  const recommendations = [];

  // If user did well, suggest harder quizzes in same category
  if (performance.performance === 'excellent' || performance.performance === 'good') {
    const sameCategory = allQuizzes.filter(
      (quiz) => quiz.category === completedQuiz.category && quiz.id !== completedQuiz.id
    );
    recommendations.push(...sameCategory);
  }

  // If user struggled, suggest easier quizzes or same difficulty in different topics
  if (performance.performance === 'needs-improvement' || performance.performance === 'poor') {
    const easierQuizzes = allQuizzes.filter((quiz) => {
      const stats = getQuizStats(quiz);
      return stats.dominantDifficulty === 'beginner' && quiz.id !== completedQuiz.id;
    });
    recommendations.push(...easierQuizzes);
  }

  // Always suggest quizzes from different categories
  const otherCategories = allQuizzes.filter((quiz) => quiz.category !== completedQuiz.category);
  recommendations.push(...otherCategories);

  // Remove duplicates and limit to 3 recommendations
  const uniqueRecommendations = recommendations.filter(
    (quiz, index, self) => self.findIndex((q) => q.id === quiz.id) === index
  );

  return uniqueRecommendations.slice(0, 3);
}
