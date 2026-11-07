import { getActiveGames, getGameById, type Game } from '@/lib/games';
import { getSimulatorExplainer } from '@/lib/games-seo-content';

/**
 * What a simulator's frame and completion card need from the page around it.
 * The server builds it, so the large explainer file never ships to the client.
 */
export interface SimGameInfo {
  slug: string;
  title: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  /** Short topic names from the explainer, the default "What you learned" list. */
  teaches?: string[];
  /** The first "Try next" game of the page shell. */
  next?: { title: string; href: string };
}

/** Games to try next: the same category first, then any active game. */
export function pickRelatedGames(
  allGames: Game[],
  game: Game | undefined,
  slug: string,
  count = 3
): Game[] {
  const sameCategory = game?.category
    ? allGames.filter((g) => g.id !== slug && g.category === game.category)
    : [];
  const otherGames = allGames.filter((g) => g.id !== slug && !sameCategory.includes(g));
  return [...sameCategory, ...otherGames].slice(0, count);
}

export function simGameInfo(slug: string, game: Game | undefined, related: Game[]): SimGameInfo {
  const explainer = getSimulatorExplainer(slug);
  const next = related[0];
  return {
    slug,
    title: game?.title ?? slug,
    level: explainer?.level,
    teaches: explainer?.teaches.slice(0, 3),
    next: next ? { title: next.title, href: next.href } : undefined,
  };
}

export async function getSimGameInfo(slug: string): Promise<SimGameInfo> {
  const [game, allGames] = await Promise.all([getGameById(slug), getActiveGames()]);
  return simGameInfo(slug, game, pickRelatedGames(allGames, game, slug, 1));
}
