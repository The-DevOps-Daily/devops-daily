// Standalone art review; leaves the website reader and committed PDF unchanged.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../../..');
const content = JSON.parse(await readFile(path.join(directory, 'panels.json'), 'utf8'));
const escape = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const sections = [];
for (const panel of content.panels) {
  const source = path.join(root, panel.artwork);
  const { width, height } = await sharp(source).metadata();
  await sharp(source)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(path.join(directory, `${panel.id}-source.jpg`));
  const labels = panel.labels
    .map(
      (
        label
      ) => `<li class="label ${escape(label.tone || '')} ${label.small ? 'small' : ''}" data-ink="${escape(label.ink || 'dark')}" style="--x:${label.position.x * 100}%;--y:${label.position.y * 100}%;--width:${label.position.width * 100}%;--rotation:${label.rotation || 0}deg;--align:${label.align || 'left'}">
${label.title ? `<strong>${escape(label.title)}</strong>` : ''}
${label.detail ? `<span>${escape(label.detail)}</span>` : ''}
${label.code ? `<pre><code>${escape(label.code)}</code></pre>` : ''}
</li>`
    )
    .join('\n');
  sections.push(`<section id="${escape(panel.id)}" data-panel="${panel.panel}" data-ratio="${width / height}" data-master-width="${width}">
<header><p>git blame · Chapter 1 · Panel ${panel.panel} · Artwork review</p><h2>${escape(panel.title)}</h2></header>
<figure><div class="art"><img src="${escape(panel.id)}-source.jpg" width="${width}" height="${height}" alt="${escape(panel.alt)}"><ol aria-label="${escape(panel.labelsMeaning)}">${labels}</ol></div><figcaption>${escape(panel.caption)}</figcaption></figure>
</section>`);
}
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>git blame — expanded chapter artwork review</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:24px;color:#273746;background:#f6f0df;font-family:Arial,Helvetica,sans-serif;font-size:1rem;line-height:1.45}main{max-width:1024px;margin:auto}h1{font-size:2rem}h2{font-size:1.75rem;margin:4px 0 18px;line-height:1.2}header p{margin:0;color:#486456}section{margin:0 0 60px;padding:0 0 18px}figure{margin:0;container-type:inline-size}.art{position:relative}img{display:block;width:100%;height:auto}ol{margin:0;padding:18px 28px 18px 50px;background:#fffcf2}.label{padding:8px 0;font-size:1.125rem}.label strong,.label span{display:block}.label strong{font-size:1.25rem}.label span{margin-top:4px}pre{margin:0}code{display:block;font:1.125rem/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px}.warning strong{color:#765323}.error strong{color:#923f36}.success strong{color:#355e49}figcaption{font-size:1.125rem;margin:16px 0 0}
@container(min-width:46em){ol{position:absolute;inset:0;list-style:none;padding:0;background:none}.label{position:absolute;left:var(--x);top:var(--y);width:var(--width);padding:0;font-size:clamp(1.125rem,1.9cqi,1.25rem);line-height:1.35;transform:rotate(var(--rotation));transform-origin:top left;text-align:var(--align)}.label strong{font-size:clamp(1.25rem,2.3cqi,1.5rem)}.label.small strong{font-size:clamp(1.125rem,1.8cqi,1.25rem)}.label span{margin-top:5px}code{font-size:clamp(1rem,2cqi,1.3125rem);line-height:1.45}.label[data-ink="light"]{color:#fffbed}.label[data-ink="light"] strong{color:inherit}}
@media(max-width:480px){body{padding:12px}h2{font-size:1.5rem}ol{padding:15px 18px 15px 38px}}
</style></head><body><main><h1>Chapter 1: six new visual moments</h1><p>Generated illustration candidates. All screen, code and checklist wording remains editable. This review has not changed the website reader or PDF.</p>${sections.join('\n')}</main></body></html>`;
await writeFile(
  path.join(directory, 'review.html'),
  await format(html, { ...(await resolveConfig(directory)), parser: 'html' })
);
