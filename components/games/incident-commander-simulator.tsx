'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Check,
  Circle,
  CircleCheck,
  Clock,
  Copy,
  FastForward,
  Info,
  Lightbulb,
  Megaphone,
  MessageSquare,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Siren,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHintButton,
  SimHowTo,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  SimTabBadge,
  revealTop,
} from '@/components/games/sim';
import { useEmbed } from '@/lib/games/embed-context';
import { cn } from '@/lib/utils';
import {
  SUSTAIN_MINUTES,
  advance,
  advanceToNextEvent,
  buildDebrief,
  buildRecap,
  clockAt,
  createGame,
  currentPoint,
  dispatch,
  dispatchBlock,
  getAction,
  healthyStreak,
  nextUpdateDue,
  ownerName,
  pad,
  resolveIncident,
  setSeverity,
  startMonitoring,
  sustainedHealthy,
  takeHint,
  type ActionDef,
  type ActionGroup,
  type FeedItem,
  type GameState,
  type Scenario,
  type Severity,
} from '@/lib/games/incident-commander-engine';
import { SCENARIOS, getScenario } from '@/lib/games/incident-commander-scenarios';

type MobileTab = 'situation' | 'actions' | 'timeline';
type Trend = { dir: 'up' | 'down' | 'flat'; better: boolean };

const GROUPS: { id: ActionGroup; label: string; icon: typeof Search }[] = [
  { id: 'investigate', label: 'Investigate', icon: Search },
  { id: 'mitigate', label: 'Mitigate', icon: Wrench },
  { id: 'communicate', label: 'Communicate', icon: Megaphone },
];

const RISK_STYLES: Record<string, string> = {
  low: 'border-correct/40 text-correct-foreground',
  medium: 'border-partial/40 text-partial-foreground',
  high: 'border-wrong/50 text-wrong-foreground',
};

const FEED_ICONS: Record<FeedItem['kind'], typeof Siren> = {
  alert: Siren,
  event: MessageSquare,
  dispatch: Send,
  result: Search,
  change: Wrench,
  update: Megaphone,
  system: Info,
  hint: Lightbulb,
};

function fmtCount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function Sparkline({
  values,
  threshold,
  bad,
  max,
}: {
  values: number[];
  threshold?: number;
  bad: boolean;
  max?: number;
}) {
  const hi = Math.max(max ?? 0, threshold ?? 0, ...values) * 1.08 || 1;
  const w = 100;
  const h = 32;
  const x = (i: number) => (values.length < 2 ? 0 : (i / (values.length - 1)) * w);
  const y = (v: number) => h - (v / hi) * h;
  const pts = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const stroke = bad ? 'stroke-wrong' : 'stroke-correct';
  const fill = bad ? 'fill-wrong/10' : 'fill-correct/10';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-10 w-full"
      aria-hidden="true"
    >
      {threshold !== undefined && (
        <line
          x1="0"
          x2={w}
          y1={y(threshold)}
          y2={y(threshold)}
          className="stroke-muted-foreground/40"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polygon points={`0,${h} ${pts} ${w},${h}`} className={fill} />
      <polyline
        points={pts}
        className={cn('fill-none', stroke)}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SignalCard({
  label,
  value,
  baseline,
  delta,
  good,
  compact,
  children,
}: {
  label: string;
  value: string;
  baseline: string;
  delta: Trend;
  good: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const TrendIcon = delta.dir === 'flat' ? null : delta.dir === 'down' ? TrendingDown : TrendingUp;
  const pill = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold sm:px-2',
        good ? 'bg-correct/10 text-correct-foreground' : 'bg-wrong/10 text-wrong-foreground'
      )}
    >
      {good ? 'Normal' : 'Not normal'}
    </span>
  );
  if (compact) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-card p-2.5',
          good ? 'border-correct/30' : 'border-wrong/40'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase leading-tight tracking-wide text-muted-foreground">
            {label}
          </span>
          {pill}
        </div>
        <div className="mt-1 flex items-end gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xl font-semibold tabular-nums">{value}</span>
              {TrendIcon && (
                <TrendIcon
                  className={cn(
                    'h-4 w-4',
                    delta.better ? 'text-correct-foreground' : 'text-wrong-foreground'
                  )}
                  aria-label={delta.better ? 'improving' : 'getting worse'}
                />
              )}
            </div>
            <div className="text-xs leading-snug text-muted-foreground">{baseline}</div>
          </div>
          <div className="ml-auto w-20 shrink-0 xl:w-24">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border bg-card p-2 sm:p-3',
        good ? 'border-correct/30' : 'border-wrong/40'
      )}
    >
      <div className="flex flex-col-reverse items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span className="text-xs font-medium uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </span>
        {pill}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-lg font-semibold tabular-nums sm:text-2xl">{value}</span>
        {TrendIcon && (
          <span
            className={cn(
              'hidden items-center gap-0.5 text-xs sm:inline-flex',
              delta.better ? 'text-correct-foreground' : 'text-wrong-foreground'
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {delta.better ? 'improving' : 'getting worse'}
          </span>
        )}
      </div>
      <div className="hidden text-xs text-muted-foreground sm:block">{baseline}</div>
      <div className="mt-2 hidden sm:block">{children}</div>
    </div>
  );
}

