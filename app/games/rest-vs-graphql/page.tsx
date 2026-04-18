import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import RestVsGraphqlSimulator from '@/components/games/rest-vs-graphql-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('rest-vs-graphql');
}

export default function RestVsGraphqlPage() {
  return (
    <>
      <GameSeoContent
        title="REST vs GraphQL Simulator"
        description="Compare REST and GraphQL API approaches side by side. Make API requests, observe response payloads, and understand the tradeoffs between over-fetching, under-fetching, and query flexibility."
        category="API Design"
        tags={['rest', 'graphql', 'api', 'web-development']}
        learningPoints={[
          'Compare REST and GraphQL request patterns',
          'Understand over-fetching and under-fetching',
          'Learn when to choose REST vs GraphQL',
        ]}
      />
      <SimulatorShell slug="rest-vs-graphql">
        <RestVsGraphqlSimulator />
      </SimulatorShell>
    </>
  );
}
