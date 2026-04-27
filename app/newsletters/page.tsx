import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllNewsletters } from '@/lib/newsletters';
import { Mail, Calendar, ArrowRight } from 'lucide-react';
import { PageHero } from '@/components/page-hero';

export const metadata: Metadata = {
  title: 'Newsletter Archive | DevOps Daily',
  description:
    'Browse past issues of the DevOps Daily newsletter. Weekly roundups of new content, tools, and learning resources for DevOps engineers.',
  alternates: { canonical: '/newsletters' },
  openGraph: {
    title: 'Newsletter Archive - DevOps Daily',
    description:
      'Browse past issues of the DevOps Daily newsletter.',
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

export default async function NewslettersPage() {
  const newsletters = await getAllNewsletters();

  return (
    <div className="min-h-screen">
      <PageHero
        icon={Mail}
        title="Newsletter Archive"
        description="Every week we send a roundup of new content, tools, and learning resources. Browse past issues or subscribe to get the next one in your inbox."
        breadcrumbs={[{ label: 'Newsletter Archive' }]}
      >
        <a
          href="https://devops-daily.us2.list-manage.com/subscribe?u=d1128776b290ad8d08c02094f&id=fd76a4e93f"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Subscribe to Newsletter
        </a>
      </PageHero>

      {/* Newsletter List */}
      <section className="py-8 container mx-auto px-4 mb-16 max-w-3xl">
        {newsletters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No newsletters yet. The first issue is coming soon!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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
                      {new Date(newsletter.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
