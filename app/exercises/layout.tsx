import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DevOps Exercises & Labs',
  description:
    'Practice real-world DevOps skills with our comprehensive collection of hands-on exercises and labs. From Docker to Kubernetes, CI/CD to Infrastructure as Code.',
  openGraph: {
    title: 'DevOps Exercises & Labs - Hands-On Learning | DevOps Daily',
    description:
      'Practice real-world DevOps skills with our comprehensive collection of hands-on exercises and labs. From Docker to Kubernetes, CI/CD to Infrastructure as Code.',
    url: 'https://devops-daily.com/exercises',
    images: [
      {
        url: '/images/exercises-og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Exercises & Labs - Hands-On Learning',
      },
    ],
  },
  twitter: {
    title: 'DevOps Exercises & Labs - Hands-On Learning | DevOps Daily',
    description:
      'Practice real-world DevOps skills with our comprehensive collection of hands-on exercises and labs.',
    card: 'summary_large_image',
    images: [
      {
        url: '/images/exercises-og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Exercises & Labs - Hands-On Learning',
      },
    ],
  },
  keywords: [
    'DevOps Exercises',
    'Hands-On Labs',
    'Docker Exercises',
    'Kubernetes Labs',
    'CI/CD Practice',
    'Infrastructure as Code',
    'DevOps Learning',
    'Interactive Tutorials',
    'DevOps Skills',
    'Technical Exercises',
    'DevOps Practice',
    'Real-World Scenarios',
  ],
  authors: [
    {
      name: 'DevOps Daily',
      url: 'https://devops-daily.com',
    },
  ],
};

export default function ExercisesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
