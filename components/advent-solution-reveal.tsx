'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface SolutionRevealProps {
  children: React.ReactNode;
  title?: string;
}

export function SolutionReveal({ children, title = 'Solution' }: SolutionRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <div className="my-8 rounded-xl border border-border overflow-hidden bg-card/50 backdrop-blur">
      {/* Header with reveal button */}
      <div className="flex items-center justify-between p-4 bg-linear-to-r from-primary/10 to-blue-500/10 border-b border-border">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        <button
          onClick={() => setIsRevealed(!isRevealed)}
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

      {/* Content area */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isRevealed ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="p-6 prose dark:prose-invert max-w-none">{children}</div>
      </div>

      {/* Placeholder when hidden */}
      {!isRevealed && (
        <div className="p-12 text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            Try to solve the challenge yourself first!
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Click "Reveal Solution" when you're ready to see the answer.
          </p>
        </div>
      )}
    </div>
  );
}
