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

const stagesJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'DevOps Learning Roadmap',
  description:
    'Staged learning path for DevOps engineers, from fundamentals to advanced platform skills.',
  itemListElement: [
    'Fundamentals',
    'Infrastructure as Code',
    'Containerization & Orchestration',
    'CI/CD Pipelines',
    'Cloud Platforms',
    'Monitoring & Observability',
    'Security & Compliance',
    'Database Management',
    'Continuous Learning',
  ].map((name, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name,
    url: 'https://devops-daily.com/roadmap',
  })),
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(stagesJsonLd) }}
      />
      {children}
    </>
  );
}
