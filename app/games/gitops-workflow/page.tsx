import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('gitops-workflow');
}

export default async function GitOpsWorkflowPage() {
  const game = await getGameById('gitops-workflow');
  const gameTitle = game?.title || 'GitOps Workflow';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/gitops-workflow', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/gitops-workflow' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="gitops-workflow" gameTitle={gameTitle} />
        </div>

        {/* Sponsors */}
        <GameSponsors />

        <GitOpsWorkflow />

        {/* Carbon Ads */}
        <div className="max-w-md mx-auto my-8">
          <CarbonAds />
        </div>
      </div>
    </>
  );
}
