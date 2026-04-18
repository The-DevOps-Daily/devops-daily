import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('gitops-workflow');
}

export default function GitOpsWorkflowPage() {
  return (
    <>
      <GameSeoContent
        title="GitOps Workflow Simulator"
        description="Simulate GitOps deployment workflows with Git repositories, CI/CD pipelines, and Kubernetes clusters. Learn how changes flow from code commits to production deployments."
        category="CI/CD"
        tags={['gitops', 'kubernetes', 'cicd', 'deployment']}
        learningPoints={[
          'Understand the GitOps deployment model',
          'Trace changes from commit to production',
          'Learn reconciliation and drift detection',
        ]}
      />
      <SimulatorShell slug="gitops-workflow">
        <GitOpsWorkflow />
      </SimulatorShell>
    </>
  );
}
