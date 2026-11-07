'use client';

import { Circle, CircleCheck } from 'lucide-react';
import type { MissionView } from '@/components/games/sim/use-missions';
import { cn } from '@/lib/utils';

/** The mission checklist for a sandbox's side column. */
export function SimMissionList({
  missions,
  title = 'Missions',
}: {
  missions: MissionView[];
  title?: string;
}) {
  const done = missions.filter((m) => m.done).length;
  return (
    <section aria-label={title} className="rounded-lg border bg-card p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {done}/{missions.length}
        </span>
      </div>
      <ol className="space-y-1.5">
        {missions.map((m) => {
          const Icon = m.done ? CircleCheck : Circle;
          return (
            <li
              key={m.id}
              aria-current={m.current ? 'step' : undefined}
              className={cn(
                'flex gap-2 rounded-md px-2 py-1.5',
                m.current && 'border border-primary/40 bg-primary/5'
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  m.done ? 'text-correct-foreground' : 'text-muted-foreground'
                )}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className={cn(m.done && 'text-muted-foreground')}>
                  {m.label}
                  <span className="sr-only">{m.done ? ' (done)' : ' (to do)'}</span>
                </p>
                {!m.done && m.hint && <p className="text-xs text-muted-foreground">{m.hint}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
