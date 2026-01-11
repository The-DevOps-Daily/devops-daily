import Fuse from 'fuse.js';

export interface SearchItem {
  id: string;
  type: 'post' | 'guide' | 'exercise' | 'quiz' | 'game' | 'news' | 'page' | 'checklist';
  title: string;
  description: string;
  url: string;
  category?: string;
  tags?: string[];
  icon?: string;
}

export interface SearchResult extends SearchItem {
  score?: number;
  matches?: Fuse.FuseResultMatch[];
}

export interface SearchFilters {
  types: string[];
  categories: string[];
  tags: string[];
  sortBy: 'relevance' | 'title' | 'type';
}

export const DEFAULT_FILTERS: SearchFilters = {
  types: [],
  categories: [],
  tags: [],
  sortBy: 'relevance',
};

const FUSE_OPTIONS: Fuse.IFuseOptions<SearchItem> = {
  keys: [
    { name: 'title', weight: 2.0 },
    { name: 'description', weight: 1.0 },
    { name: 'category', weight: 0.8 },
    { name: 'tags', weight: 0.6 },
  ],
  threshold: 0.2,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 3,
  ignoreLocation: false,
  findAllMatches: false,
};

export function createSearchIndex(items: SearchItem[]): Fuse<SearchItem> {
  return new Fuse(items, FUSE_OPTIONS);
}

export function searchWithFuse(
  fuse: Fuse<SearchItem>,
  query: string,
  filters: SearchFilters
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const fuseResults = fuse.search(query);

  let results: SearchResult[] = fuseResults.map((result) => ({
    ...result.item,
    score: result.score,
    matches: result.matches,
  }));

  // Apply type filter
  if (filters.types.length > 0) {
    results = results.filter((item) => filters.types.includes(item.type));
  }

  // Apply category filter
  if (filters.categories.length > 0) {
    results = results.filter(
      (item) => item.category && filters.categories.includes(item.category)
    );
  }

  // Apply tag filter
  if (filters.tags.length > 0) {
    results = results.filter(
      (item) => item.tags && item.tags.some((tag) => filters.tags.includes(tag))
    );
  }

  // Apply sorting
  if (filters.sortBy === 'title') {
    results.sort((a, b) => a.title.localeCompare(b.title));
  } else if (filters.sortBy === 'type') {
    results.sort((a, b) => a.type.localeCompare(b.type));
  }
  // 'relevance' sorting is already applied by Fuse.js

  return results;
}

export function extractFiltersFromItems(items: SearchItem[]): {
  types: string[];
  categories: string[];
  tags: string[];
} {
  const types = [...new Set(items.map((item) => item.type))];
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))] as string[];
  const tags = [...new Set(items.flatMap((item) => item.tags || []))];

  return { types, categories, tags };
}

export function highlightMatches(text: string, matches?: Fuse.FuseResultMatch[]): string {
  if (!matches || matches.length === 0) {
    return text;
  }

  const textMatches = matches.filter((m) => m.key === 'title' || m.key === 'description');
  if (textMatches.length === 0) {
    return text;
  }

  // Get all indices from matches for this text
  const indices: [number, number][] = [];
  textMatches.forEach((match) => {
    if (match.value === text) {
      indices.push(...(match.indices as [number, number][]));
    }
  });

  if (indices.length === 0) {
    return text;
  }

  // Sort indices by start position
  indices.sort((a, b) => a[0] - b[0]);

  // Build highlighted text
  let result = '';
  let lastEnd = 0;

  indices.forEach(([start, end]) => {
    result += text.slice(lastEnd, start);
    result += `<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">${text.slice(start, end + 1)}</mark>`;
    lastEnd = end + 1;
  });

  result += text.slice(lastEnd);

  return result;
}

export function getSuggestions(query: string, items: SearchItem[]): string[] {
  if (!query || query.length < 2) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const suggestions = new Set<string>();

  // Collect matching titles
  items.forEach((item) => {
    if (item.title.toLowerCase().includes(lowerQuery)) {
      suggestions.add(item.title);
    }
    // Collect matching tags
    item.tags?.forEach((tag) => {
      if (tag.toLowerCase().includes(lowerQuery)) {
        suggestions.add(tag);
      }
    });
    // Collect matching categories
    if (item.category?.toLowerCase().includes(lowerQuery)) {
      suggestions.add(item.category);
    }
  });

  return [...suggestions].slice(0, 5);
}

export const TYPE_LABELS: Record<string, string> = {
  post: 'Posts',
  guide: 'Guides',
  exercise: 'Exercises',
  quiz: 'Quizzes',
  game: 'Games',
  news: 'News',
  page: 'Pages',
  checklist: 'Checklists',
};

export const TYPE_COLORS: Record<string, string> = {
  post: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  guide: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  exercise: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  quiz: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  game: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  news: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  page: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  checklist: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
};
