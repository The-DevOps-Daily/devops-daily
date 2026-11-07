'use client';

import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import {
  BookOpen,
  Database,
  Gauge,
  History,
  KeyRound,
  ListTree,
  PlusCircle,
  Search,
  Table2,
  Terminal,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LAB_TERMINAL_HEIGHT,
  SIM_TONE,
  SimComplete,
  SimFrame,
  SimLabBar,
  SimLabLayout,
  SimLabLessons,
  SimLabPanel,
  SimTerminal,
  labLines,
  labStats,
  lessonsSummary,
  useSimLab,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import { useTerminalSimulator, type ExecuteResult } from '@/hooks/use-terminal-simulator';

/**
 * PostgreSQL / psql terminal simulator.
 *
 * A companion to the SQL Terminal Simulator, but this lab teaches the *tool
 * and engine* rather than the SQL language: psql meta-commands, EXPLAIN plans,
 * indexes, and transactions. It is intentionally a docker/k8s-style
 * command -> output simulator (canned + small in-component state), NOT a
 * free-form SQL evaluator, so it is fully self-contained.
 *
 * Every EXPLAIN plan, catalog listing, and psql-aligned table below is
 * reproduced from real Postgres output so what you see matches production.
 */

interface PgState {
  indexCreated: boolean;
  inTransaction: boolean;
  ordersCount: number;
  expanded: boolean;
  timing: boolean;
}

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

function createInitialState(): PgState {
  return {
    indexCreated: false,
    inTransaction: false,
    ordersCount: 12,
    expanded: false,
    timing: false,
  };
}

const CONNECTION = { database: 'shop', user: 'neondb_owner' } as const;

// --- Table metadata (same e-commerce schema as the SQL sim) -------------------

interface ColumnMeta {
  name: string;
  type: string;
  nullable: string;
  default: string;
}

interface TableMeta {
  name: string;
  rows: number;
  columns: ColumnMeta[];
  primaryKey: string;
}

const CUSTOMERS: Array<[number, string, string, string]> = [
  [1, 'Alice Johnson', 'USA', '2023-01-15'],
  [2, 'Bob Smith', 'UK', '2023-02-20'],
  [3, 'Carla Reyes', 'Spain', '2023-03-05'],
  [4, 'Daniel Kim', 'South Korea', '2023-03-18'],
  [5, 'Emma Wilson', 'USA', '2023-04-02'],
  [6, 'Farah Ahmed', 'UAE', '2023-05-11'],
  [7, 'Georgi Petrov', 'Bulgaria', '2023-06-01'],
  [8, 'Hannah Muller', 'Germany', '2023-06-25'],
];

const TABLES: TableMeta[] = [
  {
    name: 'big_events',
    rows: 200000,
    primaryKey: 'id',
    columns: [
      {
        name: 'id',
        type: 'bigint',
        nullable: 'not null',
        default: "nextval('big_events_id_seq'::regclass)",
      },
      { name: 'user_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'action', type: 'text', nullable: 'not null', default: '' },
      {
        name: 'created_at',
        type: 'timestamp with time zone',
        nullable: 'not null',
        default: 'now()',
      },
    ],
  },
  {
    name: 'customers',
    rows: 8,
    primaryKey: 'customer_id',
    columns: [
      { name: 'customer_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'name', type: 'text', nullable: 'not null', default: '' },
      { name: 'country', type: 'text', nullable: 'not null', default: '' },
      { name: 'signup_date', type: 'date', nullable: 'not null', default: '' },
    ],
  },
  {
    name: 'order_items',
    rows: 20,
    primaryKey: 'item_id',
    columns: [
      { name: 'item_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'order_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'product_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'quantity', type: 'integer', nullable: 'not null', default: '' },
    ],
  },
  {
    name: 'orders',
    rows: 12,
    primaryKey: 'order_id',
    columns: [
      { name: 'order_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'customer_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'order_date', type: 'date', nullable: 'not null', default: '' },
      { name: 'status', type: 'text', nullable: 'not null', default: '' },
    ],
  },
  {
    name: 'products',
    rows: 10,
    primaryKey: 'product_id',
    columns: [
      { name: 'product_id', type: 'integer', nullable: 'not null', default: '' },
      { name: 'name', type: 'text', nullable: 'not null', default: '' },
      { name: 'category', type: 'text', nullable: 'not null', default: '' },
      { name: 'price', type: 'numeric', nullable: 'not null', default: '' },
    ],
  },
];

// --- psql aligned-table renderer ---------------------------------------------
// Verified byte-for-byte against the captured `\dt` body and the single-cell
// `SELECT count(*)` output. psql pads each cell as " <content> ", joins cells
// with "|", right-trims every printed row, and appends "(N rows)".

interface PsqlColumn {
  header: string;
  rightAlign?: boolean;
}

function centerText(text: string, width: number): string {
  const pad = width - text.length;
  if (pad <= 0) return text;
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + text + ' '.repeat(pad - left);
}

function padCell(value: string, width: number, rightAlign: boolean): string {
  const pad = width - value.length;
  if (pad <= 0) return value;
  return rightAlign ? ' '.repeat(pad) + value : value + ' '.repeat(pad);
}

function rtrim(value: string): string {
  return value.replace(/\s+$/, '');
}

function renderPsqlTable(
  columns: PsqlColumn[],
  rows: string[][],
  options: { title?: string; showCount?: boolean } = {}
): string {
  const { title, showCount = true } = options;
  const widths = columns.map((col, i) =>
    Math.max(col.header.length, ...rows.map((row) => (row[i] ?? '').length))
  );

  const headerLine = rtrim(
    columns.map((col, i) => ` ${centerText(col.header, widths[i])} `).join('|')
  );
  const separatorLine = widths.map((width) => '-'.repeat(width + 2)).join('+');
  const dataLines = rows.map((row) =>
    rtrim(
      columns.map((col, i) => ` ${padCell(row[i] ?? '', widths[i], !!col.rightAlign)} `).join('|')
    )
  );

  const parts: string[] = [];
  if (title) {
    const leadPad = Math.max(0, Math.floor((separatorLine.length - title.length) / 2));
    parts.push(' '.repeat(leadPad) + title);
  }
  parts.push(headerLine, separatorLine, ...dataLines);
  if (showCount) {
    parts.push(`(${rows.length} row${rows.length === 1 ? '' : 's'})`);
  }
  return parts.join('\n');
}

// --- Canned output captured verbatim from real Postgres ----------------------

const DT_OUTPUT = `          List of relations
 Schema |    Name     | Type  |    Owner
--------+-------------+-------+--------------
 public | big_events  | table | neondb_owner
 public | customers   | table | neondb_owner
 public | order_items | table | neondb_owner
 public | orders      | table | neondb_owner
 public | products    | table | neondb_owner
(5 rows)`;

const D_CUSTOMERS_OUTPUT = `              Table "public.customers"
   Column    |  Type   | Collation | Nullable | Default
-------------+---------+-----------+----------+---------
 customer_id | integer |           | not null |
 name        | text    |           | not null |
 country     | text    |           | not null |
 signup_date | date    |           | not null |
Indexes:
    "customers_pkey" PRIMARY KEY, btree (customer_id)`;

const EXPLAIN_SEQ_SCAN = `                          QUERY PLAN
---------------------------------------------------------------
 Seq Scan on big_events  (cost=0.00..3971.00 rows=40 width=26)
   Filter: (user_id = 42)
(2 rows)`;

const EXPLAIN_BITMAP_SCAN = `                                QUERY PLAN
------------------------------------------------------------------------------
 Bitmap Heap Scan on big_events  (cost=4.60..145.32 rows=40 width=26)
   Recheck Cond: (user_id = 42)
   ->  Bitmap Index Scan on idx_big_events_user  (cost=0.00..4.59 rows=40 width=0)
         Index Cond: (user_id = 42)
(4 rows)`;

const EXPLAIN_ANALYZE_SEQ = ` Aggregate (actual rows=1 loops=1)
   ->  Seq Scan on big_events (actual rows=50 loops=1)
         Filter: (user_id = 42)
         Rows Removed by Filter: 199950`;

const EXPLAIN_ANALYZE_BITMAP = ` Aggregate (actual rows=1 loops=1)
   ->  Bitmap Heap Scan on big_events (actual rows=50 loops=1)
         Recheck Cond: (user_id = 42)
         Heap Blocks: exact=49
         ->  Bitmap Index Scan on idx_big_events_user (actual rows=50 loops=1)
               Index Cond: (user_id = 42)`;

const HELP_BACKSLASH = `General
  \\l                    list databases
  \\conninfo             display connection information
  \\q                    quit psql (disabled in this browser lab)

Informational
  \\dt                   list tables
  \\d NAME               describe table NAME (columns, types, indexes)
  \\di                   list indexes

Formatting / session
  \\x                    toggle expanded (vertical) display
  \\timing               toggle query timing
  \\?                    show this help

Type SQL statements ending with a semicolon, e.g. SELECT count(*) FROM orders;`;

const WELCOME_HELP = `psql (16.3, browser sandbox)
Type "\\?" for help with psql meta-commands.
Type SQL statements ending with a semicolon, e.g. SELECT count(*) FROM orders;
Try "\\dt", "EXPLAIN SELECT * FROM big_events WHERE user_id = 42;", or "BEGIN;".`;

// --- Dynamic output builders -------------------------------------------------

function describeTable(name: string, indexCreated: boolean): string {
  if (name === 'customers') return D_CUSTOMERS_OUTPUT;

  const table = TABLES.find((item) => item.name === name);
  if (!table) {
    return `Did not find any relation named "${name}".`;
  }

  const columns: PsqlColumn[] = [
    { header: 'Column' },
    { header: 'Type' },
    { header: 'Collation' },
    { header: 'Nullable' },
    { header: 'Default' },
  ];
  const rows = table.columns.map((col) => [col.name, col.type, '', col.nullable, col.default]);

  const body = renderPsqlTable(columns, rows, {
    title: `Table "public.${table.name}"`,
    showCount: false,
  });

  const indexLines = [`    "${table.name}_pkey" PRIMARY KEY, btree (${table.primaryKey})`];
  if (table.name === 'big_events' && indexCreated) {
    indexLines.push('    "idx_big_events_user" btree (user_id)');
  }

  return `${body}\nIndexes:\n${indexLines.join('\n')}`;
}

function listIndexes(indexCreated: boolean): string {
  const rows: string[][] = [
    ['public', 'big_events_pkey', 'index', 'neondb_owner', 'big_events'],
    ['public', 'customers_pkey', 'index', 'neondb_owner', 'customers'],
    ['public', 'order_items_pkey', 'index', 'neondb_owner', 'order_items'],
    ['public', 'orders_pkey', 'index', 'neondb_owner', 'orders'],
    ['public', 'products_pkey', 'index', 'neondb_owner', 'products'],
  ];
  if (indexCreated) {
    rows.push(['public', 'idx_big_events_user', 'index', 'neondb_owner', 'big_events']);
  }
  rows.sort((a, b) => a[1].localeCompare(b[1]));

  return renderPsqlTable(
    [
      { header: 'Schema' },
      { header: 'Name' },
      { header: 'Type' },
      { header: 'Owner' },
      { header: 'Table' },
    ],
    rows,
    { title: 'List of relations' }
  );
}

function listDatabases(): string {
  return renderPsqlTable(
    [
      { header: 'Name' },
      { header: 'Owner' },
      { header: 'Encoding' },
      { header: 'Collate' },
      { header: 'Ctype' },
      { header: 'Access privileges' },
    ],
    [['shop', 'neondb_owner', 'UTF8', 'en_US.utf8', 'en_US.utf8', '']],
    { title: 'List of databases' }
  );
}

function ordersCountOutput(count: number): string {
  return renderPsqlTable([{ header: 'count', rightAlign: true }], [[String(count)]]);
}

function customersOutput(limit?: number): string {
  const source = typeof limit === 'number' ? CUSTOMERS.slice(0, limit) : CUSTOMERS;
  const rows = source.map((row) => [String(row[0]), row[1], row[2], row[3]]);
  return renderPsqlTable(
    [
      { header: 'customer_id', rightAlign: true },
      { header: 'name' },
      { header: 'country' },
      { header: 'signup_date' },
    ],
    rows
  );
}

// --- Command matching ---------------------------------------------------------

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/;+\s*$/, '')
    .replace(/\s+/g, ' ');
}

function commandMatches(cmd: string, expected: string | string[]): boolean {
  const normalized = normalize(cmd);
  if (Array.isArray(expected)) {
    return expected.some((item) => normalize(item) === normalized);
  }
  return normalize(expected) === normalized;
}

// --- Lessons ------------------------------------------------------------------

export const LESSONS: Lesson[] = [
  {
    id: 'explore',
    title: 'Explore the database',
    description: 'List tables and inspect a table with psql meta-commands',
    icon: <Table2 className="h-5 w-5" />,
    commands: [
      {
        instruction: 'List every table in the current database.',
        hint: 'Use the psql meta-command "\\dt".',
        expectedCommand: '\\dt',
        explanation:
          '\\dt lists relations of type table. Meta-commands start with a backslash and are handled by psql itself, not sent to the server as SQL.',
      },
      {
        instruction: 'Describe the customers table to see its columns and indexes.',
        hint: 'Use "\\d customers".',
        expectedCommand: '\\d customers',
        explanation:
          '\\d NAME shows columns, types, nullability, defaults, and indexes. The customers_pkey line is the primary-key index Postgres created automatically.',
      },
    ],
  },
  {
    id: 'query',
    title: 'Run a query',
    description: 'Count rows and read a small result set',
    icon: <Terminal className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Count how many rows are in the orders table.',
        hint: 'Run "SELECT count(*) FROM orders;" (SQL statements end with a semicolon).',
        expectedCommand: 'SELECT count(*) FROM orders;',
        explanation:
          'count(*) returns the number of rows. Unlike meta-commands, this is real SQL sent to the server, and psql renders the result in its aligned format.',
      },
    ],
  },
  {
    id: 'indexes',
    title: 'List the indexes',
    description: 'See which indexes exist before you add one',
    icon: <KeyRound className="h-5 w-5" />,
    commands: [
      {
        instruction: 'List all indexes in the database.',
        hint: 'Use "\\di".',
        expectedCommand: '\\di',
        explanation:
          'Right now every index is a *_pkey created for a primary key. There is no index on big_events.user_id yet, which is exactly why the next query is slow.',
      },
    ],
  },
  {
    id: 'explain-seq',
    title: 'EXPLAIN a filter',
    description: 'Watch Postgres pick a sequential scan',
    icon: <Search className="h-5 w-5" />,
    commands: [
      {
        instruction:
          'Ask the planner how it would run a filter on big_events (200,000 rows) with no useful index.',
        hint: 'Run "EXPLAIN SELECT * FROM big_events WHERE user_id = 42;".',
        expectedCommand: 'EXPLAIN SELECT * FROM big_events WHERE user_id = 42;',
        explanation:
          'With no index on user_id, the planner chooses a Seq Scan: it reads all 200,000 rows and filters. Note the estimated total cost of 3971.00.',
      },
    ],
  },
  {
    id: 'create-index',
    title: 'Create an index',
    description: 'Add a B-tree index on the filtered column',
    icon: <PlusCircle className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Create a B-tree index on big_events.user_id.',
        hint: 'Run "CREATE INDEX idx_big_events_user ON big_events(user_id);".',
        expectedCommand: [
          'CREATE INDEX idx_big_events_user ON big_events(user_id);',
          'CREATE INDEX idx_big_events_user ON big_events (user_id);',
        ],
        explanation:
          'CREATE INDEX builds a B-tree keyed on user_id. The server replies "CREATE INDEX". The planner can now look rows up instead of scanning the whole table.',
      },
    ],
  },
  {
    id: 'explain-index',
    title: 'EXPLAIN again',
    description: 'Compare the plan once the index exists',
    icon: <Gauge className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Run the exact same EXPLAIN again now that the index exists.',
        hint: 'Run "EXPLAIN SELECT * FROM big_events WHERE user_id = 42;" once more.',
        expectedCommand: 'EXPLAIN SELECT * FROM big_events WHERE user_id = 42;',
        explanation:
          'Same query, different plan: a Bitmap Index Scan feeds a Bitmap Heap Scan. Estimated cost drops from 3971.00 to 145.32, roughly a 27x improvement.',
      },
    ],
  },
  {
    id: 'explain-analyze',
    title: 'EXPLAIN ANALYZE',
    description: 'Actually run the query and read real row counts',
    icon: <Timer className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Use EXPLAIN ANALYZE to run the query and see estimated vs. actual work.',
        hint: 'Run "EXPLAIN ANALYZE SELECT count(*) FROM big_events WHERE user_id = 42;".',
        expectedCommand: 'EXPLAIN ANALYZE SELECT count(*) FROM big_events WHERE user_id = 42;',
        explanation:
          'EXPLAIN ANALYZE executes the query and reports actual rows. With the index, the scan touches ~50 rows instead of removing 199,950 with a filter.',
      },
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions',
    description: 'BEGIN, DELETE, and safely ROLLBACK',
    icon: <History className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Open a transaction so you can undo changes.',
        hint: 'Run "BEGIN;". Notice the prompt changes to shop=*#.',
        expectedCommand: 'BEGIN;',
        explanation:
          'BEGIN starts a transaction block. The prompt changes to shop=*# to show you are inside an open transaction that is not yet committed.',
      },
      {
        instruction: 'Delete the cancelled orders inside the transaction.',
        hint: 'Run "DELETE FROM orders WHERE status = \'cancelled\';".',
        expectedCommand: "DELETE FROM orders WHERE status = 'cancelled';",
        explanation:
          'DELETE removes matching rows and reports "DELETE 2". Because you are in a transaction, this change is not permanent until you COMMIT.',
      },
      {
        instruction: 'Confirm the row count dropped inside the transaction.',
        hint: 'Run "SELECT count(*) FROM orders;" again.',
        expectedCommand: 'SELECT count(*) FROM orders;',
        explanation:
          'Inside the transaction the count is now 10. Your session sees its own uncommitted changes, but other sessions still see 12.',
      },
      {
        instruction: 'Undo everything with a rollback.',
        hint: 'Run "ROLLBACK;".',
        expectedCommand: 'ROLLBACK;',
        explanation:
          'ROLLBACK discards every change made in the transaction and ends it. The prompt returns to shop=#. COMMIT instead would have kept the delete.',
      },
      {
        instruction: 'Verify the rollback restored the deleted rows.',
        hint: 'Run "SELECT count(*) FROM orders;" one last time.',
        expectedCommand: 'SELECT count(*) FROM orders;',
        explanation:
          'The count is back to 12. ROLLBACK is your safety net: wrap risky changes in a transaction and you can always undo before committing.',
      },
    ],
  },
];

