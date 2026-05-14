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
