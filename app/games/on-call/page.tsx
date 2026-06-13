import type { Metadata } from 'next';
import OnCall from '@/components/games/on-call';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('on-call');
}

export default function OnCallPage() {
  return (
    <SimulatorShell
      slug="on-call"
      shareText="I just played today's On-Call incident on DevOps Daily. Can you find the root cause faster?"
      seoLearningPoints={[
        'Practice diagnosing real production incidents under a limited budget of moves',
        'Learn to gather evidence before guessing, the core on-call skill',
        'See how connection pools, OLAP-on-OLTP, and OOMKills surface as user-facing errors',
        'A new incident every day, with a shareable spoiler-free result',
      ]}
    >
      <OnCall />
    </SimulatorShell>
  );
}
