'use client';

import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  BookOpen,
  Braces,
  CircleCheck,
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
  Sigma,
  Table,
  Target,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LAB_TERMINAL_HEIGHT,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHowTo,
  SimLabBar,
  SimLabLayout,
  SimLabLessons,
  SimLabPanel,
  SimResetButton,
  SimTerminal,
  focusTerminal,
  labLines,
  labStats,
  lessonsSummary,
  useSimLab,
} from '@/components/games/sim';
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

export const LESSONS: Lesson[] = [
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
        hint: 'Use "SELECT name, country FROM customers WHERE country = \'USA\';".',
        expectedCommand: "SELECT name, country FROM customers WHERE country = 'USA';",
        explanation:
          'WHERE filters rows before they are returned. String literals go in single quotes and are matched exactly.',
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
          'A LEFT JOIN keeps every row from the left table; unmatched right-side columns come back NULL. Filtering on o.status in the ON clause (not WHERE) is what preserves the customers who have no pending order.',
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
        hint: 'Use "DELETE FROM orders WHERE status = \'cancelled\';".',
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
  (table) =>
    `${table.name} (${table.rowCount} rows)\n  ${table.columns.map((col) => col.name).join(', ')}`
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
    Math.max(String(column).length, ...rows.map((row) => String(row[index] ?? '').length))
  );

  const renderCell = (value: string | number | null, index: number) => {
    const text = value === null || value === undefined ? '' : String(value);
    return numeric[index] ? text.padStart(widths[index]) : text.padEnd(widths[index]);
  };

  const header = ` ${columns.map((column, index) => (numeric[index] ? String(column).padStart(widths[index]) : String(column).padEnd(widths[index]))).join(' | ')} `;
  const separator = widths.map((width) => '-'.repeat(width + 2)).join('+');
  const body = rows.map(
    (row) => ` ${row.map((value, index) => renderCell(value, index)).join(' | ')} `
  );
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
  const bare = input
    .replace(/;+\s*$/, '')
    .trim()
    .toLowerCase();

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

