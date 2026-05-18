import type { Metadata } from 'next';
import { CardsAgainstDevOps } from '@/components/games/cards-against-devops';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cards-against-devops');
}

export default function CardsAgainstDevOpsPage() {
  return (
    <SimulatorShell
      slug="cards-against-devops"
      seoLearningPoints={[
        'Learn DevOps terminology through humor',
        'Understand common DevOps scenarios',
        'Team building and knowledge sharing',
      ]}
    >
      <CardsAgainstDevOps />
    </SimulatorShell>
  );
}
