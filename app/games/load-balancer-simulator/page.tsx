import type { Metadata } from 'next';
import LoadBalancerSimulator from '../../../components/games/load-balancer-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('load-balancer-simulator');
}

function LoadBalancerEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Load Balancing</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How different load balancing algorithms distribute traffic</li>
            <li>When to use each algorithm based on your use case</li>
            <li>How load balancers handle server failures</li>
            <li>The difference between Layer 4 and Layer 7 load balancing</li>
            <li>Impact of server weights on traffic distribution</li>
            <li>Measuring distribution fairness and performance</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Load balancing algorithms</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Round Robin:</strong> Simple, even distribution
              for similar servers.
            </li>
            <li>
              <strong className="text-foreground">Least Connections:</strong> Best for long-lived
              connections.
            </li>
            <li>
              <strong className="text-foreground">IP Hash:</strong> Session persistence with
              sticky sessions.
            </li>
            <li>
              <strong className="text-foreground">Least Response Time:</strong> Optimal for
              varying performance.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Real-world applications</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">NGINX/HAProxy:</strong> Popular open-source load
            balancers supporting all algorithms.
          </li>
          <li>
            <strong className="text-foreground">AWS ELB:</strong> Application Load Balancer
            (Layer 7) vs Network Load Balancer (Layer 4).
          </li>
          <li>
            <strong className="text-foreground">Kubernetes:</strong> Service load balancing with
            kube-proxy using iptables/IPVS.
          </li>
          <li>
            <strong className="text-foreground">Cloudflare:</strong> Global load balancing with
            geographic routing and health checks.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Best practices</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Use weighted algorithms when servers have different capacities.</li>
          <li>Implement active health checks to detect failures quickly.</li>
          <li>Consider geographic routing for global applications.</li>
          <li>Use Layer 7 for content-based routing and SSL termination.</li>
          <li>Monitor distribution fairness and server utilization.</li>
        </ul>
      </div>
    </>
  );
}

export default function LoadBalancerSimulatorPage() {
  return (
    <SimulatorShell
      slug="load-balancer-simulator"
      educational={<LoadBalancerEducational />}
      shareText="Check out this Load Balancer Algorithm Simulator! Perfect for learning traffic distribution strategies."
    >
      <LoadBalancerSimulator />
    </SimulatorShell>
  );
}
