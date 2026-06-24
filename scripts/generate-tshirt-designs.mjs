/**
 * Generates the downloadable t-shirt designs from lib/tshirts-data.json.
 * Each design is a transparent-background, print-ready SVG in one of a few
 * composed visual styles (terminal window, framed emblem, type lockups),
 * then rasterised to a transparent PNG with resvg.
 * Output: public/tshirts/<slug>.svg and public/tshirts/<slug>.png
 *
 *   node scripts/generate-tshirt-designs.mjs
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const designs = JSON.parse(readFileSync(join(root, "lib/tshirts-data.json"), "utf8"));
const outDir = join(root, "public/tshirts");
mkdirSync(outDir, { recursive: true });

const W = 1200;
const H = 1500;
const CX = W / 2;
const INK = "#0f172a";
const ACCENT = "#f59e0b";
const MUTED = "#94a3b8";
const SANS = "Arial, Helvetica, sans-serif";
const MONO = "monospace";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const widthOf = (s, size, mono) => s.length * size * (mono ? 0.6 : 0.58);

function fitSize(lines, maxW, startSize, mono, minSize = 42) {
  let size = startSize;
  const longest = lines.reduce((a, b) => (a.length >= b.length ? a : b), "");
  while (size > minSize && widthOf(longest, size, mono) > maxW) size -= 2;
  return size;
}

function centeredLine(line, cx, y, size, accent, weight = 800, spacing = 0) {
  const attrs = `text-anchor="middle" font-family="${SANS}" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}" fill="${INK}"`;
  if (accent && line.includes(accent)) {
    const i = line.indexOf(accent);
    return `<text x="${cx}" y="${y}" ${attrs}>${esc(line.slice(0, i))}<tspan fill="${ACCENT}">${esc(accent)}</tspan>${esc(line.slice(i + accent.length))}</text>`;
  }
  return `<text x="${cx}" y="${y}" ${attrs}>${esc(line)}</text>`;
}

// Decorative divider: short rule, amber diamond, short rule.
function divider(cy) {
  return `<g>
    <line x1="${CX - 140}" y1="${cy}" x2="${CX - 26}" y2="${cy}" stroke="${INK}" stroke-width="5"/>
    <rect x="${CX - 11}" y="${cy - 11}" width="22" height="22" rx="3" transform="rotate(45 ${CX} ${cy})" fill="${ACCENT}"/>
    <line x1="${CX + 26}" y1="${cy}" x2="${CX + 140}" y2="${cy}" stroke="${INK}" stroke-width="5"/>
  </g>`;
}

const MOTIFS = {
  globe: `<g fill="none" stroke="${INK}" stroke-width="9"><circle cx="0" cy="0" r="56"/><ellipse cx="0" cy="0" rx="23" ry="56"/><line x1="-56" y1="0" x2="56" y2="0"/><line x1="-48" y1="-29" x2="48" y2="-29"/><line x1="-48" y1="29" x2="48" y2="29"/></g>`,
  skull: `<g fill="${INK}"><path d="M0 -58 C -40 -58 -58 -29 -58 -2 C -58 17 -46 29 -34 35 L -34 52 C -34 58 -29 62 -21 62 L 21 62 C 29 62 34 58 34 52 L 34 35 C 46 29 58 17 58 -2 C 58 -29 40 -58 0 -58 Z"/><circle cx="-23" cy="-4" r="14" fill="#fff"/><circle cx="23" cy="-4" r="14" fill="#fff"/><path d="M0 15 l -8 21 l 16 0 Z" fill="#fff"/></g>`,
  cloud: `<path d="M -62 23 a 33 33 0 0 1 6 -65 a 43 43 0 0 1 82 8 a 29 29 0 0 1 -6 57 Z" fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>`,
  home: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><path d="M -54 6 L 0 -50 L 54 6"/><path d="M -40 -2 L -40 54 L 40 54 L 40 -2"/></g>`,
  rocket: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><path d="M 0 -62 C 29 -37 29 6 14 33 L -14 33 C -29 6 -29 -37 0 -62 Z"/><circle cx="0" cy="-18" r="10" fill="${ACCENT}" stroke="none"/><path d="M -14 33 L -33 52 L -17 29 M 14 33 L 33 52 L 17 29"/></g>`,
  lock: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><rect x="-42" y="-6" width="84" height="64" rx="10"/><path d="M -27 -6 L -27 -27 A 27 27 0 0 1 27 -27 L 27 -6"/><circle cx="0" cy="22" r="7" fill="${INK}"/></g>`,
  k8s: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><path d="M0 -58 L50 -29 L50 29 L0 58 L-50 29 L-50 -29 Z"/><circle cx="0" cy="0" r="15"/><g stroke-width="7"><line x1="0" y1="-15" x2="0" y2="-42"/><line x1="13" y1="8" x2="36" y2="21"/><line x1="-13" y1="8" x2="-36" y2="21"/></g></g>`,
};

function ddMark() {
  const y = H - 92;
  return `<g opacity="0.6">
    <rect x="${CX - 112}" y="${y - 17}" width="20" height="20" rx="5" fill="${ACCENT}"/>
    <text x="${CX - 82}" y="${y}" font-family="${MONO}" font-size="25" fill="${MUTED}">devops-daily.com</text>
  </g>`;
}

// Terminal window with title bar, prompt, and cursor.
function renderTerminal(d) {
  const lines = d.quote.split("\n");
  const size = fitSize(lines, 720, 78, true, 44);
  const lh = size * 1.45;
  const padX = 56;
  const titleH = 78;
  const bodyTop = titleH + 50;
  const contentH = lh + lines.length * lh; // prompt line + command lines
  const boxH = bodyTop + contentH + 50;
  const boxW = 880;
  const boxX = CX - boxW / 2;
  const boxY = H / 2 - boxH / 2 - 30;
  const left = boxX + padX;

  let s = `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="22" fill="none" stroke="${INK}" stroke-width="6"/>`;
  s += `<line x1="${boxX}" y1="${boxY + titleH}" x2="${boxX + boxW}" y2="${boxY + titleH}" stroke="${INK}" stroke-width="4"/>`;
  s += `<circle cx="${boxX + 40}" cy="${boxY + titleH / 2}" r="13" fill="${ACCENT}"/>`;
  s += `<circle cx="${boxX + 78}" cy="${boxY + titleH / 2}" r="13" fill="none" stroke="${INK}" stroke-width="4"/>`;
  s += `<circle cx="${boxX + 116}" cy="${boxY + titleH / 2}" r="13" fill="none" stroke="${INK}" stroke-width="4"/>`;
  s += `<text x="${boxX + boxW - 30}" y="${boxY + titleH / 2 + 9}" text-anchor="end" font-family="${MONO}" font-size="26" fill="${MUTED}">bash</text>`;

  let y = boxY + bodyTop + size;
  s += `<text x="${left}" y="${y}" font-family="${MONO}" font-size="${size * 0.62}" fill="${MUTED}">~/devops $</text>`;
  lines.forEach((line, i) => {
    const yy = y + (i + 1) * lh;
    const acc = d.accent && line.includes(d.accent);
    if (acc) {
      const idx = line.indexOf(d.accent);
      s += `<text x="${left}" y="${yy}" font-family="${MONO}" font-weight="700" font-size="${size}" fill="${INK}">${esc(line.slice(0, idx))}<tspan fill="${ACCENT}">${esc(d.accent)}</tspan>${esc(line.slice(idx + d.accent.length))}</text>`;
    } else {
      s += `<text x="${left}" y="${yy}" font-family="${MONO}" font-weight="700" font-size="${size}" fill="${INK}">${esc(line)}</text>`;
    }
    if (i === lines.length - 1) {
      const cx = left + widthOf(line, size, true) + 12;
      s += `<rect x="${cx}" y="${yy - size * 0.76}" width="${size * 0.52}" height="${size * 0.86}" fill="${ACCENT}"/>`;
    }
  });
  return s;
}

// Framed emblem: rounded border, corner ticks, uppercase letterspaced text.
function renderBadge(d) {
  const lines = d.quote.split("\n").map((l) => l.toUpperCase());
  const acc = d.accent ? d.accent.toUpperCase() : undefined;
  const size = fitSize(lines, 700, 78, false, 40);
  const lh = size * 1.2;
  const blockH = lines.length * lh;
  const boxW = 860;
  const boxH = blockH + 220;
  const boxX = CX - boxW / 2;
  const boxY = H / 2 - boxH / 2 - 20;

  let s = `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="18" fill="none" stroke="${INK}" stroke-width="6"/>`;
  s += `<rect x="${boxX + 14}" y="${boxY + 14}" width="${boxW - 28}" height="${boxH - 28}" rx="12" fill="none" stroke="${ACCENT}" stroke-width="3"/>`;
  // top kicker inside the frame
  s += `<text x="${CX}" y="${boxY + 64}" text-anchor="middle" font-family="${MONO}" font-size="26" letter-spacing="6" fill="${MUTED}">DEVOPS</text>`;
  const top = boxY + boxH / 2 - blockH / 2;
  lines.forEach((line, i) => {
    const y = top + i * lh + size * 0.82;
    s += centeredLine(line, CX, y, size, acc, 800, 4);
  });
  s += `<text x="${CX}" y="${boxY + boxH - 44}" text-anchor="middle" font-family="${MONO}" font-size="26" letter-spacing="6" fill="${MUTED}">DAILY</text>`;
  return s;
}

// Big type lockup with a divider above, accent colour, and an amber underline.
function renderType(d, upper, motif) {
  const lines = upper ? d.quote.split("\n").map((l) => l.toUpperCase()) : d.quote.split("\n");
  const acc = upper && d.accent ? d.accent.toUpperCase() : d.accent;
  const size = fitSize(lines, 1000, upper ? 140 : 150, false, 48);
  const lh = size * (upper ? 1.04 : 1.12);
  const blockH = lines.length * lh;

  // Center the whole lockup (motif + divider + text + underline) around H/2.
  const hasMotif = !!motif;
  const motifH = hasMotif ? 150 : 0;
  const dividerGap = 70;
  const lockH = motifH + dividerGap + blockH + 60;
  let cursorY = H / 2 - lockH / 2;

  let s = "";
  if (hasMotif) {
    s += `<g transform="translate(${CX}, ${cursorY + 66})">${MOTIFS[motif]}</g>`;
    cursorY += motifH;
  }
  s += divider(cursorY + 24);
  cursorY += dividerGap;
  lines.forEach((line, i) => {
    const y = cursorY + i * lh + size * 0.82;
    s += centeredLine(line, CX, y, size, acc, 800, upper ? 1 : 0);
  });
  // amber underline accent beneath the lockup
  const uy = cursorY + blockH + 26;
  s += `<rect x="${CX - 70}" y="${uy}" width="140" height="10" rx="5" fill="${ACCENT}"/>`;
  return s;
}

function buildSvg(d) {
  let inner = "";
  if (d.style === "terminal") inner += renderTerminal(d);
  else if (d.style === "badge") inner += renderBadge(d);
  else if (d.style === "stacked") inner += renderType(d, true, d.motif);
  else inner += renderType(d, false, d.motif); // statement
  inner += ddMark();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;
}

let count = 0;
for (const d of designs) {
  const svg = buildSvg(d);
  writeFileSync(join(outDir, `${d.slug}.svg`), svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, background: "rgba(0,0,0,0)" }).render().asPng();
  writeFileSync(join(outDir, `${d.slug}.png`), png);
  count++;
}
console.log(`generated ${count} designs (svg + png) in public/tshirts/`);
