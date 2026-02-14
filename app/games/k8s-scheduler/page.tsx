import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Twitter, Facebook, Linkedin, Activity } from 'lucide-react';
import K8sScheduler from '@/components/games/k8s-scheduler';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { InlineSponsors } from '@/components/inline-sponsors';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('k8s-scheduler');
}

export default async function K8sSchedulerPage() {
  const game = await getGameById('k8s-scheduler');
  const gameTitle = game?.title || 'Kubernetes Scheduler Challenge';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/k8s-scheduler', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/k8s-scheduler' },
  ];

  const shareUrl = 'https://devops-daily.com/games/k8s-scheduler';
  const shareText =
    'Try the Kubernetes Scheduler Challenge! Place Pods onto Nodes while honoring K8s rules. Surprisingly addictive and educational.';

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="k8s-scheduler" gameTitle={gameTitle} />
        </div>
        <div className="flex flex-col items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-4 text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Kubernetes • Scheduling • Interactive</span>
         </div>

         <K8sScheduler />

          {/* Our Sponsors */}
          <div className="w-full my-8">
            <InlineSponsors variant="full" />
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this game</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>

          {/* Back to games */}
        </div>
      </div>
    </>
  );
}
