import { Metadata } from 'next';
import { interviewQuestions, getAllCategories } from '@/content/interview-questions';
import { InterviewQuestionsHero } from '@/components/interview-questions/interview-questions-hero';
import { InterviewQuestionsList } from '@/components/interview-questions/interview-questions-list';

export const metadata: Metadata = {
  title: 'DevOps Interview Questions | The DevOps Daily',
  description:
    'In-depth DevOps interview questions with detailed answers, code examples, and explanations. Prepare for Kubernetes, Docker, Terraform, CI/CD, AWS, and more.',
  keywords: [
    'devops interview questions',
    'kubernetes interview',
    'docker interview',
    'terraform interview',
    'cicd interview',
    'aws interview',
  ],
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
    canonical: '/interview-questions',
  },
  openGraph: {
    title: 'DevOps Interview Questions - The DevOps Daily',
    description:
      'In-depth DevOps interview questions with detailed answers, code examples, and explanations. Prepare for your next interview.',
    type: 'website',
    url: '/interview-questions',
    siteName: 'The DevOps Daily',
    locale: 'en_US',
    images: [
      {
        url: '/images/interview-questions/interview-questions-og.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Interview Questions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@TheDevOpsDaily',
    creator: '@TheDevOpsDaily',
    title: 'DevOps Interview Questions - The DevOps Daily',
    description:
      'In-depth DevOps interview questions with detailed answers, code examples, and explanations.',
    images: ['/images/interview-questions/interview-questions-og.png'],
  },
};

export default function InterviewQuestionsPage() {
  const categories = getAllCategories();

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <InterviewQuestionsHero totalQuestions={interviewQuestions.length} categories={categories} />

      <section className="py-8 container mx-auto px-4 pb-16 max-w-4xl">
        <InterviewQuestionsList questions={interviewQuestions} />
      </section>
    </div>
  );
}
