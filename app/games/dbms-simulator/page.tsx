import type { Metadata } from 'next';
import DbmsSimulator from '@/components/games/dbms-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('dbms-simulator');
}

export default function DbmsSimulatorPage() {
  return (
    <SimulatorShell
      slug="dbms-simulator"
      seoLearningPoints={[
        'Compare relational, document, key-value, column-family, graph and time-series databases',
        'See how each type models and queries data, and its CAP trade-offs',
        'Use a decision playground and a scenario quiz to pick a database for a workload',
      ]}
    >
      <DbmsSimulator />
    </SimulatorShell>
  );
}
