/**
 * Cron expression engine for the Cron Expression Simulator.
 *
 * The point of this file is that it answers the only question that settles a
 * cron argument: when does this actually fire next, in the timezone the
 * scheduler is running in. Everything else the simulator shows is derived from
 * that, so the explanation and the schedule cannot drift apart.
 *
 * Two behaviours in here surprise people and are deliberate:
 *
 *   * Day-of-month and day-of-week are OR'd, not AND'd, whenever both are
 *     restricted. `0 0 1 * MON` is the 1st AND every Monday, not Mondays that
 *     fall on the 1st. This is POSIX behaviour and the source of many
 *     accidental daily jobs.
 *
 *   * Fire times are computed on the wall clock, so daylight saving is not
 *     smoothed over. A local time that does not exist on a spring-forward day
 *     does not fire; a local time that happens twice on a fall-back day fires
 *     twice. Real implementations differ here (Vixie cron special-cases
 *     wall-clock jobs, systemd timers do not behave like this at all) and the
 *     UI says so rather than pretending there is one answer.
 */

export type FieldName = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

export interface FieldSpec {
  name: FieldName;
  /** The raw text of this field as typed. */
  raw: string;
  /** Every value this field matches, sorted ascending. */
  values: number[];
  /** True when the field was `*` (or `?`), meaning "unrestricted". */
  wildcard: boolean;
  /** Human sentence for this field alone. */
  describe: string;
}

export interface CronError {
  field?: FieldName;
  message: string;
  /** What to type instead, when there is an obvious fix. */
  hint?: string;
}

export interface ParsedCron {
  ok: boolean;
  /** The expression after macro expansion, which is what actually got parsed. */
  normalised: string;
  /** Set when the input was a macro such as `@daily`. */
  macro?: string;
  fields?: Record<FieldName, FieldSpec>;
  errors: CronError[];
  /** True when dom and dow are both restricted, which triggers the OR rule. */
  dayOr: boolean;
}

export interface FireTime {
  /** Epoch milliseconds. */
  at: number;
  /** Wall clock in the target zone, e.g. "2026-09-17 00:30". */
  local: string;
  /** e.g. "Thu" */
  weekday: string;
  /** Zone abbreviation at that instant, e.g. "CEST". */
  zoneAbbr: string;
  /** Minutes since the previous fire time in the list, null for the first. */
  gapMinutes: number | null;
  /** Set when this local time occurs twice because the clock went back. */
  repeated?: boolean;
}

export interface ScheduleResult {
  times: FireTime[];
  /** Local times that were skipped because the clock jumped forward over them. */
  skipped: { local: string; reason: string }[];
  /** True when nothing matched inside the search horizon. */
  never: boolean;
  /** How far ahead the search went, in days. */
  horizonDays: number;
}

const FIELD_ORDER: FieldName[] = ['minute', 'hour', 'dom', 'month', 'dow'];

const RANGES: Record<FieldName, [number, number]> = {
  minute: [0, 59],
  hour: [0, 23],
  dom: [1, 31],
  month: [1, 12],
  dow: [0, 7], // 7 and 0 are both Sunday
};

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DOW_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MACROS: Record<string, { expr: string; note: string }> = {
  '@yearly': { expr: '0 0 1 1 *', note: 'Midnight on 1 January.' },
  '@annually': { expr: '0 0 1 1 *', note: 'Midnight on 1 January.' },
  '@monthly': { expr: '0 0 1 * *', note: 'Midnight on the 1st of every month.' },
  '@weekly': { expr: '0 0 * * 0', note: 'Midnight on Sunday.' },
  '@daily': { expr: '0 0 * * *', note: 'Midnight every day.' },
  '@midnight': { expr: '0 0 * * *', note: 'Midnight every day.' },
  '@hourly': { expr: '0 * * * *', note: 'On the hour, every hour.' },
};

/** Tokens from Quartz and other extended dialects that plain cron does not have. */
const EXTENDED_TOKENS: { pattern: RegExp; label: string; hint: string }[] = [
  {
    pattern: /#/,
    label: '`#` (nth weekday of the month)',
    hint: 'Plain cron has no `#`. To get "the second Tuesday", run it on days 8-14 and check the weekday inside the job.',
  },
  {
    pattern: /\bL\b|\dL|^L/i,
    label: '`L` (last day)',
    hint: 'Plain cron has no `L`. Quartz and some libraries do. Use a specific day, or check the date inside the job.',
  },
  {
    pattern: /\d+W|^W/i,
    label: '`W` (nearest weekday)',
    hint: 'Plain cron has no `W`. That is a Quartz extension.',
  },
];

