import { NewsItem, Classification } from '../crawler/types.js';
import { cutExcerpt } from '../utils/text.js';

/**
 * Keyword-based classification: pick a category from the title and excerpt.
 * Events and promotion are dropped later, in rank.ts.
 */
export function classifyItem(item: NewsItem): Classification {
  const combined = `${item.title} ${item.excerpt}`.toLowerCase();

  let category = item.category || 'Misc';

  if (combined.match(/\b(kubernetes|k8s|kubectl|helm|kube)\b/)) {
    category = 'Kubernetes';
  } else if (combined.match(/\b(docker|container|cncf|cloud native|service mesh|istio|envoy)\b/)) {
    category = 'Cloud Native';
  } else if (combined.match(/\b(ci\/cd|cicd|github actions|gitlab|jenkins|argo|flux)\b/)) {
    category = 'CI/CD';
  } else if (combined.match(/\b(terraform|opentofu|pulumi|ansible|iac|infrastructure as code)\b/)) {
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
    summary: cutExcerpt(item.excerpt),
  };
}

/**
 * Classify all items.
 */
export function classifyItems(items: NewsItem[]): NewsItem[] {
  return items.map((item) => {
    const classification = classifyItem(item);
    return {
      ...item,
      category: classification.category,
      tags: classification.tags,
      summary: classification.summary,
    };
  });
}
