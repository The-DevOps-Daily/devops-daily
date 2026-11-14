import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasAffiliateLinks } from '../../lib/affiliate-links';
import { parseFrontMatter } from '../../lib/front-matter';

const SITE_ORIGIN = 'https://devops-daily.com';
const DEFAULT_SAMPLE_SIZE = 40;

export type LiveCheckPage = {
  url: string;
  kind: 'sponsored' | 'random';
  sponsor?: string;
  /** The page should show the affiliate disclosure banner. */
  needsDisclosure?: boolean;
};

/** Runs every 6 hours, so 4 slots cover every sponsored page once a day. */
const SPONSORED_SLOTS = 4;

export type LiveCheckPages = {
  seed: number;
  generatedAt: string;
  pages: LiveCheckPage[];
};

type PostFrontMatter = {
  content?: string;
  draft?: boolean;
  published?: boolean;
  publishedAt?: string;
  sponsorCampaign?: string;
};

type Comparison = {
  slug: string;
  sponsorCampaign?: string;
};

export function seedFrom(value: string): number {
  if (/^\d+$/.test(value)) return Number(BigInt(value) & BigInt(0xffffffff));

  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function samplePages(urls: string[], count: number, seed: number): string[] {
  const shuffled = [...urls].sort();
  const random = mulberry32(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }

  return shuffled.slice(0, count);
}

export function isLiveSponsoredPost(post: PostFrontMatter, now: Date): boolean {
  if (
    !post.sponsorCampaign ||
    post.sponsorCampaign === 'house' ||
    post.draft ||
    post.published === false
  ) {
    return false;
  }
  if (!post.publishedAt) return true;

  const publishedAt = Date.parse(post.publishedAt);
  return Number.isNaN(publishedAt) || publishedAt <= now.getTime();
}

export function sponsoredPostPages(
  posts: Array<PostFrontMatter & { slug: string }>,
  now: Date
): LiveCheckPage[] {
  return posts
    .filter((post) => isLiveSponsoredPost(post, now))
    .map((post) => ({
      url: `${SITE_ORIGIN}/posts/${post.slug}`,
      kind: 'sponsored' as const,
      sponsor: post.sponsorCampaign,
      needsDisclosure: hasAffiliateLinks(post.content ?? ''),
    }));
}

export function sponsoredComparisonPages(comparisons: Comparison[]): LiveCheckPage[] {
  return comparisons
    .filter((comparison) => comparison.sponsorCampaign && comparison.sponsorCampaign !== 'house')
    .map((comparison) => ({
      url: `${SITE_ORIGIN}/comparisons/${comparison.slug}`,
      kind: 'sponsored' as const,
      sponsor: comparison.sponsorCampaign,
    }));
}

export function sitemapUrls(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) =>
    match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  );

  return [...new Set(urls)].filter((url) => {
    try {
      return new URL(url).origin === SITE_ORIGIN;
    } catch {
      return false;
    }
  });
}

function readSampleSize(value: string | undefined): number {
  if (!value) return DEFAULT_SAMPLE_SIZE;
  const sampleSize = Number(value);
  if (!Number.isInteger(sampleSize) || sampleSize < 0) {
    throw new Error('LIVE_CHECK_SAMPLE must be a non-negative integer');
  }
  return sampleSize;
}

async function readSponsoredPages(now: Date): Promise<LiveCheckPage[]> {
  const postsDirectory = path.join(process.cwd(), 'content', 'posts');
  const postFiles = (await fs.readdir(postsDirectory)).filter((file) => file.endsWith('.md'));
  const posts = await Promise.all(
    postFiles.map(async (file) => {
      const source = await fs.readFile(path.join(postsDirectory, file), 'utf8');
      const parsed = parseFrontMatter(source);
      return {
        ...(parsed.data as PostFrontMatter),
        content: parsed.content,
        slug: file.slice(0, -'.md'.length),
      };
    })
  );

  const comparisonsDirectory = path.join(process.cwd(), 'content', 'comparisons');
  const comparisonFiles = (await fs.readdir(comparisonsDirectory)).filter((file) =>
    file.endsWith('.json')
  );
  const comparisons = await Promise.all(
    comparisonFiles.map(async (file) => {
      const source = await fs.readFile(path.join(comparisonsDirectory, file), 'utf8');
      return JSON.parse(source) as Comparison;
    })
  );

  return [...sponsoredPostPages(posts, now), ...sponsoredComparisonPages(comparisons)].sort(
    (a, b) => a.url.localeCompare(b.url)
  );
}

/**
 * The sponsored pages for this run: one of SPONSORED_SLOTS slices, chosen by the
 * UTC hour, so each page is checked once a day. LIVE_CHECK_ALL_SPONSORED=1 checks all.
 */
export function sponsoredSlice(pages: LiveCheckPage[], now: Date, all = false): LiveCheckPage[] {
  if (all) return pages;
  const slot = Math.floor(now.getUTCHours() / (24 / SPONSORED_SLOTS)) % SPONSORED_SLOTS;
  return pages.filter((_, index) => index % SPONSORED_SLOTS === slot);
}

export async function buildPageList(
  options: {
    now?: Date;
    seed?: number;
    sampleSize?: number;
    fetchSitemap?: () => Promise<string>;
  } = {}
): Promise<LiveCheckPages> {
  const now = options.now ?? new Date();
  const seed = options.seed ?? seedFrom(process.env.LIVE_CHECK_SEED || String(now.getTime()));
  const sampleSize = options.sampleSize ?? readSampleSize(process.env.LIVE_CHECK_SAMPLE);
  const allSponsoredPages = await readSponsoredPages(now);
  const sponsoredPages = sponsoredSlice(
    allSponsoredPages,
    now,
    process.env.LIVE_CHECK_ALL_SPONSORED === '1'
  );
  const fetchSitemap =
    options.fetchSitemap ??
    (async () => {
      const response = await fetch(`${SITE_ORIGIN}/sitemap.xml`);
      if (!response.ok) throw new Error(`Could not fetch sitemap: ${response.status}`);
      return response.text();
    });
  // Every sponsored page stays out of the random sample, checked this run or not.
  const sponsoredUrls = new Set(allSponsoredPages.map((page) => page.url.replace(/\/$/, '')));
  const randomUrls = samplePages(
    sitemapUrls(await fetchSitemap()).filter((url) => !sponsoredUrls.has(url.replace(/\/$/, ''))),
    sampleSize,
    seed
  );

  return {
    seed,
    generatedAt: now.toISOString(),
    pages: [...sponsoredPages, ...randomUrls.map((url) => ({ url, kind: 'random' as const }))],
  };
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('Usage: npx tsx scripts/live-check/pick-pages.ts <output.json>');

  const pages = await buildPageList();
  const resolvedOutputPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, `${JSON.stringify(pages, null, 2)}\n`);
  console.log(
    `Live check seed ${pages.seed}: ${pages.pages.length} pages (${pages.pages.filter((page) => page.kind === 'sponsored').length} sponsored) written to ${resolvedOutputPath}`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
