import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Content arrives through pull requests. Two things must never be merged:
 * front matter that selects a code engine (`---js`, gray-matter would eval
 * it at build time) and raw HTML that the renderer would otherwise have to
 * strip (scripts, frames, handlers, redirects). Fenced code and inline code
 * are exempt because they render as text.
 */
const CONTENT_DIR = path.join(process.cwd(), 'content');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.md') || entry.name.endsWith('.mdx') ? [full] : [];
  });
}

function stripCode(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');
}

// Prose may say "JavaScript:"; only attribute values and link targets count.
const DANGEROUS =
  /<\s*(script|iframe|object|embed|base|meta|form|style|link|svg|frame|frameset|applet)\b|<[a-z][^>]*\son[a-z]+\s*=|(?:href|src|action)\s*=\s*["']?\s*(?:javascript|vbscript|data:text\/html)|\]\(\s*(?:javascript|vbscript):|data:text\/html/i;

const files = walk(CONTENT_DIR);

describe('content safety', () => {
  it('finds markdown content', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('uses only YAML front matter', () => {
    const offenders = files.filter((file) => /^---\S/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders, `code engines in front matter: ${offenders.join(', ')}`).toEqual([]);
  });

  it('contains no raw scripts, frames, handlers or redirects outside code', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const body = stripCode(fs.readFileSync(file, 'utf8'));
      const match = body.match(DANGEROUS);
      if (match) offenders.push(`${path.relative(CONTENT_DIR, file)}: ${match[0]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
