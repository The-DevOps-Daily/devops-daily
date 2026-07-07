/**
 * MongoDB Terminal Simulator engine.
 *
 * A small, dependency-free evaluator for a subset of the mongo shell, used by
 * the MongoDB Terminal Simulator game. It runs entirely in the browser against
 * the in-memory dataset below, which mirrors the SQL simulator's e-commerce
 * data as documents so the two sims teach the same data two ways.
 *
 * Supported:
 *  - db.coll.find(filter, projection).sort().skip().limit().count()
 *  - db.coll.findOne(filter, projection)
 *  - db.coll.countDocuments(filter) / db.coll.find(filter).count()
 *  - db.coll.insertOne / insertMany / updateOne / updateMany / deleteOne /
 *    deleteMany (non-persisting; returns the shell acknowledgement)
 *  - db.coll.aggregate([ $match, $group, $sort, $skip, $limit, $project, $count ])
 *
 * Query operators: implicit equality, $eq, $ne, $gt, $gte, $lt, $lte, $in,
 * $nin, $exists, $regex, plus $and / $or / $nor. Dot-notation field paths work.
 *
 * The module is pure (no React) so it can be unit tested with plain Node.
 */

export type Doc = Record<string, unknown>;

export type RunResult =
  | { kind: 'docs'; docs: Doc[] }
  | { kind: 'value'; value: number }
  | { kind: 'ack'; text: string }
  | { kind: 'error'; error: string };

interface CollectionDef {
  name: string;
  fields: { name: string; type: string }[];
  docs: Doc[];
}

// --------------------------------------------------------------------------
// Dataset (mirrors the SQL simulator's tables, modelled as documents).
// --------------------------------------------------------------------------

const customersDocs: Doc[] = [
  { _id: 1, name: 'Alice Johnson', country: 'USA', signupDate: '2025-01-15' },
  { _id: 2, name: 'Bob Smith', country: 'UK', signupDate: '2025-02-03' },
  { _id: 3, name: 'Carol White', country: 'USA', signupDate: '2025-02-20' },
  { _id: 4, name: 'David Brown', country: 'Canada', signupDate: '2025-03-11' },
  { _id: 5, name: 'Emma Davis', country: 'UK', signupDate: '2025-04-02' },
  { _id: 6, name: 'Frank Miller', country: 'Germany', signupDate: '2025-05-19' },
  { _id: 7, name: 'Grace Lee', country: 'USA', signupDate: '2025-06-08' },
  { _id: 8, name: 'Henry Wilson', country: 'Canada', signupDate: '2025-07-21' },
];

const productsDocs: Doc[] = [
  { _id: 1, name: 'Keyboard', category: 'Electronics', price: 49.99 },
  { _id: 2, name: 'Mouse', category: 'Electronics', price: 24.99 },
  { _id: 3, name: 'Monitor', category: 'Electronics', price: 199.99 },
  { _id: 4, name: 'Desk Chair', category: 'Furniture', price: 149.99 },
  { _id: 5, name: 'Standing Desk', category: 'Furniture', price: 399.99 },
  { _id: 6, name: 'Notebook', category: 'Stationery', price: 4.99 },
  { _id: 7, name: 'Pen Set', category: 'Stationery', price: 12.99 },
  { _id: 8, name: 'USB-C Cable', category: 'Electronics', price: 9.99 },
  { _id: 9, name: 'Webcam', category: 'Electronics', price: 79.99 },
  { _id: 10, name: 'Desk Lamp', category: 'Furniture', price: 34.99 },
];

