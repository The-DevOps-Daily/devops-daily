'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExerciseCard } from './exercise-card';
import { cn } from '@/lib/utils';
import { Search, Filter, RotateCcw, TrendingUp } from 'lucide-react';
import type { Exercise } from '@/lib/exercises-types';

interface ExercisesListProps {
  exercises: Exercise[];
  className?: string;
  showSearch?: boolean;
  showFilters?: boolean;
}

export function ExercisesList({
  exercises,
  className,
  showSearch = true,
  showFilters = true,
}: ExercisesListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Exercise['difficulty'] | 'all'>(
    'all'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<Exercise['environment'] | 'all'>(
    'all'
  );
  const [sortBy, setSortBy] = useState<'newest' | 'difficulty' | 'time'>('newest');

  // Deferred value keeps the <input> responsive while the expensive
  // filter+sort pass runs at a lower React priority. See INP fix notes.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Get unique categories and environments for filters
  const { categories, environments } = useMemo(() => {
    const cats = Array.from(new Set(exercises.map((e) => e.category.name))).sort();
    const envs = Array.from(new Set(exercises.map((e) => e.environment))).sort();
    return { categories: cats, environments: envs };
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    let filtered = exercises.filter((exercise) => {
      // Search filter
      if (deferredSearchQuery) {
        const query = deferredSearchQuery.toLowerCase();
        const matchesSearch =
          exercise.title.toLowerCase().includes(query) ||
          exercise.description.toLowerCase().includes(query) ||
          exercise.technologies.some((tech) => tech.toLowerCase().includes(query)) ||
          exercise.tags?.some((tag) => tag.toLowerCase().includes(query));

        if (!matchesSearch) return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'all' && exercise.difficulty !== selectedDifficulty) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && exercise.category.name !== selectedCategory) {
        return false;
      }

      // Environment filter
      if (selectedEnvironment !== 'all' && exercise.environment !== selectedEnvironment) {
        return false;
      }

      return true;
    });

    // Sort exercises
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        case 'time':
          const aTime = parseInt(a.estimatedTime.split(' ')[0]);
          const bTime = parseInt(b.estimatedTime.split(' ')[0]);
          return aTime - bTime;
        default:
          return 0;
      }
    });

    return filtered;
  }, [exercises, deferredSearchQuery, selectedDifficulty, selectedCategory, selectedEnvironment, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDifficulty('all');
    setSelectedCategory('all');
    setSelectedEnvironment('all');
    setSortBy('newest');
  };

  const activeFiltersCount = [
    selectedDifficulty !== 'all',
    selectedCategory !== 'all',
    selectedEnvironment !== 'all',
    searchQuery.length > 0,
  ].filter(Boolean).length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <div className="space-y-4">
          {/* Search */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
              <Input
                placeholder="Search exercises, technologies, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter by:</span>
              </div>

              {/* Difficulty Filter */}
              <div className="flex items-center gap-1">
                {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((difficulty) => (
                  <Button
                    key={difficulty}
                    variant={selectedDifficulty === difficulty ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className="text-xs h-7"
                  >
                    {difficulty === 'all' ? 'All Levels' : difficulty}
                  </Button>
                ))}
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2 text-xs border rounded h-7 border-border bg-background"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {/* Environment Filter */}
              <select
                value={selectedEnvironment}
                onChange={(e) =>
                  setSelectedEnvironment(e.target.value as Exercise['environment'] | 'all')
                }
                className="px-2 text-xs border rounded h-7 border-border bg-background"
              >
                <option value="all">All Environments</option>
                {environments.map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'difficulty' | 'time')}
                className="px-2 text-xs border rounded h-7 border-border bg-background"
              >
                <option value="newest">Newest First</option>
                <option value="difficulty">By Difficulty</option>
                <option value="time">By Duration</option>
              </select>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Clear ({activeFiltersCount})
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredExercises.length} of {exercises.length} exercises
          {searchQuery && <span> for "{searchQuery}"</span>}
        </div>

        {filteredExercises.length > 0 && (
          <Badge variant="outline" className="text-xs">
            <TrendingUp className="w-3 h-3 mr-1" />
            Avg.{' '}
            {Math.round(
              filteredExercises.reduce(
                (sum, ex) => sum + parseInt(ex.estimatedTime.split(' ')[0]),
                0
              ) / filteredExercises.length
            )}{' '}
            min
          </Badge>
        )}
      </div>

      {/* Exercises Grid */}
      {filteredExercises.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredExercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <div className="mb-4 text-muted-foreground">
            {searchQuery ? (
              <>No exercises found matching "{searchQuery}"</>
            ) : (
              <>No exercises match your current filters</>
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
