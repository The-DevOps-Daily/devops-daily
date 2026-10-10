import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { root, pdfPath, manifestPath, pdfFingerprint } from './pdf-inputs.mjs';

try {
  const [current, manifest, pdf] = await Promise.all([
    pdfFingerprint(),
    readFile(`${root}/${manifestPath}`, 'utf8').then(JSON.parse),
    readFile(`${root}/${pdfPath}`),
  ]);
  if (
    current.fingerprint !== manifest.fingerprint ||
    createHash('sha256').update(pdf).digest('hex') !== manifest.pdfSha256
  ) {
    throw new Error('The comic PDF does not match its current artwork, dialogue or print layout.');
  }
  console.log(`Comic PDF is current (${pdf.length.toLocaleString()} bytes).`);
} catch (error) {
  console.error(
    `${error.message}\nRegenerate with pnpm build:comics (Chromium must be provisioned).`
  );
  process.exitCode = 1;
}
