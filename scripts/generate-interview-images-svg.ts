// scripts/generate-interview-images-svg.ts
import fs from 'fs/promises';
import path from 'path';
import { interviewQuestions } from '../content/interview-questions/index.js';

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
  Kubernetes: '#326ce5',
  Docker: '#2496ed',
  'CI/CD': '#f97316',
  Terraform: '#7c3aed',
  Linux: '#fcc624',
  Git: '#f05032',
  AWS: '#ff9900',
  Azure: '#0078d4',
  GCP: '#4285f4',
  Security: '#ef4444',
  Networking: '#10b981',
};

// Difficulty colors
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#10b981',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
};

function generateQuestionSVG(
  title: string,
  category: string,
  difficulty: string
): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const safeCategory = escapeXml(category.toUpperCase());
  const safeDifficulty = escapeXml(difficulty.toUpperCase());

  // Word wrap for long titles
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  const maxLineLength = 30;

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
  const categoryWidth = 100 + safeCategory.length * 12;
  const difficultyWidth = 100 + safeDifficulty.length * 12;

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
  </defs>
  
  <!-- Background -->
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#bgGradient)"/>
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#grid)"/>
  
  <!-- Top badge -->
  <rect x="80" y="70" width="260" height="44" rx="22" fill="${COLORS.primary}" opacity="0.9"/>
  <text x="105" y="100" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${COLORS.text}">INTERVIEW QUESTION</text>
  
  <!-- Category and difficulty badges -->
  <rect x="80" y="130" width="${categoryWidth}" height="40" rx="20" fill="${categoryColor}" opacity="0.9"/>
  <text x="102" y="157" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${COLORS.text}">${safeCategory}</text>
  
  <rect x="${80 + categoryWidth + 15}" y="130" width="${difficultyWidth}" height="40" rx="20" fill="${difficultyColor}" opacity="0.8"/>
  <text x="${102 + categoryWidth + 15}" y="157" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="${COLORS.text}">${safeDifficulty}</text>
  
  <!-- Question mark icon -->
  <g opacity="0.12">
    <circle cx="1020" cy="400" r="150" fill="${categoryColor}" />
    <text x="1020" y="450" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="${COLORS.background}" text-anchor="middle">?</text>
  </g>
  
  <!-- Title -->
  ${titleElements}
  
  <!-- Bottom branding -->
  <text x="80" y="${IMAGE_HEIGHT - 70}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${COLORS.accent}">DevOps Daily</text>
  <text x="80" y="${IMAGE_HEIGHT - 35}" font-family="Arial, sans-serif" font-size="20" font-weight="500" fill="${COLORS.accent}" opacity="0.7">Interview Prep</text>
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
  <rect x="80" y="80" width="280" height="50" rx="25" fill="${COLORS.primary}" opacity="0.9"/>
  <text x="115" y="113" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="${COLORS.text}">INTERVIEW PREP</text>
  
  <!-- Main title -->
  <text x="80" y="230" font-family="Arial, sans-serif" font-size="62" font-weight="bold" fill="${COLORS.text}">DevOps Interview</text>
  <text x="80" y="300" font-family="Arial, sans-serif" font-size="62" font-weight="bold" fill="${COLORS.text}">Questions</text>
  
  <!-- Subtitle -->
  <text x="80" y="360" font-family="Arial, sans-serif" font-size="26" font-weight="500" fill="${COLORS.accent}">In-depth questions with code examples</text>
  
  <!-- Question mark icons -->
  <g opacity="0.1">
    <circle cx="850" cy="200" r="80" fill="${CATEGORY_COLORS.Kubernetes}" />
    <text x="850" y="240" font-family="Arial, sans-serif" font-size="100" font-weight="bold" fill="${COLORS.background}" text-anchor="middle">?</text>
    
    <circle cx="1020" cy="320" r="100" fill="${CATEGORY_COLORS.Docker}" />
    <text x="1020" y="370" font-family="Arial, sans-serif" font-size="130" font-weight="bold" fill="${COLORS.background}" text-anchor="middle">?</text>
    
    <circle cx="900" cy="480" r="70" fill="${CATEGORY_COLORS.Terraform}" />
    <text x="900" y="515" font-family="Arial, sans-serif" font-size="90" font-weight="bold" fill="${COLORS.background}" text-anchor="middle">?</text>
  </g>
  
  <!-- Bottom branding -->
  <text x="80" y="${IMAGE_HEIGHT - 70}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="${COLORS.accent}">DevOps Daily</text>
  <text x="80" y="${IMAGE_HEIGHT - 30}" font-family="Arial, sans-serif" font-size="22" font-weight="500" fill="${COLORS.accent}" opacity="0.7">Ace your next interview</text>
</svg>`;
}

async function main() {
  console.log('🎨 Generating interview question OG images...');

  const outputDir = path.join(process.cwd(), 'public', 'images', 'interview-questions');
  await fs.mkdir(outputDir, { recursive: true });

  // Generate listing page image
  const listingSvg = generateListingPageSVG();
  const listingSvgPath = path.join(outputDir, 'interview-questions-og.svg');
  await fs.writeFile(listingSvgPath, listingSvg, 'utf-8');
  console.log('✓ Generated: interview-questions-og.svg (listing page)');

  // Generate images for each question
  for (const question of interviewQuestions) {
    const svg = generateQuestionSVG(
      question.title,
      question.category,
      question.difficulty
    );

    const svgPath = path.join(outputDir, `${question.slug}-og.svg`);
    await fs.writeFile(svgPath, svg, 'utf-8');
    console.log(`✓ Generated: ${question.slug}-og.svg`);
  }

  console.log('✅ Interview question image generation complete!');
}

main().catch((error) => {
  console.error('Error generating interview question images:', error);
  process.exit(1);
});
