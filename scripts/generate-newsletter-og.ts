#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { Resvg } from '@resvg/resvg-js';
import { escapeXml } from './og-utils';

const NEWSLETTERS_DIR = path.join(process.cwd(), 'content', 'newsletters');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'newsletters');

function generateSVG(week: number, year: number, date: string): string {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#1e293b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Grid pattern -->
  <g opacity="0.03">
    ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630" stroke="white" stroke-width="0.5" />`).join('\n    ')}
    ${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}" stroke="white" stroke-width="0.5" />`).join('\n    ')}
  </g>

  <!-- Glow circles -->
  <circle cx="200" cy="150" r="200" fill="#10b981" opacity="0.06" />
  <circle cx="1000" cy="480" r="180" fill="#06b6d4" opacity="0.05" />

  <!-- Accent line -->
  <rect x="80" y="200" width="80" height="4" rx="2" fill="url(#accent)" />

  <!-- Mail icon -->
  <g transform="translate(80, 100)">
    <rect width="56" height="56" rx="14" fill="#10b981" opacity="0.15" />
    <rect x="4" y="4" width="48" height="48" rx="12" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.3" />
    <path d="M16 22 L28 32 L40 22" stroke="#10b981" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="14" y="18" width="28" height="22" rx="3" fill="none" stroke="#10b981" stroke-width="2" />
  </g>

  <!-- Title -->
  <text x="80" y="260" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="700" fill="white">
    DevOps Daily Newsletter
  </text>

  <!-- Week label -->
  <text x="80" y="330" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="600" fill="#10b981">
    ${escapeXml(`Week ${week}, ${year}`)}
  </text>

  <!-- Date -->
  <text x="80" y="390" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#94a3b8">
    ${escapeXml(formattedDate)}
  </text>

  <!-- Tagline -->
  <text x="80" y="500" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#64748b">
    Weekly roundup of DevOps content, tools, and learning resources
  </text>

  <!-- Brand -->
  <text x="80" y="570" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#475569">
    devops-daily.com
  </text>

  <!-- Border -->
  <rect x="0" y="0" width="1200" height="630" fill="none" stroke="white" stroke-opacity="0.06" stroke-width="1" />
  <rect x="0" y="626" width="1200" height="4" fill="url(#accent)" />
</svg>`;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const files = await fs.readdir(NEWSLETTERS_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  let generated = 0;
  let skipped = 0;

  for (const file of mdFiles) {
    const slug = file.replace(/\.md$/, '');
    const outputPath = path.join(OUTPUT_DIR, `${slug}-og.png`);

    // Skip if already exists
    try {
      await fs.access(outputPath);
      skipped++;
      continue;
    } catch {
      // File doesn't exist, generate it
    }

    const raw = await fs.readFile(path.join(NEWSLETTERS_DIR, file), 'utf-8');
    const { data } = matter(raw);

    const week = data.week || 0;
    const year = data.year || 0;
    const date = data.date || '';

    if (!week || !year) {
      console.log(`  Skipping ${file} (missing week/year)`);
      continue;
    }

    const svg = generateSVG(week, year, date);
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
    });
    const pngBuffer = resvg.render().asPng();
    await fs.writeFile(outputPath, pngBuffer);
    generated++;
    console.log(`  Generated: ${slug}-og.png`);
  }

  console.log(`\nDone! Generated: ${generated}, Skipped (existing): ${skipped}`);
}

main().catch(console.error);
