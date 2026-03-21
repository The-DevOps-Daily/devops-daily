#!/usr/bin/env node

/**
 * Check internal links in markdown content files.
 *
 * Scans posts, guides, exercises, etc. for internal links and verifies
 * the target content exists on disk. Outputs a JSON report.
 *
 * Usage:
 *   npx tsx scripts/check-internal-links.ts                  # all posts
 *   npx tsx scripts/check-internal-links.ts --category docker # filter by category/filename
 *   npx tsx scripts/check-internal-links.ts --type guides     # scan guides instead of posts
 *   npx tsx scripts/check-internal-links.ts --json            # JSON output (for agent consumption)
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

const CONTENT_DIR = join(process.cwd(), 'content');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface InternalLink {
  path: string;
  line: number;
}

interface FileReport {
  file: string;
  totalLinks: number;
  brokenLinks: { link: string; line: number; suggestion?: string }[];
  hasZeroLinks: boolean;
}

interface Report {
  filesScanned: number;
  totalLinksChecked: number;
  brokenLinkCount: number;
  zeroLinkFileCount: number;
  files: FileReport[];
}

// Map link prefixes to content paths and file extensions
const LINK_TARGETS: Record<string, { dir: string; ext: string; isDir?: boolean }> = {
  '/posts/': { dir: 'posts', ext: '.md' },
  '/guides/': { dir: 'guides', ext: '', isDir: true },
  '/exercises/': { dir: 'exercises', ext: '.json' },
  '/quizzes/': { dir: 'quizzes', ext: '.json' },
  '/categories/': { dir: 'categories', ext: '.md' },
  '/checklists/': { dir: 'checklists', ext: '.json' },
  '/flashcards/': { dir: 'flashcards', ext: '.json' },
  '/interview-questions/': { dir: 'interview-questions', ext: '.json' },
};

function extractInternalLinks(content: string): InternalLink[] {
  const links: InternalLink[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Match markdown links like [text](/posts/slug) or [text](/guides/slug/part)
    const regex = /\]\((\/(?:posts|guides|exercises|quizzes|categories|checklists|flashcards|interview-questions)\/[^\s)#]+)/g;
    let match;
    while ((match = regex.exec(lines[i])) !== null) {
      links.push({ path: match[1], line: i + 1 });
    }
  }

  return links;
}

function linkTargetExists(linkPath: string): boolean {
  // Parse the link path
  for (const [prefix, target] of Object.entries(LINK_TARGETS)) {
    if (!linkPath.startsWith(prefix)) continue;

    const slug = linkPath.slice(prefix.length).split('/')[0];

    if (target.isDir) {
      // Guides: check directory with index.md
      const guidePath = join(CONTENT_DIR, target.dir, slug, 'index.md');
      return existsSync(guidePath);
    } else {
      // Files: check slug + extension
      const filePath = join(CONTENT_DIR, target.dir, slug + target.ext);
      return existsSync(filePath);
    }
  }

  return false;
}

function findSimilarSlug(linkPath: string): string | undefined {
  for (const [prefix, target] of Object.entries(LINK_TARGETS)) {
    if (!linkPath.startsWith(prefix)) continue;

    const slug = linkPath.slice(prefix.length).split('/')[0];
    const dir = join(CONTENT_DIR, target.dir);

    if (!existsSync(dir)) return undefined;

    const files = readdirSync(dir);
    // Find files/dirs that contain part of the slug
    const slugParts = slug.split('-');
    for (const file of files) {
      const name = file.replace(/\.(md|json)$/, '');
      // Check if most words match
      const nameParts = name.split('-');
      const commonParts = slugParts.filter(p => nameParts.includes(p));
      if (commonParts.length >= Math.floor(slugParts.length * 0.6) && name !== slug) {
        return `${prefix}${name}`;
      }
    }
  }

  return undefined;
}

function getMarkdownFiles(contentType: string, categoryFilter?: string): string[] {
  const dir = join(CONTENT_DIR, contentType);
  if (!existsSync(dir)) return [];

  if (contentType === 'guides') {
    // Guides are directories with index.md + part files
    const guideDirs = readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const files: string[] = [];
    for (const guideDir of guideDirs) {
      if (categoryFilter && !guideDir.includes(categoryFilter)) continue;
      const guideFiles = readdirSync(join(dir, guideDir))
        .filter(f => f.endsWith('.md'))
        .map(f => join(dir, guideDir, f));
      files.push(...guideFiles);
    }
    return files;
  }

  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .filter(f => !categoryFilter || f.includes(categoryFilter))
    .map(f => join(dir, f));
}

function run() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const categoryIdx = args.indexOf('--category');
  const categoryFilter = categoryIdx !== -1 ? args[categoryIdx + 1] : undefined;
  const typeIdx = args.indexOf('--type');
  const contentType = typeIdx !== -1 ? args[typeIdx + 1] : 'posts';

  const files = getMarkdownFiles(contentType, categoryFilter);

  if (files.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ filesScanned: 0, totalLinksChecked: 0, brokenLinkCount: 0, zeroLinkFileCount: 0, files: [] }));
    } else {
      console.log(`No ${contentType} files found${categoryFilter ? ` matching "${categoryFilter}"` : ''}.`);
    }
    process.exit(0);
  }

  const report: Report = {
    filesScanned: files.length,
    totalLinksChecked: 0,
    brokenLinkCount: 0,
    zeroLinkFileCount: 0,
    files: [],
  };

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const links = extractInternalLinks(content);
    const relativePath = filePath.replace(process.cwd() + '/', '');

    const fileReport: FileReport = {
      file: relativePath,
      totalLinks: links.length,
      brokenLinks: [],
      hasZeroLinks: links.length === 0,
    };

    for (const link of links) {
      report.totalLinksChecked++;
      if (!linkTargetExists(link.path)) {
        const suggestion = findSimilarSlug(link.path);
        fileReport.brokenLinks.push({
          link: link.path,
          line: link.line,
          ...(suggestion ? { suggestion } : {}),
        });
        report.brokenLinkCount++;
      }
    }

    if (fileReport.hasZeroLinks) report.zeroLinkFileCount++;
    if (fileReport.brokenLinks.length > 0 || fileReport.hasZeroLinks) {
      report.files.push(fileReport);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report, contentType, categoryFilter);
  }

  // Exit with error code if broken links found
  process.exit(report.brokenLinkCount > 0 ? 1 : 0);
}

function printHumanReport(report: Report, contentType: string, categoryFilter?: string) {
  console.log(`\n${BOLD}Internal Link Check Report${RESET}`);
  console.log(`Content type: ${contentType}${categoryFilter ? ` (filter: ${categoryFilter})` : ''}\n`);
  console.log(`  Files scanned:        ${report.filesScanned}`);
  console.log(`  Internal links found: ${report.totalLinksChecked}`);
  console.log(`  Broken links:         ${report.brokenLinkCount > 0 ? RED : GREEN}${report.brokenLinkCount}${RESET}`);
  console.log(`  Files with 0 links:   ${report.zeroLinkFileCount > 0 ? YELLOW : GREEN}${report.zeroLinkFileCount}${RESET}`);
  console.log();

  // Broken links
  const brokenFiles = report.files.filter(f => f.brokenLinks.length > 0);
  if (brokenFiles.length > 0) {
    console.log(`${RED}${BOLD}Broken Internal Links:${RESET}`);
    for (const file of brokenFiles) {
      for (const broken of file.brokenLinks) {
        console.log(`  ${file.file}:${broken.line}`);
        console.log(`    ${RED}✗${RESET} ${broken.link}`);
        if (broken.suggestion) {
          console.log(`    ${CYAN}→ Did you mean: ${broken.suggestion}${RESET}`);
        }
      }
    }
    console.log();
  }

  // Zero-link files (show first 20)
  const zeroLinkFiles = report.files.filter(f => f.hasZeroLinks);
  if (zeroLinkFiles.length > 0) {
    console.log(`${YELLOW}${BOLD}Files with no internal links (${zeroLinkFiles.length}):${RESET}`);
    const show = zeroLinkFiles.slice(0, 20);
    for (const file of show) {
      console.log(`  ${YELLOW}○${RESET} ${file.file}`);
    }
    if (zeroLinkFiles.length > 20) {
      console.log(`  ... and ${zeroLinkFiles.length - 20} more`);
    }
    console.log();
  }

  if (report.brokenLinkCount === 0 && report.zeroLinkFileCount === 0) {
    console.log(`${GREEN}✓ All links valid, all files have internal links.${RESET}\n`);
  }
}

run();
