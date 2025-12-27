import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import CDNSimulator from '../../../components/games/cdn-simulator';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cdn-simulator');
}

export default async function CDNSimulatorPage() {
  const game = await getGameById('cdn-simulator');
  const gameTitle = game?.title || 'CDN (Content Delivery Network) Simulator';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/cdn-simulator', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/cdn-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            CDN Simulator - Learn Content Delivery Networks & Edge Computing
          </h2>
          {/* Game Component */}
          <CDNSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding Content Delivery Networks (CDN)</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>How CDNs reduce latency with edge servers</li>
                  <li>Cache hit vs cache miss and their impact</li>
                  <li>Geographic distribution of content</li>
                  <li>Origin server protection strategies</li>
                  <li>How distance affects performance</li>
                  <li>Edge computing fundamentals</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Key Benefits</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-green-600">✓ Faster Performance:</strong> Content served from nearest edge
                  </div>
                  <div>
                    <strong className="text-blue-600">✓ Reduced Origin Load:</strong> Fewer requests to origin server
                  </div>
                  <div>
                    <strong className="text-purple-600">✓ Better Reliability:</strong> Redundancy across edge locations
                  </div>
                  <div>
                    <strong className="text-orange-600">✓ Cost Savings:</strong> Lower bandwidth costs
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 mt-6 md:grid-cols-2">
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
                <h3 className="mb-2 text-lg font-semibold">✅ When to Use a CDN</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Global audience with diverse locations</li>
                  <li>• Static content (images, CSS, JavaScript)</li>
                  <li>• Video streaming and media delivery</li>
                  <li>• High-traffic websites</li>
                  <li>• Need for improved performance</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-500/20">
                <h3 className="mb-2 text-lg font-semibold">❌ When to Avoid</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Highly dynamic, personalized content</li>
                  <li>• Small local audience only</li>
                  <li>• Frequently changing content</li>
                  <li>• Very low traffic volume</li>
                  <li>• Security concerns with third-party caching</li>
                </ul>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Pro Tips</h3>
              <ul className="space-y-1 text-sm">
                <li>• Use cache-control headers to optimize caching behavior</li>
                <li>• Implement cache invalidation strategies for updates</li>
                <li>• Monitor cache hit rates to measure effectiveness</li>
                <li>• Use edge functions for dynamic content at the edge</li>
                <li>• Consider multi-CDN strategies for critical applications</li>
                <li>• Optimize asset sizes before caching</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold">Real-World Examples</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-3 border rounded bg-muted/50">
                  <strong>Cloudflare:</strong> 310+ edge locations serving millions of websites
                </div>
                <div className="p-3 border rounded bg-muted/50">
                  <strong>Akamai:</strong> Delivers 15-30% of all web traffic globally
                </div>
                <div className="p-3 border rounded bg-muted/50">
                  <strong>AWS CloudFront:</strong> 450+ points of presence worldwide
                </div>
              </div>
            </div>
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this CDN Simulator! Learn how Content Delivery Networks reduce latency.')}&url=${encodeURIComponent('https://devops-daily.com/games/cdn-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 transition-colors border rounded-lg hover:bg-muted"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/cdn-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 transition-colors border rounded-lg hover:bg-muted"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/cdn-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 transition-colors border rounded-lg hover:bg-muted"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Back to Games */}
          <Link href="/games">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to All Games
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
