'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Mail, ArrowRight, Heart } from 'lucide-react';

/**
 * Hero block on /newsletters/welcome. Two visual states driven by the
 * `?unsubscribed=1` query param:
 *
 *  - default: subscription confirmed. Big "you're in" moment.
 *  - unsubscribed: gentle "sorry to see you go" with a re-subscribe link.
 *
 * The same route handles both flows so smtpfast only needs to know one
 * URL on the sender side: it's the confirmation redirect target for new
 * subscribers, and the `User.unsubscribeRedirectUrl` (with
 * ?unsubscribed=1 appended automatically by the smtpfast handler) for
 * opt-outs.
 */
export function WelcomeHero() {
  const searchParams = useSearchParams();
  const unsubscribed = searchParams.get('unsubscribed') === '1';

  if (unsubscribed) {
    return <UnsubscribedHero />;
  }
  return <SubscribedHero />;
}

function SubscribedHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/[0.06] via-background to-background">
      <div className="container mx-auto px-4 py-20 sm:py-24 max-w-3xl text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-6">
          <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          You&apos;re subscribed.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Thanks for confirming. Your first issue lands Monday morning — a
          weekly roundup of the new posts, tools, comparisons, and learning
          resources we shipped that week.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/posts"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Read latest posts
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/newsletters"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Mail className="h-4 w-4" />
            Browse the archive
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Didn&apos;t mean to subscribe? Use the unsubscribe link in any issue
          and you&apos;re out. No hard feelings.
        </p>
      </div>
    </section>
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
          You&apos;re unsubscribed.
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
            Re-subscribe here
          </Link>
          . If something specific drove the unsubscribe, we&apos;d genuinely
          like to know — reply to any old issue or open an issue on{' '}
          <a
            href="https://github.com/The-DevOps-Daily/devops-daily"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            GitHub
          </a>
          .
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Back to devops-daily.com
          </Link>
          <Link
            href="/newsletters"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="h-4 w-4" />
            Browse past issues
          </Link>
        </div>
      </div>
    </section>
  );
}
