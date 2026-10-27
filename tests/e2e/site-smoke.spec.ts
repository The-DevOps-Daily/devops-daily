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

async function wcagViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The Next.js dev overlay only exists under `next dev`, not on the site.
    .exclude('nextjs-portal')
    .analyze();
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 5).map((node) => ({
      target: node.target.join(' '),
      summary: node.failureSummary?.split('\n').slice(0, 2).join(' '),
    })),
    count: violation.nodes.length,
  }));
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

        const violations = await wcagViolations(page);
        if (violations.length) console.log(JSON.stringify({ path, theme, violations }, null, 2));
        expect(violations).toEqual([]);
      });
    }
  }
});
