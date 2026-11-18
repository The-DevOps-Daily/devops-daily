import { describe, expect, it } from 'vitest';
import matter from '../../lib/front-matter';
import { parseMarkdown } from '../../lib/markdown';
import {
  cleanExcerpt,
  cleanTitle,
  cutExcerpt,
  firstSentence,
  htmlToText,
} from '../devops-daily/utils/text';
import { cleanUrl } from '../devops-daily/utils/normalize';
import { escapeMarkdown, markdownLink, markdownUrl } from '../devops-daily/utils/markdown';
import { isNearDuplicate } from '../devops-daily/utils/dedupe';
import { isPromo, pickTop, relevanceScore, selectItems } from '../devops-daily/pipeline/rank';
import {
  generateMarkdown,
  generateSummary,
  shortHeadline,
  EDITOR_INTRO_END,
  EDITOR_INTRO_START,
} from '../devops-daily/pipeline/template';
import { assembleDigest } from '../devops-daily/pipeline/assemble';
import { selectOwnPosts } from '../devops-daily/pipeline/own-posts';
import { buildPrBody } from '../devops-daily/pipeline/pr-body';
import {
  compareVersionsDesc,
  isListedVersion,
  parseGithubReleaseTitle,
  parsePostgresReleaseTitle,
  releaseEntriesFromFeed,
  selectReleases,
} from '../devops-daily/crawler/releases';
import { isoWeekMondayUtc, isoWeekUtc, resolveWindow } from '../devops-daily/utils/date';
import type { NewsItem, OwnPost, Tier } from '../devops-daily/crawler/types';

const END = new Date('2026-11-16T00:00:00Z');
const START = new Date('2026-11-09T00:00:00Z');

let seq = 0;
function item(overrides: Partial<NewsItem> = {}): NewsItem {
  seq++;
  return {
    title: `Kubernetes scheduler change number ${seq} ships`,
    url: `https://example.com/post-${seq}`,
    excerpt: 'A plain sentence about the change.',
    source: `Source ${seq}`,
    publishedAt: '2026-11-12T10:00:00Z',
    category: 'Kubernetes',
    tier: 1 as Tier,
    ...overrides,
  };
}

describe('excerpt cutter', () => {
  const long =
    'Distributed AI training workloads impose complex scheduling requirements that the built-in scheduler cannot meet. ' +
    'Kubernetes schedules pods one at a time, but distributed training needs two things that break this model. ' +
    'Pods must land on hardware with the right topology.';

  it('ends at a full sentence between 160 and 240 characters', () => {
    const cut = cutExcerpt(long);
    expect(cut.length).toBeGreaterThanOrEqual(160);
    expect(cut.length).toBeLessThanOrEqual(240);
    expect(cut).toMatch(/model\.$/);
  });

  it('falls back to a word boundary and "..." when there is no sentence end', () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const cut = cutExcerpt(words);
    expect(cut.endsWith('...')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(240);
    const lastWord = cut.slice(0, -3).split(' ').pop();
    expect(words.split(' ')).toContain(lastWord);
  });

  it('keeps a short complete excerpt as it is', () => {
    expect(cutExcerpt('Short and complete.')).toBe('Short and complete.');
    expect(cutExcerpt("Learn what's new in Visual Studio Code 1.146")).toBe(
      "Learn what's new in Visual Studio Code 1.146"
    );
  });

  it('does not end a feed-truncated excerpt on a dangling word', () => {
    const text =
      'Older database protocols were built before big data arrived in force. Some still send results row by row, repeating details like column names';
    expect(cutExcerpt(text)).toBe(
      'Older database protocols were built before big data arrived in force.'
    );
  });

  it('does not treat abbreviations or versions as sentence ends', () => {
    const text =
      'Tools such as e.g. Helm and kubectl changed a lot in version 1.35 this year and the release notes explain the full list of changes for operators who run large fleets of clusters every day. It also adds a long list of smaller fixes that most readers will skip.';
    const cut = cutExcerpt(text, 60, 240);
    expect(cut).not.toMatch(/e\.g\.$/);
    expect(cut.endsWith('every day.')).toBe(true);
  });

  it('first sentence for the top picks', () => {
    expect(
      firstSentence('Git is releasing updates for six vulnerabilities. More text follows here.')
    ).toBe('Git is releasing updates for six vulnerabilities.');
  });
});

