import { describe, expect, it } from 'vitest';
import { isOpsvilleOrigin } from '@/lib/games/game-complete';

describe('Opsville embed origin', () => {
  it('accepts the game domain and its Pages previews', () => {
    expect(isOpsvilleOrigin('https://game.devops-daily.com')).toBe(true);
    expect(isOpsvilleOrigin('https://opsville.pages.dev')).toBe(true);
    expect(isOpsvilleOrigin('https://3f2a9c1e.opsville.pages.dev')).toBe(true);
  });

  it('rejects look-alikes and plain http', () => {
    expect(isOpsvilleOrigin('http://game.devops-daily.com')).toBe(false);
    expect(isOpsvilleOrigin('https://game.devops-daily.com.evil.example')).toBe(false);
    expect(isOpsvilleOrigin('https://evilopsville.pages.dev')).toBe(false);
    expect(isOpsvilleOrigin('https://opsville.pages.dev.evil.example')).toBe(false);
    expect(isOpsvilleOrigin('https://devops-daily.com')).toBe(false);
  });
});
