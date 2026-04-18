import type { Metadata } from 'next';
import UptimeDefender from '@/components/games/uptime-defender';
import { GameSeoContent } from '@/components/games/game-seo-content';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('uptime-defender');
}

export default function UptimeDefenderPage() {
  return (
    <>
      <GameSeoContent
        title="Uptime Defender"
        description="Defend your infrastructure uptime against real-world incidents. Handle server failures, network outages, deployment issues, and security incidents in this incident response simulation game."
        category="SRE"
        tags={['sre', 'incident-response', 'uptime', 'reliability']}
        learningPoints={[
          'Practice incident response workflows',
          'Prioritize and triage production issues',
          'Learn about SLAs, SLOs, and error budgets',
          'Handle cascading failures',
        ]}
      />
      <SimulatorShell slug="uptime-defender">
        <UptimeDefender />
      </SimulatorShell>
    </>
  );
}
