import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie-consent', 'rejected');
    localStorage.setItem('theme', 'light');
  });
});

test('proof serves uncropped responsive artwork and ordered accessible dialogue', async ({
  page,
}) => {
  const response = await page.goto('/comics/git-blame/proof');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("The Pod That Wouldn't Die");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  const image = page.locator('[data-comic-art]');
  await expect(image).toHaveAttribute('alt', /Sam turns.*Maya/);
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const size = await image.boundingBox();
  expect(size).not.toBeNull();
  expect(size!.width / size!.height).toBeCloseTo(1122 / 1402, 2);
  expect(await image.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\.webp$/);

  const bubbles = page.getByRole('list', { name: 'Scene dialogue' }).getByRole('listitem');
  await expect(bubbles).toHaveCount(2);
  await expect(bubbles.nth(0)).toHaveText("SamIt's literally a two-line change.");
  await expect(bubbles.nth(1)).toHaveText("MayaThat's what you said last Friday.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('bubbles fit the empty wall on desktop and flow below artwork on phones', async ({
  page,
}, testInfo) => {
  await page.goto('/comics/git-blame/proof');
  const image = page.locator('[data-comic-art]');
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  const art = (await image.boundingBox())!;
  const bubbles = page.getByRole('listitem').filter({ has: page.locator('[class*="speaker"]') });
  const first = (await bubbles.nth(0).boundingBox())!;
  const second = (await bubbles.nth(1).boundingBox())!;
  if (testInfo.project.name.startsWith('mobile')) {
    expect(first.y).toBeGreaterThanOrEqual(art.y + art.height);
    expect(second.y).toBeGreaterThan(first.y + first.height);
    expect(
      await bubbles.nth(0).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    ).toBeGreaterThanOrEqual(18);
  } else {
    for (const bubble of [first, second]) {
      expect(bubble.x).toBeGreaterThan(art.x);
      expect(bubble.x + bubble.width).toBeLessThan(art.x + art.width);
      expect(bubble.y + bubble.height).toBeLessThan(art.y + art.height * 0.35);
    }
    expect(first.x + first.width).toBeLessThan(second.x);
  }
  if (process.env.COMIC_PROOF_SCREENSHOTS) {
    await page.locator('figure').screenshot({
      path: `${process.env.COMIC_PROOF_SCREENSHOTS}/${testInfo.project.name}.png`,
      // Exclude site chrome/debug overlays from the scene-only review crop.
      style: 'header.sticky, nextjs-portal, a[href="#main-content"] { visibility: hidden; }',
    });
  }
});

test('doubling text size returns dialogue to flow without clipping', async ({ page }, testInfo) => {
  await page.goto('/comics/git-blame/proof');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const image = page.locator('[data-comic-art]');
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const art = (await image.boundingBox())!;
  const bubbles = page.getByRole('list', { name: 'Scene dialogue' }).getByRole('listitem');
  const first = (await bubbles.nth(0).boundingBox())!;
  const second = (await bubbles.nth(1).boundingBox())!;
  expect(first.y).toBeGreaterThanOrEqual(art.y + art.height);
  expect(second.y).toBeGreaterThan(first.y + first.height);
  // Check the reader itself: the existing site header separately overflows at
  // 200% text size and is tracked in the Phase 6 integration plan.
  const reader = page.locator('article[aria-labelledby="chapter-title"]');
  expect(await reader.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (const bubble of [first, second]) {
    expect(bubble.x).toBeGreaterThanOrEqual(art.x);
    expect(bubble.x + bubble.width).toBeLessThanOrEqual(art.x + art.width);
  }
  if (process.env.COMIC_PROOF_SCREENSHOTS) {
    await page.locator('figure').screenshot({
      path: `${process.env.COMIC_PROOF_SCREENSHOTS}/${testInfo.project.name}-text-zoom.png`,
      style: 'header.sticky, nextjs-portal, a[href="#main-content"] { visibility: hidden; }',
    });
  }
});

test('artwork and dialogue remain readable without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
  });
  try {
    const page = await context.newPage();
    await page.goto('/comics/git-blame/proof');
    await expect(page.getByRole('list', { name: 'Scene dialogue' })).toContainText(
      "That's what you said last Friday."
    );
    await expect
      .poll(() =>
        page.locator('[data-comic-art]').evaluate((img: HTMLImageElement) => img.naturalWidth)
      )
      .toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
