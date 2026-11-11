/**
 * Replay: LIVE_CHECK_SEED=123 npx tsx scripts/live-check/pick-pages.ts /tmp/pages.json
 * then LIVE_CHECK_PAGES=/tmp/pages.json pnpm test:live
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test';

type LiveCheckPage = {
  url: string;
  kind: 'sponsored' | 'random';
  sponsor?: string;
  needsDisclosure?: boolean;
};

type LiveCheckPages = { pages: LiveCheckPage[] };

const siteOrigin = 'https://devops-daily.com';
const pagesPath = process.env.LIVE_CHECK_PAGES;

if (!pagesPath) {
  throw new Error('LIVE_CHECK_PAGES must point to the page list created by pick-pages.ts');
}

const pageList = JSON.parse(fs.readFileSync(path.resolve(pagesPath), 'utf8')) as LiveCheckPages;

if (!Array.isArray(pageList.pages) || pageList.pages.length === 0) {
  throw new Error('LIVE_CHECK_PAGES must contain at least one page');
}

// These messages come from third-party tags that may be blocked by browser or network policy.
const ignoredConsoleErrors = [
  /googlesyndication\.com/i,
  /doubleclick\.net/i,
  /carbonads\.(com|net)/i,
  /buysellads\.com/i,
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /cloudflareinsights\.com/i,
  /go\.devops-daily\.com/i,
  // Repo cards call GitHub's API without a token; shared runner IPs hit its rate limit.
  /api\.github\.com/i,
  // The newsletter form's Turnstile widget logs noise when it challenges datacenter IPs.
  /challenges\.cloudflare\.com/i,
];

// Analytics, ads and our sponsor beacon are blocked so these checks never count
// as page views, ad impressions or sponsor views.
const blockedHosts =
  /(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|googlesyndication\.com|cloudflareinsights\.com|carbonads\.com|carbonads\.net|buysellads\.com)$/i;

function isTrackingRequest(url: URL) {
  return blockedHosts.test(url.hostname) || url.hostname === 'go.devops-daily.com';
}

function isSameOriginAsset(request: Request) {
  try {
    return (
      new URL(request.url()).origin === siteOrigin &&
      request.resourceType() !== 'document' &&
      request.resourceType() !== 'websocket'
    );
  } catch {
    return false;
  }
}

function pathWithOptionalTrailingSlash(url: string) {
  const pathname = new URL(url).pathname;
  return pathname === '/' ? pathname : pathname.replace(/\/$/, '');
}

function firstLine(message: string) {
  return message.split('\n')[0].trim();
}

function trackBrowserProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${firstLine(error.message)}`));
  page.on('console', (message: ConsoleMessage) => {
    const sources = [message.text(), message.location().url];
    if (
      message.type() !== 'error' ||
      ignoredConsoleErrors.some((pattern) => sources.some((source) => pattern.test(source)))
    ) {
      return;
    }
    const source = message.location().url;
    problems.push(
      `console error: ${firstLine(message.text())}${source ? ` (${source.slice(0, 120)})` : ''}`
    );
  });
  page.on('requestfailed', (request) => {
    // Next.js cancels link prefetches it no longer needs; that is not a broken asset.
    if (request.failure()?.errorText.includes('ERR_ABORTED')) return;
    if (isSameOriginAsset(request)) {
      problems.push(`failed ${request.resourceType()}: ${new URL(request.url()).pathname}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && isSameOriginAsset(response.request())) {
      problems.push(`HTTP ${response.status()} for ${new URL(response.url()).pathname}`);
    }
  });
  return problems;
}

async function assertImagesLoaded(page: Page, problems: string[]) {
  // Lazy images only load near the viewport (some sit in sideways scrollers or
  // render after hydration), so switch them to eager while walking down the page.
  await page.evaluate(async () => {
    const eager = () =>
      document.querySelectorAll<HTMLImageElement>('main img[loading="lazy"]').forEach((img) => {
        img.loading = 'eager';
      });
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      eager();
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    eager();
    window.scrollTo(0, 0);
  });

  // Hidden images (the other theme's variant, closed menus) are left out. An SVG
  // without a pixel size reports naturalWidth 0, so SVGs are checked over HTTP.
  const pending = () =>
    page.locator('main img').evaluateAll((elements) =>
      elements
        .map((element) => element as HTMLImageElement)
        .filter((img) => img.checkVisibility() && img.getBoundingClientRect().width > 0)
        .filter((img) => !(img.complete && img.naturalWidth > 0))
        .map((img) => ({ src: img.currentSrc || img.src, complete: img.complete }))
    );
  await expect
    .poll(
      async () =>
        (await pending())
          .filter((img) => !img.complete)
          .map((img) => img.src)
          .slice(0, 5),
      { message: 'images in main are still loading', timeout: 15_000 }
    )
    .toEqual([]);

  const broken: string[] = [];
  for (const { src } of await pending()) {
    const isSvg = /\.svg($|[?#])/i.test(new URL(src).pathname + new URL(src).search);
    if (!isSvg) {
      broken.push(src);
      continue;
    }
    const response = await page.context().request.get(src);
    if (response.status() !== 200) broken.push(`${src} (HTTP ${response.status()})`);
  }
  expect(broken, `images did not load: ${broken.slice(0, 5).join(', ')}`).toEqual([]);

  if (problems.length) throw new Error(problems.join('; '));
}

async function assertVisibleTextIsSafe(page: Page) {
  // Prose may say "undefined behavior" or "NaN", so only a text node that is
  // nothing but such a value counts, the way a broken template renders it.
  const suspicious = await page.locator('main').evaluate((main) => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('pre, code, kbd, samp, script, style, noscript, template')) {
          return NodeFilter.FILTER_REJECT;
        }
        return parent.checkVisibility?.() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const found: string[] = [];
    while (walker.nextNode()) {
      const text = (walker.currentNode.textContent ?? '').trim();
      if (
        /^(undefined|null|NaN)$/.test(text) ||
        text.includes('[object Object]') ||
        /lorem ipsum/i.test(text)
      ) {
        found.push(text.slice(0, 60));
      }
    }
    return found;
  });

  expect(suspicious, `visible text looks like a rendering bug: ${suspicious.join(' | ')}`).toEqual(
    []
  );
}

async function assertSponsoredLinks(page: Page, entry: LiveCheckPage, checkLinks: boolean) {
  if (entry.needsDisclosure) {
    await expect(
      page.getByText('Disclosure:', { exact: false }).first(),
      `${entry.url} has affiliate or sponsor links in the text but no disclosure banner`
    ).toBeVisible();
  }
  if (!checkLinks) return;

  // HEAD only: the tracker does not count HEAD requests, a GET would count a click.
  const hrefs = await page
    .locator('a[href*="go.devops-daily.com"]')
    .evaluateAll((links) => [...new Set(links.map((link) => (link as HTMLAnchorElement).href))]);
  for (const href of hrefs) {
    const response = await page.context().request.head(href, { maxRedirects: 0 });
    const location = response.headers().location;
    expect([301, 302, 307, 308], `tracker link ${href} did not redirect`).toContain(
      response.status()
    );
    expect(location, `tracker link ${href} has no Location header`).toBeTruthy();
    const destination = new URL(location!, href);
    expect(destination.protocol, `tracker link ${href} did not redirect to HTTPS`).toBe('https:');
    expect(
      destination.hostname,
      `tracker link ${href} redirected to a go.devops-daily.com error page`
    ).not.toBe('go.devops-daily.com');
  }
}

for (const entry of pageList.pages) {
  test(`${entry.kind} ${new URL(entry.url).pathname}`, async ({ page, request }, testInfo) => {
    await page.context().route(
      (url) => isTrackingRequest(url),
      (route) => route.abort('blockedbyclient')
    );
    const browserProblems = trackBrowserProblems(page);
    const response = await page.goto(entry.url, { waitUntil: 'domcontentloaded' });
    expect(response, `${entry.url} did not return a document response`).not.toBeNull();
    expect(response!.status(), `${entry.url} returned ${response!.status()}`).toBe(200);
    expect(
      pathWithOptionalTrailingSlash(page.url()),
      `${entry.url} redirected to ${page.url()}`
    ).toBe(pathWithOptionalTrailingSlash(entry.url));

    await expect(page).toHaveTitle(/\S/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(
      await page.evaluate(() => {
        const root = document.scrollingElement;
        return root ? root.scrollWidth <= root.clientWidth + 1 : false;
      }),
      'page has horizontal overflow'
    ).toBe(true);

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage, 'page has no og:image').toBeTruthy();
    const ogResponse = await request.get(new URL(ogImage!, page.url()).href);
    expect(ogResponse.status(), `og:image returned ${ogResponse.status()}`).toBe(200);

    await assertImagesLoaded(page, browserProblems);
    await assertVisibleTextIsSafe(page);
    // Tracker links are the same on both viewports, so only the desktop run checks them.
    if (entry.kind === 'sponsored') {
      await assertSponsoredLinks(page, entry, testInfo.project.name === 'desktop-chromium');
    }

    expect(browserProblems, browserProblems.join('; ')).toEqual([]);
  });
}
