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

const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'tools');
const FORCE = process.argv.includes('--force');

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildSvg(title: string, category: string, tagline: string): string {
  const titleLines = wrapText(title, 22).slice(0, 2);
  const taglineLines = wrapText(tagline, 55).slice(0, 3);

  const titleElements = titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${255 + i * 78}" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="700" fill="#f8fafc">${escapeXml(line)}</text>`,
    )
    .join('\n');

  const taglineElements = taglineLines
    .map(
      (line, i) =>
        `<text x="80" y="${420 + i * 32}" font-family="Inter, Arial, sans-serif" font-size="22" fill="#9ca3af">${escapeXml(line)}</text>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1c1917"/>
    </linearGradient>
    <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#fbbf24" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#dots)"/>

  <!-- left amber accent bar -->
  <rect x="0" y="0" width="6" height="630" fill="#d97706"/>

  <!-- monospace section label -->
  <text x="80" y="140" font-family="Menlo, Monaco, monospace" font-size="22" fill="#fbbf24">// tools / ${escapeXml(category.toLowerCase())}</text>

  <!-- category chip (top right) -->
  <rect x="920" y="100" width="200" height="40" rx="8" fill="#d97706" opacity="0.15" stroke="#d97706" stroke-opacity="0.4" stroke-width="1"/>
  <text x="1020" y="127" font-family="Menlo, Monaco, monospace" font-size="18" fill="#fbbf24" text-anchor="middle">${escapeXml(category)}</text>

  <!-- Title -->
  ${titleElements}

  <!-- Tagline -->
  ${taglineElements}

  <!-- terminal prompt footer -->
  <text x="80" y="560" font-family="Menlo, Monaco, monospace" font-size="20" fill="#34d399">$</text>
  <text x="108" y="560" font-family="Menlo, Monaco, monospace" font-size="20" fill="#d1d5db">devops-daily.com/tools</text>

  <!-- brand mark -->
  <text x="1120" y="600" font-family="Menlo, Monaco, monospace" font-size="16" fill="#fbbf24" text-anchor="end" font-weight="600">DevOps Daily</text>
</svg>`;
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
