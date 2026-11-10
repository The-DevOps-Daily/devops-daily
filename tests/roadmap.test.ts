import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  careerNotes,
  getRoadmapTotals,
  roadmapStages,
  type RoadmapStage,
} from '@/lib/roadmap-data';
import { resolveRoadmap, resolveSyllabus } from '@/lib/roadmap-resources';
import {
  nextTopicId,
  parseProgress,
  progressKey,
  PROGRESS_KEY,
  summarize,
  type RoadmapProgress,
} from '@/lib/roadmap-progress';
import { getSyllabusTotals, type SyllabusStage } from '@/lib/roadmap-syllabus';
import { juniorStages } from '@/lib/roadmap-junior-data';
import { devsecopsStages } from '@/lib/roadmap-devsecops-data';

const ROOT = process.cwd();
const topics = roadmapStages.flatMap((s) => s.topics);
const ids = new Set(topics.map((t) => t.id));

// The dynamic route that serves each internal link prefix.
const ROUTES: Record<string, string> = {
  guides: 'app/guides/[slug]/page.tsx',
  posts: 'app/posts/[slug]/page.tsx',
  exercises: 'app/exercises/[id]/page.tsx',
  challenges: 'app/challenges/[slug]/page.tsx',
  quizzes: 'app/quizzes/[slug]/page.tsx',
  flashcards: 'app/flashcards/[id]/page.tsx',
  checklists: 'app/checklists/[slug]/page.tsx',
};

function routeFileFor(href: string): string | null {
  const [, section, slug, ...rest] = href.split('/');
  if (section === 'guides' && rest.length === 1 && rest[0]) {
    return 'app/guides/[slug]/[part]/page.tsx';
  }
  if (rest.length || !slug) return null;
  if (section === 'games') return `app/games/${slug}/page.tsx`;
  return ROUTES[section] ?? null;
}

describe('roadmap links', () => {
  it('resolves every resource to content that exists', async () => {
    const { stages, careerReading } = await resolveRoadmap();
    const internal = [
      ...stages.flatMap((s) => [
        ...s.topics.flatMap((t) => t.resources),
        ...s.projects.flatMap((p) => (p.practice ? [p.practice] : [])),
      ]),
      ...careerReading,
    ].filter((r) => r.type !== 'external');

    expect(internal.length).toBeGreaterThan(150);
    for (const resource of internal) {
      const file = routeFileFor(resource.href);
      expect(file, `no route for ${resource.href}`).not.toBeNull();
      expect(existsSync(path.join(ROOT, file!)), `missing ${file} for ${resource.href}`).toBe(true);
      expect(resource.title.length, resource.href).toBeGreaterThan(0);
    }
  });

  it('fails on a slug that does not exist', async () => {
    const broken: RoadmapStage = {
      ...roadmapStages[0],
      topics: [
        {
          ...roadmapStages[0].topics[0],
          resources: [{ type: 'quiz', slug: 'no-such-quiz' }],
        },
      ],
    };
    await expect(resolveRoadmap([broken])).rejects.toThrow(/no-such-quiz/);
  });

  it('uses only https external links', () => {
    const external = topics.flatMap((t) => t.resources).filter((r) => r.type === 'external');
    for (const r of external) {
      if (r.type === 'external') expect(r.href).toMatch(/^https:\/\/[^/]+\.[a-z]+/);
    }
  });

  it('links pages that exist', () => {
    for (const route of [
      'roadmap/junior',
      'roadmap/devsecops',
      'roadmaps',
      'interview-questions',
    ]) {
      expect(existsSync(path.join(ROOT, 'app', route, 'page.tsx')), route).toBe(true);
    }
  });

  it('lists each resource once per topic', () => {
    for (const topic of topics) {
      const keys = topic.resources.map((r) =>
        r.type === 'external' ? r.href : `${r.type}:${r.slug}`
      );
      expect(new Set(keys).size, topic.id).toBe(keys.length);
    }
  });
});

