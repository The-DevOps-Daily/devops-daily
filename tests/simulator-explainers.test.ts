import { describe, it, expect } from 'vitest';
import { getAllGames } from '@/lib/games';
import { getSimulatorExplainer, simulatorExplainerIds } from '@/lib/games-seo-content';

// Toys and quizzes have no explainer on purpose: there is nothing to teach in a
// name generator, and a quiz page already is its own text.
const NOT_SIMULATORS = new Set([
  'heroku-style-name-generator',
  'bug-hunter',
  'devops-scorecard',
  'scalable-sentry',
  'cicd-stack-generator',
  'infra-tarot',
  'devops-memes',
  'cards-against-devops',
  'git-quiz',
  'uptime-defender',
]);

describe('simulator explainers', () => {
  it('cover every live simulator', async () => {
    const games = await getAllGames();
    const missing = games
      .filter((g) => !g.isComingSoon && !NOT_SIMULATORS.has(g.id))
      .filter((g) => g.type === 'simulator' || g.id === 'linux-terminal')
      .map((g) => g.id)
      .filter((id) => !getSimulatorExplainer(id));
    expect(missing).toEqual([]);
  });

  it('only describe games that exist', async () => {
    const ids = new Set((await getAllGames()).map((g) => g.id));
    expect(simulatorExplainerIds().filter((id) => !ids.has(id))).toEqual([]);
  });

  it('keep the shape the page and the FAQ schema expect', () => {
    for (const id of simulatorExplainerIds()) {
      const e = getSimulatorExplainer(id)!;
      const words = e.summary.trim().split(/\s+/).length;
      expect(words, `${id} summary length`).toBeGreaterThanOrEqual(150);
      expect(words, `${id} summary length`).toBeLessThanOrEqual(250);
      expect(e.tryThis, `${id} tryThis`).toHaveLength(3);
      expect(e.faq.length, `${id} faq`).toBeGreaterThanOrEqual(3);
      expect(e.faq.length, `${id} faq`).toBeLessThanOrEqual(4);
      expect(e.teaches.length, `${id} teaches`).toBeGreaterThan(0);
      expect(new Set(e.faq.map((q) => q.question)).size, `${id} duplicate question`).toBe(e.faq.length);
      expect(JSON.stringify(e), `${id} em dash`).not.toMatch(/—/);
    }
  });
});
