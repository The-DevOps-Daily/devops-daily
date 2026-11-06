/**
 * "Game complete" signal for Opsville (game.devops-daily.com).
 *
 * A game calls signalGameComplete() when the player finishes its lessons. On
 * the site nothing listens, so it does nothing. In the embed route opened with
 * ?embed=opsville, the embed client forwards it to the Opsville page that
 * frames it as {type: 'devops-daily:game-complete', game: '<slug>'}, posted
 * only to an Opsville origin. Opsville says hello first, and the origin of that
 * hello message (set by the browser) is where the signal goes.
 */
export const GAME_COMPLETE_EVENT = 'devops-daily:game-complete';
export const OPSVILLE_HELLO = 'opsville:hello';

const OPSVILLE_ORIGINS = [
  /^https:\/\/game\.devops-daily\.com$/,
  /^https:\/\/([a-z0-9-]+\.)?opsville\.pages\.dev$/,
];

export function isOpsvilleOrigin(origin: string): boolean {
  return OPSVILLE_ORIGINS.some((pattern) => pattern.test(origin));
}

/**
 * Takes the window that opened this page and cuts the link back at once, so
 * nothing loaded in this tab later (a site the player follows a link to) can
 * reach or navigate the Opsville tab. Only the returned reference is kept, and
 * it is used for nothing but posting to an Opsville origin.
 */
export function takeOpener(win: { opener: Window | null }): Window | null {
  const opener = win.opener;
  try {
    win.opener = null;
  } catch {
    // Some browsers make opener read-only; there is nothing more to cut then.
  }
  return opener;
}

/** Safe to call more than once; the game keeps track of what it has seen. */
export function signalGameComplete(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GAME_COMPLETE_EVENT));
}
