/**
 * SQL Terminal Simulator engine.
 *
 * A small, dependency-free SQL evaluator used by the SQL Terminal Simulator
 * game. It is deliberately hybrid:
 *
 *  - Single-table SELECT queries are evaluated live against the in-memory
 *    dataset below (SELECT/DISTINCT/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT plus
 *    the common aggregates). This is what learners experiment with most.
 *  - Multi-table joins, subqueries, and window functions are not fully
 *    interpreted. Instead, the handful of queries used by the guided lessons
 *    return canned output that was captured verbatim from a real PostgreSQL
 *    instance, so the results shown are exactly what Postgres returns.
 *
 * Numeric formatting mirrors Postgres for this dataset: money/aggregate values
 * render with 2 decimals, counts render as integers, dates render as
 * YYYY-MM-DD.
 *
 * This module is pure (no React) so it can be unit tested with plain Node.
 */

export type ColType = 'int' | 'numeric' | 'text' | 'date';

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface QueryError {
  error: string;
}

interface ColumnDef {
  name: string;
  type: ColType;
}

interface TableDef {
  name: string;
  columns: ColumnDef[];
  rows: Record<string, string | number | null>[];
}

const FRIENDLY_ERROR =
  'This playground evaluates single-table queries live. Multi-table joins, subqueries, and window functions run in the guided lessons.';

// --------------------------------------------------------------------------
// Dataset (matches the real Postgres instance used to verify the outputs).
// --------------------------------------------------------------------------

const customers: TableDef = {
  name: 'customers',
  columns: [
    { name: 'customer_id', type: 'int' },
    { name: 'name', type: 'text' },
    { name: 'country', type: 'text' },
    { name: 'signup_date', type: 'date' },
  ],
  rows: [
    { customer_id: 1, name: 'Alice Johnson', country: 'USA', signup_date: '2025-01-15' },
    { customer_id: 2, name: 'Bob Smith', country: 'UK', signup_date: '2025-02-03' },
    { customer_id: 3, name: 'Carol White', country: 'USA', signup_date: '2025-02-20' },
    { customer_id: 4, name: 'David Brown', country: 'Canada', signup_date: '2025-03-11' },
    { customer_id: 5, name: 'Emma Davis', country: 'UK', signup_date: '2025-04-02' },
    { customer_id: 6, name: 'Frank Miller', country: 'Germany', signup_date: '2025-05-19' },
    { customer_id: 7, name: 'Grace Lee', country: 'USA', signup_date: '2025-06-08' },
    { customer_id: 8, name: 'Henry Wilson', country: 'Canada', signup_date: '2025-07-21' },
  ],
};

const products: TableDef = {
  name: 'products',
  columns: [
    { name: 'product_id', type: 'int' },
    { name: 'name', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'price', type: 'numeric' },
  ],
  rows: [
    { product_id: 1, name: 'Keyboard', category: 'Electronics', price: 49.99 },
    { product_id: 2, name: 'Mouse', category: 'Electronics', price: 24.99 },
    { product_id: 3, name: 'Monitor', category: 'Electronics', price: 199.99 },
    { product_id: 4, name: 'Desk Chair', category: 'Furniture', price: 149.99 },
    { product_id: 5, name: 'Standing Desk', category: 'Furniture', price: 399.99 },
    { product_id: 6, name: 'Notebook', category: 'Stationery', price: 4.99 },
    { product_id: 7, name: 'Pen Set', category: 'Stationery', price: 12.99 },
    { product_id: 8, name: 'USB-C Cable', category: 'Electronics', price: 9.99 },
    { product_id: 9, name: 'Webcam', category: 'Electronics', price: 79.99 },
    { product_id: 10, name: 'Desk Lamp', category: 'Furniture', price: 34.99 },
  ],
};