// Orders embed their line items, the natural document-model version of the
// SQL order_items join table.
const ordersDocs: Doc[] = [
  { _id: 1001, customerId: 1, date: '2025-03-01', status: 'delivered', items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }, { productId: 8, quantity: 2 }] },
  { _id: 1002, customerId: 2, date: '2025-03-05', status: 'delivered', items: [{ productId: 3, quantity: 1 }, { productId: 9, quantity: 1 }] },
  { _id: 1003, customerId: 1, date: '2025-04-10', status: 'shipped', items: [{ productId: 4, quantity: 1 }, { productId: 10, quantity: 2 }] },
  { _id: 1004, customerId: 3, date: '2025-04-15', status: 'delivered', items: [{ productId: 6, quantity: 5 }, { productId: 7, quantity: 3 }] },
  { _id: 1005, customerId: 4, date: '2025-05-02', status: 'cancelled', items: [{ productId: 5, quantity: 1 }] },
  { _id: 1006, customerId: 5, date: '2025-05-20', status: 'shipped', items: [{ productId: 3, quantity: 2 }] },
  { _id: 1007, customerId: 1, date: '2025-06-01', status: 'pending', items: [{ productId: 2, quantity: 1 }, { productId: 8, quantity: 1 }] },
  { _id: 1008, customerId: 6, date: '2025-06-11', status: 'delivered', items: [{ productId: 1, quantity: 1 }, { productId: 9, quantity: 1 }, { productId: 10, quantity: 1 }] },
  { _id: 1009, customerId: 7, date: '2025-06-25', status: 'shipped', items: [{ productId: 5, quantity: 1 }] },
  { _id: 1010, customerId: 3, date: '2025-07-03', status: 'pending', items: [{ productId: 6, quantity: 10 }] },
  { _id: 1011, customerId: 8, date: '2025-07-15', status: 'delivered', items: [{ productId: 3, quantity: 1 }] },
  { _id: 1012, customerId: 2, date: '2025-07-28', status: 'cancelled', items: [{ productId: 4, quantity: 2 }] },
];

const COLLECTION_MAP: Record<string, CollectionDef> = {
  customers: {
    name: 'customers',
    fields: [
      { name: '_id', type: 'int' },
      { name: 'name', type: 'string' },
      { name: 'country', type: 'string' },
      { name: 'signupDate', type: 'string' },
    ],
    docs: customersDocs,
  },
  products: {
    name: 'products',
    fields: [
      { name: '_id', type: 'int' },
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'price', type: 'double' },
    ],
    docs: productsDocs,
  },
  orders: {
    name: 'orders',
    fields: [
      { name: '_id', type: 'int' },
      { name: 'customerId', type: 'int' },
      { name: 'date', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'items', type: 'array' },
    ],
    docs: ordersDocs,
  },
};

/** Collection names, field lists, and document counts for the schema panel. */
export const COLLECTIONS = Object.values(COLLECTION_MAP).map((collection) => ({
  name: collection.name,
  fields: collection.fields.map((field) => ({ name: field.name, type: field.type })),
  count: collection.docs.length,
}));

// --------------------------------------------------------------------------
// A tiny recursive-descent parser for the mongo/JS literal subset. No eval.
// --------------------------------------------------------------------------

class LiteralParser {
  private i = 0;

  constructor(private readonly src: string) {}

  parse(): unknown {
    this.ws();
    const value = this.value();
    this.ws();
    if (this.i < this.src.length) {
      throw new Error(`unexpected token near "${this.src.slice(this.i, this.i + 12)}"`);
    }
    return value;
  }

  private ws() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i += 1;
  }

  private value(): unknown {
    this.ws();
    const ch = this.src[this.i];
    if (ch === '{') return this.object();
    if (ch === '[') return this.array();
    if (ch === '"' || ch === "'") return this.string();
    if (ch === '-' || (ch >= '0' && ch <= '9')) return this.number();
    return this.keyword();
  }

  private object(): Doc {
    const obj: Doc = {};
    this.i += 1; // {
    this.ws();
    if (this.src[this.i] === '}') {
      this.i += 1;
      return obj;
    }
    for (;;) {
      this.ws();
      const key = this.key();
      this.ws();
      if (this.src[this.i] !== ':') throw new Error(`expected ":" after key "${key}"`);
      this.i += 1;
      obj[key] = this.value();
      this.ws();
      const next = this.src[this.i];
      if (next === ',') {
        this.i += 1;
        continue;
      }
      if (next === '}') {
        this.i += 1;
        return obj;
      }
      throw new Error('expected "," or "}" in object');
    }
  }

  private array(): unknown[] {
    const arr: unknown[] = [];
    this.i += 1; // [
    this.ws();
    if (this.src[this.i] === ']') {
      this.i += 1;
      return arr;
    }
    for (;;) {
      arr.push(this.value());
      this.ws();
      const next = this.src[this.i];
      if (next === ',') {
        this.i += 1;
        continue;
      }
      if (next === ']') {
        this.i += 1;
        return arr;
      }
      throw new Error('expected "," or "]" in array');
    }
  }

  private key(): string {
    const ch = this.src[this.i];
    if (ch === '"' || ch === "'") return this.string();
    const match = this.src.slice(this.i).match(/^[$A-Za-z_][\w$.]*/);
    if (!match) throw new Error('expected an object key');
    this.i += match[0].length;
    return match[0];
  }

  private string(): string {
    const quote = this.src[this.i];
    this.i += 1;
    let out = '';
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === '\\') {
        out += this.src[this.i + 1] ?? '';
        this.i += 2;
        continue;
      }
      if (ch === quote) {
        this.i += 1;
        return out;
      }
      out += ch;
      this.i += 1;
    }
    throw new Error('unterminated string');
  }

  private number(): number {
    const match = this.src.slice(this.i).match(/^-?\d+(\.\d+)?/);
    if (!match) throw new Error('invalid number');
    this.i += match[0].length;
    return Number(match[0]);
  }

  private keyword(): unknown {
    const match = this.src.slice(this.i).match(/^(true|false|null)/);
    if (!match) throw new Error(`unexpected token near "${this.src.slice(this.i, this.i + 12)}"`);
    this.i += match[0].length;
    if (match[0] === 'true') return true;
    if (match[0] === 'false') return false;
    return null;
  }
}

