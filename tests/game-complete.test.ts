import { describe, expect, it } from 'vitest';
import { OPSVILLE_HELLO, cutOpener, isOpsvilleHello, isRunId } from '@/lib/games/game-complete';

describe('Opsville embed messages', () => {
  const run = 'k3x9q2m7p4w8z1v6';

  it('accepts run ids of 8 to 32 lowercase letters and digits', () => {
    expect(isRunId(run)).toBe(true);
    expect(isRunId('abc12345')).toBe(true);
    expect(isRunId('short')).toBe(false);
    expect(isRunId('UPPER12345')).toBe(false);
    expect(isRunId('a'.repeat(33))).toBe(false);
    expect(isRunId(null)).toBe(false);
  });

  it("only takes Opsville's hello for this run", () => {
    expect(isOpsvilleHello({ type: OPSVILLE_HELLO, run }, run)).toBe(true);
    expect(isOpsvilleHello({ type: OPSVILLE_HELLO, run: 'otherrun12345678' }, run)).toBe(false);
    expect(isOpsvilleHello({ type: OPSVILLE_HELLO }, run)).toBe(false);
    expect(isOpsvilleHello({ type: 'other', run }, run)).toBe(false);
    expect(isOpsvilleHello(OPSVILLE_HELLO, run)).toBe(false);
    expect(isOpsvilleHello({ type: OPSVILLE_HELLO, run: 'bad' }, 'bad')).toBe(false);
  });

  it('clears window.opener', () => {
    const win = { opener: {} as unknown };
    cutOpener(win);
    expect(win.opener).toBeNull();
  });
});
