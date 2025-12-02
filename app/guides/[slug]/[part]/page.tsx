import { GuideContent } from '@/components/guide-content';
import { GuideSidebar } from '@/components/guide-sidebar';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { getGuideBySlug, getAllGuides, getGuidePart } from '@/lib/guides';
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
    const params = [];

    for (const guide of guides) {
      for (const part of guide.parts) {
        params.push({
          slug: guide.slug,
          part: part.slug,
        });
      }
    }

    return params;
  } catch (error) {
    console.warn('Error generating static params for guide parts:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; part: string }>;
}): Promise<Metadata> {
  const { slug, part: partSlug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide) {
    return {};
  }

  const part = guide.parts.find((p) => p.slug === partSlug);

  if (!part) {
    return {};
  }

  const socialImage = getSocialImagePath(slug, 'guides');

  return {
    title: `${part.title} - ${guide.title}`,
    description: part.description || guide.description,
    alternates: {
      canonical: `/guides/${slug}/${partSlug}`,
    },
    openGraph: {
      title: `${part.title} - ${guide.title}`,
      description: part.description || guide.description,
      url: `/guides/${slug}/${partSlug}`,
      type: 'article',
      images: [
        {
          url: socialImage || '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: guide.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${part.title} - ${guide.title}`,
      description: part.description || guide.description,
      images: [socialImage || '/og-image.jpg'],
    },
  };
}

export default async function GuidePartPage({
  params,
}: {
  params: Promise<{ slug: string; part: string }>;
}) {
  // Await the params object to get its properties
  const { slug, part: partSlug } = await params;

  const guide = await getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const partContent = await getGuidePart(slug, partSlug);

  if (!partContent) {
    notFound();
  }

  const currentPart = guide.parts.find((p) => p.slug === partSlug);

  // Find the current part's index and determine previous and next parts
  const currentPartIndex = guide.parts.findIndex((p) => p.slug === partSlug);
  const previousPart = currentPartIndex > 0 ? guide.parts[currentPartIndex - 1] : undefined;
  const nextPart =
    currentPartIndex < guide.parts.length - 1 ? guide.parts[currentPartIndex + 1] : undefined;

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Guides', href: '/guides' },
    { label: guide.title, href: `/guides/${guide.slug}` },
    {
      label: currentPart?.title || 'Part',
      href: `/guides/${guide.slug}/${partSlug}`,
      isCurrent: true,
    },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Guides', url: '/guides' },
    { name: guide.title, url: `/guides/${guide.slug}` },
    {
      name: currentPart?.title || 'Part',
      url: `/guides/${guide.slug}/${partSlug}`,
    },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <ReadingProgressBar />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          {/* Main Content Area */}
          <div className="xl:col-span-9">
            <div className="flex flex-col gap-8 lg:flex-row">
              {/* Guide Navigation Sidebar */}
              <aside className="shrink-0 lg:w-80">
                <GuideSidebar guide={guide} activePart={partSlug} />
              </aside>

              {/* Article Content */}
              <article className="flex-1 min-w-0 prose">
                {currentPart && (
                  <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                      {currentPart.title}
                    </h1>
                    {currentPart.description && (
                      <p className="mt-4 text-xl text-muted-foreground">
                        {currentPart.description}
                      </p>
                    )}
                  </header>
                )}

                <div className="dark:prose-invert max-w-none">
                  <GuideContent content={partContent} />
                </div>

                {/* Navigation buttons */}
                <GuidePartNavigation
                  previousPart={previousPart}
                  nextPart={nextPart}
                  guideSlug={guide.slug}
                />

                {/* Metadata and Tags */}
                <div className="pt-8 mt-8 border-t border-border">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div>
                        <span>Part of: </span>
                        <a
                          href={`/guides/${guide.slug}`}
                          className="font-medium transition-colors text-primary hover:text-primary/80"
                        >
                          {guide.title}
                        </a>
                      </div>

                      {guide.updatedAt && (
                        <div>
                          <span>Updated: {new Date(guide.updatedAt).toLocaleDateString()}</span>
                        </div>
                      )}
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
                </div>

                {/* Report Issue Component */}
                <div className="mt-8">
                  <ReportIssue
                    title={`${currentPart?.title} - ${guide.title}`}
                    type="guide"
                    slug={`${guide.slug}/${partSlug}`}
                    variant="compact"
                  />
                </div>

                {/* Giscus Discussions */}
                <GiscusComments className="mt-12" title={`${currentPart?.title} - ${guide.title}`} />
              </article>
            </div>
          </div>

          {/* Sponsor Sidebar */}
          <aside className="xl:col-span-3">
            <div className="sticky top-8">
              <SponsorSidebar />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
