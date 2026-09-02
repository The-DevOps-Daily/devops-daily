#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { buildSiteOgSvg, convertSvgToPng } from './og-utils';

async function main() {
  const dir = path.join(process.cwd(), 'public/images/games');
  const svgPath = path.join(dir, 'preview-environment-simulator-og.svg');
  const pngPath = path.join(dir, 'preview-environment-simulator-og.png');

  const svg = buildSiteOgSvg({
    eyebrow: '// preview environments',
    title: 'From Pull Request to Teardown',
    description:
      'Reconcile an isolated review environment, verify the deployed evidence, and leave no resources behind.',
    sectionLabel: 'DevOps Daily × Atomsized',
    features: [
      { title: 'Git intent', description: 'PR or stack YAML' },
      { title: 'Review evidence', description: 'health + revision' },
      { title: 'Clean teardown', description: 'zero orphans' },
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
