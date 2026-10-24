import type { ChallengeDifficulty } from '@/lib/challenge-types';

// Kept in components/ so Tailwind sees the class names.
export const challengeDifficultyColors: Record<ChallengeDifficulty, string> = {
  starter: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};
