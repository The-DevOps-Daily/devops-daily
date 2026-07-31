'use client';

import { useState, useMemo } from 'react';
import { useDeferredSearch } from '@/hooks/use-deferred-search';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Search,
  MailWarning,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Timer,
  ArrowRight,
  Trophy,
  LineChart,
  Shield,
  Network,
  Workflow,
  Laugh,
  Heart,
  Server,
  Database,
  Cloud,
  Bug,
  Boxes,
  Braces,
  Mail,
  MessageSquare,
  GitBranch,
  Webhook,
  LayoutGrid,
  Gamepad2,
  FlaskConical,
  LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

// Icon mapping for serializable icon names
const iconMap: Record<string, LucideIcon> = {
  Bug,
  MailWarning,
  Network,
  Trophy,
  Boxes,
  Braces,
  LineChart,
  Activity,
  Shield,
  Workflow,
  Sparkles,
  Laugh,
  Heart,
  Server,
  Zap,
  Database,
  Cloud,
  Mail,
  MessageSquare,
  GitBranch,
  Webhook,
};

// Serializable game type with icon component
export interface SerializableGame {
  id: string;
  title: string;
  description: string;
  iconName: string;
  badgeText?: string;
  color: string;
  href: string;
  tags: string[];
  isNew?: boolean;
  featured?: boolean;
  category?: string;
  type?: 'game' | 'simulator';
  isPopular?: boolean;
  isComingSoon?: boolean;
  createdAt?: string; // ISO 8601 date string for sorting
}

interface GamesListProps {
  games: SerializableGame[];
  className?: string;
  showSearch?: boolean;
  showFilters?: boolean;
}

// Helper functions to reduce cyclomatic complexity
const matchesSearchQuery = (game: SerializableGame, query: string) => {
  const lowerQuery = query.toLowerCase();
  return (
    game.title.toLowerCase().includes(lowerQuery) ||
    game.description.toLowerCase().includes(lowerQuery) ||
    game.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
    game.category?.toLowerCase().includes(lowerQuery)
  );
};

const compareGamesBySort = (a: SerializableGame, b: SerializableGame, sort: string) => {
  if (sort === 'newest') {
    // Sort by creation date (newest first)
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA; // Descending order (newest first)
  }
  if (sort === 'oldest') {
    // Sort by creation date (oldest first)
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB; // Ascending order (oldest first)
  }
  if (sort === 'popular') {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return 0;
  }
  if (sort === 'unpopular') {
    if (a.isPopular && !b.isPopular) return 1;
    if (!a.isPopular && b.isPopular) return -1;
    return 0;
  }
  if (sort === 'title') return a.title.localeCompare(b.title);
  if (sort === 'title-desc') return b.title.localeCompare(a.title);
  if (sort === 'featured') {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  }
  return 0;
};

