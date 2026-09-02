import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../lib/markdown';
import { toJsonLd } from '../lib/json-ld';

describe('parseMarkdown sanitization', () => {
  it('drops event handlers, scripts and dangerous tags from raw HTML', () => {
    const html = parseMarkdown(
      [
        '<img src="/a.png" onerror="alert(1)">',
        '<svg onload="alert(1)"><path d="M0 0"/></svg>',
        '<script>alert(1)</script>',
        '<base href="https://evil.example/">',
        '<meta http-equiv="refresh" content="0;url=https://evil.example">',
        '<form action="https://evil.example"><input name="pw"></form>',
        '<style>body{background:url(https://evil.example/x)}</style>',
        '<iframe src="https://evil.example"></iframe>',
      ].join('\n\n')
    );
    expect(html).not.toMatch(/onerror|onload|<script|<base|<meta|<form|<style|<iframe|evil\.example/i);
    expect(html).toContain('<img src="/a.png"');
  });

  it('neutralizes javascript: and data: links and images', () => {
    const html = parseMarkdown('[x](javascript:alert(1)) ![y](data:image/svg+xml,%3Csvg%3E) <a href="JAVASCRIPT:alert(2)">z</a>');
    expect(html).not.toMatch(/javascript:|data:/i);
  });

  it('keeps the interactive fence wrappers and heading anchors', () => {
    const html = parseMarkdown('## Hello World\n\n```chart\n{"type":"bar","rows":[{"label":"a","value":1}]}\n```');
    expect(html).toContain('<h2 id="h2-hello-world"');
    expect(html).toContain('data-heading-id="h2-hello-world"');
    expect(html).toMatch(/<div class="post-chart not-prose" data-chart="[^"]+"><\/div>/);
  });

  it('escapes markup mentioned in headings and slugs from the plain text', () => {
    const html = parseMarkdown('## The `<img src=x onerror=alert(1)>` element');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('id="h2-the-img-srcx-onerroralert1-element"');
  });

  it('adds rel=noopener to external links and leaves internal ones alone', () => {
    const html = parseMarkdown('[ext](https://example.com) [int](/posts/x)');
    expect(html).toMatch(/<a href="https:\/\/example.com"[^>]*rel="noopener noreferrer"/);
    expect(html).toMatch(/<a href="\/posts\/x">/);
  });
});

describe('toJsonLd', () => {
  it('cannot be broken out of with a closing script tag', () => {
    const out = toJsonLd({ name: 'x</script><img src=x onerror=alert(1)>', amp: 'a&b' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: 'x</script><img src=x onerror=alert(1)>', amp: 'a&b' });
  });
});
