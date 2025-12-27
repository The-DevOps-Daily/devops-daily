import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dice6, Sparkles } from 'lucide-react';
import { getAllGames } from '@/lib/games';
import { GamesHero } from '@/components/games-hero';
import { GamesList, SerializableGame } from '@/components/games-list';

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

export default async function GamesPage() {
  // Load games dynamically
  const games = await getAllGames();

  const availableGames = games.filter((game) => !game.isComingSoon);
  const comingSoonGames = games.filter((game) => game.isComingSoon);

  // Serialize games data to remove non-serializable icon components
  const serializableGames: SerializableGame[] = games.map((game) => {
    const Icon = game.icon;
    return {
      ...game,
      iconComponent: Icon,
    };
  });

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <GamesHero countAvailableGames={availableGames.length} countComingSoonGames={comingSoonGames.length}/>

      {/* Games List with Filters */}
      <section className="py-8 container mx-auto px-4 mb-16">
        <GamesList games={serializableGames} />
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
