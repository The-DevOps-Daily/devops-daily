import { describe, it, expect } from 'vitest';
import {
  advance,
  advanceToNextEvent,
  buildDebrief,
  createGame,
  currentPoint,
  dispatch,
  dispatchBlock,
  getAction,
  nextUpdateDue,
  resolveIncident,
  setSeverity,
  startMonitoring,
  type GameState,
  type Scenario,
} from '@/lib/games/incident-commander-engine';
import {
  SCENARIOS,
  connectionExhaustion as launch,
  threeChanges as changes,
} from '@/lib/games/incident-commander-scenarios';

function run(s: Scenario, steps: (string | number)[]): GameState {
  let st = createGame(s);
  for (const step of steps)
    st = typeof step === 'number' ? advance(s, st, step) : dispatch(s, st, step);
  return st;
}

describe('every scenario', () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: starts unhealthy and is deterministic`, () => {
      const a = createGame(s);
      const b = createGame(s);
      expect(s.isHealthy(currentPoint(a))).toBe(false);
      expect(a.history).toEqual(b.history);
    });

    it(`${s.id}: was healthy before the incident began`, () => {
      expect(s.isHealthy(createGame(s).history[0])).toBe(true);
    });

    it(`${s.id}: never recovers on its own`, () => {
      const st = advance(s, createGame(s), 30);
      expect(st.history.filter((p) => p.t > 0).some((p) => s.isHealthy(p))).toBe(false);
    });

    it(`${s.id}: has the four status updates and unique action ids`, () => {
      const ids = s.actions.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(s.actions.filter((a) => a.update).map((a) => a.update)).toEqual([
        'investigating',
        'identified',
        'monitoring',
        'resolved',
      ]);
    });
  }
});

describe('launch day: too many clients', () => {
  const healthyAfter = (steps: (string | number)[]) =>
    launch.isHealthy(currentPoint(run(launch, steps)));

  it('recovers with each reversible fix', () => {
    expect(healthyAfter(['pool6', 10])).toBe(true);
    expect(healthyAfter(['pooler', 10])).toBe(true);
    expect(healthyAfter(['scale18', 10])).toBe(true);
  });

  it('does not recover from a restart, a failover, or scaling back to 10 pods', () => {
    expect(healthyAfter(['restart-pods', 12])).toBe(false);
    expect(healthyAfter(['failover', 12])).toBe(false);
    const st = run(launch, ['scale10', 12]);
    expect(launch.isHealthy(currentPoint(st))).toBe(false);
    expect(currentPoint(st).constraint).toBeLessThan(95); // no connection pressure, just too little capacity
  });

  it('raising max_connections works but costs a full outage', () => {
    const st = run(launch, ['maxconn', 12]);
    expect(launch.isHealthy(currentPoint(st))).toBe(true);
    expect(buildDebrief(launch, st).outageMinutes).toBeGreaterThanOrEqual(3);
    expect(buildDebrief(launch, st).revisit).toMatch(/full/);
  });

  it('shows connection refusals while the slots are full', () => {
    const st = run(launch, ['inspect-failures', 2]);
    const result = st.feed.find((f) => f.kind === 'result');
    expect(result?.evidence?.lines.join('\n')).toMatch(/too many clients already/);
    expect(st.findings).toContain('slots-full');
  });
});

describe('three changes, one incident', () => {
  it('setting the flag back to 10% helps but does not fully recover', () => {
    const st = run(changes, ['flag10', 10]);
    const p = currentPoint(st);
    expect(p.failed).toBeLessThan(2);
    expect(changes.isHealthy(p)).toBe(false);
  });

  it('turning the flag off or rolling back recovers', () => {
    expect(changes.isHealthy(currentPoint(run(changes, ['flagOff', 4])))).toBe(true);
    expect(changes.isHealthy(currentPoint(run(changes, ['rollback', 9])))).toBe(true);
  });

  it('pausing the upgrade alone changes little', () => {
    expect(changes.isHealthy(currentPoint(run(changes, ['pause-upgrade', 10])))).toBe(false);
  });

  it('does not count pausing the upgrade as an overlapping change', () => {
    const st = run(changes, ['flagOff', 'pause-upgrade', 10]);
    expect(buildDebrief(changes, st).coordination.join(' ')).not.toMatch(/overlapped/);
  });
});

describe('responders and the clock', () => {
  it('a responder cannot take a second task while busy', () => {
    let st = dispatch(changes, createGame(changes), 'diff-v214');
    expect(dispatchBlock(st, getAction(changes, 'inspect-500s'))).toBe('busy');
    st = advance(changes, st, 3);
    expect(dispatchBlock(st, getAction(changes, 'inspect-500s'))).toBe(null);
  });

  it('dispatching does not advance time', () => {
    const st = run(changes, ['diff-v214', 'upgrade-impact', 'post-investigating']);
    expect(st.t).toBe(0);
  });

  it('advance to next event stops when a task completes', () => {
    const st = advanceToNextEvent(changes, dispatch(changes, createGame(changes), 'diff-v214'));
    expect(st.t).toBe(3);
  });

  it('a non-repeatable investigation cannot run twice', () => {
    const st = run(changes, ['diff-v214', 3]);
    expect(dispatchBlock(st, getAction(changes, 'diff-v214'))).toBe('done');
  });
});

describe('phases', () => {
  it('cannot start monitoring while still failing, and records the claim', () => {
    const st = startMonitoring(changes, createGame(changes));
    expect(st.phase).toBe('responding');
    expect(st.phaseClaims[0]).toMatchObject({ phase: 'monitoring', ok: false });
  });

  it('resolving needs monitoring plus a sustained recovery', () => {
    let st = run(changes, ['flagOff', 2]);
    st = startMonitoring(changes, st);
    expect(st.phase).toBe('monitoring');
    expect(resolveIncident(changes, st).ended).toBe(false);
    st = resolveIncident(changes, advance(changes, st, 8));
    expect(st.ended).toBe(true);
    expect(st.endReason).toBe('resolved');
  });

  it('ends at the time limit', () => {
    const st = advance(changes, createGame(changes), 70);
    expect(st.ended).toBe(true);
    expect(st.endReason).toBe('timeout');
    expect(st.t).toBe(60);
  });
});

describe('communication', () => {
  it('the first update is due at T+10, then 15 minutes after the last one', () => {
    let st = createGame(changes);
    expect(nextUpdateDue(st)).toBe(10);
    st = run(changes, [3, 'post-investigating', 1]);
    expect(nextUpdateDue(st)).toBe(19);
  });

  it('judges updates against the evidence and the signals', () => {
    let st = run(changes, ['post-identified', 1]);
    expect(st.updates[0].accurate).toBe(false);
    st = run(changes, ['inspect-500s', 2, 'post-identified', 1]);
    expect(st.updates[0].accurate).toBe(true);
    st = run(changes, ['post-monitoring', 1]);
    expect(st.updates[0].accurate).toBe(false);
  });

  it('counts missed deadlines even when no update is ever posted', () => {
    const st = advance(changes, createGame(changes), 40);
    const d = buildDebrief(changes, st);
    expect(d.updatesOnTime).toBe(0);
    expect(d.updatesDue).toBe(3); // T+10, T+25, T+40
  });

  it('warns once when an update is overdue', () => {
    const st = advance(changes, createGame(changes), 12);
    expect(st.feed.filter((f) => f.text.startsWith('Status update overdue'))).toHaveLength(1);
  });
});

describe('debrief', () => {
  it('a clean run has no decision to revisit', () => {
    let st = run(changes, [
      'post-investigating',
      'inspect-500s',
      'upgrade-impact',
      2,
      'flagOff',
      'pause-upgrade',
      2,
    ]);
    st = setSeverity(st, 'SEV2');
    st = startMonitoring(changes, st);
    st = dispatch(changes, st, 'post-identified');
    st = resolveIncident(changes, advance(changes, st, 8));
    const d = buildDebrief(changes, st);
    expect(d.endReason).toBe('resolved');
    expect(d.mitigatedAt).not.toBeNull();
    expect(d.revisit).toBeNull();
    expect(d.severityNote).toMatch(/fits/);
  });

  it('names the restart as the decision to revisit', () => {
    const st = run(changes, ['restart-checkout', 2, 'flagOff', 10]);
    expect(buildDebrief(changes, st).revisit).toMatch(/Restarting checkout pods/);
  });
});

describe('regressions from review', () => {
  it('a Resolved update after a held recovery is accurate', () => {
    let st = run(changes, ['flagOff', 2]);
    st = startMonitoring(changes, st);
    st = advance(changes, st, 8);
    st = dispatch(changes, st, 'post-resolved');
    st = advance(changes, st, 1);
    expect(st.updates[st.updates.length - 1]).toMatchObject({ kind: 'resolved', accurate: true });
  });

  it('scaling can be reversed: 10 pods, then 18 pods recovers', () => {
    const st = run(launch, ['scale10', 3, 'scale18', 8]);
    expect(launch.isHealthy(currentPoint(st))).toBe(true);
  });

  it('a late update still counts every deadline missed before it', () => {
    let st = advance(changes, createGame(changes), 41);
    st = advance(changes, dispatch(changes, st, 'post-investigating'), 9);
    const d = buildDebrief(changes, st);
    expect(d.updatesDue).toBe(3); // T+10, T+25, T+40 missed; the next is due at T+57
    expect(d.updatesOnTime).toBe(0);
  });

  it('cannot resolve while a production change is still running', () => {
    let st = run(changes, ['flagOff', 2]);
    st = startMonitoring(changes, st);
    st = advance(changes, st, 8);
    st = dispatch(changes, st, 'rollback');
    st = resolveIncident(changes, st);
    expect(st.ended).toBe(false);
  });

  it('next event stops a minute before an update deadline', () => {
    const st = advanceToNextEvent(changes, advance(changes, createGame(changes), 7));
    expect(st.t).toBe(9);
  });

  it('database evidence follows a raised connection limit', () => {
    const st = run(launch, ['maxconn', 6, 'db-load', 3]);
    const last = st.feed.filter((f) => f.kind === 'result').pop();
    expect(last?.evidence?.lines.join('\n')).toMatch(/\/ 400/);
  });
});
