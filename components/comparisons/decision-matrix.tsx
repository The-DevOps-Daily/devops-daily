'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toolBg, toolVars } from './tool-style';
import type { DecisionMatrixItem, ToolInfo } from '@/lib/comparison-types';

interface DecisionMatrixProps {
  items: DecisionMatrixItem[];
  toolA: ToolInfo;
  toolB: ToolInfo;
}

/**
 * "Which one fits you?": the reader ticks the situations that apply, and a bar
 * shows which tool those picks point to. Every row still shows its pick, so
 * the list reads the same without JavaScript.
 */
export function DecisionMatrix({ items, toolA, toolB }: DecisionMatrixProps) {
  const [ticked, setTicked] = useState<number[]>([]);

  function recommendationStyle(rec: 'toolA' | 'toolB' | 'either') {
    if (rec === 'either')
      return { style: undefined, bg: 'bg-zinc-500 text-white', label: 'Either' };
    const tool = rec === 'toolA' ? toolA : toolB;
    return { style: toolVars(tool.color), bg: toolBg, label: tool.name };
  }

  const chosen = ticked.map((i) => items[i].recommendation);
  // "Either" counts half for each tool.
  const a = chosen.reduce((t, r) => t + (r === 'toolA' ? 1 : r === 'either' ? 0.5 : 0), 0);
  const b = chosen.length - a;
  const share = chosen.length ? (a / chosen.length) * 100 : 50;
  const leader = a === b ? null : a > b ? toolA : toolB;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4" aria-live="polite">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium" style={toolVars(toolA.color)}>
            <span className="text-[color:var(--tool)] dark:text-[color:var(--tool-dark)]">
              {toolA.name}
            </span>
            {chosen.length > 0 && (
              <span className="ml-2 font-mono text-xs text-muted-foreground">{fmt(a)}</span>
            )}
          </span>
          <span className="text-right font-medium" style={toolVars(toolB.color)}>
            {chosen.length > 0 && (
              <span className="mr-2 font-mono text-xs text-muted-foreground">{fmt(b)}</span>
            )}
            <span className="text-[color:var(--tool)] dark:text-[color:var(--tool-dark)]">
              {toolB.name}
            </span>
          </span>
        </div>
        <div
          className="flex h-2.5 overflow-hidden rounded-full bg-muted"
          style={toolVars(toolA.color)}
        >
          <div
            className="h-full bg-[var(--tool)] transition-[width] duration-500 ease-out dark:bg-[var(--tool-dark)] motion-reduce:transition-none"
            style={{ width: `${chosen.length ? share : 0}%` }}
          />
          <div
            className="h-full flex-1 bg-[var(--tool)] transition-opacity dark:bg-[var(--tool-dark)]"
            style={{ ...(toolVars(toolB.color) as object), opacity: chosen.length ? 1 : 0 }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {chosen.length === 0
            ? 'Tick the situations that apply to you.'
            : leader
              ? `Your picks point to ${leader.name}: ${fmt(Math.max(a, b))} of ${chosen.length}.`
              : `A tie: both fit your ${chosen.length} picks equally.`}
        </p>
      </div>

      <ul className="space-y-2">
        {items.map((item, i) => {
          const on = ticked.includes(i);
          const rec = recommendationStyle(item.recommendation);
          return (
            <li key={i}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setTicked((t) => (on ? t.filter((x) => x !== i) : [...t, i]))}
                className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  on ? 'border-primary/60 bg-primary/5' : 'border-border hover:bg-muted/30'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40'
                  }`}
                  aria-hidden="true"
                >
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="flex-1 text-sm font-medium">{item.criteria}</span>
                <Badge className={`shrink-0 text-xs ${rec.bg}`} style={rec.style}>
                  {rec.label}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
