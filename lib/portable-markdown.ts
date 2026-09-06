/**
 * Rewrites our custom post blocks into plain markdown, for feeds that other
 * platforms import.
 *
 * The problem this solves is not cosmetic. Our custom fences render to an
 * empty div with a data attribute, and the browser fills it in with React:
 *
 *   <div class="post-diagram" data-diagram="{...}"></div>
 *
 * A platform like dev.to has no React and strips the empty div, so the block
 * disappears completely. A post with three terminals and two diagrams loses
 * all five, silently, while the surrounding text still refers to them.
 *
 * So each block is converted rather than removed. The reader loses the
 * animation and keeps the information.
 */

import { median, percentile } from './post-charts';

/** Runs `fn` over the body of every fence with the given language. */
function replaceFence(
  markdown: string,
  lang: string,
  fn: (body: string) => string,
): string {
  const pattern = new RegExp(`^\`\`\`${lang}[ \\t]*\\n([\\s\\S]*?)\\n\`\`\`[ \\t]*$`, 'gm');
  return markdown.replace(pattern, (whole, body: string) => {
    try {
      return fn(body);
    } catch {
      // A malformed block is not worth failing a build over. Dropping it
      // matches what the site does: an unparseable fence renders as nothing
      // useful there either.
      return '';
    }
  });
}

function asJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

/** Escapes the pipe so a value cannot break out of a markdown table cell. */
function cell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|');
}

/** One table line; an empty cell (the label column header) renders as `| |`. */
function tableRow(cells: string[]): string {
  return `|${cells.map((c) => (c ? ` ${c} |` : ' |')).join('')}`;
}

interface DiagramNode {
  id?: string;
  label?: string;
  sub?: string;
}

interface DiagramGroup {
  label?: string;
  sub?: string;
  nodes?: DiagramNode[];
  groups?: DiagramGroup[];
}

interface DiagramSpec {
  type?: string;
  title?: string;
  goal?: string;
  loopTop?: string;
  loopBack?: string;
  nodes?: DiagramNode[];
  branch?: DiagramNode[];
  groups?: DiagramGroup[];
  flow?: DiagramNode[];
  columns?: DiagramNode[][];
  edges?: Array<[string, string, string?]>;
}

function nodeText(node: DiagramNode): string {
  const label = node.label ?? '';
  return node.sub ? `**${label}** ${node.sub}` : `**${label}**`;
}

function numbered(nodes: DiagramNode[]): string[] {
  return nodes.map((node, i) => `${i + 1}. ${nodeText(node)}`);
}

function groupLines(groups: DiagramGroup[], depth = 0): string[] {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`${indent}- ${nodeText(group)}`);
    if (group.groups && group.groups.length > 0) {
      lines.push(...groupLines(group.groups, depth + 1));
    }
    for (const node of group.nodes ?? []) {
      lines.push(`${indent}  - ${nodeText(node)}`);
    }
  }
  return lines;
}

/**
 * Every diagram mode has a plain-text shape: flows and loops become a numbered
 * list, branches add their outcomes, infra boxes nest as bullets, and graphs
 * list their nodes followed by the edges between them.
 */
function diagramToMarkdown(body: string): string {
  const spec = asJson<DiagramSpec>(body);
  const out: string[] = [];
  if (spec.title) out.push(`**${spec.title}**`, '');
  if (spec.goal) out.push(`*Goal: ${spec.goal}*`, '');

  if (spec.type === 'graph') {
    const nodes = (spec.columns ?? []).flat();
    const labelOf = new Map(nodes.filter((n) => n.id).map((n) => [n.id as string, n.label ?? n.id]));
    out.push(...numbered(nodes));
    const edges = (spec.edges ?? []).filter((e) => Array.isArray(e) && e.length >= 2);
    if (edges.length > 0) {
      out.push('', 'Connections:', '');
      for (const [from, to, label] of edges) {
        const arrow = `${labelOf.get(from) ?? from} -> ${labelOf.get(to) ?? to}`;
        out.push(label ? `- ${arrow} (${label})` : `- ${arrow}`);
      }
    }
  } else if (spec.type === 'infra') {
    if (spec.flow && spec.flow.length > 0) out.push(...numbered(spec.flow), '');
    out.push(...groupLines(spec.groups ?? []));
  } else {
    // flow, loop, branch: a row of nodes. Older specs put nodes in groups.
    const nodes = spec.nodes ?? (spec.groups ?? []).flatMap((g) => g.nodes ?? []);
    out.push(...numbered(nodes));
    if (spec.type === 'loop' && (spec.loopTop || spec.loopBack)) {
      out.push('', `*${[spec.loopTop, spec.loopBack].filter(Boolean).join(': ')}, then back to step 1.*`);
    }
    if (spec.type === 'branch' && spec.branch && spec.branch.length > 0) {
      out.push('', 'Outcomes:', '', ...spec.branch.map((node) => `- ${nodeText(node)}`));
    }
  }

  const text = out.join('\n').trim();
  return text === (spec.title ? `**${spec.title}**` : '') ? '' : text;
}

