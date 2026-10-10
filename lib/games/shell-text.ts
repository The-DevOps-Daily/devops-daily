/**
 * Text helpers behind the Linux terminal simulator's head, tail, grep and wc.
 *
 * Text is handled the way the real tools see it: a stream of bytes where each
 * line ends in a newline, and a last line without one still counts as a line
 * for head, tail and grep but not for wc -l. Pure, so it can be unit tested.
 */

/** Split text into lines, each keeping its trailing newline if it has one. */
export function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

export interface LineCount {
  count: number;
  operands: string[];
  /** The value that was not a valid count, for the error message. */
  invalid?: string;
}

/** Parse head/tail arguments: -n 5, -n5 or -5 (default 10), plus file operands. */
export function parseLineCount(args: string[]): LineCount {
  let count = 10;
  const operands: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    let raw: string | undefined;
    if (arg === '-n') {
      i += 1;
      raw = args[i] ?? '';
    } else if (/^-n./.test(arg)) {
      raw = arg.slice(2);
    } else if (/^-\d+$/.test(arg)) {
      raw = arg.slice(1);
    } else {
      operands.push(arg);
      continue;
    }
    if (!/^\d+$/.test(raw)) return { count, operands, invalid: raw };
    count = Number(raw);
  }
  return { count, operands };
}

/** The first (head) or last (tail) `count` lines, newlines kept. */
export function takeLines(text: string, count: number, fromEnd: boolean): string {
  const lines = splitLines(text);
  if (count <= 0) return '';
  return (fromEnd ? lines.slice(-count) : lines.slice(0, count)).join('');
}

/** wc counts: newline characters, words, and characters. */
export function wcCounts(text: string): { lines: number; words: number; chars: number } {
  return {
    lines: (text.match(/\n/g) ?? []).length,
    words: text.split(/\s+/).filter(Boolean).length,
    chars: text.length,
  };
}

/** Longest grep pattern accepted, which bounds how much backtracking a pattern can cause. */
export const GREP_MAX_PATTERN = 64;

const POSIX_CLASSES: Record<string, string> = {
  alpha: 'A-Za-z',
  digit: '0-9',
  alnum: 'A-Za-z0-9',
  upper: 'A-Z',
  lower: 'a-z',
  space: ' \\t\\n\\r\\f\\v',
  blank: ' \\t',
  punct: '!-\\/:-@\\[-`{-~',
  xdigit: '0-9A-Fa-f',
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Read a bracket expression starting at pattern[start] === '['. */
function readBracket(pattern: string, start: number): { source: string; end: number } {
  let i = start + 1;
  let source = '[';
  if (pattern[i] === '^') {
    source += '^';
    i += 1;
  }
  // A ] right after [ or [^ is a literal member, not the end.
  if (pattern[i] === ']') {
    source += '\\]';
    i += 1;
  }
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === ']') return { source: `${source}]`, end: i };
    if (pattern.startsWith('[:', i)) {
      const close = pattern.indexOf(':]', i + 2);
      const name = close === -1 ? '' : pattern.slice(i + 2, close);
      if (!POSIX_CLASSES[name]) throw new Error('Invalid character class name');
      source += POSIX_CLASSES[name];
      i = close + 2;
      continue;
    }
    // Inside brackets a backslash is an ordinary character in POSIX.
    source += ch === '\\' || ch === '[' || ch === '^' ? `\\${ch}` : ch;
    i += 1;
  }
  throw new Error('Unmatched [, [^, [:, [., or [=');
}

/**
 * Translate a GNU grep basic regular expression (grep without -E) into a JS
 * RegExp. In BRE, + ? | ( ) { } are literal characters, and GNU grep treats
 * their backslashed forms as operators. * is literal at the start of an
 * expression, ^ only anchors at the start and $ only at the end.
 *
 * A quantified group that itself contains a quantifier or an alternation,
 * like \(a*\)* or \(a\|a\)*, can backtrack exponentially in a JS engine, so
 * those are rejected along with patterns over GREP_MAX_PATTERN characters.
 */
