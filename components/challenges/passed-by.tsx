'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { CHALLENGE_STATS_URL, type ChallengeStats } from '@/lib/challenge-types';
import { cn } from '@/lib/utils';

// One request per page view, shared by every card on the page.
let statsRequest: Promise<ChallengeStats | null> | null = null;

function isStats(value: unknown): value is ChallengeStats {
  if (!value || typeof value !== 'object') return false;
  const challenges = (value as { challenges?: unknown }).challenges;
  return !!challenges && typeof challenges === 'object';
}

function loadStats(): Promise<ChallengeStats | null> {
  if (!statsRequest) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    statsRequest = fetch(CHALLENGE_STATS_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: unknown) => (isStats(json) ? json : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }
  return statsRequest;
}

export function passedLabel(count: number): string {
  if (count === 0) return 'No passes yet';
  return `Passed by ${count.toLocaleString('en-US')} ${count === 1 ? 'person' : 'people'}`;
}

/**
 * "Passed by N people", read in the browser from the stats branch of the
 * challenges repository. Renders nothing until the count arrives, and
 * nothing at all if the request fails, so the page never shows a wrong
 * or broken number.
 */
export function PassedBy({ challengeId, className }: { challengeId: string; className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStats().then((stats) => {
      const passed = stats?.challenges[challengeId]?.passed;
      if (!cancelled && typeof passed === 'number' && Number.isInteger(passed) && passed >= 0) {
        setCount(passed);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  if (count === null) return null;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      {passedLabel(count)}
    </span>
  );
}
