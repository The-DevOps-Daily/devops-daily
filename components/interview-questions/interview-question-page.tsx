'use client';

import { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';
import { Button } from '@/components/ui/button';
import { QuestionPractice } from './question-practice';
import { ShareButton } from './share-button';
import { tagToSlug } from '@/lib/tag-utils';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface Neighbor {
  tier: ExperienceTier;
  slug: string;
  title: string;
}

interface InterviewQuestionPageProps {
  question: InterviewQuestion;
  tier: ExperienceTier;
  prev?: Neighbor | null;
  next?: Neighbor | null;
}

const tierLabels: Record<ExperienceTier, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
};

export function InterviewQuestionPage({ question, tier, prev, next }: InterviewQuestionPageProps) {
  const topicSlug = tagToSlug(question.category);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Top bar: back + share */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" asChild className="-ml-3 text-muted-foreground">
          <Link href={`/interview-questions/${tier}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tierLabels[tier]} questions
          </Link>
        </Button>
        <ShareButton title={question.title} />
      </div>

      {/* Practice card (think -> reveal -> self-rate). Answer is in the DOM for SEO. */}
      <QuestionPractice question={question} />

      {/* Practice CTAs */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={`/interview-questions/practice?tier=${tier}`}>
            <Play className="w-4 h-4 mr-2" />
            Practice all {tierLabels[tier]} questions
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/interview-questions/topic/${topicSlug}`}>
            More {question.category} questions
          </Link>
        </Button>
      </div>

      {/* Tags */}
      {question.tags && question.tags.length > 0 && (
        <div className="mt-6 pt-6 border-t flex flex-wrap gap-2">
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md border bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Prev / next within the tier */}
      {(prev || next) && (
        <nav className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={`/interview-questions/${prev.tier}/${prev.slug}`}
              className="group flex items-center gap-2 rounded-md border bg-card p-3 transition-colors hover:bg-muted/40"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary" />
              <span className="min-w-0">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                  Previous
                </span>
                <span className="block text-sm truncate group-hover:text-primary transition-colors">
                  {prev.title}
                </span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/interview-questions/${next.tier}/${next.slug}`}
              className="group flex items-center justify-end gap-2 rounded-md border bg-card p-3 text-right transition-colors hover:bg-muted/40"
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                  Next
                </span>
                <span className="block text-sm truncate group-hover:text-primary transition-colors">
                  {next.title}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
