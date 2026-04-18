import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import K8sScheduler from '@/components/games/k8s-scheduler';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('k8s-scheduler');
}

export default function K8sSchedulerPage() {
  return (
    <>
      <GameSeoContent
        title="Kubernetes Scheduler Simulator"
        description="Learn how the Kubernetes scheduler assigns pods to nodes. Understand resource requests and limits, node affinity, taints and tolerations, and scheduling priorities through interactive simulation."
        category="Kubernetes"
        tags={['kubernetes', 'scheduling', 'pods', 'nodes', 'resources']}
        learningPoints={[
          'Understand Kubernetes pod scheduling algorithm',
          'Configure resource requests and limits',
          'Use node affinity, taints, and tolerations',
          'Debug scheduling failures',
        ]}
      />
      <SimulatorShell
        slug="k8s-scheduler"
        shareText="Try the Kubernetes Scheduler Challenge: place pods onto nodes while honoring K8s rules."
      >
        <K8sScheduler />
      </SimulatorShell>
    </>
  );
}
