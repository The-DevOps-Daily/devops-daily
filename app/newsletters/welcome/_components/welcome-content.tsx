'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
  ArrowRight,
  Newspaper,
  GitCompare,
  Terminal,
  Brain,
  ListChecks,
  BookOpen,
  Rss,
  Github,
  Heart,
} from 'lucide-react';

/**
 * Welcome / unsubscribe landing rendered on /newsletters/welcome.
 *
 * Two states, picked from `?unsubscribed=1`:
 *   - default — subscription confirmed. Sets expectations, shows what
 *     a typical issue looks like, points the reader at the highest-
 *     value evergreen content. Deliberately does *not* duplicate the
 *     /newsletters chronological archive — the goal is to give a brand
 *     new subscriber the best things to read first, not a list.
 *   - unsubscribed — gentle goodbye. Surfaces the other channels they
 *     can still follow (RSS / GitHub) and a path to give feedback.
 *
 * Lives in /newsletters/welcome rather than /newsletters because it is
 * a transactional landing page: noindex'd, intentionally not part of
 * the archive's URL tree for indexing. SMTPfast points both the
 * confirmation redirect and the unsubscribeRedirectUrl at this single
 * route.
 */
export function WelcomeContent() {
  const searchParams = useSearchParams();
  const unsubscribed = searchParams.get('unsubscribed') === '1';

  return unsubscribed ? <UnsubscribedView /> : <SubscribedView />;
}

// --- subscribed -----------------------------------------------------------

function SubscribedView() {
  return (
    <>
      <SubscribedHero />
      <WhatToExpect />
      <InsideAnIssue />
      <StartHere />
      <FollowElsewhere />
    </>
  );
}

function SubscribedHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/[0.06] via-background to-background">
      <div className="container mx-auto px-4 py-20 sm:py-24 max-w-3xl text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-6">
          <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          You&apos;re in. Welcome to DevOps Daily.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Every Monday morning you&apos;ll get a roundup of new posts, tools,
          comparisons, and hands-on exercises we shipped that week. First
          issue lands the next Monday on the calendar.
        </p>
      </div>
    </section>
  );
}

