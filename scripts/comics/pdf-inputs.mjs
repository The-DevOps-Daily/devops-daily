import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const pdfPath = 'public/comics/git-blame/downloads/chapter-01.pdf';
export const manifestPath = 'docs/comics/git-blame/site-review/pdf-manifest.json';

export async function pdfFingerprint() {
  const content = JSON.parse(
    await readFile(`${root}/content/comics/git-blame/chapter-01.json`, 'utf8')
  );
  const files = [
    'content/comics/git-blame/chapter-01.json',
    'content/comics/git-blame/series.ts',
    'app/layout.tsx',
    'app/globals.css',
    'lib/comic-metadata.ts',
    'package.json',
    'next.config.mjs',
    'app/comics/git-blame/print/page.tsx',
    'components/comics/print-edition.tsx',
    'components/comics/print-edition.module.css',
    'components/comics/comic-scene.tsx',
    'components/comics/comic-scene.module.css',
    'components/comics/speech-bubble.tsx',
    'components/comics/shutdown-request-diagram.tsx',
    'components/comics/technical-notes.tsx',
    'components/comics/chapter-reader.module.css',
    'public/fonts/Inter-Regular.ttf',
    'public/fonts/Inter-Bold.ttf',
    'scripts/comics/export-pdf.mjs',
    'scripts/comics/pdf-inputs.mjs',
    ...content.scenes.flatMap((scene) => [scene.sourceMaster, `public${scene.artwork.src}`]),
  ];
  const hashes = await Promise.all(
    files.map(async (path) => ({
      path,
      sha256: createHash('sha256')
        .update(await readFile(`${root}/${path}`))
        .digest('hex'),
    }))
  );
  return {
    fingerprint: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),
    renderFingerprint: createHash('sha256')
      .update(JSON.stringify(hashes.filter((file) => !file.path.startsWith('scripts/'))))
      .digest('hex'),
    inputs: hashes,
  };
}
