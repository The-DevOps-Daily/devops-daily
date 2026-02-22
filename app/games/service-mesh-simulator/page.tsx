import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import ServiceMeshSimulator from '../../../components/games/service-mesh-simulator';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('service-mesh-simulator');
}

export default async function ServiceMeshSimulatorPage() {
  const game = await getGameById('service-mesh-simulator');
  const gameTitle = game?.title || 'Service Mesh Traffic Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/service-mesh-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/service-mesh-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="service-mesh-simulator" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Service Mesh Traffic Simulator - Learn mTLS, Traffic Splitting, and Circuit Breakers
          </h2>

          {/* Sponsors */}
          <GameSponsors />

          <ServiceMeshSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Service Mesh</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">Core Concepts</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-blue-600">Sidecar Proxy:</strong> A proxy (like Envoy) deployed alongside each service to handle all network traffic.
                  </div>
                  <div>
                    <strong className="text-cyan-600">Control Plane:</strong> Manages and configures the sidecar proxies (e.g., Istiod, Linkerd controller).
                  </div>
                  <div>
                    <strong className="text-green-600">Data Plane:</strong> The collection of sidecar proxies that actually handle traffic.
                  </div>
                  <div>
                    <strong className="text-purple-600">mTLS:</strong> Mutual TLS encrypts service-to-service communication and verifies identities.
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Traffic Management</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-indigo-600">Traffic Splitting:</strong> Route a percentage of traffic to different versions (canary deployments).
                  </div>
                  <div>
                    <strong className="text-pink-600">Retries:</strong> Automatically retry failed requests with exponential backoff.
                  </div>
                  <div>
                    <strong className="text-teal-600">Circuit Breaker:</strong> Prevent cascading failures by stopping requests to unhealthy services.
                  </div>
                  <div>
                    <strong className="text-orange-600">Timeouts:</strong> Set maximum wait time for requests to avoid hanging.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Key Benefits</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Security:</strong> Automatic mTLS encryption without code changes</li>
                <li>• <strong>Observability:</strong> Detailed metrics, logs, and traces for all service communication</li>
                <li>• <strong>Resilience:</strong> Built-in retries, circuit breakers, and timeouts</li>
                <li>• <strong>Traffic Control:</strong> Canary deployments, A/B testing, and traffic mirroring</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold">Popular Service Meshes</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg bg-background">
                  <h4 className="mb-2 font-semibold text-blue-600">Istio</h4>
                  <p className="text-sm text-muted-foreground">
                    Uses Envoy proxies, feature-rich control plane (Istiod), extensive traffic management and security features. Most widely adopted.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-background">
                  <h4 className="mb-2 font-semibold text-purple-600">Linkerd</h4>
                  <p className="text-sm text-muted-foreground">
                    Ultra-light, uses custom Rust-based proxies, minimal resource overhead, simpler configuration, CNCF graduated project.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Carbon Ads */}
          <CarbonAds />
        </div>
      </div>
    </>
  );
}
