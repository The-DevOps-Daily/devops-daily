#!/usr/bin/env tsx
/**
 * Pre-commit hook script to validate OG (Open Graph) data for content files.
 *
 * Validates:
 * - Required frontmatter fields (title, excerpt/description)
 * - OG images exist (PNG or SVG) in public/images/{type}/
 *
 * Usage: tsx scripts/git-hooks/validate-og-data.ts [--staged-only]
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const ROOT_DIR = process.cwd();
const PUBLIC_IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');

// Content types and their configurations
interface ContentConfig {
  dir: string;
  imagesDir: string;
  extension: string;
  requiredFields: string[];
  descriptionFields: string[]; // Fields that can serve as og:description (in order of priority)
  slugField?: string;
  skipOgImage?: boolean; // Skip OG image validation (e.g., interview questions don't have individual pages)
}

const CONTENT_CONFIG: Record<string, ContentConfig> = {
  posts: {
    dir: 'content/posts',
    imagesDir: 'posts',
    extension: '.md',
    requiredFields: ['title', 'excerpt'],
    descriptionFields: ['excerpt'],
  },
  guides: {
    dir: 'content/guides',
    imagesDir: 'guides',
    extension: '.md',
    requiredFields: ['title', 'description'],
    descriptionFields: ['description'],
    skipOgImage: true, // Guide parts share the main guide's OG image via getSocialImagePath(guideSlug)
  },
  exercises: {
    dir: 'content/exercises',
    imagesDir: 'exercises',
    extension: '.json',
    requiredFields: ['title', 'description'],
    descriptionFields: ['description'],
    slugField: 'id',
  },
  checklists: {
    dir: 'content/checklists',
    imagesDir: 'checklists',
    extension: '.json',
    requiredFields: ['title', 'description'],
    descriptionFields: ['description'],
    slugField: 'slug',
  },
  'interview-questions': {
    dir: 'content/interview-questions',
    imagesDir: 'interview-questions',
    extension: '.json',
    requiredFields: ['title', 'question'],
    descriptionFields: ['question'],
    slugField: 'slug',
    skipOgImage: true, // Interview questions are displayed on tier pages, not individual pages
  },
  advent: {
    dir: 'content/advent-of-devops',
    imagesDir: 'advent',
    extension: '.md',
    requiredFields: ['title'],
    descriptionFields: ['excerpt', 'description'],
  },
  news: {
   dir: 'content/news',
   imagesDir: 'news',
   extension: '.md',
    requiredFields: ['title', 'summary'],
   descriptionFields: ['summary', 'description', 'excerpt'],
 },
};

interface ValidationError {
  file: string;
  errors: string[];
}

interface ValidationWarning {
  file: string;
  warnings: string[];
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getSlugFromFilename(filename: string): string {
  return path.basename(filename).replace(/\.(md|json)$/, '');
}

function ogImageExists(slug: string, imagesDir: string): boolean {
  const imageDir = path.join(PUBLIC_IMAGES_DIR, imagesDir);
  const svgPath = path.join(imageDir, `${slug}.svg`);
  const pngPath = path.join(imageDir, `${slug}.png`);
  // Also check for -og suffix pattern (used by some content types like checklists)
  const svgPathOg = path.join(imageDir, `${slug}-og.svg`);
  const pngPathOg = path.join(imageDir, `${slug}-og.png`);

  return fs.existsSync(svgPath) || fs.existsSync(pngPath) || fs.existsSync(svgPathOg) || fs.existsSync(pngPathOg);
}

function parseMarkdownFrontmatter(
  filePath: string
): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    return data;
  } catch (error) {
    console.error(`Error parsing markdown: ${filePath}`, error);
    return null;
  }
}

function parseJsonContent(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing JSON: ${filePath}`, error);
    return null;
  }
}

function getDescription(
  data: Record<string, unknown>,
  descriptionFields: string[]
): string | undefined {
  for (const field of descriptionFields) {
    const value = data[field];
    if (value && typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function validateFile(
  filePath: string,
  config: ContentConfig
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fullPath = path.join(ROOT_DIR, filePath);

  // Skip if file doesn't exist (might be deleted)
  if (!fs.existsSync(fullPath)) {
    return { errors, warnings };
  }

  // Parse content based on file type
  let data: Record<string, unknown> | null = null;
  if (config.extension === '.json') {
    data = parseJsonContent(fullPath);
  } else {
    data = parseMarkdownFrontmatter(fullPath);
  }

  if (!data) {
    errors.push('Failed to parse file content');
    return { errors, warnings };
  }

  // Check required fields
  for (const field of config.requiredFields) {
    const value = data[field];
    if (!value || (typeof value === 'string' && !value.trim())) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check for description/OG description (using any available field)
  const description = getDescription(data, config.descriptionFields);
  if (description) {
    if (description.length < 50) {
      warnings.push(
        `Description is too short (${description.length} chars). Recommended: 50-160 chars for OG description.`
      );
    } else if (description.length > 200) {
      warnings.push(
        `Description is quite long (${description.length} chars). OG descriptions are typically truncated at ~160 chars.`
      );
    }
  } else if (!config.requiredFields.some((f) => config.descriptionFields.includes(f))) {
    // Only warn if description isn't a required field
    warnings.push(
      `No description found. Consider adding one of: ${config.descriptionFields.join(', ')}`
    );
  }

  // Check title length
  const title = data.title as string | undefined;
  if (title) {
    if (title.length > 70) {
      warnings.push(
        `Title is long (${title.length} chars). May be truncated in social shares. Recommended: under 70 chars.`
      );
    }
  }

  // Get slug and check OG image
  let slug: string;
  if (config.slugField && data[config.slugField]) {
    slug = data[config.slugField] as string;
  } else {
   slug = getSlugFromFilename(filePath);
 }

 // Check for OG image
  if (!config.skipOgImage) {
    // For news files, construct the correct slug with year prefix
    let imageSlug = slug;
    if (filePath.includes('content/news/') && filePath.match(/content\/news\/(\d{4})\/week-\d+\.md$/)) {
      const yearMatch = filePath.match(/content\/news\/(\d{4})/);
      const weekMatch = slug.match(/week-(\d+)/);
      if (yearMatch && weekMatch) {
        imageSlug = `${yearMatch[1]}-${slug}`;
      }
    }
    if (!ogImageExists(imageSlug, config.imagesDir)) {
      // Check if index file for guides (guides have subdirectories)
      if (filePath.includes('guides/') && filePath.endsWith('index.md')) {
        const guideSlug = path.basename(path.dirname(filePath));
        if (!ogImageExists(guideSlug, config.imagesDir)) {
          warnings.push(
            `Missing OG image. Expected: public/images/${config.imagesDir}/${guideSlug}.{svg,png}`
          );
        }
      } else if (!filePath.endsWith('index.ts')) {
        // Skip index.ts files
        warnings.push(
          `Missing OG image. Expected: public/images/${config.imagesDir}/${imageSlug}.{svg,png}`
        );
      }
    }
  }

  return { errors, warnings };
}

function getContentType(filePath: string): string | null {
  for (const [type, config] of Object.entries(CONTENT_CONFIG)) {
    if (filePath.startsWith(config.dir) && filePath.endsWith(config.extension)) {
      return type;
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const stagedOnly = args.includes('--staged-only');

  let filesToCheck: string[] = [];

  if (stagedOnly) {
    // Get staged files only
    filesToCheck = getStagedFiles();
  } else {
    // Scan all content directories
    for (const [, config] of Object.entries(CONTENT_CONFIG)) {
      const dir = path.join(ROOT_DIR, config.dir);
      if (!fs.existsSync(dir)) continue;

      const scanDir = (dirPath: string): string[] => {
        const files: string[] = [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            files.push(...scanDir(fullPath));
          } else if (entry.name.endsWith(config.extension)) {
            files.push(path.relative(ROOT_DIR, fullPath));
          }
        }
        return files;
      };

      filesToCheck.push(...scanDir(dir));
    }
  }

  // Filter to content files only
  filesToCheck = filesToCheck.filter((f) => getContentType(f) !== null);

  if (filesToCheck.length === 0) {
    console.log('✅ No content files to validate.');
    process.exit(0);
  }

  console.log(`\n🔍 Validating OG data for ${filesToCheck.length} content file(s)...\n`);

  const validationErrors: ValidationError[] = [];
  const validationWarnings: ValidationWarning[] = [];

  for (const file of filesToCheck) {
    const contentType = getContentType(file);
    if (!contentType) continue;

    const config = CONTENT_CONFIG[contentType];
    const { errors, warnings } = validateFile(file, config);

    if (errors.length > 0) {
      validationErrors.push({ file, errors });
    }
    if (warnings.length > 0) {
      validationWarnings.push({ file, warnings });
    }
  }

  // Print warnings
  if (validationWarnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    for (const { file, warnings } of validationWarnings) {
      console.log(`  📄 ${file}`);
      for (const warning of warnings) {
        console.log(`     ⚠ ${warning}`);
      }
      console.log();
    }
  }

  // Print errors
  if (validationErrors.length > 0) {
    console.log('❌ Errors (blocking commit):\n');
    for (const { file, errors } of validationErrors) {
      console.log(`  📄 ${file}`);
      for (const error of errors) {
        console.log(`     ✗ ${error}`);
      }
      console.log();
    }
    console.log(
      '\n💡 Fix the above errors before committing. Run "npm run og:validate" to check again.\n'
    );
    process.exit(1);
  }

  if (validationWarnings.length === 0) {
    console.log('✅ All content files have valid OG data!\n');
  } else {
    console.log(`✅ Validation passed with ${validationWarnings.length} warning(s).\n`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Error running validation:', error);
  process.exit(1);
});