interface ChartSpec {
  type?: string;
  title?: string;
  caption?: string;
  unit?: string;
  tickLabel?: string;
  rows?: Array<{ label?: string; value?: number; tick?: number; series?: string }>;
  x?: Array<string | number>;
  series?: Array<{ name?: string; data?: number[]; samples?: number[] }>;
  refs?: Array<{ value?: number; label?: string }>;
}

function withUnit(value: unknown, unit?: string): string {
  return value === undefined || value === null ? '' : `${value}${unit ?? ''}`;
}

/**
 * Bar charts become a label/value table, line charts a series-by-x table, and
 * sample-based charts (dots, cdf) a summary row per series. Reference lines
 * and the caption follow as emphasised text.
 */
function chartToMarkdown(body: string): string {
  const spec = asJson<ChartSpec>(body);
  const out: string[] = [];
  if (spec.title) out.push(`**${spec.title}**`, '');
  const unit = spec.unit;

  if (spec.rows && spec.rows.length > 0) {
    const hasSeries = spec.rows.some((r) => r.series);
    const hasTick = spec.rows.some((r) => r.tick !== undefined && r.tick !== null);
    const header = ['', 'Value', ...(hasTick ? [spec.tickLabel ?? 'Tick'] : []), ...(hasSeries ? ['Series'] : [])];
    out.push(tableRow(header));
    out.push(tableRow(header.map(() => '---')));
    for (const row of spec.rows) {
      out.push(
        tableRow([
          cell(row.label),
          cell(withUnit(row.value, unit)),
          ...(hasTick ? [cell(withUnit(row.tick, unit))] : []),
          ...(hasSeries ? [cell(row.series)] : []),
        ]),
      );
    }
  } else if (spec.series && spec.series.some((s) => Array.isArray(s.samples) && s.samples.length > 0)) {
    out.push('| Series | Samples | Min | Median | p95 | Max |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const s of spec.series) {
      const samples = (s.samples ?? []).filter((v) => Number.isFinite(v));
      if (samples.length === 0) continue;
      const stats = [
        Math.min(...samples),
        median(samples),
        percentile(samples, 95),
        Math.max(...samples),
      ].map((v) => cell(withUnit(v, unit)));
      out.push(`| ${cell(s.name)} | ${samples.length} | ${stats.join(' | ')} |`);
    }
  } else if (spec.series && spec.series.length > 0) {
    // Line charts: one column per point, one row per series. Without x
    // labels the points are numbered.
    const points = Math.max(0, ...spec.series.map((s) => s.data?.length ?? 0));
    const x = spec.x && spec.x.length > 0 ? spec.x.slice(0, points) : [...Array(points).keys()].map((i) => i + 1);
    out.push(`| | ${x.map(cell).join(' | ')} |`);
    out.push(`| --- | ${x.map(() => '---').join(' | ')} |`);
    for (const s of spec.series) {
      out.push(`| ${cell(s.name)} | ${(s.data ?? []).map((v) => cell(withUnit(v, unit))).join(' | ')} |`);
    }
  }

  for (const ref of spec.refs ?? []) {
    if (ref && ref.value !== undefined) {
      out.push('', `*${ref.label ?? 'Reference'}: ${withUnit(ref.value, unit)}*`);
    }
  }

  if (spec.caption) out.push('', `*${spec.caption}*`);
  return out.join('\n').trim();
}

interface TerminalSpec {
  title?: string;
  prompt?: string;
  steps?: Array<{ cmd?: string; output?: string; comment?: string; prompt?: string }>;
}

