import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dice6, Gamepad2, Sparkles } from 'lucide-react';
import { getAllGames } from '@/lib/games';
import { PageHero } from '@/components/page-hero';
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
        url: '/images/pages/simulators.png',
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
    images: ['/images/pages/simulators.png'],
  },
};

export default async function GamesPage() {
  // Load games dynamically
  const games = await getAllGames();

  const availableGames = games.filter((game) => !game.isComingSoon);
  const comingSoonGames = games.filter((game) => game.isComingSoon);

  return (
    <div className="min-h-screen">
      <PageHero
        title="DevOps Games & Simulators"
        accentWord="Simulators"
        description="Master DevOps with interactive games and simulators designed by industry experts. Test your knowledge, track your progress, and earn achievements as you advance."
        icon={Gamepad2}
        breadcrumbs={[{ label: 'Games & Simulators' }]}
        stats={[
          { label: 'available', value: availableGames.length },
          { label: 'coming soon', value: comingSoonGames.length },
        ]}
      />

      {/* Games List with Filters */}
      <section className="py-8 container mx-auto px-4 mb-16">
        <GamesList games={games} />
      </section>

      {/* CTA Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="bg-primary/5 backdrop-blur-sm border border-border/50 rounded-md p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Have an idea for a DevOps game or simulator?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              We're always looking to expand our collection with fun and useful games for the DevOps
              community. Share your ideas and we might build it next!
            </p>
            <Button size="lg">
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
