import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import DbIndexingSimulator from '../../../components/games/db-indexing-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('db-indexing-simulator');
}

export default async function DbIndexingSimulatorPage() {
  const game = await getGameById('db-indexing-simulator');
  const gameTitle = game?.title || 'Database Indexing Simulator';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/db-indexing-simulator', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/db-indexing-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Database Indexing Simulator - Learn How Indexes Speed Up SQL Queries
          </h2>
          {/* Game Component */}
          <DbIndexingSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Database Indexes</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">How Indexes Work</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-emerald-600">B-Tree Structure:</strong> Most common
                    index type. Like a book's index - sorted for fast lookup.
                  </div>
                  <div>
                    <strong className="text-blue-600">Index Seek:</strong> With an index, the
                    database jumps directly to matching rows (O(log n)).
                  </div>
                  <div>
                    <strong className="text-yellow-600">Full Table Scan:</strong> Without an
                    index, every row must be checked (O(n)).
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Index Types</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-purple-600">Single-Column:</strong> Index on one
                    column. Great for WHERE clauses on that column.
                  </div>
                  <div>
                    <strong className="text-pink-600">Composite:</strong> Index on multiple
                    columns. Order matters! (A, B) ≠ (B, A).
                  </div>
                  <div>
                    <strong className="text-teal-600">Unique:</strong> Enforces uniqueness and
                    provides fast lookups (emails, usernames).
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 When to Index</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium text-emerald-700 dark:text-emerald-400">✅ Good for Indexing</h4>
                  <ul className="mt-1 space-y-1 text-sm">
                    <li>• Columns in WHERE clauses</li>
                    <li>• JOIN columns (foreign keys)</li>
                    <li>• ORDER BY / GROUP BY columns</li>
                    <li>• High cardinality (many unique values)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-400">❌ Avoid Indexing</h4>
                  <ul className="mt-1 space-y-1 text-sm">
                    <li>• Small tables (&lt;1000 rows)</li>
                    <li>• Low cardinality (few unique values)</li>
                    <li>• Frequently updated columns</li>
                    <li>• Columns rarely used in queries</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500/20">
              <h3 className="mb-2 text-lg font-semibold">⚠️ Index Trade-offs</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Storage:</strong> Indexes use additional disk space</li>
                <li>• <strong>Write Performance:</strong> INSERTs/UPDATEs are slower (index must be updated)</li>
                <li>• <strong>Maintenance:</strong> Indexes can become fragmented over time</li>
                <li>• <strong>Over-indexing:</strong> Too many indexes can hurt more than help</li>
              </ul>
            </div>
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this Database Indexing Simulator! Learn how indexes speed up SQL queries interactively.')}&url=${encodeURIComponent('https://devops-daily.com/games/db-indexing-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/db-indexing-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/db-indexing-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
