'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RotateCcw,
  Database,
  Search,
  Zap,
  Clock,
  TrendingUp,
  Table,
  ArrowRight,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TableRow {
  id: number;
  email: string;
  name: string;
  age: number;
  city: string;
}

interface IndexInfo {
  column: string;
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
}

interface ScanAnimation {
  type: 'full-scan' | 'index-seek';
  currentRow: number;
  totalRows: number;
  foundRows: number[];
  isComplete: boolean;
}

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
    value: 'emma@example.com',
    type: 'exact' as const,
  },
  {
    id: 'age-exact',
    label: 'Find by Age',
    shortLabel: 'Age',
    sql: 'SELECT * FROM users WHERE age = 28',
    column: 'age',
    value: 28,
    type: 'exact' as const,
  },
  {
    id: 'city-exact',
    label: 'Find by City',
    shortLabel: 'City',
    sql: "SELECT * FROM users WHERE city = 'Chicago'",
    column: 'city',
    value: 'Chicago',
    type: 'exact' as const,
  },
  {
    id: 'age-range',
    label: 'Age Range',
    shortLabel: 'Range',
    sql: 'SELECT * FROM users WHERE age BETWEEN 30 AND 40',
    column: 'age',
    valueMin: 30,
    valueMax: 40,
    type: 'range' as const,
  },
];

const INDEXABLE_COLUMNS = ['email', 'age', 'city'] as const;
type IndexableColumn = (typeof INDEXABLE_COLUMNS)[number];

