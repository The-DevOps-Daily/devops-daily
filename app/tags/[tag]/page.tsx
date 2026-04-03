import { PageHero } from '@/components/page-hero';
import { PostsList } from '@/components/posts-list';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { getPostsByTagSlug, getGuidesByTagSlug, getAllTags, getTagBySlug } from '@/lib/tags';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Tags } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface TagPageProps {
  params: Promise<{
    tag: string;
  }>;
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const tagName = await getTagBySlug(tag);

  if (!tagName) {
    return {};
  }

  return {
    title: `${tagName} - DevOps Articles and Tutorials`,
    description: `Browse all articles, tutorials, and guides about ${tagName}. Learn the latest DevOps practices and techniques.`,
    alternates: {
      canonical: `/tags/${tag}`,
    },
    openGraph: {
      title: `${tagName} - DevOps Articles and Tutorials`,
      description: `Browse all articles, tutorials, and guides about ${tagName}. Learn the latest DevOps practices and techniques.`,
      url: `/tags/${tag}`,
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: `${tagName} - DevOps Articles and Tutorials`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tagName} - DevOps Articles and Tutorials`,
      description: `Browse all articles, tutorials, and guides about ${tagName}. Learn the latest DevOps practices and techniques.`,
      images: ['/og-image.png'],
    },
  };
}

// Disable dynamic params for static export
export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const tags = await getAllTags();
    return tags.map((tag) => ({
      tag: tag.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for tags:', error);
    return [];
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const tagName = await getTagBySlug(tag);

  if (!tagName) {
    notFound();
  }

  const posts = await getPostsByTagSlug(tag);
  const guides = await getGuidesByTagSlug(tag);

  if (posts.length === 0 && guides.length === 0) {
    notFound();
  }

  const totalCount = posts.length + guides.length;

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Tags', url: '/tags' },
    { name: tagName, url: `/tags/${tag}` },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <PageHero
        title={tagName}
        description={`Browse all articles, tutorials, and guides about ${tagName}`}
        icon={Tags}
        breadcrumbs={[
          { label: 'Tags', href: '/tags' },
          { label: tagName },
        ]}
        stats={[{ label: 'posts', value: totalCount }]}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-9">
            {guides.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 mt-4">Guides</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {guides.map((guide) => (
                    <Link
                      key={guide.slug}
                      href={`/guides/${guide.slug}`}
                      className="block p-6 bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all"
                    >
                      <h3 className="text-xl font-semibold">{guide.title}</h3>
                      <p className="mt-2 text-muted-foreground">{guide.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {posts.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4 mt-4">Posts</h2>
                <PostsList posts={posts} />
              </div>
            )}
          </div>

          {/* Sponsor Sidebar */}
          <aside className="lg:col-span-3">
            <div className="sticky top-8">
              <SponsorSidebar />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
