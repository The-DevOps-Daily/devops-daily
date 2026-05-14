import type { Metadata } from 'next';
import K8sScheduler from '@/components/games/k8s-scheduler';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('k8s-scheduler');
}

export default function K8sSchedulerPage() {
  return (
    <SimulatorShell
      slug="k8s-scheduler"
      shareText="Try the Kubernetes Scheduler Challenge: place pods onto nodes while honoring K8s rules."
      seoLearningPoints={[
        'Understand Kubernetes pod scheduling algorithm',
        'Configure resource requests and limits',
        'Use node affinity, taints, and tolerations',
        'Debug scheduling failures',
      ]}
    >
      <K8sScheduler />
    </SimulatorShell>
  );
}
