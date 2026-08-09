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

interface DiagramSpec {
  title?: string;
  nodes?: Array<{ label?: string; sub?: string }>;
  groups?: Array<{ label?: string; nodes?: Array<{ label?: string; sub?: string }> }>;
}

function diagramToMarkdown(body: string): string {
  const spec = asJson<DiagramSpec>(body);
  const nodes = spec.nodes ?? (spec.groups ?? []).flatMap((g) => g.nodes ?? []);
  if (nodes.length === 0) return '';

  const lines = nodes.map((node, i) => {
    const label = node.label ?? '';
    return node.sub ? `${i + 1}. **${label}** ${node.sub}` : `${i + 1}. **${label}**`;
  });
  return [spec.title ? `**${spec.title}**` : '', '', ...lines].join('\n').trim();
}

interface ChartSpec {
  title?: string;
  caption?: string;
  unit?: string;
  rows?: Array<{ label?: string; value?: number; series?: string }>;
  x?: string[];
  series?: Array<{ name?: string; data?: number[]; samples?: number[] }>;
}

function chartToMarkdown(body: string): string {
  const spec = asJson<ChartSpec>(body);
  const out: string[] = [];
  if (spec.title) out.push(`**${spec.title}**`, '');

  if (spec.rows && spec.rows.length > 0) {
    const hasSeries = spec.rows.some((r) => r.series);
    out.push(hasSeries ? '| | Value | Series |' : '| | Value |');
    out.push(hasSeries ? '| --- | --- | --- |' : '| --- | --- |');
    for (const row of spec.rows) {
      const value = `${row.value ?? ''}${spec.unit ?? ''}`;
      out.push(
        hasSeries
          ? `| ${cell(row.label)} | ${cell(value)} | ${cell(row.series)} |`
          : `| ${cell(row.label)} | ${cell(value)} |`,
      );
    }
  } else if (spec.x && spec.series) {
    // Line charts: one column per point, one row per series.
    out.push(`| | ${spec.x.map(cell).join(' | ')} |`);
    out.push(`| --- | ${spec.x.map(() => '---').join(' | ')} |`);
    for (const s of spec.series) {
      out.push(`| ${cell(s.name)} | ${(s.data ?? []).map(cell).join(' | ')} |`);
    }
  }

  if (spec.caption) out.push('', `*${spec.caption}*`);
  return out.join('\n').trim();
}

interface TerminalSpec {
  title?: string;
  prompt?: string;
  steps?: Array<{ cmd?: string; output?: string; comment?: string }>;
}

function terminalToMarkdown(body: string): string {
  const spec = asJson<TerminalSpec>(body);
  const steps = spec.steps ?? [];
  if (steps.length === 0) return '';

  const prompt = spec.prompt || '$';
  const lines: string[] = [];
  for (const step of steps) {
    if (step.comment) lines.push(`# ${step.comment}`);
    if (step.cmd) lines.push(`${prompt} ${step.cmd}`);
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
};

/**
 * `:::warning ... :::` becomes a blockquote with a bold label. Callouts do
 * survive as HTML, unlike the fences, but the markup is nested divs that
 * other platforms strip inconsistently. A blockquote renders everywhere.
 */
function convertCallouts(markdown: string): string {
  return markdown.replace(
    /^:::(note|tip|warning|important)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm,
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
