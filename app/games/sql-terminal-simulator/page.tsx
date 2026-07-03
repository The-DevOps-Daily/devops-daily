import type { Metadata } from 'next';
import SqlTerminalSimulator from '@/components/games/sql-terminal-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('sql-terminal-simulator');
}

const seoLearningPoints = [
  'Write SELECT queries and project only the columns you need',
  'Filter rows with WHERE using comparison operators and LIKE',
  'Sort and cap results with ORDER BY, DESC, and LIMIT',
  'Summarise data with count, sum, avg, min, max, GROUP BY, and HAVING',
  'Combine tables with JOINs and keep unmatched rows with LEFT JOIN',
  'Change data with INSERT, UPDATE, and DELETE and read their command tags',
  'Compare rows against a subquery and name subqueries with WITH (CTEs)',
  'Rank rows within groups using window functions',
  'Test yourself in Challenge mode by writing queries from a plain-English prompt',
];

function SqlTerminalEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this SQL simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How SELECT reads rows and how to project specific columns</li>
            <li>How WHERE filters rows with operators like =, &lt;, &gt;, &lt;&gt;, and LIKE</li>
            <li>How ORDER BY, ASC/DESC, and LIMIT shape a result set</li>
            <li>How DISTINCT and the aggregates count, sum, avg, min, and max summarise data</li>
            <li>How GROUP BY buckets rows and HAVING filters those groups</li>
            <li>How JOINs, LEFT JOINs, subqueries, and window functions work across tables</li>
            <li>How INSERT, UPDATE, and DELETE change data, and how CTEs (WITH) name a subquery</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key statements covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Read:</strong> SELECT, SELECT DISTINCT, column
              projection, table.column prefixes, AS aliases
            </li>
            <li>
              <strong className="text-foreground">Filter:</strong> WHERE with AND/OR, comparison
              operators, LIKE, and numeric vs string literals
            </li>
            <li>
              <strong className="text-foreground">Aggregate:</strong> count, sum, avg, min, max,
              round, GROUP BY, HAVING
            </li>
            <li>
              <strong className="text-foreground">Shape:</strong> ORDER BY, LIMIT
            </li>
            <li>
              <strong className="text-foreground">Relate:</strong> JOIN, LEFT JOIN, subqueries, WITH
              (CTEs), and rank() window functions
            </li>
            <li>
              <strong className="text-foreground">Write:</strong> INSERT, UPDATE, DELETE and their
              psql command tags
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">How the playground runs your queries</h4>
        <p className="text-sm text-muted-foreground">
          Single-table SELECT queries are evaluated live in your browser against a small e-commerce
          schema (customers, products, orders, order_items). The guided join, subquery, and window
          lessons return output captured from a real PostgreSQL instance, so the results you see match
          what Postgres actually returns. Nothing is sent to a server, so you can experiment freely.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Practice on real Postgres</h4>
        <p className="text-sm text-muted-foreground">
          A simulator is a great place to build intuition, but running these queries against a real
          database makes them stick. You can{' '}
          <a
            href="https://neon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            spin up a free Postgres in seconds with Neon
          </a>{' '}
          and paste the same queries in to run them for real, or{' '}
          <a
            href="https://m.do.co/c/2a9bba940f39"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            run managed PostgreSQL on DigitalOcean
          </a>{' '}
          (new accounts get $200 in credits). Load a table or two, then re-run the lessons here against
          your own data.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Related reading</h4>
        <p className="mb-2 text-sm text-muted-foreground">
          Once the queries click, these deep dives cover the schema and query patterns that keep a
          Postgres database fast as it grows:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <a
              href="https://devops-daily.com/posts/postgres-18-uuidv7-primary-keys"
              className="font-medium text-primary underline underline-offset-2"
            >
              Stop Using Random UUIDs as Primary Keys
            </a>{' '}
            — why random UUIDs hurt index and primary-key performance, and what to use instead.
          </li>
          <li>
            <a
              href="https://devops-daily.com/posts/stop-paginating-with-offset"
              className="font-medium text-primary underline underline-offset-2"
            >
              Stop Paginating With OFFSET
            </a>{' '}
            — how keyset pagination beats LIMIT/OFFSET as tables get large.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn SQL this way?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>SQL clicks fastest when you can change a query and immediately see the rows change.</li>
          <li>The same handful of clauses (SELECT, WHERE, GROUP BY, JOIN) cover most day-to-day queries.</li>
          <li>Reading real result sets builds the instinct you need for reports, debugging, and interviews.</li>
        </ul>
      </div>
    </>
  );
}

export default function SqlTerminalSimulatorPage() {
  return (
    <SimulatorShell
      slug="sql-terminal-simulator"
      fallbackTitle="SQL Terminal Simulator"
      fallbackDescription="Practice SQL in an interactive browser terminal. Learn SELECT, WHERE, ORDER BY, DISTINCT, aggregates, GROUP BY, HAVING, JOINs, subqueries, and window functions against a small e-commerce schema."
      educational={<SqlTerminalEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Practice SQL in a browser with this interactive SQL Terminal Simulator, from SELECT to JOINs and window functions."
    >
      <SqlTerminalSimulator />
    </SimulatorShell>
  );
}
