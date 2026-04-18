#!/usr/bin/env tsx
/**
 * Generates the site-wide root OG image shown when anyone shares
 * https://devops-daily.com/ (homepage).
 *
 * Run with:  bun run scripts/generate-root-og.ts
 */
import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

const OUT_PNG = path.join(process.cwd(), 'public', 'og-image.png');
const OUT_SVG = path.join(process.cwd(), 'public', 'og-image.svg');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
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

  <!-- terminal window -->
  <g transform="translate(100, 110)">
    <rect x="0" y="0" width="1000" height="410" rx="8" fill="#0b1220" stroke="#fbbf24" stroke-opacity="0.25" stroke-width="1"/>
    <rect x="0" y="0" width="1000" height="44" rx="8" fill="#111827"/>
    <rect x="0" y="36" width="1000" height="8" fill="#111827"/>
    <circle cx="22" cy="22" r="7" fill="#f87171" opacity="0.8"/>
    <circle cx="44" cy="22" r="7" fill="#fbbf24" opacity="0.85"/>
    <circle cx="66" cy="22" r="7" fill="#34d399" opacity="0.85"/>
    <text x="94" y="28" font-family="Menlo, Monaco, monospace" font-size="15" fill="#9ca3af">devops-daily.com</text>

    <text x="36" y="100" font-family="Menlo, Monaco, monospace" font-size="18" fill="#34d399">$</text>
    <text x="60" y="100" font-family="Menlo, Monaco, monospace" font-size="18" fill="#9ca3af">cat about.md</text>

    <text x="36" y="200" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="700" fill="#f8fafc">Learn DevOps</text>
    <text x="36" y="280" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="700" fill="#f8fafc">by <tspan fill="#fbbf24">doing</tspan>.</text>

    <text x="36" y="340" font-family="Inter, Arial, sans-serif" font-size="22" fill="#9ca3af">30+ simulators · quizzes · exercises · weekly newsletter</text>

    <text x="36" y="385" font-family="Menlo, Monaco, monospace" font-size="15" fill="#34d399">$</text>
    <text x="52" y="385" font-family="Menlo, Monaco, monospace" font-size="15" fill="#9ca3af">open /games</text>
  </g>

  <text x="100" y="588" font-family="Menlo, Monaco, monospace" font-size="18" fill="#fbbf24" font-weight="600">DevOps Daily</text>
  <text x="1100" y="588" font-family="Menlo, Monaco, monospace" font-size="15" fill="#9ca3af" text-anchor="end">devops-daily.com</text>
</svg>`;

fs.writeFileSync(OUT_SVG, svg, 'utf-8');

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
  .render()
  .asPng();
fs.writeFileSync(OUT_PNG, png);
console.log(`Wrote ${OUT_SVG}`);
console.log(`Wrote ${OUT_PNG} (${png.byteLength} bytes)`);
