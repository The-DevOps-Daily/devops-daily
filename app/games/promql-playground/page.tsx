import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import PromqlPlayground from '../../../components/games/promql-playground';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('promql-playground');
}

export default async function PromqlPlaygroundPage() {
  const game = await getGameById('promql-playground');
  const gameTitle = game?.title || 'Prometheus Query Builder (PromQL Playground)';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/promql-playground', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/promql-playground' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="promql-playground" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Prometheus Query Builder - Learn PromQL Step-by-Step
          </h2>

          {/* Sponsors */}
          <GameSponsors />

          <PromqlPlayground />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Prometheus & PromQL</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">Core Concepts</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-blue-600">Time Series:</strong> A stream of timestamped values identified by a metric name and labels (key-value pairs).
                  </div>
                  <div>
                    <strong className="text-cyan-600">Instant Vector:</strong> A set of time series with one sample per series at a single point in time.
                  </div>
                  <div>
                    <strong className="text-green-600">Range Vector:</strong> A set of time series with multiple samples over a time range (e.g., [5m]).
                  </div>
                  <div>
                    <strong className="text-purple-600">Scalar:</strong> A simple numeric floating point value.
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Common Functions</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-indigo-600">rate():</strong> Calculate per-second rate over a time range (for counters)
                  </div>
                  <div>
                    <strong className="text-pink-600">irate():</strong> Instant rate based on last two samples (more responsive)
                  </div>
                  <div>
                    <strong className="text-teal-600">sum/avg/max/min:</strong> Aggregation operators across multiple series
                  </div>
                  <div>
                    <strong className="text-orange-600">histogram_quantile():</strong> Calculate percentiles from histogram buckets
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Key Concepts</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Counters:</strong> Monotonically increasing values (use rate() or increase())</li>
                <li>• <strong>Gauges:</strong> Values that can go up and down (use directly)</li>
                <li>• <strong>Histograms:</strong> Observations bucketed by value (use histogram_quantile())</li>
                <li>• <strong>Summaries:</strong> Pre-calculated quantiles (use directly, no histogram_quantile())</li>
              </ul>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🎯 Label Matching</h3>
              <ul className="space-y-1 text-sm">
                <li>• <code className="px-1 py-0.5 bg-muted rounded">=</code> Exact match: <code className="px-1 py-0.5 bg-muted rounded">method="GET"</code></li>
                <li>• <code className="px-1 py-0.5 bg-muted rounded">!=</code> Negative match: <code className="px-1 py-0.5 bg-muted rounded">status!="500"</code></li>
                <li>• <code className="px-1 py-0.5 bg-muted rounded">=~</code> Regex match: <code className="px-1 py-0.5 bg-muted rounded">path=~"/api/.*"</code></li>
                <li>• <code className="px-1 py-0.5 bg-muted rounded">!~</code> Negative regex: <code className="px-1 py-0.5 bg-muted rounded">job!~"dev-.*"</code></li>
              </ul>
            </div>
          </div>
          
          {/* Carbon Ads - placed after educational content */}
          <div className="w-full max-w-md mx-auto my-8">
            <CarbonAds />
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md mx-auto my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this playground</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Master Prometheus Query Language with this interactive PromQL Playground!')}&url=${encodeURIComponent('https://devops-daily.com/games/promql-playground')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/promql-playground')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/promql-playground')}`}
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
