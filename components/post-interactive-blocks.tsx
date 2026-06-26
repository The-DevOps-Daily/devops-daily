'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  type TerminalSpec,
  type TerminalStep,
  type TabsSpec,
  parseTerminalSpec,
  parseTabsSpec,
} from '@/lib/post-interactive';

/* ================================================================== */
/* Terminal: animated command/output replay                            */
/* ================================================================== */

interface RenderedLine {
  kind: 'cmd' | 'output' | 'comment';
  text: string;
  prompt?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function TerminalBlock({ spec }: { spec: TerminalSpec }) {
  const prompt = spec.prompt ?? '$';
  const [lines, setLines] = useState<RenderedLine[]>([]);
  const [typing, setTyping] = useState<{ prompt: string; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runId = useRef(0);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.current.push(setTimeout(resolve, ms));
    });

  const showAll = () => {
    const all: RenderedLine[] = [];
    for (const step of spec.steps) all.push(...stepToLines(step, prompt));
    setLines(all);
    setTyping(null);
    setDone(true);
  };

  async function run() {
    const id = ++runId.current;
    clearTimers();
    setLines([]);
    setTyping(null);
    setDone(false);

    if (prefersReducedMotion()) {
      showAll();
      return;
    }

    for (const step of spec.steps) {
      const stepPrompt = step.prompt ?? prompt;
      if (step.comment) {
        setLines((p) => [...p, { kind: 'comment', text: step.comment as string }]);
        await wait(180);
      }
      if (step.cmd) {
        // type the command character by character
        for (let i = 1; i <= step.cmd.length; i++) {
          if (id !== runId.current) return;
          setTyping({ prompt: stepPrompt, text: step.cmd.slice(0, i) });
          await wait(charDelay(step.cmd[i - 1]));
        }
        if (id !== runId.current) return;
        setTyping(null);
        setLines((p) => [...p, { kind: 'cmd', text: step.cmd as string, prompt: stepPrompt }]);
        await wait(260);
      }
      if (step.output) {
        if (id !== runId.current) return;
        setLines((p) => [...p, { kind: 'output', text: step.output as string }]);
        await wait(360);
      }
    }
    if (id === runId.current) setDone(true);
  }

  // Start when scrolled into view (once)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!spec.autoplay) {
      showAll();
      setStarted(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setStarted(true);
      run();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setStarted(true);
            run();
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimers();
      runId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-[#0b0f17] shadow-lg">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
        <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
        <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
        {spec.title && (
          <span className="ml-2 truncate font-mono text-xs text-slate-400">{spec.title}</span>
        )}
        {(done || !spec.autoplay) && started && (
          <button
            type="button"
            onClick={() => run()}
            className="ml-auto rounded-md px-2 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Replay terminal"
          >
            ↺ replay
          </button>
        )}
      </div>
      <div className="max-h-[28rem] overflow-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
        {lines.map((line, i) => (
          <TerminalLine key={i} line={line} />
        ))}
        {typing && (
          <div className="whitespace-pre-wrap break-words">
            <span className="select-none text-emerald-400">{typing.prompt}&nbsp;</span>
            <span className="text-slate-100">{typing.text}</span>
            <span className="ml-0.5 inline-block h-4 w-2 -translate-y-[1px] animate-pulse bg-slate-300 align-middle" />
          </div>
        )}
      </div>
    </div>
  );
}

function TerminalLine({ line }: { line: RenderedLine }) {
  if (line.kind === 'comment') {
    return <div className="whitespace-pre-wrap break-words text-slate-500"># {line.text}</div>;
  }
  if (line.kind === 'cmd') {
    return (
      <div className="whitespace-pre-wrap break-words">
        <span className="select-none text-emerald-400">{line.prompt}&nbsp;</span>
        <span className="text-slate-100">{line.text}</span>
      </div>
    );
  }
  return <div className="whitespace-pre-wrap break-words text-slate-400">{line.text}</div>;
}

function stepToLines(step: TerminalStep, prompt: string): RenderedLine[] {
  const out: RenderedLine[] = [];
  if (step.comment) out.push({ kind: 'comment', text: step.comment });
  if (step.cmd) out.push({ kind: 'cmd', text: step.cmd, prompt: step.prompt ?? prompt });
  if (step.output) out.push({ kind: 'output', text: step.output });
  return out;
}

function charDelay(ch: string): number {
  if (ch === ' ') return 18;
  if (ch === '\n') return 60;
  return 16 + Math.round(Math.abs(hashChar(ch)) % 26);
}
// deterministic per-char jitter (no Math.random, stable across renders)
function hashChar(ch: string): number {
  return (ch.charCodeAt(0) * 2654435761) % 97;
}

/* ================================================================== */
/* Tabs: switchable code / content                                     */
/* ================================================================== */

function TabsBlock({ spec }: { spec: TabsSpec }) {
  const [active, setActive] = useState(0);
  const current = spec.tabs[active] ?? spec.tabs[0];

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-muted/30">
      {spec.title && (
        <div className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">
          {spec.title}
        </div>
      )}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-border bg-muted/50 px-2 pt-2">
        {spec.tabs.map((tab, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={
              'rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ' +
              (i === active
                ? 'bg-[#0b0f17] text-slate-100'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bg-[#0b0f17]">
        {current.lang && (
          <div className="px-4 pt-2 font-mono text-[11px] uppercase tracking-wide text-slate-500">
            {current.lang}
          </div>
        )}
        <pre className="overflow-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-100">
          <code>{current.code}</code>
        </pre>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Hydration wrappers (same pattern as ChartBlockWrapper)              */
/* ================================================================== */

function useHydrate(
  selector: string,
  dataKey: string,
  render: (raw: string) => React.ReactElement | null
) {
  const rootsRef = useRef<Root[]>([]);
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    nodes.forEach((node) => {
      const element = render(node.dataset[dataKey] ?? '');
      if (!element) return;
      node.setAttribute('data-mounted', 'true');
      const root = createRoot(node);
      root.render(element);
      rootsRef.current.push(root);
    });
    const roots = rootsRef.current;
    return () => {
      setTimeout(() => roots.forEach((root) => root.unmount()), 0);
      rootsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function TerminalBlockWrapper({ children }: { children: React.ReactNode }) {
  useHydrate('.post-terminal[data-terminal]:not([data-mounted])', 'terminal', (raw) => {
    const spec = parseTerminalSpec(raw);
    return spec ? <TerminalBlock spec={spec} /> : null;
  });
  return <>{children}</>;
}

export function TabsBlockWrapper({ children }: { children: React.ReactNode }) {
  useHydrate('.post-tabs[data-tabs]:not([data-mounted])', 'tabs', (raw) => {
    const spec = parseTabsSpec(raw);
    return spec ? <TabsBlock spec={spec} /> : null;
  });
  return <>{children}</>;
}
