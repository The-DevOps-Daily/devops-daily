import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dice6,
  Gamepad2,
  Sparkles,
  Zap,
  ArrowRight,
  Activity,
  Timer,
} from 'lucide-react';
import { getAllGames } from '@/lib/games';

export const metadata: Metadata = {
  title: 'DevOps Games & Interactive Tools',
  description:
    'Interactive games and fun simulators for DevOps professionals to learn and practice skills in a playful way. Explore our collection of DevOps-themed games designed to enhance your skills and knowledge.',
  alternates: {
    canonical: '/games',
  },
  openGraph: {
    title: 'DevOps Games & Interactive Tools - DevOps Daily',
    description:
      'Interactive games and fun simulators for DevOps professionals to learn and practice skills in a playful way. Explore our collection of DevOps-themed games designed to enhance your skills and knowledge.',
    type: 'website',
    url: '/games',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Games & Interactive Tools',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Games & Interactive Tools - DevOps Daily',
    description:
      'Interactive games and fun simulators for DevOps professionals to learn and practice skills in a playful way. Explore our collection of DevOps-themed games designed to enhance your skills and knowledge.',
    images: ['/og-image.png'],
  },
};

// Game Card Component
function GameCard({ game, featured = false }: { game: any; featured?: boolean }) {
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

export default async function GamesPage() {
  // Load games dynamically
  const games = await getAllGames();

  const featuredGames = games.filter((game) => game.featured);
  const regularGames = games.filter((game) => !game.featured);
  const availableGames = games.filter((game) => !game.isComingSoon);
  const comingSoonGames = games.filter((game) => game.isComingSoon);

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-[0.02]" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-1.5 border-blue-500/50 bg-blue-500/5 backdrop-blur-sm"
            >
              <Gamepad2 className="w-3.5 h-3.5 mr-2 text-blue-500" />
              Interactive Zone
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              DevOps{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-purple-500 to-pink-500">
                Games & Simulators
              </span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Have fun while learning with our interactive games and simulators designed
              specifically for DevOps professionals. Practice your skills in a playful, low-pressure
              environment.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-linear-to-r from-blue-500 to-purple-600 rounded-full"></div>
                <span>{availableGames.length} Available Now</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-linear-to-r from-gray-400 to-gray-500 rounded-full"></div>
                <span>{comingSoonGames.length} Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games Section */}
      {featuredGames.length > 0 && (
        <section className="py-8 container mx-auto px-4">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4 px-3 py-1 bg-primary/5 border-primary/20">
              <Sparkles className="w-3 h-3 mr-2 text-primary" />
              Featured
            </Badge>
            <h2 className="text-3xl font-bold mb-2">Spotlight Games</h2>
            <p className="text-muted-foreground">
              Our most popular and newest interactive experiences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {featuredGames.map((game) => (
              <GameCard key={game.id} game={game} featured={true} />
            ))}
          </div>
        </section>
      )}

      {/* All Games Section */}
      <section className="py-8 container mx-auto px-4 mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">All Games & Simulators</h2>
          <p className="text-muted-foreground">Complete collection of interactive DevOps tools</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="bg-linear-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 backdrop-blur-sm border border-border/50 rounded-xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Have an idea for a DevOps game or simulator?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              We're always looking to expand our collection with fun and useful games for the DevOps
              community. Share your ideas and we might build it next!
            </p>
            <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
              <Dice6 className="mr-2 h-4 w-4" />
              <Link href="https://github.com/The-DevOps-Daily/devops-daily/issues/new/choose">
                Suggest a Game
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
