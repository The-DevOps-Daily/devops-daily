import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { GameSeoContent } from '@/components/games/game-seo-content';
import RestVsGraphqlSimulator from '@/components/games/rest-vs-graphql-simulator';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

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
      <GameSeoContent
        title="REST vs GraphQL Simulator"
        description="Compare REST and GraphQL API approaches side by side. Make API requests, observe response payloads, and understand the tradeoffs between over-fetching, under-fetching, and query flexibility."
        category="API Design"
        tags={["rest", "graphql", "api", "web-development"]}
        learningPoints={[
            "Compare REST and GraphQL request patterns",
            "Understand over-fetching and under-fetching",
            "Learn when to choose REST vs GraphQL",
        ]}
      />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="rest-vs-graphql" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col mx-auto max-w-7xl">
          <h2 className="sr-only">
            REST API vs GraphQL - Interactive Comparison Simulator
          </h2>

          {/* Sponsors */}
          <GameSponsors />

         <RestVsGraphqlSimulator />

          {/* Carbon Ads */}
          <div className="w-full max-w-md mx-auto my-8">
            <CarbonAds />
          </div>
        </div>
      </div>
    </>
  );
}
