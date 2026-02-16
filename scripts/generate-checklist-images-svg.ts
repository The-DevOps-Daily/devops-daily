// scripts/generate-checklist-images-svg.ts
import fs from 'fs/promises';
import path from 'path';
import { checklists } from '../content/checklists/index.js';

// Configuration
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

// Brand colors
const COLORS = {
  background: '#0f172a',
  primary: '#3b82f6',
  text: '#f8fafc',
  accent: '#60a5fa',
  secondary: '#1e293b',
};

// Category-specific colors
const CATEGORY_COLORS: Record<string, string> = {
  Security: '#ef4444',
  Cloud: '#8b5cf6',
  DevOps: '#3b82f6',
  'Infrastructure as Code': '#10b981',
};

// Difficulty colors
const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: '#10b981',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

function generateChecklistSVG(
  title: string,
  category: string,
  difficulty: string,
  itemCount: number
): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const safeTitle = escapeXml(title);
  const safeCategory = escapeXml(category.toUpperCase());
  const safeDifficulty = escapeXml(difficulty.toUpperCase());

  // Word wrap for long titles
  const words = title.split(' ');
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

  // Limit to 3 lines
  const displayLines = lines.slice(0, 3);
  if (lines.length > 3) {
    displayLines[2] = displayLines[2] + '...';
  }

  // Create text elements for each line
  const titleElements = displayLines
    .map(
      (line, index) =>
        `<text x="80" y="${
          280 + index * 65
        }" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="${
          COLORS.text
        }">${escapeXml(line)}</text>`
    )
    .join('\n');

  const categoryColor = CATEGORY_COLORS[category] || COLORS.primary;
  const difficultyColor = DIFFICULTY_COLORS[difficulty] || COLORS.accent;
  const categoryWidth = 120 + safeCategory.length * 11;
  const difficultyWidth = 120 + safeDifficulty.length * 10;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Gradient definitions -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${COLORS.background};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${COLORS.secondary};stop-opacity:1" />
    </linearGradient>
    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="40" stroke="${COLORS.accent}" stroke-width="1" opacity="0.08"/>
      <line x1="0" y1="0" x2="40" y2="0" stroke="${COLORS.accent}" stroke-width="1" opacity="0.08"/>
    </pattern>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#bgGradient)"/>
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#grid)"/>
  
  <!-- Top badges -->
  <rect x="80" y="70" width="${categoryWidth}" height="44" rx="22" fill="${categoryColor}" opacity="0.9"/>
  <text x="102" y="100" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${COLORS.text}">${safeCategory}</text>
  
  <rect x="${80 + categoryWidth + 20}" y="70" width="${difficultyWidth}" height="44" rx="22" fill="${difficultyColor}" opacity="0.8"/>
  <text x="${102 + categoryWidth + 20}" y="100" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="${COLORS.text}">${safeDifficulty}</text>
  
  <!-- Item count badge -->
  <rect x="${IMAGE_WIDTH - 180}" y="70" width="100" height="44" rx="22" fill="${COLORS.primary}" opacity="0.7"/>
  <text x="${IMAGE_WIDTH - 130}" y="100" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${COLORS.text}" text-anchor="middle">${itemCount} Items</text>
  
  <!-- Checklist icon -->
  <g opacity="0.15">
    <rect x="920" y="320" width="240" height="280" rx="12" fill="${COLORS.accent}" />
    <rect x="950" y="360" width="40" height="40" rx="8" fill="${COLORS.background}" />
    <rect x="1010" y="370" width="120" height="20" rx="4" fill="${COLORS.background}" />
    <rect x="950" y="420" width="40" height="40" rx="8" fill="${COLORS.background}" />
    <rect x="1010" y="430" width="120" height="20" rx="4" fill="${COLORS.background}" />
    <rect x="950" y="480" width="40" height="40" rx="8" fill="${COLORS.background}" />
    <rect x="1010" y="490" width="120" height="20" rx="4" fill="${COLORS.background}" />
    <polyline points="960,375 970,390 990,365" stroke="${categoryColor}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  
  <!-- Title -->
  ${titleElements}
  
  <!-- Bottom branding -->
  <text x="80" y="${IMAGE_HEIGHT - 70}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${COLORS.accent}">DevOps Daily</text>
  <text x="80" y="${IMAGE_HEIGHT - 35}" font-family="Arial, sans-serif" font-size="20" font-weight="500" fill="${COLORS.accent}" opacity="0.7">Interactive Checklists</text>
</svg>`;
}

function generateListingPageSVG(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${COLORS.background};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${COLORS.secondary};stop-opacity:1" />
    </linearGradient>
    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="40" stroke="${COLORS.accent}" stroke-width="1" opacity="0.08"/>
      <line x1="0" y1="0" x2="40" y2="0" stroke="${COLORS.accent}" stroke-width="1" opacity="0.08"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#bgGradient)"/>
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#grid)"/>
  
  <!-- Badge -->
  <rect x="80" y="80" width="220" height="50" rx="25" fill="${COLORS.primary}" opacity="0.9"/>
  <text x="110" y="113" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="${COLORS.text}">CHECKLISTS</text>
  
  <!-- Main title -->
  <text x="80" y="230" font-family="Arial, sans-serif" font-size="62" font-weight="bold" fill="${COLORS.text}">DevOps &amp; Security</text>
  <text x="80" y="300" font-family="Arial, sans-serif" font-size="62" font-weight="bold" fill="${COLORS.text}">Checklists</text>
  
  <!-- Subtitle -->
  <text x="80" y="360" font-family="Arial, sans-serif" font-size="26" font-weight="500" fill="${COLORS.accent}">Track your progress. Ensure nothing is missed.</text>
  
  <!-- Checklist icons -->
  <g opacity="0.12">
    <rect x="750" y="150" width="180" height="210" rx="10" fill="${CATEGORY_COLORS.Security}" />
    <rect x="960" y="180" width="180" height="210" rx="10" fill="${CATEGORY_COLORS.Cloud}" />
    <rect x="855" y="320" width="180" height="210" rx="10" fill="${CATEGORY_COLORS.DevOps}" />
  </g>
  
  <!-- Bottom branding -->
  <text x="80" y="${IMAGE_HEIGHT - 70}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="${COLORS.accent}">DevOps Daily</text>
  <text x="80" y="${IMAGE_HEIGHT - 30}" font-family="Arial, sans-serif" font-size="22" font-weight="500" fill="${COLORS.accent}" opacity="0.7">Interactive DevOps Resources</text>
</svg>`;
}

async function main() {
  console.log('🎨 Generating checklist OG images...');

  const outputDir = path.join(process.cwd(), 'public', 'images', 'checklists');
  await fs.mkdir(outputDir, { recursive: true });

  // Generate listing page image
  const listingSvg = generateListingPageSVG();
  const listingSvgPath = path.join(outputDir, 'checklists-og.svg');
  await fs.writeFile(listingSvgPath, listingSvg, 'utf-8');
  console.log('✓ Generated: checklists-og.svg (listing page)');

  // Generate images for each checklist
  for (const checklist of checklists) {
    const svg = generateChecklistSVG(
      checklist.title,
      checklist.category,
      checklist.difficulty,
      checklist.items.length
    );

    const svgPath = path.join(outputDir, `${checklist.slug}-og.svg`);
    await fs.writeFile(svgPath, svg, 'utf-8');
    console.log(`✓ Generated: ${checklist.slug}-og.svg`);
  }

  console.log('✅ Checklist image generation complete!');
}

main().catch((error) => {
  console.error('Error generating checklist images:', error);
  process.exit(1);
});
