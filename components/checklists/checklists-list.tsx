'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RotateCcw, ListChecks } from 'lucide-react';
import { ChecklistCard } from '@/components/checklists/checklist-card';
import type { Checklist } from '@/lib/checklist-utils';

interface ChecklistsListProps {
  checklists: Checklist[];
  className?: string;
  showSearch?: boolean;
  showFilters?: boolean;
}

// Helper function to match search query
const matchesSearchQuery = (checklist: Checklist, query: string) => {
  const lowerQuery = query.toLowerCase();
  return (
    checklist.title.toLowerCase().includes(lowerQuery) ||
    checklist.description.toLowerCase().includes(lowerQuery) ||
    checklist.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
    checklist.category.toLowerCase().includes(lowerQuery)
  );
};

// Helper function to sort checklists
const compareChecklistsBySort = (
  a: Checklist,
  b: Checklist,
  sort: string
) => {
  if (sort === 'title') return a.title.localeCompare(b.title);
  if (sort === 'title-desc') return b.title.localeCompare(a.title);
  if (sort === 'items-asc') return a.items.length - b.items.length;
  if (sort === 'items-desc') return b.items.length - a.items.length;
  if (sort === 'category') return a.category.localeCompare(b.category);
  return 0;
};

export function ChecklistsList({
  checklists,
  className = '',
  showSearch = true,
  showFilters = true,
}: ChecklistsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [sortBy, setSortBy] = useState<
    'title' | 'title-desc' | 'items-asc' | 'items-desc' | 'category'
  >('category');

  // Extract unique categories and difficulties
  const categories = useMemo(
    () => Array.from(new Set(checklists.map((c) => c.category))),
    [checklists]
  );

  const difficulties = useMemo(() => {
    const diffs = Array.from(new Set(checklists.map((c) => c.difficulty)));
    return diffs.sort();
  }, [checklists]);

  // Filter and sort checklists
  const filteredChecklists = useMemo(() => {
    let filtered = checklists;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((checklist) =>
        matchesSearchQuery(checklist, searchQuery)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        (checklist) => checklist.category === selectedCategory
      );
    }

    // Apply difficulty filter
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(
        (checklist) => checklist.difficulty === selectedDifficulty
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => compareChecklistsBySort(a, b, sortBy));
  }, [checklists, searchQuery, selectedCategory, selectedDifficulty, sortBy]);

  // Group by category for display
  const checklistsByCategory = useMemo(() => {
    const grouped: Record<string, Checklist[]> = {};
    filteredChecklists.forEach((checklist) => {
      if (!grouped[checklist.category]) {
        grouped[checklist.category] = [];
      }
      grouped[checklist.category].push(checklist);
    });
    return grouped;
  }, [filteredChecklists]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedCategory !== 'all') count++;
    if (selectedDifficulty !== 'all') count++;
    return count;
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedDifficulty('all');
    setSortBy('category');
  };

  return (
    <div className={className}>
      {(showSearch || showFilters) && (
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search checklists by name, description, tags, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-col gap-4">
              {/* Category, Difficulty, and Sort Filters */}
              <div className="flex flex-wrap gap-4 items-center">
                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                {/* Difficulty Filter */}
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring capitalize"
                >
                  <option value="all">All Difficulties</option>
                  {difficulties.map((difficulty) => (
                    <option key={difficulty} value={difficulty} className="capitalize">
                      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Sort Filter */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="category">By Category</option>
                  <option value="title">By Title (A-Z)</option>
                  <option value="title-desc">By Title (Z-A)</option>
                  <option value="items-asc">Fewest Items First</option>
                  <option value="items-desc">Most Items First</option>
                </select>

                {/* Clear Filters */}
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Results Counter */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredChecklists.length} of {checklists.length} checklists
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Checklists Grid */}
      {filteredChecklists.length > 0 ? (
        <div className="space-y-12">
          {sortBy === 'category' ? (
            // Group by category when sorted by category
            Object.entries(checklistsByCategory).map(([category, categoryChecklists]) => (
              <div key={category}>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                  {category}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({categoryChecklists.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryChecklists.map((checklist) => (
                    <ChecklistCard key={checklist.id} checklist={checklist} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Show as flat grid for other sort orders
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredChecklists.map((checklist) => (
                <ChecklistCard key={checklist.id} checklist={checklist} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <ListChecks className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">
            {activeFiltersCount > 0 ? (
              <>No checklists match your current filters</>
            ) : (
              <>No checklists available</>
            )}
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" onClick={clearFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
