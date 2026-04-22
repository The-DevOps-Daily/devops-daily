import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'DevOps Roadmap - Your Path to DevOps Mastery' },
  description:
    'Strategic learning path for aspiring DevOps engineers. Discover the skills, technologies, and career progression from beginner to expert level.',
  alternates: {
    canonical: '/roadmap',
  },
  openGraph: {
    title: 'DevOps Roadmap - Your Path to DevOps Mastery',
    description:
      'Strategic learning path for aspiring DevOps engineers. Discover the skills, technologies, and career progression from beginner to expert level.',
    url: 'https://devops-daily.com/roadmap',
    type: 'website',
    images: [
      {
        url: 'https://devops-daily.com/images/roadmap.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Learning Roadmap - Skills and Technologies Path',
      },
    ],
  },
  twitter: {
    title: 'DevOps Roadmap - Your Path to DevOps Mastery',
    description:
      'Strategic learning path for aspiring DevOps engineers. Discover the skills, technologies, and career progression from beginner to expert level.',
    card: 'summary_large_image',
    images: [
      {
        url: 'https://devops-daily.com/images/roadmap.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Learning Roadmap - Skills and Technologies Path',
      },
    ],
  },
  keywords: [
    'DevOps Roadmap',
    'DevOps Career Path',
    'DevOps Skills Map',
    'DevOps Learning Path',
    'DevOps Engineer Skills',
    'DevOps Technology Stack',
    'DevOps Career Progression',
    'Infrastructure as Code',
    'Cloud Native Technologies',
    'DevOps Fundamentals',
    'Container Orchestration',
    'CI/CD Pipeline',
  ],
  authors: [
    {
      name: 'DevOps Daily',
      url: 'https://devops-daily.com',
    },
  ],
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
