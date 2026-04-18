import type { Metadata } from 'next';
import ServiceMeshSimulator from '../../../components/games/service-mesh-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('service-mesh-simulator');
}

function ServiceMeshEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Service Mesh</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Core concepts</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Sidecar Proxy:</strong> A proxy (like Envoy)
              deployed alongside each service to handle all network traffic.
            </li>
            <li>
              <strong className="text-foreground">Control Plane:</strong> Manages and configures
              the sidecar proxies (e.g., Istiod, Linkerd controller).
            </li>
            <li>
              <strong className="text-foreground">Data Plane:</strong> The collection of sidecar
              proxies that actually handle traffic.
            </li>
            <li>
              <strong className="text-foreground">mTLS:</strong> Mutual TLS encrypts
              service-to-service communication and verifies identities.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Traffic management</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Traffic Splitting:</strong> Route a percentage
              of traffic to different versions (canary deployments).
            </li>
            <li>
              <strong className="text-foreground">Retries:</strong> Automatically retry failed
              requests with exponential backoff.
            </li>
            <li>
              <strong className="text-foreground">Circuit Breaker:</strong> Prevent cascading
              failures by stopping requests to unhealthy services.
            </li>
            <li>
              <strong className="text-foreground">Timeouts:</strong> Set maximum wait time for
              requests to avoid hanging.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Key benefits</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Security:</strong> Automatic mTLS encryption
            without code changes.
          </li>
          <li>
            <strong className="text-foreground">Observability:</strong> Detailed metrics, logs,
            and traces for all service communication.
          </li>
          <li>
            <strong className="text-foreground">Resilience:</strong> Built-in retries, circuit
            breakers, and timeouts.
          </li>
          <li>
            <strong className="text-foreground">Traffic Control:</strong> Canary deployments, A/B
            testing, and traffic mirroring.
          </li>
        </ul>
      </div>

      <div className="mt-6">
        <h4 className="mb-3 font-semibold text-sm">Popular service meshes</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border bg-background p-4">
            <h5 className="mb-2 font-semibold text-sm">Istio</h5>
            <p className="text-sm text-muted-foreground">
              Uses Envoy proxies, feature-rich control plane (Istiod), extensive traffic
              management and security features. Most widely adopted.
            </p>
          </div>
          <div className="rounded-md border bg-background p-4">
            <h5 className="mb-2 font-semibold text-sm">Linkerd</h5>
            <p className="text-sm text-muted-foreground">
              Ultra-light, uses custom Rust-based proxies, minimal resource overhead, simpler
              configuration, CNCF graduated project.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ServiceMeshSimulatorPage() {
  return (
    <SimulatorShell slug="service-mesh-simulator" educational={<ServiceMeshEducational />}>
      <ServiceMeshSimulator />
    </SimulatorShell>
  );
}
