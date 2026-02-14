import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import DDoSSimulator from '@/components/games/ddos-simulator';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { InlineSponsors } from '@/components/inline-sponsors';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('ddos-simulator');
}

export default async function DDoSSimulatorPage() {
  const game = await getGameById('ddos-simulator');
  const gameTitle = game?.title || 'DDoS Attack Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/ddos-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/ddos-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="ddos-simulator" gameTitle={gameTitle} />
       </div>
       <DDoSSimulator />

        {/* Our Sponsors */}
        <div className="w-full my-8">
          <InlineSponsors variant="compact" />
        </div>
      </div>
    </>
  );
}
