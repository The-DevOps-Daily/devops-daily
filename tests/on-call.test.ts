import { describe, expect, it } from 'vitest';
import {
  applyResult,
  buildShareText,
  canInspect,
  currentStreak,
  dayNumber,
  decodeBackup,
  emptyState,
  encodeBackup,
  getCorrectCause,
  getDailyIncident,
  getIncidentByNumber,
  getIncidentForDay,
  LAUNCH_ISO,
  MAX_MOVES,
  MIN_REPEAT_GAP_DAYS,
  playRound,
  puzzleNumber,
  restoreBackup,
  ROUND_HISTORY_DAYS,
  sanitizeState,
  SUBSYSTEMS,
  TOPICS,
  verdictFor,
  type Action,
  type MoveRecord,
  type OnCallState,
} from '../lib/on-call';
import { INCIDENTS } from '../lib/on-call-incidents';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const DAY_MS = 86_400_000;

describe('on-call daily selection', () => {
  it('day 0 is the launch date and puzzle #1', () => {
    expect(dayNumber(at(LAUNCH_ISO))).toBe(0);
    expect(puzzleNumber(0)).toBe(1);
  });

  it('rolls over at midnight UTC, whatever the local time zone', () => {
    const launch = Date.parse(`${LAUNCH_ISO}T00:00:00Z`);
    expect(dayNumber(new Date(launch + DAY_MS - 1))).toBe(0);
    expect(dayNumber(new Date(launch + DAY_MS))).toBe(1);
  });

  it('gives everyone the same incident on the same day', () => {
    const a = new Date(Date.parse(`${LAUNCH_ISO}T00:00:01Z`) + 5 * DAY_MS);
    const b = new Date(Date.parse(`${LAUNCH_ISO}T23:59:59Z`) + 5 * DAY_MS);
    expect(getDailyIncident(a)).toBe(getDailyIncident(b));
  });

  it('clamps clock skew before launch to the first incident', () => {
    expect(getIncidentForDay(-3)).toBe(INCIDENTS[0]);
    expect(puzzleNumber(-3)).toBe(1);
  });

  it('wraps around the pool', () => {
    expect(getIncidentForDay(INCIDENTS.length)).toBe(INCIDENTS[0]);
  });

  // The schedule walks the pool in order, so the gap between two plays of the
  // same incident is exactly the pool size. A month without a repeat needs 30.
  it('keeps the pool large enough for a month without a repeat', () => {
    expect(INCIDENTS.length).toBeGreaterThanOrEqual(MIN_REPEAT_GAP_DAYS);
  });

  for (const [name, start] of [
    ['launch', dayNumber(at(LAUNCH_ISO))],
    ['today', dayNumber(new Date())],
  ] as const) {
    it(`picks a valid incident for each of the next 90 days from ${name}, with no repeat within ${MIN_REPEAT_GAP_DAYS} days`, () => {
      const lastSeen = new Map<number, number>();
      for (let day = start; day < start + 90; day += 1) {
        const incident = getIncidentForDay(day);
        expect(INCIDENTS).toContain(incident);
        const previous = lastSeen.get(incident.number);
        if (previous !== undefined) {
          expect(day - previous, `incident ${incident.number}`).toBeGreaterThanOrEqual(
            MIN_REPEAT_GAP_DAYS
          );
        }
        lastSeen.set(incident.number, day);
      }
    });
  }

  it('never puts the same topic on two days in a row, including the wrap', () => {
    for (let i = 0; i < INCIDENTS.length; i += 1) {
      const next = INCIDENTS[(i + 1) % INCIDENTS.length];
      expect(next.topic, `incident ${INCIDENTS[i].number} -> ${next.number}`).not.toBe(
        INCIDENTS[i].topic
      );
    }
  });
});

