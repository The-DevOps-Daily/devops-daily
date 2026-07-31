import { expect, test } from '@playwright/test';

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
    page.getByRole('heading', { name: 'Webhook Delivery Simulator', exact: true })
  ).toBeVisible();
});
