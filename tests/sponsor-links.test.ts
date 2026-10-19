import { describe, expect, it } from 'vitest';
import { sponsorHistory, sponsorHref, sponsorRel, sponsors } from '@/lib/sponsors';

describe('sponsor links', () => {
  it('links our own products direct and without rel="sponsored", so they count for search', () => {
    const own = [...sponsors, ...sponsorHistory].filter((s) => s.ownProduct);
    expect(new Set(own.map((s) => s.name))).toEqual(new Set(['SMTPfast', 'DevDojo', 'QuizAPI']));
    for (const s of own) {
      expect(sponsorHref(s, 'sidebar')).toBe(s.url);
      expect(sponsorRel(s)).not.toContain('sponsored');
    }
  });

  it('keeps click tracking and rel="sponsored" on paid sponsors', () => {
    const paid = sponsors.filter((s) => s.goSlug && !s.ownProduct);
    expect(paid.length).toBeGreaterThan(0);
    for (const s of paid) {
      expect(sponsorHref(s, 'sidebar')).toMatch(/^https:\/\/go\.devops-daily\.com\//);
      expect(sponsorRel(s)).toContain('sponsored');
    }
  });
});
