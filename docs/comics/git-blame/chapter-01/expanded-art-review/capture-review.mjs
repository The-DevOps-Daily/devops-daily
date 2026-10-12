import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const { panels } = JSON.parse(await readFile(path.join(directory, 'panels.json'), 'utf8'));
const browser = await chromium.launch({
  executablePath: process.env.COMIC_CHROMIUM_PATH || '/usr/bin/chromium',
});
const checks = [];
try {
  for (const [name, width, height, enlargedText] of [
    ['desktop', 1280, 1000, false],
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
        'http://127.0.0.1:3211/docs/comics/git-blame/chapter-01/expanded-art-review/review.html'
    );
    if (enlargedText)
      await page.locator('html').evaluate((element) => {
        element.style.fontSize = '200%';
      });
    await page
      .locator('img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    for (const panel of panels) {
      const section = page.locator(`#${panel.id}`);
      const result = await section.evaluate((element) => {
        const img = element.querySelector('img');
        const imageBounds = img.getBoundingClientRect();
        const list = element.querySelector('ol');
        const overlay = getComputedStyle(list).position === 'absolute';
        const labels = [...list.children].map((item) => {
          const rect = item.getBoundingClientRect();
          return {
            text: item.textContent.trim(),
            x: rect.x - imageBounds.x,
            y: rect.y - imageBounds.y,
            width: rect.width,
            height: rect.height,
            fontSize: parseFloat(getComputedStyle(item).fontSize),
            fits:
              item.scrollWidth <= item.clientWidth + 1 &&
              rect.right <= document.documentElement.clientWidth &&
              rect.left >= 0,
            withinArt:
              rect.left >= imageBounds.left &&
              rect.right <= imageBounds.right &&
              rect.top >= imageBounds.top &&
              rect.bottom <= imageBounds.bottom,
          };
        });
        return {
          overlay,
          naturalWidth: img.naturalWidth,
          masterWidth: Number(element.dataset.masterWidth),
          expectedRatio: Number(element.dataset.ratio),
          ratio: imageBounds.width / imageBounds.height,
          art: { width: imageBounds.width, height: imageBounds.height },
          labels,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      if (
        result.overflow ||
        result.naturalWidth !== result.masterWidth ||
        Math.abs(result.ratio - result.expectedRatio) > 0.001 ||
        result.labels.length !== panel.labels.length ||
        result.labels.some((label) => !label.fits)
      )
        throw new Error(`${panel.id}/${name}: image or labels failed`);
      if (result.overlay !== (name === 'desktop'))
        throw new Error(`${panel.id}/${name}: incorrect responsive mode`);
      for (const [index, label] of panel.labels.entries())
        if (label.code && result.labels[index].text !== label.code)
          throw new Error(`${panel.id}/${name}: exact code lettering changed`);
      if (result.overlay && result.labels.some((label) => !label.withinArt))
        throw new Error(`${panel.id}/${name}: annotation outside artwork`);
      if (enlargedText && result.labels.some((label) => label.fontSize < 36))
        throw new Error(`${panel.id}/${name}: text failed to enlarge`);
      if (result.overlay) {
        for (let a = 0; a < result.labels.length; a++)
          for (let b = a + 1; b < result.labels.length; b++) {
            const first = result.labels[a],
              second = result.labels[b];
            if (
              first.x < second.x + second.width &&
              first.x + first.width > second.x &&
              first.y < second.y + second.height &&
              first.y + first.height > second.y
            )
              throw new Error(`${panel.id}/${name}: annotations overlap`);
          }
      }
      await section.screenshot({
        path: path.join(directory, `${panel.id}-${name}.jpg`),
        type: 'jpeg',
        quality: 92,
      });
      checks.push({ panel: panel.panel, layout: name, javascript: 'disabled', ...result });
    }
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
  `${checks.length} panel/layout checks passed, including phones and doubled text, with JavaScript disabled.`
);
