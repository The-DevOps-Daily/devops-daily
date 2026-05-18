/**
 * Cross-content-type related lookup. Within-type related sections
 * (`pickRelatedItems` in lib/related-content.ts) only show siblings of the
 * same kind. This module aggregates posts, checklists, flashcards, exercises,
 * quizzes, and interview questions into a uniform shape and scores them all
 * together so that a post about Istio can surface the matching quiz,
 * checklist, and flashcard right under it.
 *
 * Scoring follows the same shape as `pickRelatedItems` (10 pts per matching
 * tag, 5 pts for same category, 1 pt for matching difficulty), with one
 * extra rule: items of the same content type as the current item are
 * de-prioritized at tiebreak so cross-type matches surface first when scores
 * tie. The page's existing within-type "Related <X>" section already covers
 * same-type siblings; this section's value is the *other* kinds of content.
 */

import { getAllPosts } from './posts';
import { getAllChecklists } from './checklists';
import { getAllFlashCardSets } from './flashcard-loader';
import { getAllExercises } from './exercises';
import { getAllQuizzes } from './quiz-loader';
import { interviewQuestions } from '@/content/interview-questions';

export type CrossContentType =
  | 'post'
  | 'checklist'
  | 'flashcard'
  | 'exercise'
  | 'quiz'
  | 'interview-question';

export interface CrossContentItem {
  /** Unique identifier within its type. Combined with `type`, fully unique. */
  id: string;
  type: CrossContentType;
  title: string;
  description: string;
  /** Absolute path on the site, ready to drop into a Link `href`. */
  href: string;
  category: string;
  tags: string[];
  difficulty?: string;
  /** Optional small hint shown next to the item (estimated time, tier, etc.) */
  meta?: string;
}

/**
 * Loads every content item from every type into a single normalized array.
 * Cached implicitly because each underlying loader has its own cache.
 */
async function loadAllCrossContent(): Promise<CrossContentItem[]> {
  const [posts, checklists, flashcards, exercises, quizzes] = await Promise.all([
    getAllPosts(),
    getAllChecklists(),
    getAllFlashCardSets(),
    getAllExercises(),
    getAllQuizzes(),
  ]);

  const items: CrossContentItem[] = [];

  for (const post of posts) {
    items.push({
      id: post.slug,
      type: 'post',
      title: post.title,
      description: post.excerpt || '',
      href: `/posts/${post.slug}`,
      category: post.category?.slug || '',
      tags: (post.tags || []).map((t) => String(t)),
    });
  }

  for (const c of checklists) {
    items.push({
      id: c.slug,
      type: 'checklist',
      title: c.title,
      description: c.description,
      href: `/checklists/${c.slug}`,
      category: c.category,
      tags: c.tags || [],
      difficulty: c.difficulty,
      meta: c.estimatedTime,
    });
  }

  for (const f of flashcards) {
    items.push({
      id: f.id,
      type: 'flashcard',
      title: f.title,
      description: f.description,
      href: `/flashcards/${f.id}`,
      category: f.category,
      // Sets do not carry top-level tags today; category + difficulty still
      // contribute to scoring so flashcards remain eligible.
      tags: [],
      difficulty: f.difficulty,
      meta: f.estimatedTime,
    });
  }

  for (const ex of exercises) {
    items.push({
      id: ex.id,
      type: 'exercise',
      title: ex.title,
      description: ex.description,
      href: `/exercises/${ex.id}`,
      category: ex.category?.slug || '',
      tags: ex.tags || [],
      difficulty: ex.difficulty,
      meta: ex.estimatedTime,
    });
  }

  for (const q of quizzes) {
    items.push({
      id: q.id,
      type: 'quiz',
      title: q.title,
      description: q.description || '',
      href: `/quizzes/${q.id}`,
      category: q.category,
      tags: (q.metadata?.tags || []).map((t) => String(t)),
      meta: q.metadata?.estimatedTime,
    });
  }

  for (const iq of interviewQuestions) {
    items.push({
      id: `${iq.tier}/${iq.slug}`,
      type: 'interview-question',
      title: iq.title,
      description: iq.question || '',
      href: `/interview-questions/${iq.tier}/${iq.slug}`,
      category: iq.category,
      tags: iq.tags || [],
      meta: iq.tier,
    });
  }

  return items;
}

export interface RelatedAcrossTypesOptions {
  /** Item to compute siblings for. */
  current: {
    type: CrossContentType;
    id: string;
    category?: string;
    tags?: string[];
    difficulty?: string;
  };
  /** How many items to return. Default 3. */
  limit?: number;
  /**
   * If set, allow at most this many items of any single type. Default 1
   * (so the section spans multiple types instead of three quizzes).
   */
  maxPerType?: number;
}

interface ScoredItem {
  item: CrossContentItem;
  score: number;
}

/**
 * Returns up to `limit` items from any content type other than the current
 * item, scored by tag/category/difficulty overlap. The same-type cap keeps
 * the section visually mixed; pair this with the existing within-type
 * "More <X>" section.
 */
export async function getRelatedAcrossTypes(
  options: RelatedAcrossTypesOptions,
): Promise<CrossContentItem[]> {
  const { current, limit = 3, maxPerType = 1 } = options;
  const all = await loadAllCrossContent();
  const currentTags = (current.tags ?? []).map((t) => t.toLowerCase());
  const currentCategory = current.category;
  const currentDifficulty = current.difficulty;

  // Exclude the current item by (type, id). Two items can share an id across
  // types (e.g. a post slug == a quiz id) so we must compare both fields.
  const candidates = all.filter(
    (item) => !(item.type === current.type && item.id === current.id),
  );

  const scored: ScoredItem[] = candidates.map((item) => {
    let score = 0;

    if (currentTags.length > 0 && item.tags.length > 0) {
      const itemTags = item.tags.map((t) => t.toLowerCase());
      const matches = itemTags.filter((t) => currentTags.includes(t));
      score += matches.length * 10;
    }

    if (currentCategory && item.category === currentCategory) {
      score += 5;
    }

    if (currentDifficulty && item.difficulty === currentDifficulty) {
      score += 1;
    }

    return { item, score };
  });

  // Drop zero-score noise; we'd rather show a shorter section than pad with
  // unrelated items that hurt internal-link signal quality.
  const positive = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreaker: prefer items whose type differs from `current.type` so
      // mixed-type results outrank same-type ones at equal score.
      const aSameType = a.item.type === current.type ? 1 : 0;
      const bSameType = b.item.type === current.type ? 1 : 0;
      if (aSameType !== bSameType) return aSameType - bSameType;
      return a.item.id.localeCompare(b.item.id);
    });

  // Apply the same-type cap so the section reads as a mix instead of three
  // items of one kind.
  const selected: CrossContentItem[] = [];
  const perType = new Map<CrossContentType, number>();
  for (const { item } of positive) {
    if (selected.length >= limit) break;
    const used = perType.get(item.type) ?? 0;
    if (used >= maxPerType) continue;
    selected.push(item);
    perType.set(item.type, used + 1);
  }

  return selected;
}

/** Display label for each content type. Used for the small chip on the card. */
export const TYPE_LABELS: Record<CrossContentType, string> = {
  post: 'Article',
  checklist: 'Checklist',
  flashcard: 'Flashcards',
  exercise: 'Exercise',
  quiz: 'Quiz',
  'interview-question': 'Interview',
};
