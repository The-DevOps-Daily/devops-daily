import { NewsItem, Tier } from '../crawler/types.js';
import { isNearDuplicate } from '../utils/dedupe.js';

/**
 * Ranking without AI: a source tier, a keyword relevance score and recency.
 *
 *   score = tier base (tier 1: 6, tier 2: 4, tier 3: 2)
 *         + relevance (-4 to +5, from the title)
 *         + recency (0 to 1, newer is higher)
 *
 * Tier decides most of the order. Relevance lets a release or security fix
 * from a tier 2 source pass a plain blog post from a tier 1 source.
 */

const TIER_BASE: Record<Tier, number> = { 1: 6, 2: 4, 3: 2 };

/** Per-source caps, so one busy feed cannot fill the digest. */
export const PER_SOURCE_CAP: Record<Tier, number> = { 1: 3, 2: 2, 3: 1 };

// Events, webinars and other promotion. These are dropped, not ranked low.
const PROMO_PATTERNS: RegExp[] = [
  /\bwebinars?\b/i,
  /\b(join|meet|visit) us\b/i,
  /\bour booth\b/i,
  /\bregister (now|today|for)\b/i,
  /\bsave the date\b/i,
  /\bcall for (papers|proposals|speakers)\b/i,
  /\bcfp\b/i,
  /\bis coming!/i,
  /\bvirtual event\b/i,
  /\bon-demand (session|demo|webinar)\b/i,
  /\b(e-?book|white ?paper)\b/i,
  /\bfriday five\b/i,
  /\b(conference|event|meetup|summit)\s+\d{4}\b/i,
  // "... at KubeCon NA 2026", "OTel Unplugged EU at FOSDEM 2027"
  /\bat (kubecon|cloudnativecon|fosdem|re:?invent|devopsdays|hashiconf|open source summit|kcd)\b.*\b20\d\d\b/i,
];

export function isPromo(item: Pick<NewsItem, 'title'>): boolean {
  return PROMO_PATTERNS.some((re) => re.test(item.title));
}

const RELEASE = /\b(released?|generally available|general availability|ga|lts|is out)\b/i;
// "v1.2", "1.2.3", or "Name 1.146" at the end of the title. A bare "2.0" in
// the middle ("OAuth 2.0", "Grok 4.7") is not a release.
const VERSION = /\bv\d+(\.\d+)+\b|\b\d+\.\d+\.\d+\b|\b\d+\.\d+$/i;
const MILESTONE =
  /\b(incubat\w+|graduat\w+|joins? the cncf|to the cncf|open[- ]sourced?|now open source)\b/i;
const SECURITY =
  /\b(cve-\d{4}-\d+|vulnerabilit(y|ies)|security (fix|fixes|release|update|advisory)|exploit\w*|zero-day|0-day|supply chain|malware|breach)\b/i;
const OPS_CHANGE =
  /\b(deprecat\w*|end of life|end-of-life|eol|breaking change\w*|removal|migrat\w+|outage|incident\w*|post-?mortem|availability report)\b/i;
const CORE_TOPIC =
  /\b(kubernetes|k8s|terraform|opentofu|docker|containers?|containerd|helm|argo ?cd|flux|prometheus|grafana|opentelemetry|otel|postgres(ql)?|linux|ci\/cd|github actions|gitlab|observability|sre|platform engineering|infrastructure as code|iac|istio|cilium|ebpf|git)\b/i;
const MARKETING =
  /\b(roi|business case|customer stor(y|ies)|case study|named a leader|leader in|magic quadrant|forrester|gartner|awards?|partners?|partnership|sovereign\w*|digital transformation|predictions?|trends|landscape|compared|top \d+|ultimate guide|recap)\b/i;
// Rolling hub pages ("What's new with Google Cloud") come back every week.
const ROUNDUP = /^what[\u2019']?s new with\b/i;
const HOW_CUSTOMER = /\bhow [\w.]+ (uses|used|scaled|cut|saves|saved|reduced|built)\b/i;

/** Keyword relevance, mostly from the title, between -4 and +5. */
export function relevanceScore(item: Pick<NewsItem, 'title' | 'excerpt'>): number {
  const title = item.title;
  let score = 0;
  if (RELEASE.test(title) || VERSION.test(title)) score += 2;
  if (MILESTONE.test(title)) score += 2;
  if (SECURITY.test(title)) score += 2;
  if (OPS_CHANGE.test(title)) score += 2;
  // A core DevOps topic in the title or the excerpt.
  if (CORE_TOPIC.test(`${title} ${item.excerpt}`)) score += 1;
  if (MARKETING.test(title)) score -= 2;
  if (HOW_CUSTOMER.test(title)) score -= 2;
  if (ROUNDUP.test(title)) score -= 2;
  if (!item.excerpt) score -= 1;
  return Math.max(-4, Math.min(5, score));
}

/** 1 for an item published at `end`, 0 for one published a week before. */
export function recencyScore(publishedAt: string, end: Date): number {
  const ageDays = (end.getTime() - new Date(publishedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.min(1, 1 - ageDays / 7));
}

export function scoreItem(item: NewsItem, end: Date): number {
  const tier = item.tier ?? 3;
  return TIER_BASE[tier] + relevanceScore(item) + recencyScore(item.publishedAt, end);
}

export interface SelectOptions {
  /** Window end, for the recency score. */
  end: Date;
  maxTotal?: number;
  maxPerCategory?: number;
  perSourceCap?: Record<Tier, number>;
  /** Items below this score are left out even when there is room. */
  minScore?: number;
}

/**
 * Drops promotion, scores the rest and picks the best items under the caps:
 * at most `maxTotal` items, `maxPerCategory` per category and a per-source
 * cap by tier, and nothing below `minScore` (a tier 3 post with no signal). A title that is a near duplicate of a picked one is skipped,
 * so the better-ranked copy of a story wins. Returns the picks, best first.
 */
export function selectItems(items: NewsItem[], options: SelectOptions): NewsItem[] {
  const {
    end,
    maxTotal = 25,
    maxPerCategory = 5,
    perSourceCap = PER_SOURCE_CAP,
    minScore = 4.5,
  } = options;

  const ranked = items
    .filter((item) => !isPromo(item))
    .map((item) => ({ ...item, score: scoreItem(item, end) }))
    .sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() ||
        a.title.localeCompare(b.title)
    );

  const picked: NewsItem[] = [];
  const perCategory = new Map<string, number>();
  const perSource = new Map<string, number>();

  for (const item of ranked) {
    if (picked.length >= maxTotal || (item.score ?? 0) < minScore) break;
    const category = item.category || 'Misc';
    const sourceCap = perSourceCap[item.tier ?? 3];
    if ((perCategory.get(category) ?? 0) >= maxPerCategory) continue;
    if ((perSource.get(item.source) ?? 0) >= sourceCap) continue;
    if (picked.some((p) => isNearDuplicate(p.title, item.title))) continue;

    picked.push(item);
    perCategory.set(category, (perCategory.get(category) ?? 0) + 1);
    perSource.set(item.source, (perSource.get(item.source) ?? 0) + 1);
  }
  return picked;
}

/**
 * The top picks for "This week in short": the best items from different
 * sources. `ranked` must be best first, as selectItems returns it.
 */
export function pickTop(ranked: NewsItem[], count = 3): NewsItem[] {
  const top: NewsItem[] = [];
  const sources = new Set<string>();
  for (const item of ranked) {
    if (top.length >= count) break;
    if (sources.has(item.source)) continue;
    top.push(item);
    sources.add(item.source);
  }
  return top;
}
