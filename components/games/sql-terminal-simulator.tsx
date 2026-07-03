'use client';

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  BookOpen,
  CheckCircle,
  Columns3,
  Combine,
  Database,
  DollarSign,
  Filter,
  Group,
  Layers,
  Lightbulb,
  Percent,
  Play,
  RotateCcw,
  Sigma,
  Table,
  Terminal,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTerminalSimulator, type ExecuteResult } from '@/hooks/use-terminal-simulator';
import { normalizeSql, runQuery, TABLES, type QueryResult } from '@/lib/games/sql-sim-engine';

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  commands: LessonCommand[];
}

interface LessonCommand {
  instruction: string;
  hint: string;
  expectedCommand: string | string[];
  explanation: string;
}

const JOIN_QUERY =
  "SELECT o.order_id, c.name, o.status FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'shipped' ORDER BY o.order_id;";

const REVENUE_QUERY =
  'SELECT c.name, SUM(oi.quantity * p.price) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY c.name ORDER BY revenue DESC;';

const SUBQUERY_QUERY =
  'SELECT name, price FROM products WHERE price > (SELECT avg(price) FROM products) ORDER BY price DESC;';

const WINDOW_QUERY =
  'SELECT name, category, price, rank() OVER (PARTITION BY category ORDER BY price DESC) AS rnk FROM products ORDER BY category, rnk;';

