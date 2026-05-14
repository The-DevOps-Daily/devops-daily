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
        'Write and execute SQL queries',
        'Understand database transactions and ACID properties',
        'Learn indexing strategies for performance',
      ]}
    >
      <DbmsSimulator />
    </SimulatorShell>
  );
}
