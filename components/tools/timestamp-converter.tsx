'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUrlState } from './use-url-state';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs font-mono text-muted-foreground transition-colors hover:text-primary"
      aria-label="Copy value"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

type Detected = 'seconds' | 'milliseconds' | 'date' | null;

interface Parsed {
  date: Date | null;
  detected: Detected;
}

// Parse an epoch (auto-detecting seconds vs milliseconds) or any date string.
function parseInput(raw: string): Parsed {
  const s = raw.trim();
  if (!s) return { date: null, detected: null };

  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return { date: null, detected: null };
    // now() is ~1.7e9 seconds / ~1.7e12 ms; 1e11 cleanly separates the two.
    const isMs = Math.abs(n) >= 1e11;
    const date = new Date(isMs ? n : n * 1000);
    if (Number.isNaN(date.getTime())) return { date: null, detected: null };
    return { date, detected: isMs ? 'milliseconds' : 'seconds' };
  }

  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return { date: null, detected: null };
  return { date, detected: 'date' };
}

function relativeTime(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return 'now';
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 px-4 py-2.5 last:border-b-0">
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate font-mono text-sm">{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

const LOCAL_TZ =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'local';

export function TimestampConverter() {
  const [input, setInput] = useUrlState('t', '');
  const [now, setNow] = useState<number>(() => Date.now());

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parsed = useMemo(() => parseInput(input), [input]);
  const { date, detected } = parsed;

  const detectedLabel =
    detected === 'seconds'
      ? 'read as Unix seconds'
      : detected === 'milliseconds'
        ? 'read as Unix milliseconds'
        : detected === 'date'
          ? 'read as a date string'
          : null;

  return (
    <div className="space-y-6">
      {/* Live current time */}
      <div className="rounded-md border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">// now</span>
          <button
            onClick={() => setInput(String(Math.floor(now / 1000)))}
            className="text-xs font-mono text-muted-foreground transition-colors hover:text-primary"
          >
            use now &rarr;
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-4 py-3">
            <span className="text-xs font-mono text-muted-foreground">seconds</span>
            <span className="font-mono text-lg tabular-nums">{Math.floor(now / 1000)}</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-4 py-3">
            <span className="text-xs font-mono text-muted-foreground">milliseconds</span>
            <span className="font-mono text-lg tabular-nums">{now}</span>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-md border bg-card p-5">
        <label htmlFor="ts-input" className="mb-2 block text-xs font-mono text-muted-foreground">
          // timestamp or date
        </label>
        <input
          id="ts-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="1735689600, 1735689600000, or 2025-01-01T00:00:00Z"
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          spellCheck="false"
          autoComplete="off"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-xs font-mono text-muted-foreground">
            or pick a date:&nbsp;
            <input
              type="datetime-local"
              onChange={(e) => {
                const v = e.target.value;
                if (v) setInput(String(Math.floor(new Date(v).getTime() / 1000)));
              }}
              className="rounded border border-input bg-background px-2 py-1 font-mono text-xs"
            />
          </label>
          {input && (
            <button
              onClick={() => setInput('')}
              className="text-xs font-mono text-muted-foreground hover:text-primary"
            >
              clear
            </button>
          )}
          {detectedLabel && (
            <span className="text-xs font-mono text-primary/80">{detectedLabel}</span>
          )}
        </div>
      </div>

      {/* Output */}
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="border-b border-border/60 bg-muted/60 px-4 py-2.5">
          <span className="text-xs font-mono text-muted-foreground">// converted</span>
        </div>
        {date ? (
          <div>
            <OutputRow label="unix seconds" value={String(Math.floor(date.getTime() / 1000))} />
            <OutputRow label="unix milliseconds" value={String(date.getTime())} />
            <OutputRow label="iso 8601 (utc)" value={date.toISOString()} />
            <OutputRow label="utc" value={date.toUTCString()} />
            <OutputRow label={`local (${LOCAL_TZ})`} value={date.toLocaleString()} />
            <OutputRow label="relative" value={relativeTime(date)} />
            <OutputRow
              label="weekday"
              value={date.toLocaleDateString(undefined, { weekday: 'long' })}
            />
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {input
              ? 'Could not parse that. Try a Unix timestamp or an ISO date like 2025-01-01T00:00:00Z.'
              : 'Enter a Unix timestamp or a date above to convert.'}
          </div>
        )}
      </div>
    </div>
  );
}
