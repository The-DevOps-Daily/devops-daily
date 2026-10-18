import { getAllAdventDays, getAdventIndex } from '@/lib/advent';
import { PostContent } from '@/components/post-content';
import { InlineSponsors } from '@/components/inline-sponsors';
import { AdventLandingClient } from '@/components/advent-landing-client';
import { AdventHeroProgress } from '@/components/advent-hero-progress';
import { SectionSeparator } from '@/components/section-separator';
import { Github } from '@/components/icons/social-icons';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { ADVENT_YEAR } from '@/lib/advent-schedule';
import { Calendar, Trophy, Target, ChevronRight } from 'lucide-react';
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
        url: '/images/advent/advent-of-devops.png',
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
    images: ['/images/advent/advent-of-devops.png'],
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

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.09]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />

        <div className="container relative mx-auto px-4 py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-mono text-muted-foreground mb-3">// advent-of-devops</p>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-primary/20 bg-primary/5 text-xs font-mono text-primary mb-6 tabular-nums">
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
              December 1-25, {ADVENT_YEAR}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Advent of DevOps{' '}
              <span className="text-primary relative inline-block">
                {ADVENT_YEAR}
                <svg
                  className="absolute -bottom-2 left-0 w-full h-3 text-primary/40"
                  viewBox="0 0 120 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9 Q15 2 30 8 Q45 1 60 7 Q75 2 90 9 Q105 4 118 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Level up your DevOps skills with 25 days of hands-on challenges. One task a day
              through December, covering Docker, Kubernetes, CI/CD, security, monitoring, and more.
            </p>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-10 font-mono text-sm text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                25 days
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                Hands-on tasks
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                Real-world skills
              </span>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="#challenges"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Start Challenge
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://x.com/thedevopsdaily"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border hover:border-primary/50 hover:bg-muted/30 font-medium transition-colors"
              >
                Follow @thedevopsdaily
              </a>
            </div>

            <AdventHeroProgress />
          </div>
        </div>
      </div>

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
