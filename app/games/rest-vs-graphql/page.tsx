import type { Metadata } from 'next';
import RestVsGraphqlSimulator from '@/components/games/rest-vs-graphql-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('rest-vs-graphql');
}

export default function RestVsGraphqlPage() {
  return (
    <SimulatorShell
      slug="rest-vs-graphql"
      seoLearningPoints={[
        'Compare REST and GraphQL request patterns',
        'Understand over-fetching and under-fetching',
        'Learn when to choose REST vs GraphQL',
      ]}
    >
      <RestVsGraphqlSimulator />
    </SimulatorShell>
  );
}
