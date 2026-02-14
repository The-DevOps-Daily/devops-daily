import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import RestVsGraphqlSimulator from '@/components/games/rest-vs-graphql-simulator';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { InlineSponsors } from '@/components/inline-sponsors';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('rest-vs-graphql');
}

export default async function RestVsGraphqlPage() {
  const game = await getGameById('rest-vs-graphql');
  const gameTitle = game?.title || 'REST API vs GraphQL Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/rest-vs-graphql', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/rest-vs-graphql' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="rest-vs-graphql" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col mx-auto max-w-7xl">
          <h2 className="sr-only">
            REST API vs GraphQL - Interactive Comparison Simulator
         </h2>
         <RestVsGraphqlSimulator />

          {/* Our Sponsors */}
          <div className="w-full my-8">
            <InlineSponsors variant="compact" />
          </div>
        </div>
      </div>
    </>
  );
}
