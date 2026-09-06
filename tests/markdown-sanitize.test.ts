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
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toMatch(/<div class="post-chart not-prose" data-chart="[^"]+"><\/div>/);
  });

  it('escapes markup mentioned in headings and slugs from the plain text', () => {
    const html = parseMarkdown('## The `<img src=x onerror=alert(1)>` element');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('id="h2-the-img-srcx-onerroralert1-element"');
  });

  it('never gives a duplicate heading the id a later heading has on its own', () => {
    const html = parseMarkdown('## Example\n\n## Example\n\n## Example 1\n');
    const ids = [...html.matchAll(/<h2[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(['h2-example', 'h2-example-2', 'h2-example-1']);
  });

  it('reserves headings nested in blockquotes and lists too', () => {
    const html = parseMarkdown('## Example\n\n## Example\n\n> ## Example 1\n');
    const ids = [...html.matchAll(/<h2[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(['h2-example', 'h2-example-2', 'h2-example-1']);
  });

  it('treats a fence language named after an Object.prototype member as a plain code block', () => {
    expect(() => parseMarkdown('```constructor\nfoo\n```\n')).not.toThrow();
    const html = parseMarkdown('```toString\nfoo\n```\n');
    expect(html).toContain('language-toString');
    expect(html).not.toContain('data-terminal');
  });

  it('gives repeated headings distinct ids and resets between documents', () => {
    const html = parseMarkdown('### Example Output\n\none\n\n### Example Output\n\ntwo\n\n## Example Output');
    expect(html).toContain('id="h3-example-output"');
    expect(html).toContain('id="h3-example-output-1"');
    expect(html).toContain('href="#h3-example-output-1"');
    expect(html).toContain('data-heading-id="h3-example-output-1"');
    expect(html).toContain('id="h2-example-output"');

    const again = parseMarkdown('### Example Output');
    expect(again).toContain('id="h3-example-output"');
    expect(again).not.toContain('h3-example-output-1');
  });

  it('adds rel=noopener to external links and leaves internal ones alone', () => {
    const html = parseMarkdown('[ext](https://example.com) [int](/posts/x)');
    expect(html).toMatch(/<a href="https:\/\/example.com"[^>]*rel="noopener noreferrer"/);
    expect(html).toMatch(/<a href="\/posts\/x">/);
  });
});

describe('parseMarkdown callouts', () => {
  it('keeps the callout icon SVG intact', () => {
    const html = parseMarkdown(':::warning\nCareful.\n:::');
    expect(html).toContain('post-callout--warning');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('<path d=');
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
