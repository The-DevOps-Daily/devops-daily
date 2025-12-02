'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  FileText,
  BookOpen,
  Dumbbell,
  HelpCircle,
  Gamepad2,
  Newspaper,
  Home,
  Search,
  Clock,
  Hash,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SearchItem {
  id: string;
  type: 'post' | 'guide' | 'exercise' | 'quiz' | 'game' | 'news' | 'page';
  title: string;
  description: string;
  url: string;
  category?: string;
  tags?: string[];
  icon?: string;
}

const TYPE_ICONS = {
  post: FileText,
  guide: BookOpen,
  exercise: Dumbbell,
  quiz: HelpCircle,
  game: Gamepad2,
  news: Newspaper,
  page: Home,
};

const TYPE_LABELS = {
  post: 'Post',
  guide: 'Guide',
  exercise: 'Exercise',
  quiz: 'Quiz',
  game: 'Game',
  news: 'News',
  page: 'Page',
};

const TYPE_COLORS = {
  post: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  guide: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  exercise: 'bg-green-500/10 text-green-500 border-green-500/20',
  quiz: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  game: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  news: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  page: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<SearchItem[]>([]);
  const router = useRouter();

  // Load search index when palette opens
  useEffect(() => {
    if (open && searchIndex.length === 0) {
      setLoading(true);
      fetch('/search-index.json')
        .then((res) => res.json())
        .then((data) => {
          setSearchIndex(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Failed to load search index:', error);
          setLoading(false);
        });
    }
  }, [open, searchIndex.length]);

  // Load recent searches from localStorage
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('devops-daily-recent-searches');
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, [open]);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Simple fuzzy search
  const fuzzySearch = useCallback(
    (items: SearchItem[], searchQuery: string) => {
      if (!searchQuery) return [];

      const lowerQuery = searchQuery.toLowerCase();
      const terms = lowerQuery.split(' ').filter(Boolean);

      return items
        .map((item) => {
          const searchableText = [
            item.title,
            item.description,
            item.category,
            item.type,
            ...(item.tags || []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          // Calculate relevance score
          let score = 0;

          // Exact title match (highest priority)
          if (item.title.toLowerCase().includes(lowerQuery)) {
            score += 100;
          }

          // Title starts with query
          if (item.title.toLowerCase().startsWith(lowerQuery)) {
            score += 50;
          }

          // Category match
          if (item.category?.toLowerCase().includes(lowerQuery)) {
            score += 30;
          }

          // Description match
          if (item.description.toLowerCase().includes(lowerQuery)) {
            score += 20;
          }

          // Tags match
          if (item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
            score += 25;
          }

          // All terms present
          const allTermsPresent = terms.every((term) => searchableText.includes(term));
          if (allTermsPresent) {
            score += terms.length * 10;
          }

          return { item, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50) // Limit results
        .map(({ item }) => item);
    },
    []
  );

  const filteredResults = query ? fuzzySearch(searchIndex, query) : [];

  // Group results by type
  const groupedResults = filteredResults.reduce(
    (acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<string, SearchItem[]>
  );

  const handleSelect = (item: SearchItem) => {
    // Save to recent searches
    const recent = [item, ...recentSearches.filter((r) => r.id !== item.id)].slice(0, 5);
    setRecentSearches(recent);
    localStorage.setItem('devops-daily-recent-searches', JSON.stringify(recent));

    // Navigate
    router.push(item.url);
    setOpen(false);
    setQuery('');
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('devops-daily-recent-searches');
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors border border-border/50 hover:border-border"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-xs font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Search"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Command Palette Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search posts, guides, exercises, quizzes, games..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Loading search index...
              </div>
            </div>
          ) : query === '' ? (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <CommandGroup heading="Recent">
                  {recentSearches.map((item) => {
                    const Icon = TYPE_ICONS[item.type];
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.title}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg border ${TYPE_COLORS[item.type]}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          </div>
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      </CommandItem>
                    );
                  })}
                  <CommandItem onSelect={clearRecentSearches} className="justify-center text-xs">
                    Clear recent searches
                  </CommandItem>
                </CommandGroup>
              )}

              {/* Quick Actions */}
              <CommandGroup heading="Quick Actions">
                <CommandItem
                  onSelect={() => {
                    router.push('/posts');
                    setOpen(false);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Browse All Posts
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    router.push('/guides');
                    setOpen(false);
                  }}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  View Guides
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    router.push('/games');
                    setOpen(false);
                  }}
                >
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Play Games
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    router.push('/quizzes');
                    setOpen(false);
                  }}
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Take a Quiz
                </CommandItem>
              </CommandGroup>

              {/* Tips */}
              <div className="px-4 py-3 text-xs text-muted-foreground border-t">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span className="font-medium">Pro tips:</span>
                </div>
                <ul className="space-y-1 ml-5">
                  <li>• Search by title, description, category, or tags</li>
                  <li>• Try: "kubernetes", "docker guide", "ci/cd quiz"</li>
                  <li>• Press ⌘K (or Ctrl+K) to toggle search anytime</li>
                </ul>
              </div>
            </>
          ) : filteredResults.length === 0 ? (
            <CommandEmpty>
              <div className="py-6 text-center">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try different keywords or browse categories
                </p>
              </div>
            </CommandEmpty>
          ) : (
            <>
              {/* Search Results by Type */}
              {Object.entries(groupedResults)
                .sort(([, a], [, b]) => b.length - a.length) // Sort by count
                .map(([type, items], groupIndex) => {
                  const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
                  const label = TYPE_LABELS[type as keyof typeof TYPE_LABELS];

                  return (
                    <div key={type}>
                      {groupIndex > 0 && <CommandSeparator />}
                      <CommandGroup heading={`${label}s (${items.length})`}>
                        {items.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={`${item.title} ${item.description} ${item.category}`}
                            onSelect={() => handleSelect(item)}
                            className="flex items-center gap-3 px-4 py-3"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-lg border ${TYPE_COLORS[item.type]}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.title}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.description}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {item.category && (
                                    <Badge variant="secondary" className="text-xs">
                                      {item.category}
                                    </Badge>
                                  )}
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Hash className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {item.tags[0]}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </div>
                  );
                })}

              {/* Results Summary */}
              <div className="px-4 py-3 text-xs text-muted-foreground border-t">
                Found {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for
                &quot;{query}&quot;
              </div>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
