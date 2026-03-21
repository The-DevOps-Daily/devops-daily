import { CategoryGrid } from '@/components/category-grid';
import FeaturedPosts from '@/components/featured-posts';
import { Hero } from '@/components/hero';
import LatestPosts from '@/components/latest-posts';
import LatestGuides from '@/components/latest-guides';
import FeaturedExercises from '@/components/featured-exercises';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:
    'DevOps Daily - Tutorials, Guides, Exercises & News for DevOps Engineers',
  description:
    'Learn DevOps with hands-on tutorials, comprehensive guides, interactive exercises, quizzes, and weekly news. Covering Docker, Kubernetes, Terraform, CI/CD, and more.',
  openGraph: {
    title:
      'DevOps Daily - Tutorials, Guides, Exercises & News for DevOps Engineers',
    description:
      'Learn DevOps with hands-on tutorials, comprehensive guides, interactive exercises, quizzes, and weekly news. Covering Docker, Kubernetes, Terraform, CI/CD, and more.',
    url: '/',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'DevOps Daily - Tutorials, Guides, Exercises & News for DevOps Engineers',
    description:
      'Learn DevOps with hands-on tutorials, comprehensive guides, interactive exercises, quizzes, and weekly news.',
    images: ['/og-image.png'],
  },
};

export default async function Home() {
  return (
    <div className="container px-4 py-8 mx-auto">
      <Hero />
      <CategoryGrid
        className="my-16"
        limit={8}
        showHeader
        showViewAll
        gridClassName="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      />
      <FeaturedPosts className="my-16" />
      <FeaturedExercises className="my-16" />
      <LatestPosts className="my-16" />
      <LatestGuides className="my-16" />
    </div>
  );
}
