'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Fuse from 'fuse.js';
import {
  FileText,
  BookOpen,
  Dumbbell,
  HelpCircle,
  Gamepad2,
  Newspaper,
  Home,
  Search,
  X,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  Hash,
  Loader2,
  Sparkles,
  ChevronDown,
  ListChecks,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  type SearchItem,
  type SearchResult,
  type SearchFilters,
  DEFAULT_FILTERS,
  createSearchIndex,
  searchWithFuse,
  extractFiltersFromItems,
  getSuggestions,
  TYPE_LABELS,
  TYPE_COLORS,
} from '@/lib/search';

const TYPE_ICONS: Record<string, React.ElementType> = {
  post: FileText,
  guide: BookOpen,
  exercise: Dumbbell,
  quiz: HelpCircle,
  game: Gamepad2,
  news: Newspaper,
  page: Home,
  checklist: ListChecks,
};

export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchIndex, setSearchIndex] = useState<SearchItem[]>([]);
  const [fuse, setFuse] = useState<Fuse<SearchItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load search index on mount
  useEffect(() => {
    fetch('/search-index.json')
      .then((res) => res.json())
      .then((data: SearchItem[]) => {
        setSearchIndex(data);
        setFuse(createSearchIndex(data));
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load search index:', error);
        setLoading(false);
      });
  }, []);

  // Initialize filters from URL params
  useEffect(() => {
    const types = searchParams.get('types')?.split(',').filter(Boolean) || [];
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const sortBy = (searchParams.get('sort') as SearchFilters['sortBy']) || 'relevance';

    setFilters({ types, categories, tags, sortBy });
  }, [searchParams]);

  // Update URL when query or filters change
  const updateURL = useCallback(
    (newQuery: string, newFilters: SearchFilters) => {
      const params = new URLSearchParams();
      if (newQuery) params.set('q', newQuery);
      if (newFilters.types.length > 0) params.set('types', newFilters.types.join(','));
      if (newFilters.categories.length > 0) params.set('categories', newFilters.categories.join(','));
      if (newFilters.tags.length > 0) params.set('tags', newFilters.tags.join(','));
      if (newFilters.sortBy !== 'relevance') params.set('sort', newFilters.sortBy);

      const newURL = params.toString() ? `/search?${params.toString()}` : '/search';
      router.replace(newURL, { scroll: false });
    },
    [router]
  );

  // Search results
  const results = useMemo(() => {
    if (!fuse || !query.trim()) {
      return [];
    }
    return searchWithFuse(fuse, query, filters);
  }, [fuse, query, filters]);

  // Available filter options
  const filterOptions = useMemo(() => {
    return extractFiltersFromItems(searchIndex);
  }, [searchIndex]);

  // Update suggestions when query changes
  useEffect(() => {
    if (query.length >= 2 && searchIndex.length > 0) {
      setSuggestions(getSuggestions(query, searchIndex));
    } else {
      setSuggestions([]);
    }
  }, [query, searchIndex]);

  // Handle search input change
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setShowSuggestions(true);
    updateURL(newQuery, filters);
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    updateURL(query, newFilters);
  };

  // Toggle type filter
  const toggleType = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    handleFilterChange({ ...filters, types: newTypes });
  };

  // Toggle category filter
  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    handleFilterChange({ ...filters, categories: newCategories });
  };

  // Toggle tag filter
  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    handleFilterChange({ ...filters, tags: newTags });
  };

  // Clear all filters
  const clearFilters = () => {
    handleFilterChange(DEFAULT_FILTERS);
  };

  // Select a suggestion
  const selectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    updateURL(suggestion, filters);
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.categories.length > 0 ||
    filters.tags.length > 0 ||
    filters.sortBy !== 'relevance';

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Search</h1>
        <p className="text-muted-foreground text-lg">
          Find posts, guides, quizzes, games, and more
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for tutorials, guides, quizzes..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="pl-12 pr-12 py-6 text-lg rounded-xl border-2 focus:border-primary"
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-background border rounded-xl shadow-lg overflow-hidden">
            <div className="p-2">
              <div className="text-xs text-muted-foreground px-3 py-2">Suggestions</div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => selectSuggestion(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter Toggle & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1">
                {filters.types.length + filters.categories.length + filters.tags.length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <Select
            value={filters.sortBy}
            onValueChange={(value) =>
              handleFilterChange({ ...filters, sortBy: value as SearchFilters['sortBy'] })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
              <SelectItem value="type">Content Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="overflow-hidden">
           <div className="bg-muted/50 rounded-xl p-6 mb-6 space-y-6">
              {/* Content Type Filter */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Content Type
                </h3>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.types.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        filters.types.includes(type)
                          ? TYPE_COLORS[type]
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {TYPE_LABELS[type] || type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              {filterOptions.categories.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 font-semibold">
                    <Hash className="w-4 h-4" />
                    Categories
                    <ChevronDown className="w-4 h-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {filterOptions.categories.slice(0, 20).map((category) => (
                        <label
                          key={category}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={filters.categories.includes(category)}
                            onCheckedChange={() => toggleCategory(category)}
                          />
                          <span className="text-sm">{category}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Tags Filter */}
              {filterOptions.tags.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 font-semibold">
                    <Hash className="w-4 h-4" />
                    Tags
                    <ChevronDown className="w-4 h-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="flex flex-wrap gap-2 mt-3 max-h-40 overflow-y-auto">
                      {filterOptions.tags.slice(0, 50).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            filters.tags.includes(tag)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
               </Collapsible>
             )}
           </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Results */}
      {!loading && (
        <>
          {query && (
            <div className="mb-4 text-sm text-muted-foreground">
              Found {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
            </div>
          )}

          {query && results.length === 0 && (
            <div className="text-center py-20">
              <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">No results found</h2>
              <p className="text-muted-foreground mb-4">
                Try different keywords or adjust your filters
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {!query && (
            <div className="text-center py-20">
              <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Start searching</h2>
              <p className="text-muted-foreground">
                Type above to search across {searchIndex.length} items
              </p>
            </div>
          )}

          {/* Results Grid */}
          {results.length > 0 && (
            <div className="grid gap-3">
              {results.map((result) => (
                <SearchResultCard key={result.id} result={result} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const Icon = TYPE_ICONS[result.type] || FileText;

  return (
    <Link href={result.url}>
      <div className="group p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/50 transition-colors">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`p-3 rounded-lg border shrink-0 ${TYPE_COLORS[result.type]}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {TYPE_LABELS[result.type]}
              </Badge>
              {result.category && (
                <Badge variant="outline" className="text-xs">
                  {result.category}
                </Badge>
              )}
            </div>

            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
              {result.title}
            </h3>

            <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
              {result.description}
            </p>

            {/* Tags */}
            {result.tags && result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {result.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"
                  >
                    #{tag}
                  </span>
                ))}
                {result.tags.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{result.tags.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
