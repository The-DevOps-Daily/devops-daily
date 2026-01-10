#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

interface BlurData {
  [imagePath: string]: string; // base64 blur placeholder
}

async function generateBlurPlaceholder(imagePath: string): Promise<string> {
  try {
    const buffer = await sharp(imagePath)
      .resize(10, 10, { fit: 'inside' })
      .blur()
      .toBuffer();

    const base64 = buffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error(`Error generating blur placeholder for ${imagePath}:`, error);
    return '';
  }
}

async function getAllImageFiles(dir: string): Promise<string[]> {
  const images: string[] = [];
  const extensions = ['.png', '.jpg', '.jpeg', '.webp'];

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
        images.push(fullPath);
      }
    }
  }

  await walk(dir);
  return images;
}

async function main() {
  const publicDir = path.join(projectRoot, 'public');
  const cacheFile = path.join(projectRoot, '.blur-cache.json');

  console.log('🔍 Scanning for images...');
  const imagePaths = await getAllImageFiles(publicDir);
  console.log(`Found ${imagePaths.length} images`);

  // Load existing cache
  let existingCache: BlurData = {};
  try {
    const cacheContent = await fs.readFile(cacheFile, 'utf-8');
    existingCache = JSON.parse(cacheContent);
  } catch {
    // Cache doesn't exist yet
  }

  const blurData: BlurData = {};
  let generated = 0;
  let cached = 0;

  for (const imagePath of imagePaths) {
    const relativePath = path.relative(publicDir, imagePath);
    const publicPath = `/${relativePath.replace(/\\/g, '/')}`;

    // Check if we already have this in cache
    if (existingCache[publicPath]) {
      blurData[publicPath] = existingCache[publicPath];
      cached++;
      continue;
    }

    // Generate new blur placeholder
    const blurPlaceholder = await generateBlurPlaceholder(imagePath);
    if (blurPlaceholder) {
      blurData[publicPath] = blurPlaceholder;
      generated++;

      // Log progress every 10 images
      if (generated % 10 === 0) {
        console.log(`Generated ${generated} new blur placeholders...`);
      }
    }
  }

  // Write cache file
  await fs.writeFile(cacheFile, JSON.stringify(blurData, null, 2));

  console.log('\n✅ Blur placeholders generated:');
  console.log(`  - New: ${generated}`);
  console.log(`  - Cached: ${cached}`);
  console.log(`  - Total: ${imagePaths.length}`);
  console.log(`\n📁 Cache saved to: ${cacheFile}`);
}

main().catch(console.error);
