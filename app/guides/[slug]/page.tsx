import { GuideContent } from '@/components/guide-content';
import { GuideSidebar } from '@/components/guide-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
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
import { ReportIssue } from '@/components/report-issue';
import { GiscusComments } from '@/components/giscus-comments';
import { getSocialImagePath } from '@/lib/image-utils';
import { truncateMetaDescription } from '@/lib/meta-description';
import { detailPageMetadata } from '@/lib/metadata-utils';
import { RelatedPosts } from '@/components/related-posts';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  const guides = await getAllGuides();
  return guides.map((guide) => ({
    slug: guide.slug,
  }));
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

  // Prefer the longer SEO title for the <title> tag and social cards
  // when the frontmatter sets one. Display headings still use guide.title.
  return detailPageMetadata({
    path: `/guides/${slug}`,
    title: guide.seoTitle || guide.title,
    description: truncateMetaDescription(guide.description),
    image: socialImage || guide.image || '/og-image.jpg',
    imageAlt: guide.title,
    article: {
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt || guide.publishedAt,
      section: guide.category?.name,
      tags: guide.tags,
    },
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  // Await the params object to get its properties
  const { slug } = await params;

  const guide = await getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const relatedGuides = await getRelatedGuides(guide.slug, guide.category?.slug || '', 3);

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

  const linkableTags = await getLinkableTagSlugs();

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <TechArticleSchema
        title={guide.title}
        description={guide.description}
        publishedDate={guide.publishedAt}
        modifiedDate={guide.updatedAt}
        imageUrl={getSocialImagePath(guide.slug, 'guides') || guide.image}
        authorName={guide.author?.name}
        url={`/guides/${guide.slug}`}
        articleSection={guide.category?.name}
        keywords={guide.tags}
        partsCount={guide.partsCount}
      />
      <ReadingProgressBar />

      <div className={guideLayout.container}>
        <Breadcrumb items={breadcrumbItems} />

        {/* Same columns as a chapter page, so moving between them does not shift. */}
        <div className={guideLayout.grid}>
          <div className="min-w-0">
            <div className={guideLayout.row}>
              <aside className={`order-last lg:order-first ${guideLayout.nav}`}>
                <GuideSidebar guide={toGuideNav(guide)} />
              </aside>
              <article className={`${guideLayout.article} dark:prose-invert`}>
                <GuideContent guide={guide} />

                {/* Inline Sponsors, where the sponsor column is not shown */}
                <div className="xl:hidden">
                  <InlineSponsors variant="full" />
                </div>

                {/* Add navigation buttons */}
                {firstPart && (
                  <GuidePartNavigation
                    nextPart={{ slug: firstPart.slug, title: firstPart.title, number: 1 }}
                    guideSlug={guide.slug}
                    isOverview={true}
                  />
                )}

                {/* Add structured data for guide */}
                <div className="pt-8 mt-8 border-t border-border" id="article-end">
                  <div className="flex items-center text-sm text-muted-foreground">
                    {guide.updatedAt ? (
                      <span>
                        Last updated: <time dateTime={guide.updatedAt}>{guide.updatedAt}</time>
                      </span>
                    ) : (
                      <span>Last updated: Recently</span>
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

                {/* Report Issue Component */}
                <div className="mt-8">
                  <ReportIssue
                    title={guide.title}
                    type="guide"
                    slug={guide.slug}
                    variant="compact"
                  />
                </div>

                {/* Giscus Discussions */}
                <GiscusComments className="mt-12" title={guide.title} />

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

          <aside className="hidden min-w-0 xl:block">
            <SponsorSidebar stickFrom="xl" />
          </aside>
        </div>
      </div>
    </>
  );
}
