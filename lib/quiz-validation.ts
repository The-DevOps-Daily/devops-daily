import type { QuizConfig, QuizQuestion } from './quiz-types';

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validates a quiz configuration for common issues
 */
export function validateQuizConfig(config: QuizConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Basic required fields
  if (!config.id) {
    errors.push({ path: 'id', message: 'Quiz ID is required', severity: 'error' });
  }

  if (!config.title) {
    errors.push({ path: 'title', message: 'Quiz title is required', severity: 'error' });
  }

  if (!config.description) {
    errors.push({
      path: 'description',
      message: 'Quiz description is required',
      severity: 'error',
    });
  }

  if (!config.category) {
    errors.push({ path: 'category', message: 'Quiz category is required', severity: 'error' });
  }

  // Validate questions array
  if (!config.questions || config.questions.length === 0) {
    errors.push({
      path: 'questions',
      message: 'Quiz must have at least one question',
      severity: 'error',
    });
  } else {
    config.questions.forEach((question, index) => {
      const questionErrors = validateQuestion(question, `questions[${index}]`);
      errors.push(...questionErrors.filter((e) => e.severity === 'error'));
      warnings.push(...questionErrors.filter((e) => e.severity === 'warning'));
    });
  }

  // Validate theme
  if (!config.theme) {
    warnings.push({
      path: 'theme',
      message: 'Theme configuration is missing',
      severity: 'warning',
    });
  } else {
    if (!config.theme.gradientFrom) {
      warnings.push({
        path: 'theme.gradientFrom',
        message: 'Gradient from color is missing',
        severity: 'warning',
      });
    }
    if (!config.theme.gradientTo) {
      warnings.push({
        path: 'theme.gradientTo',
        message: 'Gradient to color is missing',
        severity: 'warning',
      });
    }
  }

  // Validate metadata
  if (!config.metadata) {
    warnings.push({ path: 'metadata', message: 'Metadata is missing', severity: 'warning' });
  } else {
    if (!config.metadata.estimatedTime) {
      warnings.push({
        path: 'metadata.estimatedTime',
        message: 'Estimated time is missing',
        severity: 'warning',
      });
    }
  }

  // Validate total points calculation
  const calculatedPoints = config.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  if (config.totalPoints && config.totalPoints !== calculatedPoints) {
    warnings.push({
      path: 'totalPoints',
      message: `Total points (${config.totalPoints}) doesn't match sum of question points (${calculatedPoints})`,
      severity: 'warning',
    });
  }

  // Check for duplicate question IDs
  const questionIds = config.questions.map((q) => q.id);
  const duplicateIds = Array.from(
    new Set(questionIds.filter((id, index) => questionIds.indexOf(id) !== index))
  );
  if (duplicateIds.length > 0) {
    errors.push({
      path: 'questions',
      message: `Duplicate question IDs found: ${duplicateIds.join(', ')}`,
      severity: 'error',
    });
  }

  // Validate difficulty distribution
  const difficulties = config.questions.map((q) => q.difficulty);
  const difficultyCount = {
    beginner: difficulties.filter((d) => d === 'beginner').length,
    intermediate: difficulties.filter((d) => d === 'intermediate').length,
    advanced: difficulties.filter((d) => d === 'advanced').length,
  };

  if (difficultyCount.beginner === 0) {
    warnings.push({
      path: 'questions',
      message: 'No beginner questions found - consider adding some for accessibility',
      severity: 'warning',
    });
  }

  if (config.questions.length > 5 && difficultyCount.advanced === 0) {
    warnings.push({
      path: 'questions',
      message: 'No advanced questions found - consider adding some for experienced users',
     severity: 'warning',
   });
 }

  // Validate answer distribution
  const answerDistribution = validateAnswerDistribution(config.questions);
  warnings.push(...answerDistribution);

 return {
   isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates answer distribution across all questions
 */
function validateAnswerDistribution(questions: QuizQuestion[]): ValidationError[] {
  const warnings: ValidationError[] = [];
  
  if (questions.length === 0) {
    return warnings;
  }

  // Count how many times each answer option is used
  const distribution: Record<number, number> = {};
  questions.forEach((question) => {
    const correctAnswer = question.correctAnswer;
    distribution[correctAnswer] = (distribution[correctAnswer] || 0) + 1;
  });

  const totalQuestions = questions.length;
  const distributionText = Object.entries(distribution)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([answer, count]) => {
      const percentage = Math.round((count / totalQuestions) * 100);
      return `Option ${answer}: ${count} questions (${percentage}%)`;
    })
    .join(', ');

  // Warn if any option used > 50% of the time
  for (const [answer, count] of Object.entries(distribution)) {
    const percentage = (count / totalQuestions) * 100;
    if (percentage > 50) {
      warnings.push({
        path: 'questions.correctAnswer',
        message: `Answer option ${answer} is used ${count}/${totalQuestions} times (${Math.round(percentage)}%) - Distribution: ${distributionText}. Consider redistributing answers more evenly.`,
        severity: 'warning',
      });
    }
  }

  // Warn if any option (0-3) is never used for quizzes with 8+ questions
  if (totalQuestions >= 8) {
    for (let option = 0; option <= 3; option++) {
      if (!distribution[option]) {
        warnings.push({
          path: 'questions.correctAnswer',
          message: `Answer option ${option} is never used - Distribution: ${distributionText}. Consider using all answer options for better balance.`,
          severity: 'warning',
        });
      }
    }
  }

  return warnings;
}

/**
 * Validates a single question
 */
function validateQuestion(question: QuizQuestion, path: string): ValidationError[] {
  const issues: ValidationError[] = [];

  // Required fields
  if (!question.id) {
    issues.push({ path: `${path}.id`, message: 'Question ID is required', severity: 'error' });
  }

  if (!question.title) {
    issues.push({
      path: `${path}.title`,
      message: 'Question title is required',
      severity: 'error',
    });
  }

  if (!question.description) {
    issues.push({
      path: `${path}.description`,
      message: 'Question description is required',
      severity: 'error',
    });
  }

  if (!question.explanation) {
    issues.push({
      path: `${path}.explanation`,
      message: 'Question explanation is required',
      severity: 'error',
    });
  }

  // Validate options
  if (!question.options || question.options.length < 2) {
    issues.push({
      path: `${path}.options`,
      message: 'Question must have at least 2 options',
      severity: 'error',
    });
  } else {
    // Check for empty options
    question.options.forEach((option, index) => {
      if (!option || option.trim().length === 0) {
        issues.push({
          path: `${path}.options[${index}]`,
          message: 'Option cannot be empty',
          severity: 'error',
        });
      }
    });

    // Validate correct answer index
    if (question.correctAnswer === undefined || question.correctAnswer === null) {
      issues.push({
        path: `${path}.correctAnswer`,
        message: 'Correct answer index is required',
        severity: 'error',
      });
    } else if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
      issues.push({
        path: `${path}.correctAnswer`,
        message: `Correct answer index (${question.correctAnswer}) is out of range (0-${question.options.length - 1})`,
        severity: 'error',
      });
    }
  }

  // Validate difficulty
  if (!question.difficulty) {
    issues.push({
      path: `${path}.difficulty`,
      message: 'Question difficulty is required',
      severity: 'error',
    });
  } else if (!['beginner', 'intermediate', 'advanced'].includes(question.difficulty)) {
    issues.push({
      path: `${path}.difficulty`,
      message: 'Question difficulty must be one of: beginner, intermediate, advanced',
      severity: 'error',
    });
  }

  // Validate points
  if (!question.points || question.points <= 0) {
    issues.push({
      path: `${path}.points`,
      message: 'Question points must be a positive number',
      severity: 'error',
    });
  }

  // Content quality checks
  if (question.title.length > 100) {
    issues.push({
      path: `${path}.title`,
      message: 'Question title is quite long - consider shortening for better UX',
      severity: 'warning',
    });
  }

  if (question.description.length > 300) {
    issues.push({
      path: `${path}.description`,
      message: 'Question description is quite long - consider shortening',
      severity: 'warning',
    });
  }

  if (question.explanation.length < 50) {
    issues.push({
      path: `${path}.explanation`,
      message: 'Explanation seems quite short - consider providing more detail',
      severity: 'warning',
    });
  }

  // Check for options that are too similar
  if (question.options) {
    for (let i = 0; i < question.options.length; i++) {
      for (let j = i + 1; j < question.options.length; j++) {
        const similarity = calculateStringSimilarity(question.options[i], question.options[j]);
        if (similarity > 0.8) {
          issues.push({
            path: `${path}.options`,
            message: `Options ${i} and ${j} are very similar - this might confuse users`,
            severity: 'warning',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Calculate similarity between two strings (0-1, where 1 is identical)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Utility to validate all quizzes in a directory
 */
export async function validateAllQuizzes(
  quizzesDir: string
): Promise<Record<string, ValidationResult>> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const results: Record<string, ValidationResult> = {};

  try {
    const files = await fs.readdir(quizzesDir);
    const quizFiles = files.filter((file) => file.endsWith('.json'));

    for (const file of quizFiles) {
      try {
        const filePath = path.join(quizzesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const config = JSON.parse(content) as QuizConfig;

        results[file] = validateQuizConfig(config);
      } catch (error) {
        results[file] = {
          isValid: false,
          errors: [
            {
              path: 'file',
              message: `Failed to parse quiz file: ${error instanceof Error ? error.message : 'Unknown error'}`,
              severity: 'error',
            },
          ],
          warnings: [],
        };
      }
    }
  } catch (error) {
    console.error('Failed to read quizzes directory:', error);
  }

  return results;
}