function expandNames(raw: string, field: FieldName): string {
  if (field === 'month') {
    return raw.replace(/[A-Z]{3}/gi, (m) => {
      const i = MONTH_NAMES.indexOf(m.toUpperCase());
      return i === -1 ? m : String(i + 1);
    });
  }
  if (field === 'dow') {
    return raw.replace(/[A-Z]{3}/gi, (m) => {
      const i = DOW_NAMES.indexOf(m.toUpperCase());
      return i === -1 ? m : String(i);
    });
  }
  return raw;
}

/**
 * Parse one field into the set of values it matches.
 *
 * The step is applied to the range it follows, which is the part people get
 * wrong: `*\/7` on minutes steps from 0 across 0-59 and then the hour restarts,
 * so the last gap of the hour is 4 minutes, not 7.
 */
function parseField(rawInput: string, field: FieldName, errors: CronError[]): FieldSpec | null {
  const raw = rawInput;
  const [lo, hi] = RANGES[field];

  for (const ext of EXTENDED_TOKENS) {
    if (ext.pattern.test(raw)) {
      errors.push({ field, message: `${ext.label} is not standard cron.`, hint: ext.hint });
      return null;
    }
  }

  // `?` means "no specific value" in Quartz. Plain cron does not have it, but
  // enough people paste it in that treating it as `*` is kinder than erroring.
  if (raw === '?') {
    return {
      name: field,
      raw,
      values: rangeValues(lo, hi, 1, field),
      wildcard: true,
      describe: 'every value (`?` is treated as `*`)',
    };
  }

  const expanded = expandNames(raw, field);
  const values = new Set<number>();
  let wildcard = false;

  for (const part of expanded.split(',')) {
    if (part === '') {
      errors.push({ field, message: `Empty item in \`${raw}\`.`, hint: 'A trailing or doubled comma.' });
      return null;
    }
    const [spec, stepRaw, ...rest] = part.split('/');
    if (rest.length) {
      errors.push({ field, message: `More than one \`/\` in \`${part}\`.` });
      return null;
    }
    let step = 1;
    if (stepRaw !== undefined) {
      if (!/^\d+$/.test(stepRaw)) {
        errors.push({ field, message: `Step \`${stepRaw}\` in \`${part}\` is not a number.` });
        return null;
      }
      step = Number(stepRaw);
      if (step === 0) {
        errors.push({ field, message: 'A step of 0 matches nothing.', hint: 'Did you mean `/1`?' });
        return null;
      }
    }

    let from: number;
    let to: number;
    if (spec === '*') {
      from = lo;
      to = hi;
      if (step === 1) wildcard = true;
    } else if (/^\d+$/.test(spec)) {
      from = Number(spec);
      // A bare number with a step means "from here to the end of the range",
      // which is how Vixie cron reads `5/10`.
      to = stepRaw !== undefined ? hi : from;
    } else {
      const m = spec.match(/^(\d+)-(\d+)$/);
      if (!m) {
        errors.push({
          field,
          message: `\`${spec}\` is not a value, a range or \`*\`.`,
          hint: field === 'dow' ? 'Use 0-7 or SUN-SAT.' : field === 'month' ? 'Use 1-12 or JAN-DEC.' : undefined,
        });
        return null;
      }
      from = Number(m[1]);
      to = Number(m[2]);
    }

    for (const v of [from, to]) {
      if (v < lo || v > hi) {
        errors.push({
          field,
          message: `${v} is out of range for ${label(field)} (${lo}-${hi}).`,
          hint: field === 'hour' && v === 24 ? 'Hours are 0-23, so midnight is 0.' : undefined,
        });
        return null;
      }
    }

    if (from > to) {
      // Vixie cron rejects a reversed range rather than wrapping it.
      errors.push({
        field,
        message: `Range \`${from}-${to}\` runs backwards.`,
        hint: `Split it: \`${from}-${hi},${lo}-${to}\`.`,
      });
      return null;
    }

    for (const v of rangeValues(from, to, step, field)) values.add(v);
  }

  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) {
    errors.push({ field, message: `\`${raw}\` matches nothing.` });
    return null;
  }

  return {
    name: field,
    raw,
    values: sorted,
    wildcard,
    describe: describeField(raw, sorted, wildcard, field),
  };
}

