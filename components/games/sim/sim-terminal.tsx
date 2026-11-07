'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one terminal look (style guide section 4, "style C"): a dark window in
 * both themes, a title bar with a context label and a status badge, output
 * in a log region and a real, labelled input. Colours are the --terminal-*
 * tokens, never theme tokens, which turn light in light mode.
 */

export type SimTerminalLineType = 'input' | 'output' | 'error' | 'success' | 'warning' | 'muted';

export interface SimTerminalLine {
  type: SimTerminalLineType;
  content: string;
}

const LINE_CLASS: Record<SimTerminalLineType, string> = {
  input: 'text-terminal-input',
  output: 'text-terminal-foreground',
  error: 'text-terminal-error',
  success: 'text-terminal-success',
  warning: 'text-terminal-warning',
  muted: 'text-terminal-muted',
};

export function terminalLineClass(type: SimTerminalLineType): string {
  return LINE_CLASS[type];
}

/** The window alone: title bar and a body. Read-only transcripts use it directly. */
export function SimTerminalWindow({
  label,
  status,
  children,
  className,
  bodyClassName,
}: {
  /** Left of the title bar, in mono: "~/repo", "$ terraform plan", "shop". */
  label: ReactNode;
  /** Right of the title bar: "main|MERGING", "2 images, 0 running". */
  status?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-terminal-border bg-terminal text-terminal-foreground',
        className
      )}
    >
      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-terminal-border bg-terminal-bar px-3 py-1 font-mono text-xs">
        <span className="min-w-0 [overflow-wrap:anywhere] text-terminal-foreground">{label}</span>
        {status && (
          <span className="shrink-0 rounded border border-terminal-border px-1.5 py-0.5 text-terminal-muted">
            {status}
          </span>
        )}
      </div>
      <div className={cn('font-mono text-[13px] leading-relaxed', bodyClassName)}>{children}</div>
    </div>
  );
}

export interface SimTerminalProps {
  label: ReactNode;
  status?: ReactNode;
  lines: SimTerminalLine[];
  /** The prompt before input lines and the input: "$", "shop=#", "test>". */
  prompt?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /**
   * The rest of the keys: history on Up and Down, Ctrl+C, Tab completion.
   * Pass useTerminalSimulator's handleKeyDown. SimTerminal keeps Tab on an
   * empty prompt and Escape for the page, so keyboard users can leave.
   */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  logRef?: Ref<HTMLDivElement>;
  /** Focus the input on mount, without scrolling, and never on touch screens. */
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Overrides the height that keeps the input in a 1280x800 window. */
  heightClassName?: string;
}

/** The line a screen reader hears after a command: its result, not the whole log. */
export function resultLine(lines: SimTerminalLine[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.type === 'input') return '';
    if (line.content.trim()) return line.content.split('\n').find((l) => l.trim()) ?? '';
  }
  return '';
}

export function SimTerminal({
  label,
  status,
  lines,
  prompt = '$',
  value,
  onChange,
  onSubmit,
  onKeyDown,
  inputRef,
  logRef,
  autoFocus = false,
  disabled = false,
  placeholder,
  className,
  heightClassName = 'h-[clamp(16rem,calc(100dvh-22rem),30rem)]',
}: SimTerminalProps) {
  const ownInput = useRef<HTMLInputElement | null>(null);
  const ownLog = useRef<HTMLDivElement | null>(null);

  const setInput = (el: HTMLInputElement | null) => {
    ownInput.current = el;
    assignRef(inputRef, el);
  };
  const setLog = (el: HTMLDivElement | null) => {
    ownLog.current = el;
    assignRef(logRef, el);
  };

  useEffect(() => {
    if (!autoFocus) return;
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    ownInput.current?.focus({ preventScroll: true });
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const log = ownLog.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // An empty prompt lets Tab and Shift+Tab move focus on; Escape belongs to the page.
    if (event.key === 'Tab' && (event.shiftKey || !value.trim())) return;
    if (event.key === 'Escape') return;
    onKeyDown?.(event);
  };

  return (
    <SimTerminalWindow
      label={label}
      status={status}
      className={cn('flex flex-col focus-within:ring-2 focus-within:ring-ring', className)}
      bodyClassName={cn('flex min-h-0 flex-col', heightClassName)}
    >
      <div
        ref={setLog}
        role="log"
        aria-label="Terminal output"
        // The visible log is not read out line by line; the live region below reads the result.
        aria-live="off"
        className="min-h-0 flex-1 overflow-auto overscroll-contain px-3 py-2 [scrollbar-width:thin]"
        onMouseUp={() => {
          // Clicking the output puts the cursor back in the prompt, unless text was selected.
          if (!window.getSelection()?.toString()) ownInput.current?.focus({ preventScroll: true });
        }}
      >
        {lines.map((line, i) => (
          <div key={i} className={cn('whitespace-pre', LINE_CLASS[line.type])}>
            {line.type === 'input' && (
              <span className="select-none text-terminal-prompt" aria-hidden="true">
                {prompt}{' '}
              </span>
            )}
            {line.content || ' '}
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-terminal-border px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
        }}
      >
        <span className="select-none text-terminal-prompt" aria-hidden="true">
          {prompt}
        </span>
        <input
          ref={setInput}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Terminal command"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-base text-terminal-input caret-terminal-prompt outline-none placeholder:text-terminal-muted focus-visible:outline-none sm:text-sm"
        />
      </form>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {resultLine(lines)}
      </p>
    </SimTerminalWindow>
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else (ref as { current: T | null }).current = value;
}
