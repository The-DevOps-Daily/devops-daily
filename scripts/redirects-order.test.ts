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