function HealthStrip({ s, game, stacked }: { s: Scenario; game: GameState; stacked?: boolean }) {
  const hist = game.history;
  const now = currentPoint(game);
  const before = hist[Math.max(0, hist.length - 4)];
  const base = hist[0];
  const trend = (cur: number, prev: number, lowerIsBetter: boolean, eps: number): Trend => {
    if (Math.abs(cur - prev) < eps) return { dir: 'flat', better: false };
    return { dir: cur < prev ? 'down' : 'up', better: cur < prev === lowerIsBetter };
  };
  const successLow = now.success < now.demand * 0.99;
  const constraintOk = s.isHealthy({ ...now, failed: 0 });
  return (
    <div className={cn('grid gap-2', stacked ? 'grid-cols-1' : 'grid-cols-3 sm:gap-3')}>
      <SignalCard
        label="Failed checkout requests"
        value={`${now.failed.toFixed(1)}%`}
        baseline={`Normal: ${base.failed.toFixed(1)}%`}
        delta={trend(now.failed, before.failed, true, Math.max(1, before.failed * 0.15))}
        good={now.failed < 1}
        compact={stacked}
      >
        <Sparkline values={hist.map((p) => p.failed)} threshold={1} bad={now.failed >= 1} />
      </SignalCard>
      <SignalCard
        label={s.successLabel}
        value={fmtCount(now.success)}
        baseline={`of ${fmtCount(now.demand)} attempted (${Math.round((now.success / now.demand) * 100)}%). Normally 99% or more succeed.`}
        delta={trend(now.success / now.demand, before.success / before.demand, false, 0.02)}
        good={!successLow}
        compact={stacked}
      >
        <Sparkline
          values={hist.map((p) => (p.success / p.demand) * 100)}
          bad={successLow}
          max={100}
        />
      </SignalCard>
      <SignalCard
        label={s.constraint.label}
        value={s.constraint.format(now.constraint)}
        baseline={`Normal: ${s.constraint.format(base.constraint)} (healthy: ${s.constraint.healthy})`}
        delta={trend(now.constraint, before.constraint, s.constraint.lowerIsBetter, 2)}
        good={constraintOk}
        compact={stacked}
      >
        <Sparkline values={hist.map((p) => p.constraint)} bad={!constraintOk} max={100} />
      </SignalCard>
    </div>
  );
}

