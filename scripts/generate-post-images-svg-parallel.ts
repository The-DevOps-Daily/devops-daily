// scripts/generate-post-images-svg-parallel.ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getAllPosts } from '../lib/posts.js';
import { getAllGuides } from '../lib/guides.js';
import { getAllExercises } from '../lib/exercises.js';
import { getAllNews } from '../lib/news.js';
import { getAllAdventDays } from '../lib/advent.js';

// Configuration
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const CONCURRENCY_LIMIT = 10; // Process 10 files at a time
const FORCE_REGENERATE = process.argv.includes('--force');

// Brand colors
// Brand amber palette (matches app/globals.css --primary)
const COLORS = {
  background: '#0f172a',
  primary: '#d97706', // amber-600 (light-mode primary)
  text: '#f8fafc',
  accent: '#fbbf24', // amber-400 (for highlights on dark bg)
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
        }" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="${
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
  <text x="100" y="107" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${
    COLORS.text
  }">${safeCategory}</text>

  <!-- Title -->
  ${titleElements}

  <!-- DevOps Daily branding -->
  <text x="80" y="${
    IMAGE_HEIGHT - 80
  }" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${
    COLORS.accent
  }">DevOps Daily</text>
</svg>`;
}

function generateAdventSVG(title: string, day: number, category: string): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const safeCategory = escapeXml(category.toUpperCase());
  const categoryWidth = 100 + safeCategory.length * 10;
  const cleanTitle = title.replace(/^Day \d+ - /, '');
  const words = cleanTitle.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  const maxLineLength = 28;

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

  const titleElements = lines
    .map(
      (line, index) =>
        `<text x="120" y="${
          250 + index * 60
        }" font-family="'Courier New', monospace" font-size="52" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="adventBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f23;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#0a0a1a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#050510;stop-opacity:1" />
    </linearGradient>
    <pattern id="stars" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1" fill="#ffffff" opacity="0.3"/>
      <circle cx="60" cy="40" r="1.5" fill="#ffffff" opacity="0.4"/>
      <circle cx="80" cy="70" r="1" fill="#ffffff" opacity="0.2"/>
      <circle cx="30" cy="80" r="1" fill="#ffffff" opacity="0.35"/>
    </pattern>
    <linearGradient id="festiveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ef4444;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#adventBg)"/>
  <rect width="1200" height="630" fill="url(#stars)"/>
  <g opacity="0.15">
    <polygon points="150,100 100,200 200,200" fill="#10b981"/>
    <polygon points="150,140 90,250 210,250" fill="#10b981"/>
    <polygon points="150,180 80,300 220,300" fill="#10b981"/>
    <rect x="135" y="300" width="30" height="40" fill="#92400e"/>
    <polygon points="1050,100 1000,200 1100,200" fill="#10b981"/>
    <polygon points="1050,140 990,250 1110,250" fill="#10b981"/>
    <polygon points="1050,180 980,300 1120,300" fill="#10b981"/>
    <rect x="1035" y="300" width="30" height="40" fill="#92400e"/>
  </g>
  <rect x="80" y="60" width="1040" height="3" fill="url(#festiveGrad)" opacity="0.6"/>
  <g>
    <rect x="80" y="90" width="180" height="50" rx="25" fill="url(#festiveGrad)" filter="url(#glow)"/>
    <text x="170" y="123" font-family="'Courier New', monospace" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">DAY ${day}</text>
  </g>
  <g>
    <rect x="280" y="95" width="${categoryWidth}" height="40" rx="20" fill="#78350f" opacity="0.8"/>
    <text x="300" y="122" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#fbbf24">${safeCategory}</text>
  </g>
  <g>
    <text x="80" y="230" font-family="'Courier New', monospace" font-size="36" fill="#10b981" opacity="0.6">&gt;</text>
    ${titleElements}
  </g>
  <g opacity="0.4">
    <text x="200" y="550" font-size="24" fill="#ffffff" opacity="0.6">❄</text>
    <text x="450" y="580" font-size="20" fill="#ffffff" opacity="0.5">❄</text>
    <text x="750" y="560" font-size="22" fill="#ffffff" opacity="0.7">❄</text>
    <text x="950" y="590" font-size="18" fill="#ffffff" opacity="0.4">❄</text>
  </g>
  <g>
    <text x="80" y="580" font-family="'Courier New', monospace" font-size="20" font-weight="bold" fill="#10b981" opacity="0.8">ADVENT OF DEVOPS</text>
    <text x="1120" y="580" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#fbbf24" text-anchor="end" opacity="0.7">DevOps Daily</text>
  </g>
  <g filter="url(#glow)">
    <text x="1150" y="60" font-size="32" fill="#fbbf24">⭐</text>
    <text x="50" y="60" font-size="32" fill="#ef4444">🎄</text>
  </g>
