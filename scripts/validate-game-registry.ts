#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { getAllGames } from '../lib/games';

const ROOT = process.cwd();
const GAME_PAGE_DIR = path.join(ROOT, 'app', 'games');
const GAME_IMAGES_DIR = path.join(ROOT, 'public', 'images', 'games');
const COMPONENT_REGISTRY = path.join(ROOT, 'components', 'games', 'game-component-registry.ts');

interface ValidationIssue {
  label: string;
  detail: string;
}

function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function addIssue(issues: ValidationIssue[], label: string, detail: string) {
  issues.push({ label, detail });
}

function readComponentRegistrySlugs(): Set<string> {
  const source = fs.readFileSync(COMPONENT_REGISTRY, 'utf-8');
  const objectMatch = source.match(/GAME_COMPONENTS:\s*Record<string,\s*ComponentType>\s*=\s*{([\s\S]*?)};/);

  if (!objectMatch) {
    throw new Error('Could not find GAME_COMPONENTS object in game-component-registry.ts');
  }

  const slugs = new Set<string>();
  for (const match of objectMatch[1].matchAll(/['"]([^'"]+)['"]\s*:/g)) {
    slugs.add(match[1]);
  }
  return slugs;
}

function activePageExists(slug: string): boolean {
  return exists(path.join(GAME_PAGE_DIR, slug, 'page.tsx'));
}

function imagePathForSlug(slug: string): string | null {
  const candidates = [
    path.join(GAME_IMAGES_DIR, `${slug}.png`),
    path.join(GAME_IMAGES_DIR, `${slug}-og.png`),
  ];

  return candidates.find(exists) || null;
}

function pngDimensions(filePath: string): { width: number; height: number } | null {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function validateSocialImage(issues: ValidationIssue[], slug: string) {
  const imagePath = imagePathForSlug(slug);
  if (!imagePath) {
    addIssue(issues, slug, 'Missing social image in public/images/games. Expected slug.png or slug-og.png.');
    return;
  }

  if (imagePath.endsWith('.png')) {
    const dimensions = pngDimensions(imagePath);
    if (!dimensions) {
      addIssue(issues, slug, `Could not read PNG dimensions for ${path.relative(ROOT, imagePath)}`);
      return;
    }

    if (dimensions.width !== 1200 || dimensions.height !== 630) {
      addIssue(
        issues,
        slug,
        `Social PNG should be 1200x630, got ${dimensions.width}x${dimensions.height} in ${path.relative(ROOT, imagePath)}`
      );
    }
  }
}

async function main() {
  const games = await getAllGames();
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const hrefs = new Set<string>();
  const componentSlugs = readComponentRegistrySlugs();

  for (const game of games) {
    if (ids.has(game.id)) {
      addIssue(issues, game.id, 'Duplicate game id');
    }
    ids.add(game.id);

    if (!game.title.trim()) {
      addIssue(issues, game.id, 'Missing title');
    }
    if (game.description.trim().length < 50) {
      addIssue(issues, game.id, 'Description should be at least 50 characters for previews and listings');
    }
    if (!game.tags.length) {
      addIssue(issues, game.id, 'Missing tags');
    }

    if (game.isComingSoon) {
      continue;
    }

    if (!game.createdAt) {
      addIssue(issues, game.id, 'Active games should set createdAt for stable sorting');
    }

    const expectedHref = `/games/${game.id}`;
    if (game.href !== expectedHref) {
      addIssue(issues, game.id, `href should be ${expectedHref}, got ${game.href}`);
    }

    if (hrefs.has(game.href)) {
      addIssue(issues, game.id, `Duplicate href: ${game.href}`);
    }
    hrefs.add(game.href);

    if (!activePageExists(game.id)) {
      addIssue(issues, game.id, `Missing route file: app/games/${game.id}/page.tsx`);
    }

    if (!componentSlugs.has(game.id)) {
      addIssue(issues, game.id, 'Missing component registry entry for embed route');
    }

    validateSocialImage(issues, game.id);
  }

  const activeIds = new Set(games.filter((game) => !game.isComingSoon).map((game) => game.id));
  for (const componentSlug of componentSlugs) {
    if (!activeIds.has(componentSlug)) {
      addIssue(issues, componentSlug, 'Component registry contains slug not present as an active game');
    }
  }

  if (issues.length > 0) {
    console.error(`Game registry validation failed with ${issues.length} issue(s):`);
    for (const issue of issues) {
      console.error(`- ${issue.label}: ${issue.detail}`);
    }
    process.exit(1);
  }

  console.log(`Game registry validation passed for ${activeIds.size} active games.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
