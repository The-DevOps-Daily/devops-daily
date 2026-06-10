import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllChecklists, getChecklistBySlug } from '@/lib/checklists';
import { ChecklistPageClient } from '@/components/checklists/checklist-page-client';
import { PageHero } from '@/components/page-hero';
import { ListChecks } from 'lucide-react';
import { truncateMetaDescription } from '@/lib/meta-description';
import { detailPageMetadata } from '@/lib/metadata-utils';
import { pickRelatedItems } from '@/lib/related-content';
import { BreadcrumbSchema, LearningResourceSchema } from '@/components/schema-markup';
import { RelatedContent } from '@/components/related-content';
import { RelatedAcrossTypes } from '@/components/related-across-types';
import { getRelatedAcrossTypes } from '@/lib/related-cross-type';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateStaticParams() {
  const checklists = await getAllChecklists();
  return checklists.map((checklist) => ({
    slug: checklist.slug,
  }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const resolvedParams = await params;
  const checklist = await getChecklistBySlug(resolvedParams.slug);

  if (!checklist) {
    return {
      title: 'Checklist Not Found',
    };
  }

  return detailPageMetadata({
    path: `/checklists/${resolvedParams.slug}`,
    title: checklist.title,
    socialTitle: `${checklist.title} - The DevOps Daily`,
    description: truncateMetaDescription(checklist.description),
    image: `/images/checklists/${resolvedParams.slug}-og.png`,
    ogType: 'website',
    siteName: 'The DevOps Daily',
    locale: 'en_US',
    twitterHandle: '@TheDevOpsDaily',
  });
}

export default async function ChecklistPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const checklist = await getChecklistBySlug(resolvedParams.slug);

  if (!checklist) {
    notFound();
  }

  // Sibling checklists scored by tag overlap, category, and difficulty so the
  // dedicated detail pages get inbound links from related siblings instead of
  // only from the /checklists index. See lib/related-content.ts.
  const all = await getAllChecklists();
  const related = pickRelatedItems(
    all,
    {
      slug: checklist.slug,
      category: checklist.category,
      tags: checklist.tags,
      difficulty: checklist.difficulty,
    },
    { currentSlug: checklist.slug, limit: 3 },
  );

  // Cross-content-type matches across posts/quizzes/exercises/flashcards/
  // interview-questions for the same topic. Pairs with the within-type
  // "More checklists" block above.
  const crossTypeRelated = await getRelatedAcrossTypes({
    current: {
      type: 'checklist',
      id: checklist.slug,
      category: checklist.category,
      tags: checklist.tags,
      difficulty: checklist.difficulty,
    },
    limit: 3,
  });

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Checklists', url: '/checklists' },
          { name: checklist.title, url: `/checklists/${checklist.slug}` },
        ]}
      />
      <LearningResourceSchema
        title={checklist.title}
        description={checklist.description}
        difficulty={checklist.difficulty}
        estimatedTime={checklist.estimatedTime}
        technologies={checklist.tags}
        url={`/checklists/${checklist.slug}`}
        learningResourceType="checklist"
      />
      <PageHero
        title={checklist.title}
        description={checklist.description}
        icon={ListChecks}
        breadcrumbs={[
          { label: 'Checklists', href: '/checklists' },
          { label: checklist.title },
        ]}
        stats={[
          { label: 'items', value: checklist.items.length },
          { label: checklist.difficulty, value: '' },
          { label: checklist.estimatedTime, value: '' },
        ].filter(s => s.value !== '')}
      />
      <ChecklistPageClient checklist={checklist} />
      {/* Inline ad slot. Sits between the checklist body and the "More
          checklists" cross-links so it lands at a natural reading break
          rather than mid-content. Same pattern across the four slug pages
          we previously had no ad on. */}
      <div className="container mx-auto px-4 pt-8 pb-2">
        <div className="max-w-2xl mx-auto">
          <CarbonAds />
        </div>
      </div>
      {related.length > 0 && (
        <div className="container mx-auto px-4 pb-8">
          <RelatedContent
            title="More checklists"
            items={related.map((c) => ({
              slug: c.slug,
              title: c.title,
              description: c.description,
              href: `/checklists/${c.slug}`,
              label: c.category,
              meta: c.estimatedTime,
            }))}
          />
        </div>
      )}
      {crossTypeRelated.length > 0 && (
        <div className="container mx-auto px-4 pb-16">
          <RelatedAcrossTypes items={crossTypeRelated} />
        </div>
      )}
    </>
  );
}
