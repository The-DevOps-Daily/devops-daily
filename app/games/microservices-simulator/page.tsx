import type { Metadata } from 'next';
import MicroservicesSimulator from '../../../components/games/microservices-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('microservices-simulator');
}

function MicroservicesEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Microservices Architecture</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Microservices vs monolithic architecture patterns</li>
            <li>Service-to-service communication (sync vs async)</li>
            <li>Independent scaling of services</li>
            <li>Failure handling and resilience patterns</li>
            <li>Service discovery and API gateways</li>
            <li>Distributed system challenges</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Key benefits</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Independent Deployment:</strong> Deploy services
              separately.
            </li>
            <li>
              <strong className="text-foreground">Technology Diversity:</strong> Use best tools
              per service.
            </li>
            <li>
              <strong className="text-foreground">Fault Isolation:</strong> Failures don&apos;t
              cascade.
            </li>
            <li>
              <strong className="text-foreground">Independent Scaling:</strong> Scale services
              based on demand.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <h4 className="mb-2 font-semibold text-sm">When to use microservices</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Large, complex applications</li>
            <li>Large development teams (50+ people)</li>
            <li>Rapidly changing requirements</li>
            <li>Need independent deployments</li>
            <li>Different scaling needs per component</li>
          </ul>
        </div>
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <h4 className="mb-2 font-semibold text-sm">When to avoid</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Small applications</li>
            <li>Small teams (&lt;10 people)</li>
            <li>Simple CRUD applications</li>
            <li>Tight coupling between features</li>
            <li>Network latency is critical</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Pro tips</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Start with a monolith and decompose when needed.</li>
          <li>Use API gateways for centralized routing and auth.</li>
          <li>Implement circuit breakers to prevent cascade failures.</li>
          <li>Monitor distributed traces across all services.</li>
          <li>Use message queues for async communication.</li>
          <li>Each service should have its own database.</li>
        </ul>
      </div>

      <div className="mt-6">
        <h4 className="mb-3 font-semibold text-sm">Real-world examples</h4>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-background p-3 text-sm">
            <strong className="text-foreground">Netflix:</strong>
            <p className="mt-1 text-muted-foreground">
              500+ microservices handling billions of requests.
            </p>
          </div>
          <div className="rounded-md border bg-background p-3 text-sm">
            <strong className="text-foreground">Amazon:</strong>
            <p className="mt-1 text-muted-foreground">
              Decomposed monolith to microservices in early 2000s.
            </p>
          </div>
          <div className="rounded-md border bg-background p-3 text-sm">
            <strong className="text-foreground">Uber:</strong>
            <p className="mt-1 text-muted-foreground">
              Moved from monolith to 2000+ microservices.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function MicroservicesSimulatorPage() {
  return (
    <SimulatorShell
      slug="microservices-simulator"
      educational={<MicroservicesEducational />}
      shareText="Check out this Microservices Architecture Simulator! Perfect for learning distributed systems."
    >
      <MicroservicesSimulator />
    </SimulatorShell>
  );
}
