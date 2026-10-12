// Isolated artwork review: no changes to the seven-scene Next.js reader or PDF.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const directory = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(await readFile(path.join(directory, 'lettering.json'), 'utf8'));
const escape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const labels = content.labels
  .map(
    (label) =>
      `<li class="${escape(label.tone)}" style="--x:${label.position.x * 100}%;--y:${label.position.y * 100}%;--width:${label.position.width * 100}%"><strong>${escape(label.title)}</strong><span>${escape(label.detail)}</span></li>`
  )
  .join('\n');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>git blame — ${escape(content.title)} — artwork proof</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:24px;color:#273746;background:#f6f0df;font-family:Arial,Helvetica,sans-serif;font-size:1rem;line-height:1.45}
main{max-width:1024px;margin:auto}
header{margin-bottom:18px}
header p{margin:0;color:#486456;font-size:1rem}
h1{font-size:1.75rem;line-height:1.2;margin:5px 0 0}
figure{margin:0;container-type:inline-size}
.art{position:relative}
img{display:block;width:100%;height:auto}
ol{margin:0;padding:20px 28px 20px 50px;background:#fffcf2}
li{padding:8px 0;font-size:1.125rem}
li strong,li span{display:block}
li strong{font-size:1.25rem}
li span{margin-top:4px}
.warning strong{color:#765323}
.error strong{color:#923f36}
figcaption{font-size:1.125rem;margin:18px 0 0}
.note{font-size:.9375rem;color:#486456;margin:12px 0 0}
@container (min-width:46em){
ol{position:absolute;inset:0;list-style:none;padding:0;background:none}
li{position:absolute;left:var(--x);top:var(--y);width:var(--width);padding:0;font-size:clamp(1.125rem,2cqi,1.3125rem);line-height:1.4}
li strong{font-size:clamp(1.3125rem,2.5cqi,1.625rem)}
li span{margin-top:5px}
}
@media(max-width:480px){body{padding:12px}h1{font-size:1.5rem}ol{padding:15px 18px 15px 38px}}
</style>
</head>
<body>
<main>
<header><p>git blame · Chapter 1 · Panel 7 · Artwork proof</p><h1>${escape(content.title)}</h1></header>
<figure>
<div class="art">
<img src="panel-07-trace-source.jpg" width="1448" height="1086" alt="${escape(content.alt)}">
<ol aria-label="Evidence in chronological order">${labels}</ol>
</div>
<figcaption>${escape(content.caption)}</figcaption>
</figure>
<p class="note">Fictional evidence, assembled from app and load-balancer records. r-17 is a short display alias.</p>
</main>
</body>
</html>
`;
await writeFile(
  path.join(directory, 'review.html'),
  await format(html, { ...(await resolveConfig(directory)), parser: 'html' })
);
