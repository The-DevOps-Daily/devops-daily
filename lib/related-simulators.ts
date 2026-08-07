/**
 * Matches a post to the hands-on simulators that teach the same thing.
 *
 * The simulators are the strongest content on the site and the least linked
 * to: 8 of 519 posts pointed at one before this existed. They were also the
 * only content type missing from `getRelatedAcrossTypes`, so nothing surfaced
 * them automatically either.
 *
 * This is deliberately separate from the cross-type related section rather
 * than folded into it. That section caps each type at one item out of three
 * total, so a simulator competes with quizzes and checklists and often loses.
 * Simulators get their own slot so a Docker post always reaches the Docker
 * terminal, which is the entire point.
 */

import { getActiveGames, type Game } from './games';

export interface RelatedSimulator {
  id: string;
  title: string;
  description: string;
  href: string;
  /** 'simulator' or 'game', used for the label on the card. */
  type: 'game' | 'simulator';
  iconName: string;
  color: string;
}

export interface SimulatorMatchInput {
  /** Post tags, any casing. */
  tags?: string[];
  /** Post category slug, e.g. 'docker'. */
  categorySlug?: string;
  /** Post title, used only as a weak fallback signal. */
  title?: string;
}

/**
 * Two tag matches, or one tag match that is also the post's category.
 *
 * Set by measuring against the real corpus. Requiring a single tag match
 * links roughly nine posts in ten but produces matches like a post tagged
 * 'security' landing on the DDoS simulator, which is a worse link than none.
 * Requiring three drops coverage below a third. Weak internal links dilute
 * the signal they are meant to create, so the bar is deliberately high.
 */
const MIN_SCORE = 20;
const TAG_POINTS = 10;
/** A category hit is worth as much as a tag hit; it is the stronger signal. */
const CATEGORY_POINTS = 10;
/** Enough to put the canonical simulator first regardless of tag overlap. */
const PRIMARY_POINTS = 100;

/**
 * The canonical simulator for a topic, keyed by post tag or category slug.
 *
 * Tag overlap alone gets this wrong in a way that matters. A post tagged
 * Linux and Bash matches the fork bomb simulator on two tags but the Linux
 * terminal on one, so the fork bomb wins: 91 posts pointed at it before this
 * map existed, and a general Linux article should reach the Linux terminal.
 * Same shape for Docker, where the under-the-hood simulator outscored the
 * terminal 182 to 122 despite being the more advanced of the two.
 *
 * Only topics with an unambiguous best destination belong here. Everything
 * else falls through to tag scoring below.
 */
const PRIMARY_SIMULATORS: Record<string, string> = {
  docker: 'docker-terminal-simulator',
  containers: 'docker-terminal-simulator',
  'docker-compose': 'docker-terminal-simulator',
  kubernetes: 'kubernetes-terminal-simulator',
  kubectl: 'kubernetes-terminal-simulator',
  k8s: 'kubernetes-terminal-simulator',
  terraform: 'terraform-terminal-simulator',
  'infrastructure-as-code': 'terraform-terminal-simulator',
  git: 'git-concepts-simulator',
  'version-control': 'git-concepts-simulator',
  linux: 'linux-terminal',
  bash: 'linux-terminal',
  shell: 'linux-terminal',
  sql: 'sql-terminal-simulator',
  postgres: 'postgres-terminal-simulator',
  postgresql: 'postgres-terminal-simulator',
  psql: 'postgres-terminal-simulator',
  mongodb: 'mongodb-terminal-simulator',
  nosql: 'mongodb-terminal-simulator',
  dns: 'dns-simulator',
  aws: 'aws-vpc-simulator',
  vpc: 'aws-vpc-simulator',
  smtp: 'smtp-flow-simulator',
  email: 'smtp-flow-simulator',
  deliverability: 'bounce-triage-simulator',
  oauth: 'oauth-oidc-flow-simulator',
  oidc: 'oauth-oidc-flow-simulator',
  authentication: 'oauth-oidc-flow-simulator',
  tls: 'ssl-tls-handshake',
  ssl: 'ssl-tls-handshake',
  prometheus: 'promql-playground',
  promql: 'promql-playground',
  observability: 'promql-playground',
  logging: 'log-aggregation-pipeline-simulator',
  logs: 'log-aggregation-pipeline-simulator',
  kafka: 'message-queue-simulator',
  rabbitmq: 'message-queue-simulator',
  redis: 'caching-simulator',
  caching: 'caching-simulator',
  webhooks: 'webhook-delivery-simulator',
  gitops: 'gitops-workflow',
  argocd: 'gitops-workflow',
  istio: 'service-mesh-simulator',
  'service-mesh': 'service-mesh-simulator',
  microservices: 'microservices-simulator',
  graphql: 'rest-vs-graphql',
  'load-balancing': 'load-balancer-simulator',
  'rate-limiting': 'rate-limit-simulator',
  scaling: 'scaling-simulator',
  'auto-scaling': 'scaling-simulator',
  deployment: 'deployment-strategies',
  'ci-cd': 'deployment-strategies',
};

