'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { md5 } from './md5';

type Algo = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
const ALGOS: Algo[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashBytes(algo: Algo, bytes: Uint8Array): Promise<string> {
  if (algo === 'MD5') return md5(bytes);
  const digest = await crypto.subtle.digest(algo, bytes as BufferSource);
  return toHex(digest);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs font-mono text-muted-foreground transition-colors hover:text-primary"
      aria-label="Copy hash"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

export function HashGenerator() {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [hashes, setHashes] = useState<Record<Algo, string>>({
    MD5: '',
    'SHA-1': '',
    'SHA-256': '',
    'SHA-384': '',
    'SHA-512': '',
  });
  const [busy, setBusy] = useState(false);
  const [expected, setExpected] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compute = useCallback(async (bytes: Uint8Array) => {
    setBusy(true);
    try {
      const entries = await Promise.all(
        ALGOS.map(async (algo) => [algo, await hashBytes(algo, bytes)] as const)
      );
      setHashes(Object.fromEntries(entries) as Record<Algo, string>);
    } finally {
      setBusy(false);
    }
  }, []);

  // Hash text as it changes
  useEffect(() => {
    if (mode !== 'text') return;
    if (!text) {
      setHashes({ MD5: '', 'SHA-1': '', 'SHA-256': '', 'SHA-384': '', 'SHA-512': '' });
      return;
    }
    compute(new TextEncoder().encode(text));
  }, [text, mode, compute]);

  async function onFile(file: File) {
    setFileName(`${file.name} (${formatBytes(file.size)})`);
    const buf = new Uint8Array(await file.arrayBuffer());
    setFileBytes(buf);
    compute(buf);
  }

  const expectedNorm = expected.trim().toLowerCase();
  const matchAlgo = expectedNorm
    ? (ALGOS.find((a) => hashes[a] && hashes[a] === expectedNorm) ?? null)
    : null;

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-sm font-mono">
        {(['text', 'file'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded px-4 py-1.5 transition-colors ${
              mode === m
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'text' ? 'text' : 'file'}
          </button>
        ))}
      </div>

      {/* Input */}
      {mode === 'text' ? (
        <div className="rounded-md border bg-card p-5">
          <label htmlFor="hash-input" className="mb-2 block text-xs font-mono text-muted-foreground">
            // input
          </label>
          <textarea
            id="hash-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text to hash..."
            rows={5}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            spellCheck="false"
          />
        </div>
      ) : (
        <div className="rounded-md border bg-card p-5">
          <span className="mb-2 block text-xs font-mono text-muted-foreground">// file</span>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-4 py-10 text-center transition-colors hover:border-primary/50"
          >
            <span className="font-mono text-sm text-foreground">
              {fileName || 'Drop a file here, or click to choose'}
            </span>
            <span className="text-xs text-muted-foreground">
              Hashed locally; nothing is uploaded.
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </div>
          {fileBytes && (
            <button
              onClick={() => {
                setFileBytes(null);
                setFileName('');
                setHashes({ MD5: '', 'SHA-1': '', 'SHA-256': '', 'SHA-384': '', 'SHA-512': '' });
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="mt-3 text-xs font-mono text-muted-foreground hover:text-primary"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Hashes */}
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/60 px-4 py-2.5">
          <span className="text-xs font-mono text-muted-foreground">// digests</span>
          {busy && <span className="text-xs font-mono text-muted-foreground">hashing…</span>}
        </div>
        {ALGOS.map((algo) => {
          const value = hashes[algo];
          const isMatch = matchAlgo === algo;
          return (
            <div
              key={algo}
              className={`border-b border-border/50 px-4 py-3 last:border-b-0 ${
                isMatch ? 'bg-emerald-500/5' : ''
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  {algo}
                  {algo === 'MD5' || algo === 'SHA-1' ? (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      legacy
                    </span>
                  ) : null}
                  {isMatch && (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      match
                    </span>
                  )}
                </span>
                <CopyButton text={value} />
              </div>
              <p className="break-all font-mono text-sm text-foreground/90">
                {value || <span className="text-muted-foreground/50">—</span>}
              </p>
            </div>
          );
        })}
      </div>

      {/* Verify */}
      <div className="rounded-md border bg-card p-5">
        <label htmlFor="hash-expected" className="mb-2 block text-xs font-mono text-muted-foreground">
          // verify against an expected checksum
        </label>
        <input
          id="hash-expected"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="Paste the checksum a project published..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          spellCheck="false"
          autoComplete="off"
        />
        {expectedNorm && (
          <p className="mt-3 text-sm font-mono">
            {matchAlgo ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ matches the {matchAlgo} digest above
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400">
                ✗ no match against any computed digest
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
