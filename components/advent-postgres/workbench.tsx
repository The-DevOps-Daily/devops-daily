'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Database, KeyRound, Loader2, Play, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  answerMatches,
  claimLink,
  claimState,
  connectOwnDatabase,
  createDatabase,
  loadDatabase,
  loadSolved,
  QueryError,
  ROW_LIMIT,
  resetDay,
  runQuery,
  saveDatabase,
  saveSolved,
  seedDay,
  type QueryResult,
  type ReaderDatabase,
} from '@/lib/advent-postgres-client';

type Props = {
  day: number;
  schema: string;
  answerHash: string;
  answerFormat?: string;
  starterSql: string;
};

function hoursLeft(expiresAt: string) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
}

export function PostgresWorkbench({ day, schema, answerHash, answerFormat, starterSql }: Props) {
  const sqlKey = `advent-of-postgres-sql-${schema}`;
  const [db, setDb] = useState<ReaderDatabase | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sql, setSql] = useState(starterSql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<QueryError | Error | null>(null);
  const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<'right' | 'wrong' | null>(null);
  const [solved, setSolved] = useState(false);
  const [claim, setClaim] = useState<{ url: string; userCode: string } | null>(null);
  const [showConn, setShowConn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [askConn, setAskConn] = useState(false);
  const [connInput, setConnInput] = useState('');

  // Read the browser's saved state after mount; the page is statically rendered.
  useEffect(() => {
    const t = setTimeout(() => {
      setDb(loadDatabase());
      setSolved(loadSolved().includes(day));
      try {
        const saved = localStorage.getItem(sqlKey);
        if (saved) setSql(saved);
      } catch {
        // storage can be unavailable; the starter query stays
      }
    }, 0);
    return () => clearTimeout(t);
  }, [day, sqlKey]);

  const ensureData = useCallback(
    async (current: ReaderDatabase) => {
      if (current.seeded.includes(schema)) return current;
      setBusy("Loading today's data");
      const next = await seedDay(current, schema);
      setDb(next);
      return next;
    },
    [schema]
  );

  async function start() {
    setError(null);
    try {
      setBusy('Creating your database (about 5 seconds)');
      const created = await createDatabase();
      setDb(created);
      await ensureData(created);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    if (!db) return start();
    setError(null);
    try {
      localStorage.setItem(sqlKey, sql);
    } catch {
      // ignore
    }
    try {
      const ready = await ensureData(db);
      setBusy('Running');
      setResult(await runQuery(ready, schema, sql));
    } catch (e) {
      setResult(null);
      setError(e as Error);
      if (/password authentication failed|authentication/i.test((e as Error).message))
        setAskConn(true);
    } finally {
      setBusy(null);
    }
  }

  async function saveConnection(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setBusy('Checking the connection');
      const next = await connectOwnDatabase(connInput, db);
      setDb(next);
      setAskConn(false);
      setConnInput('');
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!db) return;
    setError(null);
    try {
      setBusy("Reloading today's data");
      setDb(await resetDay(db, schema));
      setResult(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(null);
    }
  }

  async function keep() {
    if (!db) return;
    setError(null);
    try {
      setBusy('Getting your claim link');
      const link = await claimLink(db);
      setClaim(link);
      window.open(link.url, '_blank', 'noopener');
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(null);
    }
  }

  // After a claim link is opened, check every few seconds whether the reader finished it.
  useEffect(() => {
    if (!claim || !db || db.claimed) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const state = await claimState(db);
        if (state === 'accepted' || state === 'reconciled') {
          // The project is in the reader's Neon account now, and Neon reset its password.
          const kept = { ...db, claimed: true };
          saveDatabase(kept);
          setDb(kept);
          setClaim(null);
          setAskConn(true);
        }
      } catch {
        // keep polling; the claim page may still be open
      }
      if (tries > 180) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [claim, db]);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    const ok = await answerMatches(day, answer, answerHash);
    setVerdict(ok ? 'right' : 'wrong');
    if (ok) {
      setSolved(true);
      saveSolved([...loadSolved(), day]);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  }

  async function copyConnection() {
    if (!db) return;
    await navigator.clipboard.writeText(db.databaseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const queryError = error instanceof QueryError ? error : null;

  return (
    <section aria-label="Your Postgres workbench" className="my-10 rounded-md border border-border">
      {/* Database */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-primary" strokeWidth={1.5} />
          {db ? (
            <span>
              Your database is ready
              <span className="text-muted-foreground">
                {' '}
                ({db.region.replace('aws-', '')},{' '}
                {db.claimed ? 'kept in your Neon account' : `${hoursLeft(db.expiresAt)} h left`})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              No database yet. You get a real Postgres database on Neon, free, with no account.
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {db ? (
            <>
              {!db.claimed && (
                <Button size="sm" variant="outline" onClick={keep} disabled={!!busy}>
                  <KeyRound /> Keep it for the month
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setShowConn((v) => !v)}>
                Connect with psql
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={!!busy}>
                <RotateCcw /> Reset today&apos;s data
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAskConn((v) => !v)}>
                Use another connection string
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setAskConn((v) => !v)}>
                I already have one
              </Button>
              <Button size="sm" onClick={start} disabled={!!busy}>
                <Database /> Create my free database
              </Button>
            </>
          )}
        </div>
      </div>

      {claim && (
        <p className="border-b border-border bg-primary/5 px-4 py-3 text-sm">
          A Neon page opened in a new tab. Sign in or create a free account and enter the code{' '}
          <code className="font-mono font-semibold">{claim.userCode}</code> if it asks. The code
          works for 15 minutes. Neon resets the database password when the project moves to your
          account, so this page then asks for the new connection string.{' '}
          <a className="underline" href={claim.url} target="_blank" rel="noopener noreferrer">
            Open it again
          </a>
        </p>
      )}

      {askConn && (
        <form onSubmit={saveConnection} className="border-b border-border px-4 py-3 text-sm">
          <label htmlFor={`conn-${schema}`} className="mb-2 block text-muted-foreground">
            {db?.claimed
              ? 'Your database is in your Neon account now. Open the project in the Neon Console, copy its connection string, and paste it here.'
              : 'Paste the connection string of your Advent of Postgres database on Neon, for example from another device or from the Neon Console.'}
          </label>
          <div className="flex gap-2">
            <input
              id={`conn-${schema}`}
              value={connInput}
              onChange={(e) => setConnInput(e.target.value)}
              placeholder="postgresql://..."
              spellCheck={false}
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button size="sm" type="submit" disabled={!!busy || !connInput.trim()}>
              Use it
            </Button>
          </div>
        </form>
      )}

      {db && showConn && (
        <div className="border-b border-border px-4 py-3 text-sm">
          <p className="mb-2 text-muted-foreground">
            Run <code className="font-mono">set search_path to {schema};</code> first. Today&apos;s
            tables are in the <code className="font-mono">{schema}</code> schema.
          </p>
          <div className="flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1 font-mono text-xs">
              psql &quot;{db.databaseUrl}&quot;
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copyConnection}
              aria-label="Copy connection string"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="px-4 pt-4">
        <label htmlFor={`sql-${schema}`} className="mb-2 block text-sm font-medium">
          SQL
        </label>
        <textarea
          id={`sql-${schema}`}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          rows={8}
          className="w-full resize-y rounded-md border border-input bg-muted/40 p-3 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span className="text-xs text-muted-foreground">
            One statement at a time. Ctrl+Enter or Cmd+Enter runs it.
          </span>
          <Button onClick={run} disabled={!!busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />}
            {busy ?? (db ? 'Run' : 'Create database and run')}
          </Button>
        </div>
      </div>

      {/* Output */}
      {error && (
        <div
          role="alert"
          className="mx-4 mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-mono">{error.message}</p>
          {queryError?.position && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              near character {queryError.position}: …
              {sql.slice(Math.max(0, queryError.position - 20), queryError.position + 10)}…
            </p>
          )}
          {queryError?.hint && <p className="mt-1 text-xs">Hint: {queryError.hint}</p>}
        </div>
      )}

      {result && (
        <div className="mx-4 mb-4">
          <p className="mb-2 text-xs text-muted-foreground tabular-nums">
            {result.command} · {result.rowCount ?? result.rows.length} row
            {(result.rowCount ?? result.rows.length) === 1 ? '' : 's'} · {result.ms} ms
            {result.rows.length >= ROW_LIMIT ? ` · showing the first ${ROW_LIMIT}` : ''}
          </p>
          {result.columns.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-md border border-border">
              <table className="w-full text-left font-mono text-xs tabular-nums">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {result.columns.map((c, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, r) => (
                    <tr key={r} className="border-t border-border">
                      {row.map((v, c) => (
                        <td key={c} className="whitespace-nowrap px-3 py-1.5">
                          {v === null ? <span className="text-muted-foreground">null</span> : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Answer */}
      <form
        onSubmit={check}
        className="flex flex-wrap items-end gap-3 border-t border-border px-4 py-4"
      >
        <div className="min-w-[220px] flex-1">
          <label htmlFor={`answer-${schema}`} className="mb-1 block text-sm font-medium">
            Your answer
          </label>
          <input
            id={`answer-${schema}`}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setVerdict(null);
            }}
            placeholder={answerFormat}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="secondary">
          Check answer
        </Button>
        {verdict === 'right' && (
          <p className="flex w-full items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" /> Correct. Day {day} solved.
          </p>
        )}
        {verdict === 'wrong' && (
          <p className="flex w-full items-center gap-2 text-sm text-destructive">
            <X className="h-4 w-4" /> Not this one. Check the question again
            {answerFormat ? ` (${answerFormat})` : ''}.
          </p>
        )}
        {solved && verdict !== 'right' && (
          <p className="w-full text-sm text-muted-foreground">You already solved this day.</p>
        )}
      </form>
    </section>
  );
}
