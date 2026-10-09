import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('cookie-consent', 'rejected');
  });
});

test('library leads into the series and chapter with complete sharing metadata', async ({
  page,
}) => {
  for (const route of ['/comics', '/comics/git-blame', '/comics/git-blame/chapter-01']) {
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      `https://devops-daily.com${route}`
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://devops-daily.com${route}`
    );
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image!);
    const response = await page.request.get(new URL(image!).pathname);
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  }
  await page.goto('/comics');
  await page.getByRole('link', { name: 'Explore the series', exact: true }).click();
  await expect(page).toHaveURL(/\/comics\/git-blame$/);
  const contents = page.getByRole('region', { name: 'Everything Is Fine' });
  await expect(contents.getByRole('listitem')).toHaveCount(6);
  await expect(contents.getByRole('link')).toHaveCount(1);
  await expect(contents).toContainText('Coming soon');
  await page.getByRole('link', { name: 'Start reading', exact: true }).click();
  await expect(page.locator('[data-comic-scene]')).toHaveCount(7);
  await expect(page.getByRole('navigation', { name: 'Chapter navigation' })).toContainText(
    'Coming soon'
  );
});

test('both reader URLs scroll navigation away and remove floating site extras', async ({
  page,
}) => {
  for (const route of ['/comics/git-blame/proof/chapter', '/comics/git-blame/chapter-01']) {
    await page.goto(route);
    const header = page.getByRole('banner');
    await expect
      .poll(() => header.evaluate((el) => getComputedStyle(el).position))
      .toBe('relative');
    await page.locator('[data-comic-scene="scene-03"]').scrollIntoViewIfNeeded();
    expect(await header.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThan(0);
    await expect(page.getByRole('button', { name: 'Back to top', exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--site-header-h').trim()
      )
    ).toBe('0px');
  }
  await page.getByRole('link', { name: 'Comics', exact: true }).first().click();
  await expect
    .poll(() => page.getByRole('banner').evaluate((el) => getComputedStyle(el).position))
    .toBe('sticky');
});

test('library, series and reader fit at 320px with doubled text and expose usable navigation', async ({
  page,
}) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/comics', '/comics/git-blame', '/comics/git-blame/chapter-01']) {
      await page.goto(route);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await expect(page.getByRole('button', { name: 'Open main menu' })).toBeVisible();
      expect(
        await page.getByRole('banner').evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true);
      expect(await page.getByRole('main').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true
      );
    }
  }
  await page.getByRole('button', { name: 'Open main menu' }).click();
  await expect(page.getByRole('link', { name: /Comics.*Illustrated stories/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveCount(0);
});

test('chapter download is a real PDF and the reader retains keyboard access to notes', async ({
  page,
}) => {
  await page.goto('/comics/git-blame/chapter-01');
  const download = page.getByRole('link', { name: 'Download preview PDF', exact: true });
  await expect(download).toHaveAttribute('download', '');
  const response = await page.request.get((await download.getAttribute('href'))!);
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await page.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details')).toHaveAttribute('open', '');
});
