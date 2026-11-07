import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameSponsors } from '@/components/games/game-sponsors';
import { HomeSponsors } from '@/components/home-sponsors';
import { InlineSponsors } from '@/components/inline-sponsors';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import SponsorshipPage from '@/app/sponsorship/page';
import { sponsorHistory, sponsorHref, sponsorRel, sponsors } from '@/lib/sponsors';

function sponsorAnchors(html: string) {
  return [...html.matchAll(/<a\s([^>]*)>/g)]
    .map(([, attrs]) =>
      Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]))
    )
    .filter((a) => a.rel?.startsWith('noopener'));
}

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

  const placements: [string, ComponentType<never>, object, typeof sponsors][] = [
    ['sidebar', SponsorSidebar, {}, sponsors],
    ['inline', InlineSponsors, { variant: 'full' }, sponsors],
    ['inline', InlineSponsors, { variant: 'compact' }, sponsors],
    ['inline', InlineSponsors, { variant: 'banner' }, sponsors],
    ['simulator', GameSponsors, {}, sponsors],
    ['inline', GameSponsors, { placement: 'inline' }, sponsors],
    ['home', HomeSponsors, {}, sponsors],
    ['sponsorship', SponsorshipPage, {}, sponsorHistory as typeof sponsors],
  ];

  it.each(placements)(
    'marks own products in the %s placement with data-go and keeps their direct link',
    (placement, component, props, listed) => {
      const anchors = sponsorAnchors(
        renderToStaticMarkup(createElement(component, props as never))
      );
      for (const s of listed.filter((s) => s.goSlug)) {
        const a = anchors.find(
          (a) => a.href === sponsorHref(s, placement).replaceAll('&', '&amp;')
        );
        expect(a, s.name).toBeDefined();
        if (s.ownProduct) {
          expect(a).toMatchObject({
            href: s.url,
            rel: 'noopener',
            'data-go': `${placement}:${s.goSlug}`,
          });
        } else {
          expect(a?.href).toBe(`https://go.devops-daily.com/${s.goSlug}?p=${placement}`);
          expect(a?.['data-go']).toBeUndefined();
        }
      }
    }
  );
});
