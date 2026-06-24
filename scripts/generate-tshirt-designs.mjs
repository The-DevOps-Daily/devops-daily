/**
 * Generates the downloadable t-shirt designs from lib/tshirts-data.json.
 * Each design is rendered as a transparent-background, print-ready SVG in one
 * of a few visual styles, then rasterised to a transparent PNG with resvg.
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
const INK = "#0f172a";
const ACCENT = "#f59e0b";
const MUTED = "#94a3b8";
const SANS = "Arial, Helvetica, sans-serif";
const MONO = "monospace";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Rough width of a string at a given font size (bold sans ~0.58em/char, mono ~0.6em).
const widthOf = (s, size, mono) => s.length * size * (mono ? 0.6 : 0.58);

// Fit a font size so the widest line stays within `maxW`.
function fitSize(lines, maxW, startSize, mono, minSize = 42) {
  let size = startSize;
  const longest = lines.reduce((a, b) => (a.length >= b.length ? a : b), "");
  while (size > minSize && widthOf(longest, size, mono) > maxW) size -= 2;
  return size;
}

// Render one line centered at cx, baseline y, coloring the accent substring.
function centeredLine(line, cx, y, size, accent) {
  const common = `text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="${size}" fill="${INK}"`;
  if (accent && line.includes(accent)) {
    const i = line.indexOf(accent);
    const before = esc(line.slice(0, i));
    const acc = esc(accent);
    const after = esc(line.slice(i + accent.length));
    return `<text x="${cx}" y="${y}" ${common}>${before}<tspan fill="${ACCENT}">${acc}</tspan>${after}</text>`;
  }
  return `<text x="${cx}" y="${y}" ${common}>${esc(line)}</text>`;
}

const MOTIFS = {
  globe: `<g fill="none" stroke="${INK}" stroke-width="9"><circle cx="0" cy="0" r="58"/><ellipse cx="0" cy="0" rx="24" ry="58"/><line x1="-58" y1="0" x2="58" y2="0"/><line x1="-50" y1="-30" x2="50" y2="-30"/><line x1="-50" y1="30" x2="50" y2="30"/></g>`,
  skull: `<g fill="${INK}"><path d="M0 -60 C -42 -60 -60 -30 -60 -2 C -60 18 -48 30 -36 36 L -36 54 C -36 60 -30 64 -22 64 L 22 64 C 30 64 36 60 36 54 L 36 36 C 48 30 60 18 60 -2 C 60 -30 42 -60 0 -60 Z"/><circle cx="-24" cy="-4" r="15" fill="#fff"/><circle cx="24" cy="-4" r="15" fill="#fff"/><path d="M0 16 l -9 22 l 18 0 Z" fill="#fff"/></g>`,
  cloud: `<path d="M -64 24 a 34 34 0 0 1 6 -67 a 44 44 0 0 1 84 8 a 30 30 0 0 1 -6 59 Z" fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>`,
  home: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><path d="M -56 6 L 0 -52 L 56 6"/><path d="M -42 -2 L -42 56 L 42 56 L 42 -2"/></g>`,
  rocket: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><path d="M 0 -64 C 30 -38 30 6 14 34 L -14 34 C -30 6 -30 -38 0 -64 Z"/><circle cx="0" cy="-18" r="11" fill="${ACCENT}" stroke="none"/><path d="M -14 34 L -34 54 L -18 30 M 14 34 L 34 54 L 18 30"/></g>`,
  lock: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><rect x="-44" y="-6" width="88" height="68" rx="10"/><path d="M -28 -6 L -28 -28 A 28 28 0 0 1 28 -28 L 28 -6"/></g>`,
  k8s: `<g fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"><path d="M0 -60 L52 -30 L52 30 L0 60 L-52 30 L-52 -30 Z"/><circle cx="0" cy="0" r="16"/><g stroke-width="7"><line x1="0" y1="-16" x2="0" y2="-44"/><line x1="14" y1="8" x2="38" y2="22"/><line x1="-14" y1="8" x2="-38" y2="22"/></g></g>`,
};

function ddMark() {
  // subtle brand mark, bottom-centered
  const y = H - 70;
  return `<g opacity="0.65">
    <rect x="${W / 2 - 116}" y="${y - 18}" width="22" height="22" rx="5" fill="${ACCENT}"/>
    <text x="${W / 2 - 84}" y="${y}" font-family="${MONO}" font-size="26" fill="${MUTED}">devops-daily.com</text>
  </g>`;
}

function renderTerminal(d) {
  const lines = d.quote.split("\n");
  const size = fitSize(lines, 920, 86, true, 44);
  const lh = size * 1.4;
  const blockH = lines.length * lh;
  let y = H / 2 - blockH / 2 + size;
  const left = W / 2 - 460;
  let body = `<text x="${left}" y="${y - lh}" font-family="${MONO}" font-size="${size * 0.6}" fill="${MUTED}">~/devops $</text>`;
  lines.forEach((line, i) => {
    const yy = y + i * lh;
    body += `<text x="${left}" y="${yy}" font-family="${MONO}" font-weight="700" font-size="${size}" fill="${INK}">${esc(line)}</text>`;
    if (i === lines.length - 1) {
      const cursorX = left + widthOf(line, size, true) + 14;
      body += `<rect x="${cursorX}" y="${yy - size * 0.78}" width="${size * 0.55}" height="${size * 0.9}" fill="${ACCENT}"/>`;
    }
  });
  return body;
}

function renderBadge(d) {
  const lines = d.quote.split("\n");
  const size = fitSize(lines, 880, 92, false, 40);
  const lh = size * 1.18;
  const blockH = lines.length * lh;
  const top = H / 2 - blockH / 2;
  const cx = W / 2;
  let body = `<line x1="${cx - 300}" y1="${top - 48}" x2="${cx + 300}" y2="${top - 48}" stroke="${INK}" stroke-width="6"/>`;
  lines.forEach((line, i) => {
    const y = top + i * lh + size;
    const up = line.toUpperCase();
    const acc = d.accent ? d.accent.toUpperCase() : undefined;
    body += centeredLine(up, cx, y, size, acc).replace(`font-size="${size}"`, `font-size="${size}" letter-spacing="3"`);
  });
  body += `<line x1="${cx - 300}" y1="${top + blockH + 20}" x2="${cx + 300}" y2="${top + blockH + 20}" stroke="${INK}" stroke-width="6"/>`;
  return body;
}

function renderStacked(d, upper) {
  const lines = d.quote.split("\n");
  const size = fitSize(lines, 1000, 150, false, 48);
  const lh = size * (upper ? 1.02 : 1.12);
  const blockH = lines.length * lh;
  const top = H / 2 - blockH / 2;
  const cx = W / 2;
  let body = "";
  lines.forEach((line, i) => {
    const y = top + i * lh + size * 0.82;
    const text = upper ? line.toUpperCase() : line;
    const acc = upper && d.accent ? d.accent.toUpperCase() : d.accent;
    body += centeredLine(text, cx, y, size, acc);
  });
  return body;
}

function buildSvg(d) {
  let inner = "";
  let motifShift = 0;
  if (d.motif && MOTIFS[d.motif]) {
    inner += `<g transform="translate(${W / 2}, 470)">${MOTIFS[d.motif]}</g>`;
    motifShift = 1;
  }
  // When a motif is present, nudge text down a touch by rendering in lower half.
  const designWithShift = motifShift ? { ...d } : d;
  if (d.style === "terminal") inner += renderTerminal(designWithShift);
  else if (d.style === "badge") inner += renderBadge(designWithShift);
  else if (d.style === "stacked") inner += renderStacked(designWithShift, true);
  else inner += renderStacked(designWithShift, false); // statement
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
