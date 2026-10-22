import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  buildContentCoverSvg,
  CONTENT_COVER_TYPES,
  COVER_BACKGROUNDS,
  COVER_TEXT_MAX_WIDTH,
  COVER_TEXT_X,
  coverBackgroundPath,
  coverTypeLabel,
  layoutContentCoverTitle,
  renderContentCoverJpeg,
  renderCoverOverlay,
  selectCoverBackground,
  type ContentCoverType,
} from '../og-utils';

// Text must stay clear of the illustration, which starts around x=580.
const TEXT_RIGHT_EDGE = 560;

function renderedTitleRightEdge(
  type: ContentCoverType,
  title: string,
  category = 'DevOps',
  typeLabel?: string
): number {
  const layout = layoutContentCoverTitle(title, category, coverTypeLabel(type, typeLabel));
  const svg = buildContentCoverSvg({ type, title, category, typeLabel }).replace(
    /(<text data-cover-title-line="true"[^>]*fill=")#[^"]+("[^>]*>)/g,
    '$1#ff00ff$2'
  );
  const image = renderCoverOverlay(svg);
  const pixels = image.pixels;
  let rightEdge = -1;

  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
    const baseline = layout.titleY + lineIndex * layout.lineHeight;
    const top = Math.max(0, Math.floor(baseline - layout.fontSize * 1.15));
    const bottom = Math.min(image.height - 1, Math.ceil(baseline + layout.fontSize * 0.3));
    let lineRight = -1;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const index = (y * image.width + x) * 4;
        if (
          pixels[index + 3] > 0 &&
          pixels[index] > 140 &&
          pixels[index + 2] > 140 &&
          pixels[index + 1] < 110
        ) {
          lineRight = Math.max(lineRight, x);
        }
      }
    }
    expect(lineRight).toBeGreaterThan(COVER_TEXT_X);
    rightEdge = Math.max(rightEdge, lineRight);
  }
  return rightEdge;
}

describe('content cover renderer', () => {
  it.each(CONTENT_COVER_TYPES)('renders a 1200x630 %s overlay', (type) => {
    const svg = buildContentCoverSvg({
      type,
      title: 'A Practical Guide to Safe Production Deployments',
      category: 'Infrastructure & Delivery',
    });
    const image = renderCoverOverlay(svg);

    expect(image.width).toBe(1200);
    expect(image.height).toBe(630);
    expect(svg).toContain('data-cover-brand="true"');
    expect(svg).toContain('devops-daily.com');
  });

  it('adds a type pill for every type except posts', () => {
    for (const type of CONTENT_COVER_TYPES) {
      const svg = buildContentCoverSvg({ type, title: 'Safe Deployments', category: 'DevOps' });
      const hasTypePill = svg.includes('data-cover-pill="type"');
      expect(hasTypePill).toBe(type !== 'post');
    }
    expect(buildContentCoverSvg({ type: 'quiz', title: 'Docker', category: 'Docker' })).toContain(
      '>QUIZ<'
    );
    expect(
      buildContentCoverSvg({
        type: 'game',
        title: 'Infra Tarot',
        category: 'Fun',
        typeLabel: 'Game',
      })
    ).toContain('>GAME<');
  });

  it('escapes XML-sensitive content and keeps the full title', () => {
    const svg = buildContentCoverSvg({
      type: 'quiz',
      title: 'TLS & Zero-Downtime: “Blue < Green” Deployments',
      category: 'Security & Networking',
    });

    expect(() => renderCoverOverlay(svg)).not.toThrow();
    expect(svg).toContain('TLS &amp; Zero-Downtime');
    expect(svg).toContain('Blue &lt; Green');
    expect(svg).not.toContain('...');
  });

  it.each([
    ['post', 'Git'],
    ['post', 'Right-Sizing Kubernetes Resources with VPA and Karpenter'],
    ['post', 'Why `kubectl rollout restart` Does Not Pick Up a New ConfigMap Value'],
    ['post', 'What’s the Difference Between Docker Compose vs. Dockerfile? Größe, naïve café'],
    [
      'post',
      'When the Malicious Hook Is in the Other Manifest: 700+ Repos, 8 Packagist Packages, One package.json Trick',
    ],
    ['comparison', 'GitHub Actions vs GitLab CI vs Jenkins vs CircleCI vs Buildkite vs Bitrise'],
  ] as const)('keeps the %s title "%s" left of the illustration', (type, title) => {
    expect(renderedTitleRightEdge(type, title)).toBeLessThanOrEqual(TEXT_RIGHT_EDGE);
  });

  it('balances lines without splitting words', () => {
    for (const title of [
      'Preview Environment Simulator',
      'Infrastructure Observability Fundamentals',
      'Kubernetes Configuration Management',
    ]) {
      const layout = layoutContentCoverTitle(title, 'DevOps', 'Simulator');
      expect(layout.lines.join(' ')).toBe(title);
    }
  });

  it('splits a pathological unbroken token without truncating it', () => {
    const title = `Decode ${'VeryLongUnbrokenIdentifier'.repeat(5)}`;
    const layout = layoutContentCoverTitle(title, 'Developer Utilities');

    expect(layout.lines.join('').replace(/\s/g, '')).toBe(title.replace(/\s/g, ''));
    expect(renderedTitleRightEdge('tool', title, 'Developer Utilities')).toBeLessThanOrEqual(
      TEXT_RIGHT_EDGE
    );
  });

  it('keeps both pills inside the text column', () => {
    const layout = layoutContentCoverTitle(
      'Some Comparison',
      'Source Control & DevOps Platforms and Much More Besides',
      'Comparison'
    );
    const last = layout.pills[layout.pills.length - 1];

    expect(layout.pills.map((pill) => pill.label)).toContain('COMPARISON');
    expect(last.x + last.width).toBeLessThanOrEqual(COVER_TEXT_X + COVER_TEXT_MAX_WIDTH);
    expect(layout.pills[0].label.endsWith('…')).toBe(true);
  });

  it('rejects empty and implausibly long titles before writing a cover', () => {
    expect(() => buildContentCoverSvg({ type: 'post', title: '', category: 'DevOps' })).toThrow(
      'cannot be empty'
    );
    expect(() =>
      buildContentCoverSvg({ type: 'guide', title: 'A '.repeat(180), category: 'Guide' })
    ).toThrow('cannot fit without truncation');
  });

  it('writes a 1200x630 JPEG over the background', async () => {
    const jpg = await renderContentCoverJpeg({
      type: 'post',
      title: 'Right-Sizing Kubernetes Resources',
      category: 'Kubernetes',
      background: 'kubernetes',
    });
    const metadata = await sharp(jpg).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
  });
});

