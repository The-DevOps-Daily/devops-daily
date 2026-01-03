import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import GenericQuiz from '@/components/games/generic-quiz';
import { getQuizById } from '@/lib/quiz-loader';
import { ReportIssue } from '@/components/report-issue';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('git-quiz');
}

export default async function GitQuizPage() {
  const game = await getGameById('git-quiz');
  const gameTitle = game?.title || 'Git Command Quiz';

  // Load the Git quiz configuration
  const quizConfig = await getQuizById('git-quiz');

  if (!quizConfig) {
    notFound();
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/git-quiz', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/git-quiz' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center max-w-6xl mx-auto">
          {/* Page H1 heading for SEO and accessibility */}
          <h1 className="sr-only">Git Command Quiz</h1>

          {/* Quiz Component */}
          <GenericQuiz quizConfig={quizConfig} />

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this quiz</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Test your Git skills with the Git Command Quiz! Understand merge conflicts, rebasing, and complex Git workflows.')}&url=${encodeURIComponent('https://devops-daily.com/games/git-quiz')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/git-quiz')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/git-quiz')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>

          {/* Game Info */}
          <div className="w-full p-6 my-4 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">About Git Command Quiz</h2>
            <p className="mb-4">
              The Git Command Quiz is an interactive learning tool designed to help developers
              understand Git through real-world scenarios. Instead of memorizing commands, you'll
              learn by solving practical problems you encounter in everyday development.
            </p>

            <div className="grid gap-6 mt-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  <li>Handling merge conflicts effectively</li>
                  <li>When to use rebase vs merge</li>
                  <li>Cleaning up commit history</li>
                  <li>Stashing and workflow management</li>
                  <li>Advanced Git operations like cherry-picking</li>
                  <li>Undoing mistakes safely</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Difficulty Levels</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>
                      <strong>Beginner:</strong> Basic merging and conflict resolution
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>
                      <strong>Intermediate:</strong> Rebasing, stashing, and workflow optimization
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>
                      <strong>Advanced:</strong> Interactive rebasing and complex scenarios
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Pro Tip</h3>
              <p className="text-sm">
                Each scenario is based on real situations developers face. The explanations help you
                understand not just the
                <em>what</em> but the <em>why</em> behind each Git command, making you a more
                confident developer.
              </p>
            </div>
          </div>

          {/* Report Issue Component */}
          <div className="mt-8">
            <ReportIssue
              title="Git Fundamentals Quiz"
              type="quiz"
              slug="git-quiz"
              variant="compact"
            />
          </div>
        </div>
      </div>
    </>
  );
}
