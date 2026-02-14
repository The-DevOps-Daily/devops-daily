import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import RateLimitSimulator from '../../../components/games/rate-limit-simulator';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('rate-limit-simulator');
}

export default async function RateLimitSimulatorPage() {
  const game = await getGameById('rate-limit-simulator');
  const gameTitle = game?.title || 'Rate Limit Simulator';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/rate-limit-simulator', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/rate-limit-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="rate-limit-simulator" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Rate Limit Simulator - Learn API Rate Limiting & Backoff Strategies
          </h2>

          {/* Sponsors */}
          <GameSponsors />

          {/* Game Component */}
          <RateLimitSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Rate Limiting</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>How rate limiting protects APIs from abuse</li>
                  <li>Different backoff strategies and when to use them</li>
                  <li>Reading and understanding rate limit headers</li>
                  <li>Handling HTTP 429 responses gracefully</li>
                  <li>Optimizing request patterns for better throughput</li>
                  <li>Real-world API rate limiting examples</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Backoff Strategies</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-green-600">Fixed Delay:</strong> Simple but can cause
                    thundering herd
                  </div>
                  <div>
                    <strong className="text-blue-600">Linear Backoff:</strong> Predictable increase
                    in delay
                  </div>
                  <div>
                    <strong className="text-purple-600">Exponential Backoff:</strong> Rapidly
                    reduces load on servers
                  </div>
                  <div>
                    <strong className="text-orange-600">Jittered Exponential:</strong> Prevents
                    synchronized retries
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Pro Tips</h3>
              <ul className="space-y-1 text-sm">
                <li>• Always implement exponential backoff with jitter for production systems</li>
                <li>• Monitor rate limit headers to anticipate throttling before it happens</li>
                <li>• Use circuit breakers to prevent cascading failures</li>
                <li>• Consider different rate limits for different user tiers (free vs paid)</li>
              </ul>
            </div>
          </div>


          {/* Carbon Ads */}
          <div className="w-full max-w-md my-8">
            <CarbonAds />
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this Rate Limit Simulator! Perfect for learning API throttling and backoff strategies.')}&url=${encodeURIComponent('https://devops-daily.com/games/rate-limit-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/rate-limit-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/rate-limit-simulator')}`}
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
