'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Missions turn a free-play sandbox into something with progress and an end:
 * 3 to 5 checks against the simulator state, such as "Make P99 pass 500 ms
 * while the average stays under 100 ms". A mission stays done once its check
 * has passed, even if the player keeps playing. Free play stays open after
 * the last one.
 */
export interface Mission<S> {
  id: string;
  /** What to do, in one line. */
  label: string;
  /** Shown under the label until the mission is done. */
  hint?: string;
  check: (state: S) => boolean;
}

export interface MissionView {
  id: string;
  label: string;
  hint?: string;
  done: boolean;
  /** The first mission not done yet. */
  current: boolean;
}

export interface MissionProgress {
  missions: MissionView[];
  done: number;
  total: number;
  /** True once every mission has passed: show SimComplete. */
  complete: boolean;
  /** The first open mission, for the goal line. */
  current: MissionView | null;
}

/** The ids that are done now: the ones done before plus every check that passes. */
export function passedMissions<S>(
  missions: Mission<S>[],
  state: S,
  before: ReadonlySet<string>
): Set<string> {
  const done = new Set(before);
  for (const m of missions) {
    if (done.has(m.id)) continue;
    try {
      if (m.check(state)) done.add(m.id);
    } catch {
      // A check that throws has not passed.
    }
  }
  return done;
}

export function missionProgress<S>(
  missions: Mission<S>[],
  done: ReadonlySet<string>
): MissionProgress {
  const firstOpen = missions.findIndex((m) => !done.has(m.id));
  const views = missions.map((m, i) => ({
    id: m.id,
    label: m.label,
    hint: m.hint,
    done: done.has(m.id),
    current: i === firstOpen,
  }));
  const count = views.filter((v) => v.done).length;
  return {
    missions: views,
    done: count,
    total: missions.length,
    complete: missions.length > 0 && count === missions.length,
    current: firstOpen >= 0 ? views[firstOpen] : null,
  };
}

/**
 * Checks the missions each time `state` changes. Keep `missions` stable
 * (a module constant or useMemo). `reset()` clears them for Start over.
 */
const UNCHECKED = Symbol('unchecked');

export function useMissions<S>(missions: Mission<S>[], state: S) {
  const [done, setDone] = useState<Set<string>>(() => passedMissions(missions, state, new Set()));
  const [checked, setChecked] = useState<S | typeof UNCHECKED>(state);

  // Adjust during render when the state changes (no effect, no extra paint).
  if (checked !== state) {
    setChecked(state);
    const after = passedMissions(missions, state, done);
    if (after.size !== done.size) setDone(after);
  }

  const reset = useCallback(() => {
    setDone(new Set());
    setChecked(UNCHECKED);
  }, []);
  const progress = useMemo(() => missionProgress(missions, done), [missions, done]);
  return { ...progress, reset };
}
