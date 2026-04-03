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

function generateSVG(comparison: Comparison): string {
  const toolAName = escapeXml(comparison.toolA.name);
  const toolBName = escapeXml(comparison.toolB.name);
  const category = escapeXml(comparison.category);
  const featureCount = comparison.features.length;

  // Ensure colors have enough contrast against dark background
  function ensureContrast(hex: string): string {
    const rgb = hexToRgb(hex);
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
    // If too dark (like #000000 for Vercel), lighten it
    if (luminance < 80) return '#a0a0ff';
    // If too bright/washed out (like #FFEC6E, #FBF0DF), make it more saturated
    if (luminance > 200) {
      return `rgb(${Math.min(255, rgb.r)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 80)})`;
    }
    return hex;
  }

  const toolAColor = ensureContrast(comparison.toolA.color);
  const toolBColor = ensureContrast(comparison.toolB.color);
  const rgbA = hexToRgb(comparison.toolA.color);
  const rgbB = hexToRgb(comparison.toolB.color);

  // Auto-scale font size for long tool names
  function fontSize(name: string): number {
    if (name.length > 20) return 32;
    if (name.length > 15) return 38;
    if (name.length > 10) return 46;
    return 56;
  }

  const fontSizeA = fontSize(comparison.toolA.name);
  const fontSizeB = fontSize(comparison.toolB.name);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="glowA" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${toolAColor};stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:${toolAColor};stop-opacity:0" />
    </linearGradient>
    <linearGradient id="glowB" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${toolBColor};stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:${toolBColor};stop-opacity:0" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Ambient glow from each tool's color -->
  <ellipse cx="250" cy="280" rx="350" ry="300" fill="url(#glowA)"/>
  <ellipse cx="950" cy="280" rx="350" ry="300" fill="url(#glowB)"/>

  <!-- Grid pattern overlay -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.3" opacity="0.05"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)"/>

  <!-- Top accent lines -->
  <rect x="0" y="0" width="600" height="4" fill="${toolAColor}"/>
  <rect x="600" y="0" width="600" height="4" fill="${toolBColor}"/>

  <!-- Branding top-left -->
  <text x="40" y="50" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="#6366f1" opacity="0.8">devops-daily.com</text>

  <!-- Category badge top-right -->
  <rect x="${1160 - category.length * 7.5 - 24}" y="28" width="${category.length * 7.5 + 24}" height="30" rx="15" fill="rgba(99,102,241,0.15)" stroke="#6366f1" stroke-width="1" opacity="0.8"/>
  <text x="${1160 - category.length * 3.75}" y="48" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#a5b4fc" text-anchor="middle" opacity="0.9">${category}</text>

  <!-- Tool A card -->
  <rect x="40" y="90" width="520" height="280" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(${rgbA.r},${rgbA.g},${rgbA.b},0.3)" stroke-width="1.5"/>
  <text x="300" y="220" font-family="Arial, Helvetica, sans-serif" font-size="${fontSizeA}" font-weight="bold" fill="${toolAColor}" text-anchor="middle" filter="url(#glow)">${toolAName}</text>
  <text x="300" y="310" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="bold" fill="${toolAColor}" text-anchor="middle" opacity="0.8">${comparison.verdict.toolAScore}</text>
  <text x="332" y="310" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#64748b" opacity="0.6">/5</text>

  <!-- Tool B card -->
  <rect x="640" y="90" width="520" height="280" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(${rgbB.r},${rgbB.g},${rgbB.b},0.3)" stroke-width="1.5"/>
  <text x="900" y="220" font-family="Arial, Helvetica, sans-serif" font-size="${fontSizeB}" font-weight="bold" fill="${toolBColor}" text-anchor="middle" filter="url(#glow)">${toolBName}</text>
  <text x="900" y="310" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="bold" fill="${toolBColor}" text-anchor="middle" opacity="0.8">${comparison.verdict.toolBScore}</text>
  <text x="932" y="310" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#64748b" opacity="0.6">/5</text>

  <!-- VS badge center -->
  <circle cx="600" cy="230" r="36" fill="#1e1b4b" stroke="#6366f1" stroke-width="2"/>
  <text x="600" y="240" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="#a5b4fc" text-anchor="middle">VS</text>

  <!-- Bottom section -->
  <rect x="0" y="420" width="1200" height="210" fill="rgba(0,0,0,0.3)"/>
  <line x1="40" y1="420" x2="1160" y2="420" stroke="#334155" stroke-width="1"/>

  <!-- Feature count and stats -->
  <text x="600" y="470" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#e2e8f0" text-anchor="middle">${featureCount} Features Compared  |  Pros &amp; Cons  |  Use Cases  |  Verdict</text>

  <!-- CTA -->
  <rect x="440" y="500" width="320" height="48" rx="24" fill="#4f46e5"/>
  <text x="600" y="530" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="bold" fill="#ffffff" text-anchor="middle">Read the Full Comparison</text>

  <!-- Bottom branding -->
  <text x="600" y="600" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#475569" text-anchor="middle">devops-daily.com/comparisons</text>
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

  console.log(`\nDone! ${jsonFiles.length} SVGs generated. Run SVG-to-PNG converter next.`);
}

main().catch((err) => {
  console.error('Error generating comparison OG images:', err);
  process.exit(1);
});