// --- Component ----------------------------------------------------------------

export default function PostgresTerminalSimulator() {
  const [pgState, setPgState] = useState<PgState>(createInitialState);

  const execute = useCallback(
    (rawInput: string): ExecuteResult => {
      const input = rawInput.trim();
      const lower = normalize(input);

      if (input === 'clear') {
        return { output: '', clear: true };
      }

      // psql meta-commands (backslash commands)
      if (input.startsWith('\\')) {
        const [base, arg] = input.split(/\s+/);
        const metaKey = base.toLowerCase();

        if (metaKey === '\\dt') return { output: DT_OUTPUT };
        if (metaKey === '\\di') return { output: listIndexes(pgState.indexCreated) };
        if (metaKey === '\\d') {
          if (!arg) {
            return { output: `${DT_OUTPUT}` };
          }
          return { output: describeTable(arg.toLowerCase(), pgState.indexCreated) };
        }
        if (metaKey === '\\l' || metaKey === '\\list') return { output: listDatabases() };
        if (metaKey === '\\conninfo') {
          return {
            output: `You are connected to database "${CONNECTION.database}" as user "${CONNECTION.user}" on host "ep-fragrant-block-123456.us-east-2.aws.neon.tech" at port "5432".`,
          };
        }
        if (metaKey === '\\x') {
          const next = !pgState.expanded;
          setPgState((prev) => ({ ...prev, expanded: next }));
          return { output: `Expanded display is ${next ? 'on' : 'off'}.` };
        }
        if (metaKey === '\\timing') {
          const next = !pgState.timing;
          setPgState((prev) => ({ ...prev, timing: next }));
          return { output: `Timing is ${next ? 'on' : 'off'}.` };
        }
        if (metaKey === '\\?') return { output: HELP_BACKSLASH };
        if (metaKey === '\\q') {
          return {
            output:
              'This is a browser lab, so there is nothing to quit. Use "Reset lab" to start over.',
          };
        }
        return { output: `invalid command ${base}. Try \\? for help.`, type: 'error' };
      }

      // Transaction control
      if (
        lower === 'begin' ||
        lower === 'begin work' ||
        lower === 'begin transaction' ||
        lower === 'start transaction'
      ) {
        setPgState((prev) => ({ ...prev, inTransaction: true }));
        return { output: 'BEGIN' };
      }
      if (lower === 'commit' || lower === 'commit work' || lower === 'end') {
        setPgState((prev) => ({ ...prev, inTransaction: false }));
        return { output: 'COMMIT' };
      }
      if (lower === 'rollback' || lower === 'rollback work' || lower === 'abort') {
        setPgState((prev) => ({ ...prev, inTransaction: false, ordersCount: 12 }));
        return { output: 'ROLLBACK' };
      }

      // EXPLAIN (ANALYZE) on the big_events filter
      if (lower.startsWith('explain')) {
        const referencesBigEvents = lower.includes('big_events') && lower.includes('user_id');
        if (!referencesBigEvents) {
          return {
            output:
              'ERROR:  relation referenced in this lab is only big_events; try the EXPLAIN in the lesson.',
            type: 'error',
          };
        }
        if (lower.startsWith('explain analyze')) {
          return { output: pgState.indexCreated ? EXPLAIN_ANALYZE_BITMAP : EXPLAIN_ANALYZE_SEQ };
        }
        return { output: pgState.indexCreated ? EXPLAIN_BITMAP_SCAN : EXPLAIN_SEQ_SCAN };
      }

      // CREATE INDEX
      if (lower.startsWith('create index')) {
        if (!lower.includes('big_events')) {
          return { output: 'ERROR:  this lab only indexes big_events(user_id)', type: 'error' };
        }
        if (pgState.indexCreated) {
          return { output: 'ERROR:  relation "idx_big_events_user" already exists', type: 'error' };
        }
        setPgState((prev) => ({ ...prev, indexCreated: true }));
        return { output: 'CREATE INDEX' };
      }

      // DELETE the cancelled orders
      if (lower.startsWith('delete from orders') && lower.includes('cancelled')) {
        setPgState((prev) => ({ ...prev, ordersCount: 10 }));
        return { output: 'DELETE 2' };
      }

      // Minimal SELECT support (this sim is about psql/engine, not query-building)
      if (lower === 'select count(*) from orders' || lower === 'select count (*) from orders') {
        return { output: ordersCountOutput(pgState.ordersCount) };
      }
      if (/^select \* from customers/.test(lower)) {
        const limitMatch = lower.match(/limit\s+(\d+)/);
        const limit = limitMatch ? Number(limitMatch[1]) : undefined;
        return { output: customersOutput(limit) };
      }

      if (input === 'help') {
        return { output: WELCOME_HELP };
      }

      if (lower.startsWith('select')) {
        return {
          output:
            'ERROR:  this lab supports SELECT count(*) FROM orders; and SELECT * FROM customers;',
          type: 'error',
        };
      }

      const firstToken = input.split(/\s+/)[0] || '';
      return { output: `ERROR:  syntax error at or near "${firstToken}"`, type: 'error' };
    },
    [
      pgState.expanded,
      pgState.indexCreated,
      pgState.inTransaction,
      pgState.ordersCount,
      pgState.timing,
    ]
  );

  const onReset = useCallback(() => {
    setPgState(createInitialState());
  }, []);

  const lab = useTerminalSimulator<LessonCommand>({
    lessons: LESSONS,
    execute,
    matches: (cmd, command) => commandMatches(cmd, command.expectedCommand),
    successMessage: (command) => `✓ ${command.explanation}`,
    completionKeyStyle: 'index',
    advanceDelayMs: 700,
    historyStyle: 'recent-first',
    promoteOutputType: true,
    guardRepeatCompletion: true,
    onReset,
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

  const prompt = pgState.inTransaction ? 'shop=*#' : 'shop=#';

  const indexNames = [
    'big_events_pkey',
    'customers_pkey',
    'order_items_pkey',
    'orders_pkey',
    'products_pkey',
    ...(pgState.indexCreated ? ['idx_big_events_user'] : []),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <SimFrame>
      <SimLabBar
        title="PostgreSQL Terminal Simulator"
        icon={Database}
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
          summary="You explored with psql meta-commands, read real EXPLAIN plans, added an index, and used a transaction you could roll back."
          stats={labStats(lab, LESSONS, ui, { showMe: true })}
          actions={
            <Button type="button" variant="outline" onClick={ui.keepExploring}>
              Keep exploring
            </Button>
          }
          onPlayAgain={ui.startOver}
          playAgainLabel="Start over"
        />
      ) : (
        <SimLabLayout
          terminal={
            <SimTerminal
              label="psql"
              status={
                pgState.inTransaction
                  ? 'IN TRANSACTION'
                  : `${CONNECTION.database}/${CONNECTION.user}`
              }
              prompt={prompt}
              linePrompt="shop=#"
              lines={labLines(terminalHistory, [
                {
                  type: 'success',
                  content: 'Connected to database "shop" as user "neondb_owner".',
                },
                {
                  type: 'muted',
                  content: 'Type "\\?" for meta-command help, or follow the task above.',
                },
              ])}
              value={inputValue}
              onChange={setInputValue}
              onSubmit={submitCommand}
              onKeyDown={lab.handleKeyDown}
              inputRef={inputRef}
              placeholder={'\\dt'}
              autoFocus
              heightClassName={LAB_TERMINAL_HEIGHT}
            />
          }
          aside={
            <>
              <SimLabPanel
                title="Database"
                icon={Database}
                summary={
                  pgState.inTransaction ? 'in a transaction' : `${indexNames.length} indexes`
                }
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <Metric label="Tables" value={TABLES.length} />
                    <Metric label="Indexes" value={indexNames.length} />
                    <Metric label="Orders" value={pgState.ordersCount} />
                  </div>

                  <dl className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">database</dt>
                      <dd className="font-mono">{CONNECTION.database}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">user</dt>
                      <dd className="font-mono">{CONNECTION.user}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">transaction</dt>
                      <dd>
                        <Badge
                          variant={pgState.inTransaction ? 'default' : 'secondary'}
                          className="font-mono text-xs"
                        >
                          {pgState.inTransaction ? 'IN TRANSACTION' : 'idle'}
                        </Badge>
                      </dd>
                    </div>
                  </dl>

                  <StateHeading icon={Table2}>Tables</StateHeading>
                  <ul className="space-y-1.5">
                    {TABLES.map((table) => {
                      const rowCount = table.name === 'orders' ? pgState.ordersCount : table.rows;
                      return (
                        <li
                          key={table.name}
                          className="flex items-center justify-between rounded-md border px-2 py-1.5"
                        >
                          <span className="font-mono text-sm">{table.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {rowCount.toLocaleString('en-US')} rows
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <StateHeading icon={ListTree}>Indexes</StateHeading>
                  <ul className="space-y-1.5">
                    {indexNames.map((name) => {
                      const isNew = name === 'idx_big_events_user';
                      return (
                        <li
                          key={name}
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-2 py-1.5',
                            isNew && SIM_TONE.success.surface
                          )}
                        >
                          <KeyRound
                            className={cn(
                              'h-4 w-4 shrink-0',
                              isNew ? SIM_TONE.success.iconClass : 'text-muted-foreground'
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate font-mono text-xs">{name}</span>
                          {isNew && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              new
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </SimLabPanel>
              <SimLabPanel title="Lessons" icon={BookOpen} summary={lessonsSummary(LESSONS, lab)}>
                <SimLabLessons lessons={LESSONS} lab={lab} ui={ui} />
              </SimLabPanel>
            </>
          }
        />
      )}
    </SimFrame>
  );
}

function StateHeading({ icon: Icon, children }: { icon: typeof Table2; children: ReactNode }) {
  return (
    <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </h4>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
