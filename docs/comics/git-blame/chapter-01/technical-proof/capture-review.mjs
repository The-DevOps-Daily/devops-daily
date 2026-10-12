import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const directory = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: process.env.COMIC_CHROMIUM_PATH || '/usr/bin/chromium',
});
const checks = [];
try {
  for (const [name, width, height, enlargedText] of [
    ['desktop', 1280, 1100, false],
    ['phone', 393, 851, false],
    ['narrow-phone', 320, 851, false],
    ['enlarged-text', 1280, 1100, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto(
      process.env.COMIC_ART_REVIEW_URL ||
        'http://127.0.0.1:3200/docs/comics/git-blame/chapter-01/technical-proof/review.html'
    );
    if (enlargedText)
      await page.locator('html').evaluate((element) => {
        element.style.fontSize = '200%';
      });
    await page.locator('img').evaluate((img) => img.decode());
    const layout = await page.evaluate(() => {
      const list = document.querySelector('ol');
      const canvas = document.querySelector('.art').getBoundingClientRect();
      const labels = [...list.children].map((item) => {
        const rect = item.getBoundingClientRect();
        return {
          text: item.textContent,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          fontSize: parseFloat(getComputedStyle(item).fontSize),
          fits:
            item.scrollWidth <= item.clientWidth &&
            rect.right <= document.documentElement.clientWidth &&
            rect.left >= 0,
        };
      });
      return {
        overlay: getComputedStyle(list).position === 'absolute',
        art: {
          width: canvas.width,
          height: document.querySelector('img').getBoundingClientRect().height,
        },
        labels,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        naturalWidth: document.querySelector('img').naturalWidth,
      };
    });
    if (
      layout.overflow ||
      layout.labels.length !== 3 ||
      layout.labels.some((label) => !label.fits) ||
      layout.naturalWidth !== 1448
    )
      throw new Error(`${name}: image or lettering failed`);
    if (layout.overlay !== (name === 'desktop'))
      throw new Error(`${name}: incorrect responsive lettering mode`);
    if (enlargedText && layout.labels.some((label) => label.fontSize < 36))
      throw new Error(`${name}: text did not enlarge`);
    if (
      layout.overlay &&
      layout.labels.some(
        (label, index) => index < 2 && label.y + label.height >= layout.labels[index + 1].y
      )
    )
      throw new Error(`${name}: lettering overlaps`);
    if (Math.abs(layout.art.width / layout.art.height - 4 / 3) > 0.001)
      throw new Error(`${name}: artwork is cropped or distorted`);
    await page.screenshot({
      path: path.join(directory, `panel-07-trace-${name}.jpg`),
      type: 'jpeg',
      quality: 92,
      fullPage: true,
    });
    checks.push({ name, javascript: 'disabled', ...layout });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(directory, 'browser-checks.json'),
  `${JSON.stringify({ browser: 'Chromium', generated: new Date().toISOString(), checks }, null, 2)}\n`
);
console.log(
  'Four artwork review layouts passed: desktop, phone, narrow phone and doubled root text; no JavaScript.'
);
