import React from 'react';
import type { Metadata } from 'next';
import { toJsonLd } from '@/lib/json-ld';
import { juniorStages } from '@/lib/roadmap-junior-data';

export const metadata: Metadata = {
  title: { absolute: 'Junior DevOps Roadmap - Start Your DevOps Journey' },
  description:
    'A beginner-friendly roadmap specifically designed for aspiring DevOps engineers. Clear, focused learning path without the overwhelm.',
  alternates: {
    canonical: '/roadmap/junior',
  },
  openGraph: {
    title: 'Junior DevOps Roadmap - Start Your DevOps Journey',
    description:
      'A beginner-friendly roadmap specifically designed for aspiring DevOps engineers. Clear, focused learning path without the overwhelm.',
    url: 'https://devops-daily.com/roadmap/junior',
    type: 'website',
    images: [
      {
        url: 'https://devops-daily.com/images/pages/roadmap-junior.jpg',
        width: 1200,
        height: 630,
        alt: 'Junior DevOps Roadmap - Start Your Journey',
      },
    ],
  },
  twitter: {
    title: 'Junior DevOps Roadmap - Start Your DevOps Journey',
    description:
      'A beginner-friendly roadmap specifically designed for aspiring DevOps engineers. Clear, focused learning path without the overwhelm.',
    card: 'summary_large_image',
    images: [
      {
        url: 'https://devops-daily.com/images/pages/roadmap-junior.jpg',
        width: 1200,
        height: 630,
        alt: 'Junior DevOps Roadmap - Start Your Journey',
      },
    ],
  },
  keywords: [
    'Junior DevOps',
    'DevOps for Beginners',
    'Entry Level DevOps',
    'DevOps Career Start',
    'Learning DevOps',
    'DevOps First Steps',
    'Beginner DevOps Roadmap',
    'Getting Started with DevOps',
  ],
  authors: [
    {
      name: 'DevOps Daily',
      url: 'https://devops-daily.com',
    },
  ],
};

const stagesJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Junior DevOps Roadmap',
  description:
    'Five-stage learning path for a first DevOps role, from Linux and Git to containers, CI/CD and the cloud.',
  itemListElement: juniorStages.map((stage, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: stage.title,
    url: `https://devops-daily.com/roadmap/junior#stage-${stage.id}`,
  })),
};

export default function JuniorRoadmapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(stagesJsonLd) }}
      />
      {children}
    </>
  );
}
