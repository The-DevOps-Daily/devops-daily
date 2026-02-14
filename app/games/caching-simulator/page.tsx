import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import CachingSimulator from '../../../components/games/caching-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('caching-simulator');
}

export default async function CachingSimulatorPage() {
  const game = await getGameById('caching-simulator');
  const gameTitle = game?.title || 'Caching Strategies Simulator';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/caching-simulator', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/caching-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="caching-simulator" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Caching Strategies Simulator - Learn Cache Eviction Policies & Write Strategies
          </h2>

          {/* Sponsors */}
          <GameSponsors />

          {/* Game Component */}
          <CachingSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Caching Strategies</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">Eviction Policies</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-purple-600">LRU (Least Recently Used):</strong> Evicts
                    items not accessed recently. Most common in practice.
                  </div>
                  <div>
                    <strong className="text-blue-600">LFU (Least Frequently Used):</strong> Evicts
                    items accessed least often. Great for identifying hot data.
                  </div>
                  <div>
                    <strong className="text-green-600">FIFO (First In, First Out):</strong> Simple
                    queue-based approach, evicts oldest items first.
                  </div>
                  <div>
                    <strong className="text-orange-600">TTL (Time To Live):</strong> Evicts items
                    based on expiration time. Common for sessions.
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Write Strategies</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-indigo-600">Write-Through:</strong> Writes to cache and
                    database simultaneously. Strong consistency but higher latency.
                  </div>
                  <div>
                    <strong className="text-pink-600">Write-Back:</strong> Writes to cache first,
                    async to database. Better performance but risk of data loss.
                  </div>
                  <div>
                    <strong className="text-teal-600">Write-Around:</strong> Writes directly to
                    database, bypasses cache. Reduces cache pollution.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-purple-50 dark:bg-purple-950/20 border-purple-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Key Concepts</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Hit Rate:</strong> Percentage of requests served from cache (higher is better)</li>
                <li>• <strong>Cache Size:</strong> Balance between memory usage and hit rate</li>
                <li>• <strong>Hot Data:</strong> Frequently accessed items that benefit most from caching</li>
                <li>• <strong>Cache Invalidation:</strong> One of the hardest problems in computer science</li>
              </ul>
            </div>
          </div>

          {/* Carbon Ads */}
          <div className="w-full max-w-md mx-auto my-8">
            <CarbonAds />
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md mx-auto my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this Caching Strategies Simulator! Learn cache eviction policies and write strategies interactively.')}&url=${encodeURIComponent('https://devops-daily.com/games/caching-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/caching-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/caching-simulator')}`}
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
