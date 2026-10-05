import { describe, it, expect } from 'vitest';
import {
  choose,
  createGame,
  evaluate,
  getProgress,
  goTo,
  inspect,
  isSolved,
  lineTone,
  lines,
  missingChecks,
  nextUnsolved,
  planSummary,
  puzzleStatus,
  score,
  takeHint,
  type Puzzle,
  type Transcript,
} from '@/lib/games/terraform-puzzle-engine';
import { PUZZLES, getPuzzle } from '@/lib/games/terraform-puzzle-puzzles';

const EM_DASH = String.fromCharCode(0x2014);

function allTranscripts(p: Puzzle): Transcript[] {
  const out: Transcript[] = [...p.evidence];
  for (const i of p.inspects) if (i.transcript) out.push(i.transcript);
  for (const o of p.options) {
    out.push(...o.outcome.transcripts);
    if (o.unchecked?.transcripts) out.push(...o.unchecked.transcripts);
  }
  return out;
}

function allText(p: Puzzle): string[] {
  const text = [p.title, p.story, p.goal, p.hint, p.lesson];
  for (const f of p.files) text.push(...f.lines);
  for (const n of p.notes ?? []) text.push(n.source, ...n.lines);
  for (const i of p.inspects) {
    text.push(i.label);
    if (i.note) text.push(i.note.source, ...i.note.lines);
  }
  for (const o of p.options) {
    text.push(o.label, ...o.code, o.outcome.summary, o.outcome.explanation);
    if (o.unchecked) text.push(o.unchecked.summary, o.unchecked.explanation);
  }
  for (const t of allTranscripts(p)) text.push(t.title, t.command, t.note ?? '', ...t.lines);
  return text;
}

