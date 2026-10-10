import { describe, it, expect } from 'vitest';
import {
  GREP_MAX_PATTERN,
  breToRegExp,
  grepText,
  parseLineCount,
  splitLines,
  takeLines,
  unquote,
  wcCounts,
} from '@/lib/games/shell-text';

const APP_PY = '#!/usr/bin/env python3\n\nprint("Hello, Linux!")\n';
const PASSWD = 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:User:/home/user:/bin/bash\n';

describe('line handling', () => {
  it('keeps each line with its newline, and a last line without one', () => {
    expect(splitLines(APP_PY)).toEqual([
      '#!/usr/bin/env python3\n',
      '\n',
      'print("Hello, Linux!")\n',
    ]);
    expect(splitLines('a\nb')).toEqual(['a\n', 'b']);
    expect(splitLines('')).toEqual([]);
  });

  it('counts newline characters for wc -l, blank lines included', () => {
    expect(wcCounts(APP_PY)).toEqual({ lines: 3, words: 4, chars: 47 });
    expect(wcCounts('no newline').lines).toBe(0);
  });

  it('takes the first or last lines', () => {
    expect(takeLines(PASSWD, 1, false)).toBe('root:x:0:0:root:/root:/bin/bash\n');
    expect(takeLines(PASSWD, 1, true)).toBe('user:x:1000:1000:User:/home/user:/bin/bash\n');
    expect(takeLines(PASSWD, 5, false)).toBe(PASSWD);
    expect(takeLines(PASSWD, 0, true)).toBe('');
    expect(takeLines(PASSWD, 0, false)).toBe('');
  });
});

describe('head and tail counts', () => {
  it('reads -n N, -nN and -N', () => {
    expect(parseLineCount(['-n', '5', '/etc/passwd'])).toEqual({
      count: 5,
      operands: ['/etc/passwd'],
    });
    expect(parseLineCount(['-n5', '/etc/passwd'])).toEqual({ count: 5, operands: ['/etc/passwd'] });
    expect(parseLineCount(['-5', '/etc/passwd'])).toEqual({ count: 5, operands: ['/etc/passwd'] });
    expect(parseLineCount(['-n', '0'])).toEqual({ count: 0, operands: [] });
  });

  it('defaults to 10 lines', () => {
    expect(parseLineCount(['file.txt'])).toEqual({ count: 10, operands: ['file.txt'] });
  });

  it('reports a count that is not a number', () => {
    expect(parseLineCount(['-n', 'abc']).invalid).toBe('abc');
    expect(parseLineCount(['-n']).invalid).toBe('');
  });
});

describe('grep basic regular expressions', () => {
  const lines = (text: string) => text.split('\n').filter(Boolean);

  it('anchors with ^ and $', () => {
    expect(lines(grepText(PASSWD, '^root'))).toEqual(['root:x:0:0:root:/root:/bin/bash']);
    expect(grepText(PASSWD, '^bash')).toBe('');
    expect(lines(grepText(PASSWD, 'bash$'))).toHaveLength(2);
  });

  it('is case sensitive unless asked not to be', () => {
    expect(grepText(PASSWD, 'ROOT')).toBe('');
    expect(lines(grepText(PASSWD, 'ROOT', true))).toHaveLength(1);
  });

  it('supports . * and bracket expressions', () => {
    expect(lines(grepText(PASSWD, 'x:[0-9]*:0'))).toEqual(['root:x:0:0:root:/root:/bin/bash']);
    expect(lines(grepText(PASSWD, 'r..t:'))).toHaveLength(1);
    expect(lines(grepText(PASSWD, '[[:digit:]]\\{4\\}'))).toEqual([
      'user:x:1000:1000:User:/home/user:/bin/bash',
    ]);
    expect(lines(grepText('a]b\nab\n', '[]]'))).toEqual(['a]b']);
  });

  it('treats + ? | ( ) { } as literal unless escaped', () => {
    expect(lines(grepText('a+b\naab\n', 'a+b'))).toEqual(['a+b']);
    expect(lines(grepText('a+b\naab\n', 'a\\+b'))).toEqual(['aab']);
    expect(lines(grepText('cat\ndog\n(cat)\n', '(cat)'))).toEqual(['(cat)']);
    expect(lines(grepText('cat\ndog\nbird\n', 'cat\\|dog'))).toEqual(['cat', 'dog']);
    expect(lines(grepText('abab\nab\n', '\\(ab\\)\\{2\\}'))).toEqual(['abab']);
  });

  it('treats * at the start and an escaped dot as literal', () => {
    expect(lines(grepText('*star\nstar\n', '*star'))).toEqual(['*star']);
    expect(lines(grepText('readme.txt\nreadmeXtxt\n', 'readme\\.txt'))).toEqual(['readme.txt']);
    expect(lines(grepText('readme.txt\nreadmeXtxt\n', '.txt'))).toHaveLength(2);
  });

  it('rejects unbalanced patterns with grep style errors', () => {
    expect(() => breToRegExp('[abc')).toThrow(/Unmatched \[/);
    expect(() => breToRegExp('\\(abc')).toThrow(/Unmatched \( or \\\(/);
    expect(() => breToRegExp('abc\\)')).toThrow(/Unmatched \) or \\\)/);
  });

  it('refuses patterns that could backtrack for a very long time', () => {
    expect(() => breToRegExp('a'.repeat(GREP_MAX_PATTERN + 1))).toThrow(/not supported/);
    expect(() => breToRegExp('\\(a*\\)*b')).toThrow(/too complex/);
    expect(() => breToRegExp('\\(a\\|a\\)*b')).toThrow(/too complex/);
    expect(() => breToRegExp('\\(ab\\)*c')).not.toThrow();
  });
});

describe('unquote', () => {
  it('strips one pair of matching quotes', () => {
    expect(unquote('"^root"')).toBe('^root');
    expect(unquote("'^root'")).toBe('^root');
    expect(unquote('"mixed\'')).toBe('"mixed\'');
  });
});
