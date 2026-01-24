import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { interviewQuestions, getQuestionBySlug } from '@/content/interview-questions';
import { InterviewQuestionPageClient } from '@/components/interview-questions/interview-question-page-client';

export function generateStaticParams() {
  return interviewQuestions.map((question) => ({
    slug: question.slug,
  }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const resolvedParams = await params;
  const question = getQuestionBySlug(resolvedParams.slug);

  if (!question) {
    return {
      title: 'Question Not Found',
    };
  }

  return {
    title: `${question.title} | DevOps Interview Questions | The DevOps Daily`,
    description: question.question,
    keywords: question.tags,
    authors: [{ name: 'The DevOps Daily' }],
    creator: 'The DevOps Daily',
    publisher: 'The DevOps Daily',
    applicationName: 'The DevOps Daily',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: `/interview-questions/${resolvedParams.slug}`,
    },
    openGraph: {
      title: `${question.title} - DevOps Interview Question`,
      description: question.question,
      type: 'article',
      url: `/interview-questions/${resolvedParams.slug}`,
      siteName: 'The DevOps Daily',
      locale: 'en_US',
      images: [
        {
          url: `/images/interview-questions/${resolvedParams.slug}-og.png`,
          width: 1200,
          height: 630,
          alt: question.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@TheDevOpsDaily',
      creator: '@TheDevOpsDaily',
      title: `${question.title} - DevOps Interview Question`,
      description: question.question,
      images: [`/images/interview-questions/${resolvedParams.slug}-og.png`],
    },
  };
}

export default async function InterviewQuestionPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const question = getQuestionBySlug(resolvedParams.slug);

  if (!question) {
    notFound();
  }

  return <InterviewQuestionPageClient question={question} />;
}
