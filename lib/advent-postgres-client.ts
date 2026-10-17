// Browser side of Advent of Postgres. Each reader gets their own free, claimable Neon
// database from the advent API (a Cloudflare Worker), then runs SQL against it directly
// through Neon's SQL-over-HTTP endpoint. Nothing here talks to a DevOps Daily database.

export const ADVENT_API = 'https://advent-api.devops-daily.com';
const DB_KEY = 'advent-of-postgres-db';
const PROGRESS_KEY = 'advent-of-postgres-progress';

export type ReaderDatabase = {
  projectId: string;
  region: string;
  expiresAt: string;
  databaseUrl: string;
  assertion: string;
  seeded: string[]; // schemas already loaded, for example "day01"
  claimed?: boolean;
};

export type QueryResult = {
  columns: string[];
  rows: (string | null)[][];
  rowCount: number | null;
  command: string;
  ms: number;
};

export class QueryError extends Error {
  constructor(
    message: string,
    public position?: number,
    public hint?: string
  ) {
    super(message);
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows can refuse storage; the session still works until reload.
  }
}

export function loadDatabase(): ReaderDatabase | null {
  const db = read<ReaderDatabase>(DB_KEY);
  if (!db) return null;
  // An unclaimed database is deleted by Neon when it expires.
  if (!db.claimed && new Date(db.expiresAt).getTime() < Date.now()) return null;
  return db;
}

export function saveDatabase(db: ReaderDatabase | null) {
  if (db) write(DB_KEY, db);
  else localStorage.removeItem(DB_KEY);
}

export function loadSolved(): number[] {
  return read<number[]>(PROGRESS_KEY) ?? [];
}

