/**
 * A small YAML reader built to show one thing: what the parser decides your
 * value is, which is rarely what you typed.
 *
 * It is not a complete YAML implementation and does not try to be. It covers
 * block mappings, block sequences, inline flow collections, quoting and block
 * scalars, because those are what a CI file or a Kubernetes manifest is made
 * of, and it resolves untagged scalars under both YAML 1.1 and YAML 1.2.
 *
 * The two specs disagree, and that disagreement is the entire reason for the
 * famous surprises. YAML 1.1 treats `no`, `off` and `y` as booleans. YAML 1.2
 * only accepts `true` and `false`. Which one you get depends on your parser,
 * not on your file, so the same document means different things in different
 * tools. This engine shows both at once rather than picking a side.
 */

export type Spec = "1.1" | "1.2";

export type Scalar =
  | { kind: "string"; value: string }
  | { kind: "int"; value: number }
  | { kind: "float"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "null"; value: null };

export type Node = Scalar | { kind: "map"; entries: Array<[string, Node]> } | { kind: "seq"; items: Node[] };

export interface ParseOk {
  ok: true;
  root: Node;
  /** Every scalar that resolved to something other than a string, for the type panel. */
  coercions: Coercion[];
  /** Keys that appeared more than once. The last one won. */
  duplicates: string[];
  /** True when the document used anchors, aliases or a merge key. */
  usedAnchors: boolean;
  /** How many documents the file contained. Only the first is shown. */
  documents: number;
}
export interface ParseErr {
  ok: false;
  line: number;
  message: string;
  hint?: string;
}
export type ParseResult = ParseOk | ParseErr;

export interface Coercion {
  path: string;
  raw: string;
  kind: Scalar["kind"];
  value: string;
}

/* ------------------------------------------------------------------ scalars */

const NULLS_12 = new Set(["null", "Null", "NULL", "~", ""]);
const TRUE_12 = new Set(["true", "True", "TRUE"]);
const FALSE_12 = new Set(["false", "False", "FALSE"]);

// YAML 1.1 casts a much wider net, and this set is why `country: NO` is false.
const TRUE_11 = new Set(["y", "Y", "yes", "Yes", "YES", "true", "True", "TRUE", "on", "On", "ON"]);
const FALSE_11 = new Set(["n", "N", "no", "No", "NO", "false", "False", "FALSE", "off", "Off", "OFF"]);

// YAML 1.2's core schema accepts a leading zero as a plain decimal, so `0755`
// is the integer 755 there and the octal 493 under 1.1. A file mode written
// without quotes therefore means two different numbers depending on the parser.
const INT_12 = /^[-+]?[0-9]+$/;
const INT_HEX = /^[-+]?0x[0-9a-fA-F]+$/;
const INT_OCT_11 = /^[-+]?0[0-7]+$/; // 1.1 only: 08 is not this, and is not an int either
const INT_OCT_12 = /^[-+]?0o[0-7]+$/;
const FLOAT = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/;

/** Resolve an unquoted scalar the way the given spec would. */
export function resolveScalar(raw: string, spec: Spec): Scalar {
  const t = raw.trim();

  if (spec === "1.1") {
    if (t === "" || t === "~" || NULLS_12.has(t)) return { kind: "null", value: null };
    if (TRUE_11.has(t)) return { kind: "bool", value: true };
    if (FALSE_11.has(t)) return { kind: "bool", value: false };
    if (INT_OCT_11.test(t)) return { kind: "int", value: parseInt(t.replace("+", ""), 8) };
  } else {
    if (NULLS_12.has(t)) return { kind: "null", value: null };
    if (TRUE_12.has(t)) return { kind: "bool", value: true };
    if (FALSE_12.has(t)) return { kind: "bool", value: false };
    if (INT_OCT_12.test(t)) return { kind: "int", value: parseInt(t.replace(/0o/, ""), 8) };
  }

  if (INT_HEX.test(t)) return { kind: "int", value: parseInt(t, 16) };
  if (INT_12.test(t)) return { kind: "int", value: parseInt(t, 10) };
  // A trailing zero is where `version: 1.10` quietly becomes 1.1.
  if (FLOAT.test(t)) return { kind: "float", value: parseFloat(t) };

  return { kind: "string", value: t };
}

/* ------------------------------------------------------------------- lexing */

interface Line {
  n: number;
  indent: number;
  text: string;
  raw: string;
}