// Game Card Component
function GameCard({ game, featured = false }: { game: SerializableGame; featured?: boolean }) {
  const Icon = iconMap[game.iconName] || Activity;

  const card = (
    <Card
      className={`h-full transition-colors overflow-hidden relative ${
        game.isComingSoon ? 'opacity-60 grayscale' : 'hover:border-primary/40 hover:bg-muted/30'
      } ${featured ? 'ring-2 ring-primary/20 border-primary/30' : 'border-border'}`}
    >
      <div className={`h-2 w-full bg-linear-to-r ${game.color}`} />

      {game.isComingSoon && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="text-center">
            <Timer className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Coming Soon</p>
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl bg-linear-to-br ${game.color} text-white shadow-lg`}>
            <Icon className="h-6 w-6" />
          </div>

          <div className="flex gap-1 flex-wrap justify-end">
            {game.badgeText && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                {game.badgeText === 'New' && <Sparkles className="h-3 w-3" />}
                {game.badgeText === 'Popular' && <Zap className="h-3 w-3" />}
                {game.badgeText}
              </Badge>
            )}
            {game.featured && (
              <Badge
                variant="default"
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs flex items-center gap-1"
              >
                <Activity className="h-3 w-3" />
                Featured
              </Badge>
            )}
          </div>
        </div>

        <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
          {game.title}
        </CardTitle>
        <CardDescription className="text-sm line-clamp-2">{game.description}</CardDescription>
      </CardHeader>

      <CardFooter className="pt-0 flex-col items-start">
        {game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {game.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs px-2 py-0.5 border-muted-foreground/20 text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div
          className={`flex items-center gap-2 text-sm font-medium ${
            game.isComingSoon
              ? 'text-muted-foreground'
              : 'text-primary group-hover:gap-3 transition-all'
          }`}
        >
          {game.isComingSoon ? 'Stay tuned' : 'Start Learning'}
          {!game.isComingSoon && <ArrowRight className="h-4 w-4" />}
        </div>
      </CardFooter>
    </Card>
  );

  if (game.isComingSoon) {
    return (
      <div className="group block" aria-disabled="true">
        {card}
      </div>
    );
  }

  return (
    <Link href={game.href} className="group block">
      {card}
    </Link>
  );
}

function getGameType(game: SerializableGame): 'game' | 'simulator' {
  return game.type || 'game';
}

export function GamesList({
  games,
  className,
  showSearch = true,
  showFilters = true,
}: GamesListProps) {
  const { searchQuery, setSearchQuery, deferredSearchQuery } = useDeferredSearch();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'game' | 'simulator'>('all');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'popular' | 'unpopular' | 'title' | 'title-desc' | 'featured'
  >('newest');

  const availableGames = useMemo(() => games.filter((game) => !game.isComingSoon), [games]);
  const comingSoonGames = useMemo(() => games.filter((game) => game.isComingSoon), [games]);

  const categories = useMemo(
    () => Array.from(new Set(availableGames.map((game) => game.category).filter(Boolean))).sort(),
    [availableGames]
  );

  const filteredGames = useMemo(() => {
    const filtered = availableGames.filter((game) => {
      if (deferredSearchQuery && !matchesSearchQuery(game, deferredSearchQuery)) return false;
      if (selectedCategory !== 'all' && game.category !== selectedCategory) return false;
      if (selectedType !== 'all' && getGameType(game) !== selectedType) return false;
      return true;
    });

    filtered.sort((a, b) => compareGamesBySort(a, b, sortBy));
    return filtered;
  }, [availableGames, deferredSearchQuery, selectedCategory, selectedType, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedType('all');
    setSortBy('newest');
  };

  const activeFiltersCount = [
    searchQuery,
    selectedCategory !== 'all',
    selectedType !== 'all',
    sortBy !== 'newest',
  ].filter(Boolean).length;

  const gameCount = availableGames.filter((game) => getGameType(game) === 'game').length;
  const simulatorCount = availableGames.filter((game) => getGameType(game) === 'simulator').length;
  const featuredGames = filteredGames.filter((game) => game.featured);
  const regularGames = filteredGames.filter((game) => !game.featured);

  const tabs = [
    { value: 'all' as const, label: 'All', count: availableGames.length, Icon: LayoutGrid },
    { value: 'game' as const, label: 'Games', count: gameCount, Icon: Gamepad2 },
    { value: 'simulator' as const, label: 'Simulators', count: simulatorCount, Icon: FlaskConical },
  ];

  return (
    <div className={cn('w-full', className)}>
      <div
        className="mb-6 grid w-full grid-cols-3 items-center gap-1 rounded-xl bg-muted/50 p-1 sm:w-fit"
        role="group"
        aria-label="Filter by tool type"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSelectedType(tab.value)}
            aria-pressed={selectedType === tab.value}
            className={cn(
              'min-w-0 px-2 py-2 rounded-lg text-xs sm:px-4 sm:text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2',
              selectedType === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            <span>{tab.label}</span>
            <Badge
              variant="secondary"
              className="text-xs h-5 min-w-[20px] flex items-center justify-center"
            >
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {(showSearch || showFilters) && (
        <div className="mb-8 space-y-4">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search games and simulators"
                placeholder="Search games by name, description, tags, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          )}

          {showFilters && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4 items-center">
                <select
                  aria-label="Filter by category"
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

                <select
                  aria-label="Sort tools"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="popular">Popular First</option>
                  <option value="unpopular">Least Popular First</option>
                  <option value="title">By Title (A-Z)</option>
                  <option value="title-desc">By Title (Z-A)</option>
                  <option value="featured">Featured First</option>
                </select>

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

          <div className="text-sm text-muted-foreground">
            Showing {filteredGames.length} of {availableGames.length} available tools
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="space-y-12">
        {/* Featured Games */}
        {featuredGames.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-bold">Featured Tools</h2>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">Spotlight</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredGames.map((game) => (
                <GameCard key={game.id} game={game} featured />
              ))}
            </div>
          </div>
        )}

        <div>
          {featuredGames.length > 0 && <h2 className="text-2xl font-bold mb-6">More Tools</h2>}
          {filteredGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {activeFiltersCount > 0 ? (
                  <>No tools match your current filters</>
                ) : (
                  <>No tools available</>
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

        {activeFiltersCount === 0 && comingSoonGames.length > 0 && (
          <section aria-labelledby="coming-soon-heading">
            <div className="mb-6">
              <h2 id="coming-soon-heading" className="text-2xl font-bold">
                Coming Soon
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tools currently being prepared for release.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {comingSoonGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