function FeedEntry({ item, isNew }: { item: FeedItem; isNew: boolean }) {
  const Icon = FEED_ICONS[item.kind];
  const tone =
    item.kind === 'alert'
      ? 'text-wrong-foreground'
      : item.kind === 'hint'
        ? 'text-hint'
        : item.kind === 'change'
          ? 'text-primary'
          : 'text-muted-foreground';
  return (
    <li className="flex gap-3 py-2.5">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">T+{pad(item.t)}</span>
          {item.who && <span className="font-medium text-foreground">{item.who}</span>}
          {isNew && (
            <span className="rounded bg-primary/15 px-1.5 text-xs font-semibold uppercase text-foreground">
              new
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm">{item.text}</p>
        {item.evidence && (
          <details className="group mt-2 rounded-md border bg-muted/40" open={isNew}>
            <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Evidence: {item.evidence.title}
            </summary>
            <pre className="overflow-x-auto px-3 pb-2 font-mono text-xs leading-relaxed text-foreground">
              {item.evidence.lines.join('\n')}
            </pre>
          </details>
        )}
        {item.interpretation && (
          <p className="mt-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
            {item.interpretation}
          </p>
        )}
      </div>
    </li>
  );
}

function statusSentence(s: Scenario, game: GameState, withUpdate = true): string {
  const running = game.tasks.filter((t) => t.status === 'running');
  const changes = running.filter((t) => getAction(s, t.actionId).group === 'mitigate').length;
  const investigations = running.filter(
    (t) => getAction(s, t.actionId).group === 'investigate'
  ).length;
  const due = nextUpdateDue(game) - game.t;
  const parts = [
    changes
      ? `${changes} production change${changes > 1 ? 's' : ''} in progress.`
      : 'No production changes in progress.',
    investigations
      ? `${investigations} investigation${investigations > 1 ? 's' : ''} running.`
      : 'Nobody is investigating.',
  ];
  if (withUpdate)
    parts.push(
      due >= 0 ? `Next status update due in ${due} min.` : `Status update overdue by ${-due} min.`
    );
  return parts.join(' ');
}

function Situation({ s, game, seen }: { s: Scenario; game: GameState; seen: number }) {
  const now = currentPoint(game);
  const failedSoFar = game.history
    .filter((p) => p.t > 0)
    .reduce((sum, p) => sum + (p.demand * p.failed) / 100, 0);
  const findings = game.feed
    .filter((f) => f.kind === 'result' && f.interpretation)
    .slice(-3)
    .reverse();
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" /> Situation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 text-sm">
        <p>
          Right now <strong className="tabular-nums">{now.failed.toFixed(1)}%</strong> of checkout
          requests fail, out of {fmtCount(now.demand)} attempts a minute.{' '}
          {game.t > 0 && (
            <>
              About <strong className="tabular-nums">{fmtCount(failedSoFar)}</strong> checkout
              requests have failed since the page.
            </>
          )}
        </p>
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Open questions
          </h4>
          <ul className="space-y-1">
            {s.openQuestions.map((q) => {
              const done = game.findings.includes(q.answeredBy);
              const Icon = done ? CircleCheck : Circle;
              return (
                <li
                  key={q.text}
                  className={cn(
                    'flex gap-2',
                    done && 'text-muted-foreground line-through decoration-muted-foreground/40'
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      done ? 'text-correct-foreground' : 'text-muted-foreground'
                    )}
                    aria-hidden="true"
                  />
                  {q.text}
                </li>
              );
            })}
          </ul>
        </div>
        {findings.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Latest findings
            </h4>
            <ul className="space-y-2">
              {findings.map((f) => (
                <li key={f.id} className="rounded-md border bg-muted/30 p-2">
                  <span className="text-xs text-muted-foreground">
                    T+{pad(f.t)} {f.who}{' '}
                    {f.id > seen && (
                      <span className="rounded bg-primary/15 px-1 font-semibold text-foreground">
                        new
                      </span>
                    )}
                  </span>
                  <p>{f.interpretation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details className="rounded-md border">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent changes ({s.recentChanges.length})
          </summary>
          <ul className="space-y-1 px-3 pb-2">
            {s.recentChanges.map((c) => (
              <li key={c.text} className="flex gap-2">
                <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  T{c.t} · {clockAt(s, c.t)}
                </span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

function Timeline({ game, seen }: { game: GameState; seen: number }) {
  const items = [...game.feed].reverse();
  return (
    <Card>
      <CardHeader className="rounded-t-lg bg-card p-4 pb-1 lg:sticky lg:top-0 lg:z-10">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> Activity
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Newest first. Evidence from your team opens automatically when it arrives.
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ol className="divide-y">
          {items.map((item) => (
            <FeedEntry key={item.id} item={item} isNew={item.id > seen} />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ActiveWork({ s, game }: { s: Scenario; game: GameState }) {
  const running = game.tasks.filter((t) => t.status === 'running');
  const people = (['r1', 'r2'] as const).map((id) => ({
    id,
    ...s.responders[id],
    busy: game.busyUntil[id] > game.t,
  }));
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Active work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 text-sm">
        {running.length === 0 && (
          <p className="text-muted-foreground">
            Nothing in progress. Send someone to investigate or change something.
          </p>
        )}
        {running.map((t) => {
          const a = getAction(s, t.actionId);
          const pct = Math.round(((game.t - t.start) / Math.max(1, t.end - t.start)) * 100);
          return (
            <div key={t.uid} className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{a.title}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  done T+{pad(t.end)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{ownerName(s, t.owner)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {people.map((p) => (
            <span
              key={p.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                p.busy ? 'border-partial/40' : 'border-correct/40'
              )}
            >
              <span
                className={cn('h-2 w-2 rounded-full', p.busy ? 'bg-partial' : 'bg-correct')}
                aria-hidden="true"
              />
              {p.name}, {p.role}: {p.busy ? 'busy' : 'free'}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function blockReason(s: Scenario, game: GameState, a: ActionDef): string | null {
  const b = dispatchBlock(game, a);
  if (b === 'busy')
    return `${ownerName(s, a.owner)} is busy until T+${pad(game.busyUntil[a.owner])}`;
  if (b === 'done') return 'Already done';
  if (b === 'ended') return 'The incident is over';
  return null;
}

function Actions({
  s,
  game,
  group,
  setGroup,
  selected,
  setSelected,
  onDispatch,
}: {
  s: Scenario;
  game: GameState;
  group: ActionGroup;
  setGroup: (g: ActionGroup) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  onDispatch: (id: string) => void;
}) {
  const sel = selected ? s.actions.find((a) => a.id === selected && a.group === group) : undefined;
  return (
    <Card>
      <Tabs
        value={group}
        onValueChange={(v) => {
          setGroup(v as ActionGroup);
          setSelected(null);
        }}
      >
        <CardHeader className="rounded-t-lg bg-card p-4 pb-2 lg:sticky lg:top-0 lg:z-10">
          <CardTitle className="text-base">Decide</CardTitle>
          <TabsList className="mt-2 grid w-full grid-cols-3" aria-label="Action type">
            {GROUPS.map((g) => (
              <TabsTrigger key={g.id} value={g.id} className="gap-1.5 text-xs">
                <g.icon className="hidden h-3.5 w-3.5 xl:block" aria-hidden="true" />
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {GROUPS.map((g) => (
            <TabsContent key={g.id} value={g.id} className="mt-0">
              <ul className="space-y-1.5">
                {s.actions
                  .filter((a) => a.group === g.id)
                  .map((a) => {
                    const reason = blockReason(s, game, a);
                    const active = sel?.id === a.id;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          id={`ic-action-${a.id}`}
                          onClick={() => setSelected(active ? null : a.id)}
                          aria-expanded={active}
                          className={cn(
                            'w-full rounded-md border p-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
                            reason && 'opacity-60'
                          )}
                        >
                          <span className="block font-medium">{a.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{ownerName(s, a.owner)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{a.minutes} min</span>
                            {a.risk && (
                              <Badge
                                variant="outline"
                                className={cn('px-1.5 py-0 text-xs', RISK_STYLES[a.risk])}
                              >
                                {a.risk} risk
                              </Badge>
                            )}
                            {reason && <span className="text-partial-foreground">{reason}</span>}
                          </span>
                        </button>
                        {active && (
                          <div className="mt-1.5 space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                            <p>{a.detail}</p>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                              <dt className="text-muted-foreground">Who</dt>
                              <dd>
                                {a.owner === 'you'
                                  ? 'You'
                                  : `${s.responders[a.owner].name}, ${s.responders[a.owner].role}`}
                              </dd>
                              <dt className="text-muted-foreground">Takes</dt>
                              <dd>
                                {a.minutes} min (done at T+{pad(game.t + a.minutes)})
                              </dd>
                              {a.group === 'mitigate' && (
                                <>
                                  <dt className="text-muted-foreground">Undo</dt>
                                  <dd>{a.reversible ? 'Reversible' : 'Not easily reversible'}</dd>
                                </>
                              )}
                              {a.expected && (
                                <>
                                  <dt className="text-muted-foreground">Watch for</dt>
                                  <dd>{a.expected}</dd>
                                </>
                              )}
                            </dl>
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={!!reason}
                              onClick={() => onDispatch(a.id)}
                            >
                              {a.owner === 'you' ? (
                                <>
                                  <Megaphone className="mr-1.5 h-4 w-4" aria-hidden="true" /> Post
                                  it
                                </>
                              ) : (
                                <>
                                  <Send className="mr-1.5 h-4 w-4" aria-hidden="true" /> Send to{' '}
                                  {s.responders[a.owner].name}
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  );
}

function ClockControls({
  s,
  game,
  onAdvance,
  onNext,
  onMonitor,
  onResolve,
}: {
  s: Scenario;
  game: GameState;
  onAdvance: () => void;
  onNext: () => void;
  onMonitor: () => void;
  onResolve: () => void;
}) {
  const due = nextUpdateDue(game) - game.t;
  const streak = Math.min(healthyStreak(s, game), SUSTAIN_MINUTES);
  const canResolve = game.phase === 'monitoring' && sustainedHealthy(s, game);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
            due < 0
              ? 'bg-wrong/10 text-wrong-foreground'
              : due <= 3
                ? 'bg-partial/10 text-partial-foreground'
                : 'bg-muted/50'
          )}
        >
          <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
          {due >= 0
            ? `Next status update due in ${due} min`
            : `Status update overdue by ${-due} min`}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onAdvance} disabled={game.ended}>
            <Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> Advance 1 min
          </Button>
          <Button variant="outline" onClick={onNext} disabled={game.ended}>
            <FastForward className="mr-1.5 h-4 w-4" aria-hidden="true" /> Next event
          </Button>
        </div>
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {game.phase === 'responding'
              ? 'When the signals are back to normal, start monitoring.'
              : `Recovery has held for ${streak} of ${SUSTAIN_MINUTES} min. Resolve once it has held the full ${SUSTAIN_MINUTES}.`}
          </p>
          {game.phase === 'responding' ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={onMonitor}
              disabled={game.ended}
            >
              <ShieldAlert className="mr-1.5 h-4 w-4" aria-hidden="true" /> Mark mitigated, start
              monitoring
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={onResolve}
              disabled={game.ended}
              variant={canResolve ? 'default' : 'secondary'}
            >
              <CircleCheck className="mr-1.5 h-4 w-4" aria-hidden="true" /> Resolve incident
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioPicker({ onStart }: { onStart: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">You are the incident commander</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You do not fix things with your own hands. You direct a small team, decide what to try,
          keep customers informed, and decide when the incident is really over.
        </p>
        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-md bg-muted/50 p-3">
            <strong className="block">Send work to your team</strong>
            <span className="text-muted-foreground">
              Each responder takes one task at a time. Investigations answer one question each.
            </span>
          </li>
          <li className="rounded-md bg-muted/50 p-3">
            <strong className="block">Reading is free</strong>
            <span className="text-muted-foreground">
              Time only moves when you advance the clock. Take the time to read the evidence.
            </span>
          </li>
          <li className="rounded-md bg-muted/50 p-3">
            <strong className="block">Verify before you close</strong>
            <span className="text-muted-foreground">
              Recovery has to hold for {SUSTAIN_MINUTES} minutes before you can resolve.
            </span>
          </li>
        </ul>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((s) => (
          <Card key={s.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{s.title}</CardTitle>
                <Badge variant="secondary">{s.difficulty}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{s.tagline}</p>
            </CardHeader>
            <CardContent className="mt-auto space-y-3">
              <p className="text-xs text-muted-foreground">
                Team: {s.responders.r1.name} ({s.responders.r1.role}) and {s.responders.r2.name} (
                {s.responders.r2.role})
              </p>
              <Button className="w-full" onClick={() => onStart(s.id)}>
                <Siren className="mr-1.5 h-4 w-4" aria-hidden="true" /> Take the page
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

function DebriefView({
  s,
  game,
  onAgain,
  onPicker,
}: {
  s: Scenario;
  game: GameState;
  onAgain: () => void;
  onPicker: () => void;
}) {
  const d = useMemo(() => buildDebrief(s, game), [s, game]);
  const [copied, setCopied] = useState(false);
  const { embedded } = useEmbed();
  const other = SCENARIOS.find((x) => x.id !== s.id);
  const decisions = game.tasks.filter((t) => getAction(s, t.actionId).group !== 'communicate');
  const resolved = d.endReason === 'resolved';
  return (
    <SimComplete
      title="Incident review"
      // Running out of time is a losing end: it shows the review but does not tell Opsville.
      tone={resolved ? 'success' : 'danger'}
      signal={resolved}
      badge={
        <>
          <Badge
            variant="outline"
            className={
              resolved
                ? 'border-correct/50 bg-correct/10 text-correct-foreground'
                : 'border-wrong/50 bg-wrong/10 text-wrong-foreground'
            }
          >
            {resolved ? `Resolved at T+${pad(game.t)}` : 'Not resolved in time'}
          </Badge>
          <span className="text-sm text-muted-foreground">{s.title}</span>
        </>
      }
      stats={[
        {
          label: 'Sustained mitigation',
          value: d.mitigatedAt !== null ? `T+${pad(d.mitigatedAt)}` : 'never',
        },
        {
          label: 'Failed checkout requests',
          value: fmtCount(d.failedRequests),
          note: 'Requests, not people: some customers retried.',
        },
        { label: 'Status updates on time', value: `${d.updatesOnTime}/${d.updatesDue}` },
      ]}
      learned={s.debrief.lessons}
      next={null}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() =>
              copyText(buildRecap(s, game, d)).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
            }
          >
            {copied ? (
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy recap'}
          </Button>
          <Button variant="outline" onClick={onAgain}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Play this one again
          </Button>
          {other && (
            <Button onClick={onPicker}>
              <Siren className="mr-1.5 h-4 w-4" aria-hidden="true" /> Try {other.title}
            </Button>
          )}
        </>
      }
    >
      {d.revisit && (
        <SimFeedback tone="warning" icon={TriangleAlert} label="One decision to revisit">
          <p>{d.revisit}</p>
        </SimFeedback>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How you ran it</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Communication
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  {d.firstUpdateAt !== null
                    ? `First status update at T+${pad(d.firstUpdateAt)}.`
                    : 'No status update was posted.'}
                </li>
                {d.missedDeadlines.map((m) => (
                  <li key={`missed-${m}`}>The update due at T+{pad(m)} was not posted in time.</li>
                ))}
                {d.inaccurateUpdates.map((u) => (
                  <li key={u.t + u.kind}>
                    T+{pad(u.t)}: {u.note}
                  </li>
                ))}
                <li>{d.severityNote}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Coordination
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {d.coordination.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Safety
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {d.safety.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your decisions
              </h4>
              <ol className="mt-1 space-y-1">
                {decisions.map((t) => (
                  <li key={t.uid} className="flex gap-2">
                    <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      T+{pad(t.start)}
                    </span>
                    <span>
                      {ownerName(s, t.owner)}: {getAction(s, t.actionId).title}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What was going on</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{s.debrief.rootCause}</p>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                One effective response
              </h4>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {s.debrief.effectiveResponse.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other defensible paths
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {s.debrief.alternatives.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Go deeper
              </h4>
              <ul className="mt-1 space-y-1">
                {s.debrief.goDeeper.map((g) => (
                  <li key={g.href}>
                    <Link
                      href={g.href}
                      // In an embed a link opens the full page in a new tab, not in the frame.
                      {...(embedded ? { target: '_blank', rel: 'noopener' } : {})}
                      className="font-medium underline decoration-primary/60 underline-offset-4 hover:decoration-primary"
                    >
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </SimComplete>
  );
}

function updateChipClass(due: number): string {
  return due < 0
    ? 'bg-wrong/10 text-wrong-foreground'
    : due <= 3
      ? 'bg-partial/10 text-partial-foreground'
      : 'bg-muted/60 text-foreground';
}

export default function IncidentCommanderSimulator() {
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [group, setGroup] = useState<ActionGroup>('investigate');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('situation');
  const [seen, setSeen] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [notice, setNotice] = useState<FeedItem | null>(null);
  const [viewedId, setViewedId] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollPending = useRef(false);

  // Bring the game into view after the player starts a scenario or opens the review.
  useEffect(() => {
    if (!scrollPending.current) return;
    scrollPending.current = false;
    revealTop(rootRef.current, { offset: 16, smooth: true });
  });

  // Newest events are at the top of the feed; show them after the clock moves.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 });
  }, [game?.t]);

  const s = scenarioId ? getScenario(scenarioId) : null;

  const start = (id: string) => {
    const sc = getScenario(id);
    scrollPending.current = true;
    setScenarioId(id);
    setGame(createGame(sc));
    setGroup('investigate');
    setSelected(null);
    setSeen(0);
    setAdvanced(false);
    setReviewing(false);
    setMobileTab('situation');
    setNotice(null);
    setViewedId(0);
  };

  if (!s || !game) {
    return (
      <div ref={rootRef}>
        <ScenarioPicker onStart={start} />
      </div>
    );
  }

  if (reviewing) {
    return (
      <div ref={rootRef}>
        <DebriefView
          s={s}
          game={game}
          onAgain={() => start(s.id)}
          onPicker={() => {
            const other = SCENARIOS.find((x) => x.id !== s.id);
            if (other) start(other.id);
          }}
        />
      </div>
    );
  }

  const run = (id: string) => {
    const a = getAction(s, id);
    setGame(dispatch(s, game, id));
    setSelected(null);
    // Keep keyboard focus on the action that was just sent.
    requestAnimationFrame(() =>
      document.getElementById(`ic-action-${id}`)?.focus({ preventScroll: true })
    );
    setAnnounce(
      a.owner === 'you' ? `Posting: ${a.title}` : `Sent to ${ownerName(s, a.owner)}: ${a.title}`
    );
  };
  // Monitor, resolve and hints answer with a feed message; show it where the player is looking.
  const act = (fn: (g: GameState) => GameState) => {
    const next = fn(game);
    const last = next.feed[next.feed.length - 1];
    setNotice(next.feed.length > game.feed.length && last ? last : null);
    setGame(next);
  };
  const requestDispatch = (id: string) => {
    const a = getAction(s, id);
    if (a.confirm) setConfirming(id);
    else run(id);
  };
  const step = (fn: (g: GameState) => GameState) => {
    setSeen(game.nextId - 1);
    setAdvanced(true);
    setNotice(null);
    const next = fn(game);
    setGame(next);
    if (mobileTab === 'timeline') setViewedId(next.nextId - 1);
    setAnnounce(`Now T+${pad(next.t)}. ${next.feed.length - game.feed.length} new events.`);
  };
  const openReview = () => {
    scrollPending.current = true;
    setReviewing(true);
  };
  const changeTab = (v: string) => {
    setMobileTab(v as MobileTab);
    if (v === 'timeline') setViewedId(game.nextId - 1);
    // Start the new panel at its top instead of where the old one was scrolled to.
    revealTop(tabsRef.current, { onlyIfAbove: true });
  };
  const severities: Severity[] = ['SEV1', 'SEV2', 'SEV3'];
  const confirmAction = confirming ? getAction(s, confirming) : null;
  const running = game.tasks.filter((t) => t.status === 'running').length;
  const due = nextUpdateDue(game) - game.t;
  const streak = Math.min(healthyStreak(s, game), SUSTAIN_MINUTES);
  const canResolve = game.phase === 'monitoring' && sustainedHealthy(s, game);
  const unseen = advanced ? game.feed.filter((f) => f.id > Math.max(seen, viewedId)).length : 0;

  const situation = <Situation s={s} game={game} seen={seen} />;
  const timeline = <Timeline game={game} seen={seen} />;
  const work = (
    <>
      <ActiveWork s={s} game={game} />
      <Actions
        s={s}
        game={game}
        group={group}
        setGroup={setGroup}
        selected={selected}
        setSelected={setSelected}
        onDispatch={requestDispatch}
      />
    </>
  );
  const onAdvance = () => step((g) => advance(s, g, 1));
  const onNext = () => step((g) => advanceToNextEvent(s, g));
  const onMonitor = () => act((g) => startMonitoring(s, g));
  const onResolve = () => act((g) => resolveIncident(s, g));

  return (
    <div ref={rootRef}>
      <SimFrame phoneBar>
        <SimBar
          lead={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 px-2 text-xs text-muted-foreground lg:h-8"
                onClick={() => {
                  setScenarioId(null);
                  setGame(null);
                }}
                aria-label="Back to scenarios"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Scenarios</span>
              </Button>
              <div className="flex min-w-0 items-center gap-2">
                <Siren
                  className={cn(
                    'h-4 w-4 shrink-0',
                    game.ended ? 'text-muted-foreground' : 'text-wrong'
                  )}
                  aria-hidden="true"
                />
                <span className="truncate font-semibold">{s.title}</span>
              </div>
              <Badge
                variant={game.phase === 'monitoring' ? 'secondary' : 'outline'}
                className="capitalize"
              >
                {game.phase}
              </Badge>
              <div className="flex items-center gap-1" role="group" aria-label="Severity">
                {severities.map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setGame(setSeverity(game, sev))}
                    aria-pressed={game.severity === sev}
                    className={cn(
                      'h-10 rounded-md border px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8 lg:px-2',
                      game.severity === sev
                        ? sev === 'SEV1'
                          ? 'border-wrong bg-wrong/15 text-wrong-foreground'
                          : sev === 'SEV2'
                            ? 'border-partial bg-partial/15 text-partial-foreground'
                            : 'border-primary bg-primary/15 text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {sev}
                  </button>
                ))}
                {!game.severity && (
                  <span className="ml-1 text-xs text-partial-foreground">set a severity</span>
                )}
              </div>
            </>
          }
          tools={
            <>
              <SimHintButton
                onClick={() => act((g) => takeHint(s, g))}
                disabled={game.hintLevel >= 3 || game.ended}
              >
                <span className="hidden xl:inline">
                  Ask an experienced IC ({3 - game.hintLevel})
                </span>
                <span className="xl:hidden">Hint ({3 - game.hintLevel})</span>
              </SimHintButton>
              <SimResetButton
                onReset={() => start(s.id)}
                label="Restart this scenario"
                confirmLabel="Restart?"
              />
            </>
          }
          meta={
            <>
              <div className="font-mono text-lg font-semibold tabular-nums">
                T+{pad(game.t)}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {clockAt(s, game.t)}
                </span>
              </div>
              {game.ended ? (
                <p className="text-sm">
                  {game.endReason === 'resolved'
                    ? 'The incident is resolved. See how it went and what to try next time.'
                    : 'Time is up: the incident review starts now, resolved or not.'}
                </p>
              ) : (
                <>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                      updateChipClass(due)
                    )}
                  >
                    <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                    {due >= 0 ? `Update due in ${due} min` : `Update overdue by ${-due} min`}
                  </span>
                  <span className="hidden text-xs text-muted-foreground xl:inline">
                    {statusSentence(s, game, false)}
                  </span>
                </>
              )}
            </>
          }
          actions={
            game.ended ? (
              <Button size="sm" onClick={openReview}>
                See the incident review
              </Button>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                {game.phase === 'monitoring' && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Recovery held {streak}/{SUSTAIN_MINUTES} min
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={onAdvance}>
                  <Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> Advance 1 min
                </Button>
                <Button variant="outline" size="sm" onClick={onNext}>
                  <FastForward className="mr-1.5 h-4 w-4" aria-hidden="true" /> Next event
                </Button>
                {game.phase === 'responding' ? (
                  <Button size="sm" variant="secondary" onClick={onMonitor}>
                    <ShieldAlert className="mr-1.5 h-4 w-4" aria-hidden="true" /> Start monitoring
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={canResolve ? 'default' : 'secondary'}
                    onClick={onResolve}
                  >
                    <CircleCheck className="mr-1.5 h-4 w-4" aria-hidden="true" /> Resolve
                  </Button>
                )}
              </div>
            )
          }
        >
          <SimHowTo summary="Briefing" autoOpen={!advanced && !game.ended}>
            {s.briefing} Reading never advances time: send work to your team, then advance the clock
            to see results.
          </SimHowTo>

          {notice && (
            // On phones the notice floats above the bottom bar, so it needs a solid card under its tint.
            <div className="fixed inset-x-3 bottom-20 z-30 rounded-lg bg-card shadow-lg lg:static lg:bg-transparent lg:shadow-none">
              <SimFeedback
                tone={notice.kind === 'hint' ? 'hint' : 'info'}
                role="status"
                label={notice.who ?? (notice.kind === 'hint' ? 'Hint' : 'Update')}
                onDismiss={() => setNotice(null)}
              >
                <p>{notice.text}</p>
              </SimFeedback>
            </div>
          )}
        </SimBar>

        <SimAnnouncer message={announce} />

        <div className="lg:hidden">
          <HealthStrip s={s} game={game} />
          {!game.ended && (
            <p className="mt-2 text-xs text-muted-foreground">{statusSentence(s, game, false)}</p>
          )}
        </div>

        <SimStage
          columns="lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)]"
          minHeight="min-h-[24rem]"
          tab={mobileTab}
          onTabChange={changeTab}
          anchorRef={tabsRef}
          tabOrder={['situation', 'actions', 'timeline']}
          panels={[
            {
              id: 'situation',
              label: 'Situation',
              className: 'space-y-3',
              content: (
                <>
                  <HealthStrip s={s} game={game} stacked />
                  {situation}
                </>
              ),
              mobile: situation,
            },
            {
              id: 'timeline',
              label: 'Timeline',
              badge: unseen > 0 && mobileTab !== 'timeline' && (
                <SimTabBadge>{unseen} new</SimTabBadge>
              ),
              content: timeline,
              scrollRef: feedRef,
            },
            {
              id: 'actions',
              label: 'Decide',
              className: 'space-y-3',
              content: work,
              mobile: (
                <>
                  {work}
                  <ClockControls
                    s={s}
                    game={game}
                    onAdvance={onAdvance}
                    onNext={onNext}
                    onMonitor={onMonitor}
                    onResolve={onResolve}
                  />
                </>
              ),
            },
          ]}
        />

        {!game.ended && (
          <SimPhoneBar>
            <span className="mr-auto text-xs text-muted-foreground">
              T+{pad(game.t)} · {running} task{running === 1 ? '' : 's'} running
            </span>
            <Button size="sm" variant="outline" onClick={onAdvance}>
              <Play className="mr-1 h-4 w-4" aria-hidden="true" /> 1 min
            </Button>
            <Button size="sm" onClick={onNext}>
              <FastForward className="mr-1 h-4 w-4" aria-hidden="true" /> Next event
            </Button>
          </SimPhoneBar>
        )}

        <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmAction?.confirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirming) run(confirming);
                  setConfirming(null);
                }}
              >
                Do it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SimFrame>
    </div>
  );
}
