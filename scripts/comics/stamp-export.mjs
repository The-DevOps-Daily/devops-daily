import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { root, pdfFingerprint } from './pdf-inputs.mjs';

const current = await pdfFingerprint();
const cache = `${root}/.cache/comic-export-inputs.json`;
if (process.argv.includes('--before')) {
  await mkdir(`${root}/.cache`, { recursive: true });
  await writeFile(cache, JSON.stringify({ renderFingerprint: current.renderFingerprint }));
} else {
  const before = JSON.parse(await readFile(cache, 'utf8'));
  if (before.renderFingerprint !== current.renderFingerprint)
    throw new Error(
      'Comic print inputs changed during the build; rerun it before exporting a PDF.'
    );
  await mkdir(`${root}/out/comics/git-blame`, { recursive: true });
  await writeFile(`${root}/out/comics/git-blame/export-inputs.json`, JSON.stringify(before) + '\n');
}