function WhatToExpect() {
  const items = [
    {
      icon: Clock,
      title: 'Mondays, ~5 minutes',
      copy: 'One email a week, written to be skim-friendly. Scan the section headers, click what catches your eye, close.',
    },
    {
      icon: Terminal,
      title: 'Real DevOps content',
      copy: 'Blog posts, hands-on exercises, comparisons, weekly news digest, quizzes, flashcards. No generic listicles.',
    },
    {
      icon: ShieldCheck,
      title: 'No spam, easy out',
      copy: 'One email a week, that is it. Unsubscribe link in the footer and in your mail client header. One click, done.',
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-2">What to expect</h2>
      <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
        Quick honest summary of what hits your inbox.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(({ icon: Icon, title, copy }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card/50 p-5"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15 mb-3">
              <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {copy}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Mirrors the section types in newsletter-sender/src/template.ts so the
// reader sees the same labels + accent colours they'll see in the actual
// issue. Stays in sync visually with the email itself.
const ISSUE_SECTIONS: Array<{
  icon: typeof Newspaper;
  label: string;
  copy: string;
  accent: string;
  ring: string;
  text: string;
}> = [
  {
    icon: Newspaper,
    label: 'Blog Posts',
    copy: 'New write-ups from the past week. Always practical, never sponsored.',
    accent: 'bg-blue-500/10',
    ring: 'ring-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  {
    icon: Rss,
    label: 'News Digest',
    copy: 'Curated DevOps news for the week: CVEs, releases, incidents, conferences.',
    accent: 'bg-rose-500/10',
    ring: 'ring-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
  },
  {
    icon: GitCompare,
    label: 'Comparisons',
    copy: 'Side-by-side comparisons of competing DevOps tools. Honest verdicts, no fence-sitting.',
    accent: 'bg-indigo-500/10',
    ring: 'ring-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    icon: BookOpen,
    label: 'Guides',
    copy: 'In-depth guides covering one topic end to end. Updated as things change.',
    accent: 'bg-pink-500/10',
    ring: 'ring-pink-500/20',
    text: 'text-pink-600 dark:text-pink-400',
  },
  {
    icon: Terminal,
    label: 'Hands-on Exercises',
    copy: 'Step-by-step exercises you can run on your laptop. SSH, Docker, Kubernetes, Terraform.',
    accent: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    icon: Brain,
    label: 'Quizzes + Flashcards',
    copy: 'Test what you know. Useful for interview prep or just keeping the fundamentals sharp.',
    accent: 'bg-violet-500/10',
    ring: 'ring-violet-500/20',
    text: 'text-violet-600 dark:text-violet-400',
  },
];

function InsideAnIssue() {
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <h2 className="text-2xl font-bold text-center mb-2">
          What&apos;s in each issue
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
          Every Monday issue has some mix of the sections below — whatever
          shipped on the site that week.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ISSUE_SECTIONS.map(
            ({ icon: Icon, label, copy, accent, ring, text }) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${accent} ${ring}`}
                  >
                    <Icon className={`h-4.5 w-4.5 ${text}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {copy}
                    </p>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

// Hand-picked starter content — distinct from the chronological /newsletters
// archive on purpose. A brand-new subscriber should land on the best
// stuff first, not "here is what we shipped this month."
const STARTER_LINKS: Array<{
  title: string;
  copy: string;
  href: string;
  cta: string;
}> = [
  {
    title: 'The DevOps Survival Guide',
    copy: 'A book covering everything from your first on-call to running a platform team. Free to read on the site.',
    href: '/books/devops-survival-guide',
    cta: 'Open the guide',
  },
  {
    title: 'DevOps Roadmaps',
    copy: 'Structured learning paths for Kubernetes, AWS, Terraform, Linux, and more. Pick one, follow it end to end.',
    href: '/roadmaps',
    cta: 'See the roadmaps',
  },
  {
    title: 'Tool Comparisons',
    copy: 'Side-by-side breakdowns of competing tools — Snyk vs Trivy, Grafana vs Kibana, Loki vs Splunk, and dozens more.',
    href: '/comparisons',
    cta: 'Browse comparisons',
  },
  {
    title: 'Hands-on Exercises',
    copy: 'Run real Linux, Docker, Kubernetes, and Terraform exercises in your terminal. Each one ships with a solution.',
    href: '/exercises',
    cta: 'Start an exercise',
  },
];

function StartHere() {
  return (
    <section className="container mx-auto px-4 py-16 max-w-5xl">
      <h2 className="text-2xl font-bold text-center mb-2">
        Start here while you wait
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
        Four jumping-off points. None of them are paywalled.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STARTER_LINKS.map(({ title, copy, href, cta }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {copy}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {cta}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FollowElsewhere() {
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12 max-w-3xl text-center">
        <h2 className="text-lg font-semibold text-foreground">
          The newsletter is one of a few ways to follow along
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If email is not your thing, here are the others.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/rss.xml"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Rss className="h-4 w-4" />
            RSS feed
          </Link>
          <a
            href="https://github.com/The-DevOps-Daily/devops-daily"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Github className="h-4 w-4" />
            Star on GitHub
          </a>
          <Link
            href="/newsletters"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="h-4 w-4" />
            Newsletter archive
          </Link>
        </div>
      </div>
    </section>
  );
}

// --- unsubscribed ---------------------------------------------------------

function UnsubscribedView() {
  return (
    <>
      <UnsubscribedHero />
      <UnsubscribedAlternates />
      <UnsubscribedFeedback />
    </>
  );
}

function UnsubscribedHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-muted/40 via-background to-background">
      <div className="container mx-auto px-4 py-20 sm:py-24 max-w-3xl text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border mb-6">
          <Heart className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          You&apos;re unsubscribed. Travel safe.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          We&apos;ve removed you from the DevOps Daily newsletter. No more
          Monday issues, no follow-ups, no nothing. Thanks for reading while
          you did.
        </p>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
          Changed your mind?{' '}
          <Link
            href="/newsletters#subscribe"
            className="text-primary hover:underline font-medium"
          >
            Re-subscribe in two seconds
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

function UnsubscribedAlternates() {
  const items = [
    {
      icon: Rss,
      title: 'RSS feed',
      copy: 'New posts in your reader the moment they ship. Same content, no inbox.',
      href: '/rss.xml',
      cta: 'Grab the feed',
    },
    {
      icon: Github,
      title: 'GitHub',
      copy: 'The site is open source. Star the repo to get release pings, or open issues if you spot something.',
      href: 'https://github.com/The-DevOps-Daily/devops-daily',
      cta: 'Open the repo',
      external: true,
    },
    {
      icon: BookOpen,
      title: 'Just the site',
      copy: 'No emails, no subscriptions — just bookmark devops-daily.com and check in when you feel like it.',
      href: '/',
      cta: 'Back to the site',
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-2">
        Other ways to keep up
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
        Email is one channel. If you still want the content, three others
        give you the same thing without the inbox.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(({ icon: Icon, title, copy, href, cta, external }) => {
          const inner = (
            <>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15 mb-3">
                <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {copy}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                {cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </>
          );
          return external ? (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
            >
              {inner}
            </a>
          ) : (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function UnsubscribedFeedback() {
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Mind telling us what drove the unsubscribe?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Two minutes of honest feedback is worth more to us than the
          subscriber count. Reply to any old issue, or open a GitHub issue
          and tag it{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            newsletter-feedback
          </code>
          . We read every one.
        </p>
        <div className="mt-5">
          <a
            href="https://github.com/The-DevOps-Daily/devops-daily/issues/new?labels=newsletter-feedback&title=Newsletter+feedback"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <ListChecks className="h-4 w-4" />
            Open a feedback issue
          </a>
        </div>
      </div>
    </section>
  );
}
