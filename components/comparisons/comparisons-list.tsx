'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ComparisonCard } from './comparison-card';
import { cn } from '@/lib/utils';
import { Search, RotateCcw } from 'lucide-react';
import type { Comparison } from '@/lib/comparison-types';

interface ComparisonsListProps {
  comparisons: Comparison[];
  className?: string;
}

export function ComparisonsList({ comparisons, className }: ComparisonsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Defer the value used by the filter memo so the input stays 60fps
  // while the (potentially large) filtered list re-renders at lower
  // priority. INP fix.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const categories = useMemo(() => {
    return Array.from(new Set(comparisons.map((c) => c.category))).sort();
  }, [comparisons]);

  const filteredComparisons = useMemo(() => {
    return comparisons.filter((comparison) => {
      // Search filter
      if (deferredSearchQuery) {
        const query = deferredSearchQuery.toLowerCase();
        const matchesSearch =
          comparison.title.toLowerCase().includes(query) ||
          comparison.description.toLowerCase().includes(query) ||
          comparison.toolA.name.toLowerCase().includes(query) ||
          comparison.toolB.name.toLowerCase().includes(query) ||
          comparison.tags.some((tag) => tag.toLowerCase().includes(query));

        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && comparison.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [comparisons, deferredSearchQuery, selectedCategory]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const activeFiltersCount = [
    selectedCategory !== 'all',
    searchQuery.length > 0,
  ].filter(Boolean).length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
          <Input
            placeholder="Search comparisons, tools, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="text-xs h-7"
          >
            All Categories
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="text-xs h-7"
            >
              {category}
            </Button>
          ))}

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
              <RotateCcw className="w-3 h-3 mr-1" />
              Clear ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredComparisons.length} of {comparisons.length} comparisons
        {searchQuery && <span> for &quot;{searchQuery}&quot;</span>}
      </div>

      {/* Comparisons Grid */}
      {filteredComparisons.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredComparisons.map((comparison) => (
            <ComparisonCard key={comparison.id} comparison={comparison} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <div className="mb-4 text-muted-foreground">
            {searchQuery ? (
              <>No comparisons found matching &quot;{searchQuery}&quot;</>
            ) : (
              <>No comparisons match your current filters</>
            )}
          </div>
          <Button variant="outline" onClick={clearFilters}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
