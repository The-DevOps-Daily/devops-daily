'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleCheck, CircleX, RotateCcw, Trophy, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimFeedback } from '@/components/games/sim/sim-feedback';
import { revealTop } from '@/components/games/sim/sim-frame';
import { useSimGame } from '@/components/games/sim/sim-game';
import { NewsletterNudge } from '@/components/newsletter/newsletter-nudge';
import { useEmbed } from '@/lib/games/embed-context';
import { signalGameComplete } from '@/lib/games/game-complete';
import { cn } from '@/lib/utils';

export interface SimStat {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}

export interface SimCompleteProps {
  /** "Lab complete", "Puzzle solved", "Incident review". */
  title: ReactNode;
  /** One sentence on the outcome. */
  summary?: ReactNode;
  /** 'danger' for a losing end (the server went down, time ran out). */
  tone?: 'success' | 'danger' | 'neutral';
  icon?: LucideIcon;
  /** Shown above the title, such as "Resolved at T+31". */
  badge?: ReactNode;
  stats?: SimStat[];
  /** Three short lines. Undefined uses the explainer's topics; null hides the list. */
  learned?: string[] | null;
  /**
   * Tells Opsville the game is done (signalGameComplete), once per showing of
   * the card. Defaults to true for 'success' only. The embed route sends
   * Opsville one message per run, however often a game signals.
   */
  signal?: boolean;
  /** The primary link. Undefined uses the page's first "Try next" game; null hides it. */
  next?: { title: string; href: string } | null;
  /** Text of the primary link; defaults to "Next: <title>". */
  nextLabel?: string;
  /** An outline link to the related guide or post. */
  more?: { label: string; href: string };
  onPlayAgain?: () => void;
  playAgainLabel?: string;
  /** The game's own buttons, before the links. */
  actions?: ReactNode;
  /** A longer debrief under the card. */
  children?: ReactNode;
  /** Move focus to the heading when the card first shows. */
  autoFocus?: boolean;
  /** The newsletter box under the buttons; null hides it. Never shown in an embed. */
  newsletter?: 'sim_complete' | 'quiz_complete' | null;
}

const TONE_ICON: Record<
  NonNullable<SimCompleteProps['tone']>,
  { icon: LucideIcon; className: string }
> = {
  success: { icon: CircleCheck, className: 'text-correct-foreground' },
  danger: { icon: CircleX, className: 'text-wrong-foreground' },
  neutral: { icon: Trophy, className: 'text-primary' },
};

const STAT_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

/**
 * The end of a game, shown in place of the stage. It is the only place a
 * migrated game calls signalGameComplete(), so Opsville's quiz gate opens
 * exactly when this card first shows a finished game.
 */
export function SimComplete({
  title,
  summary,
  tone = 'success',
  icon,
  badge,
  stats,
  learned,
  signal,
  next,
  nextLabel,
  more,
  onPlayAgain,
  playAgainLabel = 'Play again',
  actions,
  children,
  autoFocus = true,
  newsletter = 'sim_complete',
}: SimCompleteProps) {
  const game = useSimGame();
  const { embedded, inOpsville } = useEmbed();
  const headingId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const signalled = useRef(false);
  const done = signal ?? tone === 'success';

  useEffect(() => {
    if (!done || signalled.current) return;
    signalled.current = true;
    signalGameComplete();
  }, [done]);

  useEffect(() => {
    if (!autoFocus) return;
    revealTop(rootRef.current, { onlyIfAbove: true, offset: 16 });
    headingRef.current?.focus({ preventScroll: true });
    // Only when the card first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = icon ?? TONE_ICON[tone].icon;
  const lines = learned === null ? [] : (learned ?? game?.teaches ?? []);
  const nextGame = next === undefined ? game?.next : next;
  // Inside Opsville the next step is Opsville's quiz, not another page in the frame.
  const showNext = nextGame && !inOpsville;
  const newTab = embedded ? { target: '_blank', rel: 'noopener' } : {};

  return (
    <section ref={rootRef} aria-labelledby={headingId} className="space-y-3">
      <div className="rounded-lg border bg-card p-4">
        {badge && <div className="mb-2 flex flex-wrap items-center gap-2">{badge}</div>}
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 text-lg font-semibold focus:outline-none"
        >
          <Icon className={cn('h-5 w-5 shrink-0', TONE_ICON[tone].className)} aria-hidden="true" />
          {title}
        </h2>
        {summary && <p className="mt-1 text-sm text-muted-foreground">{summary}</p>}

        {stats && stats.length > 0 && (
          <div className={cn('mt-3 grid gap-2', STAT_COLS[stats.length] ?? STAT_COLS[4])}>
            {stats.map((s) => (
              <div key={s.label} className="rounded-md bg-muted/50 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className="font-mono text-2xl font-semibold tabular-nums">{s.value}</div>
                {s.note && <div className="text-xs text-muted-foreground">{s.note}</div>}
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <div className="mt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              What you learned
            </h3>
            <ul className="mt-1.5 space-y-1 text-sm">
              {lines.map((line) => (
                <li key={line} className="flex gap-2">
                  <CircleCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-correct-foreground"
                    aria-hidden="true"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {inOpsville && done && (
          <SimFeedback tone="success" label="Lessons done" className="mt-3">
            <p>Back in Opsville, take the quiz to finish the quest.</p>
          </SimFeedback>
        )}
      </div>

      {children}

      <div className="flex flex-wrap gap-2">
        {actions}
        {onPlayAgain && (
          <Button type="button" variant="ghost" onClick={onPlayAgain}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> {playAgainLabel}
          </Button>
        )}
        {more && (
          <Button asChild variant="outline">
            <Link href={more.href} {...newTab}>
              {more.label}
            </Link>
          </Button>
        )}
        {showNext && (
          <Button asChild>
            <Link href={nextGame.href} {...newTab}>
              {nextLabel ?? `Next: ${nextGame.title}`}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>

      {newsletter && !embedded && tone !== 'danger' && (
        <NewsletterNudge
          location={newsletter}
          title={
            newsletter === 'quiz_complete'
              ? 'Want more quizzes like this?'
              : 'Liked this simulator?'
          }
          text="Get new simulators, quizzes and the week's best DevOps posts in one email every Monday. Free, and you can unsubscribe anytime."
        />
      )}
    </section>
  );
}
