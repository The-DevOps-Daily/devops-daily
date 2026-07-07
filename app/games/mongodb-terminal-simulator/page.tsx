import type { Metadata } from 'next';
import MongodbTerminalSimulator from '@/components/games/mongodb-terminal-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('mongodb-terminal-simulator');
}

const seoLearningPoints = [
  'Read documents with find() and filter them with a query document',
  'Return only the fields you need with a projection',
  'Compare values with $lt, $gt, $gte, $lte, and match a set with $in',
  'Shape a cursor with sort, skip, and limit for ordering and pagination',
  'Count matches with countDocuments without pulling the documents back',
  'Write data with insertOne, updateOne, and deleteMany and read the results',
  'Summarise documents with an aggregation pipeline: $match, $group, and $sort',
  'Test yourself in Challenge mode by writing queries from a plain-English prompt',
];

function MongodbEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this MongoDB simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How find() reads documents and how a query document filters them</li>
            <li>How projections return only the fields you want, and how _id behaves</li>
            <li>How operators like $lt, $gt, $in, $and, and $or express conditions</li>
            <li>How sort, skip, and limit order and paginate a cursor</li>
            <li>How countDocuments answers &quot;how many&quot; without returning the documents</li>
            <li>How insertOne, updateOne, and deleteMany change data and what they return</li>
            <li>How the aggregation pipeline groups and summarises with $match, $group, and $sort</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key operations covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Read:</strong> find, findOne, query documents,
              projections, dot-notation fields
            </li>
            <li>
              <strong className="text-foreground">Filter:</strong> $eq, $ne, $lt, $gt, $gte, $lte,
              $in, $nin, $exists, $and, $or
            </li>
            <li>
              <strong className="text-foreground">Shape:</strong> sort, skip, limit, countDocuments
            </li>
            <li>
              <strong className="text-foreground">Aggregate:</strong> $match, $group with $sum and
              $avg, $sort, $project, $count
            </li>
            <li>
              <strong className="text-foreground">Write:</strong> insertOne, insertMany, updateOne,
              updateMany, deleteOne, deleteMany
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">How the playground runs your queries</h4>
        <p className="text-sm text-muted-foreground">
          Every command runs live in your browser against three small collections (customers,
          products, orders), evaluated by a lightweight query and aggregation engine. Nothing is sent
          to a server, so you can experiment freely. The data mirrors the SQL simulator&apos;s tables,
          so you can compare how the same records look as documents versus rows.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Practice on a real MongoDB</h4>
        <p className="text-sm text-muted-foreground">
          A simulator builds intuition fast, but running these against a real database makes them
          stick. You can spin up a free cluster on{' '}
          <a
            href="https://www.mongodb.com/products/platform/atlas-database"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            MongoDB Atlas
          </a>{' '}
          or run managed MongoDB on{' '}
          <a
            href="https://m.do.co/c/2a9bba940f39"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            DigitalOcean
          </a>{' '}
          (new accounts get $200 in credits), then paste the same commands into <code>mongosh</code> to
          run them for real.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Prefer SQL, or want to compare?</h4>
        <p className="text-sm text-muted-foreground">
          The{' '}
          <a
            href="https://devops-daily.com/games/sql-terminal-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            SQL Terminal Simulator
          </a>{' '}
          uses the same e-commerce data as tables, so you can see the exact difference between a
          document find() and a SQL SELECT. The{' '}
          <a
            href="https://devops-daily.com/games/dbms-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            Database Types Simulator
          </a>{' '}
          explains when a document database is the right tool in the first place.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn MongoDB this way?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Document queries click fastest when you can change a filter and see the documents change.</li>
          <li>find(), projections, and the aggregation pipeline cover most day-to-day MongoDB work.</li>
          <li>Reading real results builds the instinct you need for app code, debugging, and interviews.</li>
        </ul>
      </div>
    </>
  );
}

export default function MongodbTerminalSimulatorPage() {
  return (
    <SimulatorShell
      slug="mongodb-terminal-simulator"
      fallbackTitle="MongoDB Terminal Simulator"
      fallbackDescription="Practice MongoDB queries in an interactive browser terminal. Learn find, projections, query operators, sort, skip, limit, countDocuments, writes, and the aggregation pipeline against a small e-commerce dataset."
      educational={<MongodbEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Practice MongoDB in a browser with this interactive MongoDB Terminal Simulator, from find() and projections to the aggregation pipeline."
    >
      <MongodbTerminalSimulator />
    </SimulatorShell>
  );
}
