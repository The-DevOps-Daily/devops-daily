#!/usr/bin/env tsx
/**
 * Prune intermediate OG/image SVGs from `public/` so they do not ship to
 * Cloudflare Pages (which has a ~20,000 file deploy cap).
 *
 * Most SVGs under public/images/<section>/ are build artifacts: we generate a
 * `.svg`, convert it to the `.png` that meta tags actually reference, and then
 * the `.svg` just sits there bloating the deploy. This script deletes those,
 * and ONLY those.
 *
 * It KEEPS, conservatively:
 *   - any SVG with no PNG twin (used directly, e.g. logos/icons)
 *   - everything under public/tshirts/ (offered as downloads)
 *   - root-level public/*.svg and public/images/*.svg (logos, placeholders, sponsors)
 *   - any SVG whose served path is referenced in content/ or the app code
 *     (e.g. posts that set `ogImage: '/images/posts/<slug>.svg'`)
 *
 * Dry-run by default. Pass --execute to actually delete.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const EXECUTE = process.argv.includes('--execute');

function walk(dir: string, test: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
      out.push(...walk(full, test));
    } else if (test(full)) {
      out.push(full);
    }
  }
  return out;
}

// 1. Build a blob of everything that could reference an SVG by path.
const refDirs = ['content', 'app', 'components', 'lib'];
let refBlob = '';
for (const d of refDirs) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of walk(dir, (p) => /\.(md|mdx|ts|tsx|js|jsx|json)$/.test(p))) {
    refBlob += fs.readFileSync(f, 'utf8') + '\n';
  }
}
// also a couple of root config/data files that can reference assets
for (const f of ['next-sitemap.config.js', 'public/manifest.json', 'public/site.webmanifest']) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) refBlob += fs.readFileSync(full, 'utf8') + '\n';
}

// 2. Decide keep/delete for each public SVG.
const allSvgs = walk(PUBLIC, (p) => p.endsWith('.svg'));
const toDelete: string[] = [];
const kept: Record<string, number> = {};

function keepReason(svg: string): string | null {
  const rel = path.relative(PUBLIC, svg); // e.g. images/posts/foo.svg
  const served = '/' + rel.replace(/\\/g, '/');
  const png = svg.slice(0, -4) + '.png';

  if (!fs.existsSync(png)) return 'no-png-twin';
  if (rel.startsWith('tshirts/')) return 'tshirts-download';
  // root-level public/*.svg or public/images/*.svg (logos/placeholders/sponsors)
  const depth = rel.split('/').length;
  if (depth === 1) return 'root-asset';
  if (rel.startsWith('images/') && depth === 2) return 'root-image-asset';
  if (refBlob.includes(served)) return 'referenced-in-content';
  if (refBlob.includes(path.basename(svg))) return 'referenced-by-name';
  return null; // -> delete
}

for (const svg of allSvgs) {
  const reason = keepReason(svg);
  if (reason) kept[reason] = (kept[reason] ?? 0) + 1;
  else toDelete.push(svg);
}

// 3. Report.
console.log(`Total public SVGs: ${allSvgs.length}`);
console.log('KEPT:');
for (const [r, n] of Object.entries(kept).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(5)}  ${r}`);
console.log(`DELETE candidates: ${toDelete.length}`);
const byDir: Record<string, number> = {};
for (const f of toDelete) {
  const dir = path.dirname(path.relative(PUBLIC, f));
  byDir[dir] = (byDir[dir] ?? 0) + 1;
}
for (const [d, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(5)}  public/${d}`);
console.log('\nSample of delete list:');
for (const f of toDelete.slice(0, 8)) console.log('  ' + path.relative(ROOT, f));

if (EXECUTE) {
  for (const f of toDelete) fs.unlinkSync(f);
  console.log(`\n✅ Deleted ${toDelete.length} intermediate SVGs.`);
} else {
  console.log(`\n(dry run — pass --execute to delete ${toDelete.length} files)`);
}