function rangeValues(from: number, to: number, step: number, field: FieldName): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) {
    // Sunday is both 0 and 7. Normalise so matching only has to check one.
    out.push(field === 'dow' && v === 7 ? 0 : v);
  }
  return out;
}

function label(field: FieldName): string {
  return { minute: 'minutes', hour: 'hours', dom: 'day-of-month', month: 'months', dow: 'day-of-week' }[field];
}

function listOut(values: number[], render: (v: number) => string, max = 6): string {
  if (values.length <= max) return values.map(render).join(', ');
  return `${values.slice(0, max).map(render).join(', ')} and ${values.length - max} more`;
}

function describeField(raw: string, values: number[], wildcard: boolean, field: FieldName): string {
  if (wildcard) return 'every value';
  const evenStep = stepOf(values);
  switch (field) {
    case 'minute':
      if (values.length === 1) return `at minute ${values[0]}`;
      if (evenStep) return `every ${evenStep} minutes from :${pad(values[0])}`;
      return `at minutes ${listOut(values, String)}`;
    case 'hour':
      if (values.length === 1) return `in the ${values[0]}:00 hour`;
      if (evenStep) return `every ${evenStep} hours from ${pad(values[0])}:00`;
      return `in hours ${listOut(values, String)}`;
    case 'dom':
      if (values.length === 1) return `on day ${values[0]} of the month`;
      return `on days ${listOut(values, String)} of the month`;
    case 'month':
      if (values.length === 1) return `in ${MONTH_LABEL[values[0] - 1]}`;
      return `in ${listOut(values, (v) => MONTH_LABEL[v - 1])}`;
    case 'dow':
      if (values.length === 1) return `on ${DOW_LABEL[values[0]]}`;
      if (values.length === 5 && values.join() === '1,2,3,4,5') return 'Monday to Friday';
      if (values.length === 2 && values.join() === '0,6') return 'at weekends';
      return `on ${listOut(values, (v) => DOW_LABEL[v])}`;
  }
  void raw;
  return '';
}

/** The common difference, when the values are evenly spaced and there are 3+. */
function stepOf(values: number[]): number | null {
  if (values.length < 3) return null;
  const d = values[1] - values[0];
  for (let i = 2; i < values.length; i++) if (values[i] - values[i - 1] !== d) return null;
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseCron(input: string): ParsedCron {
  const errors: CronError[] = [];
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, normalised: '', errors: [{ message: 'Enter a cron expression.' }], dayOr: false };
  }

  let macro: string | undefined;
  let body = trimmed;

  if (trimmed.startsWith('@')) {
    const key = trimmed.toLowerCase();
    if (key === '@reboot') {
      return {
        ok: false,
        normalised: trimmed,
        macro: '@reboot',
        errors: [
          {
            message: '`@reboot` has no schedule. It runs once when cron starts.',
            hint: 'There is nothing to predict: it fires at boot and never again until the next boot.',
          },
        ],
        dayOr: false,
      };
    }
    const found = MACROS[key];
    if (!found) {
      return {
        ok: false,
        normalised: trimmed,
        errors: [{ message: `Unknown macro \`${trimmed}\`.`, hint: `Known: ${Object.keys(MACROS).join(', ')}.` }],
        dayOr: false,
      };
    }
    macro = key;
    body = found.expr;
  }

  const parts = body.split(/\s+/);

  if (parts.length === 6 || parts.length === 7) {
    return {
      ok: false,
      normalised: body,
      errors: [
        {
          message: `${parts.length} fields. Standard cron takes 5.`,
          hint:
            parts.length === 6
              ? 'A 6-field expression is usually Quartz or Spring, where the first field is seconds. Drop it to get the same schedule here.'
              : 'Seven fields is Quartz with a year on the end.',
        },
      ],
      dayOr: false,
    };
  }

  if (parts.length !== 5) {
    return {
      ok: false,
      normalised: body,
      errors: [
        {
          message: `${parts.length} field${parts.length === 1 ? '' : 's'}. Standard cron takes 5.`,
          hint: 'minute hour day-of-month month day-of-week',
        },
      ],
      dayOr: false,
    };
  }

  const fields = {} as Record<FieldName, FieldSpec>;
  let failed = false;
  FIELD_ORDER.forEach((name, i) => {
    const spec = parseField(parts[i], name, errors);
    if (!spec) failed = true;
    else fields[name] = spec;
  });

  if (failed) return { ok: false, normalised: body, macro, errors, dayOr: false };

  return {
    ok: true,
    normalised: body,
    macro,
    fields,
    errors,
    dayOr: !fields.dom.wildcard && !fields.dow.wildcard,
  };
}