describe('puzzle data', () => {
  it('has 5 to 8 puzzles with unique ids', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(5);
    expect(PUZZLES.length).toBeLessThanOrEqual(8);
    const ids = PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const p of PUZZLES) {
    describe(p.id, () => {
      it('has one best option and at least one unsafe option', () => {
        expect(p.options.filter((o) => o.outcome.verdict === 'best')).toHaveLength(1);
        expect(p.options.some((o) => o.outcome.verdict === 'unsafe')).toBe(true);
        expect(p.options.length).toBeGreaterThanOrEqual(3);
        expect(p.options.length).toBeLessThanOrEqual(4);
      });

      it('has unique option, inspect and transcript ids within the puzzle', () => {
        const opt = p.options.map((o) => o.id);
        expect(new Set(opt).size).toBe(opt.length);
        const ins = p.inspects.map((i) => i.id);
        expect(new Set(ins).size).toBe(ins.length);
        for (const o of p.options) {
          const t = o.outcome.transcripts.map((x) => x.id);
          expect(new Set(t).size).toBe(t.length);
        }
      });

      it('gives every inspect exactly one of a transcript or a note', () => {
        for (const i of p.inspects) expect(!!i.transcript !== !!i.note).toBe(true);
      });

      it('only requires inspects that exist, and says what happens without them', () => {
        for (const o of p.options) {
          if (!o.requires) continue;
          expect(o.unchecked).toBeDefined();
          for (const r of o.requires) expect(p.inspects.map((i) => i.id)).toContain(r);
        }
      });

      it('shows output for every option and links official docs', () => {
        for (const o of p.options) {
          expect(o.outcome.transcripts.length).toBeGreaterThan(0);
          expect(o.outcome.explanation.length).toBeGreaterThan(40);
        }
        expect(p.docs.length).toBeGreaterThan(0);
        for (const d of p.docs) {
          expect(d.href).toMatch(/^https:\/\/(developer\.hashicorp\.com|docs\.aws\.amazon\.com)\//);
        }
      });

      it('uses no em dashes', () => {
        for (const line of allText(p)) expect(line).not.toContain(EM_DASH);
      });

      it('has Plan: summaries that match the resource headers above them', () => {
        for (const t of allTranscripts(p)) {
          const summary = t.lines.find((l) => l.startsWith('Plan: '));
          const headers = t.lines.filter((l) => /^\s{1,2}# \S+ (will|must|has)/.test(l));
          if (!summary || headers.length === 0) continue;
          const count = (re: RegExp) => headers.filter((h) => re.test(h)).length;
          const replaced = count(/ must be replaced$/);
          const add = count(/ will be created$/) + replaced;
          const destroy = count(/ will be destroyed$/) + replaced;
          const change = count(/ will be updated in-place$/);
          const imports = t.lines.filter(
            (l) => / will be imported$/.test(l) || /# \(imported from "/.test(l)
          ).length;
          const expected =
            (imports ? `Plan: ${imports} to import, ` : 'Plan: ') +
            `${add} to add, ${change} to change, ${destroy} to destroy.`;
          expect(summary, `${p.id} ${t.id}`).toBe(expected);
        }
      });

      it('aligns attribute lines in every resource body like Terraform does', () => {
        for (const t of allTranscripts(p)) {
          let body: string[] | null = null;
          for (const line of t.lines) {
            if (/resource "[^"]+" "[^"]+" \{$/.test(line)) {
              body = [];
              continue;
            }
            if (body && /^\s+\}( -> null)?$/.test(line) && !/^\s{8,}\}/.test(line)) {
              const attrs = body.filter((l) => /^\s+[+\-~]? *[a-z_0-9]+ +=/.test(l));
              const cols = new Set(attrs.map((l) => l.indexOf(' = ')));
              expect(cols.size, `${p.id} ${t.id}: ${attrs.join(' | ')}`).toBeLessThanOrEqual(1);
              const hidden = body.some((l) => /# \(\d+ unchanged attributes? hidden\)/.test(l));
              if (!hidden && attrs.length > 0) {
                const names = attrs.map(
                  (l) =>
                    l
                      .trim()
                      .replace(/^[+\-~] /, '')
                      .split(' ')[0]
                );
                const longest = Math.max(...names.map((n) => n.length));
                const start = attrs[0].search(/[a-z_0-9]+ +=/);
                expect(attrs[0].indexOf(' = ', start), `${p.id} ${t.id}`).toBe(start + longest);
              }
              body = null;
              continue;
            }
            if (body) body.push(line);
          }
        }
      });

      it('never shows the stand-in resources it was recorded with', () => {
        for (const line of allText(p)) {
          expect(line).not.toMatch(/terraform_data|local_file|raspberrypi|127\.0\.0\.1/);
        }
      });
    });
  }

  it('ends each best option on the plan the goal asks for', () => {
    const expected: Record<string, string> = {
      'wrong-workspace': 'No changes. Your infrastructure matches the configuration.',
      rename: 'Plan: 0 to add, 0 to change, 0 to destroy.',
      'deleted-alarm': 'No changes. Your infrastructure matches the configuration.',
      'hand-over': 'Plan: 0 to add, 0 to change, 0 to destroy.',
      'stale-lock': 'Plan: 1 to add, 0 to change, 0 to destroy.',
      'killed-apply': 'Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.',
      'adopt-database': 'Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.',
      'retire-staging': 'Plan: 0 to add, 0 to change, 1 to destroy.',
    };
    for (const p of PUZZLES) {
      const best = p.options.find((o) => o.outcome.verdict === 'best')!;
      const plans = best.outcome.transcripts.map(planSummary).filter(Boolean);
      expect(plans[plans.length - 1], p.id).toBe(expected[p.id]);
    }
  });

  it('keeps the trap plans that destroy what the goal protects', () => {
    expect(planSummary(getPuzzle('rename').evidence[0])).toBe(
      'Plan: 1 to add, 0 to change, 1 to destroy.'
    );
    expect(planSummary(getPuzzle('retire-staging').evidence[0])).toBe(
      'Plan: 1 to add, 0 to change, 2 to destroy.'
    );
    const adopt = getPuzzle('adopt-database');
    expect(adopt.evidence[0].lines).toContain(
      '  # Warning: this will destroy the imported resource'
    );
  });
});

describe('engine', () => {
  const rename = getPuzzle('rename');
  const lock = getPuzzle('stale-lock');

  it('starts with every puzzle untouched', () => {
    const g = createGame(PUZZLES);
    expect(g.current).toBe(0);
    for (const p of PUZZLES) expect(puzzleStatus(getProgress(g, p.id))).toBe('todo');
  });

  it('marks a puzzle clean when the first pick solves it', () => {
    const g = choose(createGame(PUZZLES), rename, 'moved');
    expect(puzzleStatus(getProgress(g, rename.id))).toBe('clean');
  });

  it('marks a puzzle solved after a wrong pick, and counts the unsafe pick', () => {
    let g = choose(createGame(PUZZLES), rename, 'apply');
    expect(puzzleStatus(getProgress(g, rename.id))).toBe('started');
    expect(isSolved(getProgress(g, rename.id))).toBe(false);
    g = choose(g, rename, 'moved');
    expect(puzzleStatus(getProgress(g, rename.id))).toBe('solved');
    expect(score(g, PUZZLES)).toMatchObject({ solved: 1, clean: 0, unsafePicks: 1 });
  });

  it('counts "works" as solved', () => {
    const g = choose(createGame(PUZZLES), rename, 'state-mv');
    expect(puzzleStatus(getProgress(g, rename.id))).toBe('clean');
  });

  it('does not score picks made after the puzzle is solved', () => {
    let g = choose(createGame(PUZZLES), rename, 'moved');
    g = choose(g, rename, 'apply');
    g = choose(g, rename, 'import');
    const prog = getProgress(g, rename.id);
    expect(prog.picks.map((p) => p.explore)).toEqual([false, true, true]);
    expect(puzzleStatus(prog)).toBe('clean');
    expect(score(g, PUZZLES).unsafePicks).toBe(0);
  });

  it('counts incomplete picks separately from unsafe ones', () => {
    const alarm = getPuzzle('deleted-alarm');
    let g = choose(createGame(PUZZLES), alarm, 'refresh-only');
    g = choose(g, alarm, 'ignore');
    expect(score(g, PUZZLES)).toMatchObject({ unsafePicks: 0, incompletePicks: 2, solved: 0 });
  });

  it('downgrades force-unlock until both checks are done', () => {
    const unlock = lock.options.find((o) => o.id === 'force-unlock')!;
    expect(missingChecks(unlock, [])).toEqual(['job', 'running']);
    expect(evaluate(lock, 'force-unlock', []).verdict).toBe('unsafe');
    expect(evaluate(lock, 'force-unlock', ['job']).verdict).toBe('unsafe');
    expect(evaluate(lock, 'force-unlock', ['running', 'job']).verdict).toBe('best');
    // The unchecked outcome still shows what the command printed.
    expect(evaluate(lock, 'force-unlock', []).transcripts).toBe(unlock.outcome.transcripts);
  });

  it('scores force-unlock by what was inspected at the time of the pick', () => {
    let g = choose(createGame(PUZZLES), lock, 'force-unlock');
    expect(getProgress(g, lock.id).picks[0].verdict).toBe('unsafe');
    g = inspect(g, lock, 'job');
    g = inspect(g, lock, 'running');
    g = choose(g, lock, 'force-unlock');
    expect(puzzleStatus(getProgress(g, lock.id))).toBe('solved');
  });

  it('records each inspect once and rejects unknown ones', () => {
    let g = inspect(createGame(PUZZLES), lock, 'job');
    g = inspect(g, lock, 'job');
    expect(getProgress(g, lock.id).inspected).toEqual(['job']);
    expect(puzzleStatus(getProgress(g, lock.id))).toBe('started');
    expect(() => inspect(g, lock, 'nope')).toThrow();
    expect(() => choose(g, lock, 'nope')).toThrow();
  });

  it('records a hint once and counts it', () => {
    let g = takeHint(createGame(PUZZLES), rename);
    g = takeHint(g, rename);
    expect(getProgress(g, rename.id).hint).toBe(true);
    expect(score(g, PUZZLES).hints).toBe(1);
  });

  it('finds the next unsolved puzzle, wrapping around', () => {
    let g = createGame(PUZZLES);
    expect(nextUnsolved(g, PUZZLES, 0)).toBe(1);
    g = choose(g, PUZZLES[1], PUZZLES[1].options.find((o) => o.outcome.verdict === 'best')!.id);
    expect(nextUnsolved(g, PUZZLES, 0)).toBe(2);
    expect(nextUnsolved(g, PUZZLES, PUZZLES.length - 1)).toBe(0);
    for (const p of PUZZLES) {
      const best = p.options.find((o) => o.outcome.verdict === 'best')!;
      for (const r of best.requires ?? []) g = inspect(g, p, r);
      g = choose(g, p, best.id);
    }
    expect(nextUnsolved(g, PUZZLES, 0)).toBeNull();
    expect(score(g, PUZZLES)).toMatchObject({ solved: PUZZLES.length, total: PUZZLES.length });
  });

  it('clamps goTo to the puzzle range', () => {
    const g = createGame(PUZZLES);
    expect(goTo(g, PUZZLES, 99).current).toBe(PUZZLES.length - 1);
    expect(goTo(g, PUZZLES, -3).current).toBe(0);
  });

  it('is pure: choosing does not change the previous state', () => {
    const g = createGame(PUZZLES);
    const before = JSON.stringify(g);
    choose(g, rename, 'apply');
    inspect(g, lock, 'job');
    expect(JSON.stringify(g)).toBe(before);
  });
});

describe('output helpers', () => {
  it('colours lines by their Terraform symbol', () => {
    expect(lineTone('  + resource "aws_vpc" "main" {')).toBe('add');
    expect(lineTone('      - id = "x" -> null')).toBe('remove');
    expect(lineTone('      ~ id = "x" -> (known after apply)')).toBe('change');
    expect(lineTone('-/+ resource "aws_s3_bucket" "env" {')).toBe('replace');
    expect(lineTone('Error: Error acquiring the state lock')).toBe('error');
    expect(lineTone('Warning: Some objects will no longer be managed by Terraform')).toBe('warn');
    expect(lineTone('  # Warning: this will destroy the imported resource')).toBe('warn');
    expect(lineTone('  # aws_vpc.main will be created')).toBe('muted');
    expect(lineTone(' - aws_cloudwatch_log_group.audit')).toBe('plain');
    expect(lineTone('+resource "aws_db_instance" "primary" {')).toBe('add');
    expect(lineTone('-resource "aws_db_instance" "main" {')).toBe('remove');
    expect(lineTone('+++ b/database.tf')).toBe('muted');
    expect(lineTone('Plan: 1 to add, 0 to change, 1 to destroy.')).toBe('plain');
  });

  it('finds the plan summary or the no-changes line', () => {
    expect(planSummary({ id: 'a', title: '', command: '', lines: ['x', 'Plan: 1 to add.'] })).toBe(
      'Plan: 1 to add.'
    );
    expect(planSummary({ id: 'b', title: '', command: '', lines: ['nothing'] })).toBeNull();
  });

  it('splits template text into lines', () => {
    expect(lines('\na\n\nb\n')).toEqual(['a', '', 'b']);
  });
});
