'use client';

import { useEffect, useMemo, useState } from 'react';
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
  low: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  medium: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  high: 'border-red-500/50 text-red-700 dark:text-red-400',
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
  const stroke = bad ? 'stroke-red-500' : 'stroke-emerald-500';
  const fill = bad ? 'fill-red-500/10' : 'fill-emerald-500/10';
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
  children,
}: {
  label: string;
  value: string;
  baseline: string;
  delta: Trend;
  good: boolean;
  children: React.ReactNode;
}) {
  const TrendIcon = delta.dir === 'flat' ? null : delta.dir === 'down' ? TrendingDown : TrendingUp;
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border bg-card p-2 sm:p-3',
        good ? 'border-emerald-500/30' : 'border-red-500/40'
      )}
    >
      <div className="flex flex-col-reverse items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-[11px]',
            good
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-700 dark:text-red-400'
          )}
        >
          {good ? 'Normal' : 'Not normal'}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-lg font-semibold tabular-nums sm:text-2xl">{value}</span>
        {TrendIcon && (
          <span
            className={cn(
              'hidden items-center gap-0.5 text-xs sm:inline-flex',
              delta.better ? 'text-emerald-600' : 'text-red-600'
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

function HealthStrip({ s, game }: { s: Scenario; game: GameState }) {
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
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <SignalCard
        label="Failed checkout requests"
        value={`${now.failed.toFixed(1)}%`}
        baseline={`Normal: ${base.failed.toFixed(1)}%`}
        delta={trend(now.failed, before.failed, true, Math.max(1, before.failed * 0.15))}
        good={now.failed < 1}
      >
        <Sparkline values={hist.map((p) => p.failed)} threshold={1} bad={now.failed >= 1} />
      </SignalCard>
      <SignalCard
        label={s.successLabel}
        value={fmtCount(now.success)}
        baseline={`of ${fmtCount(now.demand)} attempted (${Math.round((now.success / now.demand) * 100)}%). Normally 99% or more succeed.`}
        delta={trend(now.success / now.demand, before.success / before.demand, false, 0.02)}
        good={!successLow}
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
      ? 'text-red-600 dark:text-red-400'
      : item.kind === 'hint'
        ? 'text-amber-600 dark:text-amber-400'
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
            <span className="rounded bg-primary/10 px-1.5 text-[10px] font-semibold uppercase text-primary">
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
            <pre className="overflow-x-auto px-3 pb-2 font-mono text-[12px] leading-relaxed text-foreground">
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

function statusSentence(s: Scenario, game: GameState): string {
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
    due >= 0 ? `Next status update due in ${due} min.` : `Status update overdue by ${-due} min.`,
  ];
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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" /> Situation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
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
                      done ? 'text-emerald-600' : 'text-muted-foreground'
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
                    {f.id > seen && <span className="font-semibold text-primary">new</span>}
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
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> Activity
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Newest first. Evidence from your team opens automatically when it arrives.
        </p>
      </CardHeader>
      <CardContent>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Active work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
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
                    className="h-full rounded-full bg-primary transition-all"
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
                p.busy ? 'border-amber-500/40' : 'border-emerald-500/40'
              )}
            >
              <span
                className={cn('h-2 w-2 rounded-full', p.busy ? 'bg-amber-500' : 'bg-emerald-500')}
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Decide</CardTitle>
          <TabsList className="mt-2 grid w-full grid-cols-3" aria-label="Action type">
            {GROUPS.map((g) => (
              <TabsTrigger key={g.id} value={g.id} className="gap-1.5 text-xs">
                <g.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </CardHeader>
        <CardContent>
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
                                className={cn('px-1.5 py-0 text-[10px]', RISK_STYLES[a.risk])}
                              >
                                {a.risk} risk
                              </Badge>
                            )}
                            {reason && (
                              <span className="text-amber-700 dark:text-amber-400">{reason}</span>
                            )}
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
      <CardContent className="space-y-3 pt-5">
        <div
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
            due < 0
              ? 'bg-red-500/10 text-red-700 dark:text-red-400'
              : due <= 3
                ? 'bg-amber-500/10'
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
  const other = SCENARIOS.find((x) => x.id !== s.id);
  const decisions = game.tasks.filter((t) => getAction(s, t.actionId).group !== 'communicate');
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={d.endReason === 'resolved' ? 'default' : 'destructive'}>
            {d.endReason === 'resolved' ? `Resolved at T+${pad(game.t)}` : 'Not resolved in time'}
          </Badge>
          <span className="text-sm text-muted-foreground">{s.title}</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold">Incident review</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-muted/50 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Sustained mitigation
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {d.mitigatedAt !== null ? `T+${pad(d.mitigatedAt)}` : 'never'}
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Failed checkout requests
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {fmtCount(d.failedRequests)}
            </div>
            <div className="text-xs text-muted-foreground">
              Requests, not people: some customers retried.
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Status updates on time
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {d.updatesOnTime}/{d.updatesDue}
            </div>
          </div>
        </div>
      </div>

      {d.revisit && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" /> One decision to
            revisit
          </h3>
          <p className="mt-1 text-sm">{d.revisit}</p>
        </div>
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
                Take away
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {s.debrief.lessons.map((x) => (
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
                    <Link href={g.href} className="text-primary underline-offset-4 hover:underline">
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
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
      </div>
    </div>
  );
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
  const [focusId, setFocusId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [notice, setNotice] = useState<FeedItem | null>(null);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`ic-action-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const s = scenarioId ? getScenario(scenarioId) : null;

  const start = (id: string) => {
    const sc = getScenario(id);
    setScenarioId(id);
    setGame(createGame(sc));
    setGroup('investigate');
    setSelected(null);
    setSeen(0);
    setAdvanced(false);
    setReviewing(false);
    setMobileTab('situation');
    setNotice(null);
  };

  if (!s || !game) {
    return <ScenarioPicker onStart={start} />;
  }

  if (reviewing) {
    return (
      <DebriefView
        s={s}
        game={game}
        onAgain={() => start(s.id)}
        onPicker={() => {
          const other = SCENARIOS.find((x) => x.id !== s.id);
          if (other) start(other.id);
        }}
      />
    );
  }

  const run = (id: string) => {
    const a = getAction(s, id);
    setGame(dispatch(s, game, id));
    setSelected(null);
    setFocusId(id);
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
    setAnnounce(`Now T+${pad(next.t)}. ${next.feed.length - game.feed.length} new events.`);
  };
  const severities: Severity[] = ['SEV1', 'SEV2', 'SEV3'];
  const confirmAction = confirming ? getAction(s, confirming) : null;
  const running = game.tasks.filter((t) => t.status === 'running').length;

  const situation = <Situation s={s} game={game} seen={seen} />;
  const timeline = <Timeline game={game} seen={seen} />;
  const decide = (
    <div className="space-y-4">
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
      <ClockControls
        s={s}
        game={game}
        onAdvance={() => step((g) => advance(s, g, 1))}
        onNext={() => step((g) => advanceToNextEvent(s, g))}
        onMonitor={() => act((g) => startMonitoring(s, g))}
        onResolve={() => act((g) => resolveIncident(s, g))}
      />
    </div>
  );

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3">
        <button
          onClick={() => {
            setScenarioId(null);
            setGame(null);
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Scenarios
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Siren
              className={cn('h-4 w-4', game.ended ? 'text-muted-foreground' : 'text-red-600')}
              aria-hidden="true"
            />
            <span className="font-semibold">{s.title}</span>
          </div>
        </div>
        <div className="font-mono text-lg font-semibold tabular-nums" aria-live="polite">
          T+{pad(game.t)}{' '}
          <span className="text-sm font-normal text-muted-foreground">{clockAt(s, game.t)}</span>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Severity">
          {severities.map((sev) => (
            <button
              key={sev}
              onClick={() => setGame(setSeverity(game, sev))}
              aria-pressed={game.severity === sev}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                game.severity === sev
                  ? sev === 'SEV1'
                    ? 'border-red-500 bg-red-500 text-white'
                    : sev === 'SEV2'
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {sev}
            </button>
          ))}
          {!game.severity && (
            <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">set a severity</span>
          )}
        </div>
        <Badge variant={game.phase === 'monitoring' ? 'default' : 'outline'} className="capitalize">
          {game.phase}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => act((g) => takeHint(s, g))}
            disabled={game.hintLevel >= 3 || game.ended}
          >
            <Lightbulb className="mr-1.5 h-4 w-4" aria-hidden="true" /> Ask an experienced IC (
            {3 - game.hintLevel})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => start(s.id)}
            aria-label="Restart this scenario"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {game.ended ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm">
            {game.endReason === 'resolved'
              ? 'The incident is resolved. See how it went and what to try next time.'
              : 'Time is up: the incident review starts now, resolved or not.'}
          </p>
          <Button onClick={() => setReviewing(true)}>See the incident review</Button>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
          {!advanced && (
            <p className="mb-1 font-medium">
              {s.briefing} Reading never advances time: send work to your team, then advance the
              clock to see results.
            </p>
          )}
          <p className="text-muted-foreground">{statusSentence(s, game)}</p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {notice && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border p-3 text-sm',
            notice.kind === 'hint'
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-primary/30 bg-primary/5'
          )}
          role="status"
        >
          {notice.kind === 'hint' ? (
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <p className="flex-1">
            {notice.who && <strong>{notice.who}: </strong>}
            {notice.text}
          </p>
          <button
            onClick={() => setNotice(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      <HealthStrip s={s} game={game} />

      <div className="hidden gap-4 lg:grid lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {situation}
          {timeline}
        </div>
        {decide}
      </div>
      <Tabs
        value={mobileTab}
        onValueChange={(v) => setMobileTab(v as MobileTab)}
        className="lg:hidden"
      >
        <TabsList className="grid w-full grid-cols-3" aria-label="Panels">
          <TabsTrigger value="situation">Situation</TabsTrigger>
          <TabsTrigger value="actions">Decide</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="situation">{situation}</TabsContent>
        <TabsContent value="actions">{decide}</TabsContent>
        <TabsContent value="timeline">{timeline}</TabsContent>
      </Tabs>

      {!game.ended && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              T+{pad(game.t)} · {running} task{running === 1 ? '' : 's'} running
            </span>
            <Button size="sm" variant="outline" onClick={() => step((g) => advance(s, g, 1))}>
              <Play className="mr-1 h-4 w-4" aria-hidden="true" /> 1 min
            </Button>
            <Button size="sm" onClick={() => step((g) => advanceToNextEvent(s, g))}>
              <FastForward className="mr-1 h-4 w-4" aria-hidden="true" /> Next event
            </Button>
          </div>
        </div>
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
    </div>
  );
}
