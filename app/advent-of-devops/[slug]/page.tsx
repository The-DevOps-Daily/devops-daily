import { AdventPostContent } from '@/components/advent-post-content';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
import { OptimizedImage } from '@/components/optimized-image';
import { AdventDayClient } from '@/components/advent-day-client';
import { getAdventDayBySlug, getAllAdventDays, getNextAdventDay, getPreviousAdventDay } from '@/lib/advent';
import { notFound } from 'next/navigation';
import { ArticleSchema, BreadcrumbSchema } from '@/components/schema-markup';
import { ReadingProgressBar } from '@/components/reading-progress-bar';
import { ReportIssue } from '@/components/report-issue';
import { GiscusComments } from '@/components/giscus-comments';
import { getSocialImagePath } from '@/lib/image-utils';
import { Calendar, Clock, Trophy, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const days = await getAllAdventDays();
    return days.map((day) => ({
      slug: day.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for advent:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const day = await getAdventDayBySlug(slug);

  if (!day) {
    return {};
  }

  const socialImage = getSocialImagePath(slug, 'advent');

  return {
    title: day.title,
    description: day.excerpt || day.description,
    alternates: {
      canonical: `/advent-of-devops/${day.slug}`,
    },
    openGraph: {
      type: 'article',
      title: day.title,
      description: day.excerpt || day.description,
      url: `/advent-of-devops/${day.slug}`,
      images: [
        {
          url: socialImage || day.image || '/og-image.png',
          width: 1200,
          height: 630,
          alt: day.title,
        },
      ],
      publishedTime: day.publishedAt,
      modifiedTime: day.updatedAt,
      section: 'Advent of DevOps',
      tags: day.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: day.title,
      description: day.excerpt || day.description,
      images: [socialImage || day.image || '/og-image.png'],
    },
  };
}

export default async function AdventDayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const day = await getAdventDayBySlug(slug);

  if (!day) {
    notFound();
  }

  const nextDay = await getNextAdventDay(day.day);
  const previousDay = await getPreviousAdventDay(day.day);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Advent of DevOps', url: '/advent-of-devops' },
    { name: `Day ${day.day}`, url: `/advent-of-devops/${day.slug}` },
  ];

  const shareUrl = `https://devops-daily.com/advent-of-devops/${day.slug}`;
  const shareText = `I just completed ${day.title} from Advent of DevOps! 🎄`;

  return (
    <>
      <ArticleSchema
        title={day.title}
        description={day.excerpt || day.description || ''}
        publishedDate={day.publishedAt || new Date().toISOString()}
        modifiedDate={day.updatedAt || new Date().toISOString()}
        imageUrl={day.image || '/og-image.png'}
        authorName="DevOps Daily"
        url={`/advent-of-devops/${day.slug}`}
      />
      <BreadcrumbSchema items={breadcrumbItems} />
      <ReadingProgressBar />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <main className="lg:col-span-9">
            <article className="max-w-4xl">
              {/* Header */}
              <header className="mb-8">
                {/* Day Badge */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-linear-to-r from-red-500 to-green-500 text-white">
                    <Calendar className="h-4 w-4" />
                    Day {day.day} of 25
                  </div>
                  {day.difficulty && (
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        day.difficulty === 'Beginner'
                          ? 'bg-green-500/10 text-green-500'
                          : day.difficulty === 'Intermediate'
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {day.difficulty}
                    </span>
                  )}
                  {day.category && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {day.category}
                    </span>
                  )}
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                  {day.title}
                </h1>

                {day.excerpt && (
                  <p className="text-xl text-muted-foreground mb-6">{day.excerpt}</p>
                )}

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {day.publishedAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(day.publishedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    Challenge
                  </div>
                </div>

                {day.image && (
                  <div className="mt-8 rounded-lg overflow-hidden border border-border">
                    <OptimizedImage
                      src={day.image}
                      alt={day.title}
                      width={1200}
                      height={630}
                      priority
                      className="w-full"
                    />
                  </div>
                )}
              </header>

              {/* Content */}
              <div className="prose dark:prose-invert max-w-none">
                <AdventPostContent content={day.content} />
              </div>

              {/* Completion Button */}
              <AdventDayClient day={day.day} title={day.title} />

              {/* Social Sharing Call-to-Action */}
              <div className="mt-12 p-6 rounded-xl bg-linear-to-br from-primary/10 via-background to-blue-500/10 border border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Share2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      Completed this challenge? Share your success!
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Tag{' '}
                      <a
                        href="https://x.com/thedevopsdaily"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        @thedevopsdaily
                      </a>{' '}
                      on X (Twitter) and share your learning journey with the community!
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=AdventOfDevOps,DevOps,Day${day.day}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Share on X
                      </a>
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Share on LinkedIn
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inline Sponsors */}
              <InlineSponsors variant="full" className="my-12" />

              {/* Report Issue */}
              <div className="mt-12 pt-8 border-t" id="article-end">
                <ReportIssue type="post" slug={day.slug} title={day.title} variant="compact" />
              </div>

              {/* Giscus Discussions */}
              <GiscusComments className="mt-12" title={day.title} />

              {/* Navigation */}
              <div className="mt-12 pt-8 border-t border-border">
                <div className="flex items-center justify-between gap-4">
                  {previousDay ? (
                    <Link
                      href={`/advent-of-devops/${previousDay.slug}`}
                      className="group flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                      <div className="text-left">
                        <div className="text-xs text-muted-foreground">Previous</div>
                        <div className="font-medium">Day {previousDay.day}</div>
                      </div>
                    </Link>
                  ) : (
                    <div />
                  )}

                  <Link
                    href="/advent-of-devops"
                    className="px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium"
                  >
                    All Days
                  </Link>

                  {nextDay ? (
                    <Link
                      href={`/advent-of-devops/${nextDay.slug}`}
                      className="group flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Next</div>
                        <div className="font-medium">Day {nextDay.day}</div>
                      </div>
                      <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            </article>
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="sticky top-8 space-y-6">
              <SponsorSidebar />

              {/* Tags */}
              {day.tags && day.tags.length > 0 && (
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {day.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