const orders: TableDef = {
  name: 'orders',
  columns: [
    { name: 'order_id', type: 'int' },
    { name: 'customer_id', type: 'int' },
    { name: 'order_date', type: 'date' },
    { name: 'status', type: 'text' },
  ],
  rows: [
    { order_id: 1001, customer_id: 1, order_date: '2025-03-01', status: 'delivered' },
    { order_id: 1002, customer_id: 2, order_date: '2025-03-05', status: 'delivered' },
    { order_id: 1003, customer_id: 1, order_date: '2025-04-10', status: 'shipped' },
    { order_id: 1004, customer_id: 3, order_date: '2025-04-15', status: 'delivered' },
    { order_id: 1005, customer_id: 4, order_date: '2025-05-02', status: 'cancelled' },
    { order_id: 1006, customer_id: 5, order_date: '2025-05-20', status: 'shipped' },
    { order_id: 1007, customer_id: 1, order_date: '2025-06-01', status: 'pending' },
    { order_id: 1008, customer_id: 6, order_date: '2025-06-11', status: 'delivered' },
    { order_id: 1009, customer_id: 7, order_date: '2025-06-25', status: 'shipped' },
    { order_id: 1010, customer_id: 3, order_date: '2025-07-03', status: 'pending' },
    { order_id: 1011, customer_id: 8, order_date: '2025-07-15', status: 'delivered' },
    { order_id: 1012, customer_id: 2, order_date: '2025-07-28', status: 'cancelled' },
  ],
};

const orderItems: TableDef = {
  name: 'order_items',
  columns: [
    { name: 'item_id', type: 'int' },
    { name: 'order_id', type: 'int' },
    { name: 'product_id', type: 'int' },
    { name: 'quantity', type: 'int' },
  ],
  rows: [
    { item_id: 1, order_id: 1001, product_id: 1, quantity: 1 },
    { item_id: 2, order_id: 1001, product_id: 2, quantity: 1 },
    { item_id: 3, order_id: 1001, product_id: 8, quantity: 2 },
    { item_id: 4, order_id: 1002, product_id: 3, quantity: 1 },
    { item_id: 5, order_id: 1002, product_id: 9, quantity: 1 },
    { item_id: 6, order_id: 1003, product_id: 4, quantity: 1 },
    { item_id: 7, order_id: 1003, product_id: 10, quantity: 2 },
    { item_id: 8, order_id: 1004, product_id: 6, quantity: 5 },
    { item_id: 9, order_id: 1004, product_id: 7, quantity: 3 },
    { item_id: 10, order_id: 1005, product_id: 5, quantity: 1 },
    { item_id: 11, order_id: 1006, product_id: 3, quantity: 2 },
    { item_id: 12, order_id: 1007, product_id: 2, quantity: 1 },
    { item_id: 13, order_id: 1007, product_id: 8, quantity: 1 },
    { item_id: 14, order_id: 1008, product_id: 1, quantity: 1 },
    { item_id: 15, order_id: 1008, product_id: 9, quantity: 1 },
    { item_id: 16, order_id: 1008, product_id: 10, quantity: 1 },
    { item_id: 17, order_id: 1009, product_id: 5, quantity: 1 },
    { item_id: 18, order_id: 1010, product_id: 6, quantity: 10 },
    { item_id: 19, order_id: 1011, product_id: 3, quantity: 1 },
    { item_id: 20, order_id: 1012, product_id: 4, quantity: 2 },
  ],
};

const TABLE_MAP: Record<string, TableDef> = {
  customers,
  products,
  orders,
  order_items: orderItems,
};

/** Schema + row counts for the live state panel. */
export const TABLES = Object.values(TABLE_MAP).map((table) => ({
  name: table.name,
  columns: table.columns.map((column) => ({ name: column.name, type: column.type })),
  rowCount: table.rows.length,
}));

// --------------------------------------------------------------------------
// Canned results captured from real Postgres.
// --------------------------------------------------------------------------

interface CannedEntry {
  sql: string;
  result: QueryResult;
}

