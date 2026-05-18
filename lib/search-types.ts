export type SearchItemType =
  | 'post'
  | 'guide'
  | 'exercise'
  | 'quiz'
  | 'game'
  | 'news'
  | 'page'
  | 'checklist'
  | 'interview-question'
  | 'comparison'
  | 'flashcard'
  | 'tool';

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  description: string;
  url: string;
  category?: string;
  tags?: string[];
  icon?: string;
  date?: string;
}

export const TYPE_LABELS: Record<SearchItemType, string> = {
  post: 'Posts',
  guide: 'Guides',
  exercise: 'Exercises',
  quiz: 'Quizzes',
  game: 'Games',
  news: 'News',
  page: 'Pages',
  checklist: 'Checklists',
  'interview-question': 'Interview Questions',
  comparison: 'Comparisons',
  flashcard: 'Flashcards',
  tool: 'Tools',
};

export const TYPE_COLORS: Record<SearchItemType, string> = {
  post: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  guide: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  exercise: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  quiz: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  game: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  news: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  page: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  checklist: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  'interview-question':
    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  comparison: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  flashcard: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  tool: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};
