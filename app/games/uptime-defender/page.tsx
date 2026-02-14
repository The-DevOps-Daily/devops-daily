import type { Metadata } from 'next';
import UptimeDefender from '@/components/games/uptime-defender';
import { generateGameMetadata } from '@/lib/game-metadata';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('uptime-defender');
}

export default async function UptimeDefenderPage() {
  const game = await getGameById('uptime-defender');
  const gameTitle = game?.title || 'Uptime Defender';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/uptime-defender', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/uptime-defender' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      {/* Page H1 heading for SEO and accessibility */}
      <h1 className="sr-only">Uptime Defender - SRE Incident Response Game</h1>

      <div className="container px-4 pt-4 mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="uptime-defender" gameTitle={gameTitle} />
        </div>
      </div>

      {/* Sponsors */}
      <div className="container px-4 py-4 mx-auto max-w-7xl">
        <GameSponsors />
      </div>

      <UptimeDefender />

      {/* Carbon Ads */}
      <div className="container px-4 py-4 mx-auto max-w-md">
        <CarbonAds />
      </div>
    </>
  );
}
