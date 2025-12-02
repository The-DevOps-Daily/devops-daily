import { PageHeader } from '@/components/page-header';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { getAllNews } from '@/lib/news';
import Link from 'next/link';
import { OptimizedImage } from '@/components/optimized-image';
import { CalendarDays, TrendingUp, Newspaper } from 'lucide-react';

export const metadata = {
  title: 'DevOps Weekly Digest',
  description:
    'Weekly curated DevOps news digests featuring updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security.',
  alternates: {
    canonical: '/news',
  },
  openGraph: {
    title: 'DevOps Weekly Digest',
    description:
      'Weekly curated DevOps news digests featuring updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security.',
    type: 'website',
    url: '/news',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Weekly Digest',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Weekly Digest',
    description:
      'Weekly curated DevOps news digests featuring updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security.',
    images: ['/og-image.png'],
  },
};

export default async function NewsPage() {
  const news = await getAllNews();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Section */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center p-2.5 bg-primary/10 rounded-full mb-4">
          <Newspaper className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">DevOps Weekly Digest</h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Curated weekly updates from 250+ DevOps sources. AI-powered summaries of the latest in
          Kubernetes, cloud native, CI/CD, and more.
        </p>

        {/* Stats Bar */}
        {news.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">250+ Sources</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                {news.length} {news.length === 1 ? 'Digest' : 'Digests'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Weekly Updates</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* News List */}
        <div className="lg:col-span-9">
          {news.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
                <Newspaper className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">No Digests Yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                The first DevOps Weekly Digest will be published soon. Check back next week for
                curated updates from across the DevOps ecosystem!
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {news.map((digest, index) => {
                return (
                  <article
                    key={digest.slug}
                    className="group relative border rounded-lg overflow-hidden transition-all hover:shadow-lg hover:border-primary/30 bg-card"
                  >
                    <Link href={`/news/${digest.slug}`} className="block">
                      <div className="grid md:grid-cols-3 gap-0">
                        {/* Image */}
                        <div className="relative aspect-video md:aspect-auto overflow-hidden bg-linear-to-br from-muted/50 to-muted flex items-center justify-center p-4">
                          <div className="relative w-full h-full">
                            <OptimizedImage
                              src={digest.image || '/images/placeholder.svg'}
                              alt={digest.title}
                              width={400}
                              height={300}
                              className="object-contain w-full h-full"
                            />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="md:col-span-2 p-5 md:p-6">
                          {/* Meta */}
                          <div className="flex flex-wrap items-center gap-2.5 text-sm mb-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                              <CalendarDays className="w-3 h-3" />
                              Week {digest.week}, {digest.year}
                            </span>
                            {digest.date && (
                              <time
                                dateTime={digest.date}
                                className="text-xs text-muted-foreground"
                              >
                                {new Date(digest.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </time>
                            )}
                          </div>

                          {/* Title */}
                          <h2 className="text-xl md:text-2xl font-bold mb-2.5 group-hover:text-primary transition-colors line-clamp-2">
                            {digest.title}
                          </h2>

                          {/* Excerpt */}
                          {digest.excerpt && (
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                              {digest.excerpt}
                            </p>
                          )}

                          {/* Read More CTA */}
                          <div className="flex items-center gap-2 text-sm text-primary font-medium group-hover:gap-3 transition-all">
                            <span>Read digest</span>
                            <svg
                              className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky top-8 space-y-5">
            {/* About Section */}
            <div className="bg-card border rounded-lg p-5">
              <h3 className="font-semibold text-base mb-2.5">About the Digest</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Weekly AI-curated DevOps news from 250+ trusted sources.
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-muted-foreground text-xs">Kubernetes & Cloud Native</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-muted-foreground text-xs">CI/CD & GitOps</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-muted-foreground text-xs">Security & Compliance</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-muted-foreground text-xs">Infrastructure as Code</span>
                </div>
              </div>
            </div>

            {/* Subscribe Section */}
            <div className="bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-5">
              <h3 className="font-semibold text-base mb-2">Stay Updated</h3>
              <p className="text-xs text-muted-foreground mb-3.5">
                Get weekly digests delivered to your feed reader.
              </p>
              <a
                href="/feed.xml"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium w-full justify-center"
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

            {/* Sponsor */}
            <SponsorSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
