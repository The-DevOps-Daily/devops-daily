'use client';

import { useEffect, useState } from 'react';
import {
  Lightbulb,
  Code,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Eye,
  CheckCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/code-block-wrapper';
import type { InterviewQuestion } from '@/lib/interview-utils';
import {
  getDifficultyColor,
  markQuestionReviewed,
  getInterviewProgress,
} from '@/lib/interview-utils';

interface QuestionPracticeProps {
  question: InterviewQuestion;
  /** Show the question title as a heading (off on permalink pages where PageHero owns the H1). */
  showTitle?: boolean;
  /** Start with the answer revealed (e.g. deep-linked "show answer"). */
  startRevealed?: boolean;
  /** Called after the learner self-rates, so a parent session can advance. */
  onRated?: (confident: boolean) => void;
}

export function QuestionPractice({
  question,
  showTitle = false,
  startRevealed = false,
  onRated,
}: QuestionPracticeProps) {
  const [revealed, setRevealed] = useState(startRevealed);
  const [rated, setRated] = useState<boolean | null>(null);

  // Reset when the question changes (session mode reuses one instance).
  useEffect(() => {
    setRevealed(startRevealed);
    const progress = getInterviewProgress();
    const entry = progress[question.id];
    setRated(entry?.reviewed ? entry.confident : null);
  }, [question.id, startRevealed]);

  const handleRate = (confident: boolean) => {
    markQuestionReviewed(question.id, confident);
    setRated(confident);
    onRated?.(confident);
  };

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 text-xs font-mono rounded-md border bg-muted/50 text-muted-foreground">
            {question.category}
          </span>
          <span
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md ${getDifficultyColor(question.difficulty)}`}
          >
            {question.difficulty}
          </span>
          {rated !== null && (
            <span
              className={`px-2.5 py-0.5 text-xs font-medium rounded-md ${
                rated
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              {rated ? 'got it' : 'review'}
            </span>
          )}
        </div>
        {showTitle && <h2 className="text-lg sm:text-xl font-bold">{question.title}</h2>}
      </div>

      {/* Question prompt */}
      <div className="p-5 sm:p-6 bg-muted/30 border-b">
        <p className="text-xs font-mono text-primary mb-2 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />
          // interview question
        </p>
        <p className="text-base sm:text-lg leading-relaxed text-foreground">{question.question}</p>
      </div>

      {/* Answer — always rendered (so it's in the static HTML for SEO/AI), but
          covered by a reveal panel until the learner has had a go. When hidden
          the body is capped to a short blurred teaser so the reveal button
          stays in view even for long answers. */}
      <div className="relative">
        <div
          className={`p-5 sm:p-6 space-y-6 transition-all duration-300 ${
            revealed
              ? ''
              : 'pointer-events-none select-none blur-sm opacity-60 max-h-64 overflow-hidden'
          }`}
          aria-hidden={!revealed}
        >
          <AnswerBody question={question} />
        </div>

        {!revealed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-card/20 via-card/70 to-card">
            <p className="text-sm text-muted-foreground text-center max-w-xs px-4">
              Answer out loud first, then check yourself against the model answer.
            </p>
            <Button onClick={() => setRevealed(true)}>
              <Eye className="w-4 h-4 mr-2" />
              Reveal answer
            </Button>
          </div>
        )}
      </div>

      {/* Self-rating */}
      {revealed && (
        <div className="p-5 sm:p-6 border-t">
          <p className="text-sm text-muted-foreground mb-3 text-center">
            How did you do on this one?
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => handleRate(true)}
              variant="outline"
              className={`flex-1 max-w-[200px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 ${
                rated === true ? 'bg-emerald-500/10' : ''
              }`}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Got it
            </Button>
            <Button
              onClick={() => handleRate(false)}
              variant="outline"
              className={`flex-1 max-w-[200px] border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 ${
                rated === false ? 'bg-amber-500/10' : ''
              }`}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Need review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerBody({ question }: { question: InterviewQuestion }) {
  return (
    <>
      {/* Sample answer */}
      <div>
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-2">
          Sample answer
        </h3>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="leading-relaxed whitespace-pre-line text-foreground/90">
            {question.answer}
          </p>
        </div>
      </div>

      {/* Why this matters */}
      {question.explanation && (
        <div className="rounded-md border border-primary/30 bg-primary/[0.06] p-4">
          <h3 className="text-sm font-semibold mb-1.5 flex items-center gap-2 text-primary">
            <Lightbulb className="w-4 h-4" strokeWidth={1.5} />
            Why this matters
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {question.explanation}
          </p>
        </div>
      )}

      {/* Code examples */}
      {question.codeExamples && question.codeExamples.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
            <Code className="w-3.5 h-3.5" strokeWidth={1.5} />
            Code examples
          </h3>
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
        </div>
      )}

      {/* Common mistakes */}
      {question.commonMistakes && question.commonMistakes.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
            Common mistakes to avoid
          </h3>
          <ul className="space-y-1.5">
            {question.commonMistakes.map((mistake, index) => (
              <li key={index} className="text-sm text-muted-foreground leading-relaxed">
                {mistake}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-up questions */}
      {question.followUpQuestions && question.followUpQuestions.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
            Likely follow-ups
          </h3>
          <ul className="space-y-1.5">
            {question.followUpQuestions.map((fq, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ArrowRight
                  className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-1"
                  strokeWidth={1.5}
                />
                {fq}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