const BANNED_WORDS = /\b(vibrant|robust|seamless(ly)?|leverag(e|es|ed|ing)|practitioners?)\b/i;
const COMPANY_NAMES =
  /\b(AWS|Amazon|Google|GCP|Azure|Microsoft|Cloudflare|GitHub|GitLab|PagerDuty|Datadog|Stripe|Vercel|Heroku|DigitalOcean|Fastly|Akamai|Okta|Slack|Atlassian|Let's Encrypt)\b/;

function allText(incident: (typeof INCIDENTS)[number]): string[] {
  return [
    incident.title,
    incident.page,
    ...incident.symptoms,
    ...incident.evidence.flatMap((e) => [e.label, e.command ?? '', e.output]),
    ...incident.causes.map((c) => c.label),
    incident.resolution,
    incident.lesson,
  ];
}

describe('incident content', () => {
  it('numbers incidents 1..N in schedule order', () => {
    expect(INCIDENTS.map((i) => i.number)).toEqual(INCIDENTS.map((_, index) => index + 1));
    expect(getIncidentByNumber(INCIDENTS.length)).toBe(INCIDENTS[INCIDENTS.length - 1]);
    expect(getIncidentByNumber(INCIDENTS.length + 1)).toBeUndefined();
  });

  it('has unique titles', () => {
    expect(new Set(INCIDENTS.map((i) => i.title)).size).toBe(INCIDENTS.length);
  });

  it('covers every topic', () => {
    const used = new Set(INCIDENTS.map((i) => i.topic));
    expect([...used].sort()).toEqual(Object.keys(TOPICS).sort());
  });

  for (const incident of INCIDENTS) {
    describe(`#${incident.number} ${incident.title}`, () => {
      it('has one correct cause, a partial one and real decoys', () => {
        const ids = incident.causes.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(incident.correctCauseId);
        expect(incident.causes.length).toBeGreaterThanOrEqual(5);
        expect(incident.causes.length).toBeLessThanOrEqual(6);
        const verdicts = ids.map((id) => verdictFor(incident, id));
        expect(verdicts.filter((v) => v === 'correct')).toHaveLength(1);
        expect(verdicts.filter((v) => v === 'partial').length).toBeGreaterThanOrEqual(1);
        expect(verdicts.filter((v) => v === 'wrong').length).toBeGreaterThanOrEqual(2);
        for (const cause of incident.causes) expect(SUBSYSTEMS).toHaveProperty(cause.subsystem);
        expect(getCorrectCause(incident).id).toBe(incident.correctCauseId);
      });

      it('lets a player inspect every signal and still diagnose', () => {
        expect(incident.evidence.length).toBeGreaterThanOrEqual(3);
        expect(incident.evidence.length).toBeLessThanOrEqual(MAX_MOVES - 1);
        const actions: Action[] = [
          ...incident.evidence.map((_, index) => ({ kind: 'inspect' as const, index })),
          { kind: 'diagnose', causeId: incident.correctCauseId },
        ];
        const view = playRound(incident, actions);
        expect(view.revealed).toHaveLength(incident.evidence.length);
        expect(view.solved).toBe(true);
        expect(view.moves.length).toBeLessThanOrEqual(MAX_MOVES);
      });

      it('has the fields the page shows', () => {
        expect(['SEV1', 'SEV2', 'SEV3']).toContain(incident.severity);
        expect(TOPICS).toHaveProperty(incident.topic);
        expect(incident.symptoms.length).toBeGreaterThanOrEqual(2);
        expect(incident.resolution.length).toBeGreaterThan(150);
        expect(incident.lesson.length).toBeGreaterThan(60);
        expect(new Set(incident.evidence.map((e) => e.label)).size).toBe(incident.evidence.length);
        for (const evidence of incident.evidence) {
          expect(evidence.output.trim(), evidence.label).not.toBe('');
          expect(evidence.output.split('\n').length, evidence.label).toBeLessThanOrEqual(12);
        }
      });

      it('follows the house style', () => {
        for (const text of allText(incident)) {
          expect(text, text).not.toMatch(/[—–]/);
          expect(text, text).not.toMatch(BANNED_WORDS);
          expect(text, text).not.toMatch(COMPANY_NAMES);
        }
      });
    });
  }
});

describe('playing a round', () => {
  const incident = INCIDENTS[0];
  const wrong = incident.causes.find((c) => verdictFor(incident, c.id) === 'wrong')!;
  const partial = incident.causes.find((c) => verdictFor(incident, c.id) === 'partial')!;

  it('scores causes in the right subsystem as partial', () => {
    expect(verdictFor(incident, incident.correctCauseId)).toBe('correct');
    expect(partial.subsystem).toBe(getCorrectCause(incident).subsystem);
    expect(wrong.subsystem).not.toBe(getCorrectCause(incident).subsystem);
    expect(verdictFor(incident, 'no-such-cause')).toBe('wrong');
  });

  it('ignores repeated, unknown and out-of-range actions', () => {
    const view = playRound(incident, [
      { kind: 'inspect', index: 0 },
      { kind: 'inspect', index: 0 },
      { kind: 'inspect', index: 99 },
      { kind: 'inspect', index: -1 },
      { kind: 'inspect', index: 1.5 },
      { kind: 'diagnose', causeId: 'nope' },
      { kind: 'diagnose', causeId: wrong.id },
      { kind: 'diagnose', causeId: wrong.id },
    ]);
    expect(view.moves).toEqual([{ kind: 'inspect' }, { kind: 'diagnose', verdict: 'wrong' }]);
    expect(view.actions).toHaveLength(2);
    expect(view.movesLeft).toBe(MAX_MOVES - 2);
  });

  it('keeps the last move for a diagnosis', () => {
    const others = incident.causes.filter((c) => c.id !== incident.correctCauseId);
    const actions: Action[] = others
      .slice(0, MAX_MOVES - 1)
      .map((c) => ({ kind: 'diagnose', causeId: c.id }));
    const before = playRound(incident, actions);
    expect(before.movesLeft).toBe(1);
    expect(canInspect(before, 0)).toBe(false);
    const after = playRound(incident, [...actions, { kind: 'inspect', index: 0 }]);
    expect(after.moves).toHaveLength(MAX_MOVES - 1);
  });

  it('stops at the correct cause', () => {
    const view = playRound(incident, [
      { kind: 'diagnose', causeId: partial.id },
      { kind: 'diagnose', causeId: incident.correctCauseId },
      { kind: 'inspect', index: 0 },
    ]);
    expect(view.solved).toBe(true);
    expect(view.finished).toBe(true);
    expect(view.moves.map((m) => m.verdict)).toEqual(['partial', 'correct']);
  });

  it('ends unsolved when the moves run out', () => {
    const misses = incident.causes
      .filter((c) => c.id !== incident.correctCauseId)
      .map((c) => ({ kind: 'diagnose' as const, causeId: c.id }));
    const view = playRound(incident, [
      { kind: 'inspect', index: 0 },
      ...misses,
      { kind: 'diagnose', causeId: incident.correctCauseId },
    ]);
    expect(view.moves).toHaveLength(MAX_MOVES);
    expect(view.finished).toBe(true);
    expect(view.solved).toBe(false);
    expect(view.tried).not.toContain(incident.correctCauseId);
  });
});

describe('streak folding', () => {
  const round = (solved: boolean) => ({ incident: 1, solved, moves: [] as MoveRecord[] });

  it('counts consecutive solved days and resets on a miss', () => {
    let s = emptyState();
    s = applyResult(s, 0, round(true));
    s = applyResult(s, 1, round(true));
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
    s = applyResult(s, 2, round(false));
    expect(s.current).toBe(0);
    expect(s.best).toBe(2);
    expect(s.played).toBe(3);
    expect(s.solved).toBe(2);
  });

  it('breaks the streak when a day is skipped', () => {
    let s = emptyState();
    s = applyResult(s, 0, round(true));
    s = applyResult(s, 2, round(true));
    expect(s.current).toBe(1);
  });

  it('is idempotent for an already-recorded day', () => {
    const s = applyResult(emptyState(), 0, round(true));
    expect(applyResult(s, 0, round(false))).toBe(s);
  });

  it('records an older day without counting it again', () => {
    const s = applyResult(applyResult(emptyState(), 4, round(true)), 3, round(true));
    expect(s.played).toBe(1);
    expect(s.lastDay).toBe(4);
    expect(s.rounds[3]).toBeDefined();
  });

  it('shows a streak only while it is still alive', () => {
    const s = applyResult(emptyState(), 10, round(true));
    expect(currentStreak(s, 10)).toBe(1);
    expect(currentStreak(s, 11)).toBe(1);
    expect(currentStreak(s, 12)).toBe(0);
  });

  it('keeps a bounded round history', () => {
    let s = emptyState();
    for (let day = 0; day < ROUND_HISTORY_DAYS + 20; day += 1) s = applyResult(s, day, round(true));
    expect(Object.keys(s.rounds)).toHaveLength(ROUND_HISTORY_DAYS);
    expect(s.played).toBe(ROUND_HISTORY_DAYS + 20);
  });

  it('clears the saved in-progress round once that day is finished', () => {
    const s: OnCallState = { ...emptyState(), active: { day: 5, incident: 1, actions: [] } };
    expect(applyResult(s, 5, round(true)).active).toBeNull();
  });
});

describe('share text', () => {
  it('renders a spoiler-free emoji grid with no cause names', () => {
    const moves: MoveRecord[] = [
      { kind: 'inspect' },
      { kind: 'diagnose', verdict: 'partial' },
      { kind: 'diagnose', verdict: 'correct' },
    ];
    const text = buildShareText({ puzzle: 12, severity: 'SEV2', solved: true, moves });
    expect(text).toContain(`On-Call #12 · SEV2 resolved in 3/${MAX_MOVES}`);
    expect(text).toContain('\u{1F50D}\u{1F7E8}\u{1F7E9}');
    expect(text).toContain('https://devops-daily.com/games/on-call');
    for (const cause of INCIDENTS[0].causes) expect(text).not.toContain(cause.label);
  });

  it('marks an unsolved round', () => {
    const text = buildShareText({ puzzle: 2, severity: 'SEV3', solved: false, moves: [] });
    expect(text).toContain(`unresolved (${MAX_MOVES}/${MAX_MOVES})`);
  });
});

describe('stored state', () => {
  it('falls back to an empty state for garbage', () => {
    for (const raw of [null, 'x', 42, [], { lastDay: 'x' }, { lastDay: 3, current: 9, best: 1 }]) {
      expect(sanitizeState(raw)).toEqual(emptyState());
    }
  });

  it('keeps a valid state and drops broken rounds', () => {
    let s = emptyState();
    s = applyResult(s, 3, { incident: 4, solved: true, moves: [{ kind: 'inspect' }] });
    const raw = JSON.parse(JSON.stringify(s));
    raw.rounds['2'] = { incident: 3, solved: 'yes', moves: [] };
    raw.rounds['1'] = { incident: 2, solved: true, moves: [{ kind: 'hack' }] };
    raw.active = { day: 4, incident: 5, actions: [{ kind: 'inspect', index: 1 }] };
    const clean = sanitizeState(raw);
    expect(clean.rounds).toEqual(s.rounds);
    expect(clean.current).toBe(1);
    expect(clean.active).toEqual({ day: 4, incident: 5, actions: [{ kind: 'inspect', index: 1 }] });
  });

  it('drops a malformed in-progress round', () => {
    const clean = sanitizeState({
      ...emptyState(),
      active: { day: 1, incident: 1, actions: [{ kind: 'diagnose', causeId: 7 }] },
    });
    expect(clean.active).toBeNull();
  });
});

describe('backup codes', () => {
  const played = (): OnCallState => {
    let s = emptyState();
    for (const [day, solved] of [
      [40, true],
      [41, false],
      [42, true],
      [43, true],
    ] as const) {
      s = applyResult(s, day, { incident: 1, solved, moves: [] });
    }
    return s;
  };

  it('has nothing to back up before the first round', () => {
    expect(encodeBackup(emptyState())).toBeNull();
  });

  it('round-trips the counters', () => {
    const s = played();
    const code = encodeBackup(s)!;
    expect(code).toMatch(/^OC1(-[0-9A-Z]+){5}-[0-9A-Z]{4}$/);
    expect(code.length).toBeLessThan(40);
    const decoded = decodeBackup(code, 43);
    expect(decoded).toEqual({
      ok: true,
      summary: { lastDay: 43, current: 2, best: 2, played: 4, solved: 3 },
    });
  });

  it('accepts lower case and stray spaces', () => {
    const code = encodeBackup(played())!;
    expect(decodeBackup(`  ${code.toLowerCase().replace(/-/g, ' - ')} `, 43).ok).toBe(true);
  });

  it('rejects typos, garbage and impossible numbers', () => {
    const code = encodeBackup(played())!;
    const typo = code.replace(/-(\w+)-/, (m, g: string) => `-${g === '1' ? '2' : '1'}-`);
    for (const input of [
      typo,
      '',
      'hello',
      'OC1-1-1-1-1-1',
      `${code}${'A'.repeat(100)}`,
      '{"lastDay":1}',
      undefined,
      42,
    ]) {
      expect(decodeBackup(input, 43).ok, String(input)).toBe(false);
    }
    // Streak longer than the number of solved rounds, with a valid checksum.
    const forged = encodeBackup({ ...played(), current: 9, best: 9 })!;
    expect(decodeBackup(forged, 43).ok).toBe(false);
  });

  it('rejects a code from the future', () => {
    const code = encodeBackup(played())!;
    expect(decodeBackup(code, 44).ok).toBe(true);
    expect(decodeBackup(code, 42).ok).toBe(true);
    expect(decodeBackup(code, 41).ok).toBe(false);
  });

  it('restores the streak and keeps rounds played since', () => {
    const decoded = decodeBackup(encodeBackup(played())!, 44);
    if (!decoded.ok) throw new Error(decoded.error);
    // A wiped browser that already played day 44 before restoring.
    const fresh = applyResult(emptyState(), 44, { incident: 5, solved: true, moves: [] });
    const restored = restoreBackup(fresh, decoded.summary);
    expect(restored.current).toBe(3);
    expect(restored.best).toBe(3);
    expect(restored.played).toBe(5);
    expect(restored.lastDay).toBe(44);
    expect(restored.rounds[44]).toBeDefined();
  });

  it('does not count a local round the backup already covers', () => {
    const s = played();
    const decoded = decodeBackup(encodeBackup(s)!, 43);
    if (!decoded.ok) throw new Error(decoded.error);
    const restored = restoreBackup(s, decoded.summary);
    expect(restored.played).toBe(s.played);
    expect(restored.current).toBe(s.current);
  });
});
