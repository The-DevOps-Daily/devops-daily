import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { insertStaticRedirects, isDynamicRedirect } from './redirects-order';

const rules = (text: string) =>
  text.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#'));

describe('public/_redirects', () => {
  const lines = rules(readFileSync('public/_redirects', 'utf8'));

  it('keeps every static redirect above the first dynamic one', () => {
    const firstDynamic = lines.findIndex(isDynamicRedirect);
    const staticAfter =
      firstDynamic === -1
        ? []
        : lines.slice(firstDynamic).filter((line) => !isDynamicRedirect(line));
    expect(staticAfter).toEqual([]);
  });

  it('stays inside the Cloudflare limits', () => {
    expect(lines.filter(isDynamicRedirect).length).toBeLessThanOrEqual(100);
    expect(lines.filter((line) => !isDynamicRedirect(line)).length).toBeLessThanOrEqual(2000);
  });

  it('never redirects to a path that another rule redirects again', () => {
    const sources = lines.map((line) => {
      const source = line.trim().split(/\s+/)[0];
      const pattern = source
        .split(/(\*|:[A-Za-z]\w*)/)
        .map((part) =>
          part === '*'
            ? '.*'
            : part.startsWith(':')
              ? '[^/]+'
              : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        )
        .join('');
      return { source, regex: new RegExp(`^${pattern}$`) };
    });
    const chains = lines.flatMap((line) => {
      const target = line.trim().split(/\s+/)[1];
      if (!target.startsWith('/') || target.includes(':')) return [];
      const path = target.split(/[?#]/)[0];
      return sources
        .filter(({ regex }) => regex.test(path))
        .map(({ source }) => `${line.trim()} -> ${source}`);
    });
    expect(chains).toEqual([]);
  });
});

describe('insertStaticRedirects', () => {
  it('puts new static lines above the dynamic block and its comment', () => {
    const current = ['/a /b 301', '', '# Dynamic', '/c/* /d/:splat 301', ''].join('\n');
    const result = insertStaticRedirects(current, ['/x.png /x.jpg 301']);
    expect(result).toBe(
      ['/a /b 301', '/x.png /x.jpg 301', '', '# Dynamic', '/c/* /d/:splat 301', ''].join('\n')
    );
  });

  it('appends when the file has no dynamic redirect', () => {
    expect(insertStaticRedirects('/a /b 301\n', ['/x /y 301'])).toBe('/a /b 301\n/x /y 301\n');
  });
});
