import { describe, expect, it } from 'vitest';
import { sponsorHistory, sponsorHref, sponsorRel, sponsors } from '@/lib/sponsors';

describe('sponsor links', () => {
  it('links our own products direct and without rel="sponsored", so they count for search', () => {
    for (const s of [...sponsors, ...sponsorHistory].filter((s) => s.name === 'SMTPfast')) {
      expect(sponsorHref(s, 'sidebar')).toBe('https://smtpfa.st');
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
