'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CalendarClock, CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimResetButton,
  SimStage,
  SimTabBadge,
  revealTop,
  useMissions,
  useSimGame,
  type Mission,
  type SimTone,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import {
  parseCron,
  nextFireTimes,
  describeCron,
  observations,
  findNextTransition,
  EXAMPLES,
  TIMEZONES,
  type FieldName,
  type FieldSpec,
  type Observation,
} from '@/lib/games/cron-sim-engine';

/**
 * Cron Expression Simulator.
 *
 * You type a cron expression and it answers the only question that settles a
 * cron argument: when does this actually fire, in the zone the scheduler runs
 * in. The parser and the schedule are real and run in the browser, so an
 * expression you invent is treated exactly like the shipped examples.
 *
 * The grids are the reason this exists. Seeing 60 minute cells with nine of
 * them lit is how `*\/7` stops being an abstract argument.
 *
 * Engine and its tests: lib/games/cron-sim-engine.ts
 */

const FIELD_LABELS: { name: FieldName; label: string; range: string }[] = [
  { name: 'minute', label: 'minute', range: '0-59' },
  { name: 'hour', label: 'hour', range: '0-23' },
  { name: 'dom', label: 'day of month', range: '1-31' },
  { name: 'month', label: 'month', range: '1-12' },
  { name: 'dow', label: 'day of week', range: '0-7' },
];

const COUNT_OPTIONS = [5, 10, 25];

