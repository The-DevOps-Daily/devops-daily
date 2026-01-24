import { Metadata } from 'next';
import { interviewQuestions, getAllCategories } from '@/content/interview-questions';
import { InterviewQuestionsHero } from '@/components/interview-questions/interview-questions-hero';
import { InterviewQuestionsList } from '@/components/interview-questions/interview-questions-list';

export const metadata: Metadata = {
  title: 'DevOps Interview Questions | The DevOps Daily',
  description: 'In-depth DevOps interview questions with detailed answers, code examples, and explanations. Prepare for Kubernetes, Docker, Terraform, CI/CD, AWS, and more.',
  keywords: ['devops interview questions', 'kubernetes interview', 'docker interview', 'terraform interview', 'cicd interview', 'aws interview'],
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
    description: 'In-depth DevOps interview questions with detailed answers, code examples, and explanations. Prepare for your next interview.',
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
    description: 'In-depth DevOps interview questions with detailed answers, code examples, and explanations.',
    images: ['/images/interview-questions/interview-questions-og.png'],
  },
};

export default function InterviewQuestionsPage() {
  const categories = getAllCategories();

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <InterviewQuestionsHero 
        totalQuestions={interviewQuestions.length} 
        categories={categories} 
      />

      <section className="py-8 container mx-auto px-4 mb-16 max-w-7xl">
        <InterviewQuestionsList questions={interviewQuestions} />
      </section>

      <section className="py-8 container mx-auto px-4 mb-16 max-w-7xl">
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            💡 Interview Prep Tips
          </h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li>✓ Read the answer, then try to explain it in your own words</li>
            <li>✓ Practice the code examples in a real environment</li>
            <li>✓ Review follow-up questions to prepare for deeper discussions</li>
            <li>✓ Track your progress to identify areas that need more practice</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
