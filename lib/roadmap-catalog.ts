// The three roadmaps, for the /roadmaps hub and the cross-links between them.
// Every number comes from the roadmap data.

import { getRoadmapTotals, roadmapStages } from './roadmap-data';
import { getSyllabusTotals } from './roadmap-syllabus';
import { juniorStages } from './roadmap-junior-data';
import { devsecopsStages } from './roadmap-devsecops-data';

export interface RoadmapEntry {
  id: 'main' | 'junior' | 'devsecops';
  href: string;
  title: string;
  level: string;
  description: string;
  /** Lead-in for a cross-link, e.g. "New to DevOps? Start with the". */
  prompt: string;
  stages: string[];
  totals: { stages: number; topics: number; minWeeks: number; maxWeeks: number; projects: number };
}

const main = getRoadmapTotals();

export const roadmapCatalog: RoadmapEntry[] = [
  {
    id: 'main',
    href: '/roadmap',
    title: 'DevOps Roadmap',
    level: 'beginner to advanced',
    description:
      'The full path, from your first Linux command to containers, pipelines, cloud, observability and security in production.',
    prompt: 'Want the full path? See the',
    stages: roadmapStages.map((s) => s.shortTitle),
    totals: main,
  },
  {
    id: 'junior',
    href: '/roadmap/junior',
    title: 'Junior DevOps Roadmap',
    level: 'beginner',
    description:
      'The essentials for a first DevOps role: Linux and Git, then containers, CI/CD and the cloud.',
    prompt: 'New to DevOps? Start with the',
    stages: juniorStages.map((s) => s.shortTitle),
    totals: getSyllabusTotals(juniorStages),
  },
  {
    id: 'devsecops',
    href: '/roadmap/devsecops',
    title: 'DevSecOps Roadmap',
    level: 'intermediate',
    description:
      'Build security into how you ship: secure code, pipelines, containers, cloud and security operations.',
    prompt: 'Security focused? Try the',
    stages: devsecopsStages.map((s) => s.shortTitle),
    totals: getSyllabusTotals(devsecopsStages),
  },
];

export function roadmapFacts({ totals }: RoadmapEntry) {
  return `${totals.stages} stages, ${totals.topics} topics, ${totals.minWeeks}-${totals.maxWeeks} weeks`;
}

/** The other two roadmaps, as cross-links for a roadmap page. */
export function relatedRoadmaps(id: RoadmapEntry['id']) {
  return roadmapCatalog
    .filter((r) => r.id !== id)
    .map((r) => ({
      href: r.href,
      title: r.title,
      prompt: r.prompt,
      description: r.description,
      facts: roadmapFacts(r),
    }));
}
