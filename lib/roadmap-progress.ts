// Saved progress for /roadmap, /roadmap/junior and /roadmap/devsecops. The
// pages talk to a ProgressStore, so syncing with a learning account later means
// adding another store, not changing the pages.

export type TopicStatus = 'done' | 'progress' | 'skip';

export const TOPIC_STATUSES: TopicStatus[] = ['done', 'progress', 'skip'];

export interface LastOpened {
  topicId: string;
  title: string;
  href: string;
  /** Epoch milliseconds. */
  at: number;
}

export interface RoadmapProgress {
  topics: Record<string, TopicStatus>;
  last?: LastOpened;
}

export interface ProgressStore {
  load(): RoadmapProgress | null;
  save(progress: RoadmapProgress): void;
  clear(): void;
}

export const PROGRESS_KEY = 'roadmap-progress:v1';

/** Each smaller roadmap keeps its own progress, apart from the main one. */
export function progressKey(roadmap: 'junior' | 'devsecops') {
  return `roadmap-progress:${roadmap}:v1`;
}

export function emptyProgress(): RoadmapProgress {
  return { topics: {} };
}

/** Keeps only known topic ids, known statuses and a well-formed last entry. */
export function parseProgress(raw: unknown, topicIds: ReadonlySet<string>): RoadmapProgress {
  const progress = emptyProgress();
  if (!raw || typeof raw !== 'object') return progress;
  const { topics, last } = raw as { topics?: unknown; last?: unknown };
  if (topics && typeof topics === 'object') {
    for (const [id, status] of Object.entries(topics)) {
      if (topicIds.has(id) && TOPIC_STATUSES.includes(status as TopicStatus)) {
        progress.topics[id] = status as TopicStatus;
      }
    }
  }
  if (last && typeof last === 'object') {
    const l = last as Partial<LastOpened>;
    if (
      typeof l.topicId === 'string' &&
      topicIds.has(l.topicId) &&
      typeof l.title === 'string' &&
      typeof l.href === 'string' &&
      /^(\/(?!\/)|https:\/\/)/.test(l.href) &&
      typeof l.at === 'number'
    ) {
      progress.last = { topicId: l.topicId, title: l.title, href: l.href, at: l.at };
    }
  }
  return progress;
}

export function localProgressStore(
  topicIds: ReadonlySet<string>,
  key: string = PROGRESS_KEY
): ProgressStore {
  return {
    load() {
      try {
        const saved = window.localStorage.getItem(key);
        return saved === null ? null : parseProgress(JSON.parse(saved), topicIds);
      } catch {
        return null;
      }
    },
    save(progress) {
      try {
        window.localStorage.setItem(key, JSON.stringify(progress));
      } catch {
        // Storage full or blocked: progress still works until the tab closes.
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to clear.
      }
    },
  };
}

export interface ProgressSummary {
  done: number;
  progress: number;
  skip: number;
  total: number;
  /** Topics that count toward completion: skipped ones do not. */
  counted: number;
  percent: number;
}

export function summarize(progress: RoadmapProgress, topicIds: readonly string[]): ProgressSummary {
  const summary = { done: 0, progress: 0, skip: 0, total: topicIds.length };
  for (const id of topicIds) {
    const status = progress.topics[id];
    if (status) summary[status] += 1;
  }
  const counted = summary.total - summary.skip;
  return {
    ...summary,
    counted,
    percent: counted ? Math.round((summary.done / counted) * 100) : 0,
  };
}

/**
 * The topic to work on next: the first one in progress, else the first core
 * topic not done or skipped, else any topic not done or skipped. Topics with
 * no kind are taken in order.
 */
export function nextTopicId(
  progress: RoadmapProgress,
  topics: readonly { id: string; kind?: 'core' | 'optional' }[]
): string | null {
  const open = topics.filter((t) => {
    const status = progress.topics[t.id];
    return status !== 'done' && status !== 'skip';
  });
  return (
    open.find((t) => progress.topics[t.id] === 'progress')?.id ??
    open.find((t) => t.kind === 'core')?.id ??
    open[0]?.id ??
    null
  );
}
