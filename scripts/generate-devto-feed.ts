// scripts/generate-devto-feed.ts
//
// A second RSS feed for platforms that import our posts, dev.to first.
//
// It exists because /feed.xml is not portable. Our custom blocks render to an
// empty div that React fills in on the client:
//
//   <div class="post-diagram" data-diagram="{...}"></div>
//
// An importer has no React, strips the empty div, and the block vanishes. A
// post loses every diagram, terminal, chart and tab set without any visible
// sign, while the text around them still refers to them.
//
// So this feed converts those blocks to plain markdown first, then to HTML.
// Standard code fences are untouched.
import fs from 'fs/promises';
import path from 'path';
import { getAllPosts } from '../lib/posts.js';
import { parseMarkdown } from '../lib/markdown.js';
import { toPortableMarkdown } from '../lib/portable-markdown.js';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
/** dev.to imports the most recent items; more than this is wasted bytes. */
const ITEM_LIMIT = 30;

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** CDATA cannot contain the closing sequence, so split it across two blocks. */
function cdata(s: string): string {
  return `<![CDATA[${s.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

interface Post {
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  date?: string;
  publishedAt?: string;
  tags?: string[];
  author?: { name?: string };
  category?: { name?: string };
}

async function build() {
  const posts = (await getAllPosts()) as Post[];

  const items = posts
    .slice()
    .sort((a, b) => {
      const da = new Date(a.publishedAt || a.date || 0).getTime();
      const db = new Date(b.publishedAt || b.date || 0).getTime();
      return db - da;
    })
    .slice(0, ITEM_LIMIT);

  if (items.length === 0) {
    throw new Error('No posts found, refusing to write an empty feed');
  }

  const rendered = items.map((post) => {
    const url = `${SITE}/posts/${post.slug}`;
    const portable = toPortableMarkdown(post.content || '');
    const html = portable ? parseMarkdown(portable) : (post.excerpt || '');

    // A visible canonical line as well as the dev.to setting. The setting is
    // what search engines act on; this is what a reader sees.
    const footer =
      `<p><em>Originally published at <a href="${url}">devops-daily.com</a>.</em></p>`;

    return `
    <item>
      <title>${cdata(post.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${new Date(post.publishedAt || post.date || Date.now()).toUTCString()}</pubDate>
      <description>${cdata(post.excerpt || '')}</description>
      ${post.author?.name ? `<dc:creator>${cdata(post.author.name)}</dc:creator>` : ''}
      ${(post.tags ?? []).map((tag) => `<category>${cdata(tag)}</category>`).join('')}
      <content:encoded>${cdata(html + footer)}</content:encoded>
    </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>DevOps Daily (syndication)</title>
    <link>${SITE}</link>
    <description>DevOps Daily posts, with interactive blocks converted to plain markdown for cross-posting.</description>
    <language>en</language>
    <atom:link href="${SITE}/feed-devto.xml" rel="self" type="application/rss+xml"/>
${rendered.join('')}
  </channel>
</rss>
`;

  const outPath = path.join(process.cwd(), 'public', 'feed-devto.xml');
  await fs.writeFile(outPath, rss, 'utf-8');
  console.log(`  feed-devto.xml  ${items.length} posts`);
}

build().catch((err) => {
  console.error('dev.to feed generation failed:', err);
  process.exit(1);
});
