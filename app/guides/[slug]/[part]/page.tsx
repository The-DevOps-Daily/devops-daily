import { GuideContent } from '@/components/guide-content';
import { GuideSidebar } from '@/components/guide-sidebar';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { guideLayout } from '@/components/guide-layout';
import { getGuideBySlug, getAllGuides, getRelatedGuides, toGuideNav } from '@/lib/guides';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema, TechArticleSchema } from '@/components/schema-markup';
import { tagToSlug } from '@/lib/tag-utils';
import { getLinkableTagSlugs } from '@/lib/tags';
import { ReadingProgressBar } from '@/components/reading-progress-bar';
import { GuidePartNavigation } from '@/components/guide-part-navigation';
import { GuideMobileNav } from '@/components/guide-mobile-nav';
import { ReportIssue } from '@/components/report-issue';
import { GiscusComments } from '@/components/giscus-comments';
import { getSocialImagePath } from '@/lib/image-utils';
import { RelatedPosts } from '@/components/related-posts';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
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
    title: { absolute: `${part.title} - ${guide.title}` },
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

  const currentPart = guide.parts.find((p) => p.slug === partSlug);

  if (!currentPart) {
    notFound();
  }

  // Find the current part's index and determine previous and next parts
  const currentPartIndex = guide.parts.findIndex((p) => p.slug === partSlug);
  const previousPart = currentPartIndex > 0 ? guide.parts[currentPartIndex - 1] : undefined;
  const nextPart =
    currentPartIndex < guide.parts.length - 1 ? guide.parts[currentPartIndex + 1] : undefined;

  const guideNav = toGuideNav(guide);
  const relatedGuides = await getRelatedGuides(guide.slug, guide.category?.slug || '', 3);

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

  const linkableTags = await getLinkableTagSlugs();

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <TechArticleSchema
        title={`${currentPart?.title || 'Part'} - ${guide.title}`}
        description={currentPart?.description || guide.description}
        publishedDate={guide.publishedAt}
        modifiedDate={guide.updatedAt || guide.publishedAt}
        imageUrl={getSocialImagePath(guide.slug, 'guides') || guide.image}
        authorName={guide.author?.name}
        url={`/guides/${guide.slug}/${partSlug}`}
        articleSection={guide.category?.name}
        keywords={guide.tags}
      />
      <ReadingProgressBar />
      <GuideMobileNav guide={guideNav} activePart={partSlug} />

      <div className={guideLayout.container}>
        <Breadcrumb items={breadcrumbItems} />

        <div className={guideLayout.grid}>
          {/* Main Content Area */}
          <div className="min-w-0">
            <div className={guideLayout.row}>
              {/* Guide Navigation Sidebar */}
              <aside className={`hidden lg:block ${guideLayout.nav}`}>
                <GuideSidebar guide={guideNav} activePart={partSlug} />
              </aside>

              {/* Article Content */}
              <article className={guideLayout.article}>
                {currentPart && (
                  <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight break-words md:text-4xl">
                      {currentPart.title}
                    </h1>
                    {currentPart.description && (
                      <p className="mt-4 text-xl text-muted-foreground">
                        {currentPart.description}
                      </p>
                    )}
                  </header>
                )}

                {/* Headings clear the sticky header, plus the chapter bar below lg */}
                <div
                  data-guide-body
                  className="dark:prose-invert max-w-none [&_:is(h2,h3,h4)]:scroll-mt-[calc(var(--site-header-h,5rem)+4rem)] lg:[&_:is(h2,h3,h4)]:scroll-mt-[calc(var(--site-header-h,5rem)+1.5rem)]"
                >
                  <GuideContent content={currentPart.content} />
                </div>

                {/* Navigation buttons */}
                <GuidePartNavigation
                  previousPart={
                    previousPart && {
                      slug: previousPart.slug,
                      title: previousPart.title,
                      number: currentPartIndex,
                    }
                  }
                  nextPart={
                    nextPart && {
                      slug: nextPart.slug,
                      title: nextPart.title,
                      number: currentPartIndex + 2,
                    }
                  }
                  guideSlug={guide.slug}
                />

                {/* Metadata and Tags */}
                <div className="pt-8 mt-8 border-t border-border" id="article-end">
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
                          <span>
                            Updated:{' '}
                            <time dateTime={guide.updatedAt}>
                              {new Date(guide.updatedAt).toLocaleDateString()}
                            </time>
                          </span>
                        </div>
                      )}
                    </div>

                    {guide.tags && guide.tags.length > 0 && (
                      <div className="mt-4">
                        <h3 className="mb-2 text-lg font-semibold">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {guide.tags.map((tag) => {
                            const tagSlug = tagToSlug(tag);
                            const base =
                              'px-3 py-1 text-sm rounded-full bg-secondary text-secondary-foreground';
                            return linkableTags.has(tagSlug) ? (
                              <a
                                key={tag}
                                href={`/tags/${tagSlug}`}
                                className={`${base} transition-colors hover:bg-primary/40 hover:text-primary-foreground`}
                              >
                                {tag}
                              </a>
                            ) : (
                              <span key={tag} className={base}>
                                {tag}
                              </span>
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
                <GiscusComments
                  className="mt-12"
                  title={`${currentPart?.title} - ${guide.title}`}
                />

                {/* Related Guides */}
                {relatedGuides.length > 0 && (
                  <RelatedPosts
                    posts={relatedGuides.map((g) => ({
                      title: g.title,
                      slug: g.slug,
                      date: g.publishedAt || '',
                      readingTime: g.readingTime || '',
                      category: g.category || { name: '', slug: '' },
                    }))}
                    title="Related Guides"
                    linkPrefix="/guides"
                    className="mt-12"
                  />
                )}
              </article>
            </div>
          </div>

          {/* Sponsor Sidebar */}
          <aside className="min-w-0">
            <SponsorSidebar className={guideLayout.sponsors} />
          </aside>
        </div>
      </div>
    </>
  );
}
