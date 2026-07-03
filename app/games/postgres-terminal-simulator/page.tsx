import type { Metadata } from 'next';
import PostgresTerminalSimulator from '@/components/games/postgres-terminal-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('postgres-terminal-simulator');
}

const seoLearningPoints = [
  'Explore a database with psql meta-commands like \\dt, \\d, \\di, and \\l',
  'Read a real EXPLAIN plan and recognise a sequential scan',
  'Create a B-tree index and watch the plan switch to a bitmap index scan',
  'Compare estimated cost (3971 to 145) and use EXPLAIN ANALYZE for actual rows',
  'Wrap changes in BEGIN and undo them safely with ROLLBACK',
  'Understand why the prompt changes to shop=*# inside an open transaction',
  'Tell psql client meta-commands apart from SQL sent to the Postgres server',
];

function PostgresTerminalEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this PostgreSQL simulator</h3>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        This is a companion to the SQL Terminal Simulator, but it teaches the <em>tool and engine</em>{' '}
        instead of the SQL language. You practice the psql client and how the Postgres planner and
        storage behave: meta-commands, EXPLAIN, indexes, and transactions.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How psql meta-commands (\dt, \d, \di, \l, \conninfo) inspect a database</li>
            <li>How EXPLAIN shows the plan the planner would run, without executing it</li>
            <li>Why a filter with no index becomes a full sequential scan</li>
            <li>How CREATE INDEX turns that scan into a bitmap index scan and cuts the cost</li>
            <li>How EXPLAIN ANALYZE reports actual rows and where time really goes</li>
            <li>How BEGIN, COMMIT, and ROLLBACK make changes safe to undo</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key psql commands</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Explore:</strong> \dt, \d NAME, \di, \l, \conninfo,
              \x, \timing, \?
            </li>
            <li>
              <strong className="text-foreground">Query:</strong> SELECT count(*) FROM orders;,
              SELECT * FROM customers;
            </li>
            <li>
              <strong className="text-foreground">Plan:</strong> EXPLAIN and EXPLAIN ANALYZE on a
              filtered query
            </li>
            <li>
              <strong className="text-foreground">Tune:</strong> CREATE INDEX on the column you filter
              by
            </li>
            <li>
              <strong className="text-foreground">Transact:</strong> BEGIN, DELETE, ROLLBACK, COMMIT
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">How this lab runs</h4>
        <p className="text-sm text-muted-foreground">
          Nothing connects to a real server. The lab models a small e-commerce database (customers,
          products, orders, order_items) plus a 200,000-row big_events table, and every meta-command
          listing, EXPLAIN plan, and psql-aligned table is reproduced from real PostgreSQL output. The
          cost dropping from 3971 to 145 after you add an index is exactly what Postgres reports, so
          the intuition you build here carries straight over to a real database.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Practice on real Postgres</h4>
        <p className="text-sm text-muted-foreground">
          A simulator builds intuition, but running these commands against a live database is what
          makes them stick. You can{' '}
          <a
            href="https://neon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            spin up a free Postgres in seconds with Neon
          </a>{' '}
          and run \dt, EXPLAIN, and transactions for real, or{' '}
          <a
            href="https://m.do.co/c/2a9bba940f39"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            run managed PostgreSQL on DigitalOcean
          </a>{' '}
          (new accounts get $200 in credits). Load a table, run EXPLAIN before and after CREATE INDEX,
          and compare the plans against what you saw here.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn Postgres this way?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>EXPLAIN stops being scary once you have watched a seq scan turn into an index scan.</li>
          <li>Most day-to-day database work is a handful of meta-commands plus reading a plan.</li>
          <li>Knowing that ROLLBACK undoes an open transaction is what makes changes safe to try.</li>
        </ul>
      </div>
    </>
  );
}

export default function PostgresTerminalSimulatorPage() {
  return (
    <SimulatorShell
      slug="postgres-terminal-simulator"
      fallbackTitle="PostgreSQL Terminal Simulator"
      fallbackDescription="Practice the psql tool and Postgres engine in an interactive browser terminal. Learn meta-commands, EXPLAIN plans, indexes, and transactions against a small e-commerce database with verified PostgreSQL output."
      educational={<PostgresTerminalEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Practice psql, EXPLAIN, indexes, and transactions in a browser with this interactive PostgreSQL Terminal Simulator."
    >
      <PostgresTerminalSimulator />
    </SimulatorShell>
  );
}
