import { notFound } from 'next/navigation';
import { getComparisonBySlug, getAllComparisons } from '@/lib/comparisons';
import { ComparisonPageClient } from '@/components/comparisons/comparison-page-client';
import { BreadcrumbSchema, ArticleSchema } from '@/components/schema-markup';
import { truncateMetaDescription } from '@/lib/meta-description';
import { detailPageMetadata } from '@/lib/metadata-utils';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  const comparisons = await getAllComparisons();
  return comparisons.map((comparison) => ({
    slug: comparison.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comparison = await getComparisonBySlug(slug);

  if (!comparison) {
    return {};
  }

  return detailPageMetadata({
    path: `/comparisons/${comparison.slug}`,
    title: `${comparison.toolA.name} vs ${comparison.toolB.name}: Feature Comparison, Pros/Cons, and Verdict`,
    description: truncateMetaDescription(comparison.description),
    image: `/images/comparisons/${comparison.slug}-og.png`,
    imageAlt: `${comparison.toolA.name} vs ${comparison.toolB.name}`,
  });
}

export default async function ComparisonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [comparison, allComparisons] = await Promise.all([
    getComparisonBySlug(slug),
    getAllComparisons(),
  ]);

  if (!comparison) {
    notFound();
  }

  // Breadcrumb items for schema
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Comparisons', url: '/comparisons' },
    { name: `${comparison.toolA.name} vs ${comparison.toolB.name}`, url: `/comparisons/${comparison.slug}` },
  ];

  // FAQ schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: comparison.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <ArticleSchema
        title={`${comparison.toolA.name} vs ${comparison.toolB.name}`}
        description={comparison.description}
        publishedDate={comparison.createdDate}
        modifiedDate={comparison.updatedDate}
        url={`/comparisons/${comparison.slug}`}
        articleSection={comparison.category}
        keywords={comparison.tags}
        wordCount={comparison.introduction.split(/\s+/).length}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <ComparisonPageClient comparison={comparison} allComparisons={allComparisons} />
    </>
  );
}
