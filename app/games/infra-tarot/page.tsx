import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import InfraTarot from '../../../components/games/infra-tarot';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { InlineSponsors } from '@/components/inline-sponsors';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('infra-tarot');
}

export default async function InfraTarotPage() {
  const game = await getGameById('infra-tarot');
  const gameTitle = game?.title || 'Infra Tarot Cards';

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/infra-tarot', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/infra-tarot' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="infra-tarot" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">Infra Tarot Cards - Your Infrastructure Destiny</h2>

          {/* Back to Games */}
          <div className="w-full mb-6">
            
          </div>

         {/* Game Component */}
         <InfraTarot />

          {/* Our Sponsors */}
          <div className="w-full my-8">
            <InlineSponsors variant="full" />
          </div>

          {/* Social Sharing */}
          <div className="w-full max-w-4xl mt-8 p-6 bg-muted/30 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-center">Share the Fun</h2>
            <p className="text-center text-muted-foreground mb-4">
              Enjoyed your tarot reading? Share this mystical infrastructure experience with your
              team!
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="https://twitter.com/intent/tweet?text=Discover%20your%20infrastructure%20destiny%20with%20Infra%20Tarot%20Cards!%20🔮&url=https://devops-daily.com/games/infra-tarot"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <Twitter className="w-4 h-4 mr-2" />
                  Tweet
                </Button>
              </Link>
              <Link
                href="https://www.facebook.com/sharer/sharer.php?u=https://devops-daily.com/games/infra-tarot"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <Facebook className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </Link>
              <Link
                href="https://www.linkedin.com/sharing/share-offsite/?url=https://devops-daily.com/games/infra-tarot&title=Infra%20Tarot%20Cards%20-%20DevOps%20Daily&summary=Discover%20your%20infrastructure%20destiny%20with%20mystical%20tarot%20cards!"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <Linkedin className="w-4 h-4 mr-2" />
                  LinkedIn
                </Button>
              </Link>
            </div>
          </div>

          {/* Related Games */}
          <div className="w-full max-w-4xl mt-8 p-6 bg-muted/30 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-center">More DevOps Games</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/games/devops-scorecard" className="group">
                <div className="p-4 rounded-lg border bg-background hover:shadow-md transition-shadow">
                  <h3 className="font-semibold group-hover:text-primary">DevOps Scorecard</h3>
                  <p className="text-sm text-muted-foreground">
                    Evaluate your DevOps skills across 8 key areas
                  </p>
                </div>
              </Link>
              <Link href="/games/rate-limit-simulator" className="group">
                <div className="p-4 rounded-lg border bg-background hover:shadow-md transition-shadow">
                  <h3 className="font-semibold group-hover:text-primary">Rate Limit Simulator</h3>
                  <p className="text-sm text-muted-foreground">
                    Learn API rate limiting with interactive visualization
                  </p>
                </div>
              </Link>
              <Link href="/games/cicd-stack-generator" className="group">
                <div className="p-4 rounded-lg border bg-background hover:shadow-md transition-shadow">
                  <h3 className="font-semibold group-hover:text-primary">CI/CD Stack Generator</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate custom CI/CD configurations
                  </p>
                </div>
              </Link>
              <Link href="/games/git-quiz" className="group">
                <div className="p-4 rounded-lg border bg-background hover:shadow-md transition-shadow">
                  <h3 className="font-semibold group-hover:text-primary">Git Command Quiz</h3>
                  <p className="text-sm text-muted-foreground">
                    Test your Git knowledge with interactive challenges
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Educational Footer */}
          <div className="w-full max-w-4xl mt-8 p-6 bg-linear-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
            <h2 className="text-xl font-bold mb-4 text-center text-purple-700 dark:text-purple-300">
              The Art of Infrastructure Divination
            </h2>
            <div className="prose prose-sm max-w-none text-center">
              <p className="text-purple-800 dark:text-purple-200">
                While we can't actually predict your infrastructure future through mystical cards,
                this game highlights real DevOps challenges in a fun way. Each card represents
                genuine scenarios that infrastructure teams face, from outages and budget
                constraints to scaling challenges and security concerns.
              </p>
              <p className="text-purple-800 dark:text-purple-200 mt-4">
                The best "fortune telling" for your infrastructure comes from proper monitoring,
                automated testing, infrastructure as code, and following DevOps best practices. But
                sometimes, a little humor helps us cope with the chaos of distributed systems! 🎭
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
