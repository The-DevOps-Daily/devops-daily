/**
 * Predict-mode logic for the binary byte simulator.
 *
 * The idea came from a reader: hide the computed value for a round and ask the
 * learner to read it off the bits instead. The teaching value is not in marking
 * the answer right or wrong, it is in the diff. A guess of 7 against an actual
 * 5 is not "wrong by 2", it is "you counted the write bit and it is off", and
 * that names the single bit the learner has not understood.
 *
 * Kept free of React so it can be tested directly.
 */

export type PredictMode = 'byte' | 'perms';

export const PREDICT_WIDTH: Record<PredictMode, number> = { byte: 8, perms: 9 };

const PERM_LETTERS = ['r', 'w', 'x'] as const;
const PERM_GROUPS = ['owner', 'group', 'other'] as const;
const PERM_WORDS = ['read', 'write', 'execute'] as const;

export interface BitDiff {
  /** Index into the bit string, left to right. */
  index: number;
  /** Human name for the bit: "owner write", or "place value 32". */
  label: string;
  /** What the bit is worth: 4/2/1 within a permission triad, or its place value. */
  value: number;
  /** True when the bit is set but the guess does not account for it. */
  missed: boolean;
}

function toBits(n: number, width: number): string {
  return n.toString(2).padStart(width, '0');
}

/**
 * Turn what the learner typed into a bit string, or null if it is not a
 * well-formed answer for this mode. Returning null rather than throwing keeps
 * the caller's "did you mean to submit that?" path simple.
 */
export function parseGuess(mode: PredictMode, raw: string): string | null {
  const s = raw.trim();
  if (mode === 'perms') {
    // Three octal digits, one per group. "755", not "0755" and not "rwxr-xr-x".
    if (!/^[0-7]{3}$/.test(s)) return null;
    return s
      .split('')
      .map((d) => toBits(Number(d), 3))
      .join('');
  }
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  if (n > 255) return null;
  return toBits(n, 8);
}

/** What a single bit position is called and what it is worth. */
export function bitInfo(mode: PredictMode, index: number): { label: string; value: number } {
  if (mode === 'perms') {
    const group = PERM_GROUPS[Math.floor(index / 3)];
    const slot = index % 3;
    return { label: `${group} ${PERM_WORDS[slot]}`, value: 2 ** (2 - slot) };
  }
  const value = 2 ** (PREDICT_WIDTH.byte - 1 - index);
  return { label: `place value ${value}`, value };
}

/**
 * Every bit where the guess disagrees with the board.
 *
 * Both sides are compared as bit strings rather than as numbers, so a wrong
 * answer decomposes into named bits instead of an arithmetic difference.
 */
export function diagnose(mode: PredictMode, actual: string, guess: string): BitDiff[] {
  const out: BitDiff[] = [];
  for (let i = 0; i < actual.length && i < guess.length; i++) {
    if (actual[i] === guess[i]) continue;
    const { label, value } = bitInfo(mode, i);
    out.push({ index: i, label, value, missed: actual[i] === '1' });
  }
  return out;
}

/** One sentence per wrong bit, naming it and saying which way the error went. */
export function explainDiff(d: BitDiff): string {
  return d.missed
    ? `${d.label} is on and worth ${d.value}, but your answer leaves it out.`
    : `${d.label} is off, but your answer counts its ${d.value}.`;
}

/** The arithmetic, shown after the answer so the sum is visible, not implied. */
export function breakdown(mode: PredictMode, bits: string): string[] {
  if (mode === 'perms') {
    return [0, 1, 2].map((g) => {
      const triad = bits.slice(g * 3, g * 3 + 3);
      const symbolic = triad
        .split('')
        .map((b, i) => (b === '1' ? PERM_LETTERS[i] : '-'))
        .join('');
      const parts = triad
        .split('')
        .map((b, i) => (b === '1' ? 2 ** (2 - i) : 0))
        .filter((v) => v > 0);
      const total = parts.reduce((a, b) => a + b, 0);
      const sum = parts.length ? parts.join(' + ') : '0';
      return `${PERM_GROUPS[g]} ${symbolic} = ${sum} = ${total}`;
    });
  }
  const parts = bits
    .split('')
    .map((b, i) => (b === '1' ? 2 ** (bits.length - 1 - i) : 0))
    .filter((v) => v > 0);
  const total = parts.reduce((a, b) => a + b, 0);
  return [parts.length ? `${parts.join(' + ')} = ${total}` : '0'];
}

/** The answer the learner is being asked for, as they would type it. */
export function expectedAnswer(mode: PredictMode, bits: string): string {
  if (mode === 'perms') {
    return [0, 1, 2].map((g) => parseInt(bits.slice(g * 3, g * 3 + 3), 2)).join('');
  }
  return String(parseInt(bits, 2));
}

/**
 * A board worth reading. All-zero is excluded because "000" teaches nothing,
 * and for permissions an all-ones board is the one value everyone already
 * knows, so it is skipped too.
 */
export function randomRound(mode: PredictMode, rng: () => number = Math.random): string {
  const width = PREDICT_WIDTH[mode];
  for (let attempt = 0; attempt < 20; attempt++) {
    const bits = Array.from({ length: width }, () => (rng() < 0.5 ? '0' : '1')).join('');
    if (!bits.includes('1')) continue;
    if (mode === 'perms' && !bits.includes('0')) continue;
    return bits;
  }
  return mode === 'perms' ? '111101101' : '00101010';
}
