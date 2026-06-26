import { marked, type Tokens, type TokenizerAndRendererExtension } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import hljs, { type HLJSApi, type Language } from 'highlight.js';

// Import specific languages for better support
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import shell from 'highlight.js/lib/languages/shell';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('shell', shell);

// Custom Terraform/HCL language definition
function defineTerraform(hljs: HLJSApi) {
  const NUMBERS = {
    className: 'number',
    begin: '\\b\\d+(\\.\\d+)?',
    relevance: 0,
  };

  const STRINGS = {
    className: 'string',
    begin: '"',
    end: '"',
    contains: [
      {
        className: 'variable',
        begin: '\\${',
        end: '\\}',
        relevance: 9,
        contains: [
          {
            className: 'string',
            begin: '"',
            end: '"',
          },
          {
            className: 'meta',
            begin: '[A-Za-z_0-9]*' + '\\(',
            end: '\\)',
            contains: [
              NUMBERS,
              {
                className: 'string',
                begin: '"',
                end: '"',
                contains: [
                  {
                    className: 'variable',
                    begin: '\\${',
                    end: '\\}',
                    contains: [
                      {
                        className: 'string',
                        begin: '"',
                        end: '"',
                        contains: [
                          {
                            className: 'variable',
                            begin: '\\${',
                            end: '\\}',
                          },
                        ],
                      },
                      {
                        className: 'meta',
                        begin: '[A-Za-z_0-9]*' + '\\(',
                        end: '\\)',
                      },
                    ],
                  },
                ],
              },
              'self',
            ],
          },
        ],
      },
    ],
  };

  // `literal` predates the typed config and isn't a Language property
  // highlight.js reads; kept (behind the assertion) to leave output unchanged.
  return {
    aliases: ['tf', 'hcl'],
    keywords: 'resource variable provider output locals module data terraform|10',
    literal: 'false true null',
    contains: [hljs.COMMENT('\\#', '$'), NUMBERS, STRINGS],
  } as Language;
}

// Register Terraform with comprehensive language definition
hljs.registerLanguage('terraform', defineTerraform);
hljs.registerLanguage('hcl', defineTerraform);
hljs.registerLanguage('tf', defineTerraform);

// Configure marked with syntax highlighting
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      // Interactive fences carry JSON for their renderers; leave the text
      // untouched so the code renderer below can parse it.
      if (lang === 'chart' || lang === 'terminal' || lang === 'tabs') return code;
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
  pedantic: false,
});

// We'll handle heading IDs ourselves in the custom renderer
// marked.use(gfmHeadingId({}));

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Custom renderer: headings get anchor links, and ```chart fences become
// placeholders that ChartBlockWrapper hydrates client-side.
marked.use({
  renderer: {
    code({ text, lang }: Tokens.Code) {
      if (lang === 'chart') {
        try {
          const spec = JSON.parse(text);
          if (spec && typeof spec === 'object' && spec.type) {
            return `<div class="post-chart not-prose" data-chart="${escapeHtml(JSON.stringify(spec))}"></div>`;
          }
        } catch {
          // malformed spec: fall through to a visible code block so the
          // mistake is obvious in the rendered post instead of a blank hole
        }
        return `<pre><code class="hljs language-chart">${escapeHtml(text)}</code></pre>`;
      }
      if (lang === 'terminal') {
        try {
          const spec = JSON.parse(text);
          if (spec && typeof spec === 'object' && Array.isArray(spec.steps)) {
            return `<div class="post-terminal not-prose" data-terminal="${escapeHtml(JSON.stringify(spec))}"></div>`;
          }
        } catch {
          // fall through to a visible code block
        }
        return `<pre><code class="hljs language-terminal">${escapeHtml(text)}</code></pre>`;
      }
      if (lang === 'tabs') {
        try {
          const spec = JSON.parse(text);
          if (spec && typeof spec === 'object' && Array.isArray(spec.tabs)) {
            return `<div class="post-tabs not-prose" data-tabs="${escapeHtml(JSON.stringify(spec))}"></div>`;
          }
        } catch {
          // fall through to a visible code block
        }
        return `<pre><code class="hljs language-tabs">${escapeHtml(text)}</code></pre>`;
      }
      return false;
    },
    heading({ tokens, depth }: Tokens.Heading) {
      // Extract text from tokens
      const text = tokens
        .map((token) => ('text' in token && token.text) || token.raw || '')
        .join('');
      const headingTag = `h${depth}`;

      // Create a simple slug from the text with heading level prefix to avoid duplicates
      const baseSlug = text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

      // Add heading level prefix to ensure uniqueness (h1-, h2-, h3-, etc.)
      const slug = `h${depth}-${baseSlug}`;

      return `<${headingTag} id="${slug}" class="group relative scroll-mt-24">
        <a href="#${slug}" class="no-underline text-inherit hover:text-inherit focus:outline-none focus:ring-0 focus:ring-offset-0">
          ${text}
        </a>
        <button 
          class="copy-heading-link absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-md hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-muted-foreground hover:text-foreground"
          aria-label="Copy link to section"
          data-heading-id="${slug}"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        </${headingTag}>`;
    },
  },
});

// Callout / admonition blocks:  :::note  ...  :::  (also tip, warning, important)
// Inner content is parsed as markdown so links, lists, and code still work.
const CALLOUT_VARIANTS: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  important: 'Important',
  info: 'Note',
};

const calloutExtension: TokenizerAndRendererExtension = {
  name: 'callout',
  level: 'block',
  start(src) {
    const m = src.match(/^:::(?:note|tip|warning|important|info)\b/m);
    return m ? m.index : undefined;
  },
  tokenizer(src) {
    const rule =
      /^:::(note|tip|warning|important|info)[ \t]*(?:\n)([\s\S]*?)\n:::[ \t]*(?:\n+|$)/;
    const match = rule.exec(src);
    if (!match) return undefined;
    const tokens: Tokens.Generic[] = [];
    this.lexer.blockTokens(match[2], tokens);
    return {
      type: 'callout',
      raw: match[0],
      variant: match[1],
      tokens,
    };
  },
  renderer(token) {
    const variant = (token as Tokens.Generic).variant as string;
    const inner = this.parser.parse((token as Tokens.Generic).tokens ?? []);
    const label = CALLOUT_VARIANTS[variant] ?? 'Note';
    return `<div class="post-callout post-callout--${variant}"><div class="post-callout__label">${label}</div><div class="post-callout__body">${inner}</div></div>`;
  },
};

marked.use({ extensions: [calloutExtension] });

export function parseMarkdown(content: string): string {
  const result = marked.parse(content);
  return typeof result === 'string' ? result : '';
}