const CANNED_QUERIES: CannedEntry[] = [
  {
    // JOIN: shipped orders with customer name
    sql:
      "SELECT o.order_id, c.name, o.status FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'shipped' ORDER BY o.order_id;",
    result: {
      columns: ['order_id', 'name', 'status'],
      rows: [
        [1003, 'Alice Johnson', 'shipped'],
        [1006, 'Emma Davis', 'shipped'],
        [1009, 'Grace Lee', 'shipped'],
      ],
    },
  },
  {
    // Revenue per customer across four joined tables
    sql:
      'SELECT c.name, SUM(oi.quantity * p.price) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY c.name ORDER BY revenue DESC;',
    result: {
      columns: ['name', 'revenue'],
      rows: [
        ['Bob Smith', '579.96'],
        ['Grace Lee', '399.99'],
        ['David Brown', '399.99'],
        ['Emma Davis', '399.98'],
        ['Alice Johnson', '349.91'],
        ['Henry Wilson', '199.99'],
        ['Frank Miller', '164.97'],
        ['Carol White', '113.82'],
      ],
    },
  },
  {
    // Subquery: products priced above the average
    sql:
      'SELECT name, price FROM products WHERE price > (SELECT avg(price) FROM products) ORDER BY price DESC;',
    result: {
      columns: ['name', 'price'],
      rows: [
        ['Standing Desk', '399.99'],
        ['Monitor', '199.99'],
        ['Desk Chair', '149.99'],
      ],
    },
  },
  {
    // Window function: rank products by price within each category
    sql:
      'SELECT name, category, price, rank() OVER (PARTITION BY category ORDER BY price DESC) AS rnk FROM products ORDER BY category, rnk;',
    result: {
      columns: ['name', 'category', 'price', 'rnk'],
      rows: [
        ['Monitor', 'Electronics', '199.99', 1],
        ['Webcam', 'Electronics', '79.99', 2],
        ['Keyboard', 'Electronics', '49.99', 3],
        ['Mouse', 'Electronics', '24.99', 4],
        ['USB-C Cable', 'Electronics', '9.99', 5],
        ['Standing Desk', 'Furniture', '399.99', 1],
        ['Desk Chair', 'Furniture', '149.99', 2],
        ['Desk Lamp', 'Furniture', '34.99', 3],
        ['Pen Set', 'Stationery', '12.99', 1],
        ['Notebook', 'Stationery', '4.99', 2],
      ],
    },
  },
];

/**
 * Normalize a query for equality matching: strip the trailing semicolon,
 * collapse whitespace, lowercase, and squeeze spaces around punctuation and
 * operators. Used both for canned-query lookup and for lesson matching so a
 * learner's spacing/case never blocks progress.
 */
export function normalizeSql(sql: string): string {
  return sql
    .trim()
    .replace(/;+\s*$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\s*([(),*=<>])\s*/g, '$1')
    .trim();
}

const CANNED_LOOKUP = new Map<string, QueryResult>(
  CANNED_QUERIES.map((entry) => [normalizeSql(entry.sql), entry.result]),
);

// --------------------------------------------------------------------------
// Single-table evaluator.
// --------------------------------------------------------------------------

interface SelectItem {
  raw: string;
  alias?: string;
  name: string;
  type: ColType;
  decimals?: number;
  isAggregate: boolean;
  isStar: boolean;
  /** For plain columns: the resolved column name. */
  column?: string;
  /** For aggregates: the aggregate expression to evaluate. */
  aggExpr?: string;
}

interface OrderTerm {
  name: string;
  desc: boolean;
}

type Row = Record<string, string | number | null>;

function stripPrefix(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes('.') ? trimmed.split('.').pop()!.trim() : trimmed;
}

