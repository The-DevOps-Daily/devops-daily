'use client';

import { forwardRef, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SIM_TONE, type SimTone } from '@/components/games/sim/tones';

export interface SimFeedbackProps {
  tone: SimTone;
  /** The word next to the icon. Defaults to the tone's word ("Correct", "Not quite", ...). */
  label?: ReactNode;
  icon?: LucideIcon;
  children?: ReactNode;
  /** Shows a close button. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** 'status' for hints and notices, 'alert' for errors in the simulator itself. */
  role?: 'status' | 'alert';
  id?: string;
  /** -1 when the game moves focus to the result after a pick. */
  tabIndex?: number;
  className?: string;
}

/**
 * The result of the last action, shown next to the action that caused it:
 * icon, word and one or two sentences, in one of the five tones.
 */
export const SimFeedback = forwardRef<HTMLDivElement, SimFeedbackProps>(function SimFeedback(
  {
    tone,
    label,
    icon,
    children,
    onDismiss,
    dismissLabel = 'Dismiss',
    role,
    id,
    tabIndex,
    className,
  },
  ref
) {
  const t = SIM_TONE[tone];
  const Icon = icon ?? t.icon;
  return (
    <div
      ref={ref}
      id={id}
      tabIndex={tabIndex}
      role={role}
      data-tone={tone}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        t.surface,
        className
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold',
              tone === 'hint' ? 'text-foreground' : t.text
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', t.iconClass)} aria-hidden="true" />
            {label ?? t.label}
          </div>
          {children && <div className="mt-1 space-y-1">{children}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="-m-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:h-10 pointer-coarse:w-10"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
});

/**
 * One polite live region per game. It reads the result line of each action,
 * never a ticking clock.
 */
export function SimAnnouncer({ message }: { message: string }) {
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
