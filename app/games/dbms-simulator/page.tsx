import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import DbmsSimulator from '@/components/games/dbms-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('dbms-simulator');
}

export default function DbmsSimulatorPage() {
  return (
    <>
      <GameSeoContent
        title="DBMS Simulator"
        description="Interactive database management simulator. Learn SQL queries, transactions, indexing strategies, and database operations through hands-on simulation."
        category="Database"
        tags={['database', 'sql', 'transactions', 'indexing']}
        learningPoints={[
          'Write and execute SQL queries',
          'Understand database transactions and ACID properties',
          'Learn indexing strategies for performance',
        ]}
      />
      <SimulatorShell slug="dbms-simulator">
        <DbmsSimulator />
      </SimulatorShell>
    </>
  );
}
