import { GuideContent } from '@/components/guide-content';
import { GuideSidebar } from '@/components/guide-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
import { getGuideBySlug, getAllGuides } from '@/lib/guides';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { tagToSlug } from '@/lib/tag-utils';
import { ReadingProgressBar } from '@/components/reading-progress-bar';
import { GuidePartNavigation } from '@/components/guide-part-navigation';
import { ReportIssue } from '@/components/report-issue';
import { GiscusComments } from '@/components/giscus-comments';
import { getSocialImagePath } from '@/lib/image-utils';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const guides = await getAllGuides();
    return guides.map((guide) => ({
      slug: guide.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for guides:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide) {
    return {};
  }

  const socialImage = getSocialImagePath(slug, 'guides');

  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: `/guides/${slug}`,
    },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `/guides/${slug}`,
      type: 'article',
      images: [
        {
          url: socialImage || guide.image || '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: guide.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.description,
      images: [socialImage || guide.image || '/og-image.jpg'],
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  // Await the params object to get its properties
  const { slug } = await params;

  const guide = await getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const firstPart = guide.parts && guide.parts.length > 0 ? guide.parts[0] : undefined;

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Guides', href: '/guides' },
    { label: guide.title, href: `/guides/${guide.slug}`, isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Guides', url: '/guides' },
    { name: guide.title, url: `/guides/${guide.slug}` },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <ReadingProgressBar />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <aside className="order-last lg:col-span-3 lg:order-first">
            <GuideSidebar guide={guide} />
          </aside>
          <div className="lg:col-span-9">
            <article className="prose dark:prose-invert max-w-none">
              <GuideContent guide={guide} />

              {/* Inline Sponsors */}
              <InlineSponsors variant="full" />

              {/* Add navigation buttons */}
              {firstPart && (
                <GuidePartNavigation
                  nextPart={firstPart}
                  guideSlug={guide.slug}
                  isOverview={true}
                />
              )}

              {/* Add structured data for guide */}
              <div className="pt-8 mt-8 border-t border-border" id="article-end">
                <div className="flex items-center text-sm text-muted-foreground">
                  <span>Last updated: {guide.updatedAt || 'Recently'}</span>
                </div>

                {guide.tags && guide.tags.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-lg font-semibold">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {guide.tags.map((tag) => {
                        const tagSlug = tagToSlug(tag);
                        return (
                          <a
                            key={tag}
                            href={`/tags/${tagSlug}`}
                            className="px-3 py-1 text-sm transition-colors rounded-full bg-secondary text-secondary-foreground hover:bg-primary/40 hover:text-primary-foreground"
                          >
                            {tag}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Report Issue Component */}
              <div className="mt-8">
              <ReportIssue title={guide.title} type="guide" slug={guide.slug} variant="compact" />
            </div>

            {/* Giscus Discussions */}
            <GiscusComments className="mt-12" title={guide.title} />
          </article>
          </div>
        </div>
      </div>
    </>
  );
}
