'use client';

import { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';
import { getDifficultyColor } from '@/lib/interview-utils';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/code-block-wrapper';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lightbulb, AlertTriangle, Code, ArrowRight } from 'lucide-react';

interface InterviewQuestionPageProps {
  question: InterviewQuestion;
  tier: ExperienceTier;
}

const tierLabels: Record<ExperienceTier, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
};

export function InterviewQuestionPage({ question, tier }: InterviewQuestionPageProps) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Back */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="-ml-3 text-muted-foreground">
          <Link href={`/interview-questions/${tier}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {tierLabels[tier]} questions
          </Link>
        </Button>
      </div>

      {/* Meta row. Title itself lives in <PageHero> to avoid a duplicate H1. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-0.5 text-xs font-mono rounded-md border bg-muted/50 text-muted-foreground">
          {tierLabels[tier]}
        </span>
        <span
          className={`px-2.5 py-0.5 text-xs font-medium rounded-md ${getDifficultyColor(question.difficulty)}`}
        >
          {question.difficulty}
        </span>
        <span className="px-2.5 py-0.5 text-xs font-mono rounded-md border bg-muted/50 text-muted-foreground">
          {question.category}
        </span>
      </div>

      {/* Question */}
      <div className="rounded-md border bg-muted/30 p-5 sm:p-6 mb-8">
        <p className="text-xs font-mono text-primary mb-2 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />
          // question
        </p>
        <p className="text-lg leading-relaxed text-foreground">{question.question}</p>
      </div>

      {/* Answer */}
      <section className="mb-8">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-3">
          Answer
        </h2>
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed">
          {question.answer.split('\n\n').map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* Why this matters */}
      {question.explanation && (
        <section className="mb-8">
          <div className="rounded-md border border-primary/30 bg-primary/[0.06] p-5">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-primary">
              <Lightbulb className="w-4 h-4" strokeWidth={1.5} />
              Why this matters
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {question.explanation}
            </p>
          </div>
        </section>
      )}

      {/* Code examples */}
      {question.codeExamples && question.codeExamples.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Code className="w-3.5 h-3.5" strokeWidth={1.5} />
            Code examples
          </h2>
          <div className="space-y-4">
            {question.codeExamples.map((example, index) => (
              <div key={index}>
                {example.label && (
                  <p className="text-sm text-muted-foreground mb-2">{example.label}</p>
                )}
                <CodeBlock language={example.language}>{example.code}</CodeBlock>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Common mistakes */}
      {question.commonMistakes && question.commonMistakes.length > 0 && (
        <section className="mb-8">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-5">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
              Common mistakes
            </h2>
            <ul className="space-y-1.5">
              {question.commonMistakes.map((mistake, index) => (
                <li key={index} className="text-sm text-muted-foreground leading-relaxed">
                  {mistake}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Follow-up questions */}
      {question.followUpQuestions && question.followUpQuestions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
            Likely follow-ups
          </h2>
          <ul className="space-y-2">
            {question.followUpQuestions.map((followUp, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-1" strokeWidth={1.5} />
                {followUp}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tags */}
      {question.tags && question.tags.length > 0 && (
        <section className="mb-8 pt-6 border-t">
          <div className="flex flex-wrap gap-2">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Footer nav */}
      <div className="flex justify-center pt-2">
        <Button asChild variant="outline">
          <Link href={`/interview-questions/${tier}`}>
            View all {tierLabels[tier]} questions
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
