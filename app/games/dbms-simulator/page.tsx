import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema, SoftwareApplicationSchema } from '@/components/schema-markup';
import { GameSeoContent } from '@/components/games/game-seo-content';
import DbmsSimulator from '@/components/games/dbms-simulator';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('dbms-simulator');
}

export default async function DbmsSimulatorPage() {
  const game = await getGameById('dbms-simulator');
  const gameTitle = game?.title || 'DBMS Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/dbms-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/dbms-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      {game && (
        <SoftwareApplicationSchema
          name={game.title}
          description={game.description}
          url={game.href}
          category={game.category || 'DevOps Simulator'}
          keywords={game.tags}
        />
      )}
      <GameSeoContent
        title="DBMS Simulator"
        description="Interactive database management simulator. Learn SQL queries, transactions, indexing strategies, and database operations through hands-on simulation."
        category="Database"
        tags={["database", "sql", "transactions", "indexing"]}
        learningPoints={[
            "Write and execute SQL queries",
            "Understand database transactions and ACID properties",
            "Learn indexing strategies for performance",
        ]}
      />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="dbms-simulator" gameTitle={gameTitle} />
        </div>

        {/* Sponsors */}
        <GameSponsors />

        <DbmsSimulator />

        {/* Carbon Ads */}
        <div className="w-full max-w-md mx-auto my-8">
          <CarbonAds />
        </div>
      </div>
    </>
  );
}
