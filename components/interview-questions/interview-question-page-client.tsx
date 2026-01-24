'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Code, AlertTriangle, HelpCircle, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import type { InterviewQuestion } from '@/lib/interview-utils';
import { getDifficultyColor, markQuestionReviewed, getInterviewProgress } from '@/lib/interview-utils';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';

interface InterviewQuestionPageClientProps {
  question: InterviewQuestion;
}

export function InterviewQuestionPageClient({ question }: InterviewQuestionPageClientProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'none' | 'confident' | 'needs-review'>(() => {
    if (typeof window === 'undefined') return 'none';
    const progress = getInterviewProgress();
    const questionProgress = progress[question.id];
    if (!questionProgress?.reviewed) return 'none';
    return questionProgress.confident ? 'confident' : 'needs-review';
  });

  const handleMarkReviewed = (confident: boolean) => {
    markQuestionReviewed(question.id, confident);
    setReviewStatus(confident ? 'confident' : 'needs-review');
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back link */}
        <Link
          href="/interview-questions"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all questions
        </Link>

        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
              {question.category}
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getDifficultyColor(question.difficulty)}`}>
              {question.difficulty}
            </span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {question.title}
          </h1>
          
          <div className="flex flex-wrap gap-2">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        {/* Question */}
        <section className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Question</h2>
              <p className="text-gray-700 dark:text-gray-300">{question.question}</p>
            </div>
          </div>
        </section>

        {/* Answer toggle */}
        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full mb-8 py-4 px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Show Answer
          </button>
        ) : (
          <>
            {/* Answer */}
            <section className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <BookOpen className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Answer</h2>
                  <p className="text-gray-700 dark:text-gray-300">{question.answer}</p>
                </div>
              </div>
            </section>

            {/* Explanation */}
            {question.explanation && (
              <section className="mb-8 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Detailed Explanation</h2>
                <p className="text-gray-600 dark:text-gray-400">{question.explanation}</p>
              </section>
            )}

            {/* Code Examples */}
            {question.codeExamples && question.codeExamples.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Code className="w-5 h-5 text-gray-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Code Examples</h2>
                </div>
                <div className="space-y-4">
                  {question.codeExamples.map((example, index) => (
                    <div key={index}>
                      {example.label && (
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{example.label}</p>
                      )}
                      <CodeBlockWrapper language={example.language}>
                        {example.code}
                      </CodeBlockWrapper>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Common Mistakes */}
            {question.commonMistakes && question.commonMistakes.length > 0 && (
              <section className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Common Mistakes to Avoid</h2>
                </div>
                <ul className="space-y-2">
                  {question.commonMistakes.map((mistake, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                      <span className="text-amber-500 mt-1">•</span>
                      {mistake}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Follow-up Questions */}
            {question.followUpQuestions && question.followUpQuestions.length > 0 && (
              <section className="mb-8 p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Potential Follow-up Questions</h2>
                <ul className="space-y-2">
                  {question.followUpQuestions.map((q, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                      <span className="text-purple-500 font-medium">{index + 1}.</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Resources */}
            {question.resources && question.resources.length > 0 && (
              <section className="mb-8 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Learn More</h2>
                <ul className="space-y-2">
                  {question.resources.map((resource, index) => (
                    <li key={index}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {resource.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Self-assessment */}
            <section className="mb-8 p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">How did you do?</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Track your progress by marking this question:</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleMarkReviewed(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    reviewStatus === 'confident'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  I got this!
                </button>
                <button
                  onClick={() => handleMarkReviewed(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    reviewStatus === 'needs-review'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  Need more practice
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
