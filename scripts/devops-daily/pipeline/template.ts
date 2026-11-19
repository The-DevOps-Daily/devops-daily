import { NewsItem, Digest, ProjectReleases, OwnPost } from '../crawler/types.js';
import { shortDateUtc } from '../utils/date.js';
import { escapeMarkdown, markdownLink, markdownUrl } from '../utils/markdown.js';
import { cutExcerpt, firstSentence } from '../utils/text.js';

/**
 * Category emoji mapping. One emoji per section header, none per item.
 */
const CATEGORY_EMOJIS: Record<string, string> = {
  Kubernetes: '⚓',
  'Cloud Native': '☁️',
  'CI/CD': '🔄',
  IaC: '🏗️',
  Observability: '📊',
  Security: '🔐',
  Databases: '💾',
  Platforms: '🌐',
  Misc: '📰',
};

/**
 * The spot for 2-4 lines from the editor. HTML comments render as nothing,
 * so an empty spot leaves no trace on the page.
 */
export const EDITOR_INTRO_START =
  '<!-- editor-intro: 2-4 plain lines from the editor go between these markers. Empty renders nothing. -->';
export const EDITOR_INTRO_END = '<!-- /editor-intro -->';

/**
 * Generate markdown digest
 */
export function generateMarkdown(digest: Digest): string {
  const { metadata, topPicks, categories, releases, ownPosts } = digest;

  // JSON strings are valid YAML double-quoted strings, so a quote or
  // backslash in a headline cannot break the frontmatter.
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(metadata.title)}`,
    `date: ${JSON.stringify(metadata.date)}`,
    `summary: ${JSON.stringify(metadata.summary)}`,
    '---',
  ].join('\n');

  const sections: string[] = [];

  if (topPicks.length > 0) {
    const picks = topPicks.map((item) => formatItem(item, true)).join('\n\n');
    sections.push(
      `## 📌 This week in short\n\n${EDITOR_INTRO_START}\n${EDITOR_INTRO_END}\n\n${picks}`
    );
  }

  if (releases.length > 0) {
    sections.push(`## 🚀 Releases\n\n${releases.map(formatRelease).join('\n')}`);
  }

  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    const emoji = CATEGORY_EMOJIS[category] || '📰';
    const list = items.map((item) => formatItem(item, false)).join('\n\n');
    sections.push(`## ${emoji} ${category}\n\n${list}`);
  }

  if (ownPosts.length > 0) {
    sections.push(`## ✍️ From DevOps Daily this week\n\n${ownPosts.map(formatOwnPost).join('\n')}`);
  }

  return `${frontMatter}\n\n${sections.join('\n\n')}\n`;
}

/**
 * One item as one paragraph: the title as the link, then source and date,
 * then the excerpt, one per line. A top pick gets only the first sentence.
 * A paragraph, not a list item: a one-item list renders "tight", without the
 * <p> that the digest styles, so it would look different from the others.
 */
export function formatItem(item: NewsItem, short: boolean): string {
  const text = item.summary || cutExcerpt(item.excerpt);
  const line = short ? firstSentence(text) : text;
  const lines = [
    `**${markdownLink(item.title, item.url)}**`,
    `${escapeMarkdown(item.source)} · ${shortDateUtc(item.publishedAt)}`,
  ];
  if (line) lines.push(escapeMarkdown(line));
  return lines.join('\n');
}

/** "- **Grafana** [13.3.1](url) (also 13.2.6 and 13.1.10)" */
export function formatRelease(project: ProjectReleases): string {
  const [latest, ...others] = project.releases;
  const link = markdownUrl(latest.url)
    ? `[${escapeMarkdown(latest.version, false)}](${markdownUrl(latest.url)})`
    : escapeMarkdown(latest.version, false);
  const shown = others.slice(0, 5).map((r) => escapeMarkdown(r.version, false));
  const also = shown.length > 0 ? ` (also ${joinList(shown)})` : '';
  return `- **${escapeMarkdown(project.project, false)}** ${link}${also}`;
}

export function formatOwnPost(post: OwnPost): string {
  return `- [${escapeMarkdown(post.title, false)}](/posts/${post.slug})`;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Generate digest title. The series, the URLs and the covers rely on this
 * exact pattern, so the headlines go into the summary instead.
 */
export function generateTitle(week: number, year: number): string {
  return `DevOps Weekly Digest - Week ${week}, ${year}`;
}

const TRAILING_FILLER = /\s+(a|an|and|at|by|for|from|in|of|on|or|the|to|with|vs\.?)$/i;

/** A headline short enough to share a meta description with two others. */
export function shortHeadline(title: string, max = 55): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  const lead = clean.split(/:\s|\s[-–—]\s/)[0].trim();
  if (lead.length >= 12 && lead.length <= max) return lead;
  if (clean.length <= max) return clean;
  let cut = clean.slice(0, max + 1);
  cut = cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max);
  while (TRAILING_FILLER.test(cut)) cut = cut.replace(TRAILING_FILLER, '');
  return cut.replace(/[\s,;:([{-]+$/, '');
}

/**
 * A unique summary each week from the top headlines, at most `max`
 * characters: "A, B and C, plus 22 more DevOps updates from week 47." When
 * that is too long, a shorter tail is tried, then fewer headlines.
 */
export function generateSummary(top: NewsItem[], total: number, week: number, max = 155): string {
  const headlines = top.map((item) => shortHeadline(item.title)).filter(Boolean);

  for (let count = headlines.length; count >= 1; count--) {
    const rest = total - count;
    const tails =
      rest > 0
        ? [
            `, plus ${rest} more DevOps ${rest === 1 ? 'update' : 'updates'} from week ${week}.`,
            `, plus ${rest} more from week ${week}.`,
          ]
        : [`: DevOps updates from week ${week}.`];
    for (const tail of tails) {
      const summary = `${joinList(headlines.slice(0, count))}${tail}`;
      if (summary.length <= max) return summary;
    }
  }
  return `DevOps news, releases and updates from week ${week}.`;
}
