import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { toPortableMarkdown, CUSTOM_FENCES } from '@/lib/portable-markdown';
import { getAllPosts } from '@/lib/posts';

/**
 * Our custom fences render to an empty div that React fills in on the client.
 * An importer such as dev.to has no React, strips the empty div, and the block
 * disappears with no visible sign. The feed for those platforms converts each
 * block to plain markdown instead.
 *
 * These assert the conversions, and that no post in the corpus still carries a
 * block that would vanish.
 */

describe('toPortableMarkdown', () => {
  it('turns a terminal block into a copyable bash block', () => {
    const md = [
      '```terminal',
      '{ "title": "deploy", "prompt": "$", "steps": [',
      '  { "comment": "first" },',
      '  { "cmd": "ls -la", "output": "total 0" }',
      '] }',
      '```',
    ].join('\n');
    const out = toPortableMarkdown(md);
    expect(out).toContain('```bash');
    expect(out).toContain('# first');
    expect(out).toContain('$ ls -la');
    expect(out).toContain('total 0');
    expect(out).not.toContain('```terminal');
  });

  it('turns a diagram into a numbered list that keeps the captions', () => {
    const md = [
      '```diagram',
      '{ "type": "flow", "title": "How it flows", "nodes": [',
      '  { "label": "Start", "sub": "the beginning" },',
      '  { "label": "End" }',
      '] }',
      '```',
    ].join('\n');
    const out = toPortableMarkdown(md);
    expect(out).toContain('**How it flows**');
    expect(out).toContain('1. **Start** the beginning');
    expect(out).toContain('2. **End**');
  });

  it('turns a bar chart into a markdown table with its caption', () => {
    const md = [
      '```chart',
      '{ "type": "bar", "title": "Cost", "unit": "$", "caption": "June 2026.",',
      '  "rows": [ { "label": "A", "value": 5, "series": "x" } ] }',
      '```',
    ].join('\n');
    const out = toPortableMarkdown(md);
    expect(out).toContain('| A | 5$ | x |');
    expect(out).toContain('*June 2026.*');
  });

  it('turns a line chart into a table of series against x', () => {
    const md = [
      '```chart',
      '{ "type": "line", "x": ["a","b"], "series": [ { "name": "One", "data": [1,2] } ] }',
      '```',
    ].join('\n');
    const out = toPortableMarkdown(md);
    expect(out).toContain('| One | 1 | 2 |');
  });

  it('turns tabs into one labelled code block per tab', () => {
    const md = [
      '```tabs',
      '{ "tabs": [',
      '  { "label": "curl", "lang": "bash", "code": "curl x" },',
      '  { "label": "python", "lang": "python", "code": "requests.get()" }',
      '] }',
      '```',
    ].join('\n');
    const out = toPortableMarkdown(md);
    expect(out).toContain('**curl**');
    expect(out).toContain('```bash\ncurl x');
    expect(out).toContain('**python**');
    expect(out).toContain('requests.get()');
  });

  it('turns a github block into a plain link', () => {
    expect(toPortableMarkdown('```github\nowner/repo\n```')).toBe(
      '[owner/repo on GitHub](https://github.com/owner/repo)',
    );
    // A full URL and a bare owner/repo must reach the same link.
    expect(toPortableMarkdown('```github\nhttps://github.com/a/b\n```')).toBe(
      '[a/b on GitHub](https://github.com/a/b)',
    );
  });

  it('turns a callout into a blockquote with a bold label', () => {
    const out = toPortableMarkdown(':::warning\nBe careful **here**.\n:::');
    expect(out).toContain('> **Warning**');
    expect(out).toContain('> Be careful **here**.');
    expect(out).not.toContain(':::');
  });

  it('leaves standard code fences untouched', () => {
    const md = '```bash\necho hello\n```\n\n```hcl\nresource "a" "b" {}\n```';
    expect(toPortableMarkdown(md)).toBe(md);
  });

  it('drops a malformed block rather than failing the build', () => {
    // A build must not die because one post has a typo in its JSON.
    const out = toPortableMarkdown('Before\n\n```diagram\n{ not json\n```\n\nAfter');
    expect(out).toContain('Before');
    expect(out).toContain('After');
    expect(out).not.toContain('not json');
  });

  it('escapes a pipe so it cannot break out of a table cell', () => {
    const md = '```chart\n{ "rows": [ { "label": "a|b", "value": 1 } ] }\n```';
    expect(toPortableMarkdown(md)).toContain('a\\|b');
  });

  it('leaves no custom fence behind anywhere in the corpus', async () => {
    // The real guard. A new fence type added later fails here until it has a
    // conversion, instead of quietly vanishing from the syndicated feed.
    const posts = (await getAllPosts()) as Array<{ slug: string; content?: string }>;
    const offenders: string[] = [];
    for (const post of posts) {
      const out = toPortableMarkdown(post.content || '');
      for (const fence of CUSTOM_FENCES) {
        if (out.includes('```' + fence)) offenders.push(`${post.slug}: ${fence}`);
      }
      if (/^:::(note|tip|warning|important)/m.test(out)) offenders.push(`${post.slug}: callout`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('the syndication feed', () => {
  const FEED = path.join(process.cwd(), 'public', 'feed-devto.xml');

  beforeAll(() => {
    execFileSync('npx', ['tsx', 'scripts/generate-devto-feed.ts'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  }, 300_000);

  it('contains no block that an importer would strip to nothing', () => {
    const xml = fs.readFileSync(FEED, 'utf-8');
    // These class names are the empty divs React hydrates on our own site.
    for (const cls of ['post-diagram', 'post-terminal', 'post-tabs', 'post-chart']) {
      expect(xml, `${cls} would render as nothing off-site`).not.toContain(cls);
    }
  });

  it('gives every item a title, a link and real content', () => {
    const xml = fs.readFileSync(FEED, 'utf-8');
    const items = xml.split('<item>').slice(1);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).toContain('<title>');
      expect(item).toContain('https://devops-daily.com/posts/');
      expect(item).toContain('<content:encoded>');
    }
  });

  it('points every item back at the original as the canonical source', () => {
    const xml = fs.readFileSync(FEED, 'utf-8');
    const items = xml.split('<item>').slice(1);
    for (const item of items) {
      expect(item).toContain('Originally published at');
    }
  });

  it('carries none of the back catalogue, only posts from the floor onwards', async () => {
    // The site has 500+ posts. The feed exists to syndicate new writing, not
    // to republish years of archive on another platform as though it were new.
    const xml = fs.readFileSync(FEED, 'utf-8');
    const dates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map(
      (m) => new Date(m[1]),
    );
    expect(dates.length).toBeGreaterThan(0);
    const floor = new Date('2026-07-09T00:00:00Z');
    for (const date of dates) {
      expect(date.getTime()).toBeGreaterThanOrEqual(floor.getTime());
    }

    const posts = (await getAllPosts()) as Array<unknown>;
    expect(dates.length).toBeLessThan(posts.length);
  });

  it('leaves out any post that opted out with syndicate:false', async () => {
    const xml = fs.readFileSync(FEED, 'utf-8');
    const posts = (await getAllPosts()) as Array<{ slug: string; syndicate?: boolean }>;
    for (const post of posts) {
      if (post.syndicate === false) {
        expect(xml, `${post.slug} opted out but is in the feed`).not.toContain(
          `/posts/${post.slug}<`,
        );
      }
    }
  });
});
