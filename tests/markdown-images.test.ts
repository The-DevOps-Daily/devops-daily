import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '@/lib/markdown';

describe('Markdown images', () => {
  it('maps previewable public-directory paths to their served URL', () => {
    const html = parseMarkdown('![Architecture](../../public/images/posts/example/diagram.svg)');

    expect(html).toContain('src="/images/posts/example/diagram.svg"');
  });

  it('leaves existing web image URLs unchanged', () => {
    const html = parseMarkdown('![Architecture](/images/posts/example/diagram.svg)');

    expect(html).toContain('src="/images/posts/example/diagram.svg"');
  });
});
