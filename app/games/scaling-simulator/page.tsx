import type { Metadata } from 'next';
import ScalingSimulator from '@/components/games/scaling-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('scaling-simulator');
}

function ScalingEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Scaling Strategies</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Horizontal scaling (scale out) vs vertical scaling (scale up)</li>
            <li>When to use each scaling strategy based on workload</li>
            <li>Impact on performance, cost, and reliability</li>
            <li>Auto-scaling configuration and benefits</li>
            <li>Load distribution with horizontal scaling</li>
            <li>Budget management and cost optimization</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Scaling strategies</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Vertical Scaling:</strong> Increase server
              resources (CPU, RAM, disk). Simple but limited.
            </li>
            <li>
              <strong className="text-foreground">Horizontal Scaling:</strong> Add more servers
              with load balancer. Unlimited but complex.
            </li>
            <li>
              <strong className="text-foreground">Auto-Scaling:</strong> Automatically adjust
              capacity based on demand.
            </li>
            <li>
              <strong className="text-foreground">Hybrid Approach:</strong> Combine both
              strategies for optimal results.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Real-world applications</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">AWS EC2:</strong> Use Auto Scaling Groups with ELB
            for horizontal scaling.
          </li>
          <li>
            <strong className="text-foreground">Kubernetes:</strong> Horizontal Pod Autoscaler
            (HPA) for container workloads.
          </li>
          <li>
            <strong className="text-foreground">Databases:</strong> Read replicas (horizontal) vs
            larger instances (vertical).
          </li>
          <li>
            <strong className="text-foreground">Serverless:</strong> Automatic scaling without
            managing servers.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Best practices</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Start with vertical scaling for simplicity, then scale horizontally.</li>
          <li>Use auto-scaling to handle traffic spikes cost-effectively.</li>
          <li>Set appropriate cooldown periods to avoid scaling thrashing.</li>
          <li>Monitor key metrics: CPU, memory, response time, error rate.</li>
          <li>Design stateless applications for easier horizontal scaling.</li>
        </ul>
      </div>
    </>
  );
}

export default function ScalingSimulatorPage() {
  return (
    <SimulatorShell
      slug="scaling-simulator"
      educational={<ScalingEducational />}
      shareText="Check out this Scaling Simulator! Learn horizontal vs vertical scaling strategies interactively."
    >
      <ScalingSimulator />
    </SimulatorShell>
  );
}
