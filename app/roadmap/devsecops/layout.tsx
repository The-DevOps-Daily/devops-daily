import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DevSecOps Roadmap - Security-First DevOps Journey',
  description:
    'A comprehensive roadmap for integrating security into your DevOps practices. Learn to build secure pipelines, implement security automation, and shift security left.',
  alternates: {
    canonical: '/roadmap/devsecops',
  },
  openGraph: {
    title: 'DevSecOps Roadmap - Security-First DevOps Journey',
    description:
      'A comprehensive roadmap for integrating security into your DevOps practices. Learn to build secure pipelines, implement security automation, and shift security left.',
    url: 'https://devops-daily.com/roadmap/devsecops',
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
  twitter: {
    title: 'DevSecOps Roadmap - Security-First DevOps Journey',
    description:
      'A comprehensive roadmap for integrating security into your DevOps practices. Learn to build secure pipelines, implement security automation, and shift security left.',
    card: 'summary_large_image',
    images: [
      {
        url: 'https://devops-daily.com/images/devsecops-roadmap-og.png',
        width: 1200,
        height: 630,
        alt: 'DevSecOps Roadmap - Security-First DevOps',
      },
    ],
  },
  keywords: [
    'DevSecOps',
    'Security DevOps',
    'Shift Left Security',
    'Secure CI/CD',
    'Application Security',
    'Infrastructure Security',
    'Security Automation',
    'Container Security',
    'Cloud Security',
    'SAST DAST',
  ],
  authors: [
    {
      name: 'DevOps Daily',
      url: 'https://devops-daily.com',
    },
  ],
};

export default function DevSecOpsRoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
