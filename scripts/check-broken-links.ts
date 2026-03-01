import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';

const OUT_DIR = path.join(process.cwd(), 'out');

interface BrokenLink {
  file: string;
  link: string;
  target: string;
}

function normalizePath(href: string): string {
  if (href !== '/' && href.endsWith('/')) {
    href = href.slice(0, -1);
  }
  return href.split('#')[0];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getHtmlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

async function extractInternalLinks(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const dom = new JSDOM(content);
  const links: string[] = [];

  const anchors = dom.window.document.querySelectorAll('a[href]');

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) return;

    if (href.startsWith('/') && !href.startsWith('//')) {
      links.push(normalizePath(href));
    }
  });

  return [...new Set(links)];
}

function resolveLink(link: string): string[] {
  const possiblePaths: string[] = [];

  const cleanLink = link.startsWith('/') ? link.slice(1) : link;

  if (cleanLink === '' || cleanLink === '/') {
    possiblePaths.push(path.join(OUT_DIR, 'index.html'));
  } else {
    possiblePaths.push(path.join(OUT_DIR, cleanLink, 'index.html'));
    possiblePaths.push(path.join(OUT_DIR, `${cleanLink}.html`));
    possiblePaths.push(path.join(OUT_DIR, cleanLink));
  }

  return possiblePaths;
}

async function main() {
  console.log('🔍 Checking for broken internal links in static build...');

  if (!(await fileExists(OUT_DIR))) {
    console.error('❌ Error: out/ directory not found. Run `pnpm build` first.');
    process.exit(1);
  }

  const htmlFiles = await getHtmlFiles(OUT_DIR);
  console.log(`📄 Found ${htmlFiles.length} HTML files\n`);

  const brokenLinks: BrokenLink[] = [];
  const checkedLinks = new Set<string>();

  for (const file of htmlFiles) {
    const relativePath = path.relative(OUT_DIR, file);
    const links = await extractInternalLinks(file);

    for (const link of links) {
      if (checkedLinks.has(link)) continue;
      checkedLinks.add(link);

      const possiblePaths = resolveLink(link);
      let found = false;

      for (const possiblePath of possiblePaths) {
        if (await fileExists(possiblePath)) {
          found = true;
          break;
        }
      }

      if (!found) {
        brokenLinks.push({
          file: relativePath,
          link,
          target: possiblePaths[0],
        });
      }
    }
  }

  if (brokenLinks.length > 0) {
    console.error(`❌ Found ${brokenLinks.length} broken internal link(s):\n`);

    const linkGroups = new Map<string, BrokenLink[]>();
    brokenLinks.forEach((item) => {
      if (!linkGroups.has(item.link)) {
        linkGroups.set(item.link, []);
      }
      linkGroups.get(item.link)!.push(item);
    });

    linkGroups.forEach((items, link) => {
      console.error(`  🔗 ${link}`);
      console.error(`     Referenced in ${items.length} file(s)`);
      console.error(`     Example: ${items[0].file}\n`);
    });

    process.exit(1);
  }

  console.log('✅ No broken internal links found!');
  console.log(`✓ Checked ${checkedLinks.size} unique internal links`);
}

main().catch((error) => {
  console.error('Error checking links:', error);
  process.exit(1);
});
