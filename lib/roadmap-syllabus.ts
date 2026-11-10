// Shared model for the syllabus roadmaps (/roadmap/junior, /roadmap/devsecops):
// stages -> topics -> resources. Internal resources name a content slug;
// lib/roadmap-resources.ts resolves the title, link and size from the content
// loaders, and tests/roadmap.test.ts fails on a slug that does not exist.
// Topic ids are stored in saved progress, so never change one; add a new
// topic instead.

import type { ResourceRef } from './roadmap-data';

export type TopicPriority = 'essential' | 'important' | 'nice-to-have';

export interface SyllabusTopic {
  /** "<stage>/<topic>", stable. Saved progress uses it. */
  id: string;
  name: string;
  description: string;
  priority: TopicPriority;
  /** Rough study time. */
  hours: number;
  resources: ResourceRef[];
}

export interface SyllabusProject {
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** A lab, challenge, simulator or checklist that covers part of the project. */
  practice?: ResourceRef;
}

export interface SyllabusStage {
  /** Used in the #stage-<id> anchor, so keep it stable. */
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  /** Weeks, min and max. */
  weeks: [number, number];
  topics: SyllabusTopic[];
  project: SyllabusProject;
  outcomes: string[];
  tips: string[];
}

export const ref = {
  guide: (slug: string): ResourceRef => ({ type: 'guide', slug }),
  /** One part of a guide, e.g. part("introduction-to-git", "04-branching"). */
  part: (guide: string, part: string): ResourceRef => ({ type: 'guide', slug: `${guide}/${part}` }),
  post: (slug: string): ResourceRef => ({ type: 'post', slug }),
  sim: (slug: string): ResourceRef => ({ type: 'simulator', slug }),
  lab: (slug: string): ResourceRef => ({ type: 'lab', slug }),
  challenge: (slug: string): ResourceRef => ({ type: 'challenge', slug }),
  quiz: (slug: string): ResourceRef => ({ type: 'quiz', slug }),
  cards: (slug: string): ResourceRef => ({ type: 'flashcards', slug }),
  checklist: (slug: string): ResourceRef => ({ type: 'checklist', slug }),
  ext: (title: string, href: string): ResourceRef => ({ type: 'external', title, href }),
};

export function getSyllabusTotals(stages: SyllabusStage[]) {
  const topics = stages.flatMap((s) => s.topics);
  return {
    stages: stages.length,
    topics: topics.length,
    essential: topics.filter((t) => t.priority === 'essential').length,
    hours: topics.reduce((n, t) => n + t.hours, 0),
    projects: stages.length,
    minWeeks: stages.reduce((n, s) => n + s.weeks[0], 0),
    maxWeeks: stages.reduce((n, s) => n + s.weeks[1], 0),
  };
}

export function syllabusTimeLabel(stage: Pick<SyllabusStage, 'weeks'>): string {
  return `${stage.weeks[0]}-${stage.weeks[1]} weeks`;
}
