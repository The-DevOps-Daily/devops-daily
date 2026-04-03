import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { GameSeoContent } from '@/components/games/game-seo-content';
import ForkBombSimulator from '@/components/games/fork-bomb-simulator';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('fork-bomb-simulator');
}

export default async function ForkBombSimulatorPage() {
  const game = await getGameById('fork-bomb-simulator');
  const gameTitle = game?.title || 'Fork Bomb Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/fork-bomb-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/fork-bomb-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <GameSeoContent
        title="Fork Bomb Simulator"
        description="Visualize how the :(){ :|:& };: fork bomb works. Watch exponential process growth, understand resource exhaustion, and learn prevention with ulimit and cgroups."
        category="Security"
        tags={['linux', 'bash', 'security', 'processes']}
        learningPoints={[
          'Understand how fork bombs create exponential process growth',
          'See how resource exhaustion leads to system crashes',
          'Learn to prevent fork bombs with ulimit, cgroups, and systemd',
        ]}
      />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="fork-bomb-simulator" gameTitle={gameTitle} />
        </div>

        {/* Sponsors */}
        <GameSponsors />

        <ForkBombSimulator />

        {/* Carbon Ads */}
        <div className="w-full max-w-md mx-auto my-8">
          <CarbonAds />
        </div>
      </div>
    </>
  );
}
