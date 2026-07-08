/**
 * Spec for the ```diagram interactive fence, mirroring the ```chart / ```terminal
 * / ```tabs systems. The body is JSON describing a clean, optionally animated
 * diagram: linear flows, loops, branches, infrastructure groups, or a small
 * node/edge graph.
 *
 * Parse failures fall back to a normal code block in the markdown renderer, so a
 * typo never breaks a post build.
 */

export type DiagramTone =
  | 'slate'
  | 'blue'
  | 'green'
  | 'violet'
  | 'red'
  | 'amber'
  | 'accent';

export type DiagramVariant = 'soft' | 'solid' | 'accent' | 'good' | 'bad' | 'line';

/** Health status shown as a small dot on the node. */
export type DiagramStatus = 'ok' | 'warn' | 'down';

export interface DiagramNode {
  id?: string;
  label: string;
  sub?: string;
  icon?: string;
  tone?: DiagramTone;
  variant?: DiagramVariant;
  /** Small status dot (ok = green, warn = amber, down = red). */
  status?: DiagramStatus;
  /** Extra text revealed when the node is hovered or tapped (graph mode). */
  detail?: string;
}

export interface DiagramGroup {
  label: string;
  sub?: string;
  icon?: string;
  tone?: DiagramTone;
  nodes?: DiagramNode[];
  groups?: DiagramGroup[];
}

/** A directed edge: [fromId, toId] with an optional short label (port, verb). */
export type DiagramEdge = [string, string, string?];

export type DiagramType = 'flow' | 'loop' | 'branch' | 'infra' | 'graph';

export interface DiagramSpec {
  type: DiagramType;
  title?: string;
  /** loop: a mono goal bar above the diagram. */
  goal?: string;
  /** loop: label over / under the loop-back arc. */
  loopTop?: string;
  loopBack?: string;
  /** flow / loop / branch: the row of nodes. */
  nodes?: DiagramNode[];
  /** branch: the outcome nodes shown below the row. */
  branch?: DiagramNode[];
  /** infra: nested host / cluster boxes. */
  groups?: DiagramGroup[];
  /** infra: an optional request path shown above the groups. */
  flow?: DiagramNode[];
  /** graph: columns of nodes (each node needs an id). */
  columns?: DiagramNode[][];
  /** graph: directed edges as [fromId, toId] or [fromId, toId, label]. */
  edges?: DiagramEdge[];
  /** flow / graph: show the Trace button and packet animation (default true). */
  trace?: boolean;
}

const TONES: DiagramTone[] = ['slate', 'blue', 'green', 'violet', 'red', 'amber', 'accent'];
const VARIANTS: DiagramVariant[] = ['soft', 'solid', 'accent', 'good', 'bad', 'line'];
const STATUSES: DiagramStatus[] = ['ok', 'warn', 'down'];

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function node(v: unknown): DiagramNode | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.label !== 'string') return null;
  const tone = TONES.includes(o.tone as DiagramTone) ? (o.tone as DiagramTone) : undefined;
  const variant = VARIANTS.includes(o.variant as DiagramVariant)
    ? (o.variant as DiagramVariant)
    : undefined;
  return {
    id: str(o.id),
    label: o.label,
    sub: str(o.sub),
    icon: str(o.icon),
    tone,
    variant,
    status: STATUSES.includes(o.status as DiagramStatus) ? (o.status as DiagramStatus) : undefined,
    detail: str(o.detail),
  };
}

function nodes(v: unknown): DiagramNode[] {
  if (!Array.isArray(v)) return [];
  return v.map(node).filter((n): n is DiagramNode => n !== null);
}

function group(v: unknown): DiagramGroup | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.label !== 'string') return null;
  const g: DiagramGroup = {
    label: o.label,
    sub: str(o.sub),
    icon: str(o.icon),
    tone: TONES.includes(o.tone as DiagramTone) ? (o.tone as DiagramTone) : undefined,
  };
  if (Array.isArray(o.groups)) {
    g.groups = o.groups.map(group).filter((x): x is DiagramGroup => x !== null);
  } else {
    g.nodes = nodes(o.nodes);
  }
  return g;
}

function edges(v: unknown): DiagramEdge[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (e): e is unknown[] =>
        Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string'
    )
    .map((e) =>
      (typeof e[2] === 'string' ? [e[0], e[1], e[2]] : [e[0], e[1]]) as DiagramEdge
    );
}

export function parseDiagramSpec(raw: string): DiagramSpec | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const type = o.type as DiagramType;
  if (!['flow', 'loop', 'branch', 'infra', 'graph'].includes(type)) return null;

  const spec: DiagramSpec = {
    type,
    title: str(o.title),
    trace: o.trace !== false,
  };

  if (type === 'graph') {
    if (!Array.isArray(o.columns)) return null;
    const columns = o.columns.map(nodes).filter((c) => c.length > 0);
    if (columns.length === 0) return null;
    spec.columns = columns;
    spec.edges = edges(o.edges);
    return spec;
  }

  if (type === 'infra') {
    if (!Array.isArray(o.groups)) return null;
    const groups = o.groups.map(group).filter((g): g is DiagramGroup => g !== null);
    if (groups.length === 0) return null;
    spec.groups = groups;
    if (Array.isArray(o.flow)) spec.flow = nodes(o.flow);
    return spec;
  }

  // flow / loop / branch all need a nodes row
  const row = nodes(o.nodes);
  if (row.length === 0) return null;
  spec.nodes = row;
  if (type === 'loop') {
    spec.goal = str(o.goal);
    spec.loopTop = str(o.loopTop);
    spec.loopBack = str(o.loopBack);
  }
  if (type === 'branch') {
    spec.branch = nodes(o.branch);
  }
  return spec;
}
