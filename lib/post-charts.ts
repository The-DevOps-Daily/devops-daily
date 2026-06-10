/**
 * Spec for charts embedded in post markdown via ```chart fences.
 * The fence body is JSON; parse failures fall back to a normal code block
 * so a typo never breaks a post build.
 */

export type ChartType = 'bar' | 'line' | 'dots';

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
}

export interface DotSeries {
  name: string;
  samples: number[];
  /** Optional median override; computed from samples when omitted */
  median?: number;
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
  series?: LineSeries[] | DotSeries[];
}

export function parseChartSpec(raw: string): ChartSpec | null {
  try {
    const spec = JSON.parse(raw) as ChartSpec;
    if (!spec || typeof spec !== 'object') return null;
    if (spec.type === 'bar' && Array.isArray(spec.rows) && spec.rows.length > 0) return spec;
    if (spec.type === 'line' && Array.isArray(spec.series) && spec.series.length > 0) return spec;
    if (spec.type === 'dots' && Array.isArray(spec.series) && spec.series.length > 0) return spec;
    return null;
  } catch {
    return null;
  }
}

export function formatValue(v: number, unit?: string): string {
  if (unit === 'ms') return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}s` : `${Math.round(v * 10) / 10}ms`;
  if (unit === 's') return `${(Math.round(v * 10) / 10).toLocaleString()}s`;
  if (unit === '%') return `${Math.round(v * 10) / 10}%`;
  return unit ? `${v.toLocaleString()}${unit}` : v.toLocaleString();
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Fixed palette that reads well on both themes, assigned by series order. */
export const CHART_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#f472b6', '#a78bfa', '#fb923c'];

export function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
