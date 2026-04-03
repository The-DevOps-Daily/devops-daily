#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import type { Comparison } from '../lib/comparison-types';

const COMPARISONS_DIR = path.join(process.cwd(), 'content', 'comparisons');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'comparisons');

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 100, g: 100, b: 200 };
}

function ensureContrast(hex: string): string {
  const rgb = hexToRgb(hex);
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  if (luminance < 80) return '#94a3f8';
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
  const featureCount = comparison.features.length;
  const toolAColor = ensureContrast(comparison.toolA.color);
  const toolBColor = ensureContrast(comparison.toolB.color);
  const rawRgbA = hexToRgb(comparison.toolA.color);
  const rawRgbB = hexToRgb(comparison.toolB.color);
  const fontSizeA = fontSize(comparison.toolA.name);
  const fontSizeB = fontSize(comparison.toolB.name);

  // Pick top 3 feature categories to show as tags
  const categories = [...new Set(comparison.features.map(f => f.category))].slice(0, 3);
  const catTags = categories.map((c, i) => {
    const x = 200 + i * 280;
    return `<rect x="${x}" y="408" width="${c.length * 8 + 20}" height="26" rx="13" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" stroke-width="1"/>
    <text x="${x + c.length * 4 + 10}" y="426" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#a5b4fc" text-anchor="middle">${escapeXml(c)}</text>`;
  }).join('\n  ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0c1222;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#141830;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0c1222;stop-opacity:1" />
    </linearGradient>
    <radialGradient id="glowA" cx="30%" cy="40%" r="40%">
      <stop offset="0%" style="stop-color:${comparison.toolA.color};stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:${comparison.toolA.color};stop-opacity:0" />
    </radialGradient>
    <radialGradient id="glowB" cx="70%" cy="40%" r="40%">
      <stop offset="0%" style="stop-color:${comparison.toolB.color};stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:${comparison.toolB.color};stop-opacity:0" />
    </radialGradient>
    <filter id="softglow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="scoreGradA" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${comparison.toolA.color};stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:${comparison.toolA.color};stop-opacity:0.05" />
    </linearGradient>
    <linearGradient id="scoreGradB" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${comparison.toolB.color};stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:${comparison.toolB.color};stop-opacity:0.05" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Ambient glow -->
  <rect width="1200" height="630" fill="url(#glowA)"/>
  <rect width="1200" height="630" fill="url(#glowB)"/>

  <!-- Subtle dot grid -->
  <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
    <circle cx="15" cy="15" r="0.8" fill="#ffffff" opacity="0.07"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#dots)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="600" height="3" fill="${toolAColor}" opacity="0.8"/>
  <rect x="600" y="0" width="600" height="3" fill="${toolBColor}" opacity="0.8"/>

  <!-- Branding -->
  <text x="48" y="46" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#6366f1" opacity="0.7">devops-daily.com</text>

  <!-- Category pill top-right -->
  <rect x="${1152 - category.length * 7 - 20}" y="24" width="${category.length * 7 + 20}" height="28" rx="14" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.4)" stroke-width="1"/>
  <text x="${1152 - category.length * 3.5}" y="43" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#a5b4fc" text-anchor="middle">${category}</text>

  <!-- Tool A section -->
  <rect x="40" y="80" width="520" height="300" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(${rawRgbA.r},${rawRgbA.g},${rawRgbA.b},0.2)" stroke-width="1"/>

  <!-- Tool A colored top edge -->
  <rect x="40" y="80" width="520" height="3" rx="0" fill="${toolAColor}" opacity="0.6"/>

  <!-- Tool A name -->
  <text x="300" y="${fontSizeA > 44 ? 190 : 200}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSizeA}" font-weight="bold" fill="${toolAColor}" text-anchor="middle" filter="url(#softglow)">${toolAName}</text>

  <!-- Tool A score badge -->
  <rect x="240" y="240" width="120" height="56" rx="12" fill="url(#scoreGradA)" stroke="rgba(${rawRgbA.r},${rawRgbA.g},${rawRgbA.b},0.3)" stroke-width="1"/>
  <text x="288" y="278" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold" fill="${toolAColor}" text-anchor="middle">${comparison.verdict.toolAScore}</text>
  <text x="318" y="272" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">/5</text>

  <!-- Tool A pros count -->
  <text x="300" y="330" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">${comparison.toolA.pros.length} pros  -  ${comparison.toolA.cons.length} cons</text>

  <!-- VS badge -->
  <circle cx="600" cy="230" r="32" fill="#1e1b4b" stroke="#6366f1" stroke-width="2" opacity="0.9"/>
  <text x="600" y="238" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#c7d2fe" text-anchor="middle">VS</text>

  <!-- Tool B section -->
  <rect x="640" y="80" width="520" height="300" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(${rawRgbB.r},${rawRgbB.g},${rawRgbB.b},0.2)" stroke-width="1"/>

  <!-- Tool B colored top edge -->
  <rect x="640" y="80" width="520" height="3" rx="0" fill="${toolBColor}" opacity="0.6"/>

  <!-- Tool B name -->
  <text x="900" y="${fontSizeB > 44 ? 190 : 200}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSizeB}" font-weight="bold" fill="${toolBColor}" text-anchor="middle" filter="url(#softglow)">${toolBName}</text>

  <!-- Tool B score badge -->
  <rect x="840" y="240" width="120" height="56" rx="12" fill="url(#scoreGradB)" stroke="rgba(${rawRgbB.r},${rawRgbB.g},${rawRgbB.b},0.3)" stroke-width="1"/>
  <text x="888" y="278" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold" fill="${toolBColor}" text-anchor="middle">${comparison.verdict.toolBScore}</text>
  <text x="918" y="272" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">/5</text>

  <!-- Tool B pros count -->
  <text x="900" y="330" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">${comparison.toolB.pros.length} pros  -  ${comparison.toolB.cons.length} cons</text>

  <!-- Bottom section -->
  <rect x="0" y="394" width="1200" height="236" fill="rgba(0,0,0,0.25)"/>
  <line x1="48" y1="394" x2="1152" y2="394" stroke="#1e293b" stroke-width="1"/>

  <!-- Feature category tags -->
  ${catTags}

  <!-- Stats line -->
  <text x="600" y="480" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#cbd5e1" text-anchor="middle">${featureCount} Features  |  Pros &amp; Cons  |  Use Cases  |  Verdict</text>

  <!-- CTA button -->
  <rect x="430" y="506" width="340" height="50" rx="25" fill="#4f46e5"/>
  <rect x="430" y="506" width="340" height="50" rx="25" fill="none" stroke="#6366f1" stroke-width="1"/>
  <text x="600" y="537" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">Read the Full Comparison  &#8594;</text>

  <!-- Bottom URL -->
  <text x="600" y="596" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#475569" text-anchor="middle">devops-daily.com/comparisons/${escapeXml(comparison.slug)}</text>
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