// ---------------------------------------------------------------------------
// Timezone handling
// ---------------------------------------------------------------------------

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      timeZoneName: 'short',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday */
  dow: number;
  weekday: string;
  zoneAbbr: string;
}

export function localParts(at: number, tz: string): LocalParts {
  const parts = formatter(tz).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = get('weekday');
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    // Intl renders midnight as 24 in some locales; fold it back to 0.
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    dow: DOW_NAMES.indexOf(weekday.slice(0, 3).toUpperCase()),
    weekday,
    zoneAbbr: get('timeZoneName'),
  };
}

/** The local wall clock at `at`, expressed as if it were UTC. Used for offsets. */
function wallAsUtc(at: number, tz: string): number {
  const p = localParts(at, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
}

/**
 * Turn a local wall-clock time into the instant or instants it refers to.
 *
 * Returns nothing for a time that does not exist (the clock jumped over it) and
 * two instants for a time that happens twice (the clock went back). Both cases
 * are the interesting ones, so they are surfaced rather than resolved.
 */
export function wallClockToInstants(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): number[] {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const dayMs = 86_400_000;
  // Offsets either side of any transition that could be near this time.
  const offsets = new Set<number>();
  for (const probe of [wanted - dayMs, wanted + dayMs]) {
    offsets.add(wallAsUtc(probe, tz) - probe);
  }
  const found: number[] = [];
  for (const off of offsets) {
    const candidate = wanted - off;
    if (wallAsUtc(candidate, tz) === wanted && !found.includes(candidate)) found.push(candidate);
  }
  return found.sort((a, b) => a - b);
}

export interface Transition {
  /** The instant the offset changes. */
  at: number;
  /** Minutes the clock moves. Positive springs forward, negative falls back. */
  shiftMinutes: number;
  /** The local time just before the change, e.g. "2026-03-29 00:59". */
  localBefore: string;
  /** The local time the clock jumps to, e.g. "2026-03-29 02:00". */
  localAfter: string;
  abbrBefore: string;
  abbrAfter: string;
}

/** Offset from UTC at this instant, in minutes. */
function offsetMinutes(at: number, tz: string): number {
  return (wallAsUtc(at, tz) - at) / 60_000;
}

/**
 * The next daylight saving change in this zone, or null if the zone has none.
 *
 * Scans in six-hour steps then narrows to the minute, which is enough for every
 * transition in the IANA database and costs a few hundred lookups.
 */
export function findNextTransition(tz: string, from: number = Date.now(), withinDays = 400): Transition | null {
  const step = 6 * 3_600_000;
  let prev = from;
  let prevOff = offsetMinutes(prev, tz);
  const end = from + withinDays * 86_400_000;

  for (let t = from + step; t <= end; t += step) {
    const off = offsetMinutes(t, tz);
    if (off !== prevOff) {
      // Narrow to the minute.
      let lo = prev;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000;
        if (mid === lo) break;
        if (offsetMinutes(mid, tz) === prevOff) lo = mid;
        else hi = mid;
      }
      const before = localParts(lo, tz);
      const after = localParts(hi, tz);
      return {
        at: hi,
        shiftMinutes: off - prevOff,
        localBefore: `${before.year}-${pad(before.month)}-${pad(before.day)} ${pad(before.hour)}:${pad(before.minute)}`,
        localAfter: `${after.year}-${pad(after.month)}-${pad(after.day)} ${pad(after.hour)}:${pad(after.minute)}`,
        abbrBefore: before.zoneAbbr,
        abbrAfter: after.zoneAbbr,
      };
    }
    prev = t;
    prevOff = off;
  }
  return null;
}