export function saveSolved(days: number[]) {
  write(
    PROGRESS_KEY,
    Array.from(new Set(days)).sort((a, b) => a - b)
  );
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(ADVENT_API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The advent API returned ${res.status}`);
  return data as T;
}

export async function createDatabase(): Promise<ReaderDatabase> {
  const r = await api<Omit<ReaderDatabase, 'seeded'>>('/v1/start');
  const db: ReaderDatabase = { ...r, seeded: [] };
  saveDatabase(db);
  return db;
}

export async function claimLink(db: ReaderDatabase): Promise<{ url: string; userCode: string }> {
  return api('/v1/claim', { projectId: db.projectId, assertion: db.assertion });
}

/** pending, then accepted (the project moved to the reader's account), then reconciled. */
export async function claimState(db: ReaderDatabase): Promise<string> {
  const r = await api<{ state: string }>('/v1/claim-status', {
    projectId: db.projectId,
    assertion: db.assertion,
  });
  return r.state;
}

type NeonField = { name: string };
type NeonResult = {
  fields: NeonField[];
  rows: (string | null)[][];
  rowCount: number | null;
  command: string;
};

/** Run statements in one transaction over Neon's SQL-over-HTTP endpoint. */
async function transaction(databaseUrl: string, queries: string[]): Promise<NeonResult[]> {
  const host = new URL(databaseUrl).hostname;
  // No Content-Type header: Neon's CORS response does not allow it, and the body is JSON anyway.
  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: { 'Neon-Connection-String': databaseUrl, 'Neon-Array-Mode': 'true' },
    body: JSON.stringify({ queries: queries.map((query) => ({ query, params: [] })) }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    const pos = body?.position ? parseInt(body.position, 10) : undefined;
    throw new QueryError(
      body?.message || `Postgres returned ${res.status}`,
      pos,
      body?.hint || undefined
    );
  }
  return body.results as NeonResult[];
}

/** Load a day's data into its own schema, once per database. */
export async function seedDay(db: ReaderDatabase, schema: string): Promise<ReaderDatabase> {
  if (db.seeded.includes(schema)) return db;
  const res = await fetch(`/advent-of-postgres/seeds/${schema}.json`);
  if (!res.ok) throw new Error(`Could not load the data for ${schema}`);
  // Most days load in one transaction. A day can also commit in steps (day 21 loads data,
  // waits, then deletes some of it, so readers can recover it from Neon's history).
  const seed = (await res.json()) as { statements?: string[]; transactions?: string[][] };
  for (const step of seed.transactions ?? [seed.statements ?? []]) {
    await transaction(db.databaseUrl, step);
  }
  const next = { ...db, seeded: [...db.seeded, schema] };
  saveDatabase(next);
  return next;
}

/** Drop a day's schema and load it again, for a reader who broke their copy of the data. */
export async function resetDay(db: ReaderDatabase, schema: string): Promise<ReaderDatabase> {
  if (!/^day\d{2}$/.test(schema)) throw new Error('Unknown day');
  await transaction(db.databaseUrl, [`drop schema if exists ${schema} cascade`]);
  return seedDay({ ...db, seeded: db.seeded.filter((s) => s !== schema) }, schema);
}

/**
 * Switch to a connection string the reader pastes: after a claim (Neon resets the password
 * when the project moves to the reader's account) or to use a database from another device.
 * Only Neon works, because the page talks to Neon's SQL-over-HTTP endpoint.
 */
export async function connectOwnDatabase(
  raw: string,
  previous: ReaderDatabase | null
): Promise<ReaderDatabase> {
  const databaseUrl = raw
    .trim()
    .replace(/^psql\s+/, '')
    .replace(/^['"]|['"]$/g, '');
  let host: string;
  try {
    const u = new URL(databaseUrl);
    if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error();
    host = u.hostname;
  } catch {
    throw new Error('That does not look like a connection string. It starts with postgresql://');
  }
  if (!host.endsWith('.neon.tech'))
    throw new Error('Use a Neon connection string. The page sends queries to Neon over HTTPS.');
  const res = await transaction(databaseUrl, [
    "select nspname::text from pg_namespace where nspname ~ '^day[0-9]{2}$' order by 1",
  ]);
  const schemas = res[0].rows.map((r) => String(r[0]));
  const db: ReaderDatabase = {
    projectId: previous?.projectId ?? host.split('.')[0],
    region: previous?.region ?? `${host.split('.').slice(-3)[0]}-${host.split('.').slice(-4)[0]}`,
    expiresAt: '2099-01-01T00:00:00Z',
    databaseUrl,
    assertion: '',
    seeded: schemas,
    claimed: true,
  };
  saveDatabase(db);
  return db;
}

const MAX_ROWS = 500;

/** Run one statement with the day's schema first on the search path. */
export async function runQuery(
  db: ReaderDatabase,
  schema: string,
  sql: string
): Promise<QueryResult> {
  const statement = sql.trim().replace(/;\s*$/, '');
  if (!statement) throw new QueryError('Write a query first.');
  const started = performance.now();
  const results = await transaction(db.databaseUrl, [
    `set local search_path to ${schema}, public`,
    `set local statement_timeout = '15s'`,
    statement,
  ]);
  const r = results[results.length - 1];
  return {
    columns: r.fields.map((f) => f.name),
    rows: r.rows.slice(0, MAX_ROWS),
    rowCount: r.rowCount,
    command: r.command,
    ms: Math.round(performance.now() - started),
  };
}

export const ROW_LIMIT = MAX_ROWS;

export async function answerMatches(
  day: number,
  answer: string,
  expectedHash: string
): Promise<boolean> {
  const schema = `day${String(day).padStart(2, '0')}`;
  const data = new TextEncoder().encode(
    `advent-of-postgres:${schema}:${answer.trim().toLowerCase()}`
  );
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return hex === expectedHash;
}

/** A day opens at 00:00 UTC on its date. Add ?preview to the URL to open every day early. */
export function isUnlocked(publishedAt: string): boolean {
  if (typeof window !== 'undefined') {
    try {
      // ?preview once keeps every day open for the rest of the tab session.
      if (new URLSearchParams(window.location.search).has('preview'))
        sessionStorage.setItem('advent-of-postgres-preview', '1');
      if (sessionStorage.getItem('advent-of-postgres-preview')) return true;
    } catch {
      if (new URLSearchParams(window.location.search).has('preview')) return true;
    }
  }
  return Date.now() >= new Date(publishedAt).getTime();
}
