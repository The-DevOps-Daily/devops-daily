import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '@/lib/markdown';
import { parseChartSpec, formatValue, median, percentile } from '@/lib/post-charts';

const BAR_SPEC = {
  type: 'bar',
  title: 'Query latency',
  unit: 'ms',
  tickLabel: 'p95',
  rows: [
    { label: 'Neon pooler', value: 25.1, tick: 36, series: 'Neon' },
    { label: 'Supabase session', value: 29, tick: 37.2, series: 'Supabase' },
  ],
};

describe('post chart embeds', () => {
  it('turns a chart fence into a placeholder div', () => {
    const md = '# Title\n\n```chart\n' + JSON.stringify(BAR_SPEC, null, 2) + '\n```\n';
    const html = parseMarkdown(md);
    expect(html).toContain('class="post-chart not-prose"');
    expect(html).toContain('data-chart="');
    expect(html).not.toContain('<pre><code class="hljs language-chart">');
  });

  it('round-trips the spec through the data attribute', () => {
    const md = '```chart\n' + JSON.stringify(BAR_SPEC) + '\n```';
    const html = parseMarkdown(md);
    const match = html.match(/data-chart="([^"]+)"/);
    expect(match).toBeTruthy();
    const decoded = match![1]
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    const spec = parseChartSpec(decoded);
    expect(spec?.type).toBe('bar');
    expect(spec?.rows).toHaveLength(2);
    expect(spec?.rows?.[0].value).toBe(25.1);
  });

  it('renders malformed chart JSON as a visible code block instead of a blank hole', () => {
    const html = parseMarkdown('```chart\n{ not json\n```');
    expect(html).not.toContain('post-chart');
    expect(html).toContain('language-chart');
    expect(html).toContain('{ not json');
  });

  it('leaves other code fences untouched', () => {
    const html = parseMarkdown('```bash\necho hi\n```');
    expect(html).toContain('language-bash');
    expect(html).not.toContain('post-chart');
  });

  it('rejects specs without a known shape', () => {
    expect(parseChartSpec('{"type":"bar"}')).toBeNull();
    expect(parseChartSpec('{"type":"pie","rows":[{"label":"a","value":1}]}')).toBeNull();
    expect(parseChartSpec('"just a string"')).toBeNull();
    expect(parseChartSpec('{"type":"dots","series":[{"name":"a","samples":[1,2]}]}')).not.toBeNull();
  });

  it('formats values by unit', () => {
    expect(formatValue(25.14, 'ms')).toBe('25.1ms');
    expect(formatValue(2176, 'ms')).toBe('2.18s');
    expect(formatValue(13558, 'ms')).toBe('13.6s');
    expect(formatValue(42, '%')).toBe('42%');
  });


  it('accepts cdf specs and renders the fence placeholder', () => {
    const spec = {
      type: 'cdf',
      title: 'Latency percentiles',
      unit: 'ms',
      series: [
        { name: 'Neon pooler', samples: [21, 24, 25, 26, 36] },
        { name: 'Supabase session', dash: '6 5', samples: [24, 28, 29, 30, 37] },
      ],
    };
    expect(parseChartSpec(JSON.stringify(spec))?.type).toBe('cdf');
    const html = parseMarkdown('```chart\n' + JSON.stringify(spec) + '\n```');
    expect(html).toContain('post-chart');
  });

  it('computes percentiles', () => {
    const xs = [...Array(100).keys()].map((i) => i + 1);
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(95);
    expect(percentile([5], 95)).toBe(5);
  });

  it('computes medians', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
