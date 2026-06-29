'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, Play, CheckCircle2, Circle } from 'lucide-react';
import { useDeferredSearch } from '@/hooks/use-deferred-search';
import { tagToSlug } from '@/lib/tag-utils';
import {
  getDifficultyColor,
  getInterviewProgress,
  type InterviewQuestion,
  type ExperienceTier,
  type Difficulty,
} from '@/lib/interview-utils';

interface QuestionBrowserProps {
  questions: InterviewQuestion[];
  /** Fixed tier (tier landing pages) — hides the tier filter. */
  lockedTier?: ExperienceTier;
  /** Fixed topic slug (topic landing pages) — hides the topic filter. */
  lockedTopicSlug?: string;
  /** Base path for the "practice these" button. */
  practiceHref?: string;
}

const TIERS: ExperienceTier[] = ['junior', 'mid', 'senior'];
const TIER_LABELS: Record<ExperienceTier, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
};
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

function readParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

export function QuestionBrowser({
  questions,
  lockedTier,
  lockedTopicSlug,
  practiceHref = '/interview-questions/practice',
}: QuestionBrowserProps) {
  const { searchQuery, setSearchQuery, deferredSearchQuery, searchInputRef } = useDeferredSearch({
    focusShortcut: true,
  });
  const [tier, setTier] = useState<ExperienceTier | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [topicSlug, setTopicSlug] = useState('');
  const [progress, setProgress] = useState<
    Record<string, { reviewed: boolean; confident: boolean }>
  >({});

  // Hydrate filters + search from the URL on mount so a filtered view is shareable.
  useEffect(() => {
    setProgress(getInterviewProgress());
    const q = readParam('q');
    if (q) setSearchQuery(q);
    if (!lockedTier) setTier((readParam('tier') as ExperienceTier) || '');
    if (!lockedTopicSlug) setTopicSlug(readParam('topic'));
    setDifficulty((readParam('difficulty') as Difficulty) || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror filters back to the URL (no history spam).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const set = (k: string, v: string) => (v ? params.set(k, v) : params.delete(k));
    set('q', deferredSearchQuery.trim());
    if (!lockedTier) set('tier', tier);
    if (!lockedTopicSlug) set('topic', topicSlug);
    set('difficulty', difficulty);
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [deferredSearchQuery, tier, topicSlug, difficulty, lockedTier, lockedTopicSlug]);

  // Topics present in this pool, for the dropdown.
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, slug: tagToSlug(name), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [questions]);

  const filtered = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return questions.filter((item) => {
      if (tier && item.tier !== tier) return false;
      if (difficulty && item.difficulty !== difficulty) return false;
      if (topicSlug && tagToSlug(item.category) !== topicSlug) return false;
      if (!q) return true;
      const haystack = [item.title, item.question, item.category, ...item.tags]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [questions, deferredSearchQuery, tier, difficulty, topicSlug]);

  // Build a /practice link carrying the active filters.
  const practiceUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (lockedTier) params.set('tier', lockedTier);
    else if (tier) params.set('tier', tier);
    if (lockedTopicSlug) params.set('topic', lockedTopicSlug);
    else if (topicSlug) params.set('topic', topicSlug);
    if (difficulty) params.set('difficulty', difficulty);
    const query = params.toString();
    return `${practiceHref}${query ? `?${query}` : ''}`;
  }, [lockedTier, lockedTopicSlug, tier, topicSlug, difficulty, practiceHref]);

  const hasFilters = Boolean(deferredSearchQuery.trim() || tier || difficulty || topicSlug);

  return (
    <div>
      {/* Search + practice CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions, topics, tags…"
            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            aria-label="Search interview questions"
          />
        </div>
        <Link
          href={practiceUrl}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Play className="w-4 h-4" strokeWidth={2} />
          Practice {filtered.length}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
        {!lockedTier && (
          <ChipGroup label="level">
            <Chip active={tier === ''} onClick={() => setTier('')}>
              all
            </Chip>
            {TIERS.map((t) => (
              <Chip key={t} active={tier === t} onClick={() => setTier(t)}>
                {TIER_LABELS[t]}
              </Chip>
            ))}
          </ChipGroup>
        )}

        <ChipGroup label="difficulty">
          <Chip active={difficulty === ''} onClick={() => setDifficulty('')}>
            all
          </Chip>
          {DIFFICULTIES.map((d) => (
            <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
              {d}
            </Chip>
          ))}
        </ChipGroup>

        {!lockedTopicSlug && topics.length > 1 && (
          <label className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            topic
            <select
              value={topicSlug}
              onChange={(e) => setTopicSlug(e.target.value)}
              className="px-2 py-1 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Filter by topic"
            >
              <option value="">all</option>
              {topics.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name} ({t.count})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Results */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-mono text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'question' : 'questions'}
        </p>
        {hasFilters && (
          <button
            onClick={() => {
              setSearchQuery('');
              if (!lockedTier) setTier('');
              setDifficulty('');
              if (!lockedTopicSlug) setTopicSlug('');
            }}
            className="text-xs font-mono text-muted-foreground hover:text-primary"
          >
            clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono py-8 text-center">
          No questions match. Try a broader search or clearing filters.
        </p>
      ) : (
        <ul className="grid gap-px bg-border border rounded-md overflow-hidden">
          {filtered.map((q) => {
            const entry = progress[q.id];
            return (
              <li key={q.id}>
                <Link
                  href={`/interview-questions/${q.tier}/${q.slug}`}
                  className="group flex items-start gap-3 bg-card p-4 transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 flex-shrink-0" aria-hidden="true">
                    {entry?.reviewed ? (
                      <CheckCircle2
                        className={`w-4 h-4 ${entry.confident ? 'text-emerald-500' : 'text-amber-500'}`}
                        strokeWidth={2}
                      />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground/40" strokeWidth={1.5} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                      {q.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {q.question}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {!lockedTier && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
                          {TIER_LABELS[q.tier]}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getDifficultyColor(q.difficulty)}`}
                      >
                        {q.difficulty}
                      </span>
                      {!lockedTopicSlug && (
                        <span className="text-[10px] font-mono text-muted-foreground/70">
                          {q.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/50 transition-all group-hover:text-primary group-hover:translate-x-0.5 flex-shrink-0 mt-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 font-mono text-xs">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-md border transition-colors ${
        active
          ? 'bg-primary/10 border-primary/40 text-primary'
          : 'bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
