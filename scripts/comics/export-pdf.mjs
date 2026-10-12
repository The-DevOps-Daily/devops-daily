import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { root, pdfPath, manifestPath, pdfFingerprint } from './pdf-inputs.mjs';

const exportRoot = resolve(root, 'out');
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
// Serve only this build, never a remote preview or a production URL.
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let target = resolve(exportRoot, `.${path}`);
    if (!target.startsWith(`${exportRoot}/`) && target !== exportRoot) {
      response.writeHead(403).end();
      return;
    }
    if (!extname(target)) target += '.html';
    const data = await readFile(target);
    response
      .writeHead(200, {
        'content-type': types[extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      .end(data);
  } catch {
    response.writeHead(404).end();
  }
});
let browser;
try {
  // Fail early if a static build has not produced the print edition.
  await readFile(resolve(exportRoot, 'comics/git-blame/print.html'));
  const input = await pdfFingerprint();
  const exportStamp = JSON.parse(
    await readFile(resolve(exportRoot, 'comics/git-blame/export-inputs.json'), 'utf8')
  );
  if (exportStamp.renderFingerprint !== input.renderFingerprint)
    throw new Error('The static print export is stale. Regenerate with pnpm build:comics.');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.COMICS_CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('cookie-consent', 'rejected');
  });
  await page.route('**/*', (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort()
  );
  const response = await page.goto(`${origin}/comics/git-blame/print`, {
    waitUntil: 'networkidle',
  });
  if (response.status() !== 200) throw new Error('The exported print edition did not load.');
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  // Wait for the real positioned outlines, rather than freezing a pre-hydration frame.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-print-page] [data-comic-dialogue] > li')].every(
        (bubble) => getComputedStyle(bubble).position === 'absolute'
      ) && document.querySelectorAll('[data-comic-outline]').length >= 14
  );
  const validation = await page.evaluate(() => ({
    sceneCount: document.querySelectorAll('[data-comic-scene]').length,
    dialogueCount: document.querySelectorAll('[data-comic-dialogue] > li').length,
    fontStatus: document.fonts.status,
    oversizedScenes: [...document.querySelectorAll('[data-print-page]')].filter(
      (page) => page.getBoundingClientRect().height > 1032
    ).length,
    // Tails intentionally extend outside the bubble; check its actual text.
    clippedText: [
      ...document.querySelectorAll('[data-comic-dialogue] > li p, [data-comic-dialogue] > li span'),
    ].filter((text) => text.scrollWidth > text.clientWidth || text.scrollHeight > text.clientHeight)
      .length,
  }));
  if (
    validation.sceneCount !== 7 ||
    validation.dialogueCount !== 16 ||
    validation.oversizedScenes ||
    validation.clippedText
  )
    throw new Error(`Print layout failed validation: ${JSON.stringify(validation)}`);
  const pdf = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
    displayHeaderFooter: false,
  });
  // Never stamp an export if source files changed while rendering it.
  if ((await pdfFingerprint()).fingerprint !== input.fingerprint)
    throw new Error('PDF inputs changed during generation; run again.');
  const outputPath = resolve(root, pdfPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(resolve(root, manifestPath)), { recursive: true });
  await mkdir(resolve(exportRoot, 'comics/git-blame/downloads'), { recursive: true });
  await writeFile(outputPath, pdf);
  await writeFile(resolve(exportRoot, 'comics/git-blame/downloads/chapter-01.pdf'), pdf);
  await writeFile(
    resolve(root, manifestPath),
    JSON.stringify(
      {
        ...input,
        edition: 'chapter-01-preview',
        bytes: pdf.length,
        pdfSha256: createHash('sha256').update(pdf).digest('hex'),
        validation,
        tagged: true,
        generator: 'Playwright Chromium from local static export',
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    `Generated chapter PDF with selectable dialogue: ${pdf.length.toLocaleString()} bytes.`
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
