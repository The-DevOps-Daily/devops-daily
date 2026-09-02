import { NewsItem, Digest } from '../crawler/types.js';
import { formatDisplayDate } from '../utils/date.js';

/**
 * Category emoji mapping
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
 * Generate markdown digest from items
 */
export function generateMarkdown(digest: Digest): string {
  const { metadata, categories } = digest;

  // Build front matter
  const frontMatter = `---
title: "${metadata.title}"
date: "${metadata.date}"
summary: "${metadata.summary}"
---`;

  // Build content with enhanced header
  const content = `
> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---
`;

  // Build categories with emojis
  const categorySections = Object.entries(categories)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => {
      const emoji = CATEGORY_EMOJIS[category] || '📰';
      const categoryHeader = `## ${emoji} ${category}`;
      const itemsList = items.map((item) => formatNewsItem(item)).join('\n\n');
      return `${categoryHeader}\n\n${itemsList}`;
    })
    .join('\n\n---\n\n');

  return `${frontMatter}\n${content}\n${categorySections}\n`;
}

/**
 * Format a single news item
 */
function formatNewsItem(item: NewsItem): string {
  const summary = item.summary || item.excerpt.substring(0, 200);
  const date = formatDisplayDate(item.publishedAt);

  // Add tags if available
  const tagsSection =
    item.tags && item.tags.length > 0
      ? `\n  🏷️ *${item.tags.map((tag) => `\`${tag}\``).join(', ')}*`
      : '';

  return `### 📄 ${item.title}

${summary}

**📅 ${date}** • **📰 ${item.source}**${tagsSection}

${item.url ? `[**🔗 Read more**](${item.url})` : ''}`;
}

/**
 * Generate digest title
 */
export function generateTitle(week: number, year: number): string {
  return `DevOps Weekly Digest - Week ${week}, ${year}`;
}

/**
 * Generate digest summary
 */
export function generateSummary(): string {
  return '⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!';
}
