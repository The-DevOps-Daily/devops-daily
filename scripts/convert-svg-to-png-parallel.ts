import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const CONCURRENCY_LIMIT = 8; // Process 8 conversions at a time
const FORCE_REGENERATE = process.argv.includes('--force');

const DIRECTORIES = [
  { dir: path.join(PUBLIC_DIR, 'images', 'posts'), type: 'posts' },
  { dir: path.join(PUBLIC_DIR, 'images', 'guides'), type: 'guides' },
  { dir: path.join(PUBLIC_DIR, 'images', 'exercises'), type: 'exercises' },
  { dir: path.join(PUBLIC_DIR, 'images', 'news'), type: 'news' },
  { dir: path.join(PUBLIC_DIR, 'images', 'checklists'), type: 'checklists' },
];

async function convertSvgToPng(svgPath: string, pngPath: string): Promise<boolean> {
  try {
    // Read SVG file
    const svgBuffer = await fs.readFile(svgPath);

    // Convert SVG to PNG using resvg
    const resvg = new Resvg(svgBuffer, {
      background: 'rgba(255, 255, 255, 1)', // White background
      fitTo: {
        mode: 'width',
        value: 1200, // OG image standard width
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // Optimize with sharp and ensure exact dimensions
    const optimizedBuffer = await sharp(pngBuffer)
      .resize(1200, 630, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer();

    // Write PNG file
    await fs.writeFile(pngPath, optimizedBuffer);
    return true;
  } catch (error) {
    console.error(`\n❌ Error converting ${path.basename(svgPath)}:`, error);
    return false;
  }
}

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<boolean>,
  concurrency: number
): Promise<number> {
  let successCount = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(processor));
    successCount += results.filter((r) => r).length;
  }

  return successCount;
}

interface ConversionTask {
  svgPath: string;
  pngPath: string;
  type: string;
}

async function convertAllSvgImages() {
  console.log('🖼️  Converting SVG images to PNG with parallel processing...\n');
  const startTime = Date.now();

  const allTasks: ConversionTask[] = [];

  // Collect all conversion tasks
  for (const { dir, type } of DIRECTORIES) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const files = await fs.readdir(dir);
      const svgFiles = files.filter((file) => file.endsWith('.svg'));

      for (const svgFile of svgFiles) {
        const svgPath = path.join(dir, svgFile);
        const pngFile = svgFile.replace('.svg', '.png');
        const pngPath = path.join(dir, pngFile);

        // Check if PNG already exists and is newer than SVG
        if (!FORCE_REGENERATE) {
          try {
            const svgStats = await fs.stat(svgPath);
            const pngStats = await fs.stat(pngPath);

            if (pngStats.mtime > svgStats.mtime) {
              // Skip if PNG is up to date
              continue;
            }
          } catch {
            // PNG doesn't exist, proceed with conversion
          }
        }

        allTasks.push({ svgPath, pngPath, type });
      }
    } catch (error) {
      console.error(`❌ Error scanning ${type} directory:`, error);
    }
  }

  if (allTasks.length === 0) {
    console.log('✅ All PNG images are up to date!\n');
    return;
  }

  console.log(`📊 Found ${allTasks.length} SVG files to convert`);
  console.log(`⚡ Processing with concurrency limit of ${CONCURRENCY_LIMIT}\n`);

  // Track progress
  let completed = 0;
  const total = allTasks.length;

  // Process conversions in parallel
  await processBatch(
    allTasks,
    async (task) => {
      const success = await convertSvgToPng(task.svgPath, task.pngPath);
      if (success) {
        completed++;

        // Progress indicator
        const percentage = Math.round((completed / total) * 100);
        const progressBar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
        process.stdout.write(
          `\r[${progressBar}] ${percentage}% (${completed}/${total}) - ${path.basename(task.svgPath)}`
        );
      }
      return success;
    },
    CONCURRENCY_LIMIT
  );

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n\n✅ SVG to PNG conversion complete!');
  console.log(`⏱️  Total time: ${duration}s`);
  console.log(`📈 Average: ${(parseFloat(duration) / total).toFixed(3)}s per conversion`);
  console.log(`🚀 Successfully converted ${completed}/${total} images\n`);
}

// Execute the function
convertAllSvgImages().catch((error) => {
  console.error('Error converting SVG images:', error);
  process.exit(1);
});
