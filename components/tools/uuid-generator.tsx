'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Kind = 'uuid-v4' | 'uuid-v7' | 'hex-32' | 'hex-64' | 'base64-32' | 'secret-kube';

interface Spec {
  kind: Kind;
  label: string;
  sub: string;
}

const SPECS: Spec[] = [
  { kind: 'uuid-v4', label: 'UUID v4', sub: 'random' },
  { kind: 'uuid-v7', label: 'UUID v7', sub: 'time-ordered' },
  { kind: 'hex-32', label: 'Hex 32', sub: '16 bytes' },
  { kind: 'hex-64', label: 'Hex 64', sub: '32 bytes' },
  { kind: 'base64-32', label: 'Base64 32', sub: '24 bytes raw' },
  { kind: 'secret-kube', label: 'Kube Secret', sub: 'base64 of 32 bytes' },
];

function randomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

function uuidV4(): string {
  // Prefer native
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = bytesToHex(b);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidV7(): string {
  // https://datatracker.ietf.org/doc/rfc9562/
  const b = randomBytes(16);
  const timestamp = BigInt(Date.now());
  b[0] = Number((timestamp >> 40n) & 0xffn);
  b[1] = Number((timestamp >> 32n) & 0xffn);
  b[2] = Number((timestamp >> 24n) & 0xffn);
  b[3] = Number((timestamp >> 16n) & 0xffn);
  b[4] = Number((timestamp >> 8n) & 0xffn);
  b[5] = Number(timestamp & 0xffn);
  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // variant 1
  const hex = bytesToHex(b);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function generate(kind: Kind): string {
  switch (kind) {
    case 'uuid-v4':
      return uuidV4();
    case 'uuid-v7':
      return uuidV7();
    case 'hex-32':
      return bytesToHex(randomBytes(16));
    case 'hex-64':
      return bytesToHex(randomBytes(32));
    case 'base64-32':
      return bytesToBase64(randomBytes(24));
    case 'secret-kube':
      return bytesToBase64(randomBytes(32));
  }
}

export function UuidGenerator() {
  const [values, setValues] = useState<Partial<Record<Kind, string>>>({});
  const [copiedKind, setCopiedKind] = useState<Kind | null>(null);

  const regen = useCallback(() => {
    const next: Partial<Record<Kind, string>> = {};
    for (const spec of SPECS) next[spec.kind] = generate(spec.kind);
    setValues(next);
  }, []);

  useEffect(() => {
    regen();
  }, [regen]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cryptographically secure identifiers and secrets, generated in your browser.
        </p>
        <button
          onClick={regen}
          className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs font-mono hover:border-primary/40 hover:bg-muted/30 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          regenerate
        </button>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        {SPECS.map((spec, idx) => {
          const value = values[spec.kind] ?? '';
          const isCopied = copiedKind === spec.kind;
          return (
            <div
              key={spec.kind}
              className={`flex items-center gap-3 px-4 py-3 ${
                idx < SPECS.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold">{spec.label}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{spec.sub}</p>
              </div>
              <code className="flex-1 text-xs sm:text-sm font-mono break-all text-foreground tabular-nums">
                {value}
              </code>
              <button
                onClick={async () => {
                  if (!value) return;
                  await navigator.clipboard.writeText(value);
                  setCopiedKind(spec.kind);
                  setTimeout(() => setCopiedKind(null), 1200);
                }}
                className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors shrink-0"
              >
                {isCopied ? 'copied' : 'copy'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
