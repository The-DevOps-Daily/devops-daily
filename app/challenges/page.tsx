import type { Metadata } from 'next';
import { GitPullRequest, ShieldCheck, Swords } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { InlineSponsors } from '@/components/inline-sponsors';
import { ChallengeCard } from '@/components/challenges/challenge-card';
import { getAllChallenges } from '@/lib/challenges';
import { CHALLENGES_REPO_URL } from '@/lib/challenge-types';

const description =
  'Hands-on DevOps challenges in Docker, Bash, Kubernetes, Terraform, Prometheus and PostgreSQL: fix it in your fork, open a pull request, and CI grades it.';

export const metadata: Metadata = {
  title: 'DevOps Challenges: Fix It, Open a PR, Get Graded',
  description,
  alternates: {
    canonical: '/challenges',
  },
  openGraph: {
    title: 'DevOps Challenges | DevOps Daily',
    description,
    url: '/challenges',
    type: 'website',
    images: [
      {
        url: '/images/pages/challenges.jpg',
        width: 1200,
        height: 630,
        alt: 'DevOps Challenges',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Challenges | DevOps Daily',
    description,
    images: ['/images/pages/challenges.jpg'],
  },
};

const steps = [
  {
    title: 'Fork and pick a challenge',
    body: 'Each challenge is a folder in the challenges repository with a brief and a broken or unfinished starter.',
  },
  {
    title: 'Fix it your way',
    body: 'There are no steps to follow. The brief says what has to work and which files you may change.',
  },
  {
    title: 'Open a pull request',
    body: 'A GitHub Actions workflow grades it and comments a result for each check, usually within a few minutes.',
  },
  {
    title: 'Pass every check',
    body: 'Push more commits until everything passes. The PR gets the passed label and is closed. It is never merged.',
  },
];

export default async function ChallengesPage() {
  const challenges = await getAllChallenges();
  const checks = challenges.reduce((total, challenge) => total + challenge.checks.length, 0);

  return (
    <div className="min-h-screen">
      <PageHero
        title="DevOps Challenges"
        accentWord="Challenges"
        description="Fix a real thing, open a pull request, and CI grades it. You get a ticket, not a tutorial."
        icon={Swords}
        breadcrumbs={[{ label: 'Challenges' }]}
        stats={[
          { label: 'challenges', value: challenges.length },
          { label: 'graded checks', value: checks },
        ]}
      />

      <section className="container mx-auto max-w-6xl px-4 py-10">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-lg border border-border bg-card p-5">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </div>
              <h2 className="mb-1 font-semibold">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container mx-auto max-w-6xl px-4 pb-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4">
        <InlineSponsors variant="banner" className="mt-0" />
      </section>

      <section className="container mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-6">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              How grading stays honest
            </div>
            <p className="text-sm text-muted-foreground">
              The tests and the grader always come from the repository&apos;s main branch, never
              from your pull request. Only the challenge&apos;s solution files are copied out of
              your PR, your code runs in a container or a throwaway kind cluster, and some inputs
              are random at grading time, so the checks do not compare against fixed answers you
              could copy.
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-border p-6">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <GitPullRequest className="h-5 w-5 text-primary" aria-hidden="true" />
              Propose a challenge
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Have a broken thing you fixed at work that would make a good challenge? Open a
              proposal on GitHub.
            </p>
            <a
              href={`${CHALLENGES_REPO_URL}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Read CONTRIBUTING.md
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
