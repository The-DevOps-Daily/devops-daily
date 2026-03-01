import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { interviewQuestions, getQuestionBySlug } from '@/content/interview-questions';
import { InterviewQuestionPage } from '@/components/interview-questions/interview-question-page';
import { getSocialImagePath } from '@/lib/image-utils';
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
  const description = `${question.question} - ${question.category} interview question for ${tier} DevOps engineers`;
  
  return {
    title: `${question.title} | Interview Question | The DevOps Daily`,
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
          url: socialImage || '/og-image.jpg',
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
      images: [socialImage || '/og-image.jpg'],
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

  return <InterviewQuestionPage question={question} tier={tier as ExperienceTier} />;
}
