import fs from 'fs/promises';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

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

export type ContentCoverType =
  | 'post'
  | 'guide'
  | 'exercise'
  | 'news'
  | 'advent'
  | 'quiz'
  | 'game'
  | 'checklist'
  | 'interview'
  | 'comparison'
  | 'flashcard'
  | 'tool';

export interface ContentCoverOptions {
  type: ContentCoverType;
  title: string;
  category: string;
  eyebrow?: string;
  sectionLabel?: string;
}

export interface ContentCoverLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  titleY: number;
  maxWidth: number;
  wide: boolean;
  categoryFontSize: number;
  categoryBadgeWidth: number;
  categoryDisplay: string;
}

const CONTENT_COVER_STYLES: Record<
  ContentCoverType,
  { accent: string; pale: string; dark: string; label: string }
> = {
  post: { accent: '#3b82f6', pale: '#93c5fd', dark: '#0d1b31', label: 'DEVOPS ARTICLE' },
  guide: { accent: '#8b5cf6', pale: '#c4b5fd', dark: '#1b1431', label: 'PRACTICAL GUIDE' },
  exercise: { accent: '#3b82f6', pale: '#93c5fd', dark: '#10182b', label: 'HANDS-ON EXERCISE' },
  news: { accent: '#06b6d4', pale: '#67e8f9', dark: '#09232c', label: 'DEVOPS NEWS' },
  advent: { accent: '#10b981', pale: '#6ee7b7', dark: '#0b1715', label: 'ADVENT OF DEVOPS' },
  quiz: { accent: '#f59e0b', pale: '#fbbf24', dark: '#211508', label: 'INTERACTIVE QUIZ' },
  game: { accent: '#ec4899', pale: '#f9a8d4', dark: '#291126', label: 'INTERACTIVE LAB' },
  checklist: { accent: '#14b8a6', pale: '#5eead4', dark: '#09221e', label: 'INTERACTIVE CHECKLIST' },
  interview: { accent: '#6366f1', pale: '#a5b4fc', dark: '#15152f', label: 'INTERVIEW QUESTION' },
  comparison: { accent: '#d97706', pale: '#fbbf24', dark: '#211508', label: 'COMPARISON' },
  flashcard: { accent: '#f43f5e', pale: '#fda4af', dark: '#281019', label: 'INTERACTIVE FLASHCARDS' },
  tool: { accent: '#10b981', pale: '#6ee7b7', dark: '#092218', label: 'DEVOPS TOOL' },
};

