'use client';

import { useMemo, useState } from 'react';

interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signatureRaw: string;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  try {
    if (typeof atob === 'function') {
      return atob(padded + padding);
    }
    // Node fallback for SSR (not typically hit on the client)
    return Buffer.from(padded + padding, 'base64').toString('utf-8');
  } catch {
    throw new Error('Invalid base64url segment');
  }
}

function utf8Decode(raw: string): string {
  try {
    return decodeURIComponent(escape(raw));
  } catch {
    return raw;
  }
}

function parseJwt(token: string): JwtParts | { error: string } {
  const t = token.trim();
  if (!t) return { error: 'Paste a JWT above to decode it' };
  const parts = t.split('.');
  if (parts.length !== 3) {
    return { error: 'A JWT must have exactly three segments separated by dots' };
  }
  try {
    const header = JSON.parse(utf8Decode(base64UrlDecode(parts[0])));
    const payload = JSON.parse(utf8Decode(base64UrlDecode(parts[1])));
    return { header, payload, signatureRaw: parts[2] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to decode JWT' };
  }
}

function formatTimestamp(seconds: unknown): string | null {
  if (typeof seconds !== 'number') return null;
  const ms = seconds > 1e12 ? seconds : seconds * 1000;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  const now = Date.now();
  const diffSec = Math.round((date.getTime() - now) / 1000);
  const rel = formatRelative(diffSec);
  return `${date.toISOString()}  (${rel})`;
}

function formatRelative(sec: number): string {
  const abs = Math.abs(sec);
  let v: number;
  let unit: string;
  if (abs < 60) {
    v = abs;
    unit = 'sec';
  } else if (abs < 3600) {
    v = Math.round(abs / 60);
    unit = 'min';
  } else if (abs < 86400) {
    v = Math.round(abs / 3600);
    unit = 'hr';
  } else {
    v = Math.round(abs / 86400);
    unit = 'day';
  }
  return sec >= 0 ? `in ${v} ${unit}` : `${v} ${unit} ago`;
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(value, null, 2);
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border/60">
        <span className="text-xs font-mono text-muted-foreground">// {label}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="p-4 text-xs sm:text-sm font-mono overflow-x-auto leading-relaxed">
        {json}
      </pre>
    </div>
  );
}

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRldk9wcyBEYWlseSIsImlhdCI6MTc2MDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.LqFZBxTqu8zJpcfYjE7Vf8s2IErndr9KqWZXz7qxfEw';

export function JwtDecoder() {
  const [token, setToken] = useState('');
  const parsed = useMemo(() => parseJwt(token), [token]);

  const expRow =
    !('error' in parsed) && typeof parsed.payload.exp === 'number'
      ? formatTimestamp(parsed.payload.exp)
      : null;
  const iatRow =
    !('error' in parsed) && typeof parsed.payload.iat === 'number'
      ? formatTimestamp(parsed.payload.iat)
      : null;
  const expired =
    !('error' in parsed) &&
    typeof parsed.payload.exp === 'number' &&
    parsed.payload.exp * 1000 < Date.now();

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="jwt-input" className="text-xs font-mono text-muted-foreground">
            // paste your jwt
          </label>
          <button
            onClick={() => setToken(SAMPLE_JWT)}
            className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            load sample
          </button>
        </div>
        <textarea
          id="jwt-input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={5}
          placeholder="eyJhbGciOi..."
          className="w-full bg-background border border-input px-3 py-2 rounded-md text-sm font-mono break-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          spellCheck="false"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Decoding happens in your browser. Nothing is sent to a server.
        </p>
      </div>

      {'error' in parsed ? (
        token.trim() ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm font-mono text-red-500">
            {parsed.error}
          </div>
        ) : null
      ) : (
        <>
          {(expRow || iatRow) && (
            <div className="rounded-md border bg-card overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/60 border-b border-border/60 text-xs font-mono text-muted-foreground">
                // claims
              </div>
              {iatRow && (
                <div className="flex items-baseline justify-between gap-4 px-4 py-3 font-mono text-sm border-b border-border">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">iat</span>
                  <span className="tabular-nums text-foreground text-right">{iatRow}</span>
                </div>
              )}
              {expRow && (
                <div className="flex items-baseline justify-between gap-4 px-4 py-3 font-mono text-sm">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">exp</span>
                  <span
                    className={`tabular-nums text-right ${expired ? 'text-red-500' : 'text-green-500'}`}
                  >
                    {expRow} {expired ? '(EXPIRED)' : '(valid)'}
                  </span>
                </div>
              )}
            </div>
          )}
          <JsonBlock label="header" value={parsed.header} />
          <JsonBlock label="payload" value={parsed.payload} />
          <div className="rounded-md border bg-card p-4 font-mono text-xs text-muted-foreground break-all">
            <span className="text-muted-foreground/70">signature (base64url): </span>
            <span className="text-foreground">{parsed.signatureRaw}</span>
          </div>
        </>
      )}
    </div>
  );
}
