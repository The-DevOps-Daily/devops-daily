import { describe, it, expect } from 'vitest';
import { getActiveGames, type Game } from '@/lib/games';
import { getAllPosts } from '@/lib/posts';
import { getRelatedSimulators, scoreSimulator } from '@/lib/related-simulators';

/**
 * These assert the two failure modes found while building this against the
 * real corpus, both of which produced links that were worse than no link:
 *
 * 1. Tag overlap alone sent 91 Linux posts to the fork bomb simulator,
 *    because a Linux+Bash post matches two of its tags and the Linux
 *    terminal only one.
 * 2. Broad tags matched anything. An article about AI resume screening
 *    reached the disaster-recovery simulator on 'devops' and
 *    'infrastructure', which are true of most of the site.
 */

function gameById(games: Game[], id: string): Game {
  const g = games.find((x) => x.id === id);
  if (!g) throw new Error(`fixture drift: no game with id ${id}`);
  return g;
}

describe('related simulators', () => {
  it('sends a Docker post to the Docker terminal, not the deeper internals one', async () => {
    const result = await getRelatedSimulators({
      tags: ['Docker', 'Containers'],
      categorySlug: 'docker',
    });
    expect(result[0]?.id).toBe('docker-terminal-simulator');
  });

  it('sends a Linux/Bash post to the Linux terminal rather than the fork bomb', async () => {
    const result = await getRelatedSimulators({
      tags: ['Linux', 'Bash'],
      categorySlug: 'linux',
    });
    expect(result[0]?.id).toBe('linux-terminal');
  });

  it.each([
    ['kubernetes', ['Kubernetes'], 'kubernetes-terminal-simulator'],
    ['terraform', ['Terraform'], 'terraform-terminal-simulator'],
    ['git', ['Git'], 'git-concepts-simulator'],
  ])('routes a %s post to its canonical simulator', async (category, tags, expected) => {
    const result = await getRelatedSimulators({ tags, categorySlug: category });
    expect(result[0]?.id).toBe(expected);
  });

  it('returns nothing for a post with no simulator-worthy topic', async () => {
    // Career and opinion pieces. Matching these to anything is filler.
    const result = await getRelatedSimulators({
      tags: ['Career', 'Hiring'],
      categorySlug: 'devops',
    });
    expect(result).toEqual([]);
  });

  it('does not match on broad tags alone', async () => {
    const games = await getActiveGames();
    const bcdr = gameById(games, 'bcdr-simulator');
    // The exact input that used to produce a link.
    const score = scoreSimulator(bcdr, {
      tags: ['DevOps', 'Infrastructure'],
      categorySlug: 'devops',
    });
    expect(score).toBe(0);
  });

  it('never returns more than the requested limit', async () => {
    const result = await getRelatedSimulators({ tags: ['Docker', 'Kubernetes'] }, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('is stable across calls, so the rendered page does not churn', async () => {
    const input = { tags: ['Kubernetes', 'Networking'], categorySlug: 'kubernetes' };
    const a = await getRelatedSimulators(input);
    const b = await getRelatedSimulators(input);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('every canonical target names a game that exists', async () => {
    // The map is hand-written, so a renamed or retired game would otherwise
    // silently stop being reachable rather than failing loudly.
    const games = await getActiveGames();
    const ids = new Set(games.map((g) => g.id));
    const targets = new Set<string>();
    for (const tag of ['docker', 'kubernetes', 'terraform', 'git', 'linux', 'postgres', 'mongodb', 'dns', 'aws', 'oauth', 'redis', 'kafka', 'istio', 'graphql']) {
      const result = await getRelatedSimulators({ tags: [tag] });
      result.forEach((r) => targets.add(r.id));
    }
    expect(targets.size).toBeGreaterThan(0);
    for (const t of targets) expect(ids.has(t)).toBe(true);
  });

  it('every returned href points at a real games route', async () => {
    const games = await getActiveGames();
    const hrefs = new Set(games.map((g) => g.href));
    const result = await getRelatedSimulators({ tags: ['Docker'], categorySlug: 'docker' });
    for (const r of result) {
      expect(r.href.startsWith('/games/')).toBe(true);
      expect(hrefs.has(r.href)).toBe(true);
    }
  });

  it('links a meaningful share of the corpus without linking all of it', async () => {
    // Both ends matter. Near-zero means the matcher is broken; near-total
    // means it is matching things it should not.
    const posts = await getAllPosts();
    let matched = 0;
    for (const p of posts as { tags?: string[]; category?: { slug?: string } }[]) {
      const r = await getRelatedSimulators({ tags: p.tags ?? [], categorySlug: p.category?.slug });
      if (r.length > 0) matched += 1;
    }
    const share = matched / posts.length;
    expect(share).toBeGreaterThan(0.6);
    expect(share).toBeLessThan(0.95);
  });
});
