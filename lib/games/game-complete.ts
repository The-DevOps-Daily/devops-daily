/**
 * "Game complete" signal for Opsville, the game at devops-daily.com/opsville/.
 *
 * A game calls signalGameComplete() when the player finishes its lessons. On
 * the site nothing listens, so it does nothing. In the embed route opened with
 * ?embed=opsville&run=<id>, the embed client tells Opsville, which is on the
 * same origin:
 * - in Opsville's frame, with postMessage to the parent, for our origin only;
 * - in a tab Opsville opened (phones), on a BroadcastChannel, which only
 *   reaches pages of the same origin.
 * The embed says "ready", Opsville answers "hello" with the same run id, and
 * only then does the embed send {type: 'devops-daily:game-complete', game, run}.
 */
export const GAME_COMPLETE_EVENT = 'devops-daily:game-complete';
export const OPSVILLE_READY = 'opsville:ready';
export const OPSVILLE_HELLO = 'opsville:hello';
export const OPSVILLE_CHANNEL = 'opsville';

/** Opsville makes a new run id for each quest: 8 to 32 lowercase letters and digits. */
export function isRunId(run: unknown): run is string {
  return typeof run === 'string' && /^[a-z0-9]{8,32}$/.test(run);
}

/** True when the message is Opsville's hello for this run. */
export function isOpsvilleHello(data: unknown, run: string): boolean {
  if (!isRunId(run) || !data || typeof data !== 'object') return false;
  const { type, run: helloRun } = data as Record<string, unknown>;
  return type === OPSVILLE_HELLO && helloRun === run;
}

/**
 * Clears window.opener, so nothing loaded in this tab later (a site the player
 * follows a link to) can reach or navigate the tab that opened it. Opsville
 * opens games with noopener; this also covers anyone else who opens the page.
 */
export function cutOpener(win: { opener: unknown }): void {
  try {
    win.opener = null;
  } catch {
    // Some browsers make opener read-only; there is nothing more to cut then.
  }
}

/** Safe to call more than once; the game keeps track of what it has seen. */
export function signalGameComplete(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GAME_COMPLETE_EVENT));
}
