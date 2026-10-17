'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface SolutionRevealProps {
  children: React.ReactNode;
  title?: string;
}

export function SolutionReveal({ children, title = 'Solution' }: SolutionRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const contentId = useId();

  return (
    <div className="my-8 rounded-xl border border-border overflow-hidden bg-card/50 backdrop-blur">
      {/* Header with reveal button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-linear-to-r from-primary/10 to-blue-500/10 border-b border-border">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsRevealed(!isRevealed)}
          aria-expanded={isRevealed}
          aria-controls={contentId}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-medium text-sm"
        >
          {isRevealed ? (
            <>
              <EyeOff className="h-4 w-4" />
              Hide Solution
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Reveal Solution
            </>
          )}
        </button>
      </div>

      {/* Content area: a grid-rows transition has no height cap, so long solutions are not cut off */}
      <div
        id={contentId}
        inert={!isRevealed}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isRevealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="p-6 prose dark:prose-invert max-w-none">{children}</div>
        </div>
      </div>

      {/* Placeholder when hidden */}
      {!isRevealed && (
        <div className="p-12 text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Try to solve the challenge yourself first!</p>
          <p className="text-sm text-muted-foreground mt-2">
            Click &quot;Reveal Solution&quot; when you&apos;re ready to see the answer.
          </p>
        </div>
      )}
    </div>
  );
}
