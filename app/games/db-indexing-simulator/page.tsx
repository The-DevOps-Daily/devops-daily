import type { Metadata } from 'next';
import DbIndexingSimulator from '../../../components/games/db-indexing-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('db-indexing-simulator');
}

function DbIndexingEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Database Indexes</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">How indexes work</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">B-Tree Structure:</strong> Most common index
              type. Like a book&apos;s index, sorted for fast lookup.
            </li>
            <li>
              <strong className="text-foreground">Index Seek:</strong> With an index, the database
              jumps directly to matching rows (O(log n)).
            </li>
            <li>
              <strong className="text-foreground">Full Table Scan:</strong> Without an index,
              every row must be checked (O(n)).
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Index types</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Single-Column:</strong> Index on one column.
              Great for WHERE clauses on that column.
            </li>
            <li>
              <strong className="text-foreground">Composite:</strong> Index on multiple columns.
              Order matters: (A, B) is not equivalent to (B, A).
            </li>
            <li>
              <strong className="text-foreground">Unique:</strong> Enforces uniqueness and
              provides fast lookups (emails, usernames).
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">When to index</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h5 className="mb-1 font-medium text-sm text-foreground">Good for indexing</h5>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Columns in WHERE clauses</li>
              <li>JOIN columns (foreign keys)</li>
              <li>ORDER BY / GROUP BY columns</li>
              <li>High cardinality (many unique values)</li>
            </ul>
          </div>
          <div>
            <h5 className="mb-1 font-medium text-sm text-foreground">Avoid indexing</h5>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Small tables (&lt;1000 rows)</li>
              <li>Low cardinality (few unique values)</li>
              <li>Frequently updated columns</li>
              <li>Columns rarely used in queries</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Index trade-offs</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Storage:</strong> Indexes use additional disk
            space.
          </li>
          <li>
            <strong className="text-foreground">Write Performance:</strong> INSERTs/UPDATEs are
            slower (index must be updated).
          </li>
          <li>
            <strong className="text-foreground">Maintenance:</strong> Indexes can become
            fragmented over time.
          </li>
          <li>
            <strong className="text-foreground">Over-indexing:</strong> Too many indexes can hurt
            more than help.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function DbIndexingSimulatorPage() {
  return (
    <SimulatorShell
      slug="db-indexing-simulator"
      educational={<DbIndexingEducational />}
      shareText="Check out this Database Indexing Simulator! Learn how indexes speed up SQL queries interactively."
    >
      <DbIndexingSimulator />
    </SimulatorShell>
  );
}
