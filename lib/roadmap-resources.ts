import { getAllChallenges } from './challenges';
import { getAllChecklists } from './checklists';
import { getAllExercises } from './exercises';
import { getAllGames } from './games';
import { getAllGuides } from './guides';
import { getAllPosts } from './posts';
import { getAllQuizzes } from './quiz-loader';
import { getAllFlashCardSets, getFlashCardSet } from './flashcard-loader';
import {
  careerReading,
  roadmapStages,
  stageTimeLabel,
  type InternalResourceType,
  type ResourceRef,
  type RoadmapProject,
  type RoadmapStage,
  type RoadmapTopic,
} from './roadmap-data';

export type ResourceType = InternalResourceType | 'external';

export interface ResolvedResource {
  type: ResourceType;
  title: string;
  href: string;
  /** Size or format, e.g. "12 questions", "45 min", "docs.aws.amazon.com". */
  meta?: string;
}

export type ResolvedTopic = Omit<RoadmapTopic, 'resources'> & { resources: ResolvedResource[] };
export type ResolvedProject = Omit<RoadmapProject, 'practice'> & { practice?: ResolvedResource };
export type ResolvedStage = Omit<RoadmapStage, 'topics' | 'projects'> & {
  timeLabel: string;
  topics: ResolvedTopic[];
  projects: ResolvedProject[];
};

type Lookup = (slug: string) => ResolvedResource | undefined;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

async function buildLookups(): Promise<Record<InternalResourceType, Lookup>> {
  const [guides, posts, games, labs, challenges, quizzes, flashcards, checklists] =
    await Promise.all([
      getAllGuides(),
      getAllPosts(),
      getAllGames(),
      getAllExercises(),
      getAllChallenges(),
      getAllQuizzes(),
      getAllFlashCardSets(),
      getAllChecklists(),
    ]);
  const cardCounts = new Map(
    await Promise.all(
      flashcards.map(async (set) => {
        const full = await getFlashCardSet(set.id);
        return [set.id, full?.cards.length ?? set.cardCount] as const;
      })
    )
  );
  const index = <T>(items: T[], key: (item: T) => string) =>
    new Map(items.map((item) => [key(item), item]));
  const guideMap = index(guides, (g) => g.slug);
  const postMap = index(posts, (p) => p.slug);
  const gameMap = index(
    games.filter((g) => !g.isComingSoon && g.href === `/games/${g.id}`),
    (g) => g.id
  );
  const labMap = index(labs, (l) => l.id);
  const challengeMap = index(challenges, (c) => c.slug);
  const quizMap = index(quizzes, (q) => q.id);
  const cardMap = index(flashcards, (f) => f.id);
  const checklistMap = index(checklists, (c) => c.slug);

  return {
    guide: (slug) => {
      const g = guideMap.get(slug);
      return (
        g && {
          type: 'guide',
          title: g.title,
          href: `/guides/${slug}`,
          meta: g.partsCount ? plural(g.partsCount, 'part') : undefined,
        }
      );
    },
    post: (slug) => {
      const p = postMap.get(slug);
      return (
        p && {
          type: 'post',
          title: p.title,
          href: `/posts/${slug}`,
          meta: p.readingTime?.replace(/ read$/, ''),
        }
      );
    },
    simulator: (slug) => {
      const g = gameMap.get(slug);
      return (
        g && {
          type: 'simulator',
          title: g.title,
          href: g.href,
          meta: g.type === 'game' ? 'Game, in your browser' : 'In your browser',
        }
      );
    },
    lab: (slug) => {
      const l = labMap.get(slug);
      const minutes = l && parseInt(l.estimatedTime, 10);
      return (
        l && {
          type: 'lab',
          title: l.title,
          href: `/exercises/${slug}`,
          meta: minutes ? `${minutes} min` : undefined,
        }
      );
    },
    challenge: (slug) => {
      const c = challengeMap.get(slug);
      return (
        c && {
          type: 'challenge',
          title: c.title,
          href: `/challenges/${slug}`,
          meta: `${c.minutes} min`,
        }
      );
    },
    quiz: (slug) => {
      const q = quizMap.get(slug);
      return (
        q && {
          type: 'quiz',
          title: q.title,
          href: `/quizzes/${slug}`,
          meta: plural(q.questions.length, 'question'),
        }
      );
    },
    flashcards: (slug) => {
      const f = cardMap.get(slug);
      return (
        f && {
          type: 'flashcards',
          title: f.title,
          href: `/flashcards/${slug}`,
          meta: plural(cardCounts.get(slug) ?? f.cardCount, 'card'),
        }
      );
    },
    checklist: (slug) => {
      const c = checklistMap.get(slug);
      return (
        c && {
          type: 'checklist',
          title: c.title,
          href: `/checklists/${slug}`,
          meta: plural(c.items.length, 'item'),
        }
      );
    },
  };
}

function resolveRef(
  ref: ResourceRef,
  lookups: Record<InternalResourceType, Lookup>,
  where: string
) {
  if (ref.type === 'external') {
    return {
      type: 'external' as const,
      title: ref.title,
      href: ref.href,
      meta: new URL(ref.href).hostname.replace(/^www\./, ''),
    };
  }
  const resolved = lookups[ref.type](ref.slug);
  if (!resolved) {
    throw new Error(`Roadmap: ${where} links to a ${ref.type} that does not exist: ${ref.slug}`);
  }
  return resolved;
}

/**
 * The roadmap with every resource resolved from the content loaders. Throws
 * on a slug that does not exist, so a dead link fails the build and the tests.
 */
export async function resolveRoadmap(stages: RoadmapStage[] = roadmapStages) {
  const lookups = await buildLookups();
  const resolved: ResolvedStage[] = stages.map((stage) => ({
    ...stage,
    timeLabel: stageTimeLabel(stage),
    topics: stage.topics.map((topic) => ({
      ...topic,
      resources: topic.resources.map((ref) => resolveRef(ref, lookups, topic.id)),
    })),
    projects: stage.projects.map(({ practice, ...project }) => ({
      ...project,
      ...(practice && {
        practice: resolveRef(practice, lookups, `${stage.id} project "${project.name}"`),
      }),
    })),
  }));
  const reading = careerReading.map((ref) => resolveRef(ref, lookups, 'career notes'));
  return { stages: resolved, careerReading: reading };
}
