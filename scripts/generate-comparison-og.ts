#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import type { Comparison } from '../lib/comparison-types';
import { escapeXml } from './og-utils';

const COMPARISONS_DIR = path.join(process.cwd(), 'content', 'comparisons');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'comparisons');

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 100, g: 100, b: 200 };
}

function ensureContrast(hex: string): string {
  const rgb = hexToRgb(hex);
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  if (luminance < 80) return '#fbbf24';
  if (luminance > 200) {
    return `rgb(${Math.min(255, rgb.r)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 80)})`;
  }
  return hex;
}

function fontSize(name: string): number {
  if (name.length > 20) return 30;
  if (name.length > 15) return 36;
  if (name.length > 10) return 44;
  return 52;
}

function generateSVG(comparison: Comparison): string {
  const toolAName = escapeXml(comparison.toolA.name);
  const toolBName = escapeXml(comparison.toolB.name);
  const category = escapeXml(comparison.category);
  const toolAColor = ensureContrast(comparison.toolA.color);
  const toolBColor = ensureContrast(comparison.toolB.color);
  const fontSizeA = fontSize(comparison.toolA.name);
  const fontSizeB = fontSize(comparison.toolB.name);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#1c1917;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="toolAGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${comparison.toolA.color};stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:${comparison.toolA.color};stop-opacity:0" />
    </linearGradient>
    <linearGradient id="toolBGrad" x1="100%" y1="0%" x2="0%" y2="0%">
      <stop offset="0%" style="stop-color:${comparison.toolB.color};stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:${comparison.toolB.color};stop-opacity:0" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle tool color accents -->
  <rect x="0" y="0" width="600" height="630" fill="url(#toolAGrad)" opacity="0.4"/>
  <rect x="600" y="0" width="600" height="630" fill="url(#toolBGrad)" opacity="0.4"/>

  <!-- Center divider -->
  <line x1="600" y1="120" x2="600" y2="510" stroke="#4b5563" stroke-width="1" stroke-dasharray="8,8" opacity="0.5"/>

  <!-- VS circle -->
  <circle cx="600" cy="315" r="40" fill="#78350f" stroke="#d97706" stroke-width="2"/>
  <text x="600" y="325" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="#fbbf24" text-anchor="middle">VS</text>

  <!-- Tool A name -->
  <text x="300" y="300" font-family="Arial, Helvetica, sans-serif" font-size="${fontSizeA}" font-weight="bold" fill="${toolAColor}" text-anchor="middle">${toolAName}</text>

  <!-- Tool B name -->
  <text x="900" y="300" font-family="Arial, Helvetica, sans-serif" font-size="${fontSizeB}" font-weight="bold" fill="${toolBColor}" text-anchor="middle">${toolBName}</text>

  <!-- Category badge -->
  <rect x="${600 - category.length * 6 - 20}" y="400" width="${category.length * 12 + 40}" height="36" rx="18" fill="#78350f" stroke="#d97706" stroke-width="1"/>
  <text x="600" y="424" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#fbbf24" text-anchor="middle">${category}</text>

  <!-- Subtitle -->
  <text x="600" y="480" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Feature Comparison, Pros/Cons, and Verdict</text>

  <!-- Branding -->
  <text x="600" y="570" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#d97706" text-anchor="middle">devops-daily.com</text>

  <!-- Top accent line -->
  <rect x="0" y="0" width="600" height="4" fill="${toolAColor}"/>
  <rect x="600" y="0" width="600" height="4" fill="${toolBColor}"/>
</svg>`;
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
