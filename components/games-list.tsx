'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Search, Filter, RotateCcw, Sparkles, Zap, Activity, Timer, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Game } from '@/lib/games';

interface GamesListProps {
  games: Game[];
  className?: string;
  showSearch?: boolean;
  showFilters?: boolean;
}

// Game Card Component
function GameCard({ game, featured = false }: { game: Game; featured?: boolean }) {
  return (
    <Link
      href={game.href}
      className={`group block ${game.isComingSoon ? 'pointer-events-none' : ''}`}
    >
      <Card
        className={`h-full transition-all duration-300 overflow-hidden relative ${
          game.isComingSoon
            ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-80'
            : 'hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 hover:-translate-y-1'
        } ${featured ? 'ring-2 ring-primary/20 shadow-lg border-primary/30' : 'border-border'}`}
      >
        {/* Top gradient bar */}
        <div className={`h-2 w-full bg-linear-to-r ${game.color}`}></div>

        {/* Coming Soon Overlay */}
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
              <game.icon className="h-6 w-6" />
            </div>
            {game.badgeText && (
              <Badge
                variant="default"
                className={`text-xs font-medium shadow-sm ${
                  game.isHot
                    ? 'bg-linear-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                    : game.isNew
                      ? 'bg-linear-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                      : game.isPopular
                        ? 'bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                        : game.isComingSoon
                          ? 'bg-linear-to-r from-gray-400 to-gray-500'
                          : 'bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                }`}
              >
                {game.isHot && <Zap className="w-3 h-3 mr-1" />}
                {game.isNew && <Sparkles className="w-3 h-3 mr-1" />}
                {game.isPopular && <Activity className="w-3 h-3 mr-1" />}
                {game.isComingSoon && <Timer className="w-3 h-3 mr-1" />}
                {game.badgeText}
              </Badge>
            )}
          </div>

          <CardTitle
            className={`text-xl font-bold transition-colors ${
              game.isComingSoon ? 'text-muted-foreground' : 'group-hover:text-primary'
            }`}
          >
            {game.title}
          </CardTitle>

          <CardDescription
            className={`text-sm leading-relaxed ${
              game.isComingSoon ? 'text-muted-foreground/70' : ''
            }`}
          >
            {game.description}
          </CardDescription>
        </CardHeader>

        <CardFooter className="pt-0 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 w-full">
            {game.tags.map((tag: string) => (
              <Badge
                key={tag}
                variant="secondary"
                className={`text-xs ${game.isComingSoon ? 'opacity-60' : 'hover:bg-secondary/80'}`}
              >
                {tag}
              </Badge>
            ))}
          </div>

          <div className="w-full flex justify-end">
            <Button
              variant={game.isComingSoon ? 'ghost' : 'default'}
              size="sm"
              className={`transition-all duration-200 ${
                game.isComingSoon ? 'opacity-50 cursor-not-allowed' : 'group-hover:shadow-md'
              }`}
              disabled={game.isComingSoon}
            >
              {game.isComingSoon ? (
                <>
                  <Timer className="mr-2 h-4 w-4" />
                  Coming Soon
                </>
              ) : (
                <>
                  Try Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function GamesList({
  games,
  className,
  showSearch = true,
  showFilters = true,
}: GamesListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'new' | 'popular' | 'featured' | 'coming-soon'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'title' | 'featured'>('newest');

  // Get unique categories and tags
  const { categories, allTags } = useMemo(() => {
    const cats = Array.from(new Set(games.map((g) => g.category).filter(Boolean))).sort();
    const tags = Array.from(new Set(games.flatMap((g) => g.tags))).sort();
    return { categories: cats, allTags: tags };
  }, [games]);

  const filteredGames = useMemo(() => {
    let filtered = games.filter((game) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          game.title.toLowerCase().includes(query) ||
          game.description.toLowerCase().includes(query) ||
          game.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          game.category?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && game.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        switch (selectedStatus) {
          case 'new':
            if (!game.isNew) return false;
            break;
          case 'popular':
            if (!game.isPopular) return false;
            break;
          case 'featured':
            if (!game.featured) return false;
            break;
          case 'coming-soon':
            if (!game.isComingSoon) return false;
            break;
        }
      }

      return true;
    });

    // Sort games
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          // Featured and new first, then by position
          if (a.isNew && !b.isNew) return -1;
          if (!a.isNew && b.isNew) return 1;
          return 0;
        case 'popular':
          // Popular first
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;
          return 0;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'featured':
          // Featured first
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return 0;
        default:
          return 0;
      }
    });

    return filtered;
  }, [games, searchQuery, selectedCategory, selectedStatus, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSortBy('newest');
  };

  const activeFiltersCount = [
    selectedCategory !== 'all',
    selectedStatus !== 'all',
    searchQuery.length > 0,
  ].filter(Boolean).length;

  const featuredGames = filteredGames.filter((game) => game.featured);
  const regularGames = filteredGames.filter((game) => !game.featured);

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
                placeholder="Search games by title, description, tags, or category..."
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

              {/* Status Filter */}
              <div className="flex items-center gap-1">
                {(['all', 'new', 'popular', 'featured', 'coming-soon'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={selectedStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStatus(status)}
                    className="text-xs h-7"
                  >
                    {status === 'all' ? 'All' : status === 'coming-soon' ? 'Coming Soon' : status.charAt(0).toUpperCase() + status.slice(1)}
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

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'popular' | 'title' | 'featured')}
                className="px-2 text-xs border rounded h-7 border-border bg-background"
              >
                <option value="newest">Newest First</option>
                <option value="popular">Popular First</option>
                <option value="title">By Title (A-Z)</option>
                <option value="featured">Featured First</option>
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
          Showing {filteredGames.length} of {games.length} games
          {searchQuery && <span> for "{searchQuery}"</span>}
        </div>

        {activeFiltersCount > 0 && (
          <Badge variant="outline" className="text-xs">
            <Filter className="w-3 h-3 mr-1" />
            {activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Featured Games Section */}
      {featuredGames.length > 0 && selectedStatus === 'all' && (
        <section>
          <div className="text-center mb-6">
            <Badge variant="outline" className="mb-3 px-3 py-1 bg-primary/5 border-primary/20">
              <Sparkles className="w-3 h-3 mr-2 text-primary" />
              Featured
            </Badge>
            <h2 className="text-2xl font-bold mb-2">Spotlight Games</h2>
            <p className="text-sm text-muted-foreground">
              Our most popular and newest interactive experiences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {featuredGames.map((game) => (
              <GameCard key={game.id} game={game} featured={true} />
            ))}
          </div>
        </section>
      )}

      {/* All Games Section */}
      {(selectedStatus !== 'all' || regularGames.length > 0) && (
        <section>
          {featuredGames.length > 0 && selectedStatus === 'all' && (
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">All Games & Simulators</h2>
              <p className="text-sm text-muted-foreground">Complete collection of interactive DevOps tools</p>
            </div>
          )}

          {filteredGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(selectedStatus === 'all' ? regularGames : filteredGames).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mb-4 text-muted-foreground">
                {searchQuery ? (
                  <>No games found matching "{searchQuery}"</>
                ) : (
                  <>No games match your current filters</>
                )}
              </div>
              <Button variant="outline" onClick={clearFilters}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
