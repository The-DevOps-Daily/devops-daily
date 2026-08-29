/**
 * Spec for charts embedded in post markdown via ```chart fences.
 * The fence body is JSON; parse failures fall back to a normal code block
 * so a typo never breaks a post build.
 */

export type ChartType = 'bar' | 'line' | 'dots' | 'cdf';

export interface BarRow {
  label: string;
  value: number;
  /** Optional secondary marker (e.g. p95) rendered as a tick */
  tick?: number;
  /** Series name used for color + legend grouping */
  series?: string;
}

export interface LineSeries {
  name: string;
  data: number[];
  /** Dash pattern to distinguish same-colored paths, e.g. "6 5" */
  dash?: string;
  /** Optional color override; palette order applies when omitted */
  color?: string;
}

/** A labeled reference line (SLO threshold, capacity limit, incident marker). */
export interface ChartRef {
  value: number;
  label?: string;
  /** Optional color; defaults to the amber marker color */
  color?: string;
  /** Dash pattern; defaults to "4 5" */
  dash?: string;
}

export interface DotSeries {
  name: string;
  samples: number[];
  /** Optional median override; computed from samples when omitted */
  median?: number;
  /** Optional color override; palette order applies when omitted */
  color?: string;
}

export interface CdfSeries {
  name: string;
  samples: number[];
  /** Dash pattern to distinguish same-colored paths, e.g. "6 5" */
  dash?: string;
  /** Optional color override; palette order applies when omitted */
  color?: string;
}

export interface ChartSpec {
  type: ChartType;
  title?: string;
  caption?: string;
  /** Value formatting: 'ms' | 's' | '%' | free-form suffix */
  unit?: string;
  /** Legend label for the tick marker (bar charts), e.g. "p95" */
  tickLabel?: string;
  /** bar */
  rows?: BarRow[];
  /** line */
  x?: Array<string | number>;
  series?: LineSeries[] | DotSeries[] | CdfSeries[];
  /** line: use a log10 y-axis (values must be > 0). Spreads out a squished
   *  low end next to a large spike. Opt-in; linear otherwise. */
  log?: boolean;
  /** line: horizontal reference lines on the value axis (e.g. an SLO).
   *  bar: vertical reference lines on the value axis (e.g. a budget). */
  refs?: ChartRef[];
}

function finiteNumbers(arr: unknown): arr is number[] {
  return Array.isArray(arr) && arr.length > 0 && arr.every((v) => Number.isFinite(v));
}

function validRefs(refs: unknown): boolean {
  if (refs === undefined) return true;
  return Array.isArray(refs) && refs.every((r) => r && Number.isFinite((r as ChartRef).value));
}

export function parseChartSpec(raw: string): ChartSpec | null {
  try {
    const spec = JSON.parse(raw) as ChartSpec;
    if (!spec || typeof spec !== 'object') return null;
    if (!validRefs(spec.refs)) return null;
    if (spec.type === 'bar') {
      const rows = spec.rows;
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const ok = rows.every(
        (r) =>
          r &&
          typeof r.label === 'string' &&
          Number.isFinite(r.value) &&
          (r.tick === undefined || Number.isFinite(r.tick))
      );
      return ok ? spec : null;
    }
    if (spec.type === 'line') {
      const series = spec.series as LineSeries[] | undefined;
      if (!Array.isArray(series) || series.length === 0) return null;
      return series.every((s) => s && finiteNumbers(s.data)) ? spec : null;
    }
    if (spec.type === 'dots' || spec.type === 'cdf') {
      const series = spec.series as DotSeries[] | undefined;
      if (!Array.isArray(series) || series.length === 0) return null;
      return series.every((s) => s && finiteNumbers(s.samples)) ? spec : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Pad a [min, max] domain by a fraction of its span; sign-safe (works for
 *  negative and all-equal domains, unlike multiplying the endpoints). */
export function paddedDomain(min: number, max: number, frac = 0.05): [number, number] {
  const span = max - min || Math.abs(max) || 1;
  return [min - span * frac, max + span * frac];
}

export function formatValue(v: number, unit?: string): string {
  if (unit === 'ms') return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}s` : `${Math.round(v * 10) / 10}ms`;
  if (unit === 's') return `${(Math.round(v * 10) / 10).toLocaleString()}s`;
  if (unit === '%') return `${Math.round(v * 10) / 10}%`;
  return unit ? `${v.toLocaleString()}${unit}` : v.toLocaleString();
}

/** Reserve enough SVG space for formatted bar values, including their unit. */
export function barValueColumnWidth(labels: string[], fontSize: number, minWidth: number): number {
  const widest = labels.reduce(
    (maxWidth, label) => Math.max(maxWidth, Array.from(label).length * fontSize * 0.58),
    0
  );
  return Math.max(minWidth, Math.ceil(widest + 18));
}

/** Short axis labels preserve chart area without sacrificing source precision. */
export function formatAxisValue(v: number, unit?: string): string {
  if (unit === 'min' && Math.abs(v) >= 60) {
    const hours = Math.round((v / 60) * 10) / 10;
    return `${hours.toLocaleString()}h`;
  }
  return formatValue(v, unit);
}

/** Generate readable linear ticks rather than floating-point interpolation artifacts. */
export function niceAxisTicks(min: number, max: number, targetIntervals = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];

  const rawStep = Math.abs(max - min) / Math.max(1, targetIntervals);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = factor * magnitude;
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const count = Math.round((last - first) / step);

  return Array.from({ length: count + 1 }, (_, i) => Number((first + i * step).toPrecision(12)));
}

/** Wrap a chart label at a word boundary and cap the second line so labels can
 * never spill into the plot area. */
export function wrapChartLabel(label: string, maxChars = 28): string[] {
  const text = label.trim();
  const chars = Array.from(text);
  if (chars.length <= maxChars) return [text];

  const candidate = chars.slice(0, maxChars + 1);
  const whitespaceIndex = candidate.reduce(
    (last, char, index) => (/\s/.test(char) ? index : last),
    -1
  );
  const breakAt = whitespaceIndex >= Math.floor(maxChars * 0.55) ? whitespaceIndex : maxChars;
  const first = chars.slice(0, breakAt).join('').trim();
  const remainder = chars.slice(breakAt).join('').trim();
  const remainderChars = Array.from(remainder);
  const second =
    remainderChars.length > maxChars
      ? `${remainderChars.slice(0, Math.max(1, maxChars - 3)).join('').trimEnd()}...`
      : remainder;

  return second ? [first, second] : [first];
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/** Fixed palette that reads well on both themes, assigned by series order. */
export const CHART_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#f472b6', '#a78bfa', '#fb923c'];

export function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
