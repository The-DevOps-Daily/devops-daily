import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Junior DevOps Roadmap - Start Your DevOps Journey',
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
        url: 'https://devops-daily.com/images/junior-roadmap-og.png',
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
        url: 'https://devops-daily.com/images/junior-roadmap-og.png',
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

export default function JuniorRoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
