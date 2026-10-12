import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const chapter =
  require('../../content/comics/git-blame/chapter-01.json') as typeof import('../../content/comics/git-blame/chapter-01.json');
const placements =
  require('../../docs/comics/git-blame/chapter-01/placement-checks.json') as typeof import('../../docs/comics/git-blame/chapter-01/placement-checks.json');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie-consent', 'rejected');
    localStorage.setItem('theme', 'light');
  });
});

test('complete chapter serves seven uncropped scenes, all dialogue and optional technical notes', async ({
  page,
}) => {
  expect((await page.goto('/comics/git-blame/proof/chapter'))?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(chapter.title);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('[data-comic-scene]')).toHaveCount(7);
  await expect(page.locator('[data-comic-art]').first()).toHaveAttribute('fetchpriority', 'high');

  for (const scene of chapter.scenes) {
    const frame = page.locator(`[data-comic-scene="${scene.id}"]`);
    const image = frame.locator('[data-comic-art]');
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    const box = (await image.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(scene.artwork.width / scene.artwork.height, 2);
    if (scene.id !== 'scene-01') await expect(image).toHaveAttribute('loading', 'lazy');
    await expect(image).toHaveAttribute('alt', scene.artwork.alt);
    const bubbles = frame.getByRole('list', { name: 'Scene dialogue' }).getByRole('listitem');
    await expect(bubbles).toHaveCount(scene.dialogue.length);
    for (let index = 0; index < scene.dialogue.length; index++) {
      const dialogue = scene.dialogue[index];
      await expect(bubbles.nth(index)).toHaveText(dialogue.speaker + dialogue.text);
    }
  }
  const notes = page.locator('details');
  await expect(notes).not.toHaveAttribute('open', '');
  await notes.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(notes).toHaveAttribute('open', '');
  await expect(notes).toContainText('preStop');
  await expect(notes).toContainText('terminationGracePeriodSeconds');
  await expect(notes).toContainText('idempotency');
  for (const link of chapter.technicalNotes.links.filter((link) => link.href.startsWith('/'))) {
    expect((await page.request.get(link.href)).status()).toBe(200);
  }
});

test('desktop bubbles avoid faces; phone dialogue and diagram stay in readable flow', async ({
  page,
}, testInfo) => {
  await page.goto('/comics/git-blame/proof/chapter');
  await page.evaluate(() => document.fonts.ready);
  for (const scene of chapter.scenes) {
    const frame = page.locator(`[data-comic-scene="${scene.id}"]`);
    const image = frame.locator('[data-comic-art]');
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    const art = (await image.boundingBox())!;
    const bubbles = frame.getByRole('list', { name: 'Scene dialogue' }).getByRole('listitem');
    let previousBottom = art.y + art.height;
    for (let index = 0; index < scene.dialogue.length; index++) {
      const box = (await bubbles.nth(index).boundingBox())!;
      if (testInfo.project.name.startsWith('mobile')) {
        expect(box.y).toBeGreaterThanOrEqual(previousBottom);
        previousBottom = box.y + box.height;
      } else {
        expect(box.x).toBeGreaterThanOrEqual(art.x);
        expect(box.x + box.width).toBeLessThanOrEqual(art.x + art.width);
        const faces = placements.scenes.find((entry) => entry.scene === scene.id)!.protectedFaces;
        for (const face of faces) {
          const left = art.x + face.x * art.width;
          const right = left + face.width * art.width;
          const top = art.y + face.y * art.height;
          const bottom = top + face.height * art.height;
          const overlaps =
            box.x < right && box.x + box.width > left && box.y < bottom && box.y + box.height > top;
          expect(overlaps, `${scene.id}: bubble ${index + 1} covers a reviewed face region`).toBe(
            false
          );
        }
        if ('tailTo' in scene.dialogue[index]) {
          await expect(bubbles.nth(index).locator('[data-comic-outline]')).toBeVisible();
          await expect(bubbles.nth(index).locator('[data-comic-outline]')).toHaveAttribute(
            'aria-hidden',
            'true'
          );
        }
      }
    }
    if (process.env.COMIC_CHAPTER_SCREENSHOTS) {
      await frame.screenshot({
        path: `${process.env.COMIC_CHAPTER_SCREENSHOTS}/${scene.id}-${testInfo.project.name}.jpg`,
        type: 'jpeg',
        quality: 85,
        style:
          'header.sticky, header.sticky *, nextjs-portal, a[href="#main-content"], button[aria-label="Back to top"] { visibility: hidden !important; }',
      });
    }
  }
  const diagram = page.getByRole('complementary', { name: 'Request trace' });
  if (testInfo.project.name.startsWith('mobile')) {
    await expect(diagram.getByRole('img')).not.toBeVisible();
    await expect(diagram.getByRole('list')).toContainText('not transferred');
    await expect(page.locator('[data-comic-outline]')).toHaveCount(0);
  } else {
    await expect(diagram.getByRole('img')).toHaveAccessibleName(
      /separate request.*No request is transferred/
    );
    const textScale = await diagram
      .locator('[role="img"] span')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(textScale).toBeGreaterThanOrEqual(14);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('tablet widths keep bubble bodies clear of faces when overlays switch on', async ({
  page,
}) => {
  for (const width of [680, 720, 768, 770, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/comics/git-blame/proof/chapter');
    await page.evaluate(() => document.fonts.ready);
    for (const scene of chapter.scenes) {
      const frame = page.locator(`[data-comic-scene="${scene.id}"]`);
      const art = (await frame.locator('[data-comic-art]').boundingBox())!;
      const bubbles = frame.getByRole('list', { name: 'Scene dialogue' }).getByRole('listitem');
      for (let index = 0; index < scene.dialogue.length; index++) {
        const bubble = bubbles.nth(index);
        const box = (await bubble.boundingBox())!;
        if (await bubble.evaluate((el) => getComputedStyle(el).position !== 'absolute')) {
          expect(box.y).toBeGreaterThanOrEqual(art.y + art.height);
          continue;
        }
        const faces = placements.scenes.find((entry) => entry.scene === scene.id)!.protectedFaces;
        for (const face of faces) {
          const overlaps =
            box.x < art.x + (face.x + face.width) * art.width &&
            box.x + box.width > art.x + face.x * art.width &&
            box.y < art.y + (face.y + face.height) * art.height &&
            box.y + box.height > art.y + face.y * art.height;
          expect(overlaps, `${width}px: ${scene.id} bubble ${index + 1} covers a face`).toBe(false);
        }
      }
    }
  }
});

test('reader reflows at narrow widths and doubled text, including the expanded notes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/comics/git-blame/proof/chapter');
  await page.locator('summary').click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const reader = page.locator('article[aria-labelledby="chapter-title"]');
  expect(await reader.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(
    page.getByRole('complementary', { name: 'Request trace' }).getByRole('list')
  ).toBeVisible();
  await expect(page.locator('[data-comic-outline]')).toHaveCount(0);
  for (const frame of await page.locator('[data-comic-scene]').all()) {
    const art = (await frame.locator('[data-comic-art]').boundingBox())!;
    const bubble = (await frame
      .getByRole('list', { name: 'Scene dialogue' })
      .getByRole('listitem')
      .first()
      .boundingBox())!;
    expect(bubble.y).toBeGreaterThanOrEqual(art.y + art.height);
  }
});

test('chapter and technical notes work with JavaScript disabled', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
  });
  try {
    const page = await context.newPage();
    await page.goto('/comics/git-blame/proof/chapter');
    await expect(page.locator('[data-comic-scene]')).toHaveCount(7);
    await expect(page.locator('[data-comic-scene="scene-07"]')).toContainText('Monday.');
    await page.locator('summary').click();
    await expect(page.locator('details')).toHaveAttribute('open', '');
    await expect(page.locator('details')).toContainText('SIGTERM');
  } finally {
    await context.close();
  }
});

test('the warm comic palette remains readable in the dark site theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/comics/git-blame/proof/chapter');
  await expect(page.locator('html')).toHaveClass(/dark/);
  const colors = await page.locator('article[aria-labelledby="chapter-title"]').evaluate((el) => {
    const style = getComputedStyle(el);
    return { foreground: style.color, background: style.backgroundColor };
  });
  expect(colors).toEqual({ foreground: 'rgb(39, 55, 70)', background: 'rgb(246, 240, 223)' });
});
