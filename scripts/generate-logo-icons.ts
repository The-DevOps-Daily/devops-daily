#!/usr/bin/env node

// Generates the logo files and favicons in public/ from the terminal mark in
// lib/logo-mark.ts. Usage: npx tsx scripts/generate-logo-icons.ts

import fs from 'fs/promises';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { LOGO_MARK } from '../lib/logo-mark';

// Static files cannot follow the theme, so they use the light-mode --primary
// (hsl(32 95% 44%) in app/globals.css) on the light-mode square.
const ACCENT = '#db7706';
const SQUARE = '#09090b';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

// fullBleed fills the whole box with no rounded corners, for icons that the
// platform masks itself (iOS home screen, Android adaptive icons).
function markSvg({ fullBleed = false } = {}): string {
  const { square, chevron, cursor, strokeWidth, viewBox } = LOGO_MARK;
  const background = fullBleed
    ? `<rect width="32" height="32" fill="${SQUARE}"/>`
    : `<rect x="${square.x}" y="${square.y}" width="${square.size}" height="${square.size}" rx="${square.radius}" fill="${SQUARE}" stroke="${SQUARE}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
    background,
    `<g fill="none" stroke="${ACCENT}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    `<path d="${chevron}"/><path d="${cursor}"/>`,
    '</g></svg>',
    '',
  ].join('');
}

// At 16 px the 32-unit strokes fall between pixels and blur, so the smallest
// icon uses the same mark on a 16-unit grid with heavier, pixel-aligned strokes.
const SMALL_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">',
  `<rect width="16" height="16" rx="3" fill="${SQUARE}"/>`,
  `<g fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
  '<path d="M4 5l3 3-3 3"/><path d="M8.5 11H12"/>',
  '</g></svg>',
  '',
].join('');

async function renderPng(svg: string, size: number): Promise<Buffer> {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  return sharp(png).png({ compressionLevel: 9 }).toBuffer();
}

// An ICO file that stores each size as an embedded PNG.
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

async function main() {
  const rounded = markSvg();
  const fullBleed = markSvg({ fullBleed: true });

  const pngs: { file: string; svg: string; size: number }[] = [
    { file: 'favicon-16x16.png', svg: SMALL_SVG, size: 16 },
    { file: 'favicon-32x32.png', svg: rounded, size: 32 },
    { file: 'shortcuts/logo.png', svg: rounded, size: 96 },
    { file: 'logo.png', svg: rounded, size: 1000 },
    { file: 'apple-touch-icon.png', svg: fullBleed, size: 180 },
    { file: 'android-chrome-192x192.png', svg: fullBleed, size: 192 },
    { file: 'android-chrome-512x512.png', svg: fullBleed, size: 512 },
  ];

  await fs.writeFile(path.join(PUBLIC_DIR, 'icon.svg'), rounded);
  await fs.writeFile(path.join(PUBLIC_DIR, 'logo.svg'), rounded);
  console.log('wrote public/icon.svg, public/logo.svg');

  for (const { file, svg, size } of pngs) {
    await fs.writeFile(path.join(PUBLIC_DIR, file), await renderPng(svg, size));
    console.log(`wrote public/${file} (${size}x${size})`);
  }

  const icoImages = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      png: await renderPng(size === 16 ? SMALL_SVG : rounded, size),
    }))
  );
  await fs.writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), buildIco(icoImages));
  console.log('wrote public/favicon.ico (16, 32, 48)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
