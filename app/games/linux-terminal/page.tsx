import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import LinuxTerminal from '@/components/games/linux-terminal';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { CarbonAds } from '@/components/carbon-ads';

export const metadata: Metadata = {
  title: 'Learn Linux - Interactive Terminal Tutorial | DevOps Daily',
  description:
    'Master essential Linux commands through interactive lessons. Practice pwd, ls, cd, cat, grep, chmod, and more in a simulated terminal environment.',
  alternates: {
    canonical: '/games/linux-terminal',
  },
  openGraph: {
    title: 'Learn Linux - Interactive Terminal Tutorial | DevOps Daily',
    description:
      'Master essential Linux commands through interactive lessons. Practice in a simulated terminal environment.',
    type: 'website',
    url: '/games/linux-terminal',
    images: [
      {
        url: '/images/games/linux-terminal-og.png',
        width: 1200,
        height: 630,
        alt: 'Learn Linux - Interactive Terminal Tutorial',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learn Linux - Interactive Terminal Tutorial | DevOps Daily',
    description:
      'Master essential Linux commands through interactive lessons. Practice in a simulated terminal environment.',
    images: ['/images/games/linux-terminal-og.png'],
  },
};

export default function LinuxTerminalPage() {
  const gameTitle = 'Learn Linux - Interactive Tutorial';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/linux-terminal', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/linux-terminal' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="linux-terminal" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            Learn Linux - Interactive Terminal Tutorial
          </h2>

          {/* Sponsors */}
          <GameSponsors />

         <LinuxTerminal />

         <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
           <h2 className="mb-4 text-2xl font-bold">About This Tutorial</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Navigate the Linux file system with confidence</li>
                  <li>Create, copy, move, and delete files and directories</li>
                  <li>View and search file contents with cat, grep, head, tail</li>
                  <li>Understand and modify file permissions</li>
                  <li>Use pipes and redirection to chain commands</li>
                  <li>Check system resources with df, free, and env</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Key Commands Covered</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-blue-600">Navigation:</strong> pwd, ls, cd
                  </div>
                  <div>
                    <strong className="text-green-600">File Operations:</strong> touch, mkdir, cp, mv, rm
                  </div>
                  <div>
                    <strong className="text-purple-600">Viewing:</strong> cat, head, tail, grep, wc, find
                  </div>
                  <div>
                    <strong className="text-orange-600">System:</strong> whoami, hostname, df, free, env
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Tips for Success</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  • Use the <strong>Up/Down arrow keys</strong> to navigate command history
                </li>
                <li>
                  • Type <strong>help</strong> to see all available commands
                </li>
                <li>
                  • Type <strong>clear</strong> to clear the terminal screen
                </li>
                <li>
                  • Click the <strong>Show Hint</strong> button if you get stuck
                </li>
              </ul>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🎯 Why Learn Linux?</h3>
              <ul className="space-y-1 text-sm">
                <li>• Linux powers over 90% of the world's cloud infrastructure</li>
                <li>• Essential for DevOps, SRE, and backend development roles</li>
                <li>• Foundation for containerization (Docker, Kubernetes)</li>
                <li>• Understanding Linux makes you a more effective developer</li>
              </ul>
            </div>
          </div>

          {/* Carbon Ads */}
          <div className="w-full max-w-md my-8">
            <CarbonAds />
          </div>

          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this tutorial</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Learn Linux commands interactively! Great tutorial for beginners.')}&url=${encodeURIComponent('https://devops-daily.com/games/linux-terminal')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/linux-terminal')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/linux-terminal')}`}
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