function terminalToMarkdown(body: string): string {
  const spec = asJson<TerminalSpec>(body);
  const steps = spec.steps ?? [];
  if (steps.length === 0) return '';

  const prompt = spec.prompt || '$';
  const lines: string[] = [];
  for (const step of steps) {
    if (step.comment) lines.push(`# ${step.comment}`);
    if (step.cmd) lines.push(`${step.prompt || prompt} ${step.cmd}`);
    if (step.output) lines.push(step.output);
  }

  // A real code block rather than an animation. On another platform that is
  // arguably the more useful form, because the reader can copy it.
  return [spec.title ? `**${spec.title}**` : '', '', '```bash', ...lines, '```']
    .join('\n')
    .trim();
}

interface TabsSpec {
  title?: string;
  tabs?: Array<{ label?: string; lang?: string; code?: string }>;
}

function tabsToMarkdown(body: string): string {
  const spec = asJson<TabsSpec>(body);
  const tabs = spec.tabs ?? [];
  if (tabs.length === 0) return '';

  const out: string[] = [];
  if (spec.title) out.push(`**${spec.title}**`, '');
  for (const tab of tabs) {
    out.push(`**${tab.label ?? ''}**`, '');
    out.push('```' + (tab.lang ?? ''), tab.code ?? '', '```', '');
  }
  return out.join('\n').trim();
}

function githubToMarkdown(body: string): string {
  const raw = body.trim();
  if (!raw) return '';
  const url = raw.startsWith('http') ? raw : `https://github.com/${raw}`;
  const name = url.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  return `[${name} on GitHub](${url})`;
}

const CALLOUT_LABELS: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  important: 'Important',
  info: 'Note',
};

/**
 * `:::warning ... :::` becomes a blockquote with a bold label. Callouts do
 * survive as HTML, unlike the fences, but the markup is nested divs that
 * other platforms strip inconsistently. A blockquote renders everywhere.
 */
function convertCallouts(markdown: string): string {
  return markdown.replace(
    /^:::(note|tip|warning|important|info)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm,
    (_whole, kind: string, body: string) => {
      const label = CALLOUT_LABELS[kind] ?? kind;
      const quoted = body
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n');
      return `> **${label}**\n>\n${quoted}`;
    },
  );
}

/**
 * Converts every custom block in a post to plain markdown. Standard fences
 * (bash, yaml, hcl and the rest) are left exactly as they are.
 */
export function toPortableMarkdown(markdown: string): string {
  let out = markdown;
  out = replaceFence(out, 'diagram', diagramToMarkdown);
  out = replaceFence(out, 'chart', chartToMarkdown);
  out = replaceFence(out, 'terminal', terminalToMarkdown);
  out = replaceFence(out, 'tabs', tabsToMarkdown);
  out = replaceFence(out, 'github', githubToMarkdown);
  out = convertCallouts(out);
  // Converting a block to nothing can leave three blank lines behind.
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

/** Every fence language this module rewrites. Exported for the tests. */
export const CUSTOM_FENCES = ['diagram', 'chart', 'terminal', 'tabs', 'github'] as const;

/**
 * Cleans rendered site HTML for a feed another platform will import.
 *
 * `parseMarkdown` produces HTML for our own pages, which assumes two things
 * that are false anywhere else: that the reader is on devops-daily.com, so
 * root-relative URLs resolve, and that our CSS and JavaScript are present, so
 * interactive chrome makes sense.
 *
 * Off-site both assumptions break. A root-relative `/images/...` resolves
 * against the importing site and 404s, and the copy-link button on every
 * heading arrives as visible markup with no styles to hide it.
 */
export function toPortableHtml(html: string, siteUrl: string): string {
  let out = html;

  // Headings render as an anchor plus a copy-link button, both of which are
  // affordances for our own page. Reduce each one back to a plain heading.
  out = out.replace(
    /<h([1-6])[^>]*>\s*<a[^>]*>\s*([\s\S]*?)\s*<\/a>[\s\S]*?<\/h\1>/g,
    (_whole, level: string, text: string) => `<h${level}>${text.trim()}</h${level}>`,
  );

  // Anything left over from a heading block that did not match the shape above.
  out = out.replace(/<button[\s\S]*?<\/button>/g, '');

  // Root-relative URLs only work on our own domain. An importer resolves them
  // against itself, so the image or link silently points at the wrong site.
  const base = siteUrl.replace(/\/$/, '');
  out = out.replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${base}/`);

  return out;
}
