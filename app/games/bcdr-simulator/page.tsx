import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import BCDRSimulator from '@/components/games/bcdr-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';
import Image from 'next/image';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('bcdr-simulator');
}

export default async function BCDRSimulatorPage() {
  const game = await getGameById('bcdr-simulator');
  const gameTitle = game?.title || 'Business Continuity & Disaster Recovery Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/bcdr-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/bcdr-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="bcdr-simulator" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            BCDR Simulator - Learn Business Continuity & Disaster Recovery
          </h2>

          {/* Sponsors */}
          <GameSponsors />

          <BCDRSimulator />

          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding BCDR</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>RTO (Recovery Time Objective) and RPO (Recovery Point Objective)</li>
                  <li>Hot, Warm, and Cold disaster recovery sites</li>
                  <li>Backup frequency and data replication strategies</li>
                  <li>Failover automation and manual procedures</li>
                  <li>Cost vs. recovery time trade-offs</li>
                  <li>Real-world disaster scenario planning</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">DR Site Types</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-red-600">Hot Site:</strong> Real-time replication,
                    instant failover - highest cost but minimal downtime
                  </div>
                  <div>
                    <strong className="text-orange-600">Warm Site:</strong> Regular backups,
                    hours to recover - balanced cost and recovery
                  </div>
                  <div>
                    <strong className="text-blue-600">Cold Site:</strong> Basic infrastructure,
                    days to recover - lowest cost but longest downtime
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Key Metrics</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  • <strong>RTO:</strong> Maximum acceptable downtime after a disaster
                </li>
                <li>
                  • <strong>RPO:</strong> Maximum acceptable data loss (how far back your last backup is)
                </li>
                <li>
                  • <strong>MTTR:</strong> Mean Time To Recovery - average time to restore service
                </li>
                <li>
                  • <strong>MTPD:</strong> Maximum Tolerable Period of Disruption
                </li>
              </ul>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🎯 Best Practices</h3>
              <ul className="space-y-1 text-sm">
                <li>• Align DR strategy with business criticality and budget</li>
                <li>• Test failover procedures regularly (at least quarterly)</li>
                <li>• Document runbooks for all disaster scenarios</li>
                <li>• Use geographic diversity for DR sites</li>
                <li>• Automate failover where possible to reduce human error</li>
              </ul>
            </div>
          </div>

          {/* Acronis Affiliate Promotion */}
          <div className="w-full p-6 my-8 rounded-lg border border-blue-500/20 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <a
                href="https://www.jdoqocy.com/click-101674709-10562048"
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="shrink-0"
              >
                <Image
                  src="/acronis.svg"
                  alt="Acronis"
                  width={80}
                  height={80}
                  className="rounded-lg"
                />
              </a>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="mb-2 text-lg font-semibold">Need a Real BCDR Solution?</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  <strong>Acronis Cyber Protect</strong> offers enterprise-grade backup and disaster
                  recovery with anti-ransomware protection. Trusted by 500,000+ businesses worldwide.
                </p>
                <a
                  href="https://www.jdoqocy.com/click-101674709-10562048"
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Learn More About Acronis
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
            <p className="mt-4 text-xs text-center text-muted-foreground/70">
              <em>This page contains an affiliate link. Using it helps support DevOps Daily at no extra cost to you.</em>
            </p>
          </div>

          {/* Carbon Ads */}
          <div className="w-full max-w-md mx-auto my-8">
            <CarbonAds />
          </div>

          <div className="w-full max-w-md mx-auto my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this BCDR Simulator! Learn disaster recovery strategies interactively.')}&url=${encodeURIComponent('https://devops-daily.com/games/bcdr-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/bcdr-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/bcdr-simulator')}`}
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
