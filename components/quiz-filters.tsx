'use client';

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, SlidersHorizontal, ArrowUpDown, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onValueChange: (value: string) => void;
  className?: string;
}

// Like the Select's scroll buttons: shown while the list can scroll that way,
// and hovering one scrolls the list.
function ScrollEdge({
  direction,
  viewport,
}: {
  direction: 1 | -1;
  viewport: RefObject<HTMLDivElement | null>;
}) {
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const t = timer;
    return () => window.clearInterval(t.current);
  }, []);
  const start = () => {
    timer.current ??= window.setInterval(
      () => viewport.current?.scrollBy({ top: direction * 32 }),
      50
    );
  };
  const stop = () => {
    window.clearInterval(timer.current);
    timer.current = undefined;
  };
  const Icon = direction > 0 ? ChevronDown : ChevronUp;
  return (
    <div
      aria-hidden="true"
      onPointerDown={start}
      onPointerMove={start}
      onPointerLeave={stop}
      className="flex cursor-default items-center justify-center py-1"
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

// Looks like the Radix Select it replaces, but is not modal. A modal Select
// sets an inherited CSS variable and pointer-events: none on <body>, so the
// whole page restyles twice on open and twice on close. The overlay still
// keeps an outside tap from reaching the page under the menu.
function FilterSelect({ label, value, options, onValueChange, className }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [edges, setEdges] = useState({ up: false, down: false });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((option) => option.value === value)?.label ?? label;

  const updateEdges = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const up = el.scrollTop > 0;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
  }, []);

  // On open, focus the checked item, as the Select did.
  const attachViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (!node) return;
      updateEdges();
      requestAnimationFrame(() =>
        node.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
      );
    },
    [updateEdges]
  );

  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        aria-label={`${label}: ${current}`}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
          className
        )}
      >
        <span>{current}</span>
        <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
      </DropdownMenu.Trigger>
      {open &&
        createPortal(
          <div
            ref={overlayRef}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-45"
          />,
          document.body
        )}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={0}
          collisionPadding={10}
          onPointerDownOutside={(event) => {
            // The overlay closes the menu on click, so the click lands on it.
            if (event.detail.originalEvent.target === overlayRef.current) event.preventDefault();
          }}
          className="relative z-50 flex max-h-96 min-w-(--radix-dropdown-menu-trigger-width) flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
        >
          {edges.up && <ScrollEdge direction={-1} viewport={viewportRef} />}
          <div
            ref={attachViewport}
            onScroll={updateEdges}
            className="min-h-0 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <DropdownMenu.Label className="py-1.5 pl-8 pr-2 text-sm font-semibold">
              {label}
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
              {options.map((option) => (
                <DropdownMenu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <DropdownMenu.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  {option.label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </div>
          {edges.down && <ScrollEdge direction={1} viewport={viewportRef} />}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const DIFFICULTY_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Difficulties' },
  { value: 'beginner', label: 'Beginner/Junior' },
  { value: 'intermediate', label: 'Intermediate/Mid' },
  { value: 'advanced', label: 'Advanced/Senior' },
];

const SORT_OPTIONS: FilterOption[] = [
  { value: 'date', label: 'Date' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'time', label: 'Time' },
  { value: 'points', label: 'Points' },
];

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
        <FilterSelect
          label="Category"
          value={selectedCategory}
          options={[
            { value: 'all', label: 'All Categories' },
            ...categories.map((category) => ({ value: category, label: category })),
          ]}
          onValueChange={onCategoryChange}
          className="sm:w-[200px]"
        />

        {/* Difficulty Filter */}
        <FilterSelect
          label="Difficulty"
          value={selectedDifficulty}
          options={DIFFICULTY_OPTIONS}
          onValueChange={(value) => onDifficultyChange(value as DifficultyLevel)}
          className="sm:w-[200px]"
        />

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
          <FilterSelect
            label="Sort By"
            value={sortConfig.field}
            options={SORT_OPTIONS}
            onValueChange={(value) => onSortChange({ ...sortConfig, field: value as SortField })}
            className="pl-10"
          />
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
