import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import CICDStackGenerator from '../../../components/games/cicd-stack-generator';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cicd-stack-generator');
}

export default async function CICDStackGeneratorPage() {
  const game = await getGameById('cicd-stack-generator');
  const gameTitle = game?.title || 'CI/CD Stack Generator';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/cicd-stack-generator', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/cicd-stack-generator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="cicd-stack-generator" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center max-w-4xl mx-auto">
          {/* Sponsors */}
          <GameSponsors />

          {/* Game Component */}
          <CICDStackGenerator />

          {/* Carbon Ads */}
          <div className="w-full max-w-md mx-auto my-8">
            <CarbonAds />
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md mx-auto my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this game</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Try the CI/CD Stack Generator! Get your perfect (or perfectly cursed) DevOps stack combination!')}&url=${encodeURIComponent('https://devops-daily.com/games/cicd-stack-generator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/cicd-stack-generator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/cicd-stack-generator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>

          {/* "How it works" section */}
          <div className="w-full p-6 my-4 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">How It Works</h2>
            <p className="mb-4">The CI/CD Stack Generator randomly combines:</p>
            <ul className="mb-4 space-y-2 list-disc list-inside">
              <li>
                <strong>CI/CD Tools</strong> like GitHub Actions, Jenkins, GitLab CI
              </li>
              <li>
                <strong>Infrastructure Tools</strong> like Terraform, Ansible, Pulumi
              </li>
              <li>
                <strong>Cloud Platforms</strong> like AWS, GCP, or even a Raspberry Pi!
              </li>
            </ul>
            <p className="mb-4">
              Spin the wheels to get your perfect (or perfectly cursed) DevOps stack! Each
              combination receives a humorous rating that you can share with your team.
            </p>
            <p>
              This is just a fun game, but who knows, you might discover your next favorite tech
              stack!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
