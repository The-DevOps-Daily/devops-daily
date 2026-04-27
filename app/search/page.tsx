import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPageClient } from '@/components/search-page-client';

export const metadata: Metadata = {
  title: 'Search | DevOps Daily',
  description: 'Search across all DevOps Daily content - posts, guides, quizzes, games, and more.',
  alternates: {
    canonical: '/search',
  },
  openGraph: {
    title: 'Search | DevOps Daily',
    description: 'Search across all DevOps Daily content - posts, guides, quizzes, games, and more.',
    type: 'website',
    url: '/search',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Search',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Search | DevOps Daily',
    description: 'Search across all DevOps Daily content - posts, guides, quizzes, games, and more.',
    images: ['/og-image.png'],
  },
};

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-10 bg-muted rounded w-full max-w-xl mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    }>
      <SearchPageClient />
    </Suspense>
  );
}
