// scripts/generate-post-images-svg.ts
import fs from 'fs/promises';
import path from 'path';
import { getAllPosts } from '../lib/posts.js';
import { getAllGuides } from '../lib/guides.js';
import { getAllExercises } from '../lib/exercises.js';
import { getAllNews } from '../lib/news.js';
import { getAllAdventDays } from '../lib/advent.js';

// Configuration
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

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

  // Word wrap for long titles
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
        }" font-family="'SF Mono', 'Monaco', 'Inconsolata', monospace" font-size="52" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join('\n');

  const template = `<?xml version="1.0" encoding="UTF-8"?>
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
    <text x="170" y="123" font-family="'SF Mono', 'Monaco', 'Inconsolata', monospace" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">DAY ${day}</text>
  </g>
  <g>
    <rect x="280" y="95" width="${categoryWidth}" height="40" rx="20" fill="#1e3a8a" opacity="0.8"/>
    <text x="300" y="122" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#60a5fa">${safeCategory}</text>
  </g>
  <g>
    <text x="80" y="230" font-family="'SF Mono', 'Monaco', 'Inconsolata', monospace" font-size="36" fill="#10b981" opacity="0.6">&gt;</text>
    ${titleElements}
  </g>
  <g opacity="0.4">
    <text x="200" y="550" font-size="24" fill="#ffffff" opacity="0.6">❄</text>
    <text x="450" y="580" font-size="20" fill="#ffffff" opacity="0.5">❄</text>
    <text x="750" y="560" font-size="22" fill="#ffffff" opacity="0.7">❄</text>
    <text x="950" y="590" font-size="18" fill="#ffffff" opacity="0.4">❄</text>
  </g>
  <g>
    <text x="80" y="580" font-family="'SF Mono', 'Monaco', 'Inconsolata', monospace" font-size="20" font-weight="bold" fill="#10b981" opacity="0.8">ADVENT OF DEVOPS</text>
    <text x="1120" y="580" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#60a5fa" text-anchor="end" opacity="0.7">DevOps Daily</text>
  </g>
  <g filter="url(#glow)">
    <text x="1150" y="60" font-size="32" fill="#fbbf24">⭐</text>
    <text x="50" y="60" font-size="32" fill="#ef4444">🎄</text>
  </g>
</svg>`;

  return template;
}

async function generateImage(title: string, category: string, outputPath: string) {
  const svg = generateSVG(title, category);

  // Save as SVG file
  const svgPath = outputPath.replace('.png', '.svg');
  await fs.mkdir(path.dirname(svgPath), { recursive: true });
  await fs.writeFile(svgPath, svg, 'utf-8');

  // Note: For now we'll save as SVG. You can convert to PNG using sharp or another tool if needed
}

async function generateAdventImage(
  title: string,
  day: number,
  category: string,
  outputPath: string
) {
  const svg = generateAdventSVG(title, day, category);
  const svgPath = outputPath.replace('.png', '.svg');
  await fs.mkdir(path.dirname(svgPath), { recursive: true });
  await fs.writeFile(svgPath, svg, 'utf-8');
}

async function main() {
  console.log('🎨 Generating post images...');

  // Generate images for posts
  const posts = await getAllPosts();
  for (const post of posts) {
    if (!post.image || post.image.includes('placeholder')) {
      const imagePath = path.join(process.cwd(), 'public', 'images', 'posts', `${post.slug}.svg`);
      await generateImage(post.title, post.category?.name || 'DevOps', imagePath);
      console.log(`✓ Generated image for: ${post.title}`);
    }
  }

  // Generate images for guides
  const guides = await getAllGuides();
  for (const guide of guides) {
    if (!guide.image || guide.image.includes('placeholder')) {
      const imagePath = path.join(process.cwd(), 'public', 'images', 'guides', `${guide.slug}.svg`);
      await generateImage(guide.title, guide.category?.name || 'Guide', imagePath);
      console.log(`✓ Generated image for: ${guide.title}`);
    }
  }

  // Generate images for exercises
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
      await generateImage(exercise.title, exercise.category?.name || 'Exercise', imagePath);
      console.log(`✓ Generated image for exercise: ${exercise.title}`);
    }
  }

  // Generate images for news digests
  const news = await getAllNews();
  for (const digest of news) {
    if (!digest.image || digest.image.includes('placeholder')) {
      const imagePath = path.join(process.cwd(), 'public', 'images', 'news', `${digest.slug}.svg`);
      await generateImage(
        digest.title,
        `Week ${digest.week}, ${digest.year}`,
        imagePath
      );
      console.log(`✓ Generated image for news: ${digest.title}`);
    }
  }

  // Generate images for Advent of DevOps
  console.log('🎄 Generating Advent of DevOps images...');
  const adventDays = await getAllAdventDays();
  for (const day of adventDays) {
    const imagePath = path.join(process.cwd(), 'public', 'images', 'advent', `${day.slug}.svg`);
    await generateAdventImage(day.title, day.day, day.category || 'DevOps', imagePath);
    console.log(`✓ Generated advent image for: Day ${day.day} - ${day.title}`);
  }

  console.log('✅ Image generation complete!');
}

main().catch((error) => {
  console.error('Error generating images:', error);
  process.exit(1);
});
