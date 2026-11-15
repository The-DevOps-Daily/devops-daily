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
  /** The prompt before this input line, when it differs from linePrompt. */
  prompt?: string;
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
  onMouseUp,
}: {
  /** Left of the title bar, in mono: "~/repo", "$ terraform plan", "shop". */
  label: ReactNode;
  /** Right of the title bar: "main|MERGING", "2 images, 0 running". */
  status?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  onMouseUp?: () => void;
}) {
  return (
    <div
      onMouseUp={onMouseUp}
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
  /** The prompt before past input lines, when it differs from the live one ("shop=*#"). */
  linePrompt?: string;
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
  /**
   * The height of the output and input, under the title bar. The default
   * fills a SimFrame's --sim-fill-h on lg. In a lab, LAB_TERMINAL_HEIGHT
   * fills the lab's terminal column instead.
   */
  heightClassName?: string;
  /**
   * The prompt follows the output, like a real shell, and scrolls with it;
   * otherwise it is fixed under the output. A click anywhere in the window
   * focuses it, and on lg, once the terminal is in view, the wheel over it
   * never scrolls the page.
   */
  inline?: boolean;
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
  linePrompt = prompt,
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
  heightClassName = 'h-[clamp(16rem,calc(100dvh-22rem),30rem)] lg:h-[max(16rem,calc(var(--sim-fill-h,32rem)-2.25rem))]',
  inline = false,
}: SimTerminalProps) {
  const ownInput = useRef<HTMLInputElement | null>(null);
  const ownLog = useRef<HTMLDivElement | null>(null);
  // With an inline prompt, the box that scrolls the log and the prompt together.
  const scroller = useRef<HTMLDivElement | null>(null);

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
    const box = inline ? scroller.current : ownLog.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines, inline]);

  useEffect(() => {
    // Typing brings an inline prompt back into view after scrolling up.
    const box = scroller.current;
    if (inline && box) box.scrollTop = box.scrollHeight;
  }, [value, inline]);

  useEffect(() => {
    const box = scroller.current;
    if (!inline || !box) return;
    // On lg the wheel at the end of the log never moves the page while the
    // whole terminal is in view. Until then it does, so a wheel over the
    // terminal still brings the lab into view on a game page.
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || !window.matchMedia?.('(min-width: 1024px)').matches) return;
      const atTop = box.scrollTop <= 0;
      const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 1;
      if (!((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atEnd))) return;
      const { top, bottom } = box.getBoundingClientRect();
      if (top >= 0 && bottom <= window.innerHeight + 1) event.preventDefault();
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [inline]);

  const focusOnClick = () => {
    // A click puts the cursor back in the prompt, unless text was selected.
    if (!window.getSelection()?.toString()) ownInput.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // An empty prompt lets Tab and Shift+Tab move focus on. Escape leaves the
    // prompt, so the next Tab moves on even with a command typed.
    if (event.key === 'Tab' && (event.shiftKey || !value.trim())) return;
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    onKeyDown?.(event);
  };

  const log = (
    <div
      ref={setLog}
      role="log"
      aria-label="Terminal output"
      // The visible log is not read out line by line; the live region below reads the result.
      aria-live="off"
      className={
        inline
          ? undefined
          : 'min-h-0 flex-1 overflow-auto overscroll-contain px-3 py-2 [scrollbar-width:thin]'
      }
      onMouseUp={inline ? undefined : focusOnClick}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            // Command output keeps its columns (tables, plans) and scrolls sideways;
            // commands and messages wrap, so a phone never scrolls to read a sentence.
            line.type === 'output'
              ? 'whitespace-pre'
              : 'whitespace-pre-wrap [overflow-wrap:anywhere]',
            LINE_CLASS[line.type]
          )}
        >
          {line.type === 'input' && (
            <span className="select-none text-terminal-prompt" aria-hidden="true">
              {line.prompt ?? linePrompt}{' '}
            </span>
          )}
          {line.content || ' '}
        </div>
      ))}
    </div>
  );

  const form = (
    <form
      className={cn(
        'flex items-center',
        // A long prompt (a deep directory on a phone) pushes the input onto the next line.
        inline ? 'flex-wrap gap-x-[1ch]' : 'gap-2 border-t border-terminal-border px-3 py-2'
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <span
        className={cn(
          'select-none text-terminal-prompt',
          inline && 'max-w-full shrink-0 [overflow-wrap:anywhere]'
        )}
        aria-hidden="true"
      >
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
        className={cn(
          'flex-1 bg-transparent text-terminal-input caret-terminal-prompt outline-none placeholder:text-terminal-muted focus-visible:outline-none',
          // 16px on phones, so iOS does not zoom in on focus.
          inline
            ? 'min-w-[12ch] basis-0 p-0 text-base leading-relaxed sm:text-[13px]'
            : 'min-w-0 text-base sm:text-sm'
        )}
      />
    </form>
  );

  return (
    <SimTerminalWindow
      label={label}
      status={status}
      // flex-1: in a flex column (a lab's terminal column) the window takes the free height.
      className={cn(
        'flex flex-col focus-within:ring-2 focus-within:ring-ring lg:min-h-0 lg:flex-1',
        className
      )}
      bodyClassName={cn('flex min-h-0 flex-col', heightClassName)}
      onMouseUp={inline ? focusOnClick : undefined}
    >
      {inline ? (
        <div
          ref={scroller}
          // Touch scrolling stays in the log; on lg the wheel handler above decides.
          className="min-h-0 flex-1 cursor-text overflow-auto overscroll-contain px-3 py-2 [scrollbar-width:thin] lg:overscroll-auto"
        >
          {log}
          {form}
        </div>
      ) : (
        <>
          {log}
          {form}
        </>
      )}
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
