import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import DeploymentStrategiesSimulator from '../../../components/games/deployment-strategies-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { InlineSponsors } from '@/components/inline-sponsors';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('deployment-strategies');
}

export default async function DeploymentStrategiesPage() {
  const game = await getGameById('deployment-strategies');
  const gameTitle = game?.title || 'Deployment Strategies Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/deployment-strategies', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/deployment-strategies' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="deployment-strategies" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Deployment Strategies Simulator - Learn Blue-Green, Canary, Rolling Updates
         </h2>

         <DeploymentStrategiesSimulator />

          {/* Our Sponsors */}
          <div className="w-full my-8">
            <InlineSponsors variant="full" />
          </div>

          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Deployment Strategies</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>How different deployment strategies minimize risk and downtime</li>
                  <li>Trade-offs between deployment speed, safety, and resource cost</li>
                  <li>When to use each strategy based on your application needs</li>
                  <li>How traffic routing changes during deployments</li>
                  <li>The role of feature toggles in modern deployment practices</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Deployment Strategies Compared</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-red-500">Recreate:</strong> Simple but causes
                    downtime - terminate all, then deploy all
                  </div>
                  <div>
                    <strong className="text-blue-500">Rolling Update:</strong> Kubernetes
                    default - gradual replacement, zero downtime
                  </div>
                  <div>
                    <strong className="text-green-500">Blue-Green:</strong> Two environments,
                    instant switch, instant rollback
                  </div>
                  <div>
                    <strong className="text-amber-500">Canary:</strong> Gradual traffic shift,
                    real-user testing, data-driven rollout
                  </div>
                  <div>
                    <strong className="text-purple-500">Feature Toggles:</strong> Decouple
                    deployment from release, per-user targeting
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Real-World Implementations</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  • <strong>Kubernetes:</strong> Native support for Rolling Updates and Recreate
                  via Deployment spec
                </li>
                <li>
                  • <strong>Argo Rollouts:</strong> Advanced Blue-Green and Canary with automated
                  analysis
                </li>
                <li>
                  • <strong>Istio/Linkerd:</strong> Service mesh traffic splitting for Canary
                  deployments
                </li>
                <li>
                  • <strong>LaunchDarkly/Unleash:</strong> Feature flag platforms for toggle-based
                  releases
                </li>
                <li>
                  • <strong>AWS CodeDeploy:</strong> Managed deployment service supporting
                  multiple strategies
                </li>
              </ul>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🎯 Best Practices</h3>
              <ul className="space-y-1 text-sm">
                <li>• Always have a rollback plan before deploying to production</li>
                <li>• Use health checks and readiness probes to verify new versions</li>
                <li>• Implement proper monitoring and alerting during deployments</li>
                <li>• Consider database migrations carefully - they often need special handling</li>
                <li>• Start with smaller blast radius (Canary) for critical services</li>
                <li>• Clean up feature flags after features are fully rolled out</li>
              </ul>
            </div>
          </div>

          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this Deployment Strategies Simulator! Learn Blue-Green, Canary, Rolling Updates and more.')}&url=${encodeURIComponent('https://devops-daily.com/games/deployment-strategies')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/deployment-strategies')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/deployment-strategies')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
