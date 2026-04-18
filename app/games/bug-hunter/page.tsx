import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import BugHunter from '@/components/games/bug-hunter';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('bug-hunter');
}

export default function BugHunterPage() {
  return (
    <>
      <GameSeoContent
        title="Bug Hunter"
        description="Find and fix bugs in code snippets across multiple programming languages. Practice debugging skills with realistic code examples from DevOps tools and scripts."
        category="Debugging"
        tags={['debugging', 'coding', 'devops']}
        learningPoints={[
          'Identify common coding bugs',
          'Debug shell scripts and config files',
          'Improve code review skills',
        ]}
      />
      <SimulatorShell slug="bug-hunter" fallbackTitle="Bug Hunter">
        <BugHunter />
      </SimulatorShell>
    </>
  );
}