/** Does this day match, with the day-of-month / day-of-week OR rule applied? */
export function dayMatches(parsed: ParsedCron, p: { month: number; day: number; dow: number }): boolean {
  const f = parsed.fields!;
  if (!f.month.values.includes(p.month)) return false;
  const domHit = f.dom.values.includes(p.day);
  const dowHit = f.dow.values.includes(p.dow);
  // Both restricted means either one is enough. This is the OR rule.
  if (parsed.dayOr) return domHit || dowHit;
  return domHit && dowHit;
}

// Eight years, so that a February 29 schedule shows two real dates rather than
// one and a cliff, and an impossible one still gives up quickly. The day-level
// skip makes this a few thousand cheap iterations, not a few million.
const DEFAULT_HORIZON_DAYS = 8 * 366;

/**
 * The next `count` fire times at or after `from`, in `tz`.
 *
 * Walks day by day rather than minute by minute, so an expression like
 * `0 0 29 2 *` costs a few thousand iterations instead of two million.
 */
export function nextFireTimes(
  parsed: ParsedCron,
  tz: string,
  count = 5,
  from: number = Date.now(),
  horizonDays = DEFAULT_HORIZON_DAYS,
): ScheduleResult {
  const empty: ScheduleResult = { times: [], skipped: [], never: false, horizonDays };
  if (!parsed.ok || !parsed.fields) return { ...empty, never: true };

  const f = parsed.fields;
  const times: FireTime[] = [];
  const skipped: ScheduleResult['skipped'] = [];
  // Start from the next whole minute: a job does not fire for a minute in progress.
  const start = Math.floor(from / 60_000) * 60_000 + 60_000;
  const startParts = localParts(start, tz);

  let y = startParts.year;
  let mo = startParts.month;
  let d = startParts.day;

  for (let dayIndex = 0; dayIndex < horizonDays && times.length < count; dayIndex++) {
    // Midday is used as the probe because it is never inside a DST transition,
    // so the calendar date and weekday it reports are always the real ones.
    const probe = wallClockToInstants(y, mo, d, 12, 0, tz)[0];
    if (probe !== undefined) {
      const p = localParts(probe, tz);
      if (dayMatches(parsed, { month: p.month, day: p.day, dow: p.dow })) {
        outer: for (const h of f.hour.values) {
          for (const mi of f.minute.values) {
            const instants = wallClockToInstants(y, mo, d, h, mi, tz);
            if (!instants.length) {
              const localLabel = `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}`;
              if (!skipped.some((s) => s.local === localLabel)) {
                skipped.push({
                  local: localLabel,
                  reason: 'the clock jumped forward over this time, so it never happened',
                });
              }
              continue;
            }
            for (let k = 0; k < instants.length; k++) {
              const at = instants[k];
              if (at < start) continue;
              const lp = localParts(at, tz);
              const prev = times[times.length - 1];
              times.push({
                at,
                local: `${lp.year}-${pad(lp.month)}-${pad(lp.day)} ${pad(lp.hour)}:${pad(lp.minute)}`,
                weekday: lp.weekday,
                zoneAbbr: lp.zoneAbbr,
                gapMinutes: prev ? Math.round((at - prev.at) / 60_000) : null,
                repeated: instants.length > 1 ? true : undefined,
              });
              if (times.length >= count) break outer;
            }
          }
        }
      }
    }
    // Next calendar day, by arithmetic on the date rather than by adding 24h,
    // which would drift across a DST change.
    const nextDay = new Date(Date.UTC(y, mo - 1, d + 1));
    y = nextDay.getUTCFullYear();
    mo = nextDay.getUTCMonth() + 1;
    d = nextDay.getUTCDate();
  }

  return { times, skipped, never: times.length === 0, horizonDays };
}

