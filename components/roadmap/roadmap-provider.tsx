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
import type { ResolvedResource, ResolvedStage, ResolvedTopic } from '@/lib/roadmap-resources';
import {
  emptyProgress,
  localProgressStore,
  type ProgressStore,
  type RoadmapProgress,
  type TopicStatus,
} from '@/lib/roadmap-progress';
import { RoadmapPanel } from './roadmap-panel';

export type PanelTarget = { kind: 'topic'; id: string } | { kind: 'stage'; id: string };

interface RoadmapContextValue {
  stages: ResolvedStage[];
  /** Topics that count for progress: every stage except the ongoing one. */
  trackedTopics: ResolvedTopic[];
  progress: RoadmapProgress;
  /** False until saved progress has been read, so counts can wait for it. */
  loaded: boolean;
  setStatus: (topicId: string, status: TopicStatus | null) => void;
  recordOpen: (topicId: string, resource: ResolvedResource) => void;
  reset: () => void;
  open: (target: PanelTarget, trigger?: HTMLElement | null) => void;
}

const RoadmapContext = createContext<RoadmapContextValue | null>(null);

export function useRoadmap() {
  const value = useContext(RoadmapContext);
  if (!value) throw new Error('useRoadmap must be used inside RoadmapProvider');
  return value;
}

export function RoadmapProvider({
  stages,
  children,
}: {
  stages: ResolvedStage[];
  children: React.ReactNode;
}) {
  const trackedTopics = useMemo(
    () => stages.filter((s) => !s.ongoing).flatMap((s) => s.topics),
    [stages]
  );
  const store = useRef<ProgressStore | null>(null);
  const [progress, setProgress] = useState<RoadmapProgress>(emptyProgress);
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState<PanelTarget | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ids = new Set(stages.flatMap((s) => s.topics.map((t) => t.id)));
    store.current = localProgressStore(ids);
    const saved = store.current.load();
    if (saved) setProgress(saved);
    setLoaded(true);
  }, [stages]);

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
    (topicId: string, resource: ResolvedResource) =>
      update((current) => ({
        ...current,
        last: { topicId, title: resource.title, href: resource.href, at: Date.now() },
      })),
    [update]
  );

  const reset = useCallback(() => {
    store.current?.clear();
    setProgress(emptyProgress());
  }, []);

  const open = useCallback((next: PanelTarget, from?: HTMLElement | null) => {
    trigger.current = from ?? (document.activeElement as HTMLElement | null);
    setTarget(next);
  }, []);

  const value = useMemo(
    () => ({ stages, trackedTopics, progress, loaded, setStatus, recordOpen, reset, open }),
    [stages, trackedTopics, progress, loaded, setStatus, recordOpen, reset, open]
  );

  return (
    <RoadmapContext.Provider value={value}>
      {children}
      <RoadmapPanel
        target={target}
        onNavigate={setTarget}
        onClose={() => setTarget(null)}
        returnFocus={() => {
          const el = trigger.current;
          trigger.current = null;
          if (el?.isConnected) el.focus();
          return Boolean(el?.isConnected);
        }}
      />
    </RoadmapContext.Provider>
  );
}
