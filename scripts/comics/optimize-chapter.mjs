import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const content = JSON.parse(
  await readFile(new URL('content/comics/git-blame/chapter-01.json', root), 'utf8')
);
const destination = new URL('public/comics/git-blame/chapter-01/', root);
await mkdir(destination, { recursive: true });
for (const scene of content.scenes) {
  const source = fileURLToPath(new URL(scene.sourceMaster, root));
  for (const delivery of scene.artwork.sources) {
    await sharp(source)
      .resize({ width: delivery.width, withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toFile(fileURLToPath(new URL(`public${delivery.src}`, root)));
  }
  await sharp(source)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(fileURLToPath(new URL(`public${scene.artwork.src}`, root)));
}
