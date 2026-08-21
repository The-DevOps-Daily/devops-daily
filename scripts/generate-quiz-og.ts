#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { buildContentCoverSvg, convertSvgToPng } from './og-utils';

interface QuizOGOptions {
  title: string;
  category: string;
  slug: string;
  theme?: 'default' | 'security' | 'devops' | 'cloud' | 'sre';
}

const SUPPORTED_THEMES = ['default', 'security', 'devops', 'cloud', 'sre'] as const;

/**
 * Generate quiz OG image
 */
async function generateQuizOG(options: QuizOGOptions): Promise<void> {
  const { title, category, slug, theme = 'default' } = options;

  // Validate inputs
  if (!title || !category || !slug) {
    throw new Error('Missing required parameters: title, category, and slug are required');
  }

  if (!SUPPORTED_THEMES.includes(theme)) {
    throw new Error(`Invalid theme: ${theme}. Available themes: ${SUPPORTED_THEMES.join(', ')}`);
  }

  // Paths
  const outputSvgPath = path.join(process.cwd(), 'public', 'images', 'quizzes', `${slug}-og.svg`);
  const outputPngPath = path.join(process.cwd(), 'public', 'images', 'quizzes', `${slug}-og.png`);

  // Theme remains accepted for CLI compatibility; the shared renderer now
  // provides the consistent quiz palette and adaptive title layout.
  const svgContent = buildContentCoverSvg({ type: 'quiz', title, category });

  // Write SVG file
  await fs.writeFile(outputSvgPath, svgContent, 'utf-8');
  console.log(`✅ Created: ${outputSvgPath}`);

  // Generate PNG from SVG
  try {
    await convertSvgToPng(outputSvgPath, outputPngPath);
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
  - SVG: public/images/quizzes/{slug}-og.svg
  - PNG: public/images/quizzes/{slug}-og.png
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
