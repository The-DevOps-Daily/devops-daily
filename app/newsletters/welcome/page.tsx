import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getAllNewsletters } from '@/lib/newsletters';
import { Calendar, ArrowRight } from 'lucide-react';
import { WelcomeHero } from './_components/welcome-hero';

export const metadata: Metadata = {
  title: "You're subscribed | DevOps Daily Newsletter",
  description:
    "Thanks for confirming your subscription to the DevOps Daily newsletter. Browse recent issues while you wait for the next one.",
  alternates: { canonical: '/newsletters/welcome' },
  // No follow / no index — this is a flow page that doesn't belong in
  // search results, and indexing it would dilute /newsletters.
  robots: { index: false, follow: false },
};

const RECENT_LIMIT = 6;

export default async function NewsletterWelcomePage() {
  const newsletters = (await getAllNewsletters()).slice(0, RECENT_LIMIT);

  return (
    <div className="min-h-screen">
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-16 max-w-3xl">
            <div className="h-32" />
          </div>
        }
      >
        <WelcomeHero />
      </Suspense>

      {newsletters.length > 0 && (
        <section className="py-12 container mx-auto px-4 mb-16 max-w-3xl">
          <h2 className="text-xl font-semibold mb-1">
            Catch up on recent issues
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            New issues land every Monday. While you wait, here&apos;s what went
            out recently.
          </p>
          <div className="space-y-3">
            {newsletters.map((newsletter) => (
              <Link
                key={newsletter.slug}
                href={`/newsletters/${newsletter.slug}`}
                className="block group"
              >
                <div className="flex items-center gap-4 p-5 rounded-xl border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-semibold group-hover:text-primary transition-colors truncate">
                      {newsletter.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={newsletter.date}>
                        {new Date(newsletter.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/newsletters"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Browse the full archive
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
