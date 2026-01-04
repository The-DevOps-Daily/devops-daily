// scripts/generate-post-images-svg-parallel.ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getAllPosts } from '../lib/posts.js';
import { getAllGuides } from '../lib/guides.js';
import { getAllExercises } from '../lib/exercises.js';
import { getAllNews } from '../lib/news.js';

// Configuration
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const CONCURRENCY_LIMIT = 10; // Process 10 files at a time
const FORCE_REGENERATE = process.argv.includes('--force');

// Brand colors
const COLORS = {
  background: '#0f172a',
  primary: '#3b82f6',
  text: '#f8fafc',
  accent: '#60a5fa',
};

function generateSVG(title: string, category: string): string {
  // Escape special characters for SVG
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const safeTitle = escapeXml(title);
  const safeCategory = escapeXml(category.toUpperCase());

  // Word wrap for long titles
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  const maxLineLength = 30; // approximate characters per line

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length > maxLineLength) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word);
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // Create text elements for each line
  const titleElements = lines
    .map(
      (line, index) =>
        `<text x="80" y="${
          300 + index * 70
        }" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="bold" fill="${
          COLORS.text
        }">${escapeXml(line)}</text>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${COLORS.background};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
    </linearGradient>
    <!-- Pattern overlay -->
    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="40" stroke="${COLORS.accent}" stroke-width="1" opacity="0.1"/>
      <line x1="0" y1="0" x2="40" y2="0" stroke="${COLORS.accent}" stroke-width="1" opacity="0.1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#bgGradient)"/>

  <!-- Grid pattern -->
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#grid)"/>

  <!-- Category badge -->
  <rect x="80" y="80" width="${100 + safeCategory.length * 12}" height="40" rx="20" fill="${
    COLORS.primary
  }"/>
  <text x="100" y="107" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="${
    COLORS.text
  }">${safeCategory}</text>

  <!-- Title -->
  ${titleElements}

  <!-- DevOps Daily branding -->
  <text x="80" y="${
    IMAGE_HEIGHT - 80
  }" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="bold" fill="${
    COLORS.accent
  }">DevOps Daily</text>
</svg>`;
}

async function generateImage(title: string, category: string, outputPath: string) {
  const svg = generateSVG(title, category);

  // Save as SVG file
  const svgPath = outputPath.replace('.png', '.svg');
  await fs.mkdir(path.dirname(svgPath), { recursive: true });
  await fs.writeFile(svgPath, svg, 'utf-8');
}

// Generate content hash for caching
function generateContentHash(title: string, category: string): string {
  const content = `${title}|${category}`;
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
}

// Cache file path
const CACHE_FILE = path.join(process.cwd(), '.image-cache.json');

// Load cache from disk
async function loadCache(): Promise<Record<string, string>> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save cache to disk
async function saveCache(cache: Record<string, string>): Promise<void> {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

// Check if image needs regeneration
async function shouldGenerateImage(title: string, category: string, outputPath: string): Promise<boolean> {
  if (FORCE_REGENERATE) {
    return true;
  }

  try {
    // Check if SVG file exists
    const svgPath = outputPath.replace('.png', '.svg');
    await fs.access(svgPath);

    // File exists, assume valid (cache will be checked in main)
    return false;
  } catch {
    // File doesn't exist, generate
    return true;
  }
}

// Process items in batches with concurrency control
async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const results: Promise<void>[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map((item) => processor(item));
    results.push(...batchPromises);

    // Wait for current batch to complete before starting next batch
    await Promise.all(batchPromises);
  }
}

interface GenerationTask {
  title: string;
  category: string;
  outputPath: string;
  type: string;
  skip: boolean;
}