export const CHALLENGES: Challenge[] = [
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
  challenge: Challenge
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

type Mode = 'lessons' | 'challenges';

export default function SqlTerminalSimulator() {
  const lab = useTerminalSimulator({
    lessons: LESSONS,
    execute: executeCommand,
    matches: (cmd, command) => commandMatches(cmd, command.expectedCommand),
    successMessage: (command) => `✓ ${command.explanation}`,
    completionKeyStyle: 'index',
    advanceDelayMs: 700,
    historyStyle: 'recent-first',
    promoteOutputType: true,
    guardRepeatCompletion: true,
    // SimComplete signals Opsville, on the render that completes the last command.
    signalOnComplete: false,
    autoFocus: false,
  });
  const { currentCommand, terminalHistory, inputValue, setInputValue, inputRef, submitCommand } =
    lab;
  const ui = useSimLab(lab);
  const expected = currentCommand
    ? Array.isArray(currentCommand.expectedCommand)
      ? currentCommand.expectedCommand[0]
      : currentCommand.expectedCommand
    : undefined;

  // --- Challenge mode state -------------------------------------------------
  const [mode, setMode] = useState<Mode>('lessons');
  const [activeChallenge, setActiveChallenge] = useState(0);
  const [challengeInput, setChallengeInput] = useState('');
  const [challengeHistory, setChallengeHistory] = useState<TerminalLine[]>([]);
  const [solvedChallenges, setSolvedChallenges] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  /** "Keep practicing" closes the challenges' end card. */
  const [challengesDismissed, setChallengesDismissed] = useState(false);
  const challengeInputRef = useRef<HTMLInputElement>(null);
  const solvedCount = solvedChallenges.size;

  const submitChallenge = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      setChallengeInput('');
      const bare = input
        .replace(/;+\s*$/, '')
        .trim()
        .toLowerCase();
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
    [activeChallenge]
  );

  const selectChallenge = useCallback((index: number) => {
    setActiveChallenge(index);
    focusTerminal(challengeInputRef.current);
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
    setChallengesDismissed(false);
    focusTerminal(challengeInputRef.current);
  }, []);

  // The lessons' end card shows once per finished run: leaving it for the
  // challenges closes it, as "Keep exploring" does, so coming back to the
  // lessons never shows it (and signals Opsville) a second time.
  const switchMode = (next: Mode) => {
    if (next !== mode && lab.isComplete) ui.keepExploring();
    setMode(next);
  };

  const modeToggle = (
    <div role="group" aria-label="Mode" className="flex items-center gap-1">
      {(
        [
          ['lessons', 'Lessons', BookOpen],
          ['challenges', 'Challenges', Target],
        ] as const
      ).map(([value, label, Icon]) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? 'default' : 'outline'}
          aria-pressed={mode === value}
          onClick={() => switchMode(value)}
          className="h-10 lg:h-8"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );

  const schemaPanel = (
    <SimLabPanel
      title="Schema"
      icon={Columns3}
      summary={`${TABLES.length} tables, ${TOTAL_ROWS} rows`}
    >
      <div className="space-y-2">
        {TABLES.map((table) => (
          <div key={table.name} className="rounded-md border p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-sm font-medium">
                <Table className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {table.name}
              </p>
              <Badge variant="secondary" className="tabular-nums">
                {table.rowCount} rows
              </Badge>
            </div>
            <ul className="space-y-0.5">
              {table.columns.map((column) => (
                <li
                  key={column.name}
                  className="flex items-center justify-between gap-2 font-mono text-xs"
                >
                  <span>{column.name}</span>
                  <span className="uppercase tracking-wide text-muted-foreground">
                    {column.type}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SimLabPanel>
  );

  const cheatSheet = (
    <SimLabPanel title="Cheat sheet" icon={Terminal}>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {CHEAT_SHEET.map(([keywords, what]) => (
          <li key={keywords}>
            <code className="font-mono text-xs font-semibold text-foreground">{keywords}</code>{' '}
            {what}
          </li>
        ))}
      </ul>
    </SimLabPanel>
  );

  if (mode === 'challenges') {
    const challenge = CHALLENGES[activeChallenge];
    const solved = solvedChallenges.has(activeChallenge);
    return (
      // Keyed per mode, so a switch mounts the other terminal (and focuses it) afresh.
      <SimFrame key="challenges">
        <SimBar
          title="SQL Terminal Simulator"
          icon={Database}
          lead={modeToggle}
          steps={CHALLENGES.map((c, i) => ({
            title: c.question,
            status: solvedChallenges.has(i) ? 'done' : 'todo',
            statusLabel: solvedChallenges.has(i) ? 'solved' : 'not solved yet',
          }))}
          current={activeChallenge}
          onStep={selectChallenge}
          stepNoun="Challenge"
          stepsLabel="Challenges"
          tools={
            <SimResetButton
              onReset={resetChallenges}
              label="Reset challenges"
              confirmLabel="Reset challenges?"
            />
          }
          progress={{ current: activeChallenge + 1, total: CHALLENGES.length }}
          heading={`Challenge ${activeChallenge + 1}`}
          meta={
            solved && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-correct-foreground">
                <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> Solved
              </span>
            )
          }
          actions={
            <>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {solvedCount}/{CHALLENGES.length} solved
              </span>
              {!revealed.has(activeChallenge) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 lg:h-8"
                  onClick={revealSolution}
                >
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  Show solution
                </Button>
              )}
            </>
          }
          goal={challenge.question}
        >
          <SimHowTo summary="How challenges work" autoOpen={challengeHistory.length === 0}>
            Write your own SQL in the terminal and press Enter. Your result is graded against the
            expected rows, ignoring column names.
          </SimHowTo>
          {revealed.has(activeChallenge) && (
            <SimFeedback tone="hint" label="Reference solution" role="status">
              <code className="block whitespace-pre-wrap break-words font-mono text-xs">
                {challenge.solution};
              </code>
            </SimFeedback>
          )}
        </SimBar>

        {solvedCount === CHALLENGES.length && !challengesDismissed ? (
          <SimComplete
            title="All challenges solved"
            summary="You wrote every query yourself. Reset to practice again, or head back to the lessons."
            signal={false}
            learned={null}
            stats={[
              { label: 'Challenges', value: `${solvedCount}/${CHALLENGES.length}` },
              { label: 'Lessons', value: `${lab.completedCount}/${lab.totalCommands}` },
            ]}
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChallengesDismissed(true)}
                >
                  Keep practicing
                </Button>
                <Button type="button" variant="outline" onClick={() => switchMode('lessons')}>
                  Back to the lessons
                </Button>
              </>
            }
            onPlayAgain={resetChallenges}
            playAgainLabel="Reset challenges"
          />
        ) : (
          <SimLabLayout
            terminal={
              <SimTerminal
                label="psql"
                status="challenge mode"
                prompt="devops=#"
                lines={labLines(challengeHistory, [
                  { type: 'success', content: 'Challenge mode: write the SQL yourself.' },
                  {
                    type: 'muted',
                    content:
                      'Type a query to answer the current challenge, run "\\dt" to see the tables, or "help" for commands.',
                  },
                ])}
                value={challengeInput}
                onChange={setChallengeInput}
                onSubmit={submitChallenge}
                inputRef={challengeInputRef}
                placeholder="SELECT ..."
                autoFocus
                heightClassName={LAB_TERMINAL_HEIGHT}
              />
            }
            aside={
              <>
                {schemaPanel}
                <SimLabPanel
                  title="Challenges"
                  icon={Target}
                  summary={`${solvedCount} of ${CHALLENGES.length} solved`}
                >
                  <ol className="space-y-0.5">
                    {CHALLENGES.map((c, index) => {
                      const done = solvedChallenges.has(index);
                      const active = index === activeChallenge;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => selectChallenge(index)}
                            aria-current={active ? 'step' : undefined}
                            aria-label={`Challenge ${index + 1}: ${c.question}${done ? ', solved' : ''}`}
                            className={cn(
                              'flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              active
                                ? 'border-primary/60 bg-primary/10'
                                : 'border-transparent hover:bg-muted'
                            )}
                          >
                            {done ? (
                              <CircleCheck
                                className="mt-0.5 h-4 w-4 shrink-0 text-correct-foreground"
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-xs text-muted-foreground">
                                {index + 1}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">{c.question}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </SimLabPanel>
                {cheatSheet}
              </>
            }
          />
        )}
      </SimFrame>
    );
  }

  return (
    <SimFrame key="lessons">
      <SimLabBar
        title="SQL Terminal Simulator"
        icon={Database}
        lead={modeToggle}
        lessons={LESSONS}
        lab={lab}
        ui={ui}
        task={currentCommand?.instruction}
        hint={currentCommand?.hint}
        showMe={expected}
      />

      {ui.showComplete ? (
        <SimComplete
          title="Lab complete"
          summary="You practiced the core SQL workflow from SELECT and WHERE all the way to LEFT JOINs, data changes, subqueries, window functions, and CTEs."
          stats={labStats(lab, LESSONS, ui, { showMe: true })}
          actions={
            <>
              <Button type="button" variant="outline" onClick={ui.keepExploring}>
                Keep exploring
              </Button>
              <Button type="button" variant="outline" onClick={() => switchMode('challenges')}>
                <Target className="h-4 w-4" aria-hidden="true" />
                Try the challenges
              </Button>
            </>
          }
          onPlayAgain={ui.startOver}
          playAgainLabel="Start over"
        />
      ) : (
        <SimLabLayout
          terminal={
            <SimTerminal
              label="psql"
              status="devops=#"
              prompt="devops=#"
              lines={labLines(terminalHistory, [
                {
                  type: 'success',
                  content: 'Welcome to the SQL terminal playground (Postgres-style).',
                },
                {
                  type: 'muted',
                  content: 'Type "help", run "\\dt" to see the tables, or follow the task above.',
                },
              ])}
              value={inputValue}
              onChange={setInputValue}
              onSubmit={submitCommand}
              onKeyDown={lab.handleKeyDown}
              inputRef={inputRef}
              placeholder="SELECT * FROM customers;"
              autoFocus
              heightClassName={LAB_TERMINAL_HEIGHT}
            />
          }
          aside={
            <>
              {schemaPanel}
              <SimLabPanel title="Lessons" icon={BookOpen} summary={lessonsSummary(LESSONS, lab)}>
                <SimLabLessons lessons={LESSONS} lab={lab} ui={ui} />
              </SimLabPanel>
              {cheatSheet}
            </>
          }
        />
      )}
    </SimFrame>
  );
}

const CHEAT_SHEET = [
  ['SELECT', 'columns to read'],
  ['WHERE', 'filters rows'],
  ['GROUP BY', '+ aggregates summarise'],
  ['HAVING', 'filters groups'],
  ['ORDER BY / LIMIT', 'sort and cap'],
  ['JOIN / LEFT JOIN', 'combine tables'],
  ['INSERT / UPDATE / DELETE', 'change data'],
  ['WITH', 'names a subquery (CTE)'],
] as const;
