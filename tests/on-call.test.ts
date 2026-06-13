import { describe, expect, it } from 'vitest';
import {
  applyResult,
  buildShareText,
  dayNumber,
  emptyState,
  getDailyIncident,
  INCIDENTS,
  LAUNCH_ISO,
  MAX_MOVES,
  type MoveRecord,
} from '../lib/on-call';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('on-call daily selection', () => {
  it('day 0 is the launch date', () => {
    expect(dayNumber(at(LAUNCH_ISO))).toBe(0);
  });

  it('advances one index per UTC day and wraps around the pool', () => {
    expect(dayNumber(at('2026-06-14'))).toBe(1);
    const wrapDay = new Date(Date.parse(`${LAUNCH_ISO}T00:00:00Z`) + INCIDENTS.length * 86_400_000);
    // After a full lap we are back on incident #1.
    expect(getDailyIncident(wrapDay).number).toBe(INCIDENTS[0].number);
  });

  it('gives everyone the same incident on the same day', () => {
    expect(getDailyIncident(at('2026-06-15'))).toBe(getDailyIncident(at('2026-06-15')));
  });

  it('clamps clock skew before launch to the first incident', () => {
    expect(getDailyIncident(at('2026-06-01')).number).toBe(INCIDENTS[0].number);
  });
});

describe('incident content integrity', () => {
  it('every incident has exactly one correct cause matching correctCauseId', () => {
    for (const inc of INCIDENTS) {
      const correct = inc.causes.filter((c) => c.verdict === 'correct');
      expect(correct).toHaveLength(1);
      expect(correct[0].id).toBe(inc.correctCauseId);
    }
  });

  it('every incident offers enough causes to be a real choice', () => {
    for (const inc of INCIDENTS) {
      expect(inc.causes.length).toBeGreaterThanOrEqual(4);
      expect(inc.evidence.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('streak folding', () => {
  it('counts consecutive solved days and resets on a miss', () => {
    let s = emptyState();
    s = applyResult(s, 0, { solved: true, moves: [] });
    s = applyResult(s, 1, { solved: true, moves: [] });
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
    s = applyResult(s, 2, { solved: false, moves: [] });
    expect(s.current).toBe(0);
    expect(s.best).toBe(2); // best is preserved
  });

  it('breaks the streak when a day is skipped', () => {
    let s = emptyState();
    s = applyResult(s, 0, { solved: true, moves: [] });
    s = applyResult(s, 2, { solved: true, moves: [] }); // gap
    expect(s.current).toBe(1);
  });

  it('is idempotent for an already-recorded day', () => {
    let s = emptyState();
    s = applyResult(s, 0, { solved: true, moves: [] });
    const again = applyResult(s, 0, { solved: false, moves: [] });
    expect(again).toBe(s);
  });
});

describe('share text', () => {
  it('renders a spoiler-free emoji grid with no cause names', () => {
    const moves: MoveRecord[] = [
      { kind: 'inspect' },
      { kind: 'diagnose', verdict: 'partial' },
      { kind: 'diagnose', verdict: 'correct' },
    ];
    const text = buildShareText({ incidentNumber: 1, severity: 'SEV2', solved: true, moves });
    expect(text).toContain('On-Call #1 · SEV2 resolved in 3/' + MAX_MOVES);
    expect(text).toContain('\u{1F50D}\u{1F7E8}\u{1F7E9}');
    expect(text).toContain('devops-daily.com/games/on-call');
    // No cause label should leak into the share string.
    expect(text.toLowerCase()).not.toContain('pool');
  });

  it('marks an unsolved round', () => {
    const text = buildShareText({ incidentNumber: 2, severity: 'SEV3', solved: false, moves: [] });
    expect(text).toContain(`unresolved (${MAX_MOVES}/${MAX_MOVES})`);
  });
});
