'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
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
  LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

// Icon mapping for serializable icon names
const iconMap: Record<string, LucideIcon> = {
  Bug,
  Network,
  Trophy,
  Boxes,
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
  isPopular?: boolean;
  isComingSoon?: boolean;
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

const matchesStatus = (game: SerializableGame, status: string) => {
  if (status === 'all') return true;
  if (status === 'new') return game.isNew;
  if (status === 'popular') return game.isPopular;
  if (status === 'featured') return game.featured;
  if (status === 'coming-soon') return game.isComingSoon;
  return true;
};

const compareGamesBySort = (a: SerializableGame, b: SerializableGame, sort: string) => {
  if (sort === 'newest') {
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;
    return 0;
  }
  if (sort === 'popular') {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return 0;
  }
  if (sort === 'title') return a.title.localeCompare(b.title);
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
              <Icon className="h-6 w-6" />
            </div>

            {/* Badges */}
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
          {/* Tags */}
          {game.tags && game.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {game.tags.map((tag: string) => (
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

          {/* Learn More Link */}
          <div
            className={`flex items-center gap-2 text-sm font-medium ${
              game.isComingSoon
                ? 'text-muted-foreground'
                : 'text-primary group-hover:gap-3 transition-all'
            }`}
          >
            {game.isComingSoon ? 'Stay tuned' : 'Start Learning'}
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function GamesList({ games, className, showSearch = true, showFilters = true }: GamesListProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
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
      if (searchQuery && !matchesSearchQuery(game, searchQuery)) return false;
      if (selectedCategory !== 'all' && game.category !== selectedCategory) return false;
      if (!matchesStatus(game, selectedStatus)) return false;
      return true;
    });

    filtered.sort((a, b) => compareGamesBySort(a, b, sortBy));
    return filtered;
  }, [games, searchQuery, selectedCategory, selectedStatus, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSortBy('newest');
  };

  const activeFiltersCount = [
    searchQuery,
    selectedCategory !== 'all',
    selectedStatus !== 'all',
    sortBy !== 'newest',
  ].filter(Boolean).length;

  const featuredGames = filteredGames.filter((game) => game.featured);
  const regularGames = filteredGames.filter((game) => !game.featured);

  return (
    <div className={cn('w-full', className)}>
      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search games by name, description, tags, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-col gap-4">
              {/* Status Filters */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  Status:
                </div>
                {(['all', 'new', 'popular', 'featured', 'coming-soon'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={selectedStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStatus(status)}
                    className="capitalize"
                  >
                    {status === 'coming-soon' ? 'Coming Soon' : status}
                  </Button>
                ))}
              </div>

              {/* Category and Sort Filters */}
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

                {/* Sort Filter */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="newest">Newest First</option>
                  <option value="popular">Popular First</option>
                  <option value="title">By Title (A-Z)</option>
                  <option value="featured">Featured First</option>
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
            Showing {filteredGames.length} of {games.length} games
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Games Grid */}
      <div className="space-y-12">
        {/* Featured Games */}
        {selectedStatus === 'all' && featuredGames.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-bold">Featured Games</h2>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">Spotlight</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredGames.map((game) => (
                <GameCard key={game.id} game={game} featured />
              ))}
            </div>
          </div>
        )}

        {/* All/Regular Games */}
        <div>
          {selectedStatus === 'all' && featuredGames.length > 0 && (
            <h2 className="text-2xl font-bold mb-6">All Games</h2>
          )}
          {filteredGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(selectedStatus === 'all' ? regularGames : filteredGames).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {activeFiltersCount > 0 ? (
                  <>No games match your current filters</>
                ) : (
                  <>No games available</>  
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
      </div>
    </div>
  );
}