function parseLiteral(src: string): unknown {
  const trimmed = src.trim();
  if (trimmed === '') return undefined;
  return new LiteralParser(trimmed).parse();
}

/** Split a call's argument string at top-level commas (respecting brackets/strings). */
function splitArgs(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let str: string | null = null;
  let current = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (str) {
      current += ch;
      if (ch === str && src[i - 1] !== '\\') str = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      str = ch;
      current += ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim());
}

interface Call {
  method: string;
  argsRaw: string;
}

/** Parse `find({...}).sort({...}).limit(3)` into an ordered list of calls. */
function parseChain(rest: string): Call[] | null {
  const calls: Call[] = [];
  let i = 0;
  while (i < rest.length) {
    const head = rest.slice(i).match(/^([a-zA-Z]+)\(/);
    if (!head) return null;
    const method = head[1];
    i += head[0].length;
    let depth = 1;
    let str: string | null = null;
    const start = i;
    while (i < rest.length && depth > 0) {
      const ch = rest[i];
      if (str) {
        if (ch === str && rest[i - 1] !== '\\') str = null;
      } else if (ch === '"' || ch === "'") {
        str = ch;
      } else if (ch === '(' || ch === '{' || ch === '[') {
        depth += 1;
      } else if (ch === ')' || ch === '}' || ch === ']') {
        depth -= 1;
      }
      i += 1;
    }
    if (depth !== 0) return null;
    calls.push({ method, argsRaw: rest.slice(start, i - 1) });
    if (rest[i] === '.') i += 1;
    else if (i !== rest.length) return null;
  }
  return calls;
}

// --------------------------------------------------------------------------
// Query matching.
// --------------------------------------------------------------------------

function getPath(doc: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in (value as Doc)) {
      return (value as Doc)[key];
    }
    return undefined;
  }, doc);
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a);
  const bs = String(b);
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

function matchOperators(value: unknown, ops: Doc): boolean {
  return Object.entries(ops).every(([op, operand]) => {
    switch (op) {
      case '$eq':
        return value === operand;
      case '$ne':
        return value !== operand;
      case '$gt':
        return value !== undefined && compare(value, operand) > 0;
      case '$gte':
        return value !== undefined && compare(value, operand) >= 0;
      case '$lt':
        return value !== undefined && compare(value, operand) < 0;
      case '$lte':
        return value !== undefined && compare(value, operand) <= 0;
      case '$in':
        return Array.isArray(operand) && operand.includes(value);
      case '$nin':
        return Array.isArray(operand) && !operand.includes(value);
      case '$exists':
        return operand ? value !== undefined : value === undefined;
      case '$regex': {
        const flags = typeof ops.$options === 'string' ? ops.$options : '';
        try {
          return new RegExp(String(operand), flags).test(String(value ?? ''));
        } catch {
          return false;
        }
      }
      case '$options':
        return true; // handled alongside $regex
      default:
        return false;
    }
  });
}

function matchDoc(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$and') {
      return Array.isArray(condition) && condition.every((sub) => matchDoc(doc, sub as Doc));
    }
    if (key === '$or') {
      return Array.isArray(condition) && condition.some((sub) => matchDoc(doc, sub as Doc));
    }
    if (key === '$nor') {
      return Array.isArray(condition) && !condition.some((sub) => matchDoc(doc, sub as Doc));
    }
    const value = getPath(doc, key);
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const keys = Object.keys(condition as Doc);
      if (keys.some((k) => k.startsWith('$'))) {
        return matchOperators(value, condition as Doc);
      }
    }
    if (Array.isArray(value)) return value.includes(condition);
    return value === condition;
  });
}

