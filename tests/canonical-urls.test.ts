/// <reference types="vite/client" />
import { readFileSync } from 'node:fs';
import type { Metadata } from 'next';
import { resolveAlternates } from 'next/dist/lib/metadata/resolvers/resolve-basics';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import nextConfig from '../next.config.mjs';
import { isDynamicRedirect } from '../scripts/redirects-order';

// Every app route's metadata is resolved the way Next.js does it: the layouts
// and the page are merged shallowly, so a page without its own `alternates`
// inherits the root layout's canonical ('/') and tells search engines it is a
// copy of the homepage. No build runs; the test calls the generators and
// resolves each URL with Next's own resolver.

vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'font-inter', variable: '--font-inter' }),
}));
// The embed page's metadata only needs lib/games; skip loading every game.
vi.mock('@/components/games/game-component-registry', () => ({
  getGameComponent: () => null,
}));

const SITE = 'https://devops-daily.com';

type Params = Record<string, string>;
interface RouteModule {
  metadata?: Metadata;
  generateMetadata?: (props: {
    params: Promise<Params>;
    searchParams: Promise<Params>;
  }) => Metadata | Promise<Metadata>;
  generateStaticParams?: () => Params[] | Promise<Params[]>;
}

// Pages whose canonical points somewhere else on purpose.
const INTENDED_TARGETS: Record<string, (params: Params) => string> = {
  '/interview-questions/practice': () => '/interview-questions',
  '/games/[slug]/embed': ({ slug }) => `/games/${slug}`,
  '/roadmaps/[slug]': ({ slug }) => `/roadmap/${slug}`,
};

const modules = import.meta.glob<RouteModule>('../app/**/{page,layout}.tsx');

interface Resolved {
  route: string;
  path: string;
  params: Params;
  canonical: string | null;
}

function routeOf(file: string): string {
  const dir = file.replace(/^\.\.\/app/, '').replace(/\/(page|layout)\.tsx$/, '');
  return dir === '' ? '/' : dir;
}

function fillRoute(route: string, params: Params): string {
  return route.replace(/\[([^\]]+)\]/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`${route}: no value for [${name}]`);
    return value;
  });
}

async function metadataOf(mod: RouteModule, params: Params): Promise<Metadata | undefined> {
  if (mod.generateMetadata) {
    return mod.generateMetadata({
      params: Promise.resolve(params),
      searchParams: Promise.resolve({}),
    });
  }
  return mod.metadata;
}

// Shallow merge, as Next.js does: the last segment that sets `alternates` wins
// as a whole (so `alternates: { types }` without a canonical drops it), and each
// segment resolves its URLs against the metadataBase in effect at that segment.
async function canonicalOf(chain: (Metadata | undefined)[], pathname: string) {
  let base: URL | null = null;
  let canonical: string | null = null;
  for (const metadata of chain) {
    if (!metadata) continue;
    if (metadata.metadataBase !== undefined) {
      base = metadata.metadataBase === null ? null : new URL(String(metadata.metadataBase));
    }
    if ('alternates' in metadata) {
      const alternates = await resolveAlternates(
        metadata.alternates,
        base,
        Promise.resolve(pathname),
        { trailingSlash: Boolean(nextConfig.trailingSlash), isStaticMetadataRouteFile: false }
      );
      canonical = alternates?.canonical ? String(alternates.canonical.url) : null;
    }
  }
  return canonical;
}

const sameUrl = (a: string, b: string) => new URL(a, SITE).href === new URL(b, SITE).href;

const pageFiles = Object.keys(modules)
  .filter((file) => file.endsWith('/page.tsx'))
  .sort();

let resolved: Resolved[] = [];
let metadataBase: URL;

beforeAll(async () => {
  const root = await modules['../app/layout.tsx']();
  metadataBase = root.metadata?.metadataBase as URL;

  const results = await Promise.all(
    pageFiles.map(async (file) => {
      const route = routeOf(file);
      const page = await modules[file]();
      const layoutFiles = ['../app/layout.tsx'];
      const segments = route.split('/').filter(Boolean);
      for (let i = 1; i <= segments.length; i++) {
        const layout = `../app/${segments.slice(0, i).join('/')}/layout.tsx`;
        if (modules[layout]) layoutFiles.push(layout);
      }
      const layouts = await Promise.all(layoutFiles.map((layout) => modules[layout]()));

      const paramSets = route.includes('[') ? await page.generateStaticParams!() : [{}];
      return Promise.all(
        paramSets.map(async (params) => {
          const chain = await Promise.all([...layouts, page].map((mod) => metadataOf(mod, params)));
          const path = fillRoute(route, params);
          return { route, path, params, canonical: await canonicalOf(chain, path) };
        })
      );
    })
  );
  resolved = results.flat();
}, 120_000);

function redirectSources(): { pattern: string; dynamic: boolean }[] {
  return readFileSync('public/_redirects', 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => ({ pattern: line.trim().split(/\s+/)[0], dynamic: isDynamicRedirect(line) }));
}

