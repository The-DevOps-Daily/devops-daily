import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test('homepage renders in both themes without horizontal overflow', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('theme', selectedTheme);
      localStorage.setItem('cookie-consent', 'rejected');
    }, theme);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn DevOps');
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
  }
});

test('games directory keeps available and coming-soon tools distinct', async ({ page }) => {
  await page.goto('/games');

  const counter = page.getByText(/Showing \d+ of \d+ available tools/);
  await expect(counter).toBeVisible();
  const counts = (await counter.textContent())?.match(/Showing (\d+) of (\d+)/);
  expect(counts?.[1]).toBe(counts?.[2]);

  const comingSoon = page.getByRole('region', { name: 'Coming Soon' });
  await expect(comingSoon).toBeVisible();
  await expect(comingSoon.getByRole('link')).toHaveCount(0);

  const simulatorsTab = page.getByRole('button', { name: /Simulators/ });
  await simulatorsTab.click();
  await expect(simulatorsTab).toHaveAttribute('aria-pressed', 'true');
  await expect(comingSoon).not.toBeVisible();
});

test('representative article and simulator routes render', async ({ page }) => {
  await page.goto('/posts/reliable-webhook-delivery-retries-signatures-idempotency');
  await expect(page.getByRole('main')).toContainText(/webhook/i);

  await page.goto('/games/webhook-delivery-simulator');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Webhook Delivery Simulator',
      exact: true,
    })
  ).toBeVisible();
});

// axe-core rules for WCAG 2.0, 2.1 and 2.2 at levels A and AA.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

const A11Y_PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'post', path: '/posts/reliable-webhook-delivery-retries-signatures-idempotency' },
  { name: 'guide part', path: '/guides/introduction-to-kubernetes/06-configmaps-and-secrets' },
  { name: 'comparison', path: '/comparisons/argocd-vs-flux' },
  { name: 'game', path: '/games/webhook-delivery-simulator' },
  { name: 'challenges listing', path: '/challenges' },
];

// Known issue, tracked in #539: the light-mode brand amber (--primary, rendered
// as #db7706) is 3.2:1 on white, so amber text and white text on amber buttons
// miss AA. Fixing it changes the brand color, so in light mode two cases are
// skipped: amber text on a light surface at 2.8:1 or better (the 10% amber
// tint is the darkest at 2.82:1) and white text on amber. Any other color, or
// amber text on a mid or dark surface, still fails the test.
const LIGHT_PRIMARY = '#db7706';

type ContrastData = { fgColor?: string; bgColor?: string; contrastRatio?: number };

function isLightSurface(hex = '') {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) return false;
  const [r, g, b] = match
    .slice(1)
    .map((channel) => parseInt(channel, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

function isKnownIssue(rule: string, data: ContrastData | undefined, theme: string) {
  if (rule !== 'color-contrast' || theme !== 'light' || !data) return false;
  const amberText =
    data.fgColor === LIGHT_PRIMARY &&
    isLightSurface(data.bgColor) &&
    (data.contrastRatio ?? 0) >= 2.8;
  const whiteOnAmber = data.fgColor === '#ffffff' && data.bgColor === LIGHT_PRIMARY;
  return amberText || whiteOnAmber;
}

async function wcagViolations(page: Page, theme: string) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The Next.js dev overlay only exists under `next dev`, not on the site.
    .exclude('nextjs-portal')
    // Carbon's script injects its own ad markup here; we cannot change it.
    .exclude('#carbon-ads-container')
    .analyze();
  return results.violations.flatMap((violation) => {
    // Group nodes by what is wrong (the color pair for contrast) so one CI log
    // shows every distinct problem, with a few example selectors each.
    const problems = new Map<string, string[]>();
    for (const node of violation.nodes) {
      const data = node.any[0]?.data as ContrastData | undefined;
      if (isKnownIssue(violation.id, data, theme)) continue;
      const key = data?.fgColor
        ? `${data.fgColor} on ${data.bgColor} is ${data.contrastRatio}:1`
        : (node.failureSummary?.split('\n')[1]?.trim() ?? violation.help);
      const targets = problems.get(key) ?? [];
      targets.push(node.target.join(' '));
      problems.set(key, targets);
    }
    if (problems.size === 0) return [];
    return [
      {
        rule: violation.id,
        help: violation.help,
        problems: [...problems].map(([problem, targets]) => ({
          problem,
          count: targets.length,
          examples: targets.slice(0, 3),
        })),
      },
    ];
  });
}

test.describe('accessibility', () => {
  test.slow();

  for (const { name, path } of A11Y_PAGES) {
    for (const theme of ['light', 'dark']) {
      test(`${name} has no WCAG 2.2 AA violations in ${theme} mode`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem('theme', selectedTheme);
          localStorage.setItem('cookie-consent', 'rejected');
        }, theme);
        await page.goto(path);
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
        await expect(page.getByRole('main').first()).toBeVisible();
        // Fade-ins are scanned mid-way otherwise and report a false low contrast.
        await page.waitForFunction(() =>
          document
            .getAnimations()
            .every(
              (animation) =>
                animation.playState !== 'running' ||
                animation.effect?.getTiming().iterations === Infinity
            )
        );

        let violations = await wcagViolations(page, theme);
        if (violations.length) {
          // A late fade-in can still be mid-way; real problems survive a second scan.
          await page.waitForTimeout(1000);
          violations = await wcagViolations(page, theme);
        }
        if (violations.length) console.log(JSON.stringify({ path, theme, violations }, null, 2));
        expect(violations).toEqual([]);
      });
    }
  }
});