// --------------------------------------------------------------------------
// Projection, sort.
// --------------------------------------------------------------------------

function applyProjection(doc: Doc, projection: Doc): Doc {
  const entries = Object.entries(projection).filter(([key]) => key !== '_id');
  const including = entries.some(([, value]) => value === 1 || value === true);
  const out: Doc = {};

  if (including) {
    if (projection._id !== 0 && projection._id !== false && '_id' in doc) out._id = doc._id;
    for (const [key, value] of entries) {
      if ((value === 1 || value === true) && key in doc) out[key] = doc[key];
    }
    return out;
  }

  // Exclusion mode: copy everything except the excluded keys.
  for (const [key, value] of Object.entries(doc)) {
    if (projection[key] === 0 || projection[key] === false) continue;
    out[key] = value;
  }
  if (projection._id === 0 || projection._id === false) delete out._id;
  return out;
}

function sortDocs(docs: Doc[], spec: Doc): Doc[] {
  const keys = Object.entries(spec).map(([key, dir]) => ({ key, dir: dir === -1 || dir === false ? -1 : 1 }));
  return [...docs].sort((a, b) => {
    for (const { key, dir } of keys) {
      const cmp = compare(getPath(a, key), getPath(b, key));
      if (cmp !== 0) return dir === -1 ? -cmp : cmp;
    }
    return 0;
  });
}

// --------------------------------------------------------------------------
// Aggregation ($match / $group / $sort / $skip / $limit / $project / $count).
// --------------------------------------------------------------------------

