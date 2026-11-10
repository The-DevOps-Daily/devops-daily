'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { Database, Loader2, Play, Plus, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

interface TableRow {
  id: number;
  email: string;
  name: string;
  age: number;
  city: string;
}
interface IndexInfo {
  columns: string[];
  type: 'btree' | 'hash';
}
interface QueryResult {
  query: string;
  rowsScanned: number;
  rowsReturned: number;
  timeMs: number;
  usedIndex: boolean;
  indexName?: string;
  explanation: string;
  explainPlan?: ExplainStep[];
}
interface ExplainStep {
  operation: string;
  detail: string;
  cost: number;
  rows: number;
}
interface ScanAnimation {
  type: 'full-scan' | 'index-seek';
  currentRow: number;
  totalRows: number;
  foundRows: number[];
  isComplete: boolean;
}
type RunRecord = { plan: string; usedIndex: boolean; rowsScanned: number; indexName?: string };

const SAMPLE_DATA: TableRow[] = [
  { id: 1, email: 'alice@example.com', name: 'Alice Johnson', age: 28, city: 'New York' },
  { id: 2, email: 'bob@example.com', name: 'Bob Smith', age: 35, city: 'Los Angeles' },
  { id: 3, email: 'carol@example.com', name: 'Carol White', age: 42, city: 'Chicago' },
  { id: 4, email: 'david@example.com', name: 'David Brown', age: 31, city: 'Houston' },
  { id: 5, email: 'emma@example.com', name: 'Emma Davis', age: 28, city: 'Phoenix' },
  { id: 6, email: 'frank@example.com', name: 'Frank Miller', age: 45, city: 'New York' },
  { id: 7, email: 'grace@example.com', name: 'Grace Lee', age: 29, city: 'San Diego' },
  { id: 8, email: 'henry@example.com', name: 'Henry Wilson', age: 38, city: 'Dallas' },
  { id: 9, email: 'ivy@example.com', name: 'Ivy Taylor', age: 33, city: 'Chicago' },
  { id: 10, email: 'jack@example.com', name: 'Jack Anderson', age: 28, city: 'Austin' },
];
const QUERIES = [
  {
    id: 'email-exact',
    label: 'Find by Email',
    shortLabel: 'Email',
    sql: "SELECT * FROM users WHERE email = 'emma@example.com'",
    column: 'email',
    columns: ['email'],
    value: 'emma@example.com',
    type: 'exact' as const,
  },
  {
    id: 'age-exact',
    label: 'Find by Age',
    shortLabel: 'Age',
    sql: 'SELECT * FROM users WHERE age = 28',
    column: 'age',
    columns: ['age'],
    value: 28,
    type: 'exact' as const,
  },
  {
    id: 'city-exact',
    label: 'Find by City',
    shortLabel: 'City',
    sql: "SELECT * FROM users WHERE city = 'Chicago'",
    column: 'city',
    columns: ['city'],
    value: 'Chicago',
    type: 'exact' as const,
  },
  {
    id: 'age-range',
    label: 'Age Range',
    shortLabel: 'Range',
    sql: 'SELECT * FROM users WHERE age BETWEEN 30 AND 40',
    column: 'age',
    columns: ['age'],
    valueMin: 30,
    valueMax: 40,
    type: 'range' as const,
  },
  {
    id: 'age-city-composite',
    label: 'Age + City',
    shortLabel: 'Composite',
    sql: "SELECT * FROM users WHERE age = 28 AND city = 'New York'",
    column: 'age',
    columns: ['age', 'city'],
    value: 28,
    secondValue: 'New York',
    type: 'composite' as const,
  },
  {
    id: 'city-age-composite',
    label: 'City + Age',
    shortLabel: 'City+Age',
    sql: "SELECT * FROM users WHERE city = 'New York' AND age = 28",
    column: 'city',
    columns: ['city', 'age'],
    value: 'New York',
    secondValue: 28,
    type: 'composite' as const,
  },
];
const INDEXABLE_COLUMNS = ['email', 'age', 'city'] as const;
type IndexableColumn = (typeof INDEXABLE_COLUMNS)[number];
const COMPOSITE_INDEX_OPTIONS: [IndexableColumn, IndexableColumn][] = [
  ['age', 'city'],
  ['city', 'age'],
];
const MISSIONS: Mission<{ runs: Partial<Record<string, RunRecord>> }>[] = [
  {
    id: 'full-scan',
    label: 'Run a query with no index and watch the full table scan.',
    hint: 'Pick any query and press Run query.',
    check: ({ runs }) => Object.values(runs).some((r) => r && !r.usedIndex),
  },
  {
    id: 'email-seek',
    label: 'Add an index on email, then find Emma with an index seek.',
    hint: 'An index jumps straight to the matching row.',
    check: ({ runs }) =>
      runs['email-exact']?.usedIndex === true && runs['email-exact'].rowsScanned === 1,
  },
  {
    id: 'range',
    label: 'Make the Age Range query use an index.',
    hint: 'A B-tree keeps ages in order, so ages 30 to 40 are one short read.',
    check: ({ runs }) => runs['age-range']?.usedIndex === true,
  },
  {
    id: 'both-orders',
    label: 'Serve Age + City and City + Age with one composite index.',
    hint: 'The order in WHERE does not matter. Two single indexes are not enough.',
    check: ({ runs }) => {
      const a = runs['age-city-composite'];
      const b = runs['city-age-composite'];
      return (
        a?.plan === 'composite-exact' &&
        b?.plan === 'composite-exact' &&
        a.indexName === b.indexName
      );
    },
  },
  {
    id: 'leftmost',
    label: 'Show that a composite index cannot seek on its second column.',
    hint: 'Run Find by City with only (age, city), or Find by Age with only (city, age).',
    check: ({ runs }) => Object.values(runs).some((r) => r?.plan === 'non-leading'),
  },
];
type Tab = 'setup' | 'table' | 'result';

