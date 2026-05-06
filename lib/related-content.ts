/**
 * Generic "pick related items" scorer used by /checklists/[slug],
 * /flashcards/[id], /exercises/[id], and other within-content-type related
 * sections. Same scoring shape as `getRelatedQuizzes` in lib/quiz-loader.ts:
 *
 *   - 10 points per matching tag
 *   -  5 points for same category
 *   -  1 point for matching difficulty
 *
 * Items must be normalized to `{ slug, category, tags, difficulty? }` before
 * being passed in. Cross-type related content (e.g. surfacing a quiz next to
 * a checklist on the same topic) is intentionally not handled here yet, since
 * each content type's link shape differs and the simple within-type version
 * already closes most of the dofollow-inlink gap Ahrefs flagged.
 */

export interface RelatedScorable {
  slug: string;
  category?: string;
  tags?: string[];
  difficulty?: string;
}

export interface PickRelatedOptions {
  /** Slug of the current item; excluded from results. */
  currentSlug: string;
  /** How many items to return. Defaults to 3. */
  limit?: number;
  /** When two items tie on score, prefer this category. */
  preferCategory?: string;
}

export function pickRelatedItems<T extends RelatedScorable>(
  items: T[],
  current: RelatedScorable,
  options: PickRelatedOptions,
): T[] {
  const { currentSlug, limit = 3, preferCategory } = options;
  const currentTags = current.tags ?? [];
  const currentCategory = current.category;
  const currentDifficulty = current.difficulty;

  const candidates = items.filter((item) => item.slug !== currentSlug);

  const scored = candidates.map((item) => {
    let score = 0;

    if (currentTags.length > 0 && item.tags && item.tags.length > 0) {
      const itemTags = item.tags.map((t) => t.toLowerCase());
      const lowered = currentTags.map((t) => t.toLowerCase());
      const matches = itemTags.filter((t) => lowered.includes(t));
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

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreaker: prefer the requested category, then alphabetical slug for
    // determinism (so static rendering produces stable output).
    if (preferCategory) {
      const aPref = a.item.category === preferCategory ? 1 : 0;
      const bPref = b.item.category === preferCategory ? 1 : 0;
      if (bPref !== aPref) return bPref - aPref;
    }
    return a.item.slug.localeCompare(b.item.slug);
  });

  // Keep items that share at least one signal with the current item. Items
  // with score 0 share nothing relevant and aren't worth surfacing as
  // "related" - we'd rather show a shorter list than pad with noise.
  return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.item);
}
