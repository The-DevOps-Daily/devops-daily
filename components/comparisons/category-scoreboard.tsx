import type { FeatureComparison, ToolInfo } from '@/lib/comparison-types';
import { ToolIcon, toolText, toolVars } from './tool-style';

type Counts = { good: number; neutral: number; bad: number };

function count(features: FeatureComparison[], side: 'toolA' | 'toolB'): Counts {
  const c = { good: 0, neutral: 0, bad: 0 };
  for (const f of features) c[f[side].rating] += 1;
  return c;
}

/** How a tool was rated in one category: strong, mixed and weak features as one stacked bar. */
function RatingBar({ counts, label }: { counts: Counts; label: string }) {
  const total = counts.good + counts.neutral + counts.bad || 1;
  const part = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${label}: ${counts.good} strong, ${counts.neutral} mixed, ${counts.bad} weak`}
      title={`${counts.good} strong, ${counts.neutral} mixed, ${counts.bad} weak`}
    >
      <div className="bg-green-500 dark:bg-green-400" style={{ width: part(counts.good) }} />
      <div className="bg-zinc-400 dark:bg-zinc-500" style={{ width: part(counts.neutral) }} />
      <div className="bg-red-500 dark:bg-red-400" style={{ width: part(counts.bad) }} />
    </div>
  );
}

/**
 * The feature ratings summed up per category, so a reader sees where each
 * tool is strong before reading the table. Only the ratings already in the
 * table are used; there is no new score.
 */
export function CategoryScoreboard({
  features,
  toolA,
  toolB,
}: {
  features: FeatureComparison[];
  toolA: ToolInfo;
  toolB: ToolInfo;
}) {
  const categories = [...new Set(features.map((f) => f.category))];
  if (categories.length < 2) return null;
  const rows = [
    { name: 'All features', items: features },
    ...categories.map((c) => ({ name: c, items: features.filter((f) => f.category === c) })),
  ];

  return (
    <div className="mb-6 rounded-md border bg-card p-4 sm:p-5">
      <div className="mb-3 grid grid-cols-[minmax(0,9rem)_1fr_1fr] items-center gap-x-4 sm:grid-cols-[minmax(0,12rem)_1fr_1fr]">
        <span className="font-mono text-xs text-muted-foreground">{'// by category'}</span>
        {[toolA, toolB].map((tool) => (
          <span
            key={tool.name}
            style={toolVars(tool.color)}
            className="flex min-w-0 items-center gap-2"
          >
            <ToolIcon name={tool.icon} color={tool.color} size="sm" />
            <span className={`truncate text-sm font-semibold ${toolText}`}>{tool.name}</span>
          </span>
        ))}
      </div>
      <dl className="space-y-2.5">
        {rows.map((row, i) => (
          <div
            key={row.name}
            className={`grid grid-cols-[minmax(0,9rem)_1fr_1fr] items-center gap-x-4 sm:grid-cols-[minmax(0,12rem)_1fr_1fr] ${
              i === 0 ? 'border-b pb-2.5' : ''
            }`}
          >
            <dt
              className={`truncate text-sm ${i === 0 ? 'font-semibold' : 'text-muted-foreground'}`}
            >
              {row.name}
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                {row.items.length}
              </span>
            </dt>
            <dd>
              <RatingBar counts={count(row.items, 'toolA')} label={`${toolA.name}, ${row.name}`} />
            </dd>
            <dd>
              <RatingBar counts={count(row.items, 'toolB')} label={`${toolB.name}, ${row.name}`} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" /> strong
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500" /> mixed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" /> weak
        </span>
      </p>
    </div>
  );
}
