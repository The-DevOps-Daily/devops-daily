'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Award,
  Braces,
  CalendarRange,
  ChartColumn,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Filter,
  GitBranch,
  GitMerge,
  Globe,
  Lock,
  Network,
  RotateCcw,
  Search,
  Sigma,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { isUnlocked, loadSolved, saveSolved } from '@/lib/advent-postgres-client';
import type { PostgresAdventDaySummary } from '@/lib/advent-postgres';
import { AdventProgressBar } from '@/components/advent-hero-progress';
import { AdventCardIcon, AdventSectionHeader } from '@/components/advent-hero';

const TOTAL_DAYS = 24;

const difficultyColors: Record<string, string> = {
  Beginner: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
  Intermediate: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
  Advanced: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400',
};

// An icon for the day's main SQL topic, from its first skill. Locked days get the
// database icon, so the icon gives nothing away.
const TOPIC_ICONS: [RegExp, LucideIcon][] = [
  [/neon|branch/i, GitBranch],
  [/time zone/i, Globe],
  [/generate_series|time series/i, Clock],
  [/recursive|graph|path/i, Network],
  [/jsonb/i, Braces],
  [/full-text|tsvector/i, Search],
  [/merge|upsert/i, GitMerge],
  [/distinct|dedup/i, Filter],
  [/percentile|regr_|forecast/i, TrendingUp],
  [/window|lag|row_number|running|session/i, ChartColumn],
  [/range|availability/i, CalendarRange],
  [/group by|aggregate|mode\(\)|having/i, Sigma],
];

function topicIcon(day?: PostgresAdventDaySummary): LucideIcon {
  const skill = day?.skills?.[0] ?? '';
  return TOPIC_ICONS.find(([re]) => re.test(skill))?.[1] ?? Database;
}

/** Which days are open in this browser (?preview, or a preview build, opens all). */
function useOpenDays(days: PostgresAdventDaySummary[], preview: boolean): Record<number, boolean> {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const t = setTimeout(
      () =>
        setOpen(Object.fromEntries(days.map((d) => [d.day, preview || isUnlocked(d.publishedAt)]))),
      0
    );
    return () => clearTimeout(t);
  }, [days, preview]);
  return open;
}

export function PostgresHeroProgress({
  days,
  preview = false,
}: {
  days: PostgresAdventDaySummary[];
  preview?: boolean;
}) {
  const open = useOpenDays(days, preview);
  return <AdventProgressBar open={Object.values(open).filter(Boolean).length} total={TOTAL_DAYS} />;
}

