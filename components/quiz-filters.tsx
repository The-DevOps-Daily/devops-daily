'use client';

import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'all';
export type SortField = 'date' | 'difficulty' | 'time' | 'points';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface QuizFiltersProps {
  categories: string[];
  selectedCategory: string;
  selectedDifficulty: DifficultyLevel;
  sortConfig: SortConfig;
  onCategoryChange: (category: string) => void;
  onDifficultyChange: (difficulty: DifficultyLevel) => void;
  onSortChange: (config: SortConfig) => void;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

export function QuizFilters({
  categories,
  selectedCategory,
  selectedDifficulty,
  sortConfig,
  onCategoryChange,
  onDifficultyChange,
  onSortChange,
  onClearFilters,
  totalCount,
  filteredCount,
  className,
}: QuizFiltersProps) {
  const hasActiveFilters = selectedCategory !== 'all' || selectedDifficulty !== 'all';

  // Helper to get display label for sort field
  const getSortLabel = (field: SortField, direction: SortDirection): string => {
    const labels: Record<SortField, { asc: string; desc: string }> = {
      date: { asc: 'Oldest First', desc: 'Newest First' },
      difficulty: { asc: 'Easiest First', desc: 'Hardest First' },
      time: { asc: 'Quickest First', desc: 'Longest First' },
      points: { asc: 'Least Points', desc: 'Most Points' },
    };
    return labels[field][direction];
  };

  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    onSortChange({
      ...sortConfig,
      direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  }, [sortConfig, onSortChange]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Filters</h3>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredCount}</span> of{' '}
          <span className="font-semibold text-foreground">{totalCount}</span> quizzes
        </div>
      </div>

      {/* Filter and Sort Dropdowns */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Category</SelectLabel>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Difficulty Filter */}
       <Select value={selectedDifficulty} onValueChange={(value) => onDifficultyChange(value as DifficultyLevel)}>
         <SelectTrigger className="w-full sm:w-[200px]">
           <SelectValue placeholder="All Difficulties" />
         </SelectTrigger>
         <SelectContent>
           <SelectGroup>
            <SelectLabel>Difficulty</SelectLabel>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="beginner">Beginner/Junior</SelectItem>
            <SelectItem value="intermediate">Intermediate/Mid</SelectItem>
            <SelectItem value="advanced">Advanced/Senior</SelectItem>
          </SelectGroup>
       </SelectContent>
      </Select>

        {/* Sort By */}
        <div className="relative w-full sm:w-[200px]">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSortDirection();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hover:bg-accent rounded p-1 transition-colors"
            title={`Currently: ${getSortLabel(sortConfig.field, sortConfig.direction)}. Click to reverse.`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          <Select 
          value={sortConfig.field} 
          onValueChange={(value) => onSortChange({ ...sortConfig, field: value as SortField })}
          >
            <SelectTrigger className="w-full pl-10">
              <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Sort By</SelectLabel>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="difficulty">Difficulty</SelectItem>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="points">Points</SelectItem>
            </SelectGroup>
          </SelectContent>
          </Select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedCategory !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {selectedCategory}
              <button
                onClick={() => onCategoryChange('all')}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedDifficulty !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1 capitalize">
              {selectedDifficulty}
              <button
                onClick={() => onDifficultyChange('all')}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
