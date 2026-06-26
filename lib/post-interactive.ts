/**
 * Specs for interactive blocks embedded in post markdown via fenced code
 * blocks whose body is JSON, mirroring the ```chart system in post-charts.ts.
 *
 *   ```terminal  -> animated terminal replay (TerminalSpec)
 *   ```tabs      -> tabbed code / content     (TabsSpec)
 *
 * Parse failures fall back to a normal code block in the markdown renderer,
 * so a typo never breaks a post build.
 */

/* ----------------------------- terminal ----------------------------- */

export interface TerminalStep {
  /** Command line, rendered after the prompt with a typing animation. */
  cmd?: string;
  /** Output produced by the command, revealed after the command types. */
  output?: string;
  /** Standalone comment line (rendered dimmed, no prompt). */
  comment?: string;
  /** Override the prompt for this step (defaults to the spec prompt). */
  prompt?: string;
}

export interface TerminalSpec {
  /** Optional window title shown in the title bar. */
  title?: string;
  /** Prompt prefix for command lines. Defaults to "$". */
  prompt?: string;
  /** Whether the replay autoplays on first view. Defaults to true. */
  autoplay?: boolean;
  steps: TerminalStep[];
}

export function parseTerminalSpec(raw: string): TerminalSpec | null {
  try {
    const spec = JSON.parse(raw);
    if (
      !spec ||
      typeof spec !== 'object' ||
      !Array.isArray(spec.steps) ||
      spec.steps.length === 0
    ) {
      return null;
    }
    const steps: TerminalStep[] = spec.steps
      .filter((s: unknown) => s && typeof s === 'object')
      .map((s: Record<string, unknown>) => ({
        cmd: typeof s.cmd === 'string' ? s.cmd : undefined,
        output: typeof s.output === 'string' ? s.output : undefined,
        comment: typeof s.comment === 'string' ? s.comment : undefined,
        prompt: typeof s.prompt === 'string' ? s.prompt : undefined,
      }))
      .filter((s: TerminalStep) => s.cmd || s.output || s.comment);
    if (steps.length === 0) return null;
    return {
      title: typeof spec.title === 'string' ? spec.title : undefined,
      prompt: typeof spec.prompt === 'string' ? spec.prompt : '$',
      autoplay: spec.autoplay !== false,
      steps,
    };
  } catch {
    return null;
  }
}

/* ------------------------------- tabs ------------------------------- */

export interface TabItem {
  /** Tab button label. */
  label: string;
  /** Language hint used as a caption and for the monospace block. */
  lang?: string;
  /** Code or text content for the tab. */
  code: string;
}

export interface TabsSpec {
  /** Optional heading above the tab strip. */
  title?: string;
  tabs: TabItem[];
}

export function parseTabsSpec(raw: string): TabsSpec | null {
  try {
    const spec = JSON.parse(raw);
    if (
      !spec ||
      typeof spec !== 'object' ||
      !Array.isArray(spec.tabs) ||
      spec.tabs.length === 0
    ) {
      return null;
    }
    const tabs: TabItem[] = spec.tabs
      .filter(
        (t: unknown) =>
          t &&
          typeof t === 'object' &&
          typeof (t as Record<string, unknown>).label === 'string' &&
          typeof (t as Record<string, unknown>).code === 'string'
      )
      .map((t: Record<string, unknown>) => ({
        label: t.label as string,
        lang: typeof t.lang === 'string' ? (t.lang as string) : undefined,
        code: t.code as string,
      }));
    if (tabs.length === 0) return null;
    return {
      title: typeof spec.title === 'string' ? spec.title : undefined,
      tabs,
    };
  } catch {
    return null;
  }
}
