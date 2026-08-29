import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllNewsletters } from '@/lib/newsletters';
import { ArrowRight, Mail, Newspaper, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { NewsletterForm } from '@/components/footer/newsletter-form';

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
        description="Every week we send a roundup of new content, tools, and learning resources. Browse past issues or subscribe to get the next one in your inbox."
        breadcrumbs={[{ label: 'Newsletter Archive' }]}
        stats={[{ label: 'issues', value: newsletters.length }]}
      />

      <section className="container mx-auto px-4 py-8 mb-16 max-w-5xl">
        {newsletters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No newsletters yet. The first issue is coming soon!
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Latest issue + subscribe, side by side */}
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-stretch">
              <Link href={`/newsletters/${latest.slug}`} className="block group">
                <article className="h-full rounded-2xl border border-primary/25 bg-primary/[0.04] p-6 sm:p-8 transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
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
                    <ul className="space-y-2 mb-6">
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

              <div className="lg:self-center">
                <NewsletterForm
                  source="newsletters_archive"
                  headline="Subscribe to the Newsletter"
                  description="One email every Monday. The week's posts, a simulator worth playing, and nothing else."
                />
              </div>
            </div>

            {/* Past issues */}
            {rest.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Past issues</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {rest.map((newsletter) => (
                    <Link
                      key={newsletter.slug}
                      href={`/newsletters/${newsletter.slug}`}
                      className="block group"
                    >
                      <article className="h-full rounded-xl border border-border p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            Week {newsletter.week}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            <time dateTime={newsletter.date}>{formatDate(newsletter.date)}</time>
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
      </section>
    </div>
  );
}
