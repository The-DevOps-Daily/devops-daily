'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { TOOLS, CATEGORY_LABEL, type Tool } from '@/lib/tools';

// Note: TOOLS is imported directly (not passed as a prop) because its `icon`
// field holds lucide component functions. Functions can't be serialized across
// the server → client boundary during static export, so we keep the data
// inside the client bundle instead.

type CategoryFilter = 'all' | Tool['category'];

export function ToolsIndexList() {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const categoriesInUse = useMemo(() => {
    const set = new Set<Tool['category']>();
    for (const t of TOOLS) set.add(t.category);
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [t.title, t.shortTitle, t.description, ...t.keywords]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, categoryFilter]);

  // Pad to a multiple of the widest breakpoint (3 cols at lg) so empty trailing
  // cells don't expose the outer bg-border as dark strips.
  const fillerCount = (3 - (filtered.length % 3)) % 3;

  return (
    <>
      {/* Search + category chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="relative sm:w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tools..."
            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            aria-label="Filter tools"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          <CategoryChip
            label="all"
            active={categoryFilter === 'all'}
            onClick={() => setCategoryFilter('all')}
          />
          {categoriesInUse.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono">
          No tools match &quot;{query}&quot;. Open an issue and we&apos;ll consider building it.
        </p>
      ) : (
        <div
          className="grid gap-px grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 bg-border border rounded-md overflow-hidden"
          aria-live="polite"
        >
          {filtered.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group bg-card p-5 flex flex-col transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Icon
                    className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors"
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-wider">
                    {CATEGORY_LABEL[tool.category]}
                  </span>
                </div>
                <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                  {tool.shortTitle}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 flex-1">
                  {tool.description}
                </p>
                <div className="flex items-center gap-1 mt-3 text-[11px] font-mono text-primary/80">
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
          {Array.from({ length: fillerCount }).map((_, i) => (
            <div
              key={`filler-${i}`}
              aria-hidden="true"
              className="bg-card hidden lg:block"
            />
          ))}
        </div>
      )}
    </>
  );
}

interface CategoryChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function CategoryChip({ label, active, onClick }: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md border transition-colors ${
        active
          ? 'bg-primary/10 border-primary/40 text-primary'
          : 'bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
