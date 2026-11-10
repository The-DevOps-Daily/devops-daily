import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Dice6, FlaskConical, Gamepad2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/page-hero';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { CarbonAds } from '@/components/carbon-ads';
import { GameCard, toCardGame } from '@/components/game-card';
import { getActiveByType, getGameGroup } from '@/lib/game-hubs';

const title = 'DevOps Games: Opsville, Arcade and Party Games';
const description =
  'Play Opsville, a free pixel-art DevOps town, then try a daily incident puzzle, arcade games and party games for your team. Free, in your browser.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: '/games',
  },
  openGraph: {
    title: `${title} | DevOps Daily`,
    description,
    type: 'website',
    url: '/games',
    images: [
      {
        url: '/images/pages/games.jpg',
        width: 1200,
        height: 630,
        alt: 'DevOps Games',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} | DevOps Daily`,
    description,
    images: ['/images/pages/games.jpg'],
  },
};

const OPSVILLE_POINTS = ['Free', 'Plays in your browser', 'Optional free account for cloud saves'];

export default async function GamesPage() {
  const [games, simulators] = await Promise.all([
    getActiveByType('game'),
    getActiveByType('simulator'),
  ]);
  const sections = [
    {
      id: 'arcade',
      title: 'Arcade and puzzle games',
      description:
        "Short rounds with a DevOps twist. Find the root cause of today's incident, spread a bug across servers, or keep a system up under load.",
      games: games.filter((game) => getGameGroup(game) === 'arcade'),
    },
    {
      id: 'party',
      title: 'Party games and fun tools',
      description:
        'Light games to share with your team: infrastructure tarot, Cards Against DevOps, memes, random stack picks, app names and a skills scorecard.',
      // The card-and-meme party games first, then the generators and the scorecard.
      games: games
        .filter((game) => getGameGroup(game) === 'party')
        .sort((a, b) => Number(b.category === 'Fun') - Number(a.category === 'Fun')),
    },
  ];
  const simulatorsLabel = `See all ${simulators.length} simulators`;

  return (
    <div className="min-h-screen">
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Games', url: '/games' },
        ]}
      />

      <PageHero
        title="DevOps Games"
        accentWord="Games"
        description="Free games with a DevOps twist. Start in Opsville, then try the arcade and party games."
        icon={Gamepad2}
        breadcrumbs={[{ label: 'Games' }]}
        stats={[
          { label: 'arcade and party games', value: games.length },
          { label: 'simulators', value: simulators.length },
        ]}
      >
        <Link
          href="/simulators"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Looking for hands-on labs? {simulatorsLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </PageHero>

      <section aria-labelledby="opsville-heading" className="container mx-auto px-4 pt-10">
        <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[1.15fr_1fr]">
          <a href="/opsville/" tabIndex={-1} aria-hidden="true" className="block bg-muted">
            <Image
              src="/images/pages/opsville-title-skyline.webp"
              alt=""
              width={1280}
              height={800}
              preload
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="h-full w-full object-cover"
            />
          </a>
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-8">
            <Badge variant="secondary" className="w-fit gap-1">
              <Sparkles className="h-3 w-3" />
              Featured game
            </Badge>
            <div>
              <h2 id="opsville-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                Opsville
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                A pixel-art town where every district is broken and you are on call. Walk around,
                talk to the locals and fix eight districts, from Linux Lodge to the Data Depot. Each
                quest opens one of our simulators, so you learn real DevOps as you play.
              </p>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {OPSVILLE_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <div>
              <Button asChild size="lg">
                <a href="/opsville/">
                  Play Opsville
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`${section.id}-heading`}
          className="container mx-auto px-4 pt-14"
        >
          <h2 id={`${section.id}-heading`} className="text-2xl font-bold">
            {section.title}
          </h2>
          <p className="mt-1 mb-6 max-w-3xl text-sm text-muted-foreground">{section.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {section.games.map((game) => (
              <GameCard key={game.id} game={toCardGame(game)} />
            ))}
          </div>
        </section>
      ))}

      {/* Inline ad at the natural break between the game grid and labs. */}
      <div className="max-w-2xl mx-auto mt-12 px-4">
        <CarbonAds />
      </div>

      <section className="container mx-auto px-4 pt-14">
        <div className="flex flex-col gap-5 rounded-lg border border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center sm:p-8">
          <FlaskConical className="h-10 w-10 shrink-0 text-primary" strokeWidth={1.5} />
          <div className="flex-1">
            <h2 className="text-xl font-bold sm:text-2xl">Looking for hands-on labs?</h2>
            <p className="mt-1 text-muted-foreground">
              Terminals, step-throughs and sandboxes for Linux, Docker, Kubernetes, Git, CI/CD,
              observability, security, networking, databases and Terraform.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/simulators">
              {simulatorsLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4 pt-14 pb-16 text-center">
        <h2 className="mb-2 text-lg font-semibold">Have an idea for a DevOps game?</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Tell us what you would like to play. We might build it next.
        </p>
        <Button variant="outline" asChild>
          <Link href="https://github.com/The-DevOps-Daily/devops-daily/issues/new/choose">
            <Dice6 className="mr-2 h-4 w-4" />
            Suggest a game
          </Link>
        </Button>
      </section>
    </div>
  );
}
