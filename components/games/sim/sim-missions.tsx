'use client';

import { useState } from 'react';
import { Circle, CircleCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimHintButton } from '@/components/games/sim/sim-frame';
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
    <section aria-label={title} className="rounded-lg border bg-card p-2.5 text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {done}/{missions.length}
        </span>
      </div>
      <ol className="space-y-1">
        {missions.map((m) => {
          const Icon = m.done ? CircleCheck : Circle;
          return (
            <li
              key={m.id}
              aria-current={m.current ? 'step' : undefined}
              className={cn(
                'flex gap-2 rounded-md px-2 py-1',
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

/**
 * Help for the current mission, as a row under the goal line: a button that
 * opens the place the mission happens, and "Show me how" with its exact steps.
 */
export function SimMissionHelp({
  mission,
  onGo,
  goLabel = 'Take me there',
}: {
  mission: MissionView | null;
  /** Leave undefined when the player is already in the right place. */
  onGo?: () => void;
  goLabel?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const steps = mission?.steps ?? [];
  if (!mission || mission.done || (!onGo && steps.length === 0)) return null;
  // Keyed by mission, so the steps close when the next mission starts.
  const open = openId === mission.id;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        {onGo && (
          <Button type="button" variant="outline" size="sm" className="h-10 lg:h-8" onClick={onGo}>
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {goLabel}
          </Button>
        )}
        {steps.length > 0 && (
          <SimHintButton onClick={() => setOpenId(open ? null : mission.id)} pressed={open}>
            {open ? 'Hide the steps' : 'Show me how'}
          </SimHintButton>
        )}
      </div>
      {open && (
        <ol
          aria-label="Steps"
          className="list-decimal space-y-0.5 rounded-md border border-hint/30 bg-hint/5 py-1.5 pl-8 pr-3 text-sm"
        >
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
