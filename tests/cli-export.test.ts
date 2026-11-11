import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  absolutizeMarkdown,
  buildCliData,
  buildIncidents,
  buildManifest,
  buildQuizzes,
  buildSponsors,
  postShard,
  type CliDataInput,
} from '@/lib/cli-export';
import { getActiveGames } from '@/lib/games';
import { getAllPosts } from '@/lib/posts';
import { sponsors } from '@/lib/sponsors';

const SITE = 'https://devops-daily.com';

async function readJsonDirectory(directory: string) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(
    names.map(async (name) => {
      const value = JSON.parse(await readFile(path.join(directory, name), 'utf8')) as Record<
        string,
        unknown
      >;
      return directory.endsWith(`${path.sep}checklists`)
        ? { ...value, slug: path.basename(name, '.json') }
        : value;
    })
  );
}

describe('CLI export', () => {
  it('assigns stable FNV-1a shards', () => {
    expect(postShard('kubernetes-pod-oomkilled')).toBe(14);
    expect(postShard('webhook-delivery-simulator')).toBe(6);
    expect(postShard('kubernetes-pod-oomkilled')).toBeGreaterThanOrEqual(0);
    expect(postShard('kubernetes-pod-oomkilled')).toBeLessThan(16);
  });

  it('absolutizes markdown without changing code or anchors', () => {
    const markdown = [
      '[page](/posts/example) ![image](../../public/images/posts/example/a.svg)',
      '<img src="/images/logo.svg"><a href="/guides">Guide</a>',
      '[asset]: /images/asset.png',
      '[authoring](/public/images/posts/example/b.svg)',
      '[anchor](#section) [site](https://example.com) [mail](mailto:hello@example.com)',
      '`[inline](/leave-alone)`',
      'Next.js serves files from /public/ and ../public/ as they are.',
      '<img src="../../public/images/posts/example/c.png">',
      '<!-- remove this -->',
      '```bash',
      'curl /leave-alone # <!-- also leave -->',
      '```',
    ].join('\n');

    expect(absolutizeMarkdown(markdown, SITE)).toBe(
      [
        '[page](https://devops-daily.com/posts/example) ![image](https://devops-daily.com/images/posts/example/a.svg)',
        '<img src="https://devops-daily.com/images/logo.svg"><a href="https://devops-daily.com/guides">Guide</a>',
        '[asset]: https://devops-daily.com/images/asset.png',
        '[authoring](https://devops-daily.com/images/posts/example/b.svg)',
        '[anchor](#section) [site](https://example.com) [mail](mailto:hello@example.com)',
        '`[inline](/leave-alone)`',
        'Next.js serves files from /public/ and ../public/ as they are.',
        '<img src="https://devops-daily.com/images/posts/example/c.png">',
        '',
        '```bash',
        'curl /leave-alone # <!-- also leave -->',
        '```',
      ].join('\n')
    );
  });

  it('drops visual quiz questions and maps portable fields', () => {
    const result = buildQuizzes(
      [
        {
          id: 'z',
          title: 'Quiz',
          questions: [
            { id: 'branch', branches: [], description: 'drop', options: ['a'], correctAnswer: 0 },
            {
              id: 'conflict',
              conflict: 'x',
              description: 'drop',
              options: ['a'],
              correctAnswer: 0,
            },
            {
              id: 'keep',
              title: 'Keep',
              situation: 'Situation',
              codeExample: 'echo hi',
              description: 'Question',
              options: ['no', 'yes'],
              correctAnswer: 1,
              explanation: 'Because',
              hint: 'Hint',
              difficulty: 'beginner',
              points: 3,
            },
          ],
        },
      ],
      SITE
    );

    expect(result).toEqual({
      schema: 1,
      quizzes: [
        {
          id: 'z',
          title: 'Quiz',
          url: `${SITE}/quizzes/z`,
          questions: [
            {
              id: 'keep',
              question: 'Question',
              options: ['no', 'yes'],
              correct: 1,
              title: 'Keep',
              situation: 'Situation',
              code: 'echo hi',
              explanation: 'Because',
              hint: 'Hint',
              difficulty: 'beginner',
              points: 3,
            },
          ],
        },
      ],
    });
  });

  it('lists paid sponsors in their existing order with cli go links', () => {
    const result = buildSponsors([
      {
        name: 'Paid',
        logo: '/paid.svg',
        url: 'https://paid.example',
        goSlug: 'paid',
        tagline: 'Paid text',
      },
      {
        name: 'Ours',
        logo: '/ours.svg',
        url: 'https://ours.example',
        ownProduct: true,
      },
    ]);

    expect(result.sponsors).toEqual([
      { name: 'Paid', url: 'https://go.devops-daily.com/paid?p=cli', text: 'Paid text' },
    ]);
  });

  it('rejects incidents whose answer is absent from the options', () => {
    expect(() =>
      buildIncidents({
        incidents: [
          {
            id: 'day-01',
            options: [{ key: 'A', text: 'A' }],
            correct: 'B',
            linkUrl: `${SITE}/games/example`,
          },
        ],
      })
    ).toThrow('invalid correct option');
  });

  it('builds manifest hashes and byte counts from exact file strings', () => {
    const files = { 'posts.json': '{"schema":1}\n' };
    const manifest = buildManifest(files, { posts: 1 }, '2026-11-11T10:00:00.000Z', SITE);
    expect(manifest.files['posts.json']).toEqual({
      sha256: createHash('sha256').update(files['posts.json'], 'utf8').digest('hex'),
      bytes: Buffer.byteLength(files['posts.json'], 'utf8'),
    });
  });

  it('exports the real content with all bodies in their advertised shard', async () => {
    const root = process.cwd();
    const [posts, quizzes, decks, checklists, incidents, games] = await Promise.all([
      getAllPosts(),
      readJsonDirectory(path.join(root, 'content', 'quizzes')),
      readJsonDirectory(path.join(root, 'content', 'flashcards')),
      readJsonDirectory(path.join(root, 'content', 'checklists')),
      readFile(path.join(root, 'content', 'incidents', 'incidents.json'), 'utf8').then(JSON.parse),
      getActiveGames(),
    ]);
    const input: CliDataInput = {
      posts,
      quizzes,
      decks,
      checklists,
      incidents,
      games,
      sponsors,
      site: SITE,
      generatedAt: '2026-11-11T10:00:00.000Z',
    };
    const first = buildCliData(input);
    const second = buildCliData({ ...input, generatedAt: '2026-11-11T10:00:00.001Z' });

    for (const [name, contents] of Object.entries(first)) {
      if (name !== 'index.json') expect(second[name]).toBe(contents);
    }
    const firstManifest = JSON.parse(first['index.json']) as { generatedAt?: string };
    const secondManifest = JSON.parse(second['index.json']) as { generatedAt?: string };
    delete firstManifest.generatedAt;
    delete secondManifest.generatedAt;
    expect(secondManifest).toEqual(firstManifest);
    for (const contents of Object.values(first)) expect(JSON.parse(contents).schema).toBe(1);
    const postsIndex = JSON.parse(first['posts.json']) as {
      posts: Array<{ slug: string; body: string }>;
    };
    for (const post of postsIndex.posts) {
      expect(JSON.parse(first[post.body]).posts).toHaveProperty(post.slug);
    }
  }, 15_000);
});
