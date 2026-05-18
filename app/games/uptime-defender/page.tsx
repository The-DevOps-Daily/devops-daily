import type { Metadata } from 'next';
import UptimeDefender from '@/components/games/uptime-defender';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('uptime-defender');
}

export default function UptimeDefenderPage() {
  return (
    <SimulatorShell
      slug="uptime-defender"
      seoLearningPoints={[
        'Practice incident response workflows',
        'Prioritize and triage production issues',
        'Learn about SLAs, SLOs, and error budgets',
        'Handle cascading failures',
      ]}
    >
      <UptimeDefender />
    </SimulatorShell>
  );
}