const LESSONS: Lesson[] = [
  {
    id: 'select',
    title: 'SELECT basics',
    description: 'Read rows and pick the columns you want',
    icon: <Table className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Return every column and row from the customers table.',
        hint: 'Use "SELECT * FROM customers;".',
        expectedCommand: 'SELECT * FROM customers;',
        explanation:
          'SELECT * reads all columns. The asterisk is a shortcut for listing every column in the table.',
      },
      {
        instruction: 'Now return only the name and country columns from customers.',
        hint: 'Use "SELECT name, country FROM customers;".',
        expectedCommand: 'SELECT name, country FROM customers;',
        explanation:
          'Projecting just the columns you need keeps result sets small and makes intent obvious.',
      },
    ],
  },
  {
    id: 'where',
    title: 'Filtering with WHERE',
    description: 'Keep only the rows that match a condition',
    icon: <Filter className="h-5 w-5" />,
    commands: [
      {
        instruction: 'List the name and country of customers based in the USA.',
        hint: "Use \"SELECT name, country FROM customers WHERE country = 'USA';\".",
        expectedCommand: "SELECT name, country FROM customers WHERE country = 'USA';",
        explanation:
          "WHERE filters rows before they are returned. String literals go in single quotes and are matched exactly.",
      },
      {
        instruction: 'Show the name and price of products that cost less than 50.',
        hint: 'Use "SELECT name, price FROM products WHERE price < 50;".',
        expectedCommand: 'SELECT name, price FROM products WHERE price < 50;',
        explanation:
          'Numeric literals are written bare (no quotes). Comparison operators like <, >, and <> work as you would expect.',
      },
    ],
  },
  {
    id: 'order-limit',
    title: 'Sorting and limiting',
    description: 'Order results and cap how many rows come back',
    icon: <ArrowUpDown className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Show the five most expensive products with their price.',
        hint: 'Use "SELECT name, price FROM products ORDER BY price DESC LIMIT 5;".',
        expectedCommand: 'SELECT name, price FROM products ORDER BY price DESC LIMIT 5;',
        explanation:
          'ORDER BY sorts the result; DESC sorts high to low. LIMIT caps the number of rows returned.',
      },
    ],
  },
  {
    id: 'distinct',
    title: 'DISTINCT values',
    description: 'Collapse duplicates to see unique values',
    icon: <Layers className="h-5 w-5" />,
    commands: [
      {
        instruction: 'List each product category exactly once.',
        hint: 'Use "SELECT DISTINCT category FROM products;".',
        expectedCommand: 'SELECT DISTINCT category FROM products;',
        explanation:
          'DISTINCT removes duplicate rows from the output, which is handy for finding the set of values in a column.',
      },
    ],
  },
  {
    id: 'count',
    title: 'Counting rows',
    description: 'Use an aggregate to summarise a table',
    icon: <Sigma className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Count how many orders exist and label the column order_count.',
        hint: 'Use "SELECT count(*) AS order_count FROM orders;".',
        expectedCommand: 'SELECT count(*) AS order_count FROM orders;',
        explanation:
          'count(*) counts rows. AS gives the result column a readable name instead of the default "count".',
      },
    ],
  },
  {
    id: 'group-by',
    title: 'GROUP BY',
    description: 'Aggregate per group instead of the whole table',
    icon: <Group className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Count the orders in each status, most common first.',
        hint: 'Use "SELECT status, count(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC;".',
        expectedCommand:
          'SELECT status, count(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC;',
        explanation:
          'GROUP BY buckets rows by a column so aggregates run per bucket. You can ORDER BY the aggregate alias.',
      },
    ],
  },
  {
    id: 'having',
    title: 'HAVING and averages',
    description: 'Filter groups and round aggregate values',
    icon: <Percent className="h-5 w-5" />,
    commands: [
      {
        instruction:
          'For categories with more than two products, show the count and average price (2 decimals), highest average first.',
        hint: 'Use "SELECT category, count(*) AS n, round(avg(price), 2) AS avg_price FROM products GROUP BY category HAVING count(*) > 2 ORDER BY avg_price DESC;".',
        expectedCommand:
          'SELECT category, count(*) AS n, round(avg(price), 2) AS avg_price FROM products GROUP BY category HAVING count(*) > 2 ORDER BY avg_price DESC;',
        explanation:
          'HAVING filters groups after aggregation (WHERE filters rows before). round(avg(price), 2) keeps money readable.',
      },
    ],
  },
  {
    id: 'join',
    title: 'Joining tables',
    description: 'Combine orders with the customers who placed them',
    icon: <Combine className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Show each shipped order with the customer name, ordered by order_id.',
        hint: 'Join orders to customers on customer_id and filter on status.',
        expectedCommand: JOIN_QUERY,
        explanation:
          'A JOIN matches rows across tables using a key. Here orders.customer_id matches customers.customer_id.',
      },
    ],
  },
  {
    id: 'multi-join',
    title: 'Revenue across joins',
    description: 'Aggregate a value spread over four tables',
    icon: <DollarSign className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Show total revenue per customer, highest first.',
        hint: 'Join customers, orders, order_items, and products, then SUM quantity * price.',
        expectedCommand: REVENUE_QUERY,
        explanation:
          'Real reports often span several joins. SUM(oi.quantity * p.price) totals line-item revenue grouped per customer.',
      },
    ],
  },
  {
    id: 'subquery-window',
    title: 'Subqueries and window functions',
    description: 'Compare against an aggregate and rank within groups',
    icon: <BarChart3 className="h-5 w-5" />,
    commands: [
      {
        instruction: 'List products priced above the average product price, most expensive first.',
        hint: 'Compare price to a subquery: (SELECT avg(price) FROM products).',
        expectedCommand: SUBQUERY_QUERY,
        explanation:
          'A subquery runs first and feeds a single value into the outer query, letting you compare each row to the average.',
      },
      {
        instruction: 'Rank products by price within each category.',
        hint: 'Use rank() OVER (PARTITION BY category ORDER BY price DESC).',
        expectedCommand: WINDOW_QUERY,
        explanation:
          'Window functions compute across a set of rows without collapsing them. PARTITION BY restarts the rank per category.',
      },
    ],
  },
];

const TOTAL_ROWS = TABLES.reduce((sum, table) => sum + table.rowCount, 0);

const HELP_TEXT = `Available commands:
  SELECT ... FROM ...      run a query (single-table queries run live)
  \\dt                      list the tables and their row counts
  help                     show this message
  clear                    clear the terminal

Try:
  SELECT * FROM customers;
  SELECT name, price FROM products ORDER BY price DESC LIMIT 5;
  SELECT status, count(*) AS orders FROM orders GROUP BY status;`;

const SCHEMA_TEXT = TABLES.map(
  (table) => `${table.name} (${table.rowCount} rows)\n  ${table.columns.map((col) => col.name).join(', ')}`,
).join('\n\n');

function isNumericColumn(rows: (string | number | null)[][], index: number): boolean {
  return rows.every((row) => {
    const value = row[index];
    return value === null || typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value));
  });
}