/** A plain-English sentence for the whole expression. */
export function describeCron(parsed: ParsedCron): string {
  if (!parsed.ok || !parsed.fields) return '';
  const f = parsed.fields;

  const time = (() => {
    if (f.minute.wildcard && f.hour.wildcard) return 'Every minute';
    if (f.minute.wildcard) return `Every minute ${f.hour.describe}`;
    if (f.hour.wildcard) {
      const s = stepOf(f.minute.values);
      if (f.minute.values.length === 1) return `At ${pad(f.minute.values[0])} minutes past every hour`;
      if (s) return `Every ${s} minutes`;
      return `At ${f.minute.describe.replace(/^at minutes /, 'minutes ')} past every hour`;
    }
    if (f.minute.values.length === 1 && f.hour.values.length === 1) {
      return `At ${pad(f.hour.values[0])}:${pad(f.minute.values[0])}`;
    }
    return `${cap(f.minute.describe)} ${f.hour.describe}`;
  })();

  const days: string[] = [];
  if (parsed.dayOr) {
    days.push(`${f.dom.describe} and also ${f.dow.describe}`);
  } else {
    if (!f.dom.wildcard) days.push(f.dom.describe);
    if (!f.dow.wildcard) days.push(f.dow.describe);
  }
  if (!f.month.wildcard) days.push(f.month.describe);

  if (!days.length) return `${time}, every day.`;
  return `${time}, ${days.join(', ')}.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface Observation {
  kind: 'gap' | 'or' | 'frequency' | 'dst' | 'note';
  title: string;
  body: string;
}

/**
 * The things worth saying about this particular expression.
 *
 * These are derived from the parse and the computed schedule, never hardcoded
 * per example, so they also fire on an expression somebody types themselves.
 */
export function observations(parsed: ParsedCron, schedule: ScheduleResult, tz: string): Observation[] {
  const out: Observation[] = [];
  if (!parsed.ok || !parsed.fields) return out;
  const f = parsed.fields;

  // The uneven-step trap: a step that does not divide its range evenly leaves a
  // short gap where the range restarts.
  for (const spec of [f.minute, f.hour] as FieldSpec[]) {
    const m = spec.raw.match(/^\*\/(\d+)$/);
    if (!m) continue;
    const step = Number(m[1]);
    const span = RANGES[spec.name][1] + 1;
    if (step > 1 && span % step !== 0) {
      const last = spec.values[spec.values.length - 1];
      const wrapGap = span - last;
      const unit = spec.name === 'minute' ? 'minutes' : 'hours';
      out.push({
        kind: 'gap',
        title: `\`*/${step}\` does not mean every ${step} ${unit}`,
        body:
          `It means ${spec.name === 'minute' ? 'minutes' : 'hours'} ${spec.values.join(', ')}, which is every ${step} ` +
          `${unit} counting from ${spec.values[0]} and then a restart. The gap from ${last} back to ${spec.values[0]} ` +
          `is ${wrapGap} ${unit}, not ${step}. ${span} does not divide by ${step}, so the pattern cannot be even.`,
      });
    }
  }

  if (parsed.dayOr) {
    out.push({
      kind: 'or',
      title: 'Day-of-month and day-of-week are OR, not AND',
      body:
        `Both day fields are restricted, so this fires ${f.dom.describe} and also ${f.dow.describe}. ` +
        'It does not mean "only when they line up". This is the most expensive cron mistake there is, ' +
        'because a job you meant to run monthly quietly runs weekly as well.',
    });
  }

  const perDay = f.minute.values.length * f.hour.values.length;
  if (f.minute.wildcard && f.hour.wildcard && f.dom.wildcard && f.dow.wildcard && f.month.wildcard) {
    out.push({
      kind: 'frequency',
      title: 'This runs 1,440 times a day',
      body:
        'Every minute of every day. If you meant once a day at midnight that is `0 0 * * *`. ' +
        'The difference between those two is the single most common cron typo.',
    });
  } else if (perDay >= 96 && f.dom.wildcard && f.dow.wildcard) {
    out.push({
      kind: 'frequency',
      title: `That is ${perDay.toLocaleString()} runs a day`,
      body: 'Worth checking the job finishes well inside the interval, or runs will start overlapping.',
    });
  }

  if (schedule.skipped.length) {
    out.push({
      kind: 'dst',
      title: 'A run is skipped by daylight saving',
      body:
        `${schedule.skipped[0].local} does not exist in ${tz}: the clock jumps straight over it, so nothing fires. ` +
        'Anything scheduled in the small hours will silently miss a day once a year. This is why backup jobs ' +
        'are better off at 03:30 than 02:30, or on UTC.',
    });
  }

  if (schedule.times.some((t) => t.repeated)) {
    out.push({
      kind: 'dst',
      title: 'A run happens twice',
      body:
        `This local time occurs twice in ${tz} on the day the clock goes back, so the job runs twice. ` +
        'If it is not idempotent, that is a duplicate charge, a duplicate email or a duplicate report, once a year.',
    });
  }

  // A surprising gap anywhere in the list is worth pointing at directly.
  const gaps = schedule.times.map((t) => t.gapMinutes).filter((g): g is number => g !== null);
  if (gaps.length >= 2) {
    const min = Math.min(...gaps);
    const max = Math.max(...gaps);
    if (max > min && !out.some((o) => o.kind === 'gap')) {
      out.push({
        kind: 'gap',
        title: 'The intervals are not equal',
        body: `The gaps between the next runs range from ${min} to ${max} minutes. Cron matches a clock, it does not count an interval forward.`,
      });
    }
  }

  if (parsed.macro) {
    out.push({
      kind: 'note',
      title: `\`${parsed.macro}\` is shorthand for \`${parsed.normalised}\``,
      body: `${MACROS[parsed.macro]?.note ?? ''} Macros are a Vixie cron feature. Not every scheduler that takes cron syntax accepts them.`,
    });
  }

  return out;
}

