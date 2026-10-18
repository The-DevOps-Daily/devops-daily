'use client';

import { ADVENT_DAYS } from '@/lib/advent-schedule';
import { useOpenAdventDays } from '@/hooks/use-open-advent-days';

export function AdventHeroProgress() {
  return <AdventProgressBar open={useOpenAdventDays()} total={ADVENT_DAYS} />;
}

/** The days-open bar under an Advent hero. */
export function AdventProgressBar({ open, total }: { open: number; total: number }) {
  return (
    <div className="mt-12 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-muted-foreground">Days open</span>
        <span className="font-medium text-primary tabular-nums">
          {open} / {total} days
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Days open"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={open}
        className="h-3 bg-card border border-border rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-linear-to-r from-red-500 via-primary to-green-500 transition-all duration-1000 ease-out"
          style={{ width: `${(open / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
