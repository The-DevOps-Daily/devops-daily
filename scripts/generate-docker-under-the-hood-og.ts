#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { buildSiteOgSvg, convertSvgToPng } from './og-utils';

/**
 * OG image for the "How Docker Works Under the Hood" simulator. Uses the shared
 * site OG template so it matches the other simulators (dark surface, amber
 * accent, feature cards, DevOps Daily footer) instead of an off-brand one-off.
 */
async function main() {
  const dir = path.join(process.cwd(), 'public/images/games');
  const svgPath = path.join(dir, 'docker-under-the-hood-simulator-og.svg');
  const pngPath = path.join(dir, 'docker-under-the-hood-simulator-og.png');

  const svg = buildSiteOgSvg({
    eyebrow: '// docker internals',
    title: 'How Docker Works Under the Hood',
    description:
      'Step through docker run from the CLI down to the Linux kernel, one layer at a time.',
    sectionLabel: 'games',
    features: [
      { title: 'CLI to kernel', description: 'the whole path' },
      { title: 'containerd + runc', description: 'the real runtime' },
      { title: 'namespaces + cgroups', description: 'the isolation' },
    ],
  });

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(svgPath, svg, 'utf-8');
  await convertSvgToPng(svgPath, pngPath);
  await fs.rm(svgPath);
  console.log(`Generated ${pngPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
