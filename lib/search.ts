import Fuse from 'fuse.js';

export interface SearchItem {
  id: string;
  type: 'post' | 'guide' | 'exercise' | 'quiz' | 'game' | 'news' | 'page' | 'checklist' | 'interview-question';
  title: string;
  description: string;
  url: string;
  category?: string;
  tags?: string[];
  icon?: string;
  date?: string;
}

export interface SearchResult extends SearchItem {
  score?: number;
  matches?: Fuse.FuseResultMatch[];
}

export interface SearchFilters {
  types: string[];
  categories: string[];
  tags: string[];
  sortBy: 'relevance' | 'title' | 'type' | 'date';
  sortDirection: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: SearchFilters = {
  types: [],
  categories: [],
  tags: [],
  sortBy: 'relevance',
  sortDirection: 'desc',
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
  filters: SearchFilters,
  allItems?: SearchItem[]
): SearchResult[] {
  let results: SearchResult[];

  // If there's a query, use Fuse.js for fuzzy search
  if (query.trim()) {
    const fuseResults = fuse.search(query);
    results = fuseResults.map((result) => ({
      ...result.item,
      score: result.score,
      matches: result.matches,
    }));
  } else if (allItems) {
    // No query but we have items - return all items for filter-only browsing
    results = allItems.map((item) => ({ ...item }));
  } else {
    return [];
  }

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
  const direction = filters.sortDirection === 'asc' ? 1 : -1;
  
  if (filters.sortBy === 'title') {
    results.sort((a, b) => direction * a.title.localeCompare(b.title));
  } else if (filters.sortBy === 'type') {
    results.sort((a, b) => direction * a.type.localeCompare(b.type));
  } else if (filters.sortBy === 'date') {
    results.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return direction * (dateA - dateB);
    });
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
  'interview-question': 'Interview Questions',
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
  'interview-question': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
};

// Popular searches for "no results" state
export const POPULAR_SEARCHES = [
  'Kubernetes',
  'Docker',
  'CI/CD',
  'Terraform',
  'AWS',
  'GitHub Actions',
  'Linux',
  'DevOps',
];

// Find similar/related terms for "did you mean" suggestions
export function getDidYouMean(query: string, items: SearchItem[]): string[] {
  if (!query || query.length < 2) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const suggestions = new Map<string, number>();

  // Collect all searchable terms
  const terms = new Set<string>();
  items.forEach((item) => {
    // Add title words
    item.title.split(/\s+/).forEach((word) => {
      if (word.length >= 3) terms.add(word.toLowerCase());
    });
    // Add tags
    item.tags?.forEach((tag) => terms.add(tag.toLowerCase()));
    // Add category
    if (item.category) terms.add(item.category.toLowerCase());
  });

  // Calculate similarity scores using Levenshtein-like approach
  terms.forEach((term) => {
    const similarity = calculateSimilarity(lowerQuery, term);
    if (similarity > 0.4 && similarity < 1) {
      // Find the original casing
      let originalTerm = term;
      items.forEach((item) => {
        item.tags?.forEach((tag) => {
          if (tag.toLowerCase() === term) originalTerm = tag;
        });
        if (item.category?.toLowerCase() === term) originalTerm = item.category;
        item.title.split(/\s+/).forEach((word) => {
          if (word.toLowerCase() === term) originalTerm = word;
        });
      });
      suggestions.set(originalTerm, similarity);
    }
  });

  // Sort by similarity and return top 3
  return [...suggestions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([term]) => term);
}

// Simple similarity calculation (normalized edit distance)
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Quick checks
  if (len1 === 0 || len2 === 0) return 0;
  if (str1 === str2) return 1;

  // Check if one contains the other
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.8;
  }

  // Check common prefix
  let commonPrefix = 0;
  const minLen = Math.min(len1, len2);
  for (let i = 0; i < minLen; i++) {
    if (str1[i] === str2[i]) commonPrefix++;
    else break;
  }

  if (commonPrefix >= 3) {
    return 0.5 + (commonPrefix / Math.max(len1, len2)) * 0.3;
  }

  // Simple character overlap
  const chars1 = new Set(str1.split(''));
  const chars2 = new Set(str2.split(''));
  let overlap = 0;
  chars1.forEach((char) => {
    if (chars2.has(char)) overlap++;
  });

  return overlap / Math.max(chars1.size, chars2.size);
}
