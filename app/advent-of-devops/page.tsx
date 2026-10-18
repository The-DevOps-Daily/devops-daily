import { getAllAdventDays, getAdventIndex } from '@/lib/advent';
import { PostContent } from '@/components/post-content';
import { InlineSponsors } from '@/components/inline-sponsors';
import { AdventLandingClient } from '@/components/advent-landing-client';
import { AdventHeroProgress } from '@/components/advent-hero-progress';
import { SectionSeparator } from '@/components/section-separator';
import { AdventHero } from '@/components/advent-hero';
import { Github } from '@/components/icons/social-icons';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { ADVENT_YEAR } from '@/lib/advent-schedule';
import { Calendar, Trophy, Target } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

const PAGE_TITLE = `Advent of DevOps ${ADVENT_YEAR} - 25 Day Challenge`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: `Advent of DevOps ${ADVENT_YEAR}: 25 hands-on challenges for Docker, Kubernetes, CI/CD, Terraform, security and monitoring. Free, with a solution for each day.`,
  alternates: {
    canonical: '/advent-of-devops',
  },
  openGraph: {
    type: 'website',
    title: PAGE_TITLE,
    description:
      'Join 25 days of hands-on DevOps challenges covering Docker, Kubernetes, CI/CD, and more.',
    url: '/advent-of-devops',
    images: [
      {
        url: '/images/advent/advent-of-devops-2026.jpg',
        width: 1200,
        height: 630,
        alt: PAGE_TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description:
      'Join 25 days of hands-on DevOps challenges covering Docker, Kubernetes, CI/CD, and more.',
    images: ['/images/advent/advent-of-devops-2026.jpg'],
  },
};

export default async function AdventOfDevOpsPage() {
  const days = await getAllAdventDays();
  const indexContent = await getAdventIndex();

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Advent of DevOps', url: '/advent-of-devops' },
        ]}
      />

      <AdventHero
        label="advent-of-devops"
        dates={`December 1-25, ${ADVENT_YEAR}`}
        name="Advent of DevOps"
        year={ADVENT_YEAR}
        description="Level up your DevOps skills with 25 days of hands-on challenges. One task a day through December, covering Docker, Kubernetes, CI/CD, security, monitoring, and more."
        stats={[
          { icon: Calendar, text: '25 days' },
          { icon: Trophy, text: 'Hands-on tasks' },
          { icon: Target, text: 'Real-world skills' },
        ]}
        cta={{ href: '#challenges', label: 'Start Challenge' }}
        progress={<AdventHeroProgress />}
      />

      {/* Introduction Section */}
      {indexContent && (
        <div className="container mx-auto px-4 py-8">
          <SectionSeparator command="cat intro.md" />
          <div className="max-w-4xl mx-auto prose dark:prose-invert">
            <PostContent content={indexContent.content} />
          </div>
        </div>
      )}

      {/* Challenges Grid with Progress Tracking */}
      <div id="challenges">
        <div className="container mx-auto px-4">
          <SectionSeparator command="ls /advent-of-devops/days" />
        </div>
        <AdventLandingClient days={days} />
      </div>

      {/* Sponsors */}
      <div className="container mx-auto px-4 py-8">
        <InlineSponsors variant="banner" />
      </div>

      {/* Sister event */}
      <div className="container mx-auto px-4">
        <p className="mx-auto max-w-4xl text-center text-muted-foreground">
          Prefer SQL? Try{' '}
          <Link href="/advent-of-postgres" className="font-medium text-primary hover:underline">
            Advent of Postgres
          </Link>
          : 24 SQL puzzles, one a day from 1 to 24 December, on a free Postgres database in your
          browser.
        </p>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-md border bg-primary/5 px-8 py-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to Start Your Journey?</h2>
            <p className="text-muted-foreground mb-6">
              Join the community and share your progress with{' '}
              <a
                href="https://x.com/thedevopsdaily"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                @thedevopsdaily
              </a>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/advent-of-devops/day-1"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Trophy className="h-4 w-4" strokeWidth={1.5} />
                Start Day 1
              </Link>
              <a
                href="https://github.com/The-DevOps-Daily/devops-daily"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border hover:border-primary/50 hover:bg-muted/30 font-medium transition-colors"
              >
                <Github className="h-4 w-4" strokeWidth={1.5} />
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