export interface Example {
  id: string;
  label: string;
  expr: string;
  tz?: string;
  /**
   * An ISO instant to start the schedule from. The daylight saving examples
   * need it: a transition is only visible from a few days before it, and the
   * next five runs from today would show nothing interesting.
   */
  from?: string;
  /** Why this one is in the list. */
  teaches: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'every-minute',
    label: 'The one everyone types by accident',
    expr: '* * * * *',
    teaches: 'Five stars is every minute, not every day. 1,440 runs against 1.',
  },
  {
    id: 'daily-midnight',
    label: 'Once a day at midnight',
    expr: '0 0 * * *',
    teaches: 'What most people meant when they typed five stars.',
  },
  {
    id: 'step-7',
    label: 'The uneven step',
    expr: '*/7 * * * *',
    teaches: '60 does not divide by 7, so the last gap of every hour is 4 minutes.',
  },
  {
    id: 'step-5',
    label: 'The even step',
    expr: '*/5 * * * *',
    teaches: 'The same shape, but 60 divides by 5, so every gap really is equal.',
  },
  {
    id: 'dom-dow-or',
    label: 'The OR trap',
    expr: '0 9 1 * MON',
    teaches: 'The 1st of the month AND every Monday. Not "Mondays that fall on the 1st".',
  },
  {
    id: 'weekdays',
    label: 'Weekday mornings',
    expr: '30 8 * * 1-5',
    teaches: 'Only one day field is restricted here, so there is no OR surprise.',
  },
  {
    id: 'dst-spring',
    label: 'The run that never happens',
    expr: '30 1 * * *',
    tz: 'Europe/London',
    from: '2026-03-27T00:00:00Z',
    teaches: 'On 29 March the UK clock goes 00:59 straight to 02:00, so 01:30 never exists and the job skips a day.',
  },
  {
    id: 'dst-autumn',
    label: 'The same job, firing twice',
    expr: '30 1 * * *',
    tz: 'Europe/London',
    from: '2026-10-23T00:00:00Z',
    teaches: 'On 25 October that same 01:30 comes round twice, so the job runs twice in one night.',
  },
  {
    id: 'business-hours',
    label: 'Every 15 minutes, office hours',
    expr: '*/15 9-17 * * 1-5',
    teaches: 'Ranges and steps together, and how many runs that adds up to.',
  },
  {
    id: 'quarterly',
    label: 'Quarterly report',
    expr: '0 6 1 1,4,7,10 *',
    teaches: 'Lists in the month field, and a schedule sparse enough that a mistake takes months to notice.',
  },
  {
    id: 'never',
    label: 'The one that never fires',
    expr: '0 0 30 2 *',
    teaches: 'February has no 30th. Cron accepts it happily and the job simply never runs.',
  },
];

export const TIMEZONES: string[] = [
  'UTC',
  'Europe/London',
  'Europe/Sofia',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];