export function breToRegExp(pattern: string, ignoreCase = false): RegExp {
  if (pattern.length > GREP_MAX_PATTERN) {
    throw new Error(
      `patterns over ${GREP_MAX_PATTERN} characters are not supported in this simulator`
    );
  }

  let source = '';
  let atStart = true; // start of the pattern, a group, or a branch
  let canRepeat = false; // there is an atom for a quantifier to repeat
  let afterQuantifier = false;
  let lastGroupRisky = false; // the atom just closed was a group with * or \| inside
  const groups: boolean[] = []; // per open group: has a quantifier or alternation inside

  const markRisky = () => {
    if (groups.length > 0) groups[groups.length - 1] = true;
  };
  const addAtom = (atom: string) => {
    source += atom;
    atStart = false;
    canRepeat = true;
    afterQuantifier = false;
    lastGroupRisky = false;
  };
  const addQuantifier = (quantifier: string) => {
    if (afterQuantifier) return; // GNU grep reads a** as a*
    if (lastGroupRisky)
      throw new Error('pattern too complex for this simulator (nested repetition)');
    source += quantifier;
    afterQuantifier = true;
    markRisky();
  };

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];

    if (ch === '\\') {
      const next = pattern[i + 1];
      if (next === undefined) throw new Error('Trailing backslash');
      i += 1;
      if (next === '(') {
        source += '(';
        groups.push(false);
        atStart = true;
        canRepeat = false;
        afterQuantifier = false;
        lastGroupRisky = false;
      } else if (next === ')') {
        if (groups.length === 0) throw new Error('Unmatched ) or \\)');
        const risky = groups.pop()!;
        if (risky) markRisky();
        source += ')';
        atStart = false;
        canRepeat = true;
        afterQuantifier = false;
        lastGroupRisky = risky;
      } else if (next === '|') {
        source += '|';
        markRisky();
        atStart = true;
        canRepeat = false;
        afterQuantifier = false;
        lastGroupRisky = false;
      } else if (next === '{') {
        const close = pattern.indexOf('\\}', i + 1);
        if (close === -1) throw new Error('Unmatched \\{');
        const body = pattern.slice(i + 1, close);
        if (!/^(\d+(,\d*)?|,\d+)$/.test(body)) throw new Error('Invalid content of \\{\\}');
        if (!canRepeat) throw new Error('Invalid preceding regular expression');
        addQuantifier(`{${body.startsWith(',') ? `0${body}` : body}}`);
        i = close + 1;
      } else if (next === '+' || next === '?') {
        if (canRepeat) addQuantifier(next);
        else addAtom(`\\${next}`);
      } else if (next === '<' || next === '>' || next === 'b') {
        // Word boundaries: an anchor, so there is nothing for a quantifier to repeat.
        source += '\\b';
        atStart = false;
        canRepeat = false;
        afterQuantifier = false;
        lastGroupRisky = false;
      } else if (/[wWsS1-9]/.test(next)) {
        addAtom(`\\${next}`);
      } else {
        addAtom(escapeRegExp(next));
      }
      continue;
    }

    if (ch === '*') {
      if (atStart || !canRepeat) addAtom('\\*');
      else addQuantifier('*');
    } else if (ch === '^' && atStart) {
      // Stay at the start, so a * right after ^ is still literal.
      source += '^';
    } else if (
      ch === '$' &&
      (i === pattern.length - 1 ||
        pattern.startsWith('\\)', i + 1) ||
        pattern.startsWith('\\|', i + 1))
    ) {
      source += '$';
      atStart = false;
      canRepeat = false;
      afterQuantifier = false;
      lastGroupRisky = false;
    } else if (ch === '.') {
      addAtom('.');
    } else if (ch === '[') {
      const { source: bracket, end } = readBracket(pattern, i);
      addAtom(bracket);
      i = end;
    } else {
      addAtom(escapeRegExp(ch));
    }
  }

  if (groups.length > 0) throw new Error('Unmatched ( or \\(');
  return new RegExp(source, ignoreCase ? 'i' : '');
}

/** The lines of `text` that match a BRE `pattern`, newlines kept. Throws on a bad pattern. */
export function grepText(text: string, pattern: string, ignoreCase = false): string {
  const re = breToRegExp(pattern, ignoreCase);
  return splitLines(text)
    .filter((line) => re.test(line.replace(/\n$/, '')))
    .join('');
}

/** Strip one pair of matching quotes the shell would have removed. */
export function unquote(arg: string): string {
  return arg.replace(/^(['"])(.*)\1$/, '$2');
}
