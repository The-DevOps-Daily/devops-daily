import { notFound } from 'next/navigation';
import { getComparisonBySlug, getAllComparisons } from '@/lib/comparisons';
import { ComparisonPageClient } from '@/components/comparisons/comparison-page-client';
import { BreadcrumbSchema, ArticleSchema } from '@/components/schema-markup';
import { truncateMetaDescription } from '@/lib/meta-description';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const comparisons = await getAllComparisons();
    return comparisons.map((comparison) => ({
      slug: comparison.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for comparisons:', error);
    return [];
  }
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

  const title = `${comparison.toolA.name} vs ${comparison.toolB.name}: Feature Comparison, Pros/Cons, and Verdict`;
  const description = truncateMetaDescription(comparison.description);
  const socialImage = `/images/comparisons/${comparison.slug}-og.png`;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: `/comparisons/${comparison.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/comparisons/${comparison.slug}`,
      type: 'article',
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: `${comparison.toolA.name} vs ${comparison.toolB.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
  };
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
