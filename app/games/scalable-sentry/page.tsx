import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import ScalableSentry from '@/components/games/scalable-sentry';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { InlineSponsors } from '@/components/inline-sponsors';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('scalable-sentry');
}

export default async function ScalableSentryPage() {
  const game = await getGameById('scalable-sentry');
  const gameTitle = game?.title || 'Scalable Sentry';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/scalable-sentry', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/scalable-sentry' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="scalable-sentry" gameTitle={gameTitle} />
       </div>
       <ScalableSentry />

        {/* Our Sponsors */}
        <div className="w-full my-8">
          <InlineSponsors variant="compact" />
        </div>
      </div>
    </>
  );
}