describe('feed text cleaning', () => {
  it('strips the WordPress footer, "| Blog" and truncation markers', () => {
    expect(cleanExcerpt('Some text here. The post My Title appeared first on The New Stack.')).toBe(
      'Some text here.'
    );
    expect(cleanExcerpt('Follow a deployment failure to root cause. | Blog')).toBe(
      'Follow a deployment failure to root cause.'
    );
    expect(cleanExcerpt('Teams waste hours resolving conflicts [&#8230;]')).toBe(
      'Teams waste hours resolving conflicts...'
    );
    expect(cleanExcerpt('Learn what is new in 1.146 Read the full article')).toBe(
      'Learn what is new in 1.146'
    );
  });

  it('decodes entities and keeps block tags apart', () => {
    expect(htmlToText('<h2>Moving to bare metal</h2><p>Red&nbsp;Hat&#8217;s &amp; more</p>')).toBe(
      'Moving to bare metal Red Hat’s & more'
    );
    expect(htmlToText('<p>Hi</p><script>alert(1)</script>')).toBe('Hi');
    expect(htmlToText('double &amp;#8217; encoded')).toBe('double ’ encoded');
    expect(htmlToText('half the battle — you also &mdash; need')).toBe(
      'half the battle - you also - need'
    );
  });

  it('cleans titles', () => {
    expect(cleanTitle('Automate AWS Savings Plans and Reserved Instances | Harness')).toBe(
      'Automate AWS Savings Plans and Reserved Instances'
    );
    expect(cleanTitle('Blog: Introducing Falco Operator 0.5.0')).toBe(
      'Introducing Falco Operator 0.5.0'
    );
    expect(cleanTitle('What&#8217;s new\n')).toBe('What’s new');
  });

  it('removes tracking parameters and non-web links', () => {
    expect(cleanUrl('https://a.example/p?utm_source=rss&utm_medium=feed&id=7&ref=x')).toBe(
      'https://a.example/p?id=7'
    );
    expect(cleanUrl('https://a.example/p?utm_campaign=x')).toBe('https://a.example/p');
    expect(cleanUrl('https://medium.example/p?source=rss----abc')).toBe('https://medium.example/p');
    expect(cleanUrl('javascript:alert(1)')).toBe('');
    expect(cleanUrl('data:text/html,hi')).toBe('');
  });
});

