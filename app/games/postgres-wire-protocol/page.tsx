import type { Metadata } from 'next';
import Link from 'next/link';
import PostgresWireProtocolSimulator from '@/components/games/postgres-wire-protocol-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('postgres-wire-protocol');
}

function PostgresWireProtocolEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">How the PostgreSQL wire protocol works</h3>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-3 text-sm font-semibold">Startup</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">SSLRequest:</strong> the client may ask whether
              the server accepts TLS before sending startup parameters.
            </li>
            <li>
              <strong className="text-foreground">StartupMessage:</strong> carries protocol
              version, user, database, and session options.
            </li>
            <li>
              <strong className="text-foreground">ReadyForQuery:</strong> marks the connection as
              safe for the next command.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Query execution</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Simple query:</strong> sends one SQL string and
              receives metadata, rows, completion, and ready state.
            </li>
            <li>
              <strong className="text-foreground">Extended query:</strong> splits work into Parse,
              Bind, Describe, Execute, and Sync.
            </li>
            <li>
              <strong className="text-foreground">COPY:</strong> switches into a streaming mode for
              bulk import or export.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Why it matters</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Connection poolers need transaction state from ReadyForQuery.</li>
            <li>Drivers use RowDescription to decode text and binary values correctly.</li>
            <li>Prepared statements reduce SQL injection risk and can reduce parse overhead.</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Keep learning</h4>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            className="rounded-md border bg-background px-3 py-2 hover:border-primary/50"
            href="/games/database-replication-sharding-scaling"
          >
            Database scaling simulator
          </Link>
          <Link
            className="rounded-md border bg-background px-3 py-2 hover:border-primary/50"
            href="/games/db-indexing-simulator"
          >
            Database indexing simulator
          </Link>
          <Link
            className="rounded-md border bg-background px-3 py-2 hover:border-primary/50"
            href="/comparisons/postgresql-vs-mysql"
          >
            PostgreSQL vs MySQL
          </Link>
        </div>
      </div>
    </>
  );
}

export default function PostgresWireProtocolPage() {
  return (
    <SimulatorShell
      slug="postgres-wire-protocol"
      educational={<PostgresWireProtocolEducational />}
      shareText="Try the PostgreSQL Wire Protocol Simulator on DevOps Daily."
      seoLearningPoints={[
        'Visualize PostgreSQL frontend and backend protocol messages',
        'Understand StartupMessage, AuthenticationSASL, and ReadyForQuery',
        'Compare simple query and extended query protocol flows',
        'See how RowDescription and DataRow messages encode result sets',
        'Learn how COPY streams bulk data over the wire',
      ]}
    >
      <PostgresWireProtocolSimulator />
    </SimulatorShell>
  );
}
