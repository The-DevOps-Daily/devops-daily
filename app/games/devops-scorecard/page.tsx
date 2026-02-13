import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import DevOpsScorecard from '../../../components/games/devops-scorecard';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('devops-scorecard');
}

export default async function DevOpsScorecardPage() {
  const game = await getGameById('devops-scorecard');
  const gameTitle = game?.title || 'DevOps Scorecard';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/devops-scorecard', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/devops-scorecard' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="devops-scorecard" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          {/* Page H1 heading for SEO and accessibility */}
          <h1 className="sr-only">{gameTitle}</h1>

          {/* Game Component */}
          <DevOpsScorecard />

          {/* Educational Content */}
          <div className="w-full max-w-4xl p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">About the DevOps Scorecard</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">How It Works</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Rate your skills across 8 core DevOps areas</li>
                  <li>Each skill is rated from 1 (Beginner) to 5 (Expert)</li>
                  <li>Get instant feedback and personalized insights</li>
                  <li>Share your results with your team or on social media</li>
                  <li>Track your progress over time</li>
                  <li>Identify areas for professional development</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Skill Categories</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong className="text-blue-600">Foundational:</strong> Linux, networking,
                    scripting, Git
                  </div>
                  <div>
                    <strong className="text-purple-600">Infrastructure as Code:</strong> Terraform,
                    Ansible, Kubernetes
                  </div>
                  <div>
                    <strong className="text-green-600">Cloud Platforms:</strong> AWS, Azure, GCP,
                    multi-cloud
                  </div>
                  <div>
                    <strong className="text-orange-600">CI/CD:</strong> Jenkins, automated testing,
                    deployments
                  </div>
                  <div>
                    <strong className="text-teal-600">Monitoring:</strong> Prometheus, ELK stack,
                    observability
                  </div>
                  <div>
                    <strong className="text-red-600">Security:</strong> Secrets management,
                    compliance
                  </div>
                  <div>
                    <strong className="text-indigo-600">Soft Skills:</strong> Leadership,
                    communication
                  </div>
                  <div>
                    <strong className="text-violet-600">Advanced:</strong> SRE, chaos engineering,
                    service mesh
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Career Development Tips</h3>
              <ul className="space-y-1 text-sm">
                <li>• Use your scorecard to identify skill gaps and create a learning plan</li>
                <li>• Focus on foundational skills before advancing to specialized areas</li>
                <li>• Balance technical skills with soft skills for career growth</li>
                <li>• Consider industry certifications to validate your expertise</li>
                <li>• Share your results to start conversations about career development</li>
              </ul>
            </div>
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this tool</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Just discovered the DevOps Scorecard! Perfect for assessing DevOps skills and planning career development.')}&url=${encodeURIComponent('https://devops-daily.com/games/devops-scorecard')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/devops-scorecard')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/devops-scorecard')}`}
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