export default function DbIndexingSimulator() {
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [selectedQuery, setSelectedQuery] = useState(QUERIES[0]);
  const [lastResult, setLastResult] = useState<QueryResult | null>(null);
  const [animation, setAnimation] = useState<ScanAnimation | null>(null);
  const [stats, setStats] = useState({ queries: 0, totalTime: 0, indexHits: 0 });
  const [isRunning, setIsRunning] = useState(false);

  const hasIndex = useCallback(
    (column: string) => indexes.some((idx) => idx.column === column),
    [indexes]
  );

  const addIndex = useCallback((column: IndexableColumn) => {
    setIndexes((prev) => {
      if (prev.some((idx) => idx.column === column)) return prev;
      return [...prev, { column, type: 'btree' }];
    });
  }, []);

  const removeIndex = useCallback((column: string) => {
    setIndexes((prev) => prev.filter((idx) => idx.column !== column));
  }, []);

  const runQuery = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLastResult(null);

    const query = selectedQuery;
    const usesIndex = hasIndex(query.column);

    const matchingRows: number[] = [];
    SAMPLE_DATA.forEach((row, idx) => {
      if (query.type === 'exact') {
        const value = row[query.column as keyof TableRow];
        if (value === query.value) matchingRows.push(idx);
      } else if (query.type === 'range' && 'valueMin' in query && 'valueMax' in query) {
        const value = row[query.column as keyof TableRow] as number;
        if (value >= query.valueMin && value <= query.valueMax) matchingRows.push(idx);
      }
    });

    const totalRows = SAMPLE_DATA.length;
    const scanRows = usesIndex ? Math.min(matchingRows.length + 1, 3) : totalRows;

    setAnimation({
      type: usesIndex ? 'index-seek' : 'full-scan',
      currentRow: 0,
      totalRows: scanRows,
      foundRows: [],
      isComplete: false,
    });

    for (let i = 0; i < scanRows; i++) {
      await new Promise((r) => setTimeout(r, usesIndex ? 80 : 150));
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

    const result: QueryResult = {
      query: query.sql,
      rowsScanned: usesIndex ? matchingRows.length : totalRows,
      rowsReturned: matchingRows.length,
      timeMs,
      usedIndex: usesIndex,
      indexName: usesIndex ? `idx_${query.column}` : undefined,
      explanation: usesIndex
        ? `Index seek on idx_${query.column} - jumped directly to matching rows`
        : `Full table scan - checked every row in the table`,
    };

    await new Promise((r) => setTimeout(r, 150));

    setAnimation((prev) => (prev ? { ...prev, isComplete: true, foundRows: matchingRows } : null));
    setLastResult(result);
    setStats((prev) => ({
      queries: prev.queries + 1,
      totalTime: prev.totalTime + timeMs,
      indexHits: prev.indexHits + (usesIndex ? 1 : 0),
    }));

    await new Promise((r) => setTimeout(r, 500));
    setIsRunning(false);
  }, [selectedQuery, hasIndex, isRunning]);

  const reset = useCallback(() => {
    setIndexes([]);
    setLastResult(null);
    setAnimation(null);
    setStats({ queries: 0, totalTime: 0, indexHits: 0 });
    setIsRunning(false);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            Database Indexing
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            See how indexes speed up queries by avoiding full table scans
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="w-fit">
          <RotateCcw className="mr-2 h-4 w-4" />
          <span>Reset</span>
        </Button>
      </div>

      {/* 2. Table Visualization - SHOW DATA FIRST so users understand context */}
      <Card className="border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100 sm:text-lg">
            <Table className="h-4 w-4 text-purple-400 sm:h-5 sm:w-5" />
            <span>users table</span>
            <span className="ml-auto text-xs font-normal text-slate-500 dark:text-slate-400">
              {SAMPLE_DATA.length} rows
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-300 dark:border-slate-600">
            <table className="w-full text-xs sm:text-sm">
              <thead className="sticky top-0 bg-slate-200 dark:bg-slate-700">
                <tr>
                  <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-300">id</th>
                  <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-300">
                    email
                    {hasIndex('email') && (
                      <Zap className="ml-1 inline h-3 w-3 text-yellow-400" />
                    )}
                  </th>
                  <th className="hidden px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 sm:table-cell">
                    name
                  </th>
                  <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-300">
                    age
                    {hasIndex('age') && (
                      <Zap className="ml-1 inline h-3 w-3 text-yellow-400" />
                    )}
                  </th>
                  <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-300">
                    city
                    {hasIndex('city') && (
                      <Zap className="ml-1 inline h-3 w-3 text-yellow-400" />
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_DATA.map((row, idx) => {
                  const isScanning =
                    animation &&
                    !animation.isComplete &&
                    animation.type === 'full-scan' &&
                    idx < animation.currentRow;
                  const isFound = animation?.foundRows.includes(idx);
                  const isCurrentlyScanningRow =
                    animation &&
                    !animation.isComplete &&
                    animation.type === 'full-scan' &&
                    idx === animation.currentRow - 1;

                  return (
                    <motion.tr
                      key={row.id}
                      className={cn(
                        'border-t border-slate-300 dark:border-slate-600',
                        isCurrentlyScanningRow && 'bg-yellow-500/30',
                        isFound && 'bg-emerald-500/20'
                      )}
                      animate={{
                        backgroundColor: isFound
                          ? 'rgba(16, 185, 129, 0.2)'
                          : isScanning
                            ? 'rgba(234, 179, 8, 0.1)'
                            : 'transparent',
                      }}
                      transition={{ duration: 0.15 }}
                    >
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{row.id}</td>
                      <td className="max-w-[100px] truncate px-2 py-1.5 text-slate-700 dark:text-slate-300 sm:max-w-none">
                        {row.email}
                      </td>
                      <td className="hidden px-2 py-1.5 text-slate-700 dark:text-slate-300 sm:table-cell">
                        {row.name}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{row.age}</td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{row.city}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Scan Progress */}
          <AnimatePresence>
            {animation && !animation.isComplete && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      'font-medium',
                      animation.type === 'index-seek' ? 'text-emerald-400' : 'text-yellow-400'
                    )}
                  >
                    {animation.type === 'index-seek' ? (
                      <>
                        <Zap className="mr-1 inline h-3 w-3" />
                        Index Seek
                      </>
                    ) : (
                      <>
                        <ArrowRight className="mr-1 inline h-3 w-3" />
                        Full Table Scan
                      </>
                    )}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Scanned {animation.currentRow} / {animation.totalRows} rows
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-300 dark:bg-slate-600">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      animation.type === 'index-seek' ? 'bg-emerald-500' : 'bg-yellow-500'
                    )}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(animation.currentRow / animation.totalRows) * 100}%`,
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* 3. Controls - Index Manager + Query Selector side by side on desktop */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Index Manager */}
        <Card className="border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100 sm:text-lg">
              <Zap className="h-4 w-4 text-yellow-400 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Index Manager</span>
              <span className="sm:hidden">Indexes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add indexes to columns to speed up queries on those columns.
            </p>
            <div className="space-y-2">
              {INDEXABLE_COLUMNS.map((column) => {
                const indexed = hasIndex(column);
                return (
                  <div
                    key={column}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-2 sm:p-3',
                      indexed
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-slate-300 bg-slate-200/50 dark:border-slate-600 dark:bg-slate-700/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {column}
                      </span>
                      {indexed && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                          INDEXED
                        </span>
                      )}
                    </div>
                    <Button
                      variant={indexed ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => (indexed ? removeIndex(column) : addIndex(column))}
                      className="h-7 px-2 text-xs sm:h-8 sm:px-3"
                    >
                      {indexed ? (
                        <>
                          <Trash2 className="mr-1 h-3 w-3" />
                          <span className="hidden sm:inline">Remove</span>
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1 h-3 w-3" />
                          <span className="hidden sm:inline">Add Index</span>
                          <span className="sm:hidden">Add</span>
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Query Selector */}
        <Card className="border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100 sm:text-lg">
              <Search className="h-4 w-4 text-blue-400 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Select Query</span>
              <span className="sm:hidden">Query</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {QUERIES.map((query) => {
                const isSelected = selectedQuery.id === query.id;
                const willUseIndex = hasIndex(query.column);
                return (
                  <Button
                    key={query.id}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedQuery(query)}
                    className={cn(
                      'h-auto flex-col py-2',
                      isSelected && 'ring-2 ring-blue-500',
                      willUseIndex && !isSelected && 'border-emerald-500/50'
                    )}
                  >
                    <span className="text-xs font-medium sm:hidden">{query.shortLabel}</span>
                    <span className="hidden text-xs font-medium sm:inline">{query.label}</span>
                    {willUseIndex && (
                      <span className="mt-1 text-[10px] text-emerald-400">
                        <Zap className="mr-0.5 inline h-3 w-3" />
                        Fast
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* SQL Preview */}
            <div className="rounded-lg bg-slate-200 p-2 dark:bg-slate-900 sm:p-3">
              <code className="break-all text-[10px] text-blue-600 dark:text-blue-300 sm:text-xs">
                {selectedQuery.sql}
              </code>
            </div>

            <Button
              onClick={runQuery}
              disabled={isRunning}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Run Query
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 4. Query Result - Immediate feedback after running */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card
              className={cn(
                'border-2',
                lastResult.usedIndex
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-yellow-500/50 bg-yellow-500/10'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {lastResult.usedIndex ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-yellow-400" />
                    )}
                    <span
                      className={cn(
                        'font-semibold',
                        lastResult.usedIndex ? 'text-emerald-400' : 'text-yellow-400'
                      )}
                    >
                      {lastResult.usedIndex ? 'Index Used!' : 'Full Table Scan'}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {lastResult.timeMs}ms
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Rows Scanned</span>
                    <div className="font-medium text-slate-700 dark:text-slate-200">
                      {lastResult.rowsScanned}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Rows Returned</span>
                    <div className="font-medium text-slate-700 dark:text-slate-200">
                      {lastResult.rowsReturned}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-slate-200 p-2 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {lastResult.explanation}
                  </p>
                </div>

                {!lastResult.usedIndex && (
                  <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2">
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      <TrendingUp className="mr-1 inline h-3 w-3" />
                      Tip: Add an index on <strong>{selectedQuery.column}</strong> to speed up this
                      query!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Stats Row - Cumulative metrics (moved down, secondary importance) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50">
          <CardContent className="p-3 text-center sm:p-4">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {stats.queries}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 sm:text-xs">
              Queries Run
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50">
          <CardContent className="p-3 text-center sm:p-4">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {stats.totalTime}ms
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 sm:text-xs">
              Total Time
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50">
          <CardContent className="p-3 text-center sm:p-4">
            <div className="text-lg font-bold text-emerald-400 sm:text-2xl">{stats.indexHits}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 sm:text-xs">
              Index Hits
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. Educational Section */}
      <Card className="border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50">
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <Database className="h-4 w-4 text-emerald-400" />
            How Database Indexes Work
          </h3>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <h4 className="mb-1 font-medium text-yellow-400">Without Index (Full Table Scan)</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                The database must check <strong>every row</strong> in the table to find matches.
                Slow for large tables!
              </p>
            </div>
            <div>
              <h4 className="mb-1 font-medium text-emerald-400">With Index (Index Seek)</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The index acts like a book&apos;s index - the database jumps{' '}
                <strong>directly</strong> to matching rows. Much faster!
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-slate-200/50 p-3 dark:bg-slate-700/50">
            <h4 className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              When to Create an Index:
            </h4>
            <ul className="grid gap-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
              <li>• Columns used frequently in WHERE clauses</li>
              <li>• Columns used in JOIN conditions</li>
              <li>• Columns used for sorting (ORDER BY)</li>
              <li>• High-cardinality columns (many unique values)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
