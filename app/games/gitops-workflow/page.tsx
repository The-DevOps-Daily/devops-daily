import type { Metadata } from 'next';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('gitops-workflow');
}

export default function GitOpsWorkflowPage() {
  return (
    <SimulatorShell
      slug="gitops-workflow"
      seoLearningPoints={[
        'Understand the GitOps deployment model',
        'Trace changes from commit to production',
        'Learn reconciliation and drift detection',
      ]}
    >
      <GitOpsWorkflow />
    </SimulatorShell>
  );
}
