import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FlaskConical, Gamepad2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/page-hero';
import { LottiePlayer } from '@/components/lottie-player';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { CarbonAds } from '@/components/carbon-ads';
import { GameCard, toCardGame } from '@/components/game-card';
import { SimulatorsHub, type HubGroup } from '@/components/simulators-hub';
import { getActiveByType, getComingSoonSimulators, groupSimulatorsByTopic } from '@/lib/game-hubs';
import { toJsonLd } from '@/lib/json-ld';

const SITE_URL = 'https://devops-daily.com';
const title = 'Free DevOps Simulators: Hands-On Labs in Your Browser';
const description =
  'Free hands-on DevOps labs that run in your browser: Linux, Docker, Kubernetes, Git, CI/CD, observability, security, networking, databases and Terraform. No sign-up.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: '/simulators',
  },
  openGraph: {
    title: `${title} | DevOps Daily`,
    description,
    type: 'website',
    url: '/simulators',
    images: [
      {
        url: '/images/pages/simulators.jpg',
        width: 1200,
        height: 630,
        alt: 'Free DevOps Simulators',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} | DevOps Daily`,
    description,
    images: ['/images/pages/simulators.jpg'],
  },
};

export default async function SimulatorsPage() {
  const [simulators, games, comingSoon] = await Promise.all([
    getActiveByType('simulator'),
    getActiveByType('game'),
    getComingSoonSimulators(),
  ]);
  const groups: HubGroup[] = groupSimulatorsByTopic(simulators).map(({ topic, simulators }) => ({
    id: topic.id,
    label: topic.label,
    description: topic.description,
    simulators: simulators.map((game) => ({ ...toCardGame(game), category: game.category })),
  }));

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Free DevOps Simulators',
    numberOfItems: simulators.length,
    itemListElement: groups
      .flatMap((group) => group.simulators)
      .map((game, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: game.title,
        url: `${SITE_URL}${game.href}`,
      })),
  };

  return (
    <div className="min-h-screen">
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Simulators', url: '/simulators' },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(itemList) }} />

      <PageHero
        title="Free DevOps Simulators"
        accentWord="Simulators"
        description="Hands-on labs that run in your browser. Type real commands, step through how systems work, and break things safely. No sign-up."
        icon={FlaskConical}
        breadcrumbs={[{ label: 'Simulators' }]}
        stats={[
          { label: 'simulators', value: simulators.length },
          { label: 'topics', value: groups.length },
        ]}
        sideContent={
          <LottiePlayer
            path="/lottie/games-hero.json"
            className="h-48 w-64 xl:h-56 xl:w-72"
            ariaLabel="Animated terminal window surrounded by floating shapes"
          />
        }
      />

      <section className="container mx-auto px-4 py-8">
        <SimulatorsHub groups={groups} />
      </section>

      {/* Inline ad at the natural break before upcoming simulators. */}
      <div className="max-w-2xl mx-auto mt-12 px-4">
        <CarbonAds />
      </div>

      {comingSoon.length > 0 && (
        <section aria-labelledby="coming-soon-heading" className="container mx-auto px-4 py-8">
          <h2 id="coming-soon-heading" className="text-2xl font-bold">
            Coming soon
          </h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Simulators we are still building.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comingSoon.map((game) => (
              <GameCard key={game.id} game={toCardGame(game)} />
            ))}
          </div>
        </section>
      )}

      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-5 sm:flex-row sm:items-center">
          <Gamepad2 className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.5} />
          <div className="flex-1">
            <h2 className="mb-1 text-base font-semibold">Want something lighter?</h2>
            <p className="text-sm text-muted-foreground">
              Play Opsville, our pixel-art DevOps town, or one of {games.length} arcade and party
              games.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/games">
              See the games
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4 pt-8 pb-16">
        <div className="rounded-md border border-border/50 bg-primary/5 p-8 md:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <Lightbulb className="mx-auto mb-6 h-12 w-12 text-primary" />
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">Have an idea for a simulator?</h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Tell us which tool or concept you want to try hands-on. We might build it next.
            </p>
            <Button size="lg" asChild>
              <Link href="https://github.com/The-DevOps-Daily/devops-daily/issues/new/choose">
                Suggest a simulator
              </Link>
            </Button>
            <p className="mt-8 text-sm text-muted-foreground">
              Want more hands-on practice? We curate{' '}
              <Link
                href="https://github.com/The-DevOps-Daily/awesome-interactive-learning"
                className="font-medium text-primary underline underline-offset-4"
              >
                awesome-interactive-learning
              </Link>
              , a list of the best browser-based labs, playgrounds and games across the whole DevOps
              ecosystem.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
