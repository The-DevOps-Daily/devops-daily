import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { interviewQuestions, getQuestionsByTier, getAllCategories } from '@/content/interview-questions';
import { InterviewTierPage } from '@/components/interview-questions/interview-tier-page';
import type { ExperienceTier } from '@/lib/interview-utils';

const validTiers: ExperienceTier[] = ['junior', 'mid', 'senior'];

const tierMeta = {
  junior: {
    title: 'Junior DevOps Interview Questions',
    description: 'Entry-level DevOps interview questions covering Linux, Git, Docker basics, and CI/CD fundamentals for 0-2 years experience.',
  },
  mid: {
    title: 'Mid-Level DevOps Interview Questions',
    description: 'Intermediate DevOps interview questions on Kubernetes, Terraform, monitoring, and architecture for 2-5 years experience.',
  },
  senior: {
    title: 'Senior DevOps Interview Questions',
    description: 'Advanced DevOps interview questions on system design, incident management, and leadership for 5+ years experience.',
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
    title: `${meta.title} | The DevOps Daily`,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: 'website',
      url: `/interview-questions/${tier}`,
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
  const categories = getAllCategories();

  return (
    <InterviewTierPage
      tier={tier as ExperienceTier}
      questions={questions}
      categories={categories}
    />
  );
}
