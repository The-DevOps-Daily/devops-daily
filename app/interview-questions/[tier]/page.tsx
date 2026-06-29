import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getQuestionsByTier } from '@/content/interview-questions';
import { QuestionBrowser } from '@/components/interview-questions/question-browser';
import { PageHero } from '@/components/page-hero';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Briefcase } from 'lucide-react';
import type { ExperienceTier } from '@/lib/interview-utils';

const validTiers: ExperienceTier[] = ['junior', 'mid', 'senior'];

const tierMeta = {
  junior: {
    title: 'Junior DevOps Interview Questions',
    description:
      'Entry-level DevOps interview questions covering Linux, Git, Docker basics, and CI/CD fundamentals for 0-2 years experience.',
  },
  mid: {
    title: 'Mid-Level DevOps Interview Questions',
    description:
      'Intermediate DevOps interview questions on Kubernetes, Terraform, monitoring, and architecture for 2-5 years experience.',
  },
  senior: {
    title: 'Senior DevOps Interview Questions',
    description:
      'Advanced DevOps interview questions on system design, incident management, and leadership for 5+ years experience.',
  },
};

interface PageProps {
  params: Promise<{ tier: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tier } = await params;

  if (!validTiers.includes(tier as ExperienceTier)) {
    return { title: 'Not Found' };
  }

  const meta = tierMeta[tier as ExperienceTier];

  return {
    title: { absolute: meta.title },
    description: meta.description,
    alternates: {
      canonical: `/interview-questions/${tier}`,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: 'website',
      url: `/interview-questions/${tier}`,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: meta.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: ['/og-image.png'],
    },
  };
}

export function generateStaticParams() {
  return validTiers.map((tier) => ({ tier }));
}

export default async function TierPage({ params }: PageProps) {
  const { tier } = await params;

  if (!validTiers.includes(tier as ExperienceTier)) {
    notFound();
  }

  const questions = getQuestionsByTier(tier as ExperienceTier);
  const meta = tierMeta[tier as ExperienceTier];
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Interview Questions', url: '/interview-questions' },
          { name: tierLabel, url: `/interview-questions/${tier}` },
        ]}
      />
      <PageHero
        title={`${tierLabel} Interview Practice`}
        description={meta.description}
        icon={Briefcase}
        breadcrumbs={[
          { label: 'Interview Questions', href: '/interview-questions' },
          { label: tierLabel },
        ]}
        stats={[{ label: 'questions', value: questions.length }]}
      />

      <div className="container mx-auto px-4 max-w-4xl py-10">
        <QuestionBrowser questions={questions} lockedTier={tier as ExperienceTier} />
      </div>
    </>
  );
}
