import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import LoadBalancerSimulator from '../../../components/games/load-balancer-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('load-balancer-simulator');
}

export default async function LoadBalancerSimulatorPage() {
  const game = await getGameById('load-balancer-simulator');
  const gameTitle = game?.title || 'Load Balancer Algorithm Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/load-balancer-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/load-balancer-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Load Balancer Algorithm Simulator - Learn Load Balancing Strategies
          </h2>

          <LoadBalancerSimulator />

          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Load Balancing</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>How different load balancing algorithms distribute traffic</li>
                  <li>When to use each algorithm based on your use case</li>
                  <li>How load balancers handle server failures</li>
                  <li>The difference between Layer 4 and Layer 7 load balancing</li>
                  <li>Impact of server weights on traffic distribution</li>
                  <li>Measuring distribution fairness and performance</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Load Balancing Algorithms</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-blue-600">Round Robin:</strong> Simple, even
                    distribution for similar servers
                  </div>
                  <div>
                    <strong className="text-green-600">Least Connections:</strong> Best for
                    long-lived connections
                  </div>
                  <div>
                    <strong className="text-purple-600">IP Hash:</strong> Session persistence with
                    sticky sessions
                  </div>
                  <div>
                    <strong className="text-orange-600">Least Response Time:</strong> Optimal for
                    varying performance
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Real-World Applications</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  • <strong>NGINX/HAProxy:</strong> Popular open-source load balancers supporting
                  all algorithms
                </li>
                <li>
                  • <strong>AWS ELB:</strong> Application Load Balancer (Layer 7) vs Network Load
                  Balancer (Layer 4)
                </li>
                <li>
                  • <strong>Kubernetes:</strong> Service load balancing with kube-proxy using
                  iptables/IPVS
                </li>
                <li>
                  • <strong>Cloudflare:</strong> Global load balancing with geographic routing and
                  health checks
                </li>
              </ul>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🎯 Best Practices</h3>
              <ul className="space-y-1 text-sm">
                <li>• Use weighted algorithms when servers have different capacities</li>
                <li>• Implement active health checks to detect failures quickly</li>
                <li>• Consider geographic routing for global applications</li>
                <li>• Use Layer 7 for content-based routing and SSL termination</li>
                <li>• Monitor distribution fairness and server utilization</li>
              </ul>
            </div>
          </div>

          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this Load Balancer Algorithm Simulator! Perfect for learning traffic distribution strategies.')}&url=${encodeURIComponent('https://devops-daily.com/games/load-balancer-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/load-balancer-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/load-balancer-simulator')}`}
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