function trimFloat(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function resolveExpr(expr: unknown, doc: Doc): unknown {
  if (typeof expr === 'string' && expr.startsWith('$')) return getPath(doc, expr.slice(1));
  return expr;
}

function runGroup(docs: Doc[], spec: Doc): Doc[] {
  const groups = new Map<string, { id: unknown; docs: Doc[] }>();
  for (const doc of docs) {
    const id = resolveExpr(spec._id, doc);
    const key = JSON.stringify(id ?? null);
    const bucket = groups.get(key);
    if (bucket) bucket.docs.push(doc);
    else groups.set(key, { id: id ?? null, docs: [doc] });
  }

  const accumulators = Object.entries(spec).filter(([key]) => key !== '_id');
  return Array.from(groups.values()).map(({ id, docs: groupDocs }) => {
    const out: Doc = { _id: id };
    for (const [field, acc] of accumulators) {
      if (!acc || typeof acc !== 'object') continue;
      const [op, operand] = Object.entries(acc as Doc)[0] ?? [];
      const values = groupDocs.map((doc) => resolveExpr(operand, doc));
      const numbers = values.filter((value): value is number => typeof value === 'number');
      switch (op) {
        case '$sum':
          out[field] = trimFloat(
            operand === 1 ? groupDocs.length : numbers.reduce((sum, value) => sum + value, 0),
          );
          break;
        case '$avg':
          out[field] = numbers.length ? trimFloat(numbers.reduce((s, v) => s + v, 0) / numbers.length) : null;
          break;
        case '$min':
          out[field] = numbers.length ? Math.min(...numbers) : null;
          break;
        case '$max':
          out[field] = numbers.length ? Math.max(...numbers) : null;
          break;
        case '$count':
          out[field] = groupDocs.length;
          break;
        case '$first':
          out[field] = values[0] ?? null;
          break;
        case '$last':
          out[field] = values[values.length - 1] ?? null;
          break;
        case '$push':
          out[field] = values;
          break;
        default:
          break;
      }
    }
    return out;
  });
}

function runAggregate(collection: CollectionDef, pipeline: unknown): RunResult {
  if (!Array.isArray(pipeline)) {
    return { kind: 'error', error: 'aggregate() expects an array of pipeline stages' };
  }
  let docs: Doc[] = collection.docs.map((doc) => ({ ...doc }));
  for (const rawStage of pipeline) {
    if (!rawStage || typeof rawStage !== 'object') {
      return { kind: 'error', error: 'each pipeline stage must be an object' };
    }
    const stage = rawStage as Doc;
    const [name, spec] = Object.entries(stage)[0] ?? [];
    switch (name) {
      case '$match':
        docs = docs.filter((doc) => matchDoc(doc, spec as Doc));
        break;
      case '$group':
        docs = runGroup(docs, spec as Doc);
        break;
      case '$sort':
        docs = sortDocs(docs, spec as Doc);
        break;
      case '$skip':
        docs = docs.slice(Number(spec) || 0);
        break;
      case '$limit':
        docs = docs.slice(0, Number(spec) || 0);
        break;
      case '$project':
        docs = docs.map((doc) => applyProjection(doc, spec as Doc));
        break;
      case '$count':
        docs = [{ [String(spec)]: docs.length }];
        break;
      default:
        return { kind: 'error', error: `unsupported aggregation stage "${name}" in this playground` };
    }
  }
  return { kind: 'docs', docs };
}

// --------------------------------------------------------------------------
// Top-level runner.
// --------------------------------------------------------------------------

function parseArg(argsRaw: string, index: number): unknown {
  const args = splitArgs(argsRaw);
  return parseLiteral(args[index] ?? '');
}

function runFind(collection: CollectionDef, calls: Call[]): RunResult {
  const [findCall, ...modifiers] = calls;
  let filter: Doc = {};
  let projection: Doc | undefined;
  try {
    const parsedFilter = parseArg(findCall.argsRaw, 0);
    if (parsedFilter !== undefined) filter = parsedFilter as Doc;
    const parsedProjection = parseArg(findCall.argsRaw, 1);
    if (parsedProjection !== undefined) projection = parsedProjection as Doc;
  } catch (error) {
    return { kind: 'error', error: (error as Error).message };
  }

  let docs = collection.docs.filter((doc) => matchDoc(doc, filter));
  let counting = false;

  for (const mod of modifiers) {
    try {
      if (mod.method === 'sort') docs = sortDocs(docs, parseLiteral(mod.argsRaw) as Doc);
      else if (mod.method === 'skip') docs = docs.slice(Number(mod.argsRaw.trim()) || 0);
      else if (mod.method === 'limit') docs = docs.slice(0, Number(mod.argsRaw.trim()) || 0);
      else if (mod.method === 'count') counting = true;
      else return { kind: 'error', error: `unsupported cursor method ".${mod.method}()"` };
    } catch (error) {
      return { kind: 'error', error: (error as Error).message };
    }
  }

  if (counting) return { kind: 'value', value: docs.length };

  const projected = projection ? docs.map((doc) => applyProjection(doc, projection!)) : docs;
  if (findCall.method === 'findOne') {
    return { kind: 'docs', docs: projected.slice(0, 1) };
  }
  return { kind: 'docs', docs: projected };
}

function runWrite(collection: CollectionDef, call: Call): RunResult {
  try {
    if (call.method === 'insertOne') {
      const doc = parseArg(call.argsRaw, 0) as Doc;
      const id = doc && '_id' in doc ? doc._id : 'ObjectId("...")';
      return { kind: 'ack', text: `{ acknowledged: true, insertedId: ${formatValue(id)} }` };
    }
    if (call.method === 'insertMany') {
      const docs = parseArg(call.argsRaw, 0);
      const count = Array.isArray(docs) ? docs.length : 0;
      return { kind: 'ack', text: `{ acknowledged: true, insertedCount: ${count} }` };
    }
    if (call.method === 'updateOne' || call.method === 'updateMany') {
      const filter = (parseArg(call.argsRaw, 0) as Doc) ?? {};
      const matched = collection.docs.filter((doc) => matchDoc(doc, filter));
      const n = call.method === 'updateOne' ? Math.min(1, matched.length) : matched.length;
      return {
        kind: 'ack',
        text: `{ acknowledged: true, matchedCount: ${n}, modifiedCount: ${n}, upsertedId: null }`,
      };
    }
    if (call.method === 'deleteOne' || call.method === 'deleteMany') {
      const filter = (parseArg(call.argsRaw, 0) as Doc) ?? {};
      const matched = collection.docs.filter((doc) => matchDoc(doc, filter));
      const n = call.method === 'deleteOne' ? Math.min(1, matched.length) : matched.length;
      return { kind: 'ack', text: `{ acknowledged: true, deletedCount: ${n} }` };
    }
  } catch (error) {
    return { kind: 'error', error: (error as Error).message };
  }
  return { kind: 'error', error: `unsupported operation "${call.method}"` };
}

/** Run a mongo-shell command against the in-memory dataset. */
export function runMongo(input: string): RunResult {
  const cleaned = input.trim().replace(/;+\s*$/, '').trim();
  if (!cleaned) return { kind: 'error', error: 'Enter a query, e.g. db.customers.find()' };

  const head = cleaned.match(/^db\.([A-Za-z_]\w*)\.(.+)$/s);
  if (!head) {
    return { kind: 'error', error: 'Commands start with db.<collection>., e.g. db.products.find()' };
  }
  const collectionName = head[1];
  const collection = COLLECTION_MAP[collectionName];
  if (!collection) {
    return { kind: 'error', error: `collection "${collectionName}" is not in this playground` };
  }

  const calls = parseChain(head[2]);
  if (!calls || calls.length === 0) {
    return { kind: 'error', error: 'Could not parse that command. Check the parentheses and braces.' };
  }

  const first = calls[0];
  if (first.method === 'find' || first.method === 'findOne') return runFind(collection, calls);
  if (first.method === 'countDocuments' || first.method === 'count') {
    try {
      const filter = (parseArg(first.argsRaw, 0) as Doc) ?? {};
      return { kind: 'value', value: collection.docs.filter((doc) => matchDoc(doc, filter)).length };
    } catch (error) {
      return { kind: 'error', error: (error as Error).message };
    }
  }
  if (first.method === 'aggregate') {
    try {
      return runAggregate(collection, parseArg(first.argsRaw, 0));
    } catch (error) {
      return { kind: 'error', error: (error as Error).message };
    }
  }
  if (['insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'].includes(first.method)) {
    return runWrite(collection, first);
  }
  return { kind: 'error', error: `unsupported operation ".${first.method}()"` };
}

// --------------------------------------------------------------------------
// Rendering + matching helpers.
// --------------------------------------------------------------------------

/** Render a value the way the mongo shell prints it (unquoted keys, single-quoted strings). */
export function formatValue(value: unknown, indent = 0): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map((item) => formatValue(item, indent + 1));
    const oneLine = `[ ${inner.join(', ')} ]`;
    if (oneLine.length <= 72 && !oneLine.includes('\n')) return oneLine;
    const pad = '  '.repeat(indent + 1);
    return `[\n${inner.map((item) => pad + item).join(',\n')}\n${'  '.repeat(indent)}]`;
  }
  const entries = Object.entries(value as Doc);
  if (entries.length === 0) return '{}';
  const inner = entries.map(([key, val]) => `${key}: ${formatValue(val, indent + 1)}`);
  const oneLine = `{ ${inner.join(', ')} }`;
  if (oneLine.length <= 72 && !oneLine.includes('\n')) return oneLine;
  const pad = '  '.repeat(indent + 1);
  return `{\n${inner.map((item) => pad + item).join(',\n')}\n${'  '.repeat(indent)}}`;
}

