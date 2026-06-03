import type { Metadata } from 'next';
import CloudRegionFailureSimulator from '@/components/games/cloud-region-failure-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cloud-region-failure-simulator');
}

function CloudRegionFailureEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this cloud failure simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How multi-AZ architecture limits blast radius during infrastructure failures</li>
            <li>Why spare capacity matters when one availability zone disappears</li>
            <li>How database failover affects writes, connections, and application retries</li>
            <li>Why retry storms can amplify an incident instead of healing it</li>
            <li>How queues absorb spikes but can hide user-visible latency</li>
            <li>Why cache outages can move sudden pressure to databases and shared APIs</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Failure modes covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">AZ outage:</strong> one zone fails while traffic
              shifts to surviving zones
            </li>
            <li>
              <strong className="text-foreground">DB failover:</strong> writer loss, replica
              promotion, and reconnect behavior
            </li>
            <li>
              <strong className="text-foreground">Retry storm:</strong> retries, saturation, and
              circuit breaker tradeoffs
            </li>
            <li>
              <strong className="text-foreground">Backlog and cache loss:</strong> asynchronous
              delay, cache miss pressure, and graceful degradation
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why 3D?</h4>
        <p className="text-sm text-muted-foreground">
          Failure domains are spatial. Seeing traffic, compute, queues, databases, and replicas
          distributed across availability zones makes blast radius and failover tradeoffs easier to
          reason about than a flat checklist.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This simulator does not connect to a cloud account. It models regional architecture,
          telemetry, traffic flow, and incident response decisions in the browser.
        </p>
      </div>
    </>
  );
}

export default function CloudRegionFailureSimulatorPage() {
  return (
    <SimulatorShell
      slug="cloud-region-failure-simulator"
      fallbackTitle="3D Cloud Region Failure Simulator"
      fallbackDescription="Explore a multi-AZ cloud region in 3D. Trigger outages, database failover, retry storms, queue backlogs, and cache failures while watching traffic, blast radius, latency, and availability change."
      educational={<CloudRegionFailureEducational />}
      shareText="Explore cloud outages in 3D with this interactive Cloud Region Failure Simulator."
    >
      <CloudRegionFailureSimulator />
    </SimulatorShell>
  );
}