function matchesRedirect(path: string, source: { pattern: string; dynamic: boolean }): boolean {
  if (!source.dynamic) return path === source.pattern;
  const regex = source.pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) =>
      part === '*'
        ? '.*'
        : part.startsWith(':')
          ? '[^/]+'
          : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('');
  return new RegExp(`^${regex}$`).test(path);
}

describe('canonical URLs', () => {
  it('resolves against the production origin', () => {
    expect(metadataBase.href).toBe(`${SITE}/`);
  });

  it('covers every content type that has a detail page', () => {
    const routes = new Set(resolved.map((entry) => entry.route));
    for (const route of [
      '/posts/[slug]',
      '/guides/[slug]',
      '/guides/[slug]/[part]',
      '/comparisons/[slug]',
      '/news/[slug]',
      '/quizzes/[slug]',
      '/exercises/[id]',
      '/checklists/[slug]',
      '/flashcards/[id]',
      '/interview-questions/[tier]/[slug]',
      '/games/dns-simulator',
      '/challenges/[slug]',
    ]) {
      expect(routes, route).toContain(route);
      expect(resolved.filter((entry) => entry.route === route).length, route).toBeGreaterThan(0);
    }
  });

  it('sets a canonical on every page instead of inheriting the homepage', () => {
    const missing = resolved
      .filter(
        (entry) => entry.canonical === null || (entry.path !== '/' && sameUrl(entry.canonical, '/'))
      )
      .map((entry) => `${entry.path} -> ${entry.canonical}`);
    expect(missing).toEqual([]);
  });

  it('uses absolute https://devops-daily.com URLs with no query, hash or trailing slash', () => {
    const bad = resolved
      .filter((entry) => entry.canonical !== null)
      .filter((entry) => {
        const url = new URL(entry.canonical!);
        return (
          url.origin !== SITE ||
          url.search !== '' ||
          url.hash !== '' ||
          (url.pathname !== '/' && url.pathname.endsWith('/')) ||
          url.pathname.includes('//')
        );
      })
      .map((entry) => `${entry.path} -> ${entry.canonical}`);
    expect(bad).toEqual([]);
  });

  it('points each page at itself or at its intended target', () => {
    const wrong = resolved
      .filter((entry) => entry.canonical !== null)
      .filter((entry) => {
        const intended = INTENDED_TARGETS[entry.route]?.(entry.params) ?? entry.path;
        return !sameUrl(entry.canonical!, intended);
      })
      .map((entry) => `${entry.path} -> ${entry.canonical}`);
    expect(wrong).toEqual([]);
  });

  it('sends intended targets to a page that is canonical to itself', () => {
    const selfCanonical = new Set(
      resolved
        .filter((entry) => entry.canonical !== null && sameUrl(entry.canonical, entry.path))
        .map((entry) => new URL(entry.canonical!).href)
    );
    const dangling = resolved
      .filter((entry) => entry.route in INTENDED_TARGETS && entry.canonical !== null)
      .filter((entry) => !selfCanonical.has(new URL(entry.canonical!).href))
      .map((entry) => `${entry.path} -> ${entry.canonical}`);
    expect(dangling).toEqual([]);
  });

  it('never points at a path that public/_redirects sends somewhere else', () => {
    const sources = redirectSources();
    const redirected = resolved
      .filter((entry) => entry.canonical !== null)
      .flatMap((entry) => {
        const path = new URL(entry.canonical!).pathname;
        return sources
          .filter((source) => matchesRedirect(path, source))
          .map((source) => `${entry.path} -> ${path} (matches ${source.pattern})`);
      });
    expect(redirected).toEqual([]);
  });

  it('lists only self-canonical pages in the sitemap', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const byPath = new Map(resolved.map((entry) => [entry.path, entry]));
    const problems = (await sitemap()).flatMap(({ url }) => {
      const parsed = new URL(url);
      const entry = byPath.get(parsed.pathname);
      if (parsed.origin !== SITE) return [`${url}: wrong origin`];
      if (!entry) return [`${url}: no page renders this path`];
      if (entry.canonical === null || !sameUrl(entry.canonical, url)) {
        return [`${url}: canonical is ${entry.canonical}`];
      }
      return [];
    });
    expect(problems).toEqual([]);
  });
});

describe('matchesRedirect', () => {
  it('matches static sources exactly and dynamic sources by pattern', () => {
    expect(matchesRedirect('/authors', { pattern: '/authors', dynamic: false })).toBe(true);
    expect(matchesRedirect('/authors/x', { pattern: '/authors', dynamic: false })).toBe(false);
    expect(matchesRedirect('/authors/x', { pattern: '/authors/*', dynamic: true })).toBe(true);
    expect(matchesRedirect('/a/b/c', { pattern: '/a/:id/c', dynamic: true })).toBe(true);
    expect(matchesRedirect('/a/b/d', { pattern: '/a/:id/c', dynamic: true })).toBe(false);
    expect(matchesRedirect('/games/dns', { pattern: '/games/:slug1', dynamic: true })).toBe(true);
  });
});
