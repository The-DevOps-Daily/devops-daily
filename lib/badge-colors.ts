/**
 * Shared Tailwind class maps for difficulty/environment/category badges.
 * Two visual variants exist on the site: exercises use the -800 / -900/20
 * pairing, checklists the -700 / -900/30 one. They stay separate so
 * consolidating the code doesn't change rendered styles.
 */

export const exerciseDifficultyColors = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

export const exerciseEnvironmentColors = {
  local: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  cloud: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
  browser: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  container: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
};

export const checklistDifficultyColors = {
  beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const checklistCategoryColors = {
  Security: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Cloud: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DevOps: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};