/** Render a query result as a psql-style aligned text table. */
function formatTable(result: QueryResult): string {
  const { columns, rows } = result;
  if (rows.length === 0) {
    return `${columns.join(' | ')}\n(0 rows)`;
  }

  const numeric = columns.map((_, index) => isNumericColumn(rows, index));
  const widths = columns.map((column, index) =>
    Math.max(String(column).length, ...rows.map((row) => String(row[index] ?? '').length)),
  );

  const renderCell = (value: string | number | null, index: number) => {
    const text = value === null || value === undefined ? '' : String(value);
    return numeric[index] ? text.padStart(widths[index]) : text.padEnd(widths[index]);
  };

  const header = ` ${columns.map((column, index) => (numeric[index] ? String(column).padStart(widths[index]) : String(column).padEnd(widths[index]))).join(' | ')} `;
  const separator = widths.map((width) => '-'.repeat(width + 2)).join('+');
  const body = rows.map((row) => ` ${row.map((value, index) => renderCell(value, index)).join(' | ')} `);
  const footer = `(${rows.length} row${rows.length === 1 ? '' : 's'})`;

  return [header, separator, ...body, footer].join('\n');
}

function commandMatches(cmd: string, expected: string | string[]): boolean {
  const normalized = normalizeSql(cmd);
  if (Array.isArray(expected)) {
    return expected.some((item) => normalizeSql(item) === normalized);
  }
  return normalizeSql(expected) === normalized;
}

function executeCommand(rawInput: string): ExecuteResult {
  const input = rawInput.trim();
  const bare = input.replace(/;+\s*$/, '').trim().toLowerCase();

  if (bare === 'clear') return { output: '', clear: true };
  if (bare === 'help' || bare === '\\h' || bare === '\\?') return { output: HELP_TEXT };
  if (bare === '\\dt' || bare === '\\d' || bare === '\\l' || bare === 'tables') {
    return { output: SCHEMA_TEXT };
  }

  const result = runQuery(input);
  if ('error' in result) {
    return { output: `ERROR:  ${result.error}`, type: 'error' };
  }
  return { output: formatTable(result) };
}

