'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUrlState } from './use-url-state';
import {
  parseCron,
  nextFireTimes,
  describeCron,
  TIMEZONES,
  type FieldName,
} from '@/lib/games/cron-sim-engine';

/**
 * Cron parser utility.
 *
 * Paste an expression, get the next runs. The parsing and the schedule come
 * from lib/games/cron-sim-engine.ts, the same engine behind
 * /games/cron-expression-simulator, so the two pages cannot disagree.
 *
 * This used to carry its own parser. It got the day-of-month/day-of-week rule
 * wrong (POSIX ORs those two fields when both are restricted, it ANDed them
 * unconditionally), could not read `MON` or `JAN`, and searched only a year
 * ahead, so a February 29 schedule reported no runs at all.
 */

const PRESETS = ['0 9 * * 1-5', '*/5 * * * *', '0 0 * * 0', '@daily', '30 2 * * 1', '0 */6 * * *'];

const FIELD_ORDER: { name: FieldName; label: string }[] = [
  { name: 'minute', label: 'minute' },
  { name: 'hour', label: 'hour' },
  { name: 'dom', label: 'day of month' },
  { name: 'month', label: 'month' },
  { name: 'dow', label: 'day of week' },
];

export function CronParser() {
  const [expr, setExpr] = useUrlState('cron', '0 9 * * 1-5');
  const [tz, setTz] = useState('UTC');
  // The browser clock and zone only after mount, so a statically exported page
  // does not bake in a build-time answer and then hydrate to a different one.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (local) setTz(local);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const parsed = useMemo(() => parseCron(expr), [expr]);
  const schedule = useMemo(
    () => (now === null ? null : nextFireTimes(parsed, tz, 5, now)),
    [parsed, tz, now],
  );
  const sentence = useMemo(() => describeCron(parsed), [parsed]);

  // The browser's own zone first, then the rest, without repeating it.
  const zones = useMemo(() => {
    const seen = new Set<string>();
    return [tz, ...TIMEZONES].filter((z) => (seen.has(z) ? false : (seen.add(z), true)));
  }, [tz]);

  const parts = parsed.normalised.split(/\s+/);
  const badFields = new Set(parsed.errors.map((e) => e.field).filter(Boolean));

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-5">
        <label htmlFor="cron-input" className="text-xs font-mono text-muted-foreground block mb-2">
          // cron expression
        </label>
        <input
          id="cron-input"
          type="text"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="0 9 * * 1-5"
          className="w-full bg-background border border-input px-3 py-2 rounded-md text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          autoComplete="off"
          spellCheck="false"
        />
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setExpr(preset)}
              className="font-mono tabular-nums text-muted-foreground hover:text-primary border border-border rounded px-2 py-0.5 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {!parsed.ok ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm"
        >
          {parsed.errors.map((e, i) => (
            <div key={i} className={i > 0 ? 'mt-2' : undefined}>
              <p className="font-mono text-red-500">{e.message}</p>
              {e.hint && <p className="mt-1 text-muted-foreground">{e.hint}</p>}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-card p-5" aria-live="polite">
            <p className="text-xs font-mono text-muted-foreground mb-2">// human readable</p>
            <p className="text-lg text-foreground leading-relaxed">{sentence}</p>
            {parsed.macro && (
              <p className="mt-2 text-sm text-muted-foreground font-mono">
                {parsed.macro} = {parsed.normalised}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {FIELD_ORDER.map((f, i) => (
                <div
                  key={f.name}
                  className={`rounded border px-2 py-1.5 text-center ${
                    badFields.has(f.name) ? 'border-red-500/50' : 'border-border/60'
                  }`}
                >
                  <div className="font-mono text-sm tabular-nums text-foreground truncate">
                    {parts[i]}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </div>
                </div>
              ))}
            </div>
            {parsed.dayOr && (
              <p className="mt-4 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
                Both day fields are set, so cron treats them as <strong>or</strong>, not{' '}
                <strong>and</strong>. This fires on {parsed.fields!.dom.describe} and also{' '}
                {parsed.fields!.dow.describe}.
              </p>
            )}
          </div>

          <div className="rounded-md border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/60 text-xs font-mono text-muted-foreground">
              <span>// next 5 runs</span>
              <select
                aria-label="Timezone"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="bg-background border border-input rounded px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            {schedule === null ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Working it out.</p>
            ) : schedule.never ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                This expression is valid but never fires. Nothing matches in the next{' '}
                {Math.round(schedule.horizonDays / 365)} years, which means the date it asks for does
                not exist. <span className="font-mono">0 0 30 2 *</span> is the usual way to get here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {schedule.times.map((r, i) => (
                  <li
                    key={`${r.at}-${i}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 font-mono text-sm"
                  >
                    <span className="text-muted-foreground tabular-nums">#{i + 1}</span>
                    <span className="flex-1 text-right text-foreground tabular-nums">
                      {r.weekday} {r.local}{' '}
                      <span className="text-muted-foreground">{r.zoneAbbr}</span>
                      {r.repeated && (
                        <span className="ml-2 rounded border border-amber-500/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-500">
                          twice
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {schedule && schedule.skipped.length > 0 && (
              <p className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
                Skipped by daylight saving: {schedule.skipped.map((s) => s.local).join(', ')}. The
                clock jumps forward over that time in {tz}, so the run does not happen.
              </p>
            )}
          </div>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        Want to know why a schedule behaves the way it does? The{' '}
        <a href="/games/cron-expression-simulator" className="underline hover:text-primary">
          cron expression simulator
        </a>{' '}
        runs the same engine with the traps laid out: uneven steps, the two day fields, and what
        daylight saving does to a job in the small hours.
      </p>
    </div>
  );
}
