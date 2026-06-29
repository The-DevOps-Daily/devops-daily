'use client';

import { useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';

interface ShareButtonProps {
  /** Question title, used in the share text. */
  title: string;
}

// X's brand glyph (lucide dropped the twitter bird).
function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ShareButton({ title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = `Can you answer this DevOps interview question? "${title}"`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the X/LinkedIn links still work */
    }
  };

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 hidden sm:flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
        <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        share
      </span>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        aria-label="Copy link to this question"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
        ) : (
          <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        )}
        {copied ? 'copied' : 'copy link'}
      </button>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md border bg-card w-8 h-8 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        aria-label="Share on X"
      >
        <XGlyph className="w-3.5 h-3.5" />
      </a>
      <a
        href={liUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md border bg-card w-8 h-8 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        aria-label="Share on LinkedIn"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
        </svg>
      </a>
    </div>
  );
}
