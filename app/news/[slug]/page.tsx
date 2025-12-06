import { PostContent } from '@/components/post-content';
import { NewsDigestContent } from '@/components/news-digest-content';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
import { OptimizedImage } from '@/components/optimized-image';
import { getNewsBySlug, getAllNews } from '@/lib/news';
import { notFound } from 'next/navigation';
import { ArticleSchema, BreadcrumbSchema } from '@/components/schema-markup';
import { ReadingProgressBar } from '@/components/reading-progress-bar';
import { ReportIssue } from '@/components/report-issue';
import { GiscusComments } from '@/components/giscus-comments';
import { getSocialImagePath } from '@/lib/image-utils';

import type { Metadata } from 'next';

// Disable dynamic params for static export
export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const news = await getAllNews();
    return news.map((digest) => ({
      slug: digest.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for news:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const digest = await getNewsBySlug(slug);

  if (!digest) {
    return {};
  }

  const socialImage = getSocialImagePath(slug, 'news');

  return {
    title: digest.title,
    description: digest.excerpt || digest.summary,
    alternates: {
      canonical: `/news/${digest.slug}`,
    },
    openGraph: {
      type: 'article',
      title: digest.title,
      description: digest.excerpt || digest.summary,
      url: `/news/${digest.slug}`,
      images: [
        {
          url: socialImage || digest.image || '/og-image.png',
          width: 1200,
          height: 630,
          alt: digest.title,
        },
      ],
      publishedTime: digest.publishedAt || digest.date,
      section: 'DevOps News',
    },
    twitter: {
      card: 'summary_large_image',
      title: digest.title,
      description: digest.excerpt || digest.summary,
      images: [socialImage || digest.image || '/og-image.png'],
    },
  };
}

export default async function NewsDigestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const digest = await getNewsBySlug(slug);

  if (!digest) {
    notFound();
  }

  // Breadcrumb items for schema
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'News', url: '/news' },
    { name: digest.title, url: `/news/${digest.slug}` },
  ];

  return (
    <>
      <ReadingProgressBar />
      <ArticleSchema
        title={digest.title}
        description={digest.excerpt || digest.summary || ''}
        publishedDate={digest.publishedAt || digest.date || new Date().toISOString()}
        modifiedDate={digest.date || new Date().toISOString()}
        imageUrl={digest.image || '/og-image.png'}
        authorName="DevOps Daily"
        url={`/news/${digest.slug}`}
      />
      <BreadcrumbSchema items={breadcrumbItems} />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <main className="lg:col-span-9">
            <article className="max-w-4xl">
              {/* Header */}
              <header className="mb-8">
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Week {digest.week}, {digest.year}
                  </span>
                  {digest.date && (
                    <time dateTime={digest.date}>
                      {new Date(digest.date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </time>
                  )}
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-4">{digest.title}</h1>

                {digest.excerpt && (
                  <p className="text-xl text-muted-foreground">{digest.excerpt}</p>
                )}

                {digest.image && (
                  <div className="mt-8 rounded-lg overflow-hidden">
                    <OptimizedImage
                      src={digest.image}
                      alt={digest.title}
                      width={1200}
                      height={630}
                      priority
                      className="w-full"
                    />
                  </div>
                )}
              </header>

              {/* Content */}
              <NewsDigestContent content={digest.content} />

              {/* Inline Sponsors */}
              <InlineSponsors variant="full" className="my-12" />

              {/* Report Issue */}
              <div className="mt-12 pt-8 border-t">
                <ReportIssue type="news" slug={digest.slug} title={digest.title} />
              </div>

              {/* Giscus Discussions */}
              <GiscusComments className="mt-12" title={digest.title} />
            </article>
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="sticky top-8 space-y-6">
              <SponsorSidebar />

              {/* Share Section */}
              <div className="bg-card border rounded-lg p-6">
                <h3 className="font-semibold mb-3">Share this digest</h3>
                <div className="flex gap-2">
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      digest.title
                    )}&url=${encodeURIComponent(
                      `https://devops-daily.com/news/${digest.slug}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    Twitter
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                      `https://devops-daily.com/news/${digest.slug}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
