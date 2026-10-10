import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../../', import.meta.url);
const art = await sharp(
  fileURLToPath(new URL('public/comics/git-blame/chapter-01/scene-01-960.webp', root))
)
  .resize({ width: 404 })
  .png()
  .toBuffer();
const fontFiles = ['Inter-Regular.ttf', 'Inter-Bold.ttf'].map((name) =>
  fileURLToPath(new URL(`public/fonts/${name}`, root))
);
const entries = [
  {
    name: 'library',
    lines: ['DevOps', 'Comics'],
    subtitle: ['Illustrated stories from', 'life in engineering.'],
  },
  {
    name: 'git-blame',
    lines: ['git blame'],
    subtitle: ['Production is down.', 'Everyone has a theory.'],
  },
  {
    name: 'chapter-01',
    lines: ['The Pod That', "Wouldn't Die"],
    subtitle: ['git blame · Chapter 1', 'Everything Is Fine'],
  },
];
const destination = new URL('public/comics/og/', root);
await mkdir(destination, { recursive: true });
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const entry of entries) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#f6f0df"/><rect y="0" width="1200" height="8" fill="#dc7906"/>
    <text x="64" y="104" fill="#40554a" font-family="Inter" font-size="24" font-weight="700">DEVOPS DAILY ORIGINAL</text>
    ${entry.lines.map((line, index) => `<text x="64" y="${232 + index * 76}" fill="#273746" font-family="Inter" font-size="${entry.name === 'library' ? 76 : 56}" font-weight="700">${escape(line)}</text>`).join('')}
    ${entry.subtitle.map((line, index) => `<text x="64" y="${407 + index * 39}" fill="#40554a" font-family="Inter" font-size="26">${escape(line)}</text>`).join('')}
    <text x="64" y="565" fill="#273746" font-family="Inter" font-size="22">devops-daily.com/comics</text>
    <image x="760" y="64" width="404" height="505" href="data:image/png;base64,${art.toString('base64')}"/>
  </svg>`;
  const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false } }).render().asPng();
  await writeFile(new URL(`${entry.name}.png`, destination), png);
}
console.log('Generated three static 1200 × 630 comic sharing images.');
