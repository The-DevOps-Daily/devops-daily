import fs from 'fs/promises';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