function lex(src: string): { lines: Line[]; tabError?: ParseErr; documents: number; anchors: boolean } {
  const out: Line[] = [];
  const rawLines = src.replace(/\r\n/g, "\n").split("\n");
  let documents = 0;
  let anchors = false;
  let pastFirstDoc = false;
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const withoutComment = stripComment(raw);
    if (withoutComment.trim() === "") continue;

    // A file can hold several documents. Kubernetes manifests routinely do.
    // Only the first is shown, and the count is reported so the UI can say so.
    const t = withoutComment.trim();
    if (t === "---" || t.startsWith("--- ")) {
      documents++;
      if (documents > 1) pastFirstDoc = true;
      continue;
    }
    if (t === "...") { pastFirstDoc = true; continue; }
    if (pastFirstDoc) continue;
    if (/(^|\s)[&*][A-Za-z0-9_-]+/.test(t) || t.startsWith("<<:")) anchors = true;

    const lead = withoutComment.match(/^[ \t]*/)?.[0] ?? "";
    if (lead.includes("\t")) {
      return {
        lines: [],
        tabError: {
          ok: false,
          line: i + 1,
          message: "A tab is used for indentation.",
          hint: "YAML forbids tabs in indentation. Editors show them the same width as spaces, which is why this is so hard to see. Replace the tab with spaces.",
        },
        documents: 0,
        anchors: false,
      };
    }
    out.push({ n: i + 1, indent: lead.length, text: withoutComment.trim(), raw });
  }
  return { lines: out, documents: Math.max(documents, out.length ? 1 : 0), anchors };
}

/** Remove a trailing comment, but not a `#` inside quotes. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote && line[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/* ------------------------------------------------------------------ parsing */

