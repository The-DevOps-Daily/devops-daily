import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import MicroservicesSimulator from '../../../components/games/microservices-simulator';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('microservices-simulator');
}

export default async function MicroservicesSimulatorPage() {
  const game = await getGameById('microservices-simulator');
  const gameTitle = game?.title || 'Microservices Architecture Simulator';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/microservices-simulator', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/microservices-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Microservices Architecture Simulator - Learn Service Communication & Resilience
          </h2>
          {/* Game Component */}
          <MicroservicesSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Microservices Architecture</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Microservices vs monolithic architecture patterns</li>
                  <li>Service-to-service communication (sync vs async)</li>
                  <li>Independent scaling of services</li>
                  <li>Failure handling and resilience patterns</li>
                  <li>Service discovery and API gateways</li>
                  <li>Distributed system challenges</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Key Benefits</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-green-600">✓ Independent Deployment:</strong> Deploy services separately
                  </div>
                  <div>
                    <strong className="text-blue-600">✓ Technology Diversity:</strong> Use best tools per service
                  </div>
                  <div>
                    <strong className="text-purple-600">✓ Fault Isolation:</strong> Failures don't cascade
                  </div>
                  <div>
                    <strong className="text-orange-600">✓ Independent Scaling:</strong> Scale services based on demand
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 mt-6 md:grid-cols-2">
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
                <h3 className="mb-2 text-lg font-semibold">✅ When to Use Microservices</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Large, complex applications</li>
                  <li>• Large development teams (50+ people)</li>
                  <li>• Rapidly changing requirements</li>
                  <li>• Need independent deployments</li>
                  <li>• Different scaling needs per component</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-500/20">
                <h3 className="mb-2 text-lg font-semibold">❌ When to Avoid</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Small applications</li>
                  <li>• Small teams (&lt;10 people)</li>
                  <li>• Simple CRUD applications</li>
                  <li>• Tight coupling between features</li>
                  <li>• Network latency is critical</li>
                </ul>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Pro Tips</h3>
              <ul className="space-y-1 text-sm">
                <li>• Start with a monolith and decompose when needed</li>
                <li>• Use API gateways for centralized routing and auth</li>
                <li>• Implement circuit breakers to prevent cascade failures</li>
                <li>• Monitor distributed traces across all services</li>
                <li>• Use message queues for async communication</li>
                <li>• Each service should have its own database</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold">Real-World Examples</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-3 border rounded bg-muted/50">
                  <strong>Netflix:</strong> 500+ microservices handling billions of requests
                </div>
                <div className="p-3 border rounded bg-muted/50">
                  <strong>Amazon:</strong> Decomposed monolith to microservices in early 2000s
                </div>
                <div className="p-3 border rounded bg-muted/50">
                  <strong>Uber:</strong> Moved from monolith to 2000+ microservices
                </div>
              </div>
            </div>
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this Microservices Architecture Simulator! Perfect for learning distributed systems.')}&url=${encodeURIComponent('https://devops-daily.com/games/microservices-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 transition-colors border rounded-lg hover:bg-muted"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/microservices-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 transition-colors border rounded-lg hover:bg-muted"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/microservices-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 transition-colors border rounded-lg hover:bg-muted"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Back to Games */}
          <Link href="/games">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to All Games
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
