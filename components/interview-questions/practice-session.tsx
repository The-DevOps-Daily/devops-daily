'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Shuffle, X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuestionPractice } from './question-practice';
import { tagToSlug } from '@/lib/tag-utils';
import {
  getInterviewProgress,
  type InterviewQuestion,
  type ExperienceTier,
  type Difficulty,
} from '@/lib/interview-utils';

interface PracticeSessionProps {
  questions: InterviewQuestion[];
}

function param(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PracticeSession({ questions }: PracticeSessionProps) {
  const [set, setSet] = useState<InterviewQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [confidentCount, setConfidentCount] = useState(0);

  // Describe where the session came from, for the header + exit link.
  const context = useMemo(() => {
    if (typeof window === 'undefined')
      return { label: 'All questions', backHref: '/interview-questions' };
    const tier = param('tier');
    const topic = param('topic');
    const mode = param('mode');
    if (mode === 'review') return { label: 'Your review pile', backHref: '/interview-questions' };
    if (topic)
      return {
        label: `${topic.replace(/-/g, ' ')} questions`,
        backHref: `/interview-questions/topic/${topic}`,
      };
    if (tier) return { label: `${tier} questions`, backHref: `/interview-questions/${tier}` };
    if (param('random')) return { label: 'Random mix', backHref: '/interview-questions' };
    return { label: 'All questions', backHref: '/interview-questions' };
  }, []);

  // Build the working set once, from the URL filters.
  useEffect(() => {
    const tier = param('tier') as ExperienceTier | '';
    const topic = param('topic');
    const difficulty = param('difficulty') as Difficulty | '';
    const mode = param('mode');
    const progress = getInterviewProgress();

    let pool = questions.filter((q) => {
      if (tier && q.tier !== tier) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (topic && tagToSlug(q.category) !== topic) return false;
      if (mode === 'review' && progress[q.id]?.confident !== false) return false;
      return true;
    });

    if (param('random') || mode === 'review') pool = shuffle(pool);

    setSet(pool);
    const startAt = Math.max(0, Math.min(pool.length - 1, parseInt(param('i') || '0', 10) || 0));
    setIndex(startAt);
    setConfidentCount(pool.filter((q) => progress[q.id]?.confident).length);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ?i= in the URL so a session is resumable / shareable.
  const syncIndex = useCallback((next: number) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('i', String(next));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, []);

  const go = useCallback(
    (delta: number) => {
      setIndex((cur) => {
        const next = Math.max(0, Math.min(set.length - 1, cur + delta));
        syncIndex(next);
        return next;
      });
    },
    [set.length, syncIndex]
  );

  const reshuffle = () => {
    setSet((cur) => shuffle(cur));
    setIndex(0);
    syncIndex(0);
  };

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const handleRated = () => {
    // Recount "got it" from storage against the current set.
    const progress = getInterviewProgress();
    setConfidentCount(set.filter((q) => progress[q.id]?.confident).length);
    // Auto-advance after a beat so the rating registers visually.
    if (index < set.length - 1) {
      setTimeout(() => go(1), 250);
    }
  };

  if (!ready) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (set.length === 0) {
    return (
      <div className="rounded-md border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          {context.label === 'Your review pile'
            ? "Nothing in your review pile yet. Mark a few questions 'Need review' and they'll show up here."
            : 'No questions match this set.'}
        </p>
        <Button asChild variant="outline">
          <Link href="/interview-questions">Back to all questions</Link>
        </Button>
      </div>
    );
  }

  const current = set[index];
  const pct = Math.round(((index + 1) / set.length) * 100);

  return (
    <div>
      {/* Session header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs font-mono text-muted-foreground capitalize truncate">
            {context.label}
          </p>
          <p className="text-sm font-medium">
            Question {index + 1} of {set.length}
            <span className="text-muted-foreground font-normal"> · {confidentCount} got it</span>
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground flex-shrink-0">
          <Link href={context.backHref}>
            <X className="w-4 h-4 mr-1" />
            Exit
          </Link>
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Current question */}
      <QuestionPractice key={current.id} question={current} showTitle onRated={handleRated} />

      {/* Controls */}
      <div className="flex items-center justify-between mt-5">
        <Button onClick={() => go(-1)} disabled={index === 0} variant="outline" size="sm">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Prev
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={reshuffle} variant="outline" size="sm">
            <Shuffle className="w-4 h-4 mr-1" />
            Shuffle
          </Button>
          <span className="hidden sm:flex items-center gap-1 text-xs font-mono text-muted-foreground">
            <Keyboard className="w-3.5 h-3.5" strokeWidth={1.5} />← →
          </span>
        </div>
        <Button
          onClick={() => go(1)}
          disabled={index >= set.length - 1}
          variant="outline"
          size="sm"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Permalink to the current question, for sharing */}
      <div className="mt-4 text-center">
        <Link
          href={`/interview-questions/${current.tier}/${current.slug}`}
          className="text-xs font-mono text-muted-foreground hover:text-primary"
        >
          open this question&apos;s page →
        </Link>
      </div>
    </div>
  );
}
