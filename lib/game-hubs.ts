import { getActiveGames, getAllGames, type Game } from './games';

/**
 * /simulators and /games list the same registry (lib/games.ts), split by
 * `type`. Every entry keeps its /games/<slug> URL on both hubs, because
 * Opsville embeds /games/<slug>/embed.
 */

export const SIMULATOR_TOPICS = [
  { id: 'linux', label: 'Linux', description: 'Shell commands, cron, processes and permissions.' },
  {
    id: 'docker',
    label: 'Docker',
    description: 'Containers, from docker run down to namespaces and escapes.',
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    description: 'kubectl, scheduling, RBAC, pod networking and service meshes.',
  },
  { id: 'git', label: 'Git', description: 'Commits, branches, merges and conflicts.' },
  {
    id: 'cicd',
    label: 'CI/CD',
    description: 'Deployments, GitOps, preview environments and pipeline YAML.',
  },
  {
    id: 'observability',
    label: 'Observability and SRE',
    description: 'Metrics, logs, latency, incidents and disaster recovery.',
  },
  { id: 'security', label: 'Security', description: 'TLS, OAuth and OIDC, and DDoS defense.' },
  {
    id: 'networking',
    label: 'Networking',
    description: 'DNS, TCP and UDP, packets, load balancers and email delivery.',
  },
  {
    id: 'data',
    label: 'Data',
    description: 'SQL, Postgres, MongoDB, indexes, replication and caching.',
  },
  { id: 'cloud', label: 'Cloud and IaC', description: 'Terraform, AWS VPCs and autoscaling.' },
  {
    id: 'architecture',
    label: 'APIs and architecture',
    description: 'APIs, rate limits, webhooks, queues, microservices and async code.',
  },
] as const;

export type SimulatorTopicId = (typeof SIMULATOR_TOPICS)[number]['id'];
export type SimulatorTopic = (typeof SIMULATOR_TOPICS)[number];

/**
 * Topics come from the registry's tags and categories. The first rule that
 * matches wins, so the order settles overlaps: Container Security Challenge is
 * tagged security but sits with Docker, and Incident Commander is tagged
 * postgresql but sits with SRE. Anything that matches no rule is architecture.
 */
const TOPIC_RULES: { topic: SimulatorTopicId; tags?: string[]; categories?: string[] }[] = [
  { topic: 'git', tags: ['git'] },
  { topic: 'docker', tags: ['docker'] },
  { topic: 'cicd', tags: ['ci-cd', 'gitops', 'deployment'] },
  { topic: 'kubernetes', tags: ['kubernetes'], categories: ['kubernetes'] },
  { topic: 'linux', tags: ['linux', 'bash', 'cron'] },
  {
    topic: 'observability',
    tags: ['observability', 'monitoring', 'disaster-recovery'],
    categories: ['observability', 'monitoring', 'sre'],
  },
  {
    topic: 'data',
    tags: ['database', 'sql', 'postgresql', 'mongodb', 'caching'],
    categories: ['database', 'databases'],
  },
  { topic: 'security', tags: ['security'], categories: ['security'] },
  { topic: 'cloud', tags: ['terraform', 'iac', 'aws', 'cloud'], categories: ['cloud'] },
  { topic: 'networking', tags: ['networking', 'dns', 'smtp'], categories: ['networking'] },
];

export function getSimulatorTopic(game: Pick<Game, 'tags' | 'category'>): SimulatorTopicId {
  const tags = new Set(game.tags.map((tag) => tag.toLowerCase()));
  const category = game.category?.toLowerCase();
  const rule = TOPIC_RULES.find(
    (r) => r.tags?.some((tag) => tags.has(tag)) || (category && r.categories?.includes(category))
  );
  return rule?.topic ?? 'architecture';
}

export interface SimulatorGroup {
  topic: SimulatorTopic;
  simulators: Game[];
}

/** Simulators grouped in SIMULATOR_TOPICS order, newest first in each group. */
export function groupSimulatorsByTopic(simulators: Game[]): SimulatorGroup[] {
  const newestFirst = [...simulators].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  );
  return SIMULATOR_TOPICS.map((topic) => ({
    topic,
    simulators: newestFirst.filter((game) => getSimulatorTopic(game) === topic.id),
  })).filter((group) => group.simulators.length > 0);
}

export type GameGroup = 'arcade' | 'party';

/** Party games are the light, shareable ones; the rest are arcade and puzzle games. */
export function getGameGroup(game: Pick<Game, 'tags' | 'category'>): GameGroup {
  const tags = game.tags.map((tag) => tag.toLowerCase());
  const category = game.category?.toLowerCase();
  if (category === 'fun' || category === 'assessment') return 'party';
  return tags.some((tag) => tag === 'fun' || tag === 'humor' || tag === 'party')
    ? 'party'
    : 'arcade';
}

/** Live entries of one type, in registry order. */
export async function getActiveByType(type: Game['type']): Promise<Game[]> {
  return (await getActiveGames()).filter((game) => game.type === type);
}

export async function getComingSoonSimulators(): Promise<Game[]> {
  return (await getAllGames()).filter((game) => game.isComingSoon && game.type === 'simulator');
}
