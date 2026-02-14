import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import DevOpsMemes from '@/components/games/devops-memes';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('devops-memes');
}

export default async function DevOpsMemesPage() {
  const game = await getGameById('devops-memes');
  const gameTitle = game?.title || 'You Might Be a DevOps Engineer If...';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/devops-memes', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/devops-memes' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="devops-memes" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center max-w-6xl mx-auto">
          {/* Sponsors */}
          <GameSponsors />

          {/* Game Component */}
          <DevOpsMemes />

          {/* Educational Content */}
          <div className="w-full max-w-4xl mt-16 space-y-8">
            <div className="bg-linear-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20 rounded-xl p-8 border border-orange-200/50 dark:border-orange-700/50">
              <h2 className="text-2xl font-bold mb-6 text-center bg-linear-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Why DevOps Memes Matter
              </h2>

              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-orange-600 dark:text-orange-400">
                    🤝 Community Building
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Shared experiences create bonds. When we laugh about the same struggles - like
                    DNS issues, YAML formatting, or Friday afternoon deployments - we build a sense
                    of community and mutual understanding.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Breaks down barriers between team members</li>
                    <li>• Creates talking points for networking</li>
                    <li>• Helps newcomers feel part of the community</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
                    😌 Stress Relief
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    DevOps can be stressful. Laughing about our challenges helps us cope with the
                    pressure and reminds us that we're not alone in facing these difficulties.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Reduces burnout through humor</li>
                    <li>• Provides perspective on daily challenges</li>
                    <li>• Creates positive team dynamics</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-orange-600 dark:text-orange-400">
                    📚 Educational Value
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Each meme contains a kernel of truth about DevOps practices, tools, or culture.
                    They can spark discussions about best practices and shared learning.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Highlights common antipatterns</li>
                    <li>• Encourages reflection on practices</li>
                    <li>• Makes complex concepts more memorable</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
                    📢 Content Creation
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    These memes are perfect for social media, presentations, and blog posts. They
                    make technical content more engaging and relatable.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Great for conference presentations</li>
                    <li>• Increases social media engagement</li>
                    <li>• Makes technical content accessible</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-6 border border-blue-200/50 dark:border-blue-700/50">
              <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400">
                💡 How to Use These Memes
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Team Building</h4>
                  <p className="text-sm text-muted-foreground">
                    Share in team chat, use as meeting icebreakers, or include in retrospectives to
                    lighten the mood and encourage open discussion.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Social Media</h4>
                  <p className="text-sm text-muted-foreground">
                    Perfect for LinkedIn posts, Twitter threads, or tech blog content. They're
                    highly shareable and relatable to the DevOps community.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Presentations</h4>
                  <p className="text-sm text-muted-foreground">
                    Use as conversation starters in conference talks, training sessions, or team
                    presentations to make technical content more engaging.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Documentation</h4>
                  <p className="text-sm text-muted-foreground">
                    Add humor to runbooks, incident response guides, or team wikis to make
                    documentation more memorable and enjoyable to read.
                  </p>
                </div>
              </div>
            </div>

            {/* Carbon Ads */}
            <div className="max-w-md mx-auto my-8">
              <CarbonAds />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
