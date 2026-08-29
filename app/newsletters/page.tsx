import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllNewsletters } from '@/lib/newsletters';
import { ArrowRight, Mail, Newspaper, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { NewsletterForm } from '@/components/footer/newsletter-form';
import { SponsorSidebar } from '@/components/sponsor-sidebar';

export const metadata: Metadata = {
  title: 'Newsletter Archive',
  description:
    'Browse past issues of the DevOps Daily newsletter. Weekly roundups of new content, tools, and learning resources for DevOps engineers.',
  alternates: { canonical: '/newsletters' },
  openGraph: {
    title: 'Newsletter Archive - DevOps Daily',
    description: 'Browse past issues of the DevOps Daily newsletter.',
    type: 'website',
    url: '/newsletters',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Newsletter Archive',
      },
    ],
  },
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function NewslettersPage() {
  const newsletters = await getAllNewsletters();
  const [latest, ...rest] = newsletters;

  return (
    <div className="min-h-screen">
      <PageHero
        icon={Mail}
        title="Newsletter Archive"
        description="Every Monday we send a roundup of the week's posts, simulators, and learning resources. Browse past issues or subscribe to get the next one."
        breadcrumbs={[{ label: 'Newsletter Archive' }]}
        stats={[
          { label: newsletters.length === 1 ? 'issue' : 'issues', value: newsletters.length },
          { label: 'cadence', value: 'Weekly' },
          { label: 'lands on', value: 'Monday' },
        ]}
        sideContent={
          <div className="w-full max-w-sm">
            <NewsletterForm
              source="newsletters_archive"
              headline="Get the next issue"
              description="One email every Monday. No spam, unsubscribe anytime."
            />
          </div>
        }
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Issues */}
          <div className="lg:col-span-9">
            {newsletters.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No newsletters yet. The first issue is coming soon!
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Latest issue */}
                <Link href={`/newsletters/${latest.slug}`} className="block group">
                  <article className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-6 sm:p-8 transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                        <Sparkles className="w-3.5 h-3.5" />
                        Latest issue
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <time dateTime={latest.date}>{formatDate(latest.date)}</time>
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                      Week {latest.week}, {latest.year}
                    </h2>
                    {latest.intro && (
                      <p className="text-muted-foreground leading-relaxed mb-5 line-clamp-3">
                        {latest.intro}
                      </p>
                    )}
                    {latest.highlights.length > 0 && (
                      <ul className="grid gap-2 sm:grid-cols-2 mb-6">
                        {latest.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-2 text-sm">
                            <Newspaper className="w-4 h-4 mt-0.5 text-primary/70 flex-shrink-0" />
                            <span className="line-clamp-1">{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Read the issue
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </article>
                </Link>

                {/* Past issues */}
                {rest.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                      Past issues
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {rest.map((newsletter) => (
                        <Link
                          key={newsletter.slug}
                          href={`/newsletters/${newsletter.slug}`}
                          className="block group"
                        >
                          <article className="h-full rounded-xl border border-border p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md bg-card">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                Week {newsletter.week}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <time dateTime={newsletter.date}>
                                  {formatDate(newsletter.date)}
                                </time>
                              </span>
                            </div>
                            {newsletter.intro && (
                              <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                                {newsletter.intro}
                              </p>
                            )}
                            {newsletter.highlights.length > 0 && (
                              <ul className="space-y-1 mb-3">
                                {newsletter.highlights.slice(0, 3).map((h) => (
                                  <li
                                    key={h}
                                    className="text-sm text-foreground/80 line-clamp-1 before:content-['•'] before:text-primary/60 before:mr-2"
                                  >
                                    {h}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                              Read issue
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </article>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="sticky top-8 space-y-5">
              <div className="bg-card border rounded-lg p-5">
                <h3 className="font-semibold text-base mb-2.5">What&apos;s inside</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Every issue rounds up the week on DevOps Daily:
                </p>
                <div className="space-y-1.5 text-sm">
                  {[
                    'New posts and deep dives',
                    'Interactive simulators & games',
                    'Guides, quizzes & flashcards',
                    'The weekly news digest',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span className="text-muted-foreground text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border rounded-lg p-5">
                <h3 className="font-semibold text-base mb-2.5">Prefer RSS?</h3>
                <p className="text-xs text-muted-foreground mb-3.5">
                  Everything in the newsletter is also on the site feed.
                </p>
                <a
                  href="/feed.xml"
                  className="inline-flex items-center gap-2 px-3.5 py-2 border border-border rounded-md hover:border-primary/40 hover:text-primary transition-colors text-sm font-medium w-full justify-center"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z" />
                    <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z" />
                  </svg>
                  Subscribe via RSS
                </a>
              </div>

              <SponsorSidebar />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