describe('Markdown escaping of feed text', () => {
  const nasty = [
    '<script>alert(1)</script>',
    '[click](javascript:alert(1))',
    '# Heading',
    '- list item',
    '1. ordered',
    '**bold** and `code` and _em_',
    '&lt;img src=x onerror=alert(1)&gt;',
    '<!-- comment -->',
    '```js',
    ':::warning',
    '> quote',
    '===',
  ];

  it('keeps every hostile string as plain text when rendered', () => {
    for (const text of nasty) {
      const html = parseMarkdown(`${escapeMarkdown('Lead')}\n${escapeMarkdown(text)}`);
      expect(html, text).not.toMatch(
        /<script|<h[1-6]|<ul|<ol|<blockquote|<pre|<code|<em|<strong|<img|post-callout/
      );
      expect(html, text).not.toMatch(/href="javascript/i);
      expect(html.match(/<a /g) ?? [], text).toHaveLength(0);
    }
  });

  it('builds safe links', () => {
    expect(markdownUrl('javascript:alert(1)')).toBe('');
    expect(markdownUrl('https://a.example/x_(y)')).toBe('https://a.example/x_%28y%29');
    expect(markdownLink('A [b] c', 'https://a.example/')).toBe('[A \\[b\\] c](https://a.example/)');
    expect(markdownLink('Title', 'javascript:alert(1)')).toBe('Title');
    const html = parseMarkdown(
      `**${markdownLink('x](https://evil.example) [y', 'https://a.example/(z)')}**`
    );
    expect(html.match(/href="/g)).toHaveLength(1);
    expect(html).toContain('href="https://a.example/%28z%29"');
  });
});

describe('ranking and caps', () => {
  it('drops events and webinars', () => {
    expect(
      isPromo({ title: 'Join us for OpenTelemetry Talks and Activities at KubeCon NA 2026' })
    ).toBe(true);
    expect(isPromo({ title: 'OTel Unplugged EU at FOSDEM 2027' })).toBe(true);
    expect(isPromo({ title: 'Webinar Recap: Agentic Debugging' })).toBe(true);
    expect(isPromo({ title: 'Friday Five — November 13, 2026 | Red Hat' })).toBe(true);
    expect(isPromo({ title: 'Jaeger Previews AI-Assisted Troubleshooting at KubeCon' })).toBe(
      false
    );
    expect(isPromo({ title: 'Live Streaming Sports to 32M Concurrent Viewers' })).toBe(false);
  });

  it('scores releases, security and deprecations up and marketing down', () => {
    const base = { excerpt: 'x' };
    expect(relevanceScore({ ...base, title: 'Gitea 28.4.0 is released' })).toBeGreaterThan(0);
    expect(
      relevanceScore({ ...base, title: 'Deprecating the Collector Batch Processor' })
    ).toBeGreaterThan(0);
    expect(relevanceScore({ ...base, title: 'Forrester Finds 155% ROI' })).toBeLessThan(0);
    // A spec or model version in the middle is not a release.
    expect(
      relevanceScore({ ...base, title: 'Amazon Cognito now supports OAuth 2.0 token exchange' })
    ).toBe(0);
  });

  it('caps the total, each category and each source by tier', () => {
    const items: NewsItem[] = [];
    for (let i = 0; i < 50; i++) {
      items.push(
        item({
          title: `Unique headline ${i} about topic ${i * 7} alpha${i} beta${i}`,
          category: ['Kubernetes', 'Security', 'IaC', 'Databases', 'Misc', 'Platforms', 'CI/CD'][
            i % 7
          ],
          source: i < 10 ? 'Busy Tier 1' : i < 20 ? 'Busy Tier 3' : `Feed ${i}`,
          tier: (i >= 10 && i < 20 ? 3 : 1) as Tier,
          excerpt: 'Text.',
        })
      );
    }
    const picked = selectItems(items, { end: END, minScore: 0 });
    expect(picked.length).toBe(25);
    const count = (key: (i: NewsItem) => string) =>
      picked.reduce<Record<string, number>>(
        (acc, i) => ({ ...acc, [key(i)]: (acc[key(i)] ?? 0) + 1 }),
        {}
      );
    expect(Math.max(...Object.values(count((i) => i.category!)))).toBeLessThanOrEqual(5);
    expect(count((i) => i.source)['Busy Tier 1']).toBe(3);
    expect(count((i) => i.source)['Busy Tier 3'] ?? 0).toBeLessThanOrEqual(1);
  });

  it('takes one item per tier 3 source and two per tier 2 source', () => {
    const vendor = [1, 2, 3].map((n) =>
      item({ title: `Vendor post ${n} on topic${n}`, source: 'Vendor', tier: 3 })
    );
    const news = [1, 2, 3].map((n) =>
      item({ title: `News story ${n} on subject${n}`, source: 'News', tier: 2 })
    );
    const picked = selectItems([...vendor, ...news], { end: END, minScore: 0 });
    expect(picked.filter((i) => i.source === 'Vendor')).toHaveLength(1);
    expect(picked.filter((i) => i.source === 'News')).toHaveLength(2);
  });

  it('ranks tier 1 above tier 3 and leaves weak items out', () => {
    const official = item({ title: 'Kubernetes v1.38.0 released', tier: 1 });
    const vendor = item({ title: 'Our platform story', tier: 3, excerpt: '' });
    const picked = selectItems([vendor, official], { end: END });
    expect(picked.map((i) => i.title)).toEqual(['Kubernetes v1.38.0 released']);
  });

  it('keeps one copy of a story, the better-ranked one', () => {
    const a = item({ title: 'From desktop to cloud to road', source: 'Ubuntu Blog', tier: 3 });
    const b = item({ title: 'From Desktop to Cloud, to Road!', source: 'Canonical Blog', tier: 2 });
    const picked = selectItems([a, b], { end: END, minScore: 0 });
    expect(picked).toHaveLength(1);
    expect(picked[0].source).toBe('Canonical Blog');
  });

  it('detects near-duplicate titles but not related stories', () => {
    expect(isNearDuplicate('Kubernetes v1.35 released', 'Kubernetes 1.35 released')).toBe(true);
    expect(
      isNearDuplicate(
        'Node management in Red Hat OpenShift 5: Server-level visibility for bare metal',
        'Node management in Red Hat OpenShift 5: server-level visibility'
      )
    ).toBe(true);
    expect(isNearDuplicate('Gitea 28.4.0 is released', 'Gitea Runner 6.0.0 is released')).toBe(
      false
    );
    expect(
      isNearDuplicate(
        'Claude Fable 5.2 vs. Opus 5.5: Same scores',
        'Claude Fable 5.2 vs. Fable 5.1: Fewer refusals'
      )
    ).toBe(false);
  });

  it('takes the top picks from different sources', () => {
    const ranked = [
      item({ source: 'A' }),
      item({ source: 'A' }),
      item({ source: 'B' }),
      item({ source: 'C' }),
    ];
    expect(pickTop(ranked).map((i) => i.source)).toEqual(['A', 'B', 'C']);
  });
});

describe('summary builder', () => {
  it('names the top headlines, the count and the week, within 155 characters', () => {
    const top = [
      item({ title: 'PostgreSQL 19 Released!' }),
      item({ title: 'Kubernetes v1.38.0-rc.0' }),
      item({ title: 'Terraform 1.17' }),
    ];
    expect(generateSummary(top, 23, 47)).toBe(
      'PostgreSQL 19 Released!, Kubernetes v1.38.0-rc.0 and Terraform 1.17, plus 20 more DevOps updates from week 47.'
    );
  });

  it('drops headlines until it fits and differs between weeks', () => {
    const long = (n: number) =>
      item({
        title: `A very long headline number ${n} about something that keeps going and going on`,
      });
    const top = [long(1), long(2), long(3)];
    const a = generateSummary(top, 25, 47);
    const b = generateSummary(top, 25, 48);
    expect(a.length).toBeLessThanOrEqual(155);
    expect(a).not.toBe(b);
    expect(a).toContain('week 47');
  });

  it('shortens a headline to its lead before a colon', () => {
    expect(
      shortHeadline('Introducing Spend Management: Spending limits and alerts for Cloudflare')
    ).toBe('Introducing Spend Management');
    expect(
      shortHeadline('Gang scheduling and topology-aware placement for AI training in Kubernetes')
    ).toBe('Gang scheduling and topology-aware placement for AI');
  });
});

describe('releases', () => {
  it('reads versions from GitHub release titles', () => {
    expect(parseGithubReleaseTitle('v1.17.2')).toBe('1.17.2');
    expect(parseGithubReleaseTitle('Helm v4.3.2')).toBe('4.3.2');
    expect(parseGithubReleaseTitle('Istio 1.32.0')).toBe('1.32.0');
    expect(parseGithubReleaseTitle('3.16.0 / 2026-11-04')).toBe('3.16.0');
    expect(parseGithubReleaseTitle('api/v1.57.0')).toBeNull();
    expect(parseGithubReleaseTitle('gitops-engine/v3.6.1: chore: bump')).toBeNull();
    expect(parseGithubReleaseTitle('stable')).toBeNull();
  });

  it('lists stable versions and only major RCs where allowed', () => {
    expect(isListedVersion('1.37.2')).toBe(true);
    expect(isListedVersion('1.38.0-beta.0', true)).toBe(false);
    expect(isListedVersion('1.38.0-alpha.3', true)).toBe(false);
    expect(isListedVersion('1.38.0-rc.0', true)).toBe(true);
    expect(isListedVersion('1.38.0-rc.0', false)).toBe(false);
    expect(isListedVersion('1.37.3-rc.0', true)).toBe(false);
  });

  it('reads PostgreSQL release posts and ignores other tools', () => {
    expect(
      parsePostgresReleaseTitle(
        'PostgreSQL 18.7, 17.12, 16.16, 15.20, 14.25, and 19 RC 2 Released!\n'
      )
    ).toBe('18.7, 17.12, 16.16, 15.20, 14.25 and 19 RC 2');
    expect(parsePostgresReleaseTitle('PostgreSQL 19 Released!')).toBe('19');
    expect(parsePostgresReleaseTitle('PostgreSQL 19 Beta 2 Released!')).toBeNull();
    expect(parsePostgresReleaseTitle('PostgreSQL JDBC 42.7.5 Released')).toBeNull();
    expect(parsePostgresReleaseTitle('pg_cve 1.1.1 released')).toBeNull();
  });

  it('keeps only project links and in-window releases, grouped and sorted', () => {
    const entries = releaseEntriesFromFeed({ name: 'Grafana', github: 'grafana/grafana' }, [
      {
        title: '13.2.6',
        link: 'https://github.com/grafana/grafana/releases/tag/v13.2.6',
        isoDate: '2026-11-10T21:31:52Z',
      },
      {
        title: '13.3.1',
        link: 'https://github.com/grafana/grafana/releases/tag/v13.3.1',
        isoDate: '2026-11-11T15:25:14Z',
      },
      {
        title: '13.3.1',
        link: 'https://github.com/grafana/grafana/releases/tag/v13.3.1',
        isoDate: '2026-11-11T15:30:00Z',
      },
      {
        title: '13.3.0',
        link: 'https://github.com/grafana/grafana/releases/tag/v13.3.0',
        isoDate: '2026-10-27T11:14:14Z',
      },
      { title: '13.3.2', link: 'https://evil.example/grafana', isoDate: '2026-11-12T00:00:00Z' },
      {
        title: 'pkg/storage/dbproxy/v0.1.0',
        link: 'https://github.com/grafana/grafana/releases/tag/x',
        isoDate: '2026-11-12T00:00:00Z',
      },
    ]);
    const grouped = selectReleases(
      entries,
      ['Kubernetes', 'Grafana'],
      START,
      END,
      new Date('2026-11-18T00:00:00Z')
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0].releases.map((r) => r.version)).toEqual(['13.3.1', '13.2.6']);
  });

  it('skips Prometheus module tags', () => {
    const entries = releaseEntriesFromFeed(
      { name: 'Prometheus', github: 'prometheus/prometheus', skip: '^0\\.' },
      [
        {
          title: 'v0.316.0',
          link: 'https://github.com/prometheus/prometheus/releases/tag/v0.316.0',
          isoDate: '2026-11-10T00:00:00Z',
        },
        {
          title: '3.16.0 / 2026-11-04',
          link: 'https://github.com/prometheus/prometheus/releases/tag/v3.16.0',
          isoDate: '2026-11-10T00:00:00Z',
        },
      ]
    );
    expect(entries.map((e) => e.version)).toEqual(['3.16.0']);
  });

  it('sorts versions numerically, stable before RC', () => {
    expect(['1.9.0', '1.10.0', '1.10.0-rc.1'].sort(compareVersionsDesc)).toEqual([
      '1.10.0',
      '1.10.0-rc.1',
      '1.9.0',
    ]);
  });
});

describe('DevOps Daily posts block', () => {
  const posts: OwnPost[] = [
    { slug: 'before', title: 'Before', publishedAt: '2026-11-08T23:00:00Z' },
    { slug: 'first-day', title: 'First day', publishedAt: '2026-11-09T07:00:00Z' },
    ...Array.from({ length: 6 }, (_, i) => ({
      slug: `mid-${i}`,
      title: `Mid ${i}`,
      publishedAt: `2026-11-1${i % 6}T15:00:00Z`,
    })),
    { slug: 'after', title: 'After', publishedAt: '2026-11-16T07:00:00Z' },
    { slug: 'Bad Slug', title: 'Bad', publishedAt: '2026-11-12T07:00:00Z' },
  ];

  it('takes at most 6 posts from the window, newest first', () => {
    const picked = selectOwnPosts(posts, START, END, new Date('2026-11-18T00:00:00Z'));
    expect(picked).toHaveLength(6);
    expect(picked.map((p) => p.slug)).not.toContain('before');
    expect(picked.map((p) => p.slug)).not.toContain('after');
    expect(picked.map((p) => p.slug)).not.toContain('Bad Slug');
    const times = picked.map((p) => new Date(p.publishedAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('leaves out posts that are not published yet', () => {
    const picked = selectOwnPosts(posts, START, END, new Date('2026-11-10T00:00:00Z'));
    expect(picked.map((p) => p.slug)).toEqual(['first-day']);
  });
});

describe('digest window', () => {
  it('rebuilds a past ISO week', () => {
    const w = resolveWindow(['--week', '2026-W47']);
    expect(w.start.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect([w.week, w.year, w.date]).toEqual([47, 2026, '2026-11-16']);
    expect(resolveWindow(['--until=2026-11-16']).end.toISOString()).toBe(
      '2026-11-16T00:00:00.000Z'
    );
  });

  it('covers the same days when the scheduled run starts late', () => {
    const early = resolveWindow([], new Date('2026-11-16T05:43:00Z'));
    const late = resolveWindow([], new Date('2026-11-16T15:56:00Z'));
    expect(late).toEqual(early);
    expect(early.week).toBe(47);
  });

  it('handles week 53 and rejects bad input', () => {
    expect(isoWeekUtc(isoWeekMondayUtc(2026, 53))).toEqual({ week: 53, year: 2026 });
    expect(() => resolveWindow(['--week', '2025-W53'])).toThrow();
    expect(() => resolveWindow(['--until', 'yesterday'])).toThrow();
  });
});

describe('rendered digest', () => {
  const picked = [
    item({
      title: 'Deprecating the Collector Batch Processor',
      source: 'OpenTelemetry Blog',
      category: 'Observability',
    }),
    item({
      title: 'Git "security" vulnerabilities announced',
      source: 'GitHub Blog',
      category: 'Security',
    }),
    item({ title: 'CloudNativePG becomes a CNCF Incubating Project', source: 'CNCF Blog' }),
    item({ title: 'Another item', source: 'CNCF Blog' }),
  ];
  const digest = assembleDigest({
    items: picked,
    releases: [
      {
        project: 'Istio',
        releases: [
          {
            project: 'Istio',
            version: '1.32.0',
            url: 'https://github.com/istio/istio/releases/tag/1.32.0',
            publishedAt: '2026-11-09T19:07:47Z',
          },
        ],
      },
    ],
    ownPosts: [
      {
        slug: 'disk-full',
        title: 'Disk Full but du Disagrees',
        publishedAt: '2026-11-12T07:00:00Z',
      },
    ],
    week: 47,
    year: 2026,
    date: '2026-11-16',
  });
  const markdown = generateMarkdown(digest);
  const { data, content } = matter(markdown);

  it('writes valid frontmatter with the old title and a new summary', () => {
    expect(data.title).toBe('DevOps Weekly Digest - Week 47, 2026');
    expect(data.date).toBe('2026-11-16');
    expect(data.summary).toContain('Git "security" vulnerabilities announced');
    expect(data.summary.length).toBeLessThanOrEqual(155);
  });

  it('puts the top 3 first and does not repeat them below', () => {
    expect(content.indexOf('This week in short')).toBeLessThan(content.indexOf('Releases'));
    expect(content.match(/Deprecating the Collector Batch Processor/g)).toHaveLength(1);
    expect(content).toContain('[1.32.0](https://github.com/istio/istio/releases/tag/1.32.0)');
    expect(content).toContain('[Disk Full but du Disagrees](/posts/disk-full)');
  });

  it('uses emojis only in section headers', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const line of content.split('\n')) {
      if (emoji.test(line)) expect(line.startsWith('## '), line).toBe(true);
    }
  });

  it('renders nothing for an empty editor intro and a paragraph for a filled one', () => {
    const empty = parseMarkdown(content);
    expect(empty).not.toContain('editor-intro');
    const filled = parseMarkdown(
      content.replace(
        `${EDITOR_INTRO_START}\n${EDITOR_INTRO_END}`,
        `${EDITOR_INTRO_START}\nA quiet week.\n${EDITOR_INTRO_END}`
      )
    );
    expect(filled).toContain('<p>A quiet week.</p>');
    expect(filled).not.toContain('editor-intro');
  });

  it('writes a PR body with counts, top 3 in code spans and the review line', () => {
    const body = buildPrBody({
      digest,
      window: resolveWindow(['--week', '2026-W47']),
      newsSources: 74,
      releaseSources: 13,
      failedSources: ['Terraform Blog'],
    });
    expect(body).toContain('news from Nov 9 to Nov 15');
    expect(body).toContain('74 news feeds and 13 release feeds');
    expect(body).toContain('4 news items, 1 projects with releases, 1 DevOps Daily posts');
    expect(body).toContain('1. `Deprecating the Collector Batch Processor` (OpenTelemetry Blog)');
    expect(body).toContain('Review: Claude adds the intro and merges on Monday.');
  });
});
