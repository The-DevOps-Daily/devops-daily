import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import PacketJourney from '@/components/games/packet-journey';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('packet-journey');
}

export default async function PacketJourneyPage() {
  const game = await getGameById('packet-journey');
  const gameTitle = game?.title || 'Packet Journey';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/packet-journey', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/packet-journey' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="packet-journey" gameTitle={gameTitle} />
        </div>
        <PacketJourney />
      </div>
    </>
  );
}
