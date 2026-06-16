/**
 * Renders the ```chart fences from a post into standalone PNGs for cross-posting
 * to platforms (DEV, etc.) that cannot run our interactive chart components.
 * SVG is built by hand and rasterised with resvg, so it runs anywhere with no
 * headless browser. Output: public/images/cross-posts/<slug>/chart-<i>-<type>.png
 *
 *   node scripts/render-cross-post-charts.mjs <slug> [<slug> ...]
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1000;
const BG = "#0b0f17";
const FG = "#e5e7eb";
const FAINT = "#7c8aa0";
const GRID = "#1e2636";
const PALETTE = ["#34d399", "#38bdf8", "#f59e0b", "#a78bfa", "#fb7185", "#9ca3af"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fmt(v, unit) {
  if (unit === "$") return `$${v >= 1000 ? Math.round(v).toLocaleString() : v % 1 ? v.toFixed(2) : v}`;
  if (unit === "%") return `${v}%`;
  if (unit === "ms" || unit === "s") {
    if (unit === "ms" && v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}s`;
    return `${Math.round(v * 10) / 10}${unit}`;
  }
  return `${v}${unit ? ` ${unit}` : ""}`;
}

function frame(height, title, caption, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
  <rect width="${W}" height="${height}" fill="${BG}"/>
  ${title ? `<text x="40" y="50" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${FG}">${esc(title)}</text>` : ""}
  ${body}
  ${caption ? `<text x="40" y="${height - 22}" font-family="Arial, sans-serif" font-size="14" fill="${FAINT}">${esc(caption).slice(0, 120)}</text>` : ""}
  <text x="${W - 40}" y="${height - 22}" text-anchor="end" font-family="monospace" font-size="13" fill="#475569">devops-daily.com</text>
</svg>`;
}

function colorForSeries(name, seriesDefs, idx) {
  const def = (seriesDefs || []).find((s) => s.name === name);
  if (def?.color) return def.color;
  const i = (seriesDefs || []).findIndex((s) => s.name === name);
  return PALETTE[(i >= 0 ? i : idx) % PALETTE.length];
}

function renderBar(spec) {
  const rows = spec.rows;
  const max = Math.max(...rows.map((r) => Math.max(r.value, r.tick || 0))) * 1.02;
  const padL = 320, padR = 120, top = 84, rowH = 46;
  const plotW = W - padL - padR;
  const height = top + rows.length * rowH + 64;
  const x = (v) => padL + (v / max) * plotW;
  let b = "";
  rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2;
    const color = colorForSeries(r.series, spec.series, i);
    b += `<text x="${padL - 14}" y="${cy + 5}" text-anchor="end" font-family="Arial" font-size="14" fill="${FG}">${esc(r.label).slice(0, 42)}</text>`;
    b += `<rect x="${padL}" y="${cy - 11}" width="${Math.max(2, x(r.value) - padL)}" height="22" rx="4" fill="${color}"/>`;
    if (r.tick != null) b += `<rect x="${x(r.tick) - 1.5}" y="${cy - 16}" width="3" height="32" fill="#f59e0b"/>`;
    b += `<text x="${x(r.value) + 10}" y="${cy + 5}" font-family="monospace" font-size="14" font-weight="700" fill="${FG}">${esc(fmt(r.value, spec.unit))}</text>`;
  });
  return { svg: frame(height, spec.title, spec.caption, b), height };
}

function renderLine(spec) {
  const xs = spec.x || [];
  const series = spec.series;
  const max = Math.max(...series.flatMap((s) => s.data)) * 1.1;
  const padL = 90, padR = 30, top = 80, plotH = 360;
  const plotW = W - padL - padR;
  const bottom = top + plotH;
  const X = (i) => padL + (xs.length === 1 ? plotW / 2 : (i / (xs.length - 1)) * plotW);
  const Y = (v) => top + (1 - v / max) * plotH;
  let b = "";
  for (let t = 0; t <= 4; t++) {
    const v = (max * t) / 4, y = Y(v);
    b += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${GRID}"/>`;
    b += `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-family="monospace" font-size="12" fill="${FAINT}">${esc(fmt(Math.round(v), spec.unit))}</text>`;
  }
  xs.forEach((lab, i) => {
    b += `<text x="${X(i)}" y="${bottom + 26}" text-anchor="middle" font-family="Arial" font-size="13" fill="${FAINT}">${esc(lab)}</text>`;
  });
  series.forEach((s, si) => {
    const color = s.color || PALETTE[si % PALETTE.length];
    const d = s.data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    b += `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
    s.data.forEach((v, i) => { b += `<circle cx="${X(i)}" cy="${Y(v)}" r="4.5" fill="${color}"/>`; });
    b += `<g transform="translate(${padL + si * 230},58)"><rect width="14" height="14" rx="3" fill="${color}"/><text x="20" y="12" font-family="Arial" font-size="14" fill="${FG}">${esc(s.name)}</text></g>`;
  });
  return { svg: frame(bottom + 70, spec.title, spec.caption, b), height: bottom + 70 };
}

function renderDots(spec) {
  const series = spec.series;
  const all = series.flatMap((s) => s.samples);
  const max = Math.max(...all) * 1.05, min = Math.min(...all, 0);
  const padL = 200, padR = 60, top = 84, bandH = 96;
  const plotW = W - padL - padR;
  const height = top + series.length * bandH + 64;
  const X = (v) => padL + ((v - min) / (max - min)) * plotW;
  const median = (arr) => { const a = [...arr].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  let b = "";
  series.forEach((s, si) => {
    const cy = top + si * bandH + bandH / 2;
    const color = s.color || PALETTE[si % PALETTE.length];
    b += `<text x="${padL - 14}" y="${cy + 5}" text-anchor="end" font-family="Arial" font-size="14" fill="${FG}">${esc(s.name).slice(0, 24)}</text>`;
    b += `<line x1="${padL}" y1="${cy}" x2="${W - padR}" y2="${cy}" stroke="${GRID}"/>`;
    s.samples.forEach((v, i) => {
      const jitter = ((i % 5) - 2) * 7;
      b += `<circle cx="${X(v).toFixed(1)}" cy="${(cy + jitter).toFixed(1)}" r="5" fill="${color}" fill-opacity="0.7"/>`;
    });
    const med = s.median ?? median(s.samples);
    b += `<rect x="${X(med) - 1.5}" y="${cy - 30}" width="3" height="60" fill="#f59e0b"/>`;
    b += `<text x="${X(med)}" y="${cy - 36}" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="#f59e0b">${esc(fmt(med, spec.unit))}</text>`;
  });
  return { svg: frame(height, spec.title, spec.caption, b), height };
}

function renderCdf(spec) {
  const series = spec.series;
  const all = series.flatMap((s) => s.samples);
  const max = Math.max(...all) * 1.02, min = Math.min(...all, 0);
  const padL = 70, padR = 30, top = 80, plotH = 360;
  const plotW = W - padL - padR, bottom = top + plotH;
  const X = (v) => padL + ((v - min) / (max - min)) * plotW;
  const Y = (p) => top + (1 - p) * plotH;
  let b = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const y = Y(p);
    b += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${GRID}"/>`;
    b += `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-family="monospace" font-size="12" fill="${FAINT}">p${p * 100}</text>`;
  });
  series.forEach((s, si) => {
    const color = s.color || PALETTE[si % PALETTE.length];
    const sorted = [...s.samples].sort((x, y) => x - y);
    const pts = sorted.map((v, i) => `${i ? "L" : "M"}${X(v).toFixed(1)},${Y((i + 1) / sorted.length).toFixed(1)}`).join(" ");
    b += `<path d="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="${s.dash || ""}"/>`;
    b += `<g transform="translate(${padL + 20 + si * 200},58)"><rect width="14" height="14" rx="3" fill="${color}"/><text x="20" y="12" font-family="Arial" font-size="13" fill="${FG}">${esc(s.name).slice(0, 22)}</text></g>`;
  });
  b += `<text x="${(padL + W - padR) / 2}" y="${bottom + 30}" text-anchor="middle" font-family="Arial" font-size="13" fill="${FAINT}">latency (${spec.unit || ""}) low to high</text>`;
  return { svg: frame(bottom + 56, spec.title, spec.caption, b), height: bottom + 56 };
}

const RENDER = { bar: renderBar, line: renderLine, dots: renderDots, cdf: renderCdf };

for (const slug of process.argv.slice(2)) {
  const md = readFileSync(join("content/posts", `${slug}.md`), "utf8");
  const fences = [...md.matchAll(/```chart\n([\s\S]*?)```/g)].map((m) => m[1]);
  const outDir = join("public/images/cross-posts", slug);
  mkdirSync(outDir, { recursive: true });
  fences.forEach((raw, i) => {
    const spec = JSON.parse(raw);
    const r = RENDER[spec.type]?.(spec);
    if (!r) { console.log(`  [${i}] unsupported type ${spec.type}`); return; }
    const png = new Resvg(r.svg, { fitTo: { mode: "width", value: W } }).render().asPng();
    const file = join(outDir, `chart-${i}-${spec.type}.png`);
    writeFileSync(file, png);
    console.log(`  ${file}  (${spec.type}, ${r.height}px)`);
  });
}