describe('roadmap data', () => {
  it('keeps the 9 stage names and anchors that search engines and links know', () => {
    expect(roadmapStages.map((s) => s.title)).toEqual([
      'Fundamentals',
      'Infrastructure as Code',
      'Containerization & Orchestration',
      'CI/CD Pipelines',
      'Cloud Platforms',
      'Monitoring & Observability',
      'Security & Compliance',
      'Database Management',
      'Continuous Learning',
    ]);
    expect(roadmapStages.map((s) => s.id)).toEqual([
      'fundamentals',
      'infrastructure',
      'containers',
      'cicd',
      'cloud',
      'monitoring',
      'security',
      'databases',
      'lifetime',
    ]);
  });

  it('gives every topic a unique, stable id under its stage', () => {
    expect(ids.size).toBe(topics.length);
    for (const stage of roadmapStages) {
      for (const topic of stage.topics) {
        expect(topic.id).toMatch(new RegExp(`^${stage.id}/[a-z0-9-]+$`));
        expect(topic.subtopics.length, topic.id).toBeGreaterThanOrEqual(2);
        expect(topic.summary.length, topic.id).toBeGreaterThan(60);
      }
    }
  });

  it('derives the totals the hero shows', () => {
    expect(getRoadmapTotals()).toMatchObject({
      stages: 9,
      topics: 47,
      projects: 27,
      minWeeks: 20,
      maxWeeks: 29,
      tracked: 40,
    });
  });

  it('cites a BLS page and a sane range for every career note', () => {
    for (const row of careerNotes) {
      expect(row.href).toMatch(/^https:\/\/www\.bls\.gov\/ooh\//);
      expect(row.low).toBeLessThan(row.median);
      expect(row.median).toBeLessThan(row.high);
      for (const stage of row.stages) expect(roadmapStages.some((s) => s.id === stage)).toBe(true);
    }
  });
});

describe('roadmap progress', () => {
  it('keeps known topics and statuses only', () => {
    const parsed = parseProgress(
      {
        topics: {
          'fundamentals/linux': 'done',
          'fundamentals/git': 'progress',
          'fundamentals/bash': 'finished',
          'not/a-topic': 'done',
        },
        last: { topicId: 'fundamentals/git', title: 'Git quiz', href: '/quizzes/git-quiz', at: 1 },
      },
      ids
    );
    expect(parsed.topics).toEqual({ 'fundamentals/linux': 'done', 'fundamentals/git': 'progress' });
    expect(parsed.last?.href).toBe('/quizzes/git-quiz');
  });

  it('drops a last entry with an unsafe link', () => {
    for (const href of ['javascript:alert(1)', '//evil.example', 'http://example.com']) {
      const parsed = parseProgress(
        { topics: {}, last: { topicId: 'fundamentals/git', title: 'x', href, at: 1 } },
        ids
      );
      expect(parsed.last, href).toBeUndefined();
    }
  });

  it('survives junk', () => {
    for (const raw of [null, 'x', 42, [], { topics: 'x' }]) {
      expect(parseProgress(raw, ids)).toEqual({ topics: {} });
    }
  });

  it('leaves skipped topics out of the percentage', () => {
    const progress: RoadmapProgress = {
      topics: { 'cloud/aws': 'done', 'cloud/azure': 'skip', 'cloud/gcp': 'skip' },
    };
    const cloud = roadmapStages.find((s) => s.id === 'cloud')!.topics.map((t) => t.id);
    expect(summarize(progress, cloud)).toMatchObject({
      done: 1,
      skip: 2,
      total: 6,
      counted: 4,
      percent: 25,
    });
  });

  it('suggests the topic in progress, then the next core topic', () => {
    const tracked = topics.filter((t) => !t.id.startsWith('lifetime/'));
    expect(nextTopicId({ topics: {} }, tracked)).toBe('fundamentals/linux');
    expect(nextTopicId({ topics: { 'fundamentals/linux': 'done' } }, tracked)).toBe(
      'fundamentals/bash'
    );
    expect(nextTopicId({ topics: { 'containers/helm': 'progress' } }, tracked)).toBe(
      'containers/helm'
    );
  });
});

const SYLLABI: [string, SyllabusStage[], string[], Record<string, number>][] = [
  [
    'junior',
    juniorStages,
    [
      'Foundation',
      'Version Control & Collaboration',
      'Containers',
      'CI/CD Pipelines',
      'Cloud Basics',
    ],
    { stages: 5, topics: 16, projects: 5, minWeeks: 21, maxWeeks: 32 },
  ],
  [
    'devsecops',
    devsecopsStages,
    [
      'Security Fundamentals',
      'Secure Development',
      'CI/CD Security',
      'Container Security',
      'Cloud Security',
      'Security Operations',
    ],
    { stages: 6, topics: 30, projects: 6, minWeeks: 36, maxWeeks: 48 },
  ],
];

describe.each(SYLLABI)('%s roadmap', (slug, stages, titles, totals) => {
  const syllabusTopics = stages.flatMap((s) => s.topics);

  it('resolves every resource to content that exists', async () => {
    const resolved = await resolveSyllabus(stages);
    const all = resolved.flatMap((s) => [
      ...s.topics.flatMap((t) => t.resources),
      ...(s.project.practice ? [s.project.practice] : []),
    ]);
    const internal = all.filter((r) => r.type !== 'external');
    expect(internal.length).toBeGreaterThan(30);
    for (const resource of internal) {
      const file = routeFileFor(resource.href);
      expect(file, `no route for ${resource.href}`).not.toBeNull();
      expect(existsSync(path.join(ROOT, file!)), `missing ${file} for ${resource.href}`).toBe(true);
      expect(resource.title.length, resource.href).toBeGreaterThan(0);
    }
    for (const r of all.filter((r) => r.type === 'external')) {
      expect(r.href).toMatch(/^https:\/\/[^/]+\.[a-z]+/);
    }
  });

  it('fails on a slug that does not exist', async () => {
    const broken = [
      {
        ...stages[0],
        topics: [
          {
            ...stages[0].topics[0],
            resources: [{ type: 'guide' as const, slug: 'introduction-to-git/99-nope' }],
          },
        ],
      },
    ];
    await expect(resolveSyllabus(broken)).rejects.toThrow(/99-nope/);
  });

  it('keeps the stage names and gives every topic a stable id', () => {
    expect(stages.map((s) => s.title)).toEqual(titles);
    expect(new Set(syllabusTopics.map((t) => t.id)).size).toBe(syllabusTopics.length);
    for (const stage of stages) {
      expect(stage.id).toMatch(/^[a-z0-9-]+$/);
      for (const topic of stage.topics) {
        expect(topic.id).toMatch(new RegExp(`^${stage.id}/[a-z0-9-]+$`));
        const keys = topic.resources.map((r) =>
          r.type === 'external' ? r.href : `${r.type}:${r.slug}`
        );
        expect(new Set(keys).size, topic.id).toBe(keys.length);
      }
    }
  });

  it('derives the totals the hero shows', () => {
    expect(getSyllabusTotals(stages)).toMatchObject(totals);
  });

  it('keeps its progress apart from the other roadmaps', () => {
    expect(progressKey(slug as 'junior' | 'devsecops')).toBe(`roadmap-progress:${slug}:v1`);
    expect(progressKey(slug as 'junior' | 'devsecops')).not.toBe(PROGRESS_KEY);
    const ids = new Set(syllabusTopics.map((t) => t.id));
    const parsed = parseProgress(
      { topics: { [syllabusTopics[0].id]: 'done', 'fundamentals/linux': 'done' } },
      ids
    );
    expect(parsed.topics).toEqual({ [syllabusTopics[0].id]: 'done' });
  });

  it('suggests topics in order when they have no kind', () => {
    expect(nextTopicId({ topics: {} }, syllabusTopics)).toBe(syllabusTopics[0].id);
    expect(nextTopicId({ topics: { [syllabusTopics[0].id]: 'skip' } }, syllabusTopics)).toBe(
      syllabusTopics[1].id
    );
  });
});
