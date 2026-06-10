/**
 * Renders the PostChart components to a standalone HTML file for visual
 * review on machines where headless chromium can only load file:// pages.
 * Not part of the build; run with: npx tsx scripts/render-chart-demo.tsx
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, writeFileSync } from 'node:fs';
import { PostChart } from '../components/post-chart-blocks';
import type { ChartSpec } from '../lib/post-charts';

const specs = JSON.parse(readFileSync('/tmp/chart-specs.json', 'utf8')) as Record<string, ChartSpec>;

const sections = (['latencySpec', 'createSpec', 'coldSpec'] as const)
  .map((key) => renderToStaticMarkup(<PostChart spec={specs[key]} />))
  .join('\n');

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Inter, sans-serif; }
  .theme { padding: 40px; }
  .theme.light { --foreground: hsl(240 10% 3.9%); --muted-foreground: hsl(240 3.8% 46.1%);
    --muted: hsl(240 4.8% 95.9%); --border: hsl(240 5.9% 90%); background: #fff; color: hsl(240 10% 3.9%); }
  .theme.dark { --foreground: hsl(0 0% 98%); --muted-foreground: hsl(240 5% 64.9%);
    --muted: hsl(240 3.7% 15.9%); --border: hsl(240 3.7% 15.9%); background: hsl(240 10% 3.9%); color: hsl(0 0% 98%); }
  .wrap { max-width: 760px; margin: 0 auto; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; }
  figure { margin: 32px 0; border-radius: 0.5rem; border: 1px solid var(--border); padding: 20px;
    background: color-mix(in srgb, var(--muted) 20%, transparent); }
  figcaption { margin-bottom: 16px; font-size: 14px; font-weight: 600; color: var(--foreground); }
  figure p { margin: 12px 0 0; font-size: 12px; color: var(--muted-foreground); }
  .fill-muted-foreground { fill: var(--muted-foreground); }
  .fill-foreground { fill: var(--foreground); }
  .stroke-border { stroke: var(--border); }
  .mt-3 { margin-top: 12px; } .flex { display: flex; } .flex-wrap { flex-wrap: wrap; }
  .gap-x-5 { column-gap: 20px; } .gap-y-1\\.5 { row-gap: 6px; }
  .text-xs { font-size: 12px; } .text-muted-foreground { color: var(--muted-foreground); }
  .inline-flex { display: inline-flex; } .items-center { align-items: center; } .gap-1\\.5 { gap: 6px; }
  .h-2 { height: 8px; } .w-2 { width: 8px; } .rounded-sm { border-radius: 3px; }
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="theme light"><div class="wrap"><h2>Light theme</h2>${sections}</div></div>
<div class="theme dark"><div class="wrap"><h2>Dark theme</h2>${sections}</div></div>
</body></html>`;

writeFileSync('/tmp/charts-demo.html', html);
console.log('written /tmp/charts-demo.html');
