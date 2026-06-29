import { Metadata } from 'next';
import { interviewQuestions } from '@/content/interview-questions';
import { PracticeSession } from '@/components/interview-questions/practice-session';

export const metadata: Metadata = {
  title: 'Practice Session | DevOps Interview Questions',
  description:
    'Drill through DevOps interview questions in a focused practice session. Think first, reveal the model answer, and track what you know.',
  // Parameterized practice surface; the canonical content lives on the
  // individual question pages and the tier/topic landing pages.
  robots: { index: false, follow: true },
  alternates: { canonical: '/interview-questions' },
};

export default function PracticePage() {
  return (
    <div className="container mx-auto px-4 max-w-3xl py-8 sm:py-10">
      <PracticeSession questions={interviewQuestions} />
    </div>
  );
}