function estimatedTextWidth(text: string, fontSize: number, weight = 800): number {
  let em = 0;
  for (const character of [...text]) {
    if (character === ' ') em += 0.3;
    else if (/[ilI|!.,:;'`]/.test(character)) em += 0.32;
    else if (/[mwMW@%&]/.test(character)) em += 0.96;
    else if (/[A-Z]/.test(character)) em += 0.72;
    else if (/[0-9]/.test(character)) em += 0.61;
    else if (/[a-z]/.test(character)) em += 0.58;
    else if (/[-_+\/=()\[\]{}]/.test(character)) em += 0.5;
    else em += 1;
  }
  return em * fontSize * (weight >= 800 ? 1.035 : 1.015);
}

function splitLongToken(token: string, fontSize: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const character of [...token]) {
    const candidate = current + character;
    if (current && estimatedTextWidth(candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapMeasured(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const rawWord of cleanOgText(text).split(' ').filter(Boolean)) {
    const words =
      estimatedTextWidth(rawWord, fontSize) > maxWidth
        ? splitLongToken(rawWord, fontSize, maxWidth)
        : [rawWord];
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && estimatedTextWidth(candidate, fontSize) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitCategory(category: string): Pick<
  ContentCoverLayout,
  'categoryFontSize' | 'categoryBadgeWidth' | 'categoryDisplay'
> {
  const clean = cleanOgText(category) || 'GENERAL';
  for (const fontSize of [16, 15, 14, 13, 12]) {
    const width = estimatedTextWidth(clean, fontSize, 700) + 54;
    if (width <= 420) {
      return {
        categoryFontSize: fontSize,
        categoryBadgeWidth: Math.max(150, Math.ceil(width)),
        categoryDisplay: clean,
      };
    }
  }

  let display = clean;
  while (display.length > 3 && estimatedTextWidth(`${display}…`, 12, 700) + 54 > 420) {
    display = display.slice(0, -1);
  }
  return { categoryFontSize: 12, categoryBadgeWidth: 420, categoryDisplay: `${display}…` };
}

export function layoutContentCoverTitle(title: string, category: string): ContentCoverLayout {
  const clean = cleanOgText(title);
  if (!clean) throw new Error('Cover title cannot be empty');

  const attempts = [
    { maxWidth: 780, sizes: [56, 52, 48, 44, 40], wide: false, maxLines: 3, titleY: 300 },
    { maxWidth: 1040, sizes: [52, 48, 44, 40, 38, 36, 34], wide: true, maxLines: 3, titleY: 300 },
    { maxWidth: 1040, sizes: [32, 30, 28], wide: true, maxLines: 4, titleY: 278 },
  ];

  for (const attempt of attempts) {
    for (const fontSize of attempt.sizes) {
      const lines = wrapMeasured(clean, fontSize, attempt.maxWidth);
      if (
        lines.length <= attempt.maxLines &&
        lines.every((line) => estimatedTextWidth(line, fontSize) <= attempt.maxWidth)
      ) {
        return {
          lines,
          fontSize,
          lineHeight: fontSize + 12,
          titleY: attempt.titleY,
          maxWidth: attempt.maxWidth,
          wide: attempt.wide,
          ...fitCategory(category),
        };
      }
    }
  }

  throw new Error(`Cover title cannot fit without truncation (${clean.length} characters)`);
}

export function buildContentCoverSvg(options: ContentCoverOptions): string {
  const title = cleanOgText(options.title);
  const category = cleanOgText(options.category) || 'GENERAL';
  const style = CONTENT_COVER_STYLES[options.type];
  const layout = layoutContentCoverTitle(title, category);
  const eyebrow = cleanOgText(options.eyebrow) || style.label;
  const sectionLabel = cleanOgText(options.sectionLabel) || `${options.type.toUpperCase()} / COVER`;
  const titleSvg = layout.lines
    .map(
      (line, index) =>
        `<text data-cover-title-line="true" x="80" y="${layout.titleY + index * layout.lineHeight}" font-family="Arial, sans-serif" font-size="${layout.fontSize}" font-weight="800" letter-spacing="-1.1" fill="#fafafa">${escapeXml(line)}</text>`
    )
    .join('\n');
  const motif = layout.wide
    ? ''
    : `<g transform="translate(930 220)" opacity=".22"><rect x="0" y="0" width="188" height="190" rx="28" fill="${style.accent}" fill-opacity=".12" stroke="${style.pale}" stroke-width="2"/><circle cx="94" cy="76" r="28" fill="none" stroke="${style.pale}" stroke-width="4"/><path d="M47 135h94M60 159h68" stroke="${style.pale}" stroke-width="5" stroke-linecap="round"/></g>`;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(title)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse"><stop stop-color="#08090c"/><stop offset="1" stop-color="${style.dark}"/></linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="translate(1010 120) rotate(142) scale(520 400)" gradientUnits="userSpaceOnUse"><stop stop-color="${style.accent}" stop-opacity=".32"/><stop offset="1" stop-color="${style.accent}" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="${style.pale}" stroke-opacity=".05"/><circle cx="22" cy="22" r="1.5" fill="${style.pale}" fill-opacity=".075"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="28" y="28" width="1144" height="574" rx="32" fill="none" stroke="${style.pale}" stroke-opacity=".2"/>
  ${motif}
  <rect x="80" y="70" width="${layout.categoryBadgeWidth}" height="40" rx="20" fill="${style.accent}" fill-opacity=".14" stroke="${style.pale}" stroke-opacity=".76"/>
  <circle cx="100" cy="90" r="4" fill="${style.pale}"/>
  <text x="114" y="97" font-family="Arial, sans-serif" font-size="${layout.categoryFontSize}" font-weight="700" letter-spacing=".7" fill="${style.pale}">${escapeXml(layout.categoryDisplay)}</text>
  <text x="1120" y="96" font-family="Menlo, Monaco, monospace" font-size="14" letter-spacing="1.4" fill="#a1a1aa" text-anchor="end">${escapeXml(sectionLabel)}</text>
  <rect x="80" y="150" width="56" height="56" rx="16" fill="${style.accent}"/>
  <circle cx="108" cy="178" r="15" fill="none" stroke="#081018" stroke-width="3"/>
  <path d="M101 178h14m-7-7v14" stroke="#081018" stroke-width="3" stroke-linecap="round"/>
  <text x="158" y="185" font-family="Menlo, Monaco, monospace" font-size="18" font-weight="700" letter-spacing="2" fill="${style.pale}">${escapeXml(eyebrow)}</text>
  ${titleSvg}
  <line x1="80" y1="510" x2="1120" y2="510" stroke="#fafafa" stroke-opacity=".12"/>
  <rect x="80" y="540" width="22" height="22" rx="7" fill="${style.accent}"/>
  <text x="116" y="558" font-family="Arial, sans-serif" font-size="19" font-weight="800" fill="#fafafa">DevOps Daily</text>
  <text x="1120" y="558" font-family="Menlo, Monaco, monospace" font-size="14" fill="#a1a1aa" text-anchor="end">DEVOPS-DAILY.COM</text>
</svg>`;
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
