import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { interviewQuestions, getQuestionsByTier, getAllCategories } from '@/content/interview-questions';
import { InterviewTierPage } from '@/components/interview-questions/interview-tier-page';
import { PageHero } from '@/components/page-hero';
import { Briefcase } from 'lucide-react';
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
  const categories = getAllCategories();
  const meta = tierMeta[tier as ExperienceTier];
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <>
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
      <InterviewTierPage
        tier={tier as ExperienceTier}
        questions={questions}
        categories={categories}
      />
      {/* All-questions index. Server-rendered so the slug pages are
          actually linked from somewhere - without these links every
          /interview-questions/{tier}/{slug} page is an SEO orphan. */}
      <section className="container mx-auto px-4 max-w-4xl py-12 border-t">
        <h2 className="text-2xl font-bold mb-2">All {tierLabel} Questions</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Browse every {tierLabel.toLowerCase()} question with its own page.
          Useful for sharing, bookmarking, or jumping straight to a topic.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {questions.map((q) => (
            <li key={q.id}>
              <Link
                href={`/interview-questions/${tier}/${q.slug}`}
                className="text-sm text-foreground hover:text-primary hover:underline"
              >
                {q.title}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {q.category}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
