import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { buildContentCoverSvg, CONTENT_COVER_TYPES, layoutContentCoverTitle } from '../og-utils';

function expectTitleInsideBounds(title: string, category = 'DevOps'): void {
  const layout = layoutContentCoverTitle(title, category);
  const svg = buildContentCoverSvg({ type: 'post', title, category }).replace(
    /(<text data-cover-title-line="true"[^>]*fill=")#[^"]+("[^>]*>)/g,
    '$1#ff00ff$2'
  );
  const image = new Resvg(svg).render();
  const pixels = image.pixels;

  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
    const baseline = layout.titleY + lineIndex * layout.lineHeight;
    const top = Math.max(0, Math.floor(baseline - layout.fontSize * 1.15));
    const bottom = Math.min(image.height - 1, Math.ceil(baseline + 8));
    let minX = image.width;
    let maxX = -1;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const index = (y * image.width + x) * 4;
        if (pixels[index] > 140 && pixels[index + 2] > 140 && pixels[index + 1] < 110) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }
    expect(maxX).toBeGreaterThanOrEqual(minX);
    expect(maxX - minX + 1).toBeLessThanOrEqual(layout.maxWidth + 2);
    expect(maxX).toBeLessThanOrEqual(80 + layout.maxWidth + 2);
  }
}

describe('content cover renderer', () => {
  it.each(CONTENT_COVER_TYPES)('renders a valid 1200x630 %s cover', (type) => {
    const svg = buildContentCoverSvg({
      type,
      title: 'A Practical Guide to Safe Production Deployments',
      category: 'Infrastructure & Delivery',
    });
    const image = new Resvg(svg).render();

    expect(image.width).toBe(1200);
    expect(image.height).toBe(630);
    expect([...image.asPng().subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(svg).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('escapes XML-sensitive content and retains the full title', () => {
    const svg = buildContentCoverSvg({
      type: 'quiz',
      title: 'TLS & Zero-Downtime: “Blue < Green” Deployments',
      category: 'Security & Networking',
    });

    expect(() => new Resvg(svg).render()).not.toThrow();
    expect(svg).toContain('TLS &amp; Zero-Downtime');
    expect(svg).toContain('Blue &lt; Green');
    expect(svg).not.toContain('...');
  });

  it('uses a distinct purpose label and motif for every content type', () => {
    const expectedSections = {
      post: 'ARTICLE / INSIGHT',
      guide: 'GUIDE / PATH',
      exercise: 'EXERCISE / LAB',
      news: 'NEWS / DIGEST',
      advent: 'ADVENT / DAY',
      quiz: 'QUIZ / CHALLENGE',
      game: 'GAME / SIMULATOR',
      checklist: 'CHECKLIST / PROGRESS',
      interview: 'INTERVIEW / PREP',
      comparison: 'COMPARE / DECIDE',
      flashcard: 'FLASHCARDS / RECALL',
      tool: 'TOOL / UTILITY',
    } as const;

    for (const type of CONTENT_COVER_TYPES) {
      const svg = buildContentCoverSvg({
        type,
        title: 'Safe Production Deployments',
        category: 'DevOps',
      });

      expect(svg).toContain(`data-cover-motif="${type}"`);
      expect(svg).toContain(expectedSections[type]);
    }
  });

  it('preserves explicit section label overrides', () => {
    const svg = buildContentCoverSvg({
      type: 'exercise',
      title: 'Safe Production Deployments',
      category: 'DevOps',
      sectionLabel: 'CUSTOM / LABEL',
    });

    expect(svg).toContain('CUSTOM / LABEL');
    expect(svg).not.toContain('EXERCISE / LAB');
  });

  it('keeps the longest current-style title inside the rendered title area', () => {
    expectTitleInsideBounds(
      'When the Malicious Hook Is in the Other Manifest: 700+ Repos, 8 Packagist Packages, One package.json Trick'
    );
  });

  it('splits a pathological unbroken token without truncating it', () => {
    const title = `Decode ${'VeryLongUnbrokenIdentifier'.repeat(5)}`;
    const layout = layoutContentCoverTitle(title, 'Developer Utilities');

    expect(layout.lines).toHaveLength(4);
    expect(layout.lines.join('')).not.toContain('…');
    expectTitleInsideBounds(title, 'Developer Utilities');
  });

  it('rejects empty and implausibly long titles before writing a cover', () => {
    expect(() => buildContentCoverSvg({ type: 'post', title: '', category: 'DevOps' })).toThrow(
      'cannot be empty'
    );
    expect(() =>
      buildContentCoverSvg({ type: 'guide', title: 'A '.repeat(180), category: 'Guide' })
    ).toThrow('cannot fit without truncation');
  });
});
