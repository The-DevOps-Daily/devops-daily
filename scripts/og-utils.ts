import fs from 'fs/promises';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { LOGO_MARK } from '../lib/logo-mark';

export function cleanOgText(text: unknown): string {
  return String(text ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeXml(text: unknown): string {
  return cleanOgText(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const CONTENT_COVER_TYPES = [
  'post',
  'guide',
  'exercise',
  'news',
  'advent',
  'quiz',
  'game',
  'checklist',
  'interview',
  'comparison',
  'flashcard',
  'tool',
] as const;

export type ContentCoverType = (typeof CONTENT_COVER_TYPES)[number];

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;

// Illustrated backgrounds live outside public/ so they are not deployed as
// separate files; only the composed cover is.
export const COVER_BACKGROUND_DIR = path.join(process.cwd(), 'scripts', 'assets', 'og-backgrounds');

export const COVER_BACKGROUNDS = [
  'ai',
  'automation',
  'ci-cd',
  'cloud',
  'cloud-finops',
  'comparison',
  'containers',
  'databases',
  'general',
  'git',
  'infrastructure-as-code',
  'kubernetes',
  'kubernetes-alt',
  'linux-networking',
  'news',
  'postgres',
  'quiz',
  'security',
  'simulator',
] as const;

export type CoverBackground = (typeof COVER_BACKGROUNDS)[number];

const COVER_FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
export const COVER_FONT_FILES = [
  path.join(COVER_FONT_DIR, 'Inter-Bold.ttf'),
  path.join(COVER_FONT_DIR, 'Inter-Regular.ttf'),
];
// Only the bundled Inter files: system fallbacks differ between machines and
// would change line widths between local runs and CI.
const COVER_FONT_OPTIONS = {
  fontFiles: COVER_FONT_FILES,
  loadSystemFonts: false,
  defaultFontFamily: 'Inter',
};

/**
 * Background selection, in order:
 *
 * 1. Type: quiz -> quiz, game/simulator -> simulator, comparison -> comparison,
 *    news -> news.
 * 2. Postgres: a category or any tag that names Postgres, PostgreSQL, Neon,
 *    Lakebase or pgvector -> postgres.
 * 3. Category: the first TOPIC_RULES entry that matches the category.
 * 4. Tags: when the category matched nothing (DevOps, Linux, Bash, Python,
 *    SRE, unknown...), the first tag in frontmatter order that matches a rule.
 * 5. Otherwise general.
 *
 * Kubernetes covers alternate between two illustrations by a hash of the slug,
 * so the same item always gets the same one.
 */
const TYPE_BACKGROUNDS: Partial<Record<ContentCoverType, CoverBackground>> = {
  quiz: 'quiz',
  game: 'simulator',
  comparison: 'comparison',
  news: 'news',
};

const POSTGRES_PATTERN = /\b(postgres|postgresql|neon|lakebase|pgvector)\b/;

// Matched against lowercase text with punctuation turned into spaces, so
// "CI/CD", "ci-cd" and "Infrastructure as Code" all normalise predictably.
const TOPIC_RULES: ReadonlyArray<readonly [CoverBackground, RegExp]> = [
  ['ai', /\b(ai|ml|llms?|mlops|genai|machine learning|ai agents?|ai gateway|rag|mcp)\b/],
  [
    'kubernetes',
    /\b(kubernetes|k8s|helm|kubectl|service mesh|istio|linkerd|container orchestration|openshift)\b/,
  ],
  ['containers', /\b(docker|containers?|podman|docker compose|container registr(y|ies))\b/],
  [
    'infrastructure-as-code',
    /\b(terraform|opentofu|pulumi|iac|infrastructure as code|cloudformation|infrastructure)\b/,
  ],
  [
    'ci-cd',
    /\b(ci cd|cicd|github actions|gitlab ci|jenkins|gitops|argo ?cd|continuous (integration|delivery|deployment)|deployment strateg(y|ies)|artifact management)\b/,
  ],
  ['git', /\b(git|github|gitlab|version control|source control)\b/],
  ['cloud-finops', /\b(finops|costs?|cost optimization|cost management)\b/],
  [
    'security',
    /\b(security|devsecops|secrets?|vulnerabilit(y|ies)|cve|identity|iam|tls|ssl|supply chain)\b/,
  ],
  ['databases', /\b(databases?|sql|mysql|mariadb|redis|mongodb|sqlite|nosql|caching)\b/],
  ['cloud', /\b(cloud|aws|azure|gcp|google cloud|serverless|digitalocean|lambda)\b/],
  [
    'linux-networking',
    /\b(networking|network|dns|tcp|udp|http|ssh|openssh|load balanc(ing|er)|reverse proxy|cdn|nginx)\b/,
  ],
  ['automation', /\b(automation|ansible|configuration management|puppet|chef|cron)\b/],
];

function normalizeTopic(value: unknown): string {
  return cleanOgText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchTopic(value: string): CoverBackground | null {
  if (!value) return null;
  for (const [background, pattern] of TOPIC_RULES) {
    if (pattern.test(value)) return background;
  }
  return null;
}

function stableHash(value: string): number {
  // FNV-1a: stable across Node versions and machines.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export interface CoverTopic {
  type: ContentCoverType;
  slug: string;
  category?: string;
  tags?: readonly unknown[];
}

export function selectCoverBackground(topic: CoverTopic): CoverBackground {
  const byType = TYPE_BACKGROUNDS[topic.type];
  if (byType) return byType;

  const category = normalizeTopic(topic.category);
  const tags = (topic.tags ?? []).map(normalizeTopic).filter(Boolean);
  let background: CoverBackground;
  if ([category, ...tags].some((value) => POSTGRES_PATTERN.test(value))) {
    background = 'postgres';
  } else {
    background = matchTopic(category) ?? tags.map(matchTopic).find(Boolean) ?? 'general';
  }
  if (background === 'kubernetes' && stableHash(topic.slug) % 2 === 1) return 'kubernetes-alt';
  return background;
}

export function coverBackgroundPath(background: CoverBackground): string {
  return path.join(COVER_BACKGROUND_DIR, `${background}.jpg`);
}

const COVER_TYPE_LABELS: Record<ContentCoverType, string | null> = {
  post: null,
  guide: 'Guide',
  exercise: 'Exercise',
  news: 'News',
  advent: 'Advent',
  quiz: 'Quiz',
  game: 'Simulator',
  checklist: 'Checklist',
  interview: 'Interview',
  comparison: 'Comparison',
  flashcard: 'Flashcards',
  tool: 'Tool',
};

export interface ContentCoverOptions {
  type: ContentCoverType;
  title: string;
  category: string;
  /** Overrides the default type pill (e.g. "Game" or "Advent · Day 5"). */
  typeLabel?: string;
}

export interface CoverPill {
  label: string;
  x: number;
  width: number;
  textWidth: number;
}

export interface ContentCoverLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  titleX: number;
  titleY: number;
  maxWidth: number;
  pillY: number;
  pillFontSize: number;
  pills: CoverPill[];
}

// Text stays left of x=560; the illustrations start around x=580.
export const COVER_TEXT_X = 72;
export const COVER_TEXT_MAX_WIDTH = 480;
const TITLE_LETTER_SPACING = -1;
const PILL_LETTER_SPACING = 1.2;
const PILL_HEIGHT = 34;
const PILL_GAP = 10;
const TITLE_TIERS = [
  { sizes: [56, 50, 44], maxLines: 3 },
  { sizes: [40, 36], maxLines: 4 },
  { sizes: [32, 30, 28], maxLines: 5 },
];

const measureCache = new Map<string, number>();

/** Ink width of a single line of Inter, measured by resvg itself. */
export function measureCoverText(
  text: string,
  fontSize: number,
  { weight = 700, letterSpacing = 0 }: { weight?: number; letterSpacing?: number } = {}
): number {
  const key = `${weight}|${fontSize}|${letterSpacing}|${text}`;
  const cached = measureCache.get(key);
  if (cached !== undefined) return cached;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${fontSize * 3}"><text x="10" y="${fontSize * 2}" font-family="Inter" font-weight="${weight}" font-size="${fontSize}" letter-spacing="${letterSpacing}">${escapeXml(text)}</text></svg>`;
  const box = new Resvg(svg, { font: COVER_FONT_OPTIONS }).getBBox();
  const width = box ? box.width : 0;
  measureCache.set(key, width);
  return width;
}

function cleanCoverTitle(title: unknown): string {
  // Inter has no emoji; drop them rather than render empty boxes.
  return cleanOgText(String(title ?? '').replace(/[\p{Extended_Pictographic}️‍]/gu, ''));
}

// Fast width estimate used while searching for line breaks: words are
// measured once at 100px and scaled. The chosen lines are measured exactly.
function estimateLineWidth(words: string[], fontSize: number): number {
  const scale = fontSize / 100;
  const space = measureCoverText('x x', 100) - measureCoverText('xx', 100);
  let width = 0;
  let characters = 0;
  for (const word of words) {
    width += measureCoverText(word, 100) * scale;
    characters += [...word].length;
  }
  width += (words.length - 1) * space * scale;
  characters += words.length - 1;
  return width + TITLE_LETTER_SPACING * Math.max(0, characters - 1);
}

function splitLongWord(word: string, fontSize: number, maxWidth: number): string[] {
  // Sum per-character widths (few distinct glyphs, so cached) instead of
  // measuring every prefix of the token.
  const scale = fontSize / 100;
  const chunks: string[] = [];
  let current = '';
  let width = 0;
  for (const character of [...word]) {
    const characterWidth =
      (measureCoverText(`x${character}x`, 100) - measureCoverText('xx', 100)) * scale +
      TITLE_LETTER_SPACING;
    if (current && width + characterWidth > maxWidth) {
      chunks.push(current);
      current = character;
      width = characterWidth;
    } else {
      current += character;
      width += characterWidth;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapByWidth(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[][] = [];
  let current: string[] = [];
  for (const rawWord of text.split(' ').filter(Boolean)) {
    const pieces =
      estimateLineWidth([rawWord], fontSize) > maxWidth
        ? splitLongWord(rawWord, fontSize, maxWidth)
        : [rawWord];
    for (const word of pieces) {
      if (current.length && estimateLineWidth([...current, word], fontSize) > maxWidth) {
        lines.push(current);
        current = [word];
      } else {
        current.push(word);
      }
    }
  }
  if (current.length) lines.push(current);
  return lines.map((line) => line.join(' '));
}

// Narrowest wrap that keeps the same line count, so lines come out balanced
// instead of leaving one word alone on the last line.
function balanceLines(text: string, fontSize: number, maxWidth: number, lineCount: number) {
  // Never narrower than the widest word, or balancing would split words.
  const widestWord = Math.max(
    ...text.split(' ').map((word) => Math.ceil(estimateLineWidth([word], fontSize)))
  );
  let low = Math.min(maxWidth, widestWord);
  let high = maxWidth;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (wrapByWidth(text, fontSize, middle).length <= lineCount) high = middle;
    else low = middle + 1;
  }
  return wrapByWidth(text, fontSize, high);
}

function fitTitleLines(text: string, fontSize: number, maxLines: number): string[] | null {
  let limit = COVER_TEXT_MAX_WIDTH;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const greedy = wrapByWidth(text, fontSize, limit);
    if (greedy.length > maxLines) return null;
    const lines = balanceLines(text, fontSize, limit, greedy.length);
    const widest = Math.max(
      ...lines.map((line) =>
        measureCoverText(line, fontSize, { letterSpacing: TITLE_LETTER_SPACING })
      )
    );
    if (widest <= COVER_TEXT_MAX_WIDTH) return lines;
    limit -= Math.ceil(widest - COVER_TEXT_MAX_WIDTH) + 2;
  }
  return null;
}

function layoutPills(labels: string[]): Pick<ContentCoverLayout, 'pillFontSize' | 'pills'> {
  const upper = labels.map((label) => cleanOgText(label).toUpperCase()).filter(Boolean);
  const build = (texts: string[], fontSize: number, padding: number) => {
    let x = COVER_TEXT_X;
    return texts.map((label) => {
      const textWidth = measureCoverText(label, fontSize, { letterSpacing: PILL_LETTER_SPACING });
      const pill = { label, x, width: Math.ceil(textWidth + padding * 2), textWidth };
      x += pill.width + PILL_GAP;
      return pill;
    });
  };
  const totalWidth = (pills: CoverPill[]) =>
    pills.length ? pills[pills.length - 1].x + pills[pills.length - 1].width - COVER_TEXT_X : 0;

  for (const fontSize of [16, 15, 14]) {
    const pills = build(upper, fontSize, fontSize >= 15 ? 22 : 18);
    if (totalWidth(pills) <= COVER_TEXT_MAX_WIDTH) return { pillFontSize: fontSize, pills };
  }
  // Still too wide: drop whole words from the category (first pill), never
  // from the type label.
  const [category, ...rest] = upper;
  const words = category.split(' ');
  let pills = build(upper, 14, 18);
  while (words.length > 1) {
    words.pop();
    const shortened = words.join(' ').replace(/[\s&·,/-]+$/, '');
    pills = build([`${shortened}…`, ...rest], 14, 18);
    if (totalWidth(pills) <= COVER_TEXT_MAX_WIDTH) break;
  }
  return { pillFontSize: 14, pills };
}

export function layoutContentCoverTitle(
  title: string,
  category = 'DevOps',
  typeLabel?: string | null
): ContentCoverLayout {
  const clean = cleanCoverTitle(title);
  if (!clean) throw new Error('Cover title cannot be empty');

  for (const tier of TITLE_TIERS) {
    for (const fontSize of tier.sizes) {
      const lines = fitTitleLines(clean, fontSize, tier.maxLines);
      if (!lines) continue;
      const lineHeight = Math.round(fontSize * 1.16);
      const titleY = Math.round(330 - (lines.length * lineHeight) / 2 + fontSize * 0.8);
      return {
        lines,
        fontSize,
        lineHeight,
        titleX: COVER_TEXT_X,
        titleY,
        maxWidth: COVER_TEXT_MAX_WIDTH,
        pillY: titleY - fontSize - 48,
        ...layoutPills([cleanOgText(category) || 'DevOps', ...(typeLabel ? [typeLabel] : [])]),
      };
    }
  }

  throw new Error(`Cover title cannot fit without truncation (${clean.length} characters)`);
}

export function coverTypeLabel(type: ContentCoverType, override?: string): string | null {
  return cleanOgText(override) || COVER_TYPE_LABELS[type];
}

// The site's terminal mark (same geometry as the header logo and favicons),
// in the green of the default OG image, scaled from its 32-unit grid to 40px.
const BRAND_MARK = `<g data-cover-brand="true">
  <g transform="translate(72 56) scale(1.25)">
    <rect x="${LOGO_MARK.square.x}" y="${LOGO_MARK.square.y}" width="${LOGO_MARK.square.size}" height="${LOGO_MARK.square.size}" rx="${LOGO_MARK.square.radius}" fill="#0F1A14"/>
    <g fill="none" stroke="#22C55E" stroke-width="${LOGO_MARK.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
      <path d="${LOGO_MARK.chevron}"/>
      <path d="${LOGO_MARK.cursor}"/>
    </g>
  </g>
  <text x="126" y="85" font-family="Inter" font-weight="700" font-size="26" letter-spacing="-0.4" fill="#0F1A14">DevOps <tspan fill="#16A34A">Daily</tspan></text>
</g>`;

/** Transparent 1200x630 overlay drawn on top of the illustrated background. */
export function buildContentCoverSvg(options: ContentCoverOptions): string {
  const title = cleanCoverTitle(options.title);
  const typeLabel = coverTypeLabel(options.type, options.typeLabel);
  const layout = layoutContentCoverTitle(title, options.category, typeLabel);
  const pillTextY = layout.pillY + Math.round(PILL_HEIGHT / 2 + layout.pillFontSize * 0.36);

  const pills = layout.pills
    .map((pill, index) => {
      const isCategory = index === 0;
      const rect = isCategory
        ? `fill="#22C55E" fill-opacity="0.14" stroke="#16A34A" stroke-opacity="0.55"`
        : `fill="#0F1A14" fill-opacity="0.04" stroke="#0F1A14" stroke-opacity="0.24"`;
      const textFill = isCategory ? '#15803D' : '#33413A';
      return `<g data-cover-pill="${isCategory ? 'category' : 'type'}">
    <rect x="${pill.x + 0.5}" y="${layout.pillY + 0.5}" width="${pill.width - 1}" height="${PILL_HEIGHT - 1}" rx="${(PILL_HEIGHT - 1) / 2}" ${rect}/>
    <text x="${(pill.x + pill.width / 2).toFixed(1)}" y="${pillTextY}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${layout.pillFontSize}" letter-spacing="${PILL_LETTER_SPACING}" fill="${textFill}">${escapeXml(pill.label)}</text>
  </g>`;
    })
    .join('\n  ');

  const titleSvg = layout.lines
    .map(
      (line, index) =>
        `<text data-cover-title-line="true" x="${layout.titleX}" y="${layout.titleY + index * layout.lineHeight}" font-family="Inter" font-weight="700" font-size="${layout.fontSize}" letter-spacing="${TITLE_LETTER_SPACING}" fill="#0F1A14">${escapeXml(line)}</text>`
    )
    .join('\n  ');

  return `<svg width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}" role="img" aria-label="${escapeXml(title)}" xmlns="http://www.w3.org/2000/svg">
  ${BRAND_MARK}
  ${pills}
  ${titleSvg}
  <text x="${COVER_TEXT_X}" y="580" font-family="Inter" font-weight="400" font-size="18" fill="#5B6B62">devops-daily.com</text>
</svg>`;
}

/** Renders an overlay SVG with the bundled fonts (transparent background). */
export function renderCoverOverlay(svg: string) {
  return new Resvg(svg, { font: COVER_FONT_OPTIONS, background: 'rgba(0,0,0,0)' }).render();
}

const backgroundCache = new Map<CoverBackground, Promise<Buffer>>();

function loadBackground(background: CoverBackground): Promise<Buffer> {
  let cached = backgroundCache.get(background);
  if (!cached) {
    cached = sharp(coverBackgroundPath(background))
      .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'cover', position: 'right' })
      .png()
      .toBuffer();
    backgroundCache.set(background, cached);
  }
  return cached;
}

export async function renderContentCoverJpeg(
  options: ContentCoverOptions & { background: CoverBackground }
): Promise<Buffer> {
  const overlay = renderCoverOverlay(buildContentCoverSvg(options));
  if (overlay.width !== COVER_WIDTH || overlay.height !== COVER_HEIGHT) {
    throw new Error(`Invalid cover overlay size ${overlay.width}x${overlay.height}`);
  }
  return sharp(await loadBackground(options.background))
    .composite([{ input: overlay.asPng() }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export function splitTitle(title: string, maxCharsPerLine = 30, maxLines = 3): string[] {
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

export function titleFontSize(lineCount: number): number {
  return lineCount === 1 ? 56 : lineCount === 2 ? 52 : 48;
}

export const SITE_OG_THEME = {
  background: '#09090b',
  panel: '#18181b',
  panelMuted: '#111113',
  border: '#3f3f46',
  borderMuted: '#27272a',
  text: '#fafafa',
  mutedText: '#a1a1aa',
  primary: '#f5a524',
  primaryMuted: '#2b2114',
  primaryBorder: '#5f4314',
} as const;

interface SiteOgFeature {
  title: string;
  description?: string;
}

interface SiteOgOptions {
  eyebrow: string;
  title: string;
  description: string;
  footer?: string;
  sectionLabel?: string;
  features?: SiteOgFeature[];
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  return splitTitle(text, maxChars, maxLines);
}

function featureCards(features: SiteOgFeature[]): string {
  return features
    .slice(0, 3)
    .map((feature, index) => {
      const x = 70 + index * 190;
      const titleLines = wrapText(feature.title, 15, 2);
      const descriptionY = titleLines.length > 1 ? 562 : 556;
      const titleSvg = titleLines
        .map(
          (line, lineIndex) =>
            `<text x="${x + 18}" y="${526 + lineIndex * 20}" font-family="Inter, Arial, sans-serif" font-size="16" fill="${SITE_OG_THEME.primary}">${escapeXml(line)}</text>`
        )
        .join('\n');
      return `<g>
  <rect x="${x}" y="496" width="176" height="78" rx="18" fill="${SITE_OG_THEME.panelMuted}" stroke="${SITE_OG_THEME.primaryBorder}" stroke-width="1"/>
  ${titleSvg}
  ${
    feature.description
      ? `<text x="${x + 18}" y="${descriptionY}" font-family="Menlo, Monaco, monospace" font-size="13" fill="${SITE_OG_THEME.mutedText}">${escapeXml(feature.description)}</text>`
      : ''
  }
</g>`;
    })
    .join('\n');
}

/**
 * Shared clean OG template for generated social images.
 *
 * Keep this intentionally restrained: dark neutral surface, site primary
 * amber, subtle grid, and structured text. Content generators can add
 * domain-specific labels through feature cards without introducing random
 * decorative elements or off-brand color palettes.
 */
export function buildSiteOgSvg({
  eyebrow,
  title,
  description,
  footer = 'DevOps Daily',
  sectionLabel,
  features = [],
}: SiteOgOptions): string {
  const titleLines = wrapText(title, 18, 4);
  const descriptionLines = wrapText(description, 58, 3);
  const titleSize = titleLines.length > 3 ? 54 : 58;
  const titleSvg = titleLines
    .map(
      (line, index) =>
        `<text x="70" y="${178 + index * 62}" font-family="Inter, Arial, sans-serif" font-size="${titleSize}" font-weight="800" fill="${SITE_OG_THEME.text}">${escapeXml(line)}</text>`
    )
    .join('\n');
  const descriptionY = 202 + titleLines.length * 62;
  const descriptionSvg = descriptionLines
    .map(
      (line, index) =>
        `<text x="72" y="${descriptionY + index * 32}" font-family="Inter, Arial, sans-serif" font-size="24" fill="#d4d4d8">${escapeXml(line)}</text>`
    )
    .join('\n');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="primaryGlow" cx="62%" cy="4%" r="58%">
      <stop offset="0%" stop-color="${SITE_OG_THEME.primary}" stop-opacity="0.42"/>
      <stop offset="48%" stop-color="${SITE_OG_THEME.primary}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${SITE_OG_THEME.background}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#121216" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="${SITE_OG_THEME.background}"/>
  <rect width="1200" height="630" fill="url(#primaryGlow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>

  <rect x="70" y="70" width="${Math.max(260, eyebrow.length * 15 + 34)}" height="36" rx="18" fill="${SITE_OG_THEME.primaryMuted}" stroke="${SITE_OG_THEME.primaryBorder}" stroke-width="1"/>
  <text x="88" y="97" font-family="Menlo, Monaco, monospace" font-size="22" font-weight="700" fill="${SITE_OG_THEME.primary}">${escapeXml(eyebrow)}</text>

  ${sectionLabel ? `<text x="1130" y="100" font-family="Menlo, Monaco, monospace" font-size="18" fill="${SITE_OG_THEME.mutedText}" text-anchor="end">${escapeXml(sectionLabel)}</text>` : ''}

  ${titleSvg}
  ${descriptionSvg}

  ${featureCards(features)}

  <text x="70" y="610" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="${SITE_OG_THEME.primary}">${escapeXml(footer)}</text>
</svg>`;
}

export async function convertSvgToPng(
  svgPath: string,
  pngPath: string,
  width = 1200
): Promise<void> {
  const svgBuffer = await fs.readFile(svgPath);
  const pngBuffer = new Resvg(svgBuffer, {
    background: 'rgba(255, 255, 255, 1)',
    fitTo: { mode: 'width', value: width },
  })
    .render()
    .asPng();

  const optimizedBuffer = await sharp(pngBuffer)
    .resize(1200, 630, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  await fs.writeFile(pngPath, optimizedBuffer);
}
