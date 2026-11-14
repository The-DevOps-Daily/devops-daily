import { describe, expect, it } from 'vitest';
import {
  samplePages,
  sponsoredPostPages,
  sponsoredSlice,
  type LiveCheckPage,
} from '../scripts/live-check/pick-pages';

describe('live check page picker', () => {
  const urls = Array.from({ length: 100 }, (_, index) => `https://devops-daily.com/posts/${index}`);

  it('picks the same sample for the same seed', () => {
    expect(samplePages(urls, 10, 42)).toEqual(samplePages(urls, 10, 42));
  });

  it('picks different samples for different seeds', () => {
    expect(samplePages(urls, 10, 42)).not.toEqual(samplePages(urls, 10, 99));
  });

  it('excludes house campaigns and future sponsored posts', () => {
    const pages: LiveCheckPage[] = sponsoredPostPages(
      [
        { slug: 'paid', sponsorCampaign: 'neon', publishedAt: '2026-01-01T00:00:00Z' },
        { slug: 'house', sponsorCampaign: 'house', publishedAt: '2026-01-01T00:00:00Z' },
        { slug: 'future', sponsorCampaign: 'digitalocean', publishedAt: '2027-01-01T00:00:00Z' },
      ],
      new Date('2026-11-11T00:00:00Z')
    );

    expect(pages).toEqual([
      {
        url: 'https://devops-daily.com/posts/paid',
        kind: 'sponsored',
        sponsor: 'neon',
        needsDisclosure: false,
      },
    ]);
  });

  it('checks every sponsored page once a day across the four 6-hour slots', () => {
    const pages: LiveCheckPage[] = Array.from({ length: 10 }, (_, index) => ({
      url: `https://devops-daily.com/posts/p${index}`,
      kind: 'sponsored',
    }));
    const seen = [0, 6, 12, 18].flatMap((hour) =>
      sponsoredSlice(pages, new Date(Date.UTC(2026, 10, 11, hour))).map((page) => page.url)
    );
    expect(seen.sort()).toEqual(pages.map((page) => page.url).sort());
    expect(sponsoredSlice(pages, new Date(), true)).toHaveLength(10);
  });

  it('marks posts with tracked or affiliate links as needing the disclosure', () => {
    const [page] = sponsoredPostPages(
      [
        {
          slug: 'linked',
          sponsorCampaign: 'neon',
          content: 'Try [it](https://go.devops-daily.com/neon-x)',
        },
      ],
      new Date('2026-11-11T00:00:00Z')
    );
    expect(page.needsDisclosure).toBe(true);
  });
});
