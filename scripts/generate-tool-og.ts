#!/usr/bin/env tsx
/**
 * Generate OG share images for every entry in lib/tools.ts.
 *
 * Run with:  bun run scripts/generate-tool-og.ts
 * Run with:  bun run scripts/generate-tool-og.ts --force   (re-render even if PNG exists)
 *
 * Outputs SVG + PNG pairs into public/images/tools/.
 */
import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { TOOLS, CATEGORY_LABEL } from '../lib/tools.js';
import { buildSiteOgSvg } from './og-utils';

const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'tools');
const FORCE = process.argv.includes('--force');

function buildSvg(title: string, category: string, tagline: string): string {
  return buildSiteOgSvg({
    eyebrow: 'DEVOPS TOOL',
    title,
    description: tagline,
    footer: 'DevOps Daily / tools',
    sectionLabel: category,
    features: [{ title: category, description: 'calculator + workflow' }],
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;
  for (const tool of TOOLS) {
    const pngPath = path.join(OUT_DIR, `${tool.slug}.png`);
    const svgPath = path.join(OUT_DIR, `${tool.slug}.svg`);
    if (!FORCE && fs.existsSync(pngPath)) {
      skipped++;
      continue;
    }
    const svg = buildSvg(
      tool.title,
      CATEGORY_LABEL[tool.category],
      tool.tagline,
    );
    fs.writeFileSync(svgPath, svg, 'utf-8');
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
      .render()
      .asPng();
    fs.writeFileSync(pngPath, png);
    generated++;
    console.log(`✓ ${tool.slug}.png (${png.byteLength} bytes)`);
  }
  console.log(`\nDone. Generated ${generated}, skipped ${skipped} (already present).`);
}

main();
