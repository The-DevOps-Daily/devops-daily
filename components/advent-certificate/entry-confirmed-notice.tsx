'use client';

import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

/** Shown when SMTPfast sends someone back here after they confirm their entry. */
export function EntryConfirmedNotice() {
  const params = useSearchParams();
  if (params.get('entered') !== '1') return null;
  return (
    <div className="container mx-auto px-4 pt-6">
      <div
        role="status"
        className="mx-auto flex max-w-4xl items-start gap-3 rounded-md border border-green-500/40 bg-green-500/10 p-4 text-sm"
      >
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400"
          aria-hidden="true"
        />
        <p>
          <strong>Your entry is confirmed.</strong>{' '}
          <span className="text-muted-foreground">
            Good luck in the draw on 5 January. Your ebook comes by email after the draw.
          </span>
        </p>
      </div>
    </div>
  );
}
