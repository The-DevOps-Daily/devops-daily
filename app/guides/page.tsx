import { GuidesList } from '@/components/guides-list';
import { PageHero } from '@/components/page-hero';
import { BookOpen } from 'lucide-react';
import { InlineSponsors } from '@/components/inline-sponsors';
import { getAllGuides } from '@/lib/guides';

export const metadata = {
  title: 'Guides',
  description: 'In-depth guides for DevOps professionals',
  alternates: {
    canonical: '/guides',
  },
  openGraph: {
    title: 'DevOps Guides - In-Depth Resources',
    description:
      'Explore comprehensive guides on DevOps practices, tools, and methodologies. Learn about CI/CD, containerization, cloud platforms, and more to enhance your DevOps skills.',
    type: 'website',
    url: '/guides',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Guides',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Guides - In-Depth Resources',
    description: 'Explore comprehensive guides on DevOps practices, tools, and methodologies.',
    images: ['/og-image.png'],
  },
};

export default async function GuidesPage() {
  const guides = await getAllGuides();

  return (
    <div>
      <PageHero
        title="Guides"
        description="In-depth guides for DevOps professionals."
        icon={BookOpen}
        breadcrumbs={[{ label: 'Guides' }]}
        stats={[{ label: 'guides', value: guides.length }]}
      />
      
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Inline Sponsors */}
        <InlineSponsors variant="compact" className="my-8" />
      </div>

      <GuidesList guides={guides} className="my-8" />
    </div>
  );
}