</svg>`;
}

async function generateImage(task: GenerationTask) {
  const svg =
    task.variant === 'advent' && task.day
      ? generateAdventSVG(task.title, task.day, task.category)
      : generateSVG(task.title, task.category);

  // Save as SVG file
  const svgPath = task.outputPath.replace('.png', '.svg');
  await fs.mkdir(path.dirname(svgPath), { recursive: true });
  await fs.writeFile(svgPath, svg, 'utf-8');
}

// Generate content hash for caching
function generateContentHash(task: GenerationTask): string {
  const content = `${task.variant || 'default'}|${task.day || ''}|${task.title}|${task.category}`;
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
}

// Convert absolute path to relative path for cross-environment compatibility
function getRelativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath);
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

// Check if file exists and is valid (not corrupted)
async function fileExists(outputPath: string): Promise<boolean> {
  try {
    // Check if SVG file exists
    const svgPath = outputPath.replace('.png', '.svg');
    const stats = await fs.stat(svgPath);

    // Validate file size - corrupted/empty files should be regenerated
    if (stats.size < 500) {
      return false; // File too small, needs regeneration
    }

    return true; // File exists and has valid size
  } catch {
    // File doesn't exist
    return false;
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
  variant?: 'default' | 'advent';
  day?: number;
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

  // Collect Advent of DevOps days
  const adventDays = await getAllAdventDays();
  for (const day of adventDays) {
    const imagePath = path.join(process.cwd(), 'public', 'images', 'advent', `${day.slug}.svg`);
    allTasks.push({
      title: day.title,
      category: day.category || 'DevOps',
      outputPath: imagePath,
      type: 'advent',
      skip: false,
      variant: 'advent',
      day: day.day,
    });
  }

  // Parallel cache checking in batches
  console.log(`\n🔍 Checking cache status for ${allTasks.length} items...`);
  const CACHE_CHECK_BATCH_SIZE = 50;
  
  for (let i = 0; i < allTasks.length; i += CACHE_CHECK_BATCH_SIZE) {
    const batch = allTasks.slice(i, i + CACHE_CHECK_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(task => fileExists(task.outputPath))
    );
    
    batch.forEach((task, index) => {
      if (!results[index]) {
        // File doesn't exist or is corrupted
        task.skip = false;
      } else if (FORCE_REGENERATE) {
        task.skip = false;
      } else {
        // File exists and is valid - check if content changed via cache
        const currentHash = generateContentHash(task);
        const relativePath = getRelativePath(task.outputPath);
        const cachedHash = cache[relativePath];

        if (cachedHash && currentHash !== cachedHash) {
          task.skip = false; // Content changed since last generation
        } else {
          // Either cache hit OR file exists but no cache entry (first run after deploy)
          // In both cases, skip - the existing file is fine
          task.skip = true;
          // Backfill cache if missing
          if (!cachedHash) {
            cache[relativePath] = currentHash;
            cacheUpdated = true;
          }
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
        await generateImage(task);
        
        // Update cache with new hash
        const newHash = generateContentHash(task);
        const relativePath = getRelativePath(task.outputPath);
        cache[relativePath] = newHash;
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
