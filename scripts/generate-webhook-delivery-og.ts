#!/usr/bin/env tsx

/**
 * Social card for the webhook delivery simulator.
 *
 * The visual is the point: eight attempt markers positioned on a log scale, so
 * the exponential backoff is legible as spacing rather than as a list of
 * numbers. Seven fail, the eighth delivers.
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// Svix's published schedule, cumulative seconds from the first attempt.
const CUMULATIVE = [0, 5, 305, 2105, 9305, 27305, 63305, 99305];
const LABELS = ['0s', '5s', '5m', '30m', '2h', '5h', '10h', '10h'];

const TRACK_LEFT = 110;
const TRACK_WIDTH = 940;
/** Enough room for a marker, its ring, and a label under it. */
const MIN_GAP = 64;

/**
 * Log scale, or the first four markers would sit on top of each other. The two
 * 10h gaps still land close enough to overlap at the right-hand end, so a
 * minimum spacing pass pushes them apart afterwards.
 */
function markerPositions(): number[] {
  const max = Math.log(1 + CUMULATIVE[CUMULATIVE.length - 1]);
  const positions: number[] = [];
  for (const seconds of CUMULATIVE) {
    const x = TRACK_LEFT + (Math.log(1 + seconds) / max) * TRACK_WIDTH;
    const previous = positions[positions.length - 1];
    positions.push(previous === undefined ? x : Math.max(x, previous + MIN_GAP));
  }
  return positions;
}

async function generate() {
  const outputDir = path.join(process.cwd(), 'public/images/games');
  const pngPath = path.join(outputDir, 'webhook-delivery-simulator-og.png');

  const trackY = 400;
  const positions = markerPositions();
  const trackEnd = positions[positions.length - 1] + 30;

  const markers = positions.map((x, i) => {
    const last = i === positions.length - 1;
    const fill = last ? '#10b981' : '#f43f5e';
    return `
    <circle cx="${x.toFixed(1)}" cy="${trackY}" r="${last ? 13 : 9}" fill="${fill}" opacity="${last ? 1 : 0.85}"/>
    ${last ? `<circle cx="${x.toFixed(1)}" cy="${trackY}" r="22" fill="none" stroke="${fill}" stroke-width="2" opacity="0.45"/>` : ''}
    <text x="${x.toFixed(1)}" y="${trackY + 46}" font-family="ui-monospace, 'DejaVu Sans Mono', monospace" font-size="19" fill="#a1a1aa" text-anchor="middle">${LABELS[i]}</text>`;
  }).join('');

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2c70ff" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#4f46e5" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#0a0a0b" stop-opacity="0"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.055"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#0a0a0b"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <text x="110" y="132" font-family="ui-monospace, 'DejaVu Sans Mono', monospace" font-size="21" fill="#2c70ff" letter-spacing="3">INTERACTIVE SIMULATOR</text>

  <text x="110" y="216" font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="bold" fill="#fafafa">Webhook Delivery</text>
  <text x="110" y="286" font-family="Helvetica, Arial, sans-serif" font-size="42" fill="#d4d4d8">Retries, backoff and signature verification</text>

  <!-- the retry track -->
  <line x1="${TRACK_LEFT}" y1="${trackY}" x2="${trackEnd.toFixed(1)}" y2="${trackY}" stroke="#3f3f46" stroke-width="2.5"/>
  ${markers}

  <text x="110" y="${trackY - 38}" font-family="Helvetica, Arial, sans-serif" font-size="23" fill="#71717a">8 attempts over ~27 hours, spaced on a log scale</text>

  <text x="110" y="565" font-family="ui-monospace, 'DejaVu Sans Mono', monospace" font-size="20" fill="#71717a">svix-id  .  svix-timestamp  .  raw body  =  HMAC-SHA256</text>
  <text x="1090" y="565" font-family="Helvetica, Arial, sans-serif" font-size="21" fill="#71717a" text-anchor="end">DevOps Daily</text>
</svg>`;

  await fs.mkdir(outputDir, { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log(`Generated ${pngPath}`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
