import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { interviewQuestions, getQuestionBySlug } from '@/content/interview-questions';
import { InterviewQuestionPage } from '@/components/interview-questions/interview-question-page';
import { PageHero } from '@/components/page-hero';
import { getSocialImagePath } from '@/lib/image-utils';
import { truncateMetaDescription } from '@/lib/meta-description';
import type { ExperienceTier } from '@/lib/interview-utils';

const validTiers: ExperienceTier[] = ['junior', 'mid', 'senior'];

interface PageProps {
  params: Promise<{ tier: string; slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return interviewQuestions.map((question) => ({
    tier: question.tier,
    slug: question.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tier, slug } = await params;
  
  if (!validTiers.includes(tier as ExperienceTier)) {
    return { title: 'Not Found' };
  }

  const question = getQuestionBySlug(slug);
  
  if (!question || question.tier !== tier) {
    return { title: 'Not Found' };
  }

  const socialImage = getSocialImagePath(slug, 'interview-questions');
  // Some questions are long enough that the auto-built description blows
  // past 160 chars; trim at sentence boundary so Google does not truncate.
  const description = truncateMetaDescription(
    `${question.question} - ${question.category} interview question for ${tier} DevOps engineers`,
  );
  
  return {
    title: { absolute: `${question.title} - Interview Question` },
    description,
    alternates: {
      canonical: `/interview-questions/${tier}/${slug}`,
    },
    openGraph: {
      type: 'article',
      title: question.title,
      description,
      url: `/interview-questions/${tier}/${slug}`,
      images: [
        {
          url: socialImage || '/og-image.png',
          width: 1200,
          height: 630,
          alt: question.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: question.title,
      description,
      images: [socialImage || '/og-image.png'],
    },
  };
}

export default async function QuestionPage({ params }: PageProps) {
  const { tier, slug } = await params;
  
  if (!validTiers.includes(tier as ExperienceTier)) {
    notFound();
  }

  const question = getQuestionBySlug(slug);
  
  if (!question || question.tier !== tier) {
    notFound();
  }

  const capitalizedTier = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <>
      <PageHero
        title={question.title}
        description={question.question}
        icon={Briefcase}
        breadcrumbs={[
          { label: 'Interview Questions', href: '/interview-questions' },
          { label: capitalizedTier },
          { label: question.title },
        ]}
      />
      <InterviewQuestionPage question={question} tier={tier as ExperienceTier} />
    </>
  );
}
