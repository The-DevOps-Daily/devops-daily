'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  emptyProgress,
  localProgressStore,
  nextTopicId,
  progressKey,
  type ProgressStore,
  type RoadmapProgress,
  type TopicStatus,
} from '@/lib/roadmap-progress';

/** What the client parts need: no resources, so the payload stays small. */
export interface SyllabusStageInfo {
  id: string;
  title: string;
  shortTitle: string;
  topics: { id: string; name: string }[];
}

export interface SyllabusTopicInfo {
  id: string;
  name: string;
  stageIndex: number;
  /** Position inside its stage. */
  index: number;
}

interface SyllabusContextValue {
  stages: SyllabusStageInfo[];
  topics: SyllabusTopicInfo[];
  progress: RoadmapProgress;
  /** False until saved progress has been read, so counts can wait for it. */
  loaded: boolean;
  next: SyllabusTopicInfo | null;
  setStatus: (topicId: string, status: TopicStatus | null) => void;
  recordOpen: (topicId: string, title: string, href: string) => void;
  reset: () => void;
}

const SyllabusContext = createContext<SyllabusContextValue | null>(null);

export function useSyllabus() {
  const value = useContext(SyllabusContext);
  if (!value) throw new Error('useSyllabus must be used inside SyllabusProvider');
  return value;
}

export function SyllabusProvider({
  roadmap,
  stages,
  children,
}: {
  roadmap: 'junior' | 'devsecops';
  stages: SyllabusStageInfo[];
  children: React.ReactNode;
}) {
  const topics = useMemo(
    () =>
      stages.flatMap((stage, stageIndex) =>
        stage.topics.map((t, index) => ({ id: t.id, name: t.name, stageIndex, index }))
      ),
    [stages]
  );
  const store = useRef<ProgressStore | null>(null);
  const [progress, setProgress] = useState<RoadmapProgress>(emptyProgress);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    store.current = localProgressStore(new Set(topics.map((t) => t.id)), progressKey(roadmap));
    const saved = store.current.load();
    if (saved) setProgress(saved);
    setLoaded(true);
  }, [roadmap, topics]);

  const update = useCallback((change: (current: RoadmapProgress) => RoadmapProgress) => {
    setProgress((current) => {
      const next = change(current);
      store.current?.save(next);
      return next;
    });
  }, []);

  const setStatus = useCallback(
    (topicId: string, status: TopicStatus | null) =>
      update((current) => {
        const topics = { ...current.topics };
        if (status) topics[topicId] = status;
        else delete topics[topicId];
        return { ...current, topics };
      }),
    [update]
  );

  const recordOpen = useCallback(
    (topicId: string, title: string, href: string) =>
      update((current) => ({ ...current, last: { topicId, title, href, at: Date.now() } })),
    [update]
  );

  const reset = useCallback(() => {
    store.current?.clear();
    setProgress(emptyProgress());
  }, []);

  const next = useMemo(() => {
    const id = nextTopicId(loaded ? progress : emptyProgress(), topics);
    return topics.find((t) => t.id === id) ?? null;
  }, [loaded, progress, topics]);

  const value = useMemo(
    () => ({ stages, topics, progress, loaded, next, setStatus, recordOpen, reset }),
    [stages, topics, progress, loaded, next, setStatus, recordOpen, reset]
  );

  return <SyllabusContext.Provider value={value}>{children}</SyllabusContext.Provider>;
}

/** Done topics in a stage and the topics that count (skipped ones do not). */
export function useStageCounts(stage: SyllabusStageInfo) {
  const { progress, loaded } = useSyllabus();
  if (!loaded) return { done: 0, counted: stage.topics.length };
  const statuses = stage.topics.map((t) => progress.topics[t.id]);
  return {
    done: statuses.filter((s) => s === 'done').length,
    counted: statuses.filter((s) => s !== 'skip').length,
  };
}
