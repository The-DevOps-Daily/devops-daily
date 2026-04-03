import { PostsList } from '@/components/posts-list';
import { PostsListWithoutSearch } from '@/components/posts-list-without-search';
import { PageHero } from '@/components/page-hero';
import { FileText } from 'lucide-react';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
import { getAllPosts } from '@/lib/posts';

export const metadata = {
  title: 'All Posts',
  description:
    'Browse all DevOps articles, tutorials, and guides. Stay updated with the latest trends and best practices in DevOps.',
  alternates: {
    canonical: '/posts',
  },
  openGraph: {
    title: 'DevOps Articles - All Posts',
    description:
      'Explore our complete collection of DevOps articles, tutorials, and guides. Stay updated with the latest trends and best practices in DevOps.',
    type: 'website',
    url: '/posts',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Articles',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Articles - All Posts',
    description:
      'Explore our complete collection of DevOps articles, tutorials, and guides. Stay updated with the latest trends and best practices in DevOps.',
    images: ['/og-image.png'],
  },
};

export default async function PostsPage() {
  const posts = await getAllPosts();

  // Split posts to insert sponsor block after first 6 posts
  const postsBeforeSponsor = posts.slice(0, 6);
  const postsAfterSponsor = posts.slice(6);

  return (
    <div>
      <PageHero
        title="All Posts"
        description="Browse all our DevOps articles, tutorials, and guides."
        icon={FileText}
        breadcrumbs={[{ label: 'Posts' }]}
        stats={[{ label: 'articles', value: posts.length }]}
      />

      <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 my-8">
        {/* Posts List */}
        <div className="lg:col-span-9">
          <PostsList posts={postsBeforeSponsor} />

          {/* Inline Sponsors */}
          <InlineSponsors variant="banner" className="my-8" />

          <PostsListWithoutSearch posts={postsAfterSponsor} />
        </div>

        {/* Sponsor Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky top-8">
            <SponsorSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
