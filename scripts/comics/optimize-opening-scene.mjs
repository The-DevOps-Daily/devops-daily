import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const source = fileURLToPath(
  new URL('assets/comics/git-blame/chapter-01/scene-01-proof-v1.png', root)
);
const destination = new URL('public/comics/git-blame/chapter-01/', root);
await mkdir(destination, { recursive: true });

// Preserve the source composition; these operations only resize and encode it.
for (const width of [480, 960, 1122]) {
  await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 85, effort: 6 })
    .toFile(fileURLToPath(new URL(`scene-01-${width}.webp`, destination)));
}
await sharp(source)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(fileURLToPath(new URL('scene-01.jpg', destination)));
