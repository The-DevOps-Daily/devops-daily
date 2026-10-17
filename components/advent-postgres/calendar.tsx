'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { isUnlocked, loadSolved } from '@/lib/advent-postgres-client';
import type { PostgresAdventDaySummary } from '@/lib/advent-postgres';

const TOTAL_DAYS = 24;

export function PostgresAdventCalendar({ days }: { days: PostgresAdventDaySummary[] }) {
  const [solved, setSolved] = useState<number[]>([]);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      setSolved(loadSolved());
      setOpen(Object.fromEntries(days.map((d) => [d.day, isUnlocked(d.publishedAt)])));
    }, 0);
    return () => clearTimeout(t);
  }, [days]);

  const byDay = new Map(days.map((d) => [d.day, d]));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((n) => {
        const day = byDay.get(n);
        const unlocked = !!day && open[n];
        const done = solved.includes(n);
        const body = (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">Dec {n}</span>
              {done ? (
                <CheckCircle2
                  className="h-4 w-4 text-green-600 dark:text-green-400"
                  aria-label="Solved"
                />
              ) : !unlocked ? (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Locked" />
              ) : null}
            </div>
            <p className="text-sm font-medium leading-snug">
              {unlocked && day ? day.title.replace(/^Day \d+: /, '') : `Day ${n}`}
            </p>
            {unlocked && day?.skills && (
              <p className="mt-2 text-xs text-muted-foreground">{day.skills.join(', ')}</p>
            )}
          </>
        );
        const cls = `block min-h-[104px] rounded-md border p-3 transition-colors ${
          unlocked
            ? 'border-border hover:border-primary/50 hover:bg-muted/30'
            : 'border-dashed border-border/70 opacity-70'
        } ${done ? 'border-green-500/40' : ''}`;
        return unlocked && day ? (
          <Link key={n} href={`/advent-of-postgres/${day.slug}`} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={n} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Hides a day's puzzle until 00:00 UTC on its date (or with ?preview). */
export function PostgresDayGate({
  publishedAt,
  day,
  children,
}: {
  publishedAt: string;
  day: number;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setUnlocked(isUnlocked(publishedAt)), 0);
    return () => clearTimeout(t);
  }, [publishedAt]);
  if (unlocked === null) return null;
  if (!unlocked) {
    return (
      <div className="my-10 rounded-md border border-dashed border-border p-8 text-center">
        <Lock className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
        <p className="font-medium">
          Day {day} opens on {day} December at 00:00 UTC.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Come back then, or solve the days that are already open.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