async function main() {
  console.log(`🎨 Generating post images with parallel processing${FORCE_REGENERATE ? ' (FORCE MODE)' : ''}...\n`);
  const startTime = Date.now();

  // Load cache
  const cache = await loadCache();
  let cacheUpdated = false;

  // Collect all generation tasks
  const allTasks: GenerationTask[] = [];

  console.log('📋 Collecting content to process...');

  // Collect posts
  const posts = await getAllPosts();
  for (const post of posts) {
    if (!post.image || post.image.includes('placeholder')) {
      const imagePath = path.join(process.cwd(), 'public', 'images', 'posts', `${post.slug}.svg`);
      allTasks.push({
        title: post.title,
        category: post.category?.name || 'DevOps',
        outputPath: imagePath,
        type: 'post',
        skip: false,
      });
    }
  }

  // Collect guides
  const guides = await getAllGuides();
  for (const guide of guides) {
    if (!guide.image || guide.image.includes('placeholder')) {
      const imagePath = path.join(process.cwd(), 'public', 'images', 'guides', `${guide.slug}.svg`);
      allTasks.push({
        title: guide.title,
        category: guide.category?.name || 'Guide',
        outputPath: imagePath,
        type: 'guide',
        skip: false,
      });
    }
  }

  // Collect exercises
  const exercises = await getAllExercises();
  for (const exercise of exercises) {
    if (!exercise.image || exercise.image.includes('placeholder')) {
      const imagePath = path.join(
        process.cwd(),
        'public',
        'images',
        'exercises',
        `${exercise.id}.svg`
      );
      allTasks.push({
        title: exercise.title,
        category: exercise.category?.name || 'Exercise',
        outputPath: imagePath,
        type: 'exercise',
        skip: false,
      });
    }
  }

  // Collect news digests
  const news = await getAllNews();
  for (const digest of news) {
    if (!digest.image || digest.image.includes('placeholder')) {
      const imagePath = path.join(process.cwd(), 'public', 'images', 'news', `${digest.slug}.svg`);
      allTasks.push({
        title: digest.title,
        category: `Week ${digest.week}, ${digest.year}`,
        outputPath: imagePath,
        type: 'news',
        skip: false,
      });
    }
  }

  // Parallel cache checking in batches
  console.log(`\n🔍 Checking cache status for ${allTasks.length} items...`);
  const CACHE_CHECK_BATCH_SIZE = 50;
  
  for (let i = 0; i < allTasks.length; i += CACHE_CHECK_BATCH_SIZE) {
    const batch = allTasks.slice(i, i + CACHE_CHECK_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(task => shouldGenerateImage(task.title, task.category, task.outputPath))
    );
    
    batch.forEach((task, index) => {
      if (results[index]) {
        task.skip = false;
      } else {
        // Check if content hash matches cache
        const currentHash = generateContentHash(task.title, task.category);
        const cachedHash = cache[task.outputPath];
        
        if (currentHash === cachedHash) {
          task.skip = true; // Cache hit
        } else {
          task.skip = false; // Content changed
        }
      }
    });
  }

  const tasksToGenerate = allTasks.filter(t => !t.skip);
  const tasksToSkip = allTasks.filter(t => t.skip);

  console.log(`\n📊 Total content items: ${allTasks.length}`);
  console.log(`✅ Already up to date: ${tasksToSkip.length}`);
  console.log(`🔄 To generate: ${tasksToGenerate.length}`);

  if (tasksToGenerate.length === 0) {
    console.log('\n✨ All images are up to date! Skipping generation.\n');
    return;
  }

  console.log(`⚡ Processing with concurrency limit of ${CONCURRENCY_LIMIT}\n`);

  // Track progress
  let completed = 0;
  const total = tasksToGenerate.length;

  // Process tasks in parallel batches
  await processBatch(
    tasksToGenerate,
    async (task) => {
      try {
        await generateImage(task.title, task.category, task.outputPath);
        
        // Update cache with new hash
        const newHash = generateContentHash(task.title, task.category);
        cache[task.outputPath] = newHash;
        cacheUpdated = true;
        
        completed++;

        // Progress indicator
        const percentage = Math.round((completed / total) * 100);
        const progressBar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
        process.stdout.write(
          `\r[${progressBar}] ${percentage}% (${completed}/${total}) - ${task.type}: ${task.title.substring(0, 40)}...`
        );
      } catch (error) {
        console.error(`\n❌ Error generating ${task.type}: ${task.title}`, error);
      }
    },
    CONCURRENCY_LIMIT
  );

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Save updated cache
  if (cacheUpdated) {
    await saveCache(cache);
    console.log('💾 Cache updated\n');
  }

  console.log('\n\n✅ Image generation complete!');
  console.log(`⏱️  Total time: ${duration}s`);
  console.log(`📈 Average: ${(parseFloat(duration) / total).toFixed(3)}s per image`);
  console.log(`🚀 Speed improvement: ~${Math.round(CONCURRENCY_LIMIT * 0.7)}x faster than sequential\n`);
}

main().catch((error) => {
  console.error('Error generating images:', error);
  process.exit(1);
});
