import type { Metadata } from 'next';
import Link from 'next/link';
import DatabaseReplicationShardingScaling from '@/components/games/database-replication-sharding-scaling';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('database-replication-sharding-scaling');
}

function DatabaseScalingEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">
        Database replication, sharding, and scaling tradeoffs
      </h3>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-3 text-sm font-semibold">Replication</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Read scale:</strong> replicas can serve read
              traffic, but writes still need coordination.
            </li>
            <li>
              <strong className="text-foreground">Lag:</strong> async replication improves
              throughput but allows stale reads.
            </li>
            <li>
              <strong className="text-foreground">Failover:</strong> losing a primary requires
              promotion, consensus, or quorum behavior.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Sharding</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Write scale:</strong> data is split across
              shards so multiple primaries can accept writes.
            </li>
            <li>
              <strong className="text-foreground">Shard keys:</strong> uneven keys create hot
              spots and scatter/gather queries.
            </li>
            <li>
              <strong className="text-foreground">Rebalancing:</strong> adding shards can move a
              lot of data if the partitioning strategy is poor.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Scaling</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Vertical scaling:</strong> simpler, but
              eventually hits hardware and cost limits.
            </li>
            <li>
              <strong className="text-foreground">Read replicas:</strong> great for read-heavy
              workloads, weak for write-heavy workloads.
            </li>
            <li>
              <strong className="text-foreground">Combined designs:</strong> replicated shards are
              common for large production systems.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Keep learning</h4>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-md border bg-background px-3 py-2 hover:border-primary/50" href="/games/db-indexing-simulator">
            Database indexing simulator
          </Link>
          <Link className="rounded-md border bg-background px-3 py-2 hover:border-primary/50" href="/games/dbms-simulator">
            DBMS simulator
          </Link>
          <Link className="rounded-md border bg-background px-3 py-2 hover:border-primary/50" href="/guides/introduction-to-postgres">
            PostgreSQL guide
          </Link>
        </div>
      </div>
    </>
  );
}

export default function DatabaseReplicationShardingScalingPage() {
  return (
    <SimulatorShell
      slug="database-replication-sharding-scaling"
      educational={<DatabaseScalingEducational />}
      shareText="Try the Database Replication, Sharding & Scaling Simulator on DevOps Daily."
      seoLearningPoints={[
        'Understand when replication helps reads and availability',
        'See why sharding is needed for write scaling',
        'Compare sync and async replication tradeoffs',
        'Explore shard key selection and hot spot behavior',
        'Balance database performance, reliability, and cost',
      ]}
    >
      <DatabaseReplicationShardingScaling />
    </SimulatorShell>
  );
}