export default function DbIndexingSimulator() {
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [selectedQuery, setSelectedQuery] = useState(QUERIES[0]);
  const [lastResult, setLastResult] = useState<QueryResult | null>(null);
  const [resultQuery, setResultQuery] = useState<(typeof QUERIES)[number] | null>(null);
  const [animation, setAnimation] = useState<ScanAnimation | null>(null);
  const [stats, setStats] = useState({ queries: 0, totalTime: 0, indexHits: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [runs, setRuns] = useState<Partial<Record<string, RunRecord>>>({});
  const [tab, setTab] = useState<Tab>('setup');
  const [dismissed, setDismissed] = useState(false);
  const runToken = useRef(0);
  const hasIndex = useCallback(
    (column: string) => indexes.some((idx) => idx.columns[0] === column),
    [indexes]
  );
  const hasCompositeIndex = useCallback(
    (columns: string[]) => {
      return indexes.some(
        (idx) =>
          idx.columns.length === columns.length && idx.columns.every((col, i) => col === columns[i])
      );
    },
    [indexes]
  );
  const canUseIndexForQuery = useCallback(
    (queryColumns: string[]) => {
      // ANDed equality predicates have no order, so the WHERE clause order is
      // ignored. What matters is the leftmost prefix: an index helps only if
      // its first column is filtered, and it narrows further for each next
      // index column that is also filtered.
      let best: { columns: string[]; prefix: number } | null = null;
      for (const idx of indexes) {
        let prefix = 0;
        while (prefix < idx.columns.length && queryColumns.includes(idx.columns[prefix])) prefix++;
        if (prefix > 0 && (!best || prefix > best.prefix)) best = { columns: idx.columns, prefix };
      }
      if (!best) {
        // An index that holds the column, just not first, is still eligible:
        // the planner could read all of it. It cannot seek, so it loses on cost.
        const nonLeading = indexes.find((idx) =>
          idx.columns.some((col) => queryColumns.includes(col))
        );
        return nonLeading
          ? {
              usable: false,
              type: 'non-leading' as const,
              indexColumns: nonLeading.columns,
              prefix: 0,
            }
          : { usable: false, type: 'none' as const };
      }

      const indexColumns = best.columns;
      if (best.prefix < queryColumns.length) {
        return { usable: true, type: 'filtered' as const, indexColumns, prefix: best.prefix };
      }
      if (indexColumns.length > 1) {
        return {
          usable: true,
          type:
            queryColumns.length > 1 ? ('composite-exact' as const) : ('composite-partial' as const),
          indexColumns,
          prefix: best.prefix,
        };
      }
      return { usable: true, type: 'single' as const, indexColumns, prefix: best.prefix };
    },
    [indexes]
  );
  const addIndex = useCallback((column: IndexableColumn) => {
    setIndexes((prev) => {
      if (prev.some((idx) => idx.columns.length === 1 && idx.columns[0] === column)) return prev;
      return [...prev, { columns: [column], type: 'btree' }];
    });
  }, []);
  const addCompositeIndex = useCallback(
    (columns: [IndexableColumn, IndexableColumn]) => {
      setIndexes((prev) => {
        if (hasCompositeIndex(columns)) return prev;
        return [...prev, { columns: [...columns], type: 'btree' }];
      });
    },
    [hasCompositeIndex]
  );
  const removeIndex = useCallback((columns: string[]) => {
    setIndexes((prev) =>
      prev.filter(
        (idx) =>
          !(
            idx.columns.length === columns.length &&
            idx.columns.every((col, i) => col === columns[i])
          )
      )
    );
  }, []);

  const runQuery = useCallback(async () => {
    if (isRunning) return;
    const token = ++runToken.current;
    setIsRunning(true);
    setLastResult(null);

    const query = selectedQuery;
    const indexResult = canUseIndexForQuery(query.columns);
    const usesIndex = indexResult.usable;

    const matchingRows: number[] = [];
    SAMPLE_DATA.forEach((row, idx) => {
      if (query.type === 'exact') {
        const value = row[query.column as keyof TableRow];
        if (value === query.value) matchingRows.push(idx);
      } else if (query.type === 'range' && 'valueMin' in query && 'valueMax' in query) {
        const value = row[query.column as keyof TableRow] as number;
        if (value >= query.valueMin && value <= query.valueMax) matchingRows.push(idx);
      } else if (query.type === 'composite' && 'secondValue' in query) {
        const value1 = row[query.columns[0] as keyof TableRow];
        const value2 = row[query.columns[1] as keyof TableRow];
        if (value1 === query.value && value2 === query.secondValue) matchingRows.push(idx);
      }
    });

    // An index scan reads every row that matches its leading columns, then
    // filters out rows that fail the rest of the WHERE clause.
    const expectedValue = (column: string) =>
      column === query.columns[0]
        ? 'value' in query
          ? query.value
          : undefined
        : 'secondValue' in query
          ? query.secondValue
          : undefined;
    const conditionFor = (column: string) => {
      if (query.type === 'range')
        return `${column} BETWEEN ${query.valueMin} AND ${query.valueMax}`;
      const value = expectedValue(column);
      return `${column} = ${typeof value === 'string' ? `'${value}'` : value}`;
    };
    const rowsMatching = (columns: string[]) =>
      SAMPLE_DATA.flatMap((row, idx) =>
        columns.every((column) => {
          const value = row[column as keyof TableRow];
          if (query.type === 'range')
            return (value as number) >= query.valueMin && (value as number) <= query.valueMax;
          return value === expectedValue(column);
        })
          ? [idx]
          : []
      );
    const seekColumns =
      usesIndex && indexResult.type !== 'none'
        ? indexResult.indexColumns.slice(0, indexResult.prefix)
        : [];
    const residualColumns = query.columns.filter((column) => !seekColumns.includes(column));
    const indexRows = usesIndex ? rowsMatching(seekColumns) : [];

    const totalRows = SAMPLE_DATA.length;
    const scanRows = usesIndex ? Math.max(indexRows.length, 1) : totalRows;

    setAnimation({
      type: usesIndex ? 'index-seek' : 'full-scan',
      currentRow: 0,
      totalRows: scanRows,
      foundRows: [],
      isComplete: false,
    });

    for (let i = 0; i < scanRows; i++) {
      await new Promise((r) => setTimeout(r, usesIndex ? 80 : 150));
      if (token !== runToken.current) return;
      const rowIdx = usesIndex ? (matchingRows[i] ?? -1) : i;
      const isMatch = matchingRows.includes(rowIdx) || (usesIndex && matchingRows.includes(i));

      setAnimation((prev) =>
        prev
          ? {
              ...prev,
              currentRow: i + 1,
              foundRows: isMatch && !usesIndex ? [...prev.foundRows, rowIdx] : prev.foundRows,
            }
          : null
      );
    }

    const baseTime = usesIndex ? 5 : 50;
    const variance = usesIndex ? Math.random() * 10 : Math.random() * 30;
    const timeMs = Math.round(baseTime + variance);

    const indexName =
      indexResult.type !== 'none' && indexResult.type !== 'non-leading'
        ? `idx_${indexResult.indexColumns.join('_')}`
        : undefined;

    const explainPlan: ExplainStep[] = usesIndex
      ? [
          {
            operation: 'Index Scan',
            detail: `using ${indexName} on users`,
            cost: 1.0 + indexRows.length * 0.01,
            rows: indexRows.length,
          },
          ...(residualColumns.length > 0
            ? [
                {
                  operation: 'Filter',
                  detail: `${residualColumns.map(conditionFor).join(' AND ')} (removed ${indexRows.length - matchingRows.length})`,
                  cost: indexRows.length * 0.01,
                  rows: matchingRows.length,
                },
              ]
            : []),
        ]
      : [
          {
            operation: 'Seq Scan',
            detail: 'on users',
            cost: totalRows * 0.1,
            rows: totalRows,
          },
          {
            operation: 'Filter',
            detail: query.sql.split('WHERE ')[1] || '',
            cost: totalRows * 0.05,
            rows: matchingRows.length,
          },
        ];

    const result: QueryResult = {
      query: query.sql,
      rowsScanned: usesIndex ? indexRows.length : totalRows,
      rowsReturned: matchingRows.length,
      timeMs,
      usedIndex: usesIndex,
      indexName,
      explanation: usesIndex
        ? indexResult.type === 'composite-exact'
          ? `Composite index seek on ${indexName} - matched both columns. The order in the WHERE clause does not matter`
          : indexResult.type === 'composite-partial'
            ? `Partial composite index on ${indexName} - used leading column(s)`
            : indexResult.type === 'filtered'
              ? `Index seek on ${indexName} read the ${indexRows.length} rows that match ${seekColumns.join(', ')}, then the filter on ${residualColumns.join(', ')} removed ${indexRows.length - matchingRows.length} of them`
              : `Index seek on ${indexName} - jumped directly to matching rows`
        : indexResult.type === 'non-leading'
          ? `Seq scan chosen by cost. idx_${indexResult.indexColumns.join('_')} holds ${query.columns.join(', ')}, but not as its first column, so it cannot jump to matching rows. Postgres could still read the whole index (PostgreSQL 18 can also skip scan through each ${indexResult.indexColumns[0]} value), but on a table this small reading every row costs less.`
          : `Full table scan - checked every row in the table`,
      explainPlan,
    };

    await new Promise((r) => setTimeout(r, 150));
    if (token !== runToken.current) return;

    setAnimation((prev) => (prev ? { ...prev, isComplete: true, foundRows: matchingRows } : null));
    setLastResult(result);
    setRuns((prev) => ({
      ...prev,
      [query.id]: {
        plan: indexResult.type,
        usedIndex: usesIndex,
        rowsScanned: result.rowsScanned,
        indexName: result.indexName,
      },
    }));
    setResultQuery(query);
    setStats((prev) => ({
      queries: prev.queries + 1,
      totalTime: prev.totalTime + timeMs,
      indexHits: prev.indexHits + (usesIndex ? 1 : 0),
    }));

    await new Promise((r) => setTimeout(r, 500));
    if (token !== runToken.current) return;
    setIsRunning(false);
  }, [selectedQuery, canUseIndexForQuery, isRunning]);
  const missions = useMissions(
    MISSIONS,
    useMemo(() => ({ runs }), [runs])
  );
  const reset = useCallback(() => {
    runToken.current += 1;
    setIndexes([]);
    setLastResult(null);
    setAnimation(null);
    setStats({ queries: 0, totalTime: 0, indexHits: 0 });
    setIsRunning(false);
    setRuns({});
    setResultQuery(null);
  }, []);
  const startOver = () => {
    reset();
    missions.reset();
    setDismissed(false);
  };
  const run = () => {
    void runQuery();
    if (!window.matchMedia('(min-width: 1024px)').matches) setTab('table');
  };
  const resultPlan = resultQuery ? runs[resultQuery.id]?.plan : undefined;
  const tone = lastResult?.usedIndex
    ? 'success'
    : resultPlan === 'non-leading'
      ? 'info'
      : 'warning';
  const label = lastResult?.usedIndex
    ? 'Index used'
    : resultPlan === 'non-leading'
      ? 'Index not usable'
      : 'Full table scan';
  const setup = (
    <div className="space-y-2">
      <section className="space-y-2 rounded-lg border bg-card p-3">
        <h3 className="text-sm font-semibold">Indexes</h3>
        {INDEXABLE_COLUMNS.map((column) => {
          const indexed = indexes.some(
            (idx) => idx.columns.length === 1 && idx.columns[0] === column
          );
          return (
            <div
              key={column}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <span className="font-mono text-sm">{column}</span>
              {indexed && (
                <Badge
                  variant="secondary"
                  className={cn(SIM_TONE.success.surface, SIM_TONE.success.text)}
                >
                  Indexed
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant={indexed ? 'ghost' : 'outline'}
                className="h-10 lg:h-8"
                aria-label={`${indexed ? 'Remove' : 'Add'} index on ${column}`}
                onClick={() => (indexed ? removeIndex([column]) : addIndex(column))}
              >
                {indexed ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {indexed ? 'Remove' : 'Add'}
              </Button>
            </div>
          );
        })}
        <div className="space-y-2 border-t pt-2">
          {COMPOSITE_INDEX_OPTIONS.map((columns) => {
            const indexed = hasCompositeIndex(columns);
            const name = columns.join(', ');
            return (
              <div
                key={name}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <span className="font-mono text-sm">({name})</span>
                {indexed && (
                  <Badge
                    variant="secondary"
                    className={cn(SIM_TONE.success.surface, SIM_TONE.success.text)}
                  >
                    Indexed
                  </Badge>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={indexed ? 'ghost' : 'outline'}
                  className="h-10 lg:h-8"
                  aria-label={`${indexed ? 'Remove' : 'Add'} index on (${name})`}
                  onClick={() => (indexed ? removeIndex(columns) : addCompositeIndex(columns))}
                >
                  {indexed ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {indexed ? 'Remove' : 'Add'}
                </Button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-2 rounded-lg border bg-card p-3">
        <h3 className="text-sm font-semibold">Query</h3>
        {QUERIES.map((q) => (
          <button
            key={q.id}
            type="button"
            aria-pressed={selectedQuery.id === q.id}
            onClick={() => setSelectedQuery(q)}
            className={cn(
              'min-h-10 w-full rounded-md border px-2.5 py-2 text-left text-sm',
              selectedQuery.id === q.id && 'border-primary/50 bg-primary/5'
            )}
          >
            {q.label}
          </button>
        ))}
        <code className="block break-all rounded bg-muted/50 px-2 py-1.5 font-mono text-xs">
          {selectedQuery.sql}
        </code>
      </section>
    </div>
  );
  const table = (
    <div className="space-y-2">
      <section className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">id</th>
              <th className="px-2 py-1.5 font-medium">
                email{' '}
                {hasIndex('email') && (
                  <Zap className="inline h-3.5 w-3.5 text-primary" aria-label="indexed" />
                )}
              </th>
              <th className="hidden px-2 py-1.5 font-medium sm:table-cell">name</th>
              <th className="px-2 py-1.5 font-medium">
                age{' '}
                {hasIndex('age') && (
                  <Zap className="inline h-3.5 w-3.5 text-primary" aria-label="indexed" />
                )}
              </th>
              <th className="px-2 py-1.5 font-medium">
                city{' '}
                {hasIndex('city') && (
                  <Zap className="inline h-3.5 w-3.5 text-primary" aria-label="indexed" />
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_DATA.map((row, idx) => {
              const scanning = animation && !animation.isComplete && animation.type === 'full-scan';
              const read = scanning && idx < animation.currentRow;
              const current = scanning && idx === animation.currentRow - 1;
              const found = animation?.foundRows.includes(idx);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t transition-colors duration-150',
                    read && 'bg-partial/10',
                    current && 'bg-partial/25',
                    found && 'bg-correct/20'
                  )}
                >
                  <td className="px-2 py-1.5 tabular-nums">{row.id}</td>
                  <td className="max-w-[8rem] truncate px-2 py-1.5 font-mono text-xs sm:max-w-none">
                    {row.email}
                  </td>
                  <td className="hidden px-2 py-1.5 sm:table-cell">{row.name}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.age}</td>
                  <td className="px-2 py-1.5">{row.city}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {animation && !animation.isComplete && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs">
            {animation.type === 'index-seek' ? 'Index seek' : 'Full table scan'}{' '}
            {animation.currentRow} / {animation.totalRows}
          </p>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(animation.currentRow / animation.totalRows) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
  const result = (
    <div className="space-y-2">
      {lastResult ? (
        <section className="space-y-3 rounded-lg border bg-card p-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Rows read', lastResult.rowsScanned],
              ['Rows returned', lastResult.rowsReturned],
              ['Time', `${lastResult.timeMs} ms`],
            ].map(([name, value]) => (
              <div key={name} className="rounded-md border bg-card px-2 py-1.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{name}</p>
                <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <SimFeedback tone={tone} label={label}>
            <p>{lastResult.explanation}</p>
          </SimFeedback>
          <ol className="text-xs font-mono">
            {lastResult.explainPlan?.map((s, i) => (
              <li key={i}>
                {s.operation}: {s.detail}
              </li>
            ))}
          </ol>
          {!lastResult.usedIndex && resultQuery && (
            <SimFeedback tone="hint" label="Tip">
              <p>
                {resultQuery.type === 'composite' ? (
                  <>
                    Add a composite index on <strong>({resultQuery.columns.join(' + ')})</strong>{' '}
                    for best performance, or at least on <strong>{resultQuery.columns[0]}</strong>.
                  </>
                ) : (
                  <>
                    Add an index on <strong>{resultQuery.columns[0]}</strong> to speed up this
                    query.
                  </>
                )}
              </p>
            </SimFeedback>
          )}
        </section>
      ) : (
        <section className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          Run a query to see how the database found the rows.
        </section>
      )}
      <SimMissionList missions={missions.missions} />
      <details className="rounded-lg border bg-card p-3">
        <summary className="cursor-pointer text-sm font-semibold">How indexes work</summary>
        <div className="mt-2 text-sm text-muted-foreground">
          <h3 className="text-foreground">Without an index</h3>
          <p>
            The database checks every row in a full table scan. An index can jump directly to
            matching rows. Composite indexes are sorted by their first column, so (age, city) cannot
            seek on city alone.
          </p>
        </div>
      </details>
    </div>
  );
  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Database Indexing Simulator"
          icon={Database}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={selectedQuery.label}
          meta={
            <>
              <Badge variant="secondary" className="tabular-nums">
                {stats.queries} queries
              </Badge>
              <Badge variant="secondary" className="tabular-nums">
                {stats.indexHits} index hits
              </Badge>
            </>
          }
          actions={
            <div className="hidden items-center gap-2 lg:flex">
              <Button type="button" size="sm" className="h-8" onClick={run} disabled={isRunning}>
                {isRunning ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isRunning ? 'Running' : 'Run query'}
              </Button>
            </div>
          }
          goal={
            missions.current ? (
              <>
                {missions.current.label}{' '}
                <span className="text-muted-foreground">{missions.current.hint}</span>
              </>
            ) : (
              'All five done. Keep trying index sets.'
            )
          }
        />
        <SimAnnouncer
          message={
            lastResult
              ? `${lastResult.usedIndex ? 'Index used' : 'Full scan'}: ${lastResult.rowsScanned} rows read, ${lastResult.rowsReturned} returned, ${lastResult.timeMs} ms`
              : ''
          }
        />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Missions complete"
            summary="You watched a full scan, sought one row by email, read an age range from a B-tree, served both column orders with one composite index, and saw why a composite index cannot seek on its second column."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Queries run', value: stats.queries },
              { label: 'Index hits', value: stats.indexHits },
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
            columns="lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(next) => setTab(next as Tab)}
            tabsLabel="Simulator panels"
            panels={[
              { id: 'setup', label: 'Setup', content: setup },
              { id: 'table', label: 'Table', content: table },
              { id: 'result', label: 'Result', content: result },
            ]}
          />
        )}
        <SimPhoneBar>
          <Button type="button" className="h-10 flex-1" onClick={run} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? 'Running' : 'Run query'}
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
