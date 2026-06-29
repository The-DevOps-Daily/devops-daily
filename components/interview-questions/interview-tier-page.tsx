'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Code,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shuffle,
  Eye,
  EyeOff,
  Lightbulb,
  RotateCcw,
  Square,
  CheckSquare,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/code-block-wrapper';
import type { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';
import {
  getDifficultyColor,
  markQuestionReviewed,
  getInterviewProgress,
  resetInterviewProgress,
} from '@/lib/interview-utils';

interface InterviewTierPageProps {
  tier: ExperienceTier;
  questions: InterviewQuestion[];
  categories: string[];
}

function PracticeCard({
  question,
  onComplete,
}: {
  question: InterviewQuestion;
  onComplete: (confident: boolean) => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [checkedPoints, setCheckedPoints] = useState<Set<number>>(new Set());

  // Key points extracted from the answer for self-evaluation.
  const keyPoints = useMemo(() => {
    const sentences = question.answer.split(/[.!]/).filter((s) => s.trim().length > 10);
    return sentences.slice(0, 4).map((s) => s.trim());
  }, [question.answer]);

  const togglePoint = (index: number) => {
    setCheckedPoints((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleComplete = (confident: boolean) => {
    onComplete(confident);
    setShowAnswer(false);
    setCheckedPoints(new Set());
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
        </div>
        <h2 className="text-lg sm:text-xl font-bold">{question.title}</h2>
      </div>

      {/* Question prompt */}
      <div className="p-5 sm:p-6 bg-muted/30 border-b">
        <p className="text-xs font-mono text-primary mb-2 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />
          // interview question
        </p>
        <p className="text-base sm:text-lg leading-relaxed text-foreground">
          {question.question}
        </p>
      </div>

      {/* Practice area */}
      {!showAnswer ? (
        <div className="px-6 py-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
            <EyeOff className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-foreground mb-1">Take a moment to answer out loud.</p>
          <p className="text-sm text-muted-foreground mb-6">
            Think through the key points you would mention, then reveal the model answer.
          </p>
          <Button onClick={() => setShowAnswer(true)}>
            <Eye className="w-4 h-4 mr-2" />
            Reveal sample answer
          </Button>
        </div>
      ) : (
        <div className="p-5 sm:p-6 space-y-6">
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
              <p className="text-sm text-muted-foreground leading-relaxed">
                {question.explanation}
              </p>
            </div>
          )}

          {/* Self-evaluation checklist */}
          {keyPoints.length > 0 && (
            <div>
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-2">
                Self-check: did you mention these?
              </h3>
              <div className="space-y-2">
                {keyPoints.map((point, index) => {
                  const checked = checkedPoints.has(index);
                  return (
                    <button
                      key={index}
                      onClick={() => togglePoint(index)}
                      className={`w-full text-left p-3 rounded-md border transition-colors flex items-start gap-3 ${
                        checked
                          ? 'bg-emerald-500/[0.08] border-emerald-500/40'
                          : 'bg-card border-border hover:border-primary/30'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare
                          className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <Square
                          className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5"
                          strokeWidth={1.5}
                        />
                      )}
                      <span
                        className={`text-sm ${checked ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {point}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <XCircle
                      className="w-4 h-4 text-amber-600/70 dark:text-amber-400/70 flex-shrink-0 mt-0.5"
                      strokeWidth={1.5}
                    />
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up questions */}
          {question.followUpQuestions && question.followUpQuestions.length > 0 && (
            <div>
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-2">
                Likely follow-ups
              </h3>
              <ul className="space-y-1.5">
                {question.followUpQuestions.map((fq, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
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

          {/* Self-assessment */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              How confident do you feel about this one?
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => handleComplete(true)}
                variant="outline"
                className="flex-1 max-w-[200px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Got it
              </Button>
              <Button
                onClick={() => handleComplete(false)}
                variant="outline"
                className="flex-1 max-w-[200px] border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Need review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function InterviewTierPage({ tier, questions, categories }: InterviewTierPageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [displayQuestions, setDisplayQuestions] = useState<InterviewQuestion[]>([]);
  const [progress, setProgress] = useState<
    Record<string, { reviewed: boolean; confident: boolean }>
  >({});

  useEffect(() => {
    setProgress(getInterviewProgress());
  }, []);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => !selectedCategory || q.category === selectedCategory);
  }, [questions, selectedCategory]);

  useEffect(() => {
    setDisplayQuestions(filteredQuestions);
    setCurrentIndex(0);
  }, [filteredQuestions]);

  const currentQuestion = displayQuestions[currentIndex];

  const completedCount = Object.values(progress).filter((p) => p.reviewed).length;
  const confidentCount = Object.values(progress).filter((p) => p.confident).length;
  const pct = questions.length ? Math.round((completedCount / questions.length) * 100) : 0;

  const handleQuestionComplete = (confident: boolean) => {
    if (!currentQuestion) return;
    markQuestionReviewed(currentQuestion.id, confident);
    setProgress(getInterviewProgress());
    if (currentIndex < displayQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleReset = () => {
    resetInterviewProgress();
    setProgress({});
    setCurrentIndex(0);
    setDisplayQuestions(filteredQuestions);
  };

  const handleShuffle = () => {
    const shuffled = [...displayQuestions].sort(() => Math.random() - 0.5);
    setDisplayQuestions(shuffled);
    setCurrentIndex(0);
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl py-8">
        {/* Progress */}
        <div className="rounded-md border bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">
              {completedCount} of {questions.length} practiced
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {confidentCount} confident &middot; {pct}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select
            value={selectedCategory || ''}
            onChange={(e) => {
              setSelectedCategory(e.target.value || null);
              setCurrentIndex(0);
            }}
            className="px-3 py-2 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <Button onClick={handleShuffle} variant="outline" size="sm">
            <Shuffle className="w-4 h-4 mr-2" />
            Shuffle
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Question navigation */}
        <div className="flex items-center justify-between mb-5">
          <Button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            variant="outline"
            size="sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm font-mono text-muted-foreground">
            {displayQuestions.length ? currentIndex + 1 : 0} / {displayQuestions.length}
          </span>
          <Button
            onClick={() =>
              setCurrentIndex(Math.min(displayQuestions.length - 1, currentIndex + 1))
            }
            disabled={currentIndex >= displayQuestions.length - 1}
            variant="outline"
            size="sm"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Current question */}
        {currentQuestion ? (
          <PracticeCard
            key={currentQuestion.id}
            question={currentQuestion}
            onComplete={handleQuestionComplete}
          />
        ) : (
          <div className="text-center py-12 rounded-md border bg-card">
            <p className="text-sm text-muted-foreground">No questions match your filter.</p>
          </div>
        )}

        {/* Quick jump */}
        {displayQuestions.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-mono text-muted-foreground mb-3">// jump to a question</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayQuestions.map((q, index) => {
                const isCompleted = progress[q.id]?.reviewed;
                const isConfident = progress[q.id]?.confident;
                const isCurrent = index === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(index)}
                    className={`text-left p-3 rounded-md border transition-colors flex items-center gap-3 ${
                      isCurrent
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-card border-border hover:border-primary/30'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-medium ${
                        isConfident
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : isCompleted
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isConfident ? '✓' : isCompleted ? '?' : index + 1}
                    </span>
                    <span className="text-sm text-foreground truncate">{q.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
