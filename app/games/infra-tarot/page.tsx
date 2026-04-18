import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import InfraTarot from '../../../components/games/infra-tarot';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('infra-tarot');
}

function InfraTarotEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">The art of infrastructure divination</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        While we can&apos;t actually predict your infrastructure future through mystical cards,
        this game highlights real DevOps challenges in a fun way. Each card represents genuine
        scenarios that infrastructure teams face, from outages and budget constraints to scaling
        challenges and security concerns.
      </p>
      <p className="text-sm text-muted-foreground">
        The best &quot;fortune telling&quot; for your infrastructure comes from proper monitoring,
        automated testing, infrastructure as code, and following DevOps best practices. But
        sometimes, a little humor helps us cope with the chaos of distributed systems.
      </p>
    </>
  );
}

export default function InfraTarotPage() {
  return (
    <>
      <GameSeoContent
        title="Infrastructure Tarot"
        description="A lighthearted take on infrastructure predictions. Draw cards representing common infrastructure scenarios, outages, and DevOps wisdom. Fun way to learn about failure modes and best practices."
        category="Fun"
        tags={['infrastructure', 'devops', 'fun', 'learning']}
        learningPoints={[
          'Learn about common infrastructure failure modes',
          'Understand DevOps best practices through metaphors',
          'Explore incident response scenarios',
        ]}
      />
      <SimulatorShell slug="infra-tarot" educational={<InfraTarotEducational />}>
        <InfraTarot />
      </SimulatorShell>
    </>
  );
}