export function PostgresAdventCalendar({
  days,
  preview = false,
}: {
  days: PostgresAdventDaySummary[];
  preview?: boolean;
}) {
  const [solved, setSolved] = useState<number[]>([]);
  const open = useOpenDays(days, preview);
  useEffect(() => {
    const t = setTimeout(() => setSolved(loadSolved()), 0);
    return () => clearTimeout(t);
  }, []);

  const byDay = new Map(days.map((d) => [d.day, d]));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="lg:col-span-9">
        <AdventSectionHeader
          id="calendar-title"
          label="daily puzzles"
          title="Daily Puzzles"
          description="A new puzzle opens at 00:00 UTC each day. Your progress is saved in this browser."
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((n) => {
            const day = byDay.get(n);
            const unlocked = !!day && !!open[n];
            const done = solved.includes(n);
            const body = (
              <>
                <div className="absolute inset-0 bg-linear-to-br from-card via-card to-primary/5 opacity-90" />
                {!unlocked && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="text-center">
                      <Lock
                        className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                      <div className="font-mono text-sm text-muted-foreground">Opens Dec {n}</div>
                    </div>
                  </div>
                )}
                <div className="relative p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl font-bold ${
                          done
                            ? 'border-green-500/50 bg-green-500/20 text-green-500'
                            : 'border-primary/30 bg-linear-to-br from-primary/20 to-blue-500/20'
                        }`}
                      >
                        {n}
                      </div>
                      <AdventCardIcon icon={unlocked ? topicIcon(day) : Database} />
                    </div>
                    <div className="flex items-center gap-2">
                      {done && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" aria-label="Solved" />
                      )}
                      {unlocked && day?.difficulty && (
                        <div
                          className={`rounded-md border bg-linear-to-br px-2 py-1 text-xs font-medium ${
                            difficultyColors[day.difficulty] ?? difficultyColors.Intermediate
                          }`}
                        >
                          {day.difficulty}
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="mb-2 line-clamp-2 text-lg font-bold transition-colors group-hover:text-primary">
                    {unlocked && day ? day.title.replace(/^Day \d+: /, '') : `Day ${n}`}
                  </h3>
                  {unlocked && day?.excerpt && (
                    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{day.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between">
                    {unlocked && day?.skills?.[0] ? (
                      <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {day.skills[0]}
                      </div>
                    ) : (
                      <span />
                    )}
                    {unlocked && (
                      <ChevronRight className="h-5 w-5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                </div>
              </>
            );
            const cls = `group relative block overflow-hidden rounded-md border transition-colors ${
              unlocked
                ? 'cursor-pointer border-border hover:border-primary/40 hover:bg-muted/30'
                : 'pointer-events-none cursor-not-allowed border-border/50 opacity-60'
            } ${done ? 'ring-2 ring-green-500/50' : ''}`;
            return unlocked && day ? (
              <Link key={n} href={`/advent-of-postgres/${day.slug}`} className={cls}>
                {body}
              </Link>
            ) : (
              <div key={n} aria-disabled="true" className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
      <aside className="order-first lg:order-none lg:col-span-3">
        <div className="lg:sticky lg:top-8">
          <PostgresProgressStats
            solved={solved.length}
            onReset={() => {
              saveSolved([]);
              setSolved([]);
            }}
          />
        </div>
      </aside>
    </div>
  );
}

const MILESTONES = [
  { threshold: 5, label: 'Getting Started', icon: Zap, color: 'text-blue-500' },
  { threshold: 10, label: 'Making Progress', icon: Target, color: 'text-yellow-500' },
  { threshold: 20, label: 'Almost There', icon: Trophy, color: 'text-orange-500' },
  { threshold: TOTAL_DAYS, label: 'Champion', icon: Award, color: 'text-green-500' },
];

function PostgresProgressStats({ solved, onReset }: { solved: number; onReset: () => void }) {
  const pct = Math.round((solved / TOTAL_DAYS) * 100);
  const milestone = MILESTONES.filter((m) => solved >= m.threshold).pop() || MILESTONES[0];
  const Icon = milestone.icon;
  return (
    <div className="rounded-xl border border-border bg-card/50 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Progress</h3>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${milestone.color}`} />
          <span className="text-sm font-medium text-muted-foreground">{milestone.label}</span>
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Puzzles Solved</span>
          <span className="font-semibold text-primary">
            {solved} / {TOTAL_DAYS}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-border bg-muted">
          <div
            className="h-full bg-linear-to-r from-primary via-blue-500 to-green-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-primary/10 p-3 text-center">
          <div className="text-2xl font-bold text-primary">{solved}</div>
          <div className="text-xs text-muted-foreground">Solved</div>
        </div>
        <div className="rounded-lg bg-yellow-500/10 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
            {TOTAL_DAYS - solved}
          </div>
          <div className="text-xs text-muted-foreground">Remaining</div>
        </div>
        <div className="rounded-lg bg-green-500/10 p-3 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-500">{pct}%</div>
          <div className="text-xs text-muted-foreground">Progress</div>
        </div>
      </div>
      {solved > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="font-mono text-xs text-muted-foreground">
            {'// saved in this browser'}
          </span>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Reset your Advent of Postgres progress? This clears ${solved} solved ${solved === 1 ? 'day' : 'days'} in this browser.`
                )
              )
                onReset();
            }}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-red-500"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            reset progress
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Hides a day's puzzle until 00:00 UTC on its date (or with ?preview). A page
 * built before the day opened has no puzzle in it (builtLocked); if its time has
 * come, the next build is on its way.
 */
export function PostgresDayGate({
  publishedAt,
  day,
  builtLocked = false,
  preview = false,
  children,
}: {
  publishedAt: string;
  day: number;
  builtLocked?: boolean;
  /** A preview build of another branch: every day is open. */
  preview?: boolean;
  children?: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  useEffect(() => {
    const t = setTimeout(
      () =>
        setUnlocked(
          builtLocked ? Date.now() >= Date.parse(publishedAt) : preview || isUnlocked(publishedAt)
        ),
      0
    );
    return () => clearTimeout(t);
  }, [publishedAt, builtLocked, preview]);
  if (unlocked === null) return null;
  if (builtLocked && unlocked) {
    return (
      <div className="my-10 rounded-md border border-dashed border-border p-8 text-center">
        <p className="font-medium">Day {day} is opening now.</p>
        <p className="mt-1 text-sm text-muted-foreground">Reload the page in a few minutes.</p>
      </div>
    );
  }
  if (!unlocked || builtLocked) {
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