export default function SqlTerminalSimulator() {
  const {
    currentLessonIndex,
    currentCommandIndex,
    currentLesson,
    currentCommand,
    completedCommands,
    completedCount,
    totalCommands,
    progressPercentage,
    terminalHistory,
    inputValue,
    setInputValue,
    showHint,
    setShowHint,
    inputRef,
    terminalRef,
    submitCommand,
    handleSubmit,
    handleKeyDown,
    resetProgress,
    jumpToLesson,
  } = useTerminalSimulator({
    lessons: LESSONS,
    execute: executeCommand,
    matches: (cmd, command) => commandMatches(cmd, command.expectedCommand),
    successMessage: (command) => `✓ ${command.explanation}`,
    completionKeyStyle: 'index',
    advanceDelayMs: 700,
    historyStyle: 'recent-first',
    promoteOutputType: true,
    guardRepeatCompletion: true,
  });

  const resetLab = useCallback(() => {
    resetProgress();
    inputRef.current?.focus();
  }, [inputRef, resetProgress]);

  const runCurrentCommand = useCallback(() => {
    if (!currentCommand) return;
    const command = Array.isArray(currentCommand.expectedCommand)
      ? currentCommand.expectedCommand[0]
      : currentCommand.expectedCommand;
    submitCommand(command);
  }, [currentCommand, submitCommand]);

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// sql playground</p>
              <h2 className="text-2xl font-bold md:text-3xl">SQL Terminal Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Practice SQL against a small e-commerce schema in a safe browser terminal. Single-table
            queries run live; the guided join, subquery, and window lessons return real Postgres
            output. Learn SELECT, WHERE, ORDER BY, DISTINCT, aggregates, GROUP BY, HAVING, JOINs,
            subqueries, and window functions.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCommands}
              </span>
            </div>
            <Progress value={progressPercentage} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Tables" value={TABLES.length} />
              <Metric label="Rows" value={TOTAL_ROWS} />
              <Metric label="Lessons" value={LESSONS.length} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {LESSONS.map((lesson, lessonIndex) => {
                const lessonCompleted = lesson.commands.every((_, commandIndex) =>
                  completedCommands.has(`${lessonIndex}-${commandIndex}`),
                );
                const active = lessonIndex === currentLessonIndex;

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => {
                      jumpToLesson(lessonIndex);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors',
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('rounded-md border p-1.5', active ? 'text-primary' : 'text-muted-foreground')}>
                        {lesson.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{lesson.title}</p>
                          {lessonCompleted && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{lesson.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Button size="sm" variant="outline" onClick={resetLab} className="w-full">
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset lab
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardContent className="space-y-2.5 p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Lesson {currentLessonIndex + 1} / {LESSONS.length}
                    </Badge>
                    <Badge>
                      Step {currentCommandIndex + 1} / {currentLesson.commands.length}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium sm:text-base">{currentCommand?.instruction}</p>
                  {showHint && currentCommand && (
                    <p className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-sm text-muted-foreground">
                      {currentCommand.hint}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowHint((value) => !value)}>
                    <Lightbulb className="mr-1 h-4 w-4" />
                    Hint
                  </Button>
                  <Button size="sm" onClick={runCurrentCommand}>
                    <Play className="mr-1 h-4 w-4" />
                    Run
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-[#171717]">
            <CardHeader className="border-b border-border/60 bg-[#262626] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <span className="ml-2 text-sm text-muted-foreground">psql</span>
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  devops=#
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={terminalRef}
                className="h-[580px] cursor-text overflow-auto p-5 font-mono text-sm leading-relaxed sm:text-[15px]"
                onClick={() => inputRef.current?.focus()}
              >
                {terminalHistory.length === 0 && (
                  <div className="mb-4 text-emerald-400">
                    <p>Welcome to the SQL terminal playground (Postgres-style).</p>
                    <p className="mt-2 text-muted-foreground">
                      Type &quot;help&quot;, run &quot;\dt&quot; to see the tables, or follow the current task above.
                    </p>
                  </div>
                )}
                {terminalHistory.map((line, index) => (
                  <div
                    key={`${line.timestamp.getTime()}-${index}`}
                    className={cn(
                      'mb-2',
                      line.type === 'output'
                        ? 'whitespace-pre'
                        : 'whitespace-pre-wrap break-words',
                      line.type === 'input' && 'text-slate-100',
                      line.type === 'output' && 'text-slate-300',
                      line.type === 'error' && 'text-red-400',
                      line.type === 'success' &&
                        'whitespace-pre-wrap rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300',
                    )}
                  >
                    {line.type === 'input' && <span className="text-emerald-400">devops=# </span>}
                    {line.content}
                  </div>
                ))}
                <form onSubmit={handleSubmit} className="flex items-center">
                  <span className="whitespace-nowrap text-emerald-400">devops=#</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="ml-2 min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    placeholder="SELECT * FROM customers;"
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Columns3 className="h-5 w-5" />
                Schema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {TABLES.map((table) => (
                <div key={table.name} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-mono text-sm font-medium">
                      <Table className="h-3.5 w-3.5 text-primary" />
                      {table.name}
                    </p>
                    <Badge variant="secondary" className="tabular-nums">
                      {table.rowCount} rows
                    </Badge>
                  </div>
                  <ul className="space-y-1">
                    {table.columns.map((column) => (
                      <li
                        key={column.name}
                        className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground"
                      >
                        <span>{column.name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          {column.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-5 w-5" />
                Cheat sheet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 text-xs text-muted-foreground">
              <p><code className="text-foreground">SELECT</code> columns to read</p>
              <p><code className="text-foreground">WHERE</code> filters rows</p>
              <p><code className="text-foreground">GROUP BY</code> + aggregates summarise</p>
              <p><code className="text-foreground">HAVING</code> filters groups</p>
              <p><code className="text-foreground">ORDER BY</code> / <code className="text-foreground">LIMIT</code> sort and cap</p>
              <p><code className="text-foreground">JOIN</code> combines tables on a key</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {completedCount === totalCommands && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">Lab complete</p>
                <p className="text-sm text-muted-foreground">
                  You practiced the core SQL workflow from SELECT and WHERE all the way to joins,
                  subqueries, and window functions.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetLab}>
              Start over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
