import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DevOps Roadmaps - Learning Paths for Every Level',
  description:
    'Explore structured DevOps learning paths. From junior engineers to security specialists, find the roadmap that fits your career goals.',
  alternates: {
    canonical: '/roadmaps',
  },
  openGraph: {
    title: 'DevOps Roadmaps - Learning Paths for Every Level',
    description:
      'Explore structured DevOps learning paths. From junior engineers to security specialists, find the roadmap that fits your career goals.',
    url: 'https://devops-daily.com/roadmaps',
    type: 'website',
    images: [
      {
        url: 'https://devops-daily.com/images/roadmaps-og.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Roadmaps - Learning Paths',
      },
    ],
  },
  twitter: {
    title: 'DevOps Roadmaps - Learning Paths for Every Level',
    description:
      'Explore structured DevOps learning paths. From junior engineers to security specialists, find the roadmap that fits your career goals.',
    card: 'summary_large_image',
    images: [
      {
        url: 'https://devops-daily.com/images/roadmaps-og.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Roadmaps - Learning Paths',
      },
    ],
  },
  keywords: [
    'DevOps Roadmaps',
    'DevOps Learning Paths',
    'Junior DevOps',
    'DevSecOps',
    'DevOps Career',
    'Learning DevOps',
    'DevOps Skills',
  ],
};

export default function RoadmapsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