export function parseYaml(src: string, spec: Spec): ParseResult {
  const { lines, tabError, documents, anchors: usedAnchors } = lex(src);
  if (tabError) return tabError;
  if (lines.length === 0)
    return { ok: true, root: { kind: "null", value: null }, coercions: [], duplicates: [], usedAnchors: false, documents: 0 };

  const coercions: Coercion[] = [];
  const duplicates: string[] = [];
  const anchorStore = new Map<string, Node>();
  let i = 0;

  function parseBlock(indent: number, path: string): Node | ParseErr {
    if (i >= lines.length) return { kind: "null", value: null };

    if (lines[i].text.startsWith("- ") || lines[i].text === "-") {
      const items: Node[] = [];
      while (i < lines.length && lines[i].indent === indent && (lines[i].text.startsWith("- ") || lines[i].text === "-")) {
        const line = lines[i];
        const rest = line.text === "-" ? "" : line.text.slice(2).trim();
        const childPath = `${path}[${items.length}]`;
        i++;
        if (rest === "") {
          const child = parseBlock(nextIndent(indent), childPath);
          if (isErr(child)) return child;
          items.push(child);
        } else if (/^[^\s:]+:( |$)/.test(rest) || /^["'][^"']*["']:( |$)/.test(rest)) {
          // "- key: value" starts a mapping whose first key sits on the dash line
          const nested = parseInlineMapStart(rest, line, indent + 2, childPath);
          if (isErr(nested)) return nested;
          items.push(nested);
        } else {
          const flowItem = parseFlow(rest, childPath, coercions, spec);
          items.push(flowItem ?? scalarFrom(rest, childPath, coercions, spec));
        }
      }
      return { kind: "seq", items };
    }

    const entries: Array<[string, Node]> = [];
    while (i < lines.length && lines[i].indent === indent) {
      const line = lines[i];
      const m = line.text.match(/^(.+?):(?:\s+(.*))?$/);
      if (!m) {
        return {
          ok: false,
          line: line.n,
          message: `Expected "key: value" here.`,
          hint: "A mapping entry needs a colon followed by a space. `key:value` without the space is read as one plain string.",
        };
      }
      const key = unquote(m[1].trim());
      const inline = (m[2] ?? "").trim();
      const childPath = path ? `${path}.${key}` : key;
      i++;

      const already = entries.findIndex(([k]) => k === key);
      if (already !== -1) duplicates.push(key);

      // `key: &name` anchors the block that follows. `key: *name` is an alias
      // to it, and `<<: *name` merges that block's keys into this one. CI files
      // lean on all three, so a parser that rejects them is useless on real input.
      const anchorOnly = inline.match(/^&([A-Za-z0-9_-]+)$/);
      const aliasOnly = inline.match(/^\*([A-Za-z0-9_-]+)$/);

      if (key === "<<" && aliasOnly) {
        const target = anchorStore.get(aliasOnly[1]);
        if (target && target.kind === "map") {
          // A merge key does not overwrite what the mapping already has.
          for (const [k, v] of target.entries) if (!entries.some(([e]) => e === k)) entries.push([k, v]);
        }
        continue;
      }
      if (aliasOnly) {
        const target = anchorStore.get(aliasOnly[1]);
        push(entries, key, target ?? { kind: "null", value: null });
        continue;
      }
      if (anchorOnly) {
        if (i < lines.length && lines[i].indent > indent) {
          const child = parseBlock(lines[i].indent, childPath);
          if (isErr(child)) return child;
          anchorStore.set(anchorOnly[1], child);
          push(entries, key, child);
        } else {
          push(entries, key, { kind: "null", value: null });
        }
        continue;
      }

      if (inline === "" ) {
        if (i < lines.length && lines[i].indent > indent) {
          const child = parseBlock(lines[i].indent, childPath);
          if (isErr(child)) return child;
          push(entries, key, child);
        } else {
          push(entries, key, { kind: "null", value: null });
          coercions.push({ path: childPath, raw: "(nothing)", kind: "null", value: "null" });
        }
      } else if (inline === "|" || inline === ">" || /^[|>][-+]?$/.test(inline)) {
        const block = readBlockScalar(inline, indent);
        push(entries, key, { kind: "string", value: block });
      } else {
        let value = inline;
        // A plain scalar may continue on following, more-indented lines. YAML
        // folds them into one line with single spaces.
        while (
          i < lines.length &&
          lines[i].indent > indent &&
          !/^(-\s|- $)/.test(lines[i].text) &&
          !/^.+?:(\s|$)/.test(lines[i].text)
        ) {
          value += " " + lines[i].text;
          i++;
        }
        const flow = parseFlow(value, childPath, coercions, spec);
        push(entries, key, flow ?? scalarFrom(value, childPath, coercions, spec));
      }
    }
    return { kind: "map", entries };
  }

  function parseInlineMapStart(rest: string, line: Line, childIndent: number, path: string): Node | ParseErr {
    const m = rest.match(/^(.+?):(?:\s+(.*))?$/);
    if (!m) return { ok: false, line: line.n, message: "Expected a key after the dash." };
    const key = unquote(m[1].trim());
    const inline = (m[2] ?? "").trim();
    const entries: Array<[string, Node]> = [];
    const p = path ? `${path}.${key}` : key;
    entries.push([key, inline === "" ? { kind: "null", value: null } : scalarFrom(inline, p, coercions, spec)]);
    while (i < lines.length && lines[i].indent === childIndent) {
      const l = lines[i];
      const mm = l.text.match(/^(.+?):(?:\s+(.*))?$/);
      if (!mm) break;
      const k = unquote(mm[1].trim());
      const v = (mm[2] ?? "").trim();
      i++;
      entries.push([k, v === "" ? { kind: "null", value: null } : scalarFrom(v, `${path}.${k}`, coercions, spec)]);
    }
    return { kind: "map", entries };
  }

  function readBlockScalar(header: string, parentIndent: number): string {
    const fold = header.startsWith(">");
    const chomp = header.includes("-") ? "strip" : header.includes("+") ? "keep" : "clip";
    const parts: string[] = [];
    while (i < lines.length && lines[i].indent > parentIndent) {
      parts.push(lines[i].text);
      i++;
    }
    let body = fold ? parts.join(" ") : parts.join("\n");
    if (chomp === "clip") body += "\n";
    if (chomp === "keep") body += "\n";
    return body;
  }

  function nextIndent(current: number): number {
    return i < lines.length ? lines[i].indent : current + 2;
  }

  const root = parseBlock(lines[0].indent, "");
  if (isErr(root)) return root;
  if (i < lines.length) {
    return {
      ok: false,
      line: lines[i].n,
      message: "This line is indented less than the block it belongs to.",
      hint: "Every entry in the same mapping or list has to start in the same column.",
    };
  }
  return { ok: true, root, coercions, duplicates, usedAnchors, documents };
}

/**
 * A repeated key overwrites the earlier one. The YAML spec calls duplicates an
 * error, but most parsers in use quietly keep the last, which is why a
 * copy-pasted block can silently replace a setting fifty lines above it.
 */
function push(entries: Array<[string, Node]>, key: string, value: Node): void {
  const at = entries.findIndex(([k]) => k === key);
  if (at === -1) entries.push([key, value]);
  else entries[at] = [key, value];
}

