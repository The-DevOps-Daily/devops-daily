'use client';

import { useMemo, useState } from 'react';

interface Parsed {
  minute: string;
  hour: string;
  dom: string;
  month: string;
  dow: string;
  description: string;
}

function describeField(expr: string, name: string, min: number, max: number, names?: string[]): string {
  if (expr === '*') return `every ${name}`;
  if (/^\*\/(\d+)$/.test(expr)) {
    const step = expr.match(/^\*\/(\d+)$/)![1];
    return `every ${step} ${name}s`;
  }
  if (/^\d+$/.test(expr)) {
    const n = parseInt(expr, 10);
    if (n < min || n > max) return expr;
    return names ? `on ${names[n - min]}` : `at ${name} ${n}`;
  }
  if (/^\d+-\d+$/.test(expr)) {
    return `${name}s ${expr.replace('-', ' through ')}`;
  }
  if (/^(\d+,)+\d+$/.test(expr)) {
    return `${name}s ${expr}`;
  }
  return expr;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SPECIAL: Record<string, string> = {
  '@yearly': 'Once a year at midnight on January 1 (0 0 1 1 *)',
  '@annually': 'Once a year at midnight on January 1 (0 0 1 1 *)',
  '@monthly': 'Once a month at midnight on the 1st (0 0 1 * *)',
  '@weekly': 'Once a week at midnight on Sunday (0 0 * * 0)',
  '@daily': 'Once a day at midnight (0 0 * * *)',
  '@midnight': 'Once a day at midnight (0 0 * * *)',
  '@hourly': 'Once an hour at minute 0 (0 * * * *)',
};

function parseCron(input: string): Parsed | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'Enter a cron expression, for example 0 9 * * 1-5' };

  if (SPECIAL[trimmed]) {
    return {
      minute: '',
      hour: '',
      dom: '',
      month: '',
      dow: '',
      description: SPECIAL[trimmed],
    };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return {
      error: `Expected 5 space-separated fields (minute hour day-of-month month day-of-week), got ${parts.length}`,
    };
  }
  const [minute, hour, dom, month, dow] = parts;

  const pieces: string[] = [];
  if (minute === '0' && hour === '0') pieces.push('At midnight');
  else if (minute === '0' && /^\d+$/.test(hour)) pieces.push(`At ${hour.padStart(2, '0')}:00`);
  else if (/^\d+$/.test(minute) && /^\d+$/.test(hour))
    pieces.push(`At ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
  else {
    pieces.push(
      `${describeField(minute, 'minute', 0, 59)}, ${describeField(hour, 'hour', 0, 23)}`,
    );
  }

  if (dom !== '*') pieces.push(`on day ${dom} of the month`);
  if (month !== '*') pieces.push(`in ${describeField(month, 'month', 1, 12, MONTH_NAMES)}`);
  if (dow !== '*') pieces.push(describeField(dow, 'day of week', 0, 7, DOW_NAMES));

  return {
    minute,
    hour,
    dom,
    month,
    dow,
    description: pieces.join(', ') || 'Every minute',
  };
}

// --- next-run calculator (covers common patterns: *, */N, N, N-M) ---

type FieldSet = Set<number>;

function expandField(expr: string, min: number, max: number): FieldSet | null {
  const result = new Set<number>();
  for (const piece of expr.split(',')) {
    if (piece === '*') {
      for (let i = min; i <= max; i++) result.add(i);
      continue;
    }
    const stepMatch = piece.match(/^(\*|\d+(-\d+)?)\/(\d+)$/);
    if (stepMatch) {
      const range = stepMatch[1];
      const step = parseInt(stepMatch[3], 10);
      let start = min;
      let end = max;
      if (range !== '*') {
        const rangeMatch = range.match(/^(\d+)(?:-(\d+))?$/);
        if (!rangeMatch) return null;
        start = parseInt(rangeMatch[1], 10);
        end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : max;
      }
      for (let i = start; i <= end; i += step) result.add(i);
      continue;
    }
    const rangeMatch = piece.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) result.add(i);
      continue;
    }
    if (/^\d+$/.test(piece)) {
      result.add(parseInt(piece, 10));
      continue;
    }
    return null;
  }
  return result;
}

function nextRuns(expr: string, count: number): Date[] | null {
  const trimmed = SPECIAL[expr.trim()] ? expandSpecial(expr.trim()) : expr.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return null;

  const minutes = expandField(parts[0], 0, 59);
  const hours = expandField(parts[1], 0, 23);
  const doms = expandField(parts[2], 1, 31);
  const months = expandField(parts[3], 1, 12);
  const dows = expandField(parts[4], 0, 7);

  if (!minutes || !hours || !doms || !months || !dows) return null;

  const dowSet = new Set<number>();
  for (const v of dows) dowSet.add(v % 7);

  const runs: Date[] = [];
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  const maxIterations = 525600; // one year of minutes
  let iter = 0;
  while (runs.length < count && iter < maxIterations) {
    if (
      minutes.has(d.getMinutes()) &&
      hours.has(d.getHours()) &&
      doms.has(d.getDate()) &&
      months.has(d.getMonth() + 1) &&
      dowSet.has(d.getDay())
    ) {
      runs.push(new Date(d));
    }
    d.setMinutes(d.getMinutes() + 1);
    iter++;
  }
  return runs;
}

function expandSpecial(s: string): string {
  const map: Record<string, string> = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *',
  };
  return map[s] ?? s;
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function CronParser() {
  const [expr, setExpr] = useState('0 9 * * 1-5');
  const parsed = useMemo(() => parseCron(expr), [expr]);
  const runs = useMemo(() => {
    if ('error' in parsed) return null;
    return nextRuns(expr, 5);
  }, [expr, parsed]);

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
          {['0 9 * * 1-5', '*/5 * * * *', '0 0 * * 0', '@daily', '30 2 * * 1', '0 */6 * * *'].map(
            (preset) => (
              <button
                key={preset}
                onClick={() => setExpr(preset)}
                className="font-mono tabular-nums text-muted-foreground hover:text-primary border border-border rounded px-2 py-0.5 transition-colors"
              >
                {preset}
              </button>
            ),
          )}
        </div>
      </div>

      {'error' in parsed ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm font-mono text-red-500">
          {parsed.error}
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-card p-5">
            <p className="text-xs font-mono text-muted-foreground mb-2">// human readable</p>
            <p className="text-lg text-foreground leading-relaxed">{parsed.description}</p>
          </div>

          {runs && runs.length > 0 && (
            <div className="rounded-md border bg-card overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/60 border-b border-border/60 text-xs font-mono text-muted-foreground">
                // next 5 runs ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </div>
              <ul className="divide-y divide-border">
                {runs.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between px-4 py-3 font-mono text-sm"
                  >
                    <span className="text-muted-foreground tabular-nums">#{i + 1}</span>
                    <span className="text-foreground tabular-nums">{formatDate(r)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
