import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import ScalingSimulator from '@/components/games/scaling-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { InlineSponsors } from '@/components/inline-sponsors';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('scaling-simulator');
}

export default async function ScalingSimulatorPage() {
  const game = await getGameById('scaling-simulator');
  const gameTitle = game?.title || 'Horizontal vs Vertical Scaling Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/scaling-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/scaling-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="scaling-simulator" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Horizontal vs Vertical Scaling Simulator - Learn Scaling Strategies
         </h2>

         <ScalingSimulator />

          {/* Our Sponsors */}
          <div className="w-full my-8">
            <InlineSponsors variant="compact" />
          </div>

          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Scaling Strategies</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Horizontal scaling (scale out) vs vertical scaling (scale up)</li>
                  <li>When to use each scaling strategy based on workload</li>
                  <li>Impact on performance, cost, and reliability</li>
                  <li>Auto-scaling configuration and benefits</li>
                  <li>Load distribution with horizontal scaling</li>
                  <li>Budget management and cost optimization</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Scaling Strategies</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-blue-600">Vertical Scaling:</strong> Increase server
                    resources (CPU, RAM, disk) - simple but limited
                  </div>
                  <div>
                    <strong className="text-green-600">Horizontal Scaling:</strong> Add more
                    servers with load balancer - unlimited but complex
                  </div>
                  <div>
                    <strong className="text-purple-600">Auto-Scaling:</strong> Automatically
                    adjust capacity based on demand
                  </div>
                  <div>
                    <strong className="text-orange-600">Hybrid Approach:</strong> Combine both
                    strategies for optimal results
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Real-World Applications</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  • <strong>AWS EC2:</strong> Use Auto Scaling Groups with ELB for horizontal
                  scaling
                </li>
                <li>
                  • <strong>Kubernetes:</strong> Horizontal Pod Autoscaler (HPA) for container
                  workloads
                </li>
                <li>
                  • <strong>Databases:</strong> Read replicas (horizontal) vs larger instances
                  (vertical)
                </li>
                <li>
                  • <strong>Serverless:</strong> Automatic scaling without managing servers
                </li>
              </ul>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🎯 Best Practices</h3>
              <ul className="space-y-1 text-sm">
                <li>• Start with vertical scaling for simplicity, then scale horizontally</li>
                <li>• Use auto-scaling to handle traffic spikes cost-effectively</li>
                <li>• Set appropriate cooldown periods to avoid scaling thrashing</li>
                <li>• Monitor key metrics: CPU, memory, response time, error rate</li>
                <li>• Design stateless applications for easier horizontal scaling</li>
              </ul>
            </div>
          </div>

          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this Scaling Simulator! Learn horizontal vs vertical scaling strategies interactively.')}&url=${encodeURIComponent('https://devops-daily.com/games/scaling-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/scaling-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/scaling-simulator')}`}
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
