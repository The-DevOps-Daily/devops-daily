'use client';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

type SchemaMarkupProps = {
  type: 'WebSite' | 'Article' | 'BlogPosting' | 'BreadcrumbList' | 'FAQPage';
  data: Record<string, unknown>;
};

export function SchemaMarkup({ type, data }: SchemaMarkupProps) {
  // Base schema that all types will extend
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  // Merge the base schema with the provided data
  const schema = { ...baseSchema, ...data };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'DevOps Daily',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.png`,
    },
    description:
      'DevOps Daily is an educational platform providing tutorials, guides, exercises, and news for DevOps engineers.',
    sameAs: [
      'https://github.com/The-DevOps-Daily',
      'https://x.com/thedevopsdaily',
      'https://www.linkedin.com/company/thedevopsdaily',
      'https://www.instagram.com/thedailydevops',
    ],
    knowsAbout: [
      'DevOps',
      'Kubernetes',
      'Docker',
      'Infrastructure as Code',
      'CI/CD',
      'Cloud Computing',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebsiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'DevOps Daily',
    description: 'The latest DevOps news, tutorials, and guides',
    publisher: {
      '@id': ORGANIZATION_ID,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ArticleSchema({
  post,
  title,
  description,
  publishedDate,
  modifiedDate,
  imageUrl,
  authorName,
  url,
}: {
  post?: any;
  title?: string;
  description?: string;
  publishedDate?: string;
  modifiedDate?: string;
  imageUrl?: string;
  authorName?: string;
  url?: string;
}) {
  const siteUrl = SITE_URL;

  // Support both old post object format and new individual props format
  const articleUrl = url ? `${siteUrl}${url}` : `${siteUrl}/posts/${post?.slug}`;
  const articleTitle = title || post?.title;
  const articleDescription = description || post?.excerpt;
  const articleImage = imageUrl
    ? imageUrl.startsWith('http')
      ? imageUrl
      : `${siteUrl}${imageUrl}`
    : post?.image
      ? `${siteUrl}${post.image}`
      : `${siteUrl}/og-image.png`;
  const articlePublished = publishedDate || post?.publishedAt || post?.date;
  const articleModified = modifiedDate || post?.updatedAt || post?.date;
  const articleAuthor = authorName || post?.author?.name || 'DevOps Daily Team';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: articleTitle,
    description: articleDescription,
    image: articleImage,
    datePublished: articlePublished,
    dateModified: articleModified,
    author: {
      '@type': 'Person',
      name: articleAuthor,
    },
    publisher: {
      '@id': ORGANIZATION_ID,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function LearningResourceSchema({
  title,
  description,
  difficulty,
  estimatedTime,
  learningObjectives,
  technologies,
  url,
}: {
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: string;
  learningObjectives: string[];
  technologies: string[];
  url: string;
}) {
  // Convert "75 minutes" -> "PT75M", "2 hours" -> "PT2H"
  const timeMatch = estimatedTime.match(/(\d+)\s*(min|hour|hr)/i);
  const isoDuration = timeMatch
    ? timeMatch[2].toLowerCase().startsWith('h')
      ? `PT${timeMatch[1]}H`
      : `PT${timeMatch[1]}M`
    : `PT${estimatedTime.replace(/\D/g, '')}M`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: title,
    description,
    url: `${SITE_URL}${url}`,
    learningResourceType: 'hands-on exercise',
    educationalLevel: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
    timeRequired: isoDuration,
    teaches: learningObjectives,
    about: technologies.map((tech) => ({
      '@type': 'Thing',
      name: tech,
    })),
    interactivityType: 'active',
    isAccessibleForFree: true,
    inLanguage: 'en',
    provider: {
      '@id': ORGANIZATION_ID,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
  const siteUrl = SITE_URL;

  const itemListElement = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${siteUrl}${item.url}`,
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itemListElement,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
