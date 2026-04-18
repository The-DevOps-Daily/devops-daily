import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import { CardsAgainstDevOps } from '@/components/games/cards-against-devops';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cards-against-devops');
}

export default function CardsAgainstDevOpsPage() {
  return (
    <>
      <GameSeoContent
        title="Cards Against DevOps"
        description="A fun card game that combines DevOps humor with learning. Match DevOps terms, tools, and scenarios in this entertaining educational card game."
        category="Fun"
        tags={['devops', 'humor', 'learning', 'cards']}
        learningPoints={[
          'Learn DevOps terminology through humor',
          'Understand common DevOps scenarios',
          'Team building and knowledge sharing',
        ]}
      />
      <SimulatorShell slug="cards-against-devops">
        <CardsAgainstDevOps />
      </SimulatorShell>
    </>
  );
}