function splitTopLevel(input: string, delimiter = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === delimiter && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function columnType(table: TableDef, column: string): ColType {
  const found = table.columns.find((col) => col.name === column);
  return found?.type ?? 'text';
}

function parseSelectItem(raw: string, table: TableDef): SelectItem | { error: string } {
  let expr = raw.trim();
  let alias: string | undefined;

  const asMatch = expr.match(/^(.*)\s+as\s+([A-Za-z_][\w]*)$/i);
  if (asMatch) {
    expr = asMatch[1].trim();
    alias = asMatch[2].trim();
  }

  if (expr === '*') {
    return { raw, alias, name: '*', type: 'text', isAggregate: false, isStar: true };
  }

  const round = expr.match(/^round\s*\(\s*(.+)\s*,\s*(\d+)\s*\)$/i);
  if (round) {
    const decimals = Number(round[2]);
    return {
      raw,
      alias,
      name: alias ?? 'round',
      type: 'numeric',
      decimals,
      isAggregate: true,
      isStar: false,
      aggExpr: expr,
    };
  }

  const aggMatch = expr.match(/^(count|sum|avg|min|max)\s*\(\s*(.+?)\s*\)$/i);
  if (aggMatch) {
    const fn = aggMatch[1].toLowerCase();
    const inner = aggMatch[2].trim();
    let type: ColType = 'numeric';
    if (fn === 'count') {
      type = 'int';
    } else if (fn === 'avg') {
      type = 'numeric';
    } else if (inner === '*') {
      type = 'int';
    } else {
      type = columnType(table, stripPrefix(inner));
    }
    return {
      raw,
      alias,
      name: alias ?? fn,
      type,
      decimals: type === 'numeric' ? 2 : undefined,
      isAggregate: true,
      isStar: false,
      aggExpr: expr,
    };
  }

  // Plain column reference.
  const column = stripPrefix(expr);
  if (!table.columns.some((col) => col.name === column)) {
    return { error: `column "${column}" does not exist on table "${table.name}"` };
  }
  return {
    raw,
    alias,
    name: alias ?? column,
    type: columnType(table, column),
    isAggregate: false,
    isStar: false,
    column,
  };
}

function evalAggregate(expr: string, rows: Row[], table: TableDef): number {
  const trimmed = expr.trim();

  const round = trimmed.match(/^round\s*\(\s*(.+)\s*,\s*(\d+)\s*\)$/i);
  if (round) {
    const value = evalAggregate(round[1].trim(), rows, table);
    const factor = 10 ** Number(round[2]);
    return Math.round(value * factor) / factor;
  }

  const agg = trimmed.match(/^(count|sum|avg|min|max)\s*\(\s*(.+?)\s*\)$/i);
  if (agg) {
    const fn = agg[1].toLowerCase();
    const inner = agg[2].trim();

    if (fn === 'count') {
      if (inner === '*') return rows.length;
      const column = stripPrefix(inner);
      return rows.filter((row) => row[column] !== null && row[column] !== undefined).length;
    }

    const column = stripPrefix(inner);
    const values = rows
      .map((row) => row[column])
      .filter((value): value is number => typeof value === 'number');

    if (fn === 'sum') return values.reduce((sum, value) => sum + value, 0);
    if (fn === 'avg') return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    if (fn === 'min') return values.length ? Math.min(...values) : 0;
    if (fn === 'max') return values.length ? Math.max(...values) : 0;
  }

  // Bare numeric literal.
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  return 0;
}

interface Condition {
  column: string;
  op: string;
  literal: { kind: 'text' | 'number'; value: string | number };
}

function parseLiteral(raw: string): { kind: 'text' | 'number'; value: string | number } {
  const value = raw.trim();
  if (/^'.*'$/.test(value)) return { kind: 'text', value: value.slice(1, -1) };
  if (/^-?\d+(\.\d+)?$/.test(value)) return { kind: 'number', value: Number(value) };
  return { kind: 'text', value: value.replace(/^'|'$/g, '') };
}

function parseCondition(text: string): Condition | null {
  const like = text.match(/^(.+?)\s+(not\s+like|like)\s+(.+)$/i);
  if (like) {
    return {
      column: stripPrefix(like[1]),
      op: like[2].toLowerCase().replace(/\s+/g, ' '),
      literal: parseLiteral(like[3]),
    };
  }
  const symbol = text.match(/^(.+?)\s*(<=|>=|<>|!=|=|<|>)\s*(.+)$/);
  if (symbol) {
    return {
      column: stripPrefix(symbol[1]),
      op: symbol[2],
      literal: parseLiteral(symbol[3]),
    };
  }
  return null;
}

function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${body}$`);
}

function evalCondition(condition: Condition, row: Row, table: TableDef): boolean {
  const cellValue = row[condition.column];
  const type = columnType(table, condition.column);

  if (condition.op === 'like' || condition.op === 'not like') {
    const matched = likeToRegex(String(condition.literal.value)).test(String(cellValue ?? ''));
    return condition.op === 'not like' ? !matched : matched;
  }

  let left: number | string;
  let right: number | string;
  if (type === 'int' || type === 'numeric') {
    left = Number(cellValue);
    right = Number(condition.literal.value);
  } else {
    left = String(cellValue ?? '');
    right = String(condition.literal.value);
  }

  switch (condition.op) {
    case '=':
      return left === right;
    case '<>':
    case '!=':
      return left !== right;
    case '<':
      return left < right;
    case '>':
      return left > right;
    case '<=':
      return left <= right;
    case '>=':
      return left >= right;
    default:
      return false;
  }
}

function buildWherePredicate(
  whereStr: string,
  table: TableDef,
): ((row: Row) => boolean) | { error: string } {
  const orGroups = splitTopLevel(whereStr, ' ')
    .join(' ')
    .split(/\s+or\s+/i)
    .map((group) => group.trim())
    .filter(Boolean);

  const parsedGroups: Condition[][] = [];
  for (const group of orGroups) {
    const andConditions = group
      .split(/\s+and\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);
    const conditions: Condition[] = [];
    for (const part of andConditions) {
      const condition = parseCondition(part);
      if (!condition) return { error: `could not parse condition: ${part}` };
      if (!table.columns.some((col) => col.name === condition.column)) {
        return { error: `column "${condition.column}" does not exist on table "${table.name}"` };
      }
      conditions.push(condition);
    }
    parsedGroups.push(conditions);
  }

  return (row: Row) =>
    parsedGroups.some((group) => group.every((condition) => evalCondition(condition, row, table)));
}

function formatCell(value: string | number | null, type: ColType, decimals?: number): string | number | null {
  if (value === null || value === undefined) return null;
  if (type === 'numeric') return Number(value).toFixed(decimals ?? 2);
  if (type === 'int') return typeof value === 'number' ? value : Number(value);
  return String(value);
}

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a);
  const bs = String(b);
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

function evaluateSingleTable(sql: string): QueryResult | QueryError | null {
  const selectMatch = sql.match(/^select\s+([\s\S]+?)\s+from\s+([\s\S]+)$/i);
  if (!selectMatch) return null;

  let selectPart = selectMatch[1].trim();
  let fromPart = selectMatch[2].trim();

  let distinct = false;
  if (/^distinct\s+/i.test(selectPart)) {
    distinct = true;
    selectPart = selectPart.replace(/^distinct\s+/i, '').trim();
  }

  const clauses = { table: '', where: '', groupBy: '', having: '', orderBy: '', limit: '' };
  let remaining = fromPart;

  const limitMatch = remaining.match(/\blimit\s+(\d+)\s*$/i);
  if (limitMatch) {
    clauses.limit = limitMatch[1];
    remaining = remaining.slice(0, limitMatch.index).trim();
  }
  const orderMatch = remaining.match(/\border\s+by\s+([\s\S]+)$/i);
  if (orderMatch) {
    clauses.orderBy = orderMatch[1].trim();
    remaining = remaining.slice(0, orderMatch.index).trim();
  }
  const havingMatch = remaining.match(/\bhaving\s+([\s\S]+)$/i);
  if (havingMatch) {
    clauses.having = havingMatch[1].trim();
    remaining = remaining.slice(0, havingMatch.index).trim();
  }
  const groupMatch = remaining.match(/\bgroup\s+by\s+([\s\S]+)$/i);
  if (groupMatch) {
    clauses.groupBy = groupMatch[1].trim();
    remaining = remaining.slice(0, groupMatch.index).trim();
  }
  const whereMatch = remaining.match(/\bwhere\s+([\s\S]+)$/i);
  if (whereMatch) {
    clauses.where = whereMatch[1].trim();
    remaining = remaining.slice(0, whereMatch.index).trim();
  }
  clauses.table = remaining.trim();

  if (/\bjoin\b/i.test(clauses.table)) return { error: FRIENDLY_ERROR };

  const tableTokens = clauses.table.split(/\s+/).filter((token) => token.toLowerCase() !== 'as');
  const tableName = (tableTokens[0] ?? '').toLowerCase();
  const table = TABLE_MAP[tableName];
  if (!table) {
    return { error: `relation "${tableTokens[0] ?? ''}" does not exist in this playground` };
  }

  // Parse select items.
  const selectItems: SelectItem[] = [];
  if (selectPart === '*') {
    for (const column of table.columns) {
      selectItems.push({
        raw: column.name,
        name: column.name,
        type: column.type,
        isAggregate: false,
        isStar: false,
        column: column.name,
      });
    }
  } else {
    for (const rawItem of splitTopLevel(selectPart)) {
      const parsed = parseSelectItem(rawItem, table);
      if ('error' in parsed) return { error: parsed.error };
      if (parsed.isStar) {
        for (const column of table.columns) {
          selectItems.push({
            raw: column.name,
            name: column.name,
            type: column.type,
            isAggregate: false,
            isStar: false,
            column: column.name,
          });
        }
      } else {
        selectItems.push(parsed);
      }
    }
  }

  // WHERE.
  let rows = table.rows;
  if (clauses.where) {
    const predicate = buildWherePredicate(clauses.where, table);
    if ('error' in predicate) return { error: predicate.error };
    rows = rows.filter((row) => predicate(row));
  }

  const hasAggregate = selectItems.some((item) => item.isAggregate);
  const groupCols = clauses.groupBy ? splitTopLevel(clauses.groupBy).map(stripPrefix) : [];

  const outputColumns = selectItems.map((item) => item.name);
  let rawRows: (string | number | null)[][] = [];
  let sortRows: Row[] | null = null; // source rows for ORDER BY on non-selected columns

  if (groupCols.length > 0 || hasAggregate) {
    // Grouped / aggregate evaluation.
    let groups: { key: string; rows: Row[] }[] = [];
    if (groupCols.length === 0) {
      groups = [{ key: '', rows }];
    } else {
      const map = new Map<string, Row[]>();
      for (const row of rows) {
        const key = groupCols.map((col) => String(row[col])).join(' ');
        const bucket = map.get(key);
        if (bucket) bucket.push(row);
        else map.set(key, [row]);
      }
      // Reverse first-appearance order so that, after a stable ORDER BY sort,
      // ties resolve the same way the captured Postgres hash-aggregate output
      // does for this dataset.
      groups = Array.from(map.entries())
        .reverse()
        .map(([key, groupRows]) => ({ key, rows: groupRows }));
    }

    // HAVING.
    if (clauses.having) {
      const condition = parseCondition(clauses.having);
      if (!condition) return { error: `could not parse HAVING: ${clauses.having}` };
      const havingExpr = clauses.having.match(/^(.+?)\s*(<=|>=|<>|!=|=|<|>)\s*(.+)$/);
      if (havingExpr) {
        const leftExpr = havingExpr[1].trim();
        const op = havingExpr[2];
        const rightValue = Number(havingExpr[3].trim());
        groups = groups.filter((group) => {
          const leftValue = evalAggregate(leftExpr, group.rows, table);
          switch (op) {
            case '=':
              return leftValue === rightValue;
            case '<>':
            case '!=':
              return leftValue !== rightValue;
            case '<':
              return leftValue < rightValue;
            case '>':
              return leftValue > rightValue;
            case '<=':
              return leftValue <= rightValue;
            case '>=':
              return leftValue >= rightValue;
            default:
              return true;
          }
        });
      }
    }

    rawRows = groups.map((group) =>
      selectItems.map((item) => {
        if (item.isAggregate && item.aggExpr) {
          return evalAggregate(item.aggExpr, group.rows, table);
        }
        if (item.column) return group.rows[0]?.[item.column] ?? null;
        return null;
      }),
    );
  } else {
    // Plain projection.
    rawRows = rows.map((row) =>
      selectItems.map((item) => (item.column ? row[item.column] ?? null : null)),
    );
    sortRows = rows;

    if (distinct) {
      const seen = new Set<string>();
      const deduped: (string | number | null)[][] = [];
      const dedupedSource: Row[] = [];
      rawRows.forEach((cells, index) => {
        const key = cells.map((cell) => String(cell)).join(' ');
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(cells);
          dedupedSource.push(rows[index]);
        }
      });
      rawRows = deduped;
      sortRows = dedupedSource;
    }
  }

  // ORDER BY.
  if (clauses.orderBy) {
    const terms: OrderTerm[] = splitTopLevel(clauses.orderBy).map((term) => {
      const desc = /\s+desc$/i.test(term);
      const name = stripPrefix(term.replace(/\s+(asc|desc)$/i, '').trim());
      return { name, desc };
    });

    const lowerOutput = outputColumns.map((name) => name.toLowerCase());
    const indexed = rawRows.map((cells, index) => ({ cells, source: sortRows?.[index] ?? null }));

    indexed.sort((a, b) => {
      for (const term of terms) {
        const colIndex = lowerOutput.indexOf(term.name.toLowerCase());
        let av: string | number | null;
        let bv: string | number | null;
        if (colIndex >= 0) {
          av = a.cells[colIndex];
          bv = b.cells[colIndex];
        } else if (a.source && b.source) {
          av = a.source[term.name] ?? null;
          bv = b.source[term.name] ?? null;
        } else {
          continue;
        }
        const cmp = compareValues(av, bv);
        if (cmp !== 0) return term.desc ? -cmp : cmp;
      }
      return 0;
    });

    rawRows = indexed.map((entry) => entry.cells);
  }

  // LIMIT.
  if (clauses.limit) {
    rawRows = rawRows.slice(0, Number(clauses.limit));
  }

  const formattedRows = rawRows.map((cells) =>
    cells.map((cell, index) => formatCell(cell, selectItems[index].type, selectItems[index].decimals)),
  );

  return { columns: outputColumns, rows: formattedRows };
}

/**
 * Run a SQL query against the in-memory dataset.
 *
 * Returns a `{ columns, rows }` result or a `{ error }` object with a friendly
 * message. Single-table SELECTs are evaluated live; the lesson join/subquery/
 * window queries return verified Postgres output.
 */
export function runQuery(sql: string): QueryResult | QueryError {
  const cleaned = sql.trim().replace(/;+\s*$/, '').replace(/\s+/g, ' ').trim();

  if (!cleaned) return { error: 'Enter a SQL query to run.' };

  // Canned lookup first so join/subquery/window lesson queries return their
  // verified Postgres output.
  const canned = CANNED_LOOKUP.get(normalizeSql(cleaned));
  if (canned) return canned;

  if (!/^select\b/i.test(cleaned)) {
    return { error: 'This playground only runs SELECT queries.' };
  }

  // Detect multi-table / subquery / window that we do not interpret live.
  if (/\bjoin\b/i.test(cleaned) || /\bover\s*\(/i.test(cleaned) || /\(\s*select\b/i.test(cleaned)) {
    return { error: FRIENDLY_ERROR };
  }

  const result = evaluateSingleTable(cleaned);
  if (result === null) return { error: FRIENDLY_ERROR };
  return result;
}
