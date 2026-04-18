#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

interface FlashcardOGOptions {
  title: string;
  category: string;
  slug: string;
  cardCount: number;
  theme?: 'default' | 'security' | 'devops' | 'cloud' | 'sre';
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Split long title into multiple lines
 */
function splitTitle(title: string, maxCharsPerLine = 30): string[] {
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3); // Max 3 lines
}

/**
 * Generate title text elements for SVG
 */
function generateTitleLines(title: string): string {
  const lines = splitTitle(title);
  const baseY = 260;
  const lineHeight = 65;

  return lines
    .map((line, index) => {
      const y = baseY + index * lineHeight;
      const fontSize = lines.length === 1 ? 56 : lines.length === 2 ? 52 : 48;
      return `<text x="80" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`;
    })
    .join('\n');
}

/**
 * Generate flashcard OG image
 */
async function generateFlashcardOG(options: FlashcardOGOptions): Promise<void> {
  const { title, category, slug, cardCount } = options;

  // Validate inputs
  if (!title || !category || !slug || !cardCount) {
    throw new Error('Missing required parameters: title, category, slug, cardCount');
  }

  const outputDir = path.join(process.cwd(), 'public/images/flashcards');
  const outputSvgPath = path.join(outputDir, `${slug}-og.svg`);
  const outputPngPath = path.join(outputDir, `${slug}-og.png`);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Generate title lines
  const titleLines = generateTitleLines(title);

  // Create SVG content
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1c1917" />
      <stop offset="100%" stop-color="#292524" />
    </linearGradient>
    <linearGradient id="accent-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg-gradient)" />
  
  <!-- Grid pattern overlay -->
  <g opacity="0.1">
    <line x1="0" y1="210" x2="1200" y2="210" stroke="#ffffff" stroke-width="1"/>
    <line x1="0" y1="420" x2="1200" y2="420" stroke="#ffffff" stroke-width="1"/>
    <line x1="400" y1="0" x2="400" y2="630" stroke="#ffffff" stroke-width="1"/>
    <line x1="800" y1="0" x2="800" y2="630" stroke="#ffffff" stroke-width="1"/>
  </g>
  
  <!-- Flashcard icon -->
  <g transform="translate(80, 80)">
    <rect x="0" y="0" width="90" height="120" rx="8" fill="url(#accent-gradient)" opacity="0.8"/>
    <rect x="10" y="10" width="70" height="100" rx="4" fill="none" stroke="#ffffff" stroke-width="2"/>
    <line x1="20" y1="40" x2="70" y2="40" stroke="#ffffff" stroke-width="2"/>
    <line x1="20" y1="60" x2="70" y2="60" stroke="#ffffff" stroke-width="2"/>
    <line x1="20" y1="80" x2="70" y2="80" stroke="#ffffff" stroke-width="2"/>
  </g>
  
  <!-- Category badge -->
  <rect x="200" y="110" width="${100 + category.length * 12}" height="40" rx="20" fill="#d97706" opacity="0.9"/>
  <text x="${200 + (100 + category.length * 12) / 2}" y="136" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#ffffff" text-anchor="middle">${escapeXml(category)}</text>
  
  <!-- Title -->
  ${titleLines}
  
  <!-- Card count -->
  <text x="80" y="480" font-family="Arial, sans-serif" font-size="32" font-weight="600" fill="#fbbf24">${cardCount} Cards</text>
  
  <!-- Subtitle -->
  <text x="80" y="530" font-family="Arial, sans-serif" font-size="24" font-weight="400" fill="#9ca3af">Interactive Flashcards for DevOps Learning</text>
  
  <!-- Logo/branding -->
  <text x="1120" y="600" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#d97706" text-anchor="end">DevOps Daily</text>
</svg>`;

  // Write SVG file
  await fs.writeFile(outputSvgPath, svgContent, 'utf-8');
  console.log(`✅ Created: ${outputSvgPath}`);

  // Generate PNG from SVG via resvg (portable; no shell-out)
  try {
    const svgBuffer = await fs.readFile(outputSvgPath);
    const pngBuffer = new Resvg(svgBuffer, { fitTo: { mode: 'width', value: 1200 } })
      .render()
      .asPng();
    await fs.writeFile(outputPngPath, pngBuffer);
    console.log(`✅ Created: ${outputPngPath}`);
  } catch (error) {
    console.error(`❌ Failed to generate PNG: ${error}`);
    throw error;
  }
}

/**
 * Generate OG images for all flashcard sets
 */
async function generateAllFlashcardOGs(): Promise<void> {
  const flashcardsDir = path.join(process.cwd(), 'content/flashcards');
  const files = await fs.readdir(flashcardsDir);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const content = await fs.readFile(path.join(flashcardsDir, file), 'utf-8');
    const flashcard = JSON.parse(content);
    
    const slug = flashcard.id;
    const title = flashcard.title;
    const category = flashcard.category;
    const cardCount = flashcard.cardCount;
    
    console.log(`\n📝 Generating OG image for: ${title}`);
    
    await generateFlashcardOG({
      title,
      category,
      slug,
      cardCount,
    });
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllFlashcardOGs()
    .then(() => {
      console.log('\n✨ All flashcard OG images generated successfully!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error generating flashcard OG images:', error.message);
      process.exit(1);
    });
}

export { generateFlashcardOG, type FlashcardOGOptions };
