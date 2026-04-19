'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { SectionSeparator } from '@/components/section-separator';
import { CATEGORY_LABEL, type Tool } from '@/lib/tools';

interface ToolsIndexListProps {
  tools: Tool[];
}

function groupByCategory(tools: Tool[]): Record<string, Tool[]> {
  return tools.reduce<Record<string, Tool[]>>((acc, tool) => {
    (acc[tool.category] ||= []).push(tool);
    return acc;
  }, {});
}

export function ToolsIndexList({ tools }: ToolsIndexListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => {
      const haystack = [t.title, t.shortTitle, t.description, ...t.keywords].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [tools, query]);

  const grouped = groupByCategory(filtered);
  const categories = Object.keys(grouped) as Tool['category'][];

  return (
    <>
      {/* Search */}
      <div className="mb-6 max-w-md">
        <div className="relative">
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
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground font-mono">
          No tools match &quot;{query}&quot;. Open an issue and we&apos;ll consider building it.
        </p>
      )}

      {categories.map((category) => (
        <section key={category} className="my-10">
          <SectionSeparator command={`ls /tools/${category}`} />
          <SectionHeader label={category} title={CATEGORY_LABEL[category]} />
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3 bg-border border rounded-md overflow-hidden">
            {grouped[category].map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group bg-card p-5 transition-colors hover:bg-muted/40"
                >
                  <Icon
                    className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mb-3"
                    strokeWidth={1.5}
                  />
                  <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                    {tool.shortTitle}
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                  <div className="flex items-center gap-1 mt-3 text-[11px] font-mono text-primary/80">
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
