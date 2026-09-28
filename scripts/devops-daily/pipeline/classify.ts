import { NewsItem, Classification } from '../crawler/types.js';

/**
 * Keyword-based classification: pick a category from the title and excerpt,
 * and drop event announcements.
 */
function classifyItem(item: NewsItem): Classification {
  const titleLower = item.title.toLowerCase();
  const excerptLower = item.excerpt.toLowerCase();
  const combined = `${titleLower} ${excerptLower}`;

  // Exclude event announcements
  if (
    titleLower.includes('is coming!') ||
    titleLower.match(/\b(conference|event|meetup)\s+\d{4}\b/)
  ) {
    return {
      include: false,
      category: 'Misc',
      tags: ['event'],
      summary: item.excerpt.substring(0, 200),
    };
  }

  let category = item.category || 'Misc';

  if (combined.match(/\b(kubernetes|k8s|kubectl|helm|kube)\b/)) {
    category = 'Kubernetes';
  } else if (combined.match(/\b(docker|container|cncf|cloud native|service mesh|istio|envoy)\b/)) {
    category = 'Cloud Native';
  } else if (combined.match(/\b(ci\/cd|cicd|github actions|gitlab|jenkins|argo|flux)\b/)) {
    category = 'CI/CD';
  } else if (combined.match(/\b(terraform|pulumi|ansible|iac|infrastructure as code)\b/)) {
    category = 'IaC';
  } else if (
    combined.match(/\b(monitoring|observability|prometheus|grafana|datadog|logging|tracing)\b/)
  ) {
    category = 'Observability';
  } else if (combined.match(/\b(security|vulnerability|cve|secrets|compliance)\b/)) {
    category = 'Security';
  } else if (combined.match(/\b(database|postgres|mysql|mongodb|redis|sql)\b/)) {
    category = 'Databases';
  } else if (combined.match(/\b(aws|azure|gcp|cloud|platform)\b/)) {
    category = 'Platforms';
  }

  return {
    include: true,
    category,
    tags: [],
    summary: item.excerpt.substring(0, 200),
  };
}

/**
 * Classify all items and drop the ones marked as excluded.
 */
export function classifyItems(items: NewsItem[]): NewsItem[] {
  const classified = items.map((item) => {
    const classification = classifyItem(item);
    return {
      ...item,
      category: classification.category,
      tags: classification.tags,
      summary: classification.summary,
      include: classification.include,
    };
  });

  const included = classified.filter((item) => item.include !== false);
  console.log(`  ✓ ${included.length}/${items.length} items included after classification`);

  return included;
}