/**
 * Tags that carry no topical information and so cannot justify a link.
 *
 * Two kinds. The meta tags ('educational', 'interactive') exist on almost
 * every game and describe format rather than subject. The broad tags
 * ('devops', 'infrastructure') are true of most of the site.
 *
 * Leaving them in produced exactly the filler links this is meant to avoid:
 * an article about AI résumé screening matched the disaster-recovery
 * simulator on 'devops' and 'infrastructure' alone, which helps nobody and
 * dilutes the links that are real.
 */
const NON_DISCRIMINATING = new Set([
  'devops',
  'infrastructure',
  'educational',
  'interactive',
  'tutorial',
  'beginner',
  'backend',
  'cloud',
  'visualization',
  'real-time',
  'game',
  'fun',
  'humor',
  'arcade',
  'strategy',
  'performance',
  'security',
  'networking',
  'monitoring',
  'database',
  'sre',
]);

function normalise(values: readonly string[]): Set<string> {
  return new Set(
    values
      .map((v) => v.toLowerCase().trim())
      .filter((v) => v && !NON_DISCRIMINATING.has(v)),
  );
}

function toRelated(game: Game): RelatedSimulator {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    href: game.href,
    type: game.type ?? 'game',
    iconName: game.iconName,
    color: game.color,
  };
}

/**
 * Scores one game against one post. Exported for the tests, which assert the
 * threshold behaviour directly rather than through the async loader.
 */
export function scoreSimulator(game: Game, input: SimulatorMatchInput): number {
  const gameTags = normalise(game.tags ?? []);
  if (gameTags.size === 0) return 0;

  const postTags = normalise(input.tags ?? []);
  let score = 0;

  for (const tag of postTags) {
    if (gameTags.has(tag)) score += TAG_POINTS;
  }

  // A canonical topic hit outranks any amount of incidental tag overlap.
  const category = input.categorySlug?.toLowerCase().trim();
  const topics = new Set(postTags);
  if (category) topics.add(category);
  for (const topic of topics) {
    if (PRIMARY_SIMULATORS[topic] === game.id) {
      score += PRIMARY_POINTS;
      break;
    }
  }

  // The category slug is a tag by another name as far as matching goes:
  // a post in the 'docker' category and a game tagged 'docker' belong
  // together whether or not the author also tagged the post Docker.
  if (category && gameTags.has(category)) {
    score += CATEGORY_POINTS;
  }

  return score;
}

/**
 * Returns up to `limit` simulators worth linking from this post, best first.
 * Returns an empty array rather than padding with weak matches.
 */
export async function getRelatedSimulators(
  input: SimulatorMatchInput,
  limit = 2,
): Promise<RelatedSimulator[]> {
  const games = await getActiveGames();

  return games
    .map((game) => ({ game, score: scoreSimulator(game, input) }))
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Stable across builds. Without this, two equally-scored simulators can
      // swap places between deploys and the rendered page churns for no reason.
      return a.game.id.localeCompare(b.game.id);
    })
    .slice(0, limit)
    .map((s) => toRelated(s.game));
}