/** `2026-09-16T11:40` for a datetime-local input, from an instant, in a zone. */
function toLocalInput(at: number, tz: string): string {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}`;
}

/** The instant a `2026-09-16T11:40` string refers to in a zone. */
function fromLocalInput(value: string, tz: string): number | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // One correction pass is enough for every real zone offset.
  const probe = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const wallAsUtc = (t: number) => {
    const p = Object.fromEntries(probe.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour) % 24,
      Number(p.minute)
    );
  };
  let guess = wanted - (wallAsUtc(wanted) - wanted);
  guess = wanted - (wallAsUtc(guess) - guess);
  return guess;
}

/** A row of cells, lit where the field matches. The `*\/7` lesson, made visible. */
function ValueGrid({ spec, from, to }: { spec: FieldSpec; from: number; to: number }) {
  const hit = useMemo(() => new Set(spec.values), [spec.values]);
  const cells = [];
  for (let v = from; v <= to; v++) {
    cells.push(
      <span
        key={v}
        title={String(v)}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-sm border font-mono text-xs tabular-nums',
          hit.has(v)
            ? 'border-primary bg-primary/20 text-foreground'
            : 'border-transparent bg-muted/70 text-muted-foreground'
        )}
      >
        {v % 5 === 0 || to - from < 13 ? v : ''}
      </span>
    );
  }
  return (
    <>
      <div className="flex flex-wrap gap-[3px]" aria-hidden="true">
        {cells}
      </div>
      <p className="sr-only">Matches: {spec.values.join(', ')}</p>
    </>
  );
}

const EXAMPLES_TO_FINISH = 4;

/** The hidden finish rule, made visible: four examples opened, the first one counts. */
const ORDINAL = ['first', 'second', 'third', 'fourth'];
const MISSIONS: Mission<{ opened: number }>[] = ORDINAL.map((word, i) => ({
  id: `open-${i + 1}`,
  label: i === 0 ? 'Open a first example (one is open already)' : `Open a ${word} example`,
  hint: 'Pick one from the examples list and read what it teaches.',
  check: (s) => s.opened >= i + 1,
}));

const NOTE_TONE: Record<Observation['kind'], SimTone> = {
  frequency: 'danger',
  or: 'warning',
  gap: 'warning',
  dst: 'info',
  note: 'info',
};

const FIELD =
  'h-10 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9';

type Tab = 'schedule' | 'examples' | 'matches';

export default function CronExpressionSimulator() {
  const [expr, setExpr] = useState(EXAMPLES[0].expr);
  const [tz, setTz] = useState('UTC');
  const [count, setCount] = useState(5);
  const [active, setActive] = useState(EXAMPLES[0].id);
  const [copied, setCopied] = useState(false);
  /** null means "from now", which is what people want unless they say otherwise. */
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  /** Examples opened so far. Looking at four of them counts as finishing the lesson. */
  const [opened, setOpened] = useState<Set<string>>(() => new Set([EXAMPLES[0].id]));
  const [tab, setTab] = useState<Tab>('schedule');
  /** "Keep exploring" closes the end card; free play goes on. */
  const [dismissed, setDismissed] = useState(false);
  // The marker above the phone tabs, kept in state so handlers built during render can use it.
  const [tabsAnchor, setTabsAnchor] = useState<HTMLDivElement | null>(null);
  const game = useSimGame();
  const uid = useId();

  // Done at the same moment as before: when the fourth example is opened.
  const finished = opened.size >= EXAMPLES_TO_FINISH;
  const missionState = useMemo(() => ({ opened: opened.size }), [opened.size]);
  const missions = useMissions(MISSIONS, missionState);

  // Date.now() only after mount: a static export would otherwise render a
  // build-time clock into the HTML and hydrate to a different one.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const from = startAt ?? now;
  const parsed = useMemo(() => parseCron(expr), [expr]);
  const schedule = useMemo(
    () => (from === null ? null : nextFireTimes(parsed, tz, count, from)),
    [parsed, tz, count, from]
  );
  const sentence = useMemo(() => describeCron(parsed), [parsed]);
  const notes = useMemo(
    () => (schedule ? observations(parsed, schedule, tz) : []),
    [parsed, schedule, tz]
  );
  const transition = useMemo(
    () => (from === null ? null : findNextTransition(tz, from)),
    [tz, from]
  );

  const pick = useCallback((id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setActive(id);
    setOpened((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setExpr(ex.expr);
    setTz(ex.tz ?? 'UTC');
    setStartAt(ex.from ? Date.parse(ex.from) : null);
  }, []);

  const onExpr = (value: string) => {
    setExpr(value);
    setActive('');
  };

  const copy = () => {
    void navigator.clipboard?.writeText(expr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const jumpToTransition = () => {
    if (!transition) return;
    // A day before the change, so the runs either side of it are both in view.
    setStartAt(transition.at - 26 * 3_600_000);
  };

  const onPick = (id: string) => {
    pick(id);
    // On phones the list is its own tab: show the schedule the example opened.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setTab('schedule');
      revealTop(tabsAnchor, { onlyIfAbove: true });
    }
  };

  const startOver = () => {
    pick(EXAMPLES[0].id);
    setOpened(new Set([EXAMPLES[0].id]));
    setCount(5);
    setDismissed(false);
    missions.reset();
    setTab('schedule');
  };

  const errorFields = new Set(parsed.errors.map((e) => e.field).filter(Boolean));
  const parts = parsed.normalised.split(/\s+/);
  const activeExample = EXAMPLES.find((e) => e.id === active);

  const examples = (k: string) => (
    <div className="space-y-2">
      <SimMissionList missions={missions.missions} />
      <section
        aria-labelledby={`${uid}-${k}-examples-title`}
        className="rounded-lg border bg-card p-2.5"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id={`${uid}-${k}-examples-title`} className="text-sm font-semibold">
            Examples
          </h3>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {opened.size} of {EXAMPLES.length} opened
          </span>
        </div>
        <div className="space-y-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              aria-pressed={ex.id === active}
              onClick={() => onPick(ex.id)}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                ex.id === active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-snug">{ex.label}</span>
                <span className="block font-mono text-xs text-muted-foreground">{ex.expr}</span>
              </span>
              {opened.has(ex.id) && (
                <>
                  <CircleCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-correct-foreground"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(opened)</span>
                </>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const scheduleView = (k: string) => (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <input
          className={cn(
            'h-12 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-lg tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xl',
            !parsed.ok && 'border-wrong/60'
          )}
          value={expr}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Cron expression"
          aria-invalid={!parsed.ok}
          onChange={(e) => onExpr(e.target.value)}
        />
        <Button type="button" variant="outline" className="h-12" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {FIELD_LABELS.map((f, i) => {
          const bad = !parsed.ok && errorFields.has(f.name);
          return (
            <div
              key={f.name}
              className={cn(
                'min-w-0 rounded-md border bg-muted/50 px-1 py-2 text-center',
                bad && 'border-wrong/60 bg-wrong/10'
              )}
            >
              <div className="truncate font-mono text-sm">
                {parsed.ok ? parts[i] : (parts[i] ?? '-')}
              </div>
              <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{f.label}</div>
              <div className="mt-1 hidden text-xs leading-snug text-muted-foreground sm:block">
                {parsed.ok && parsed.fields ? parsed.fields[f.name].describe : f.range}
              </div>
            </div>
          );
        })}
      </div>

      {!parsed.ok && (
        <SimFeedback tone="danger" role="alert" label="This expression does not parse">
          {parsed.errors.map((e, i) => (
            <div key={i}>
              <p className="font-medium">{e.message}</p>
              {e.hint && <p className="text-muted-foreground">{e.hint}</p>}
            </div>
          ))}
        </SimFeedback>
      )}

      {parsed.ok && (
        <div>
          <p className="text-base font-medium leading-relaxed sm:text-lg">{sentence}</p>
          {parsed.macro && (
            <p className="mt-1 text-sm text-muted-foreground">
              <code className="font-mono">{parsed.macro}</code> expands to{' '}
              <code className="font-mono">{parsed.normalised}</code>
            </p>
          )}
        </div>
      )}

      {activeExample && (
        <div className="rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm leading-relaxed">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why this example
          </p>
          <p className="mt-0.5">{activeExample.teaches}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div>
          <label
            htmlFor={`${uid}-${k}-tz`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Timezone
          </label>
          <select
            id={`${uid}-${k}-tz`}
            className={FIELD}
            value={tz}
            onChange={(e) => setTz(e.target.value)}
          >
            {TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${uid}-${k}-from`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            From
          </label>
          <div className="flex gap-1">
            <input
              id={`${uid}-${k}-from`}
              className={FIELD}
              type="datetime-local"
              value={from === null ? '' : toLocalInput(from, tz)}
              onChange={(e) => {
                const at = fromLocalInput(e.target.value, tz);
                if (at !== null) setStartAt(at);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 lg:h-9"
              onClick={() => setStartAt(null)}
              disabled={startAt === null}
            >
              Now
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 lg:h-9"
          onClick={jumpToTransition}
          disabled={!transition}
          title={
            transition
              ? `${transition.localBefore} ${transition.abbrBefore} jumps to ${transition.localAfter} ${transition.abbrAfter}`
              : `${tz} has no daylight saving`
          }
        >
          {transition
            ? `Jump to the ${transition.shiftMinutes > 0 ? 'clock going forward' : 'clock going back'}`
            : 'No clock change in this zone'}
        </Button>
        <div className="flex gap-1" role="group" aria-label="How many runs">
          {COUNT_OPTIONS.map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={n === count ? 'default' : 'outline'}
              aria-pressed={n === count}
              className="h-10 w-11 lg:h-9"
              onClick={() => setCount(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <section
        className="overflow-hidden rounded-lg border bg-card"
        aria-labelledby={`${uid}-${k}-runs`}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h3 id={`${uid}-${k}-runs`} className="text-sm font-semibold">
            Next {count} runs
          </h3>
          <span className="font-mono text-xs text-muted-foreground">{tz}</span>
        </div>
        {schedule === null ? (
          <p className="p-3 text-sm text-muted-foreground">Working out the schedule.</p>
        ) : schedule.never ? (
          <p className="p-3 text-sm text-muted-foreground">
            {parsed.ok
              ? `This never fires. Nothing matches in the next ${Math.round(schedule.horizonDays / 365)} years, which for a valid expression means the date it asks for does not exist.`
              : 'Fix the expression above to see a schedule.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 text-right font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {schedule.times.map((t, i) => {
                  const odd =
                    t.gapMinutes !== null &&
                    schedule.times.some(
                      (o) => o.gapMinutes !== null && o.gapMinutes !== t.gapMinutes
                    );
                  return (
                    <tr
                      key={`${t.at}-${i}`}
                      className={cn('border-b last:border-0', t.repeated && 'bg-partial/10')}
                    >
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono">
                        {t.local}
                        <span className="ml-2 text-xs text-muted-foreground">{t.zoneAbbr}</span>
                        {t.repeated && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-partial/60 font-sans text-partial-foreground"
                          >
                            twice
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{t.weekday}</td>
                      <td
                        className={cn(
                          'whitespace-nowrap px-3 py-1.5 text-right font-mono',
                          odd ? 'font-semibold text-partial-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {t.gapMinutes === null ? '' : formatGap(t.gapMinutes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {schedule && schedule.skipped.length > 0 && (
        <SimFeedback tone="info" label="Skipped runs">
          <p>
            Skipped: {schedule.skipped.map((s) => s.local).join(', ')}. The clock jumped forward
            over {schedule.skipped.length === 1 ? 'it' : 'them'}, so nothing ran.
          </p>
        </SimFeedback>
      )}
    </div>
  );

  const matches = (k: string) => (
    <div className="space-y-2">
      <section className="rounded-lg border bg-card p-2.5" aria-labelledby={`${uid}-${k}-matches`}>
        <h3 id={`${uid}-${k}-matches`} className="mb-2 text-sm font-semibold">
          What matches
        </h3>
        {parsed.ok && parsed.fields ? (
          <div className="space-y-2">
            {(
              [
                ['minutes of the hour', parsed.fields.minute, 0, 59, 60],
                ['hours of the day', parsed.fields.hour, 0, 23, 24],
                ['days of the month', parsed.fields.dom, 1, 31, 31],
              ] as const
            ).map(([label, spec, lo, hi, total]) => (
              <div key={label}>
                <p className="mb-1.5 flex justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <span>{label}</span>
                  <span className="font-mono tabular-nums">
                    {spec.values.length} of {total}
                  </span>
                </p>
                <ValueGrid spec={spec} from={lo} to={hi} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The grids appear once the expression parses.
          </p>
        )}
      </section>

      {notes.map((o, i) => (
        <SimFeedback key={i} tone={NOTE_TONE[o.kind]} label={<Ticked text={o.title} />}>
          <p className="leading-relaxed">
            <Ticked text={o.body} />
          </p>
        </SimFeedback>
      ))}
    </div>
  );

  return (
    <SimFrame>
      <SimBar
        title="Cron Expression Simulator"
        icon={CalendarClock}
        tools={<SimResetButton onReset={startOver} />}
        progress={{ current: missions.done, total: missions.total }}
        heading={activeExample ? activeExample.label : 'Your own expression'}
        meta={game?.level && <Badge variant="secondary">{game.level}</Badge>}
        goal={
          finished
            ? 'Done. Keep exploring: type your own expression, or try the daylight saving examples.'
            : `Open ${EXAMPLES_TO_FINISH} examples and read what each one teaches (${opened.size} of ${EXAMPLES_TO_FINISH} open).`
        }
      />

      <SimAnnouncer message={activeExample ? `${activeExample.label}: ${sentence}` : ''} />

      {finished && !dismissed ? (
        <SimComplete
          title="Lab complete"
          summary={`You opened ${opened.size} of the ${EXAMPLES.length} examples. The parser and the schedule work the same for anything you type, so keep trying your own expressions.`}
          stats={[
            { label: 'Examples opened', value: `${opened.size}/${EXAMPLES.length}` },
            { label: 'Missions', value: `${missions.done}/${missions.total}` },
          ]}
          actions={
            <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
              Keep exploring
            </Button>
          }
          onPlayAgain={startOver}
          playAgainLabel="Start over"
        />
      ) : (
        <SimStage
          columns="lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.45fr)_minmax(0,1fr)]"
          minHeight="min-h-[26rem]"
          tab={tab}
          onTabChange={(t) => setTab(t as Tab)}
          anchorRef={setTabsAnchor}
          tabsLabel="Cron panels"
          tabOrder={['schedule', 'examples', 'matches']}
          panels={[
            {
              id: 'examples',
              label: 'Examples',
              badge: !finished && tab !== 'examples' && (
                <SimTabBadge>
                  {opened.size}/{EXAMPLES_TO_FINISH}
                </SimTabBadge>
              ),
              content: examples('d'),
              mobile: examples('m'),
            },
            {
              id: 'schedule',
              label: 'Schedule',
              content: scheduleView('d'),
              mobile: scheduleView('m'),
            },
            {
              id: 'matches',
              label: 'Matches',
              badge: notes.length > 0 && tab !== 'matches' && (
                <SimTabBadge>{notes.length}</SimTabBadge>
              ),
              content: matches('d'),
              mobile: matches('m'),
            },
          ]}
        />
      )}
    </SimFrame>
  );
}

function formatGap(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Renders the engine's backtick spans as <code>, as React nodes rather than HTML. */
function Ticked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((chunk, i) =>
        chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2 ? (
          <code key={i} className="rounded bg-muted px-1 font-mono text-[0.92em]">
            {chunk.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{chunk}</span>
        )
      )}
    </>
  );
}
