'use client';

import { useState } from 'react';

type Mode = 'base64' | 'url';

function encodeBase64(text: string): string {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return '';
  }
}
function decodeBase64(text: string): string {
  try {
    return decodeURIComponent(escape(atob(text.trim())));
  } catch {
    return '';
  }
}
function encodeUrl(text: string): string {
  try {
    return encodeURIComponent(text);
  } catch {
    return '';
  }
}
function decodeUrl(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return '';
  }
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
      className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

export function Base64Encoder() {
  const [mode, setMode] = useState<Mode>('base64');
  const [text, setText] = useState('');

  const encoded = mode === 'base64' ? encodeBase64(text) : encodeUrl(text);
  const decoded = mode === 'base64' ? decodeBase64(text) : decodeUrl(text);

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="inline-flex rounded-md border bg-card overflow-hidden font-mono text-sm">
        <button
          onClick={() => setMode('base64')}
          className={`px-4 py-2 transition-colors ${
            mode === 'base64'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          base64
        </button>
        <button
          onClick={() => setMode('url')}
          className={`px-4 py-2 transition-colors ${
            mode === 'url'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          url
        </button>
      </div>

      {/* Input */}
      <div className="rounded-md border bg-card p-5">
        <label htmlFor="input-text" className="text-xs font-mono text-muted-foreground block mb-2">
          // input
        </label>
        <textarea
          id="input-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={
            mode === 'base64'
              ? 'Paste raw text or base64 to decode...'
              : 'Paste URL or URL-encoded string...'
          }
          className="w-full bg-background border border-input px-3 py-2 rounded-md text-sm font-mono break-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          spellCheck="false"
        />
      </div>

      {/* Output */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border/60">
            <span className="text-xs font-mono text-muted-foreground">// encoded</span>
            <CopyButton text={encoded} />
          </div>
          <pre className="p-4 text-xs sm:text-sm font-mono break-all whitespace-pre-wrap min-h-[120px]">
            {encoded || <span className="text-muted-foreground/60">…</span>}
          </pre>
        </div>
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border/60">
            <span className="text-xs font-mono text-muted-foreground">// decoded</span>
            <CopyButton text={decoded} />
          </div>
          <pre className="p-4 text-xs sm:text-sm font-mono break-all whitespace-pre-wrap min-h-[120px]">
            {decoded || <span className="text-muted-foreground/60">…</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}
