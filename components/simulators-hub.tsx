'use client';

import { useMemo, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { useDeferredSearch } from '@/hooks/use-deferred-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GameCard, type CardGame } from '@/components/game-card';
import { cn } from '@/lib/utils';

export interface HubGroup {
  id: string;
  label: string;
  description: string;
  simulators: (CardGame & { category?: string })[];
}

function matches(game: HubGroup['simulators'][number], group: HubGroup, query: string) {
  const q = query.toLowerCase();
  return (
    game.title.toLowerCase().includes(q) ||
    game.description.toLowerCase().includes(q) ||
    game.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    Boolean(game.category?.toLowerCase().includes(q)) ||
    group.label.toLowerCase().includes(q)
  );
}

export function SimulatorsHub({ groups }: { groups: HubGroup[] }) {
  const { searchQuery, setSearchQuery, deferredSearchQuery } = useDeferredSearch();
  const [topic, setTopic] = useState<string>('all');
  const total = groups.reduce((sum, group) => sum + group.simulators.length, 0);

  const visible = useMemo(() => {
    const query = deferredSearchQuery.trim();
    return groups
      .filter((group) => topic === 'all' || group.id === topic)
      .map((group) => ({
        ...group,
        simulators: query
          ? group.simulators.filter((game) => matches(game, group, query))
          : group.simulators,
      }))
      .filter((group) => group.simulators.length > 0);
  }, [groups, topic, deferredSearchQuery]);

  const shown = visible.reduce((sum, group) => sum + group.simulators.length, 0);
  const filtered = searchQuery.trim() !== '' || topic !== 'all';

  const clear = () => {
    setSearchQuery('');
    setTopic('all');
  };

  const chips = [{ id: 'all', label: 'All', count: total }].concat(
    groups.map((group) => ({ id: group.id, label: group.label, count: group.simulators.length }))
  );

  return (
    <div className="w-full">
      <div className="mb-8 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search simulators"
            placeholder="Search by name, tool or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by topic"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setTopic(chip.id)}
              aria-pressed={topic === chip.id}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                topic === chip.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              {chip.label} <span className="tabular-nums opacity-80">{chip.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
          <span>
            Showing {shown} of {total} simulators
          </span>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={clear} className="h-8 gap-2">
              <RotateCcw className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="space-y-14">
          {visible.map((group) => (
            <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`}>
              <div className="mb-6">
                <h2
                  id={`${group.id}-heading`}
                  className="flex items-center gap-3 text-2xl font-bold"
                >
                  {group.label}
                  <Badge variant="secondary" className="tabular-nums">
                    {group.simulators.length}
                  </Badge>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.simulators.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No simulators match your search.</p>
          <Button variant="outline" onClick={clear}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear search
          </Button>
        </div>
      )}
    </div>
  );
}
