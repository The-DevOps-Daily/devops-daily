import { AdventPostContent } from '@/components/advent-post-content';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
import { AdventDayHeader, AdventDayNav, AdventShareBox } from '@/components/advent-day-parts';
import { AdventDayClient } from '@/components/advent-day-client';
import {
  getAdventDayBySlug,
  getAllAdventDays,
  getNextAdventDay,
  getPreviousAdventDay,
} from '@/lib/advent';
import { notFound } from 'next/navigation';
import { ArticleSchema, BreadcrumbSchema } from '@/components/schema-markup';
import { ReadingProgressBar } from '@/components/reading-progress-bar';
import { ReportIssue } from '@/components/report-issue';
import { GiscusComments } from '@/components/giscus-comments';
import { getSocialImagePath } from '@/lib/image-utils';
import { Clock } from 'lucide-react';

import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  const days = await getAllAdventDays();
  return days.map((day) => ({
    slug: day.slug,
  }));
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
    title: { absolute: day.title },
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
          url: socialImage || day.image || '/og-image.jpg',
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
      images: [socialImage || day.image || '/og-image.jpg'],
    },
  };
}

export default async function AdventDayPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const shareText = `I completed Day ${day.day} of Advent of DevOps: ${day.title.replace(/^Day \d+ - /, '')}`;
  const shownDate = day.updatedAt || day.publishedAt;

  return (
    <>
      <ArticleSchema
        title={day.title}
        description={day.excerpt || day.description || ''}
        publishedDate={day.publishedAt}
        modifiedDate={day.updatedAt || day.publishedAt}
        imageUrl={day.image || '/og-image.jpg'}
        url={`/advent-of-devops/${day.slug}`}
        articleSection={day.category || 'Advent of DevOps'}
        keywords={day.tags}
      />
      <BreadcrumbSchema items={breadcrumbItems} />
      <ReadingProgressBar />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-9">
            <article className="max-w-4xl">
              <AdventDayHeader
                path={`advent-of-devops/${day.slug}`}
                day={day.day}
                total={25}
                difficulty={day.difficulty}
                topics={day.category ? [day.category] : []}
                title={day.title.replace(/^Day \d+ - /, '')}
                excerpt={day.excerpt}
                meta={
                  shownDate && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {day.updatedAt ? 'Updated ' : ''}
                      <time dateTime={shownDate}>
                        {new Date(shownDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </time>
                    </span>
                  )
                }
              />

              {/* Content */}
              <div className="prose dark:prose-invert max-w-none">
                <AdventPostContent content={day.content} />
              </div>

              {/* Completion Button */}
              <AdventDayClient day={day.day} title={day.title} />

              <AdventShareBox
                heading="Completed this challenge? Share it."
                text={shareText}
                url={shareUrl}
                hashtags="AdventOfDevOps,DevOps"
              />

              {/* Inline Sponsors */}
              <InlineSponsors variant="full" className="my-12" />

              {/* Report Issue */}
              <div className="mt-12 pt-8 border-t" id="article-end">
                <ReportIssue type="post" slug={day.slug} title={day.title} variant="compact" />
              </div>

              {/* Giscus Discussions */}
              <GiscusComments className="mt-12" title={day.title} />

              <AdventDayNav
                base="/advent-of-devops"
                prev={previousDay ?? undefined}
                next={nextDay ?? undefined}
              />
            </article>
          </div>

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
