import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// Import the roadmap page components
import JuniorRoadmapPage from '@/app/roadmap/junior/page';
import DevSecOpsRoadmapPage from '@/app/roadmap/devsecops/page';

const validRoadmaps = ['junior', 'devsecops'] as const;
type RoadmapSlug = (typeof validRoadmaps)[number];

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return validRoadmaps.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!validRoadmaps.includes(slug as RoadmapSlug)) {
    return {};
  }

  const metadata: Record<RoadmapSlug, Metadata> = {
    junior: {
      title: 'Junior DevOps Roadmap - Start Your DevOps Journey',
      description:
        'A beginner-friendly roadmap specifically designed for aspiring DevOps engineers. Clear, focused learning path without the overwhelm.',
      alternates: {
        canonical: '/roadmaps/junior',
      },
      openGraph: {
        title: 'Junior DevOps Roadmap - Start Your DevOps Journey',
        description:
          'A beginner-friendly roadmap specifically designed for aspiring DevOps engineers. Clear, focused learning path without the overwhelm.',
        url: 'https://devops-daily.com/roadmaps/junior',
        type: 'website',
        images: [
          {
            url: 'https://devops-daily.com/images/junior-roadmap-og.png',
            width: 1200,
            height: 630,
            alt: 'Junior DevOps Roadmap - Start Your Journey',
          },
        ],
      },
    },
    devsecops: {
      title: 'DevSecOps Roadmap - Security-First DevOps',
      description:
        'Master the integration of security practices into the DevOps pipeline. Learn to build secure, compliant, and resilient systems.',
      alternates: {
        canonical: '/roadmaps/devsecops',
      },
      openGraph: {
        title: 'DevSecOps Roadmap - Security-First DevOps',
        description:
          'Master the integration of security practices into the DevOps pipeline. Learn to build secure, compliant, and resilient systems.',
        url: 'https://devops-daily.com/roadmaps/devsecops',
        type: 'website',
        images: [
          {
            url: 'https://devops-daily.com/images/devsecops-roadmap-og.png',
            width: 1200,
            height: 630,
            alt: 'DevSecOps Roadmap - Security-First DevOps',
          },
        ],
      },
    },
  };

  return metadata[slug as RoadmapSlug];
}

export default async function RoadmapPage({ params }: PageProps) {
  const { slug } = await params;

  if (!validRoadmaps.includes(slug as RoadmapSlug)) {
    notFound();
  }

  // Render the appropriate roadmap component
  switch (slug) {
    case 'junior':
      return <JuniorRoadmapPage />;
    case 'devsecops':
      return <DevSecOpsRoadmapPage />;
    default:
      notFound();
  }
}
