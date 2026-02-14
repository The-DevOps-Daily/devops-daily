import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { CardsAgainstDevOps } from '@/components/games/cards-against-devops';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cards-against-devops');
}

export default async function CardsAgainstDevOpsPage() {
  const game = await getGameById('cards-against-devops');
  const gameTitle = game?.title || 'Cards Against DevOps';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/cards-against-devops', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/cards-against-devops' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="cards-against-devops" gameTitle={gameTitle} />
        </div>

        {/* Sponsors */}
        <GameSponsors />

        <CardsAgainstDevOps />

        {/* Carbon Ads */}
        <div className="w-full max-w-md mx-auto my-8">
          <CarbonAds />
        </div>
      </div>
    </>
  );
}