describe('cover background selection', () => {
  it('has a file for every background', () => {
    for (const background of COVER_BACKGROUNDS) {
      expect(fs.existsSync(coverBackgroundPath(background))).toBe(true);
    }
  });

  it('picks by content type first', () => {
    expect(selectCoverBackground({ type: 'quiz', slug: 'k8s', category: 'Kubernetes' })).toBe(
      'quiz'
    );
    expect(selectCoverBackground({ type: 'game', slug: 'dns', category: 'Networking' })).toBe(
      'simulator'
    );
    expect(
      selectCoverBackground({ type: 'comparison', slug: 'a-vs-b', category: 'Databases' })
    ).toBe('comparison');
    expect(selectCoverBackground({ type: 'news', slug: 'week-1', category: 'Week 1' })).toBe(
      'news'
    );
  });

  it.each([
    ['devops', 'general'],
    ['docker', 'containers'],
    ['git', 'git'],
    ['terraform', 'infrastructure-as-code'],
    ['linux', 'general'],
    ['bash', 'general'],
    ['python', 'general'],
    ['networking', 'linux-networking'],
    ['security', 'security'],
    ['cloud', 'cloud'],
    ['aws', 'cloud'],
    ['ci-cd', 'ci-cd'],
    ['CI/CD', 'ci-cd'],
    ['finops', 'cloud-finops'],
    ['databases', 'databases'],
    ['sql', 'databases'],
    ['postgres', 'postgres'],
    ['AI & Automation', 'ai'],
    ['Configuration Management', 'automation'],
    ['Something New', 'general'],
  ])('maps category %s to %s', (category, background) => {
    expect(selectCoverBackground({ type: 'post', slug: 'example', category })).toBe(background);
  });

  it('alternates Kubernetes illustrations by slug, deterministically', () => {
    const picks = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) =>
      selectCoverBackground({ type: 'post', slug, category: 'kubernetes' })
    );
    expect(new Set(picks)).toEqual(new Set(['kubernetes', 'kubernetes-alt']));
    expect(selectCoverBackground({ type: 'post', slug: 'a', category: 'kubernetes' })).toBe(
      picks[0]
    );
  });

  it('uses tags only when the category is generic', () => {
    expect(
      selectCoverBackground({
        type: 'post',
        slug: 'x',
        category: 'devops',
        tags: ['DevOps', 'Helm'],
      })
    ).toMatch(/^kubernetes/);
    expect(
      selectCoverBackground({ type: 'post', slug: 'x', category: 'linux', tags: ['Linux', 'DNS'] })
    ).toBe('linux-networking');
    expect(
      selectCoverBackground({
        type: 'post',
        slug: 'x',
        category: 'linux',
        tags: ['Linux', 'OpenSSH', 'Ansible'],
      })
    ).toBe('linux-networking');
    expect(
      selectCoverBackground({
        type: 'post',
        slug: 'x',
        category: 'devops',
        tags: ['LLM', 'Docker'],
      })
    ).toBe('ai');
    expect(
      selectCoverBackground({ type: 'post', slug: 'x', category: 'docker', tags: ['AWS'] })
    ).toBe('containers');
    expect(
      selectCoverBackground({ type: 'interview', slug: 'x', category: 'SRE', tags: ['scheduling'] })
    ).toBe('general');
  });

  it('sends Postgres, Neon, Lakebase and pgvector content to postgres', () => {
    for (const tag of ['PostgreSQL', 'neon', 'Lakebase', 'pgvector', 'postgres-18']) {
      expect(
        selectCoverBackground({ type: 'post', slug: 'x', category: 'devops', tags: [tag] })
      ).toBe('postgres');
    }
    expect(
      selectCoverBackground({ type: 'post', slug: 'x', category: 'docker', tags: ['PostgreSQL'] })
    ).toBe('postgres');
    expect(
      selectCoverBackground({
        type: 'post',
        slug: 'x',
        category: 'devops',
        tags: ['MySQL', 'Redis'],
      })
    ).toBe('databases');
    expect(
      selectCoverBackground({ type: 'checklist', slug: 'x', category: 'Database Operations' })
    ).toBe('databases');
  });
});
