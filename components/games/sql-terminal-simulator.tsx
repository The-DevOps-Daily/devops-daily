'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  BookOpen,
  Braces,
  CheckCircle,
  Circle,
  Columns3,
  Combine,
  Database,
  DollarSign,
  Filter,
  GitMerge,
  Group,
  Layers,
  Lightbulb,
  Pencil,
  Percent,
  Play,
  RotateCcw,
  Sigma,
  Table,
  Target,
  Terminal,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  useTerminalSimulator,
  type ExecuteResult,
  type TerminalLine,
} from '@/hooks/use-terminal-simulator';
import {
  normalizeSql,
  resultsMatch,
  runQuery,
  TABLES,
  type QueryResult,
} from '@/lib/games/sql-sim-engine';

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

const LEFT_JOIN_QUERY =
  "SELECT c.name, o.order_id, o.status FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'pending' ORDER BY c.name;";

const CTE_QUERY =
  'WITH customer_spend AS (SELECT c.name, SUM(oi.quantity * p.price) AS total FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY c.name) SELECT name, total FROM customer_spend WHERE total > (SELECT avg(total) FROM customer_spend) ORDER BY total DESC;';

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
  {
    id: 'left-join',
    title: 'LEFT JOIN',
    description: 'Keep every left row, even without a match',
    icon: <GitMerge className="h-5 w-5" />,
    commands: [
      {
        instruction:
          'List every customer with their pending order id and status, ordered by name. Customers without a pending order should still appear.',
        hint: "LEFT JOIN orders and put the status filter in the ON clause: ON o.customer_id = c.customer_id AND o.status = 'pending'.",
        expectedCommand: LEFT_JOIN_QUERY,
        explanation:
          "A LEFT JOIN keeps every row from the left table; unmatched right-side columns come back NULL. Filtering on o.status in the ON clause (not WHERE) is what preserves the customers who have no pending order.",
      },
    ],
  },
  {
    id: 'dml',
    title: 'INSERT, UPDATE, DELETE',
    description: 'Write data and read the command tags',
    icon: <Pencil className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Insert a new customer: id 9, Ivy Chen, USA, signed up 2025-08-01.',
        hint: "Use \"INSERT INTO customers VALUES (9, 'Ivy Chen', 'USA', '2025-08-01');\".",
        expectedCommand: "INSERT INTO customers VALUES (9, 'Ivy Chen', 'USA', '2025-08-01');",
        explanation:
          'INSERT adds rows. Postgres reports "INSERT 0 1" (the 0 is a legacy OID, the 1 is the row count). This demo does not persist the change, so the dataset stays fixed for the other lessons.',
      },
      {
        instruction: 'Raise the price of product 1 to 54.99.',
        hint: 'Use "UPDATE products SET price = 54.99 WHERE product_id = 1;".',
        expectedCommand: 'UPDATE products SET price = 54.99 WHERE product_id = 1;',
        explanation:
          'UPDATE changes rows that match the WHERE clause and reports how many it touched ("UPDATE 1" here). The demo does not persist the change.',
      },
      {
        instruction: 'Delete every cancelled order.',
        hint: "Use \"DELETE FROM orders WHERE status = 'cancelled';\".",
        expectedCommand: "DELETE FROM orders WHERE status = 'cancelled';",
        explanation:
          'DELETE removes matching rows and reports the count ("DELETE 2" — two orders are cancelled). Again, nothing is persisted here so the lessons stay reproducible.',
      },
    ],
  },
  {
    id: 'cte',
    title: 'Common table expressions',
    description: 'Name a subquery with WITH and reuse it',
    icon: <Braces className="h-5 w-5" />,
    commands: [
      {
        instruction:
          'Using a WITH clause named customer_spend, list the customers whose total spend is above the average, highest first.',
        hint: 'Define customer_spend as the per-customer revenue query, then SELECT from it and compare total to (SELECT avg(total) FROM customer_spend).',
        expectedCommand: CTE_QUERY,
        explanation:
          'A WITH clause (common table expression) names a subquery so you can reference it by name. Here customer_spend is used twice: once in the main query and once inside the AVG subquery.',
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
  if ('command' in result) {
    return { output: result.command };
  }
  return { output: formatTable(result) };
}

interface Challenge {
  id: string;
  question: string;
  solution: string;
}

const CHALLENGES: Challenge[] = [
  {
    id: 'uk-customers',
    question: 'List the names of every customer in the UK, alphabetically.',
    solution: "SELECT name FROM customers WHERE country = 'UK' ORDER BY name",
  },
  {
    id: 'top-3-expensive',
    question: 'Show the 3 most expensive products (name and price), most expensive first.',
    solution: 'SELECT name, price FROM products ORDER BY price DESC LIMIT 3',
  },
  {
    id: 'delivered-count',
    question: "How many orders have the status 'delivered'?",
    solution: "SELECT count(*) FROM orders WHERE status = 'delivered'",
  },
  {
    id: 'category-stats',
    question:
      'For each product category, show the count of products and the average price rounded to 2 decimals — highest average first.',
    solution:
      'SELECT category, count(*) AS n, round(avg(price),2) AS avg_price FROM products GROUP BY category ORDER BY avg_price DESC',
  },
  {
    id: 'cheap-products',
    question: 'Which products cost less than $20? Show name and price, cheapest first.',
    solution: 'SELECT name, price FROM products WHERE price < 20 ORDER BY price',
  },
  {
    id: 'products-per-category',
    question: 'How many products are in each category? Most products first.',
    solution: 'SELECT category, count(*) AS n FROM products GROUP BY category ORDER BY n DESC',
  },
  {
    id: 'cheapest-product',
    question: 'Name the single cheapest product and its price.',
    solution: 'SELECT name, price FROM products ORDER BY price LIMIT 1',
  },
  {
    id: 'early-signups',
    question: 'Which customers signed up before March 2025? Names, earliest first.',
    solution: "SELECT name FROM customers WHERE signup_date < '2025-03-01' ORDER BY signup_date",
  },
];

/** Grade a user's SQL against a challenge's reference solution. */
function gradeChallenge(
  input: string,
  challenge: Challenge,
): { lines: TerminalLine[]; solved: boolean } {
  const now = () => new Date();
  const lines: TerminalLine[] = [{ type: 'input', content: input, timestamp: now() }];

  const userResult = runQuery(input);
  if ('error' in userResult) {
    lines.push({ type: 'error', content: `ERROR:  ${userResult.error}`, timestamp: now() });
    lines.push({
      type: 'error',
      content: "Not quite — that query didn't run. Fix the error and try again.",
      timestamp: now(),
    });
    return { lines, solved: false };
  }
  if ('command' in userResult) {
    lines.push({ type: 'output', content: userResult.command, timestamp: now() });
    lines.push({
      type: 'error',
      content: 'Not quite — a challenge expects a SELECT query that returns rows.',
      timestamp: now(),
    });
    return { lines, solved: false };
  }

  lines.push({ type: 'output', content: formatTable(userResult), timestamp: now() });

  const reference = runQuery(challenge.solution);
  if (resultsMatch(userResult, reference)) {
    lines.push({
      type: 'success',
      content: 'Correct! Your result matches the reference solution.',
      timestamp: now(),
    });
    return { lines, solved: true };
  }

  const expectedRows = 'rows' in reference ? reference.rows.length : 0;
  lines.push({
    type: 'error',
    content: `Not quite — your result doesn't match. Expected ${expectedRows} row${expectedRows === 1 ? '' : 's'}.`,
    timestamp: now(),
  });
  return { lines, solved: false };
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

  // --- Challenge mode state -------------------------------------------------
  const [mode, setMode] = useState<'lessons' | 'challenges'>('lessons');
  const [activeChallenge, setActiveChallenge] = useState(0);
  const [challengeInput, setChallengeInput] = useState('');
  const [challengeHistory, setChallengeHistory] = useState<TerminalLine[]>([]);
  const [solvedChallenges, setSolvedChallenges] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const challengeInputRef = useRef<HTMLInputElement>(null);
  const challengeTerminalRef = useRef<HTMLDivElement>(null);
  const solvedCount = solvedChallenges.size;

  useEffect(() => {
    if (challengeTerminalRef.current) {
      challengeTerminalRef.current.scrollTop = challengeTerminalRef.current.scrollHeight;
    }
  }, [challengeHistory]);

  const submitChallenge = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      setChallengeInput('');
      const bare = input.replace(/;+\s*$/, '').trim().toLowerCase();
      const now = () => new Date();

      if (bare === 'clear') {
        setChallengeHistory([]);
        return;
      }
      if (bare === 'help' || bare === '\\h' || bare === '\\?') {
        setChallengeHistory((prev) => [
          ...prev,
          { type: 'input', content: input, timestamp: now() },
          { type: 'output', content: HELP_TEXT, timestamp: now() },
        ]);
        return;
      }
      if (bare === '\\dt' || bare === '\\d' || bare === '\\l' || bare === 'tables') {
        setChallengeHistory((prev) => [
          ...prev,
          { type: 'input', content: input, timestamp: now() },
          { type: 'output', content: SCHEMA_TEXT, timestamp: now() },
        ]);
        return;
      }

      const { lines, solved } = gradeChallenge(input, CHALLENGES[activeChallenge]);
      setChallengeHistory((prev) => [...prev, ...lines]);
      if (solved) {
        setSolvedChallenges((prev) => new Set(prev).add(activeChallenge));
        setRevealed((prev) => new Set(prev).add(activeChallenge));
      }
    },
    [activeChallenge],
  );

  const handleChallengeSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      submitChallenge(challengeInput);
    },
    [challengeInput, submitChallenge],
  );

  const selectChallenge = useCallback((index: number) => {
    setActiveChallenge(index);
    challengeInputRef.current?.focus();
  }, []);

  const revealSolution = useCallback(() => {
    setRevealed((prev) => new Set(prev).add(activeChallenge));
  }, [activeChallenge]);

  const resetChallenges = useCallback(() => {
    setActiveChallenge(0);
    setChallengeInput('');
    setChallengeHistory([]);
    setSolvedChallenges(new Set());
    setRevealed(new Set());
    challengeInputRef.current?.focus();
  }, []);

  const switchMode = useCallback((next: 'lessons' | 'challenges') => {
    setMode(next);
    if (next === 'challenges') {
      window.setTimeout(() => challengeInputRef.current?.focus(), 0);
    } else {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [inputRef]);

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
            queries run live; the guided join, subquery, window, and CTE lessons return real Postgres
            output. Learn SELECT, WHERE, ORDER BY, DISTINCT, aggregates, GROUP BY, HAVING, JOINs,
            LEFT JOIN, INSERT/UPDATE/DELETE, subqueries, window functions, and CTEs.
          </p>
          <div className="mt-4 inline-flex rounded-md border bg-background p-1">
            <button
              type="button"
              onClick={() => switchMode('lessons')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'lessons'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <BookOpen className="h-4 w-4" />
              Lessons
            </button>
            <button
              type="button"
              onClick={() => switchMode('challenges')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'challenges'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Target className="h-4 w-4" />
              Challenges
            </button>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {mode === 'lessons' ? 'Progress' : 'Challenges solved'}
              </span>
              <span className="text-sm text-muted-foreground">
                {mode === 'lessons'
                  ? `${completedCount}/${totalCommands}`
                  : `${solvedCount}/${CHALLENGES.length}`}
              </span>
            </div>
            <Progress
              value={mode === 'lessons' ? progressPercentage : (solvedCount / CHALLENGES.length) * 100}
            />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Tables" value={TABLES.length} />
              <Metric label="Rows" value={TOTAL_ROWS} />
              {mode === 'lessons' ? (
                <Metric label="Lessons" value={LESSONS.length} />
              ) : (
                <Metric label="Challenges" value={CHALLENGES.length} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        {mode === 'lessons' ? (
          <>
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
          </>
        ) : (
          <>
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5" />
                Challenges
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {CHALLENGES.map((challenge, index) => {
                const solved = solvedChallenges.has(index);
                const active = index === activeChallenge;

                return (
                  <button
                    key={challenge.id}
                    type="button"
                    onClick={() => selectChallenge(index)}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors',
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 shrink-0',
                          solved ? 'text-emerald-500' : active ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {solved ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Challenge {index + 1}
                        </p>
                        <p className="mt-0.5 text-sm">{challenge.question}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Button size="sm" variant="outline" onClick={resetChallenges} className="w-full">
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset challenges
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardContent className="space-y-2.5 p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Challenge {activeChallenge + 1} / {CHALLENGES.length}
                    </Badge>
                    {solvedChallenges.has(activeChallenge) && (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Solved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium sm:text-base">
                    {CHALLENGES[activeChallenge].question}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Write your own SQL in the terminal below and press Enter. Your result is graded
                    against the expected rows, ignoring column names.
                  </p>
                  {revealed.has(activeChallenge) && (
                    <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Reference solution
                      </p>
                      <code className="block whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                        {CHALLENGES[activeChallenge].solution};
                      </code>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={revealSolution}>
                    <Lightbulb className="mr-1 h-4 w-4" />
                    Show solution
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
                ref={challengeTerminalRef}
                className="h-[580px] cursor-text overflow-auto p-5 font-mono text-sm leading-relaxed sm:text-[15px]"
                onClick={() => challengeInputRef.current?.focus()}
              >
                {challengeHistory.length === 0 && (
                  <div className="mb-4 text-emerald-400">
                    <p>Challenge mode — write the SQL yourself.</p>
                    <p className="mt-2 text-muted-foreground">
                      Type a query to answer the current challenge, run &quot;\dt&quot; to see the
                      tables, or &quot;help&quot; for commands.
                    </p>
                  </div>
                )}
                {challengeHistory.map((line, index) => (
                  <div
                    key={`${line.timestamp.getTime()}-${index}`}
                    className={cn(
                      'mb-2',
                      line.type === 'output' ? 'whitespace-pre' : 'whitespace-pre-wrap break-words',
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
                <form onSubmit={handleChallengeSubmit} className="flex items-center">
                  <span className="whitespace-nowrap text-emerald-400">devops=#</span>
                  <input
                    ref={challengeInputRef}
                    type="text"
                    value={challengeInput}
                    onChange={(event) => setChallengeInput(event.target.value)}
                    className="ml-2 min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    placeholder="SELECT ..."
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
          </>
        )}

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
              <p><code className="text-foreground">JOIN</code> / <code className="text-foreground">LEFT JOIN</code> combine tables</p>
              <p><code className="text-foreground">INSERT</code> / <code className="text-foreground">UPDATE</code> / <code className="text-foreground">DELETE</code> change data</p>
              <p><code className="text-foreground">WITH</code> names a subquery (CTE)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {mode === 'lessons' && completedCount === totalCommands && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">Lab complete</p>
                <p className="text-sm text-muted-foreground">
                  You practiced the core SQL workflow from SELECT and WHERE all the way to LEFT JOINs,
                  data changes, subqueries, window functions, and CTEs. Switch to Challenges to write
                  queries from scratch.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetLab}>
              Start over
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'challenges' && solvedCount === CHALLENGES.length && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">All challenges solved</p>
                <p className="text-sm text-muted-foreground">
                  Nice work — you wrote every query yourself. Reset to practice again, or head back to
                  the lessons.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetChallenges}>
              Reset challenges
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
