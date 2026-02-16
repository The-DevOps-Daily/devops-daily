#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface QuizOGOptions {
  title: string;
  category: string;
  slug: string;
  theme?: 'default' | 'security' | 'devops' | 'cloud' | 'sre';
}

interface ThemeConfig {
  template: string;
  bgGradient: [string, string];
  accentGradient: [string, string];
  textColor: string;
}

const THEMES: Record<string, ThemeConfig> = {
  default: {
    template: 'quiz-template-default.svg',
    bgGradient: ['#1e1b4b', '#312e81'],
    accentGradient: ['#8b5cf6', '#a78bfa'],
    textColor: '#a78bfa',
  },
  security: {
    template: 'quiz-template-security.svg',
    bgGradient: ['#5b21b6', '#1e40af'],
    accentGradient: ['#8b5cf6', '#60a5fa'],
    textColor: '#a78bfa',
  },
  devops: {
    template: 'quiz-template-devops.svg',
    bgGradient: ['#c2410c', '#b45309'],
    accentGradient: ['#fb923c', '#fbbf24'],
    textColor: '#fbbf24',
  },
  cloud: {
    template: 'quiz-template-cloud.svg',
    bgGradient: ['#1e3a8a', '#1e40af'],
    accentGradient: ['#3b82f6', '#60a5fa'],
    textColor: '#60a5fa',
  },
  sre: {
    template: 'quiz-template-sre.svg',
    bgGradient: ['#991b1b', '#c2410c'],
    accentGradient: ['#ef4444', '#fb923c'],
    textColor: '#fb923c',
  },
};

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
  const baseY = 280;
  const lineHeight = 65;

  return lines
    .map((line, index) => {
      const y = baseY + index * lineHeight;
      const fontSize = lines.length === 1 ? 56 : lines.length === 2 ? 52 : 48;
      return `  <!-- Title line ${index + 1} -->
  <text x="80" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`;
    })
    .join('\n');
}

/**
 * Calculate badge width based on category length
 */
function calculateBadgeWidth(category: string): number {
  const baseWidth = 100;
  const charWidth = 12; // Approximate width per character
  return baseWidth + category.length * charWidth;
}

/**
 * Generate quiz OG image
 */
async function generateQuizOG(options: QuizOGOptions): Promise<void> {
  const { title, category, slug, theme = 'default' } = options;

  // Validate inputs
  if (!title || !category || !slug) {
    throw new Error('Missing required parameters: title, category, and slug are required');
  }

  const themeConfig = THEMES[theme];
  if (!themeConfig) {
    throw new Error(`Invalid theme: ${theme}. Available themes: ${Object.keys(THEMES).join(', ')}`);
  }

  // Paths
  const templatePath = path.join(process.cwd(), 'templates', 'svg', themeConfig.template);
  const outputSvgPath = path.join(process.cwd(), 'public', 'images', 'games', `${slug}-og.svg`);
  const outputPngPath = path.join(process.cwd(), 'public', 'images', 'games', `${slug}-og.png`);

  // Read template
  let svgContent = await fs.readFile(templatePath, 'utf-8');

  // Calculate badge width
  const badgeWidth = calculateBadgeWidth(category);

  // Generate title lines
  const titleLines = generateTitleLines(title);

  // Replace placeholders
  svgContent = svgContent
    .replace(/{{TITLE}}/g, escapeXml(title))
    .replace(/{{CATEGORY}}/g, escapeXml(category))
    .replace(/{{BADGE_WIDTH}}/g, badgeWidth.toString())
    .replace(/{{TITLE_LINES}}/g, titleLines);

  // Write SVG file
  await fs.writeFile(outputSvgPath, svgContent, 'utf-8');
  console.log(`✅ Created: ${outputSvgPath}`);

  // Generate PNG from SVG
  try {
    execSync(`pnpm svg2png "${outputSvgPath}"`, { stdio: 'inherit' });
    console.log(`✅ Created: ${outputPngPath}`);
  } catch (error) {
    console.error(`❌ Failed to generate PNG: ${error}`);
    throw error;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): QuizOGOptions {
  const args = process.argv.slice(2);
  const options: Partial<QuizOGOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--title' && nextArg) {
      options.title = nextArg;
      i++;
    } else if (arg === '--category' && nextArg) {
      options.category = nextArg;
      i++;
    } else if (arg === '--slug' && nextArg) {
      options.slug = nextArg;
      i++;
    } else if (arg === '--theme' && nextArg) {
      options.theme = nextArg as QuizOGOptions['theme'];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!options.title || !options.category || !options.slug) {
    console.error('❌ Error: Missing required arguments\n');
    printHelp();
    process.exit(1);
  }

  return options as QuizOGOptions;
}

/**
 * Print usage help
 */
function printHelp(): void {
  console.log(`
Quiz OG Image Generator

Usage:
  pnpm generate-quiz-og --title "Quiz Title" --category "Category" --slug "quiz-slug" [--theme theme]

Options:
  --title      Quiz title (required)
  --category   Quiz category badge text (required)
  --slug       Output filename slug (required)
  --theme      Theme template (optional)
               Available: default, security, devops, cloud, sre
               Default: default
  --help, -h   Show this help message

Examples:
  # Basic usage with default theme
  pnpm generate-quiz-og \\
    --title "Kubernetes Security Quiz" \\
    --category "Security" \\
    --slug "kubernetes-security-quiz"

  # Using security theme
  pnpm generate-quiz-og \\
    --title "Network & Security Fundamentals" \\
    --category "Networking/Security" \\
    --slug "network-security-quiz" \\
    --theme security

  # DevOps/CI-CD theme
  pnpm generate-quiz-og \\
    --title "Jenkins Pipeline Quiz" \\
    --category "CI/CD" \\
    --slug "jenkins-quiz" \\
    --theme devops

Output:
  - SVG: public/images/games/{slug}-og.svg
  - PNG: public/images/games/{slug}-og.png
`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  
  generateQuizOG(options)
    .then(() => {
      console.log('\n✨ Quiz OG images generated successfully!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error generating quiz OG images:', error.message);
      process.exit(1);
    });
}

export { generateQuizOG, type QuizOGOptions };
