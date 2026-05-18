#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import type { Comparison } from '../lib/comparison-types';
import { buildSiteOgSvg } from './og-utils';

const COMPARISONS_DIR = path.join(process.cwd(), 'content', 'comparisons');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'comparisons');

function generateSVG(comparison: Comparison): string {
  return buildSiteOgSvg({
    eyebrow: 'COMPARISON',
    title: `${comparison.toolA.name} vs ${comparison.toolB.name}`,
    description: 'Feature comparison, pros and cons, pricing, use cases, and practical verdict.',
    footer: 'DevOps Daily / comparisons',
    sectionLabel: comparison.category,
    features: [
      { title: comparison.toolA.name, description: 'option A' },
      { title: 'VS', description: 'tradeoffs' },
      { title: comparison.toolB.name, description: 'option B' },
    ],
  });
}

async function main() {
  console.log('Generating comparison OG images...');

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const files = await fs.readdir(COMPARISONS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  for (const file of jsonFiles) {
    const content = await fs.readFile(path.join(COMPARISONS_DIR, file), 'utf-8');
    const comparison = JSON.parse(content) as Comparison;

    const svgPath = path.join(OUTPUT_DIR, `${comparison.slug}-og.svg`);
    const svg = generateSVG(comparison);
    await fs.writeFile(svgPath, svg, 'utf-8');
    console.log(`Created: ${comparison.slug}-og.svg`);
  }

  console.log(`\nDone! ${jsonFiles.length} SVGs generated.`);
}

main().catch((err) => {
  console.error('Error generating comparison OG images:', err);
  process.exit(1);
});
