import { PostContent } from '@/components/post-content';
import { PostHeader } from '@/components/post-header';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
import { OptimizedImage } from '@/components/optimized-image';
import { getPostBySlug, getAllPosts, getRelatedPosts } from '@/lib/posts';
import { notFound, redirect } from 'next/navigation';
import { ArticleSchema, BreadcrumbSchema } from '@/components/schema-markup';
import { RelatedPosts } from '@/components/related-posts';
import { ReadingProgressBar } from '@/components/reading-progress-bar';
import { ReportIssue } from '@/components/report-issue';
import { GiscusComments } from '@/components/giscus-comments';
import { getSocialImagePath } from '@/lib/image-utils';

import type { Metadata } from 'next';

// Disable dynamic params for static export
export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const posts = await getAllPosts();
    return posts.map((post) => ({
      slug: post.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for posts:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {};
  }

  const socialImage = getSocialImagePath(slug, 'posts');

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/posts/${post.slug}`,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `/posts/${post.slug}`,
      images: [
        {
          url: socialImage || post.image || '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      publishedTime: post.publishedAt || post.date,
      modifiedTime: post.updatedAt || post.date,
      authors: post.author ? [`https://devops-daily.com/authors/${post.author.slug}`] : undefined,
      section: post.category?.name,
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [socialImage || post.image || '/og-image.jpg'],
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(post.slug, post.category?.slug || '', 6);

  // Check if post content contains affiliate links
  const affiliatePatterns = [
    'm.do.co',           // DigitalOcean referral
    'amzn.to',           // Amazon short links
    'amazon.com/.*tag=', // Amazon affiliate tags
  ];
  const hasAffiliateLinks = affiliatePatterns.some(pattern =>
    new RegExp(pattern).test(post.content)
  );

  // Split related posts for main section and sidebar
  const mainRelatedPosts = relatedPosts.slice(0, 3);
  const sidebarRelatedPosts = relatedPosts.slice(3, 6);

  // Breadcrumb items for schema
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Posts', url: '/posts' },
    ...(post.category
      ? [{ name: post.category.name, url: `/categories/${post.category.slug}` }]
      : []),
    { name: post.title, url: `/posts/${post.slug}` },
  ];

  return (
    <>
      <ArticleSchema post={post} />
      <BreadcrumbSchema items={breadcrumbItems} />
      <ReadingProgressBar />

      <div className="container px-4 py-8 mx-auto">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <article className="prose dark:prose-invert max-w-none">
              <PostHeader
                post={{
                  ...post,
                  date: post.date || '',
                  readingTime: post.readingTime || '5 min read',
                  category: post.category || { name: '', slug: '' },
                }}
                hasAffiliateLinks={hasAffiliateLinks}
              />
              {/* Post image */}
              {post.image && (
                <div className="relative">
                  <OptimizedImage
                    src={post.image}
                    alt={post.title}
                    width={1200}
                    height={630}
                    className="w-full h-auto"
                  />
                </div>
              )}
              <PostContent content={post.content} />

              {/* Inline Sponsors */}
              <InlineSponsors variant="full" />

              {/* Add structured data for article */}
              <div className="pt-8 mt-8 border-t border-border" id="article-end">
                <div className="flex items-center text-sm text-muted-foreground">
                  <span>Published: {post.date}</span>
                  {post.updatedAt && (
                    <>
                      <span className="mx-2">|</span>
                      <span>Last updated: {post.updatedAt}</span>
                    </>
                  )}
                </div>

                {post.tags && post.tags.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-lg font-semibold">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag) => {
                        const tagSlug = tag.toLowerCase().replace(/\s+/g, '-');
                        return (
                          <a
                            key={tag}
                            href={`/tags/${tagSlug}`}
                            className="px-3 py-1 text-sm transition-colors rounded-full bg-secondary text-secondary-foreground hover:bg-primary/40 hover:text-white"
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
              <ReportIssue title={post.title} type="post" slug={post.slug} variant="compact" />
            </div>

            {/* Giscus Discussions */}
            <GiscusComments className="mt-12" title={post.title} />

            {mainRelatedPosts.length > 0 && (
                <RelatedPosts
                  posts={mainRelatedPosts.map((p) => ({
                    ...p,
                    date: p.date || '',
                    readingTime: p.readingTime || '5 min read',
                    category: p.category || { name: '', slug: '' },
                  }))}
                  className="mt-12"
                />
              )}
            </article>
          </div>
          <aside className="lg:col-span-3">
            <SponsorSidebar relatedPosts={sidebarRelatedPosts} />
          </aside>
        </div>
      </div>
    </>
  );
}
