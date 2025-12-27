import type { Metadata } from 'next';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('gitops-workflow');
}

export default function GitOpsWorkflowPage() {
  return <GitOpsWorkflow />;
}