function isErr(n: Node | ParseErr): n is ParseErr {
  return (n as ParseErr).ok === false;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

function unescapeDouble(s: string): string {
  return s.replace(/\\(n|t|r|0|\\|"|\/)/g, (_m, c) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c === "0" ? "\0" : c,
  );
}

/** Parse a flow collection: [a, b] or {k: v}. Nesting is supported. */
function parseFlow(src: string, path: string, coercions: Coercion[], spec: Spec): Node | null {
  const t = src.trim();
  if (!((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}")))) return null;
  const inner = t.slice(1, -1).trim();
  const isSeq = t.startsWith("[");
  if (inner === "") return isSeq ? { kind: "seq", items: [] } : { kind: "map", entries: [] };

  const parts = splitFlow(inner);
  if (isSeq) {
    return {
      kind: "seq",
      items: parts.map((part, i) => {
        const nested = parseFlow(part, `${path}[${i}]`, coercions, spec);
        return nested ?? scalarFrom(part.trim(), `${path}[${i}]`, coercions, spec);
      }),
    };
  }
  const entries: Array<[string, Node]> = [];
  for (const part of parts) {
    const at = splitFlowKey(part);
    if (!at) continue;
    const k = stripQuotes(at[0].trim());
    const vRaw = at[1].trim();
    const p = path ? `${path}.${k}` : k;
    const nested = parseFlow(vRaw, p, coercions, spec);
    entries.push([k, nested ?? scalarFrom(vRaw, p, coercions, spec)]);
  }
  return { kind: "map", entries };
}

/** Split on commas that are not inside a nested collection or a quoted string. */
function splitFlow(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.filter((p) => p.trim() !== "");
}

/** Split "k: v" at the first colon that is not nested or quoted. */
function splitFlowKey(s: string): [string, string] | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === ":" && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
  }
  return null;
}

function scalarFrom(raw: string, path: string, coercions: Coercion[], spec: Spec): Scalar {
  // Quoting is the escape hatch: a quoted scalar is always a string, whatever
  // it looks like. This is the fix for every surprise this engine demonstrates.
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length > 1) {
    // Double quotes are the only form that processes escapes.
    return { kind: "string", value: unescapeDouble(raw.slice(1, -1)) };
  }
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length > 1) {
    // Single quotes are literal; the only escape is '' for one quote.
    return { kind: "string", value: raw.slice(1, -1).replace(/''/g, "'") };
  }
  // An explicit tag overrides resolution, which is the other way to stop
  // `8080` becoming a number.
  const tag = raw.match(/^!!(str|int|float|bool|null)\s+([\s\S]*)$/);
  if (tag) {
    const rest = tag[2].trim();
    switch (tag[1]) {
      case "str":
        return { kind: "string", value: stripQuotes(rest) };
      case "int":
        return { kind: "int", value: parseInt(rest, 10) };
      case "float":
        return { kind: "float", value: parseFloat(rest) };
      case "bool":
        return { kind: "bool", value: /^(true|yes|on|y)$/i.test(rest) };
      default:
        return { kind: "null", value: null };
    }
  }
  const s = resolveScalar(raw, spec);
  if (s.kind !== "string") {
    coercions.push({ path, raw, kind: s.kind, value: String(s.value) });
  }
  return s;
}

/* ----------------------------------------------------------------- printing */

/** Render a parsed document as JSON-ish text, so the types are visible. */
export function render(node: Node, indent = 0): string {
  const pad = " ".repeat(indent);
  if (node.kind === "map") {
    if (node.entries.length === 0) return "{}";
    return node.entries
      .map(([k, v]) =>
        v.kind === "map" || v.kind === "seq"
          ? `${pad}${k}:\n${render(v, indent + 2)}`
          : `${pad}${k}: ${renderScalar(v)}`,
      )
      .join("\n");
  }
  if (node.kind === "seq") {
    if (node.items.length === 0) return "[]";
    return node.items
      .map((v) =>
        v.kind === "map" || v.kind === "seq"
          ? `${pad}-\n${render(v, indent + 2)}`
          : `${pad}- ${renderScalar(v)}`,
      )
      .join("\n");
  }
  return `${pad}${renderScalar(node)}`;
}

function renderScalar(s: Scalar): string {
  switch (s.kind) {
    case "string":
      return JSON.stringify(s.value);
    case "null":
      return "null";
    case "bool":
      return String(s.value);
    default:
      return String(s.value);
  }
}

/** Where the two specs disagree about the same document. */
export function specDisagreements(src: string): Array<{ path: string; raw: string; as11: string; as12: string }> {
  const a = parseYaml(src, "1.1");
  const b = parseYaml(src, "1.2");
  if (!a.ok || !b.ok) return [];
  const m11 = new Map(a.coercions.map((c) => [c.path, c]));
  const out: Array<{ path: string; raw: string; as11: string; as12: string }> = [];
  const paths = new Set([...a.coercions.map((c) => c.path), ...b.coercions.map((c) => c.path)]);
  const m12 = new Map(b.coercions.map((c) => [c.path, c]));
  for (const p of paths) {
    const x = m11.get(p);
    const y = m12.get(p);
    const as11 = x ? `${x.kind} ${x.value}` : "string";
    const as12 = y ? `${y.kind} ${y.value}` : "string";
    if (as11 !== as12) out.push({ path: p, raw: (x ?? y)!.raw, as11, as12 });
  }
  return out;
}
