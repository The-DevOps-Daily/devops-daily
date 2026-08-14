import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  breakdown,
  bitInfo,
  diagnose,
  expectedAnswer,
  explainDiff,
  parseGuess,
  randomRound,
} from '@/lib/binary-predict';

describe('parseGuess', () => {
  it('turns three octal digits into nine bits', () => {
    expect(parseGuess('perms', '755')).toBe('111101101');
    expect(parseGuess('perms', '644')).toBe('110100100');
    expect(parseGuess('perms', '000')).toBe('000000000');
    expect(parseGuess('perms', '777')).toBe('111111111');
  });

  it('rejects permission answers that are not three octal digits', () => {
    for (const bad of ['0755', '75', '7555', '8', '778', 'rwx', '', '  ', '-1']) {
      expect(parseGuess('perms', bad)).toBeNull();
    }
  });

  it('accepts a byte in range and rejects one outside it', () => {
    expect(parseGuess('byte', '0')).toBe('00000000');
    expect(parseGuess('byte', '42')).toBe('00101010');
    expect(parseGuess('byte', '255')).toBe('11111111');
    expect(parseGuess('byte', '256')).toBeNull();
    expect(parseGuess('byte', '999')).toBeNull();
    expect(parseGuess('byte', '1e2')).toBeNull();
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseGuess('perms', ' 755 ')).toBe('111101101');
    expect(parseGuess('byte', ' 42 ')).toBe('00101010');
  });
});

describe('bitInfo', () => {
  it('names each permission bit by group and action', () => {
    expect(bitInfo('perms', 0)).toEqual({ label: 'owner read', value: 4 });
    expect(bitInfo('perms', 1)).toEqual({ label: 'owner write', value: 2 });
    expect(bitInfo('perms', 2)).toEqual({ label: 'owner execute', value: 1 });
    expect(bitInfo('perms', 3)).toEqual({ label: 'group read', value: 4 });
    expect(bitInfo('perms', 8)).toEqual({ label: 'other execute', value: 1 });
  });

  it('names byte bits by place value, high bit first', () => {
    expect(bitInfo('byte', 0)).toEqual({ label: 'place value 128', value: 128 });
    expect(bitInfo('byte', 7)).toEqual({ label: 'place value 1', value: 1 });
  });
});

describe('diagnose', () => {
  it('returns nothing when the guess is right', () => {
    expect(diagnose('perms', '111101101', '111101101')).toEqual([]);
  });

  /** The case from the suggestion: 7 where the answer is 5. */
  it('names the single bit behind a 755 vs 775 mix-up', () => {
    const actual = parseGuess('perms', '755')!;
    const guess = parseGuess('perms', '775')!;
    const diffs = diagnose('perms', actual, guess);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].label).toBe('group write');
    expect(diffs[0].value).toBe(2);
    expect(diffs[0].missed).toBe(false); // the bit is off, the learner counted it
    expect(explainDiff(diffs[0])).toBe(
      'group write is off, but your answer counts its 2.'
    );
  });

  it('reports a bit that is on but left out', () => {
    const actual = parseGuess('perms', '755')!;
    const guess = parseGuess('perms', '655')!; // owner execute dropped
    const diffs = diagnose('perms', actual, guess);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].label).toBe('owner execute');
    expect(diffs[0].missed).toBe(true);
    expect(explainDiff(diffs[0])).toBe(
      'owner execute is on and worth 1, but your answer leaves it out.'
    );
  });

  it('separates several wrong bits rather than reporting one total', () => {
    const diffs = diagnose('perms', parseGuess('perms', '750')!, parseGuess('perms', '705')!);
    // group loses r+x (4+1), other gains r+x
    expect(diffs.map((d) => d.label)).toEqual([
      'group read',
      'group execute',
      'other read',
      'other execute',
    ]);
    expect(diffs.filter((d) => d.missed).map((d) => d.label)).toEqual([
      'group read',
      'group execute',
    ]);
  });

  it('works the same way for a byte', () => {
    const diffs = diagnose('byte', parseGuess('byte', '42')!, parseGuess('byte', '46')!);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].label).toBe('place value 4');
    expect(diffs[0].missed).toBe(false);
  });

  /**
   * Two answers can differ by the same amount for different reasons. Comparing
   * numbers would call both "out by 4"; comparing bits names the actual bit.
   */
  it('distinguishes errors that share an arithmetic difference', () => {
    const a = diagnose('byte', parseGuess('byte', '5')!, parseGuess('byte', '1')!);
    const b = diagnose('byte', parseGuess('byte', '8')!, parseGuess('byte', '12')!);
    expect(a[0].label).toBe('place value 4');
    expect(a[0].missed).toBe(true);
    expect(b[0].label).toBe('place value 4');
    expect(b[0].missed).toBe(false);
  });
});