/** Render a RunResult as shell-style output text. */
export function formatResult(result: RunResult): string {
  if (result.kind === 'error') return `Error: ${result.error}`;
  if (result.kind === 'value') return String(result.value);
  if (result.kind === 'ack') return result.text;
  if (result.docs.length === 0) return '';
  return result.docs.map((doc) => formatValue(doc)).join('\n');
}

/** Structural normalization for lesson matching: collapse whitespace, unify quotes. */
export function normalizeMongo(command: string): string {
  return command
    .trim()
    .replace(/;+\s*$/, '')
    .replace(/'/g, '"')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** Recursively sort object keys so field order never affects a comparison. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value as Doc)
      .sort()
      .reduce<Doc>((acc, key) => {
        acc[key] = canonical((value as Doc)[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Compare two results for challenge grading: same kind and same data, in the
 * same row order. Field order within a document is ignored, so a learner's
 * projection order never blocks a correct answer.
 */
export function resultsMatch(a: RunResult, b: RunResult): boolean {
  if (a.kind === 'error' || b.kind === 'error') return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'value' && b.kind === 'value') return a.value === b.value;
  if (a.kind === 'ack' && b.kind === 'ack') return a.text === b.text;
  if (a.kind === 'docs' && b.kind === 'docs') {
    if (a.docs.length !== b.docs.length) return false;
    return a.docs.every(
      (doc, index) => JSON.stringify(canonical(doc)) === JSON.stringify(canonical(b.docs[index])),
    );
  }
  return false;
}
