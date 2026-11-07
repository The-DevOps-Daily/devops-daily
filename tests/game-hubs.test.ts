import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GamesPage from '@/app/games/page';
import SimulatorsPage from '@/app/simulators/page';
import sitemap from '@/app/sitemap';
import {
  SIMULATOR_TOPICS,
  getActiveByType,
  getGameGroup,
  getSimulatorTopic,
} from '@/lib/game-hubs';
import { getActiveGames, getAllGames, getGameById } from '@/lib/games';

// Opsville sits on /games too, but it lives at /opsville/, not in lib/games.ts.
const GAMES = {
  arcade: ['bug-hunter', 'on-call', 'scalable-sentry', 'uptime-defender'],
  party: [
    'cards-against-devops',
    'cicd-stack-generator',
    'devops-memes',
    'devops-scorecard',
    'heroku-style-name-generator',
    'infra-tarot',
  ],
};

function gameLinks(html: string): string[] {
  const slugs = [...html.matchAll(/href="\/games\/([a-z0-9-]+)"/g)].map((match) => match[1]);
  return [...new Set(slugs)].sort();
}

function textOf(html: string): string {
  return html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

describe('games and simulators hubs', () => {
  it('gives every registry entry a type', async () => {
    for (const game of await getAllGames()) {
      expect(['game', 'simulator'], game.id).toContain(game.type);
    }
  });

  it('splits the live entries into games and simulators', async () => {
    const [games, simulators, active] = await Promise.all([
      getActiveByType('game'),
      getActiveByType('simulator'),
      getActiveGames(),
    ]);
    expect(games.map((game) => game.id).sort()).toEqual([...GAMES.arcade, ...GAMES.party].sort());
    expect(games.length + simulators.length).toBe(active.length);
    for (const game of games) {
      const expected = GAMES.arcade.includes(game.id) ? 'arcade' : 'party';
      expect(getGameGroup(game), game.id).toBe(expected);
    }
  });

  it('files each simulator under a topic, and every topic has one', async () => {
    const simulators = await getActiveByType('simulator');
    const used = new Set(simulators.map((game) => getSimulatorTopic(game)));
    expect([...used].sort()).toEqual(SIMULATOR_TOPICS.map((topic) => topic.id).sort());

    const topicOf = async (id: string) => getSimulatorTopic((await getGameById(id))!);
    expect(await topicOf('linux-terminal')).toBe('linux');
    expect(await topicOf('docker-escape')).toBe('docker');
    expect(await topicOf('yaml-parsing-simulator')).toBe('cicd');
    expect(await topicOf('incident-commander-simulator')).toBe('observability');
    expect(await topicOf('postgres-wire-protocol')).toBe('data');
    expect(await topicOf('aws-vpc-simulator')).toBe('cloud');
    expect(await topicOf('rate-limit-simulator')).toBe('architecture');
  });

  it('/simulators lists every simulator once, with the count and an ItemList', async () => {
    const simulators = await getActiveByType('simulator');
    const html = renderToStaticMarkup(await SimulatorsPage());
    const text = textOf(html);

    expect(gameLinks(html)).toEqual(simulators.map((game) => game.id).sort());
    expect(text).toContain(`${simulators.length} simulators`);
    expect(text).toContain(`Showing ${simulators.length} of ${simulators.length} simulators`);

    const itemList = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]))
      .find((data) => data['@type'] === 'ItemList');
    expect(itemList.numberOfItems).toBe(simulators.length);
    expect(itemList.itemListElement).toHaveLength(simulators.length);
  });

  it('/games features Opsville, lists only the games and links to the simulators', async () => {
    const [games, simulators] = await Promise.all([
      getActiveByType('game'),
      getActiveByType('simulator'),
    ]);
    const html = renderToStaticMarkup(await GamesPage());
    const text = textOf(html);

    expect(html).toContain('href="/opsville/"');
    expect(text).toContain('Play Opsville');
    expect(gameLinks(html)).toEqual(games.map((game) => game.id).sort());
    expect(text).toContain(`${games.length} arcade and party games`);
    expect(html).toContain('href="/simulators"');
    expect(text).toContain(`See all ${simulators.length} simulators`);
  });

  // sitemap() reads every post, guide and quiz, so it needs more than 5s.
  it('lists both hubs in the sitemap', { timeout: 60_000 }, async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain('https://devops-daily.com/simulators');
    expect(urls).toContain('https://devops-daily.com/games');
  });
});