describe('breakdown', () => {
  it('shows the sum for each permission group', () => {
    expect(breakdown('perms', parseGuess('perms', '755')!)).toEqual([
      'owner rwx = 4 + 2 + 1 = 7',
      'group r-x = 4 + 1 = 5',
      'other r-x = 4 + 1 = 5',
    ]);
  });

  it('handles a group with no permissions', () => {
    expect(breakdown('perms', parseGuess('perms', '640')!)[2]).toBe('other --- = 0 = 0');
  });

  it('shows the addition for a byte', () => {
    expect(breakdown('byte', parseGuess('byte', '42')!)).toEqual(['32 + 8 + 2 = 42']);
    expect(breakdown('byte', parseGuess('byte', '0')!)).toEqual(['0']);
  });
});

describe('expectedAnswer', () => {
  it('round-trips through parseGuess', () => {
    for (const answer of ['755', '644', '600', '777', '000', '421']) {
      expect(expectedAnswer('perms', parseGuess('perms', answer)!)).toBe(answer);
    }
    for (const answer of ['0', '42', '128', '255']) {
      expect(expectedAnswer('byte', parseGuess('byte', answer)!)).toBe(answer);
    }
  });
});

describe('randomRound', () => {
  it('never produces an all-zero board', () => {
    // rng always 1 would give all zeros without the guard
    expect(randomRound('perms', () => 1)).toContain('1');
    expect(randomRound('byte', () => 1)).toContain('1');
  });

  it('never produces 777, the one value nobody needs to work out', () => {
    expect(randomRound('perms', () => 0)).not.toBe('111111111');
  });

  it('produces a board of the right width', () => {
    let i = 0;
    const rng = () => [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.45][i++ % 9];
    expect(randomRound('perms', rng)).toHaveLength(9);
    expect(randomRound('byte', rng)).toHaveLength(8);
  });

  it('produces boards that survive a full predict round trip', () => {
    for (let seed = 0; seed < 50; seed++) {
      let i = seed;
      const bits = randomRound('perms', () => ((i = (i * 9301 + 49297) % 233280) / 233280));
      const answer = expectedAnswer('perms', bits);
      expect(parseGuess('perms', answer)).toBe(bits);
      expect(diagnose('perms', bits, parseGuess('perms', answer)!)).toEqual([]);
    }
  });
});

/**
 * The logic above is only useful if the component actually hides the answer.
 * These read the source and the rendered output, which is the cheap way to
 * catch someone removing the mask without noticing.
 */
describe('predict mode wiring in the simulator', () => {
  const src = readFileSync(
    join(process.cwd(), 'components', 'games', 'binary-byte-simulator.tsx'),
    'utf-8',
  );

  it('gates the big readout on predicting, in both modes', () => {
    // byte
    expect(src).toContain("{predicting ? '?' : value}");
    // perms
    expect(src).toContain("{predicting ? '???' : permOctal(bits)}");
  });

  it('hides every chip that would give the answer away', () => {
    // chmod NNN, hex and the addition all restate the number being asked for.
    for (const leak of ['chmod ${permOctal(bits)} file.sh', 'as maths', "'hex'"]) {
      const at = src.indexOf(leak);
      expect(at).toBeGreaterThan(-1);
      // each is inside a `{!predicting && (` block opened above it
      expect(src.lastIndexOf('{!predicting && (', at)).toBeGreaterThan(-1);
    }
  });

  it('clears a stale verdict when the board changes', () => {
    // Flipping a tile changes the answer, so an old verdict must not survive.
    const applyBits = src.slice(src.indexOf('const applyBits'), src.indexOf('const toggleBit'));
    expect(applyBits).toContain('setVerdict(null)');
  });

  it('does not offer predict mode for subnet masks', () => {
    expect(src).toContain("const canPredict = mode === 'byte' || mode === 'perms';");
  });
});
