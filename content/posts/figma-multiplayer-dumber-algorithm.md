---
title: 'Figma Made Multiplayer Instant by Picking the Dumber Algorithm'
excerpt: 'Figma rejected Operational Transforms, and they are not running a real CRDT either. They built something simpler on purpose, and the reason it works is a constraint most teams already have. Here is the model, the trade it makes, and two runnable demos of where it breaks.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-09-11'
publishedAt: '2026-09-11T09:00:00Z'
updatedAt: '2026-09-11T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - Architecture
  - Real-time
  - Distributed Systems
  - Databases
---

There is a moment in every multiplayer feature where the demo stops being impressive. Two cursors arrive on the same object at the same time. One person drags it left, the other drags it right, and now you have to decide what the document says.

The search for an answer leads to Operational Transforms, then to conflict-free replicated data types, and then into a literature where the papers come with formal proofs and the proofs come with errata. It is deep work, and it is where a lot of multiplayer features quietly stop.

Figma shipped instead. They announced multiplayer editing in September 2016, and the conflict resolution at the centre of it is, on purpose, one of the least sophisticated rules available: the last value to reach the server wins. Not a merge. Not a transform. The server keeps the most recent value and the earlier one is not applied.

That sounds like the thing you are told never to do. It works because of a constraint Figma has that the papers assume away, and because of a second decision about what a document *is* that does most of the real work. This post is about both, with the parts that break demonstrated rather than described.

## TLDR

- Figma rejected **Operational Transforms** as too complex to reason about, and they are **not running a true CRDT** either. Their words: "Figma isn't using true CRDTs though."
- CRDTs are built so replicas converge without a referee. Figma **has a referee**, so they kept the shape and dropped the overhead that buys decentralisation.
- A document is `Map<ObjectID, Map<Property, Value>>`. The server holds the **latest value per property per object**, which is a last-writer-wins register, and conflicts only exist between two writes to the *same property on the same object*.
- Granularity does the heavy lifting: two people editing different properties of one rectangle **never conflict**.
- The client applies its own edits immediately and **discards incoming server changes that conflict with its own unacknowledged ones**. Without that rule, the person whose edit is winning watches their object jump to someone else's value and back.
- The cost is stated by Figma and is not hidden: **two people cannot merge edits to the same text value**. They consider that acceptable, because Figma is a design tool.
- Ordering uses **fractional indexing**, which has three drawbacks Figma names and this post reproduces: key growth, identical positions, and interleaved runs.
- The lesson is not "avoid CRDTs". It is that **a constraint you already have can delete an entire category of work**.

## Prerequisites

- Familiarity with client-server realtime messaging. If the transport is the part you are unsure about, [WebSockets are the easy part](/posts/websockets-are-the-easy-part) covers reconnection, resume and fan-out, which this post assumes are solved.
- Node.js 20 or newer to run the two demos. No dependencies. Both scripts are included in full at the end.
- No prior knowledge of OT or CRDTs. Both are explained where they appear.

## The algorithm everyone finds first

Operational Transforms are what Google Docs was built on. The model is that clients exchange *operations* rather than values: "insert `x` at position 4", "delete 2 characters at position 9". When an operation arrives that was written against a version of the document you have already moved past, you transform it against everything that happened in between, so that it lands where its author meant.

It is elegant and it is correct. It is also hard to get right, and Figma's post makes that case by quoting other people. Their framing sentence:

> While the classic OT approach of defining operations through their offsets in the text seems to be simple and natural, real-world distributed systems raise serious issues.

They then cite Wikipedia's article on the subject for the reason: operations "propagate with finite speed, states of participants are often different, thus the resulting combinations of states and operations are extremely hard to foresee". And they quote Li and Li on the proofs, which is the part worth sitting with: "formal proofs are very complicated and error-prone, even for OT algorithms that only treat two characterwise primitives".

Two primitives. Insert and delete. That is the case where the proofs are already error-prone.

Figma's own assessment was about their position rather than about OT being bad: they judged OTs "unnecessarily complex for our problem space" for a startup that wanted to ship features quickly, describing "a combinatorial explosion of possible states which is very difficult to reason about". A design tool is not a text document. The operations are not two primitives, they are every property of every shape, and the set grows every time someone adds a feature.

## The algorithm everyone finds second

The other branch of the literature is conflict-free replicated data types. A CRDT is a data structure whose merge is designed so that replicas which have seen the same set of changes end up identical, regardless of the order those changes arrived in.

That property is worth a great deal. Two laptops that have never spoken to each other, each with hours of offline edits, can sync directly and agree. No server needs to adjudicate, because agreement is a property of the data.

You pay for it in bookkeeping. Different CRDT designs pay differently, but the theme is constant: to merge without a referee, a replica has to carry enough information to work out what happened without being told. Depending on the design that means markers for deleted items so a late change does not resurrect them, per-replica identifiers, or structure that grows with the history of the document rather than with its contents.

Figma's line on this is the one worth quoting in full, because it is the sentence most retellings of this story get backwards:

> Figma's tech is instead inspired by something called CRDTs, which stands for conflict-free replicated data types.

And then, immediately:

> Figma isn't using true CRDTs though. CRDTs are designed for decentralized systems ... Since Figma is centralized (our server is the central authority), we can simplify our system by removing this extra overhead.

So the popular framing, that Figma looked at CRDTs and rejected them, is wrong in both directions. They rejected OT. They took the *shape* of several CRDTs and dropped what pays for decentralisation, because they are not decentralised. Their document, in their words, "isn't a single CRDT. Instead it's inspired by multiple separate CRDTs and uses them in combination."

What they dropped was not complexity for its own sake. It was the price of a capability they do not ship.

## What the referee buys you

Once there is a central server that every client talks to, one category of problem changes shape. You no longer need the data structure to produce agreement about order, because the server produces it: the order it processes messages in *is* the order.

That does not make realtime easy. Delivery, reconnection and recovery are all still yours, and the [previous post](/posts/websockets-are-the-easy-part) is about exactly how much work that is. What it removes is the need for the document itself to derive a consistent order from nothing.

What remains is a smaller question. Not "how do two replicas reconcile", but "what does the server keep".

Figma keeps the latest value.

> Figma's multiplayer servers keep track of the latest value that any client has sent for a given property on a given object.

> A conflict happens when two clients change the same property on the same object, in which case the document will just end up with the last value that was sent to the server.

In CRDT vocabulary this is a last-writer-wins register, and a map of them is a well understood structure with a well understood weakness: the losing write is not merged, it is just not the value that ends up in the document. That is the trade, stated plainly, and Figma takes it.

## The decision that does the real work

Last-writer-wins on its own would be unbearable. The reason it is fine in Figma is not the conflict rule, it is the granularity the rule operates on, and that comes from the document model.

> Every Figma document is a tree of objects, similar to the HTML DOM.

Conceptually the whole document is `Map<ObjectID, Map<Property, Value>>`, or as they also put it, like database rows storing `(ObjectID, Property, Value)` tuples. That is a description of the model, not a claim about what is on disk. What matters is the shape: a flat set of independently addressable cells rather than a structure that has to be transformed.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "client edits", "sub": "(object, property, value)", "icon": "cpu", "tone": "blue" },
    { "label": "server", "sub": "keeps the latest per cell", "icon": "server", "tone": "green" },
    { "label": "other clients", "sub": "apply, unless it fights a local edit", "icon": "globe", "tone": "violet" }
  ]
}
```

Once that is the model, the conflict surface collapses:

> Two clients changing unrelated properties on the same object won't conflict, and two clients changing the same property on unrelated objects also won't conflict.

One person changing a rectangle's fill while another drags the same rectangle is not a conflict. Those are two cells. A real conflict needs both people to write the same property of the same object with their edits overlapping in flight, which is a narrow enough target that dropping the loser is an acceptable outcome. The apparent recklessness of last-writer-wins is paid for by making the unit small enough that writers rarely collide.

This is the transferable idea, and it is worth more than the Figma trivia. **Much of the difficulty in merging is a consequence of the unit you chose to merge.** Pick a smaller unit and a large part of the problem is not solved so much as removed.

## The rule that makes it feel instant

There is a second decision, and it is the one responsible for the word "instant".

> Property changes on the client are always applied immediately instead of waiting for acknowledgement from the server since we want Figma to feel as responsive as possible.

Every drag is applied locally the moment it happens. The server is told afterwards. Which creates the obvious hazard: your local value is a prediction, and the server is meanwhile broadcasting other people's changes to you, including changes to the exact property you are in the middle of dragging.

Figma's answer:

> So we want to discard incoming changes from the server that conflict with unacknowledged property changes.

Their reasoning is that the unacknowledged local change is "the most recent change we know about in last-to-the-server order", so it is the client's best prediction of the value the document will settle on. That qualifier matters: the claim is not that your change is newest in wall-clock time, it is that it is the latest one this client has sent, and the server resolves by arrival order.

Here is that rule, as a client:

```javascript
receive(id, prop, value) {
  // While my own change to this exact cell is still in flight, it is my best
  // prediction of where this property lands. Anything else is older news.
  if (this.predict && this.pending.has(`${id}.${prop}`)) return;
  put(this.doc, id, prop, value);
}
```

Nine words of condition. To see what it is worth, here are two clients dragging the same rectangle at the same time, with the rule off and then on. Bob's packet reaches the server first and Alice's second, so Alice's value wins in both runs:

```terminal
{
  "title": "node lww.js",
  "prompt": "$",
  "steps": [
    { "comment": "two clients drag the same rectangle at the same time" },
    { "cmd": "node lww.js", "output": "without the discard rule:\n  server x = 420, alice sees 420, bob sees 420\n  alice (her edit won) watched: x=100 then x=420\n  bob (his edit lost) watched: x=420\n\nwith the discard rule (what Figma does):\n  server x = 420, alice sees 420, bob sees 420\n  alice (her edit won) watched: nothing move under the cursor\n  bob (his edit lost) watched: x=420\n\nunrelated edits, same instant:\n  rect1.x=10 rect1.fill=red rect2.x=99 rect3.x=7\n\nboth type into the same text layer:\n  server = \"Hello world\"" }
  ]
}
```

Both runs end at `x = 420` on every client. The state is identical. What differs is what Alice saw on the way: without the rule, the rectangle she is holding jumps to Bob's position and snaps back to her own, which reads as the application fighting her.

Bob loses either way, and sees one move. That is the correct outcome and no rule can help him. The rule is not about the loser. It is about not making the *winner* watch their own edit get undone and redone while it is still in flight.

Two caveats on that demo, since it is a model rather than Figma's protocol. The acknowledgement in it carries the server's value back to the sender, which is a choice that makes the model converge; Figma's posts describe the discard rule, not their acknowledgement format. And it is one synchronous trace of one scenario, not a proof about either version.

This is still the part that does not show up in a correctness argument, because both versions converge. Consistency was never the problem. The problem was a rectangle twitching under a cursor, and it is solved by a conditional rather than by an algorithm.

## What the model refuses to do

A design worth trusting states its own limits, and this one has a sharp one. Figma's example:

> If the text value is B and someone changes it to AB at the same time as someone else changes it to BC, the end result will be either AB or BC but never ABC.

Because:

> changes are atomic at the property value boundary. The eventually consistent value for a given property is always a value sent by one of the clients.

A text layer's content is one property. One cell. Two people typing into it are two writes to the same cell, and the document takes one of the two whole strings. The last run in the demo above shows exactly that: two clients type, the server keeps one string, and the other edit is not merged in.

Figma's position on this is worth repeating, because it is a design decision rather than an oversight:

> That's ok with us because Figma is a design tool, not a text editor, and this use case isn't one we're optimizing for.

That is the honest cost of choosing the small unit. It works while the unit is small and independent. A text value is neither, because the interesting operations are inserts and deletes in the middle, which is precisely what OT and sequence CRDTs were invented for and what a register cannot express.

What that means for you: if the thing your users collaborate on is *mostly* prose, whole-value replacement is the wrong mechanism for that field, and the literature Figma declined is where the answer is. A central server does not force you into last-writer-wins everywhere, it just means you can choose per property, which is the flexibility the flat model gives you.

## Ordering, and the three ways it goes wrong

One more problem the register map does not answer on its own. Objects in a tree have an order, and order is shared state.

An array of children is awkward here, because position is then implied by an index that every insert shifts, and you have to decide how to replicate that shift. Figma sidesteps it by storing position as a property on the child, next to its parent link, with the two stored as a single property so they update atomically. The server also "reject[s] parent property updates that would cause a cycle", which is what stops two people reparenting objects into each other and detaching the pair from the tree.

The position itself uses fractional indexing:

> Every index is a fraction between 0 and 1 exclusive

To place something between two objects, pick a fraction between their two indices. There is always room, because there is always a number between two numbers. Figma stores each index as a string in base 95 over printable ASCII, drops the leading `0.`, and does the arithmetic with string manipulation, which is arbitrary precision rather than a 64-bit double that would run out of room.

The implementation below is not an arithmetic mean. It walks digit by digit and stops at the first place with room, which is what keeps keys short:

```javascript
/**
 * A position strictly between two fractions. There is always room, so the only
 * unanswerable case is a pair that is not strictly ordered.
 */
function between(a, b) {
  if (a >= b) throw new Error(`no position exists between ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
  const x = digits(a), y = digits(b);
  const out = [];
  let carry = 0;
  for (let i = 0; ; i++) {
    const lo = (x[i] ?? 0) + carry * BASE;
    const hi = y[i] ?? BASE;
    if (hi - lo > 1) {
      out.push(Math.floor((lo + hi) / 2));
      return str(out);
    }
    out.push(lo % BASE);
    carry = lo >= BASE ? 0 : hi - lo;
  }
}
```

Figma names three drawbacks. All three are reproducible:

```terminal
{
  "title": "node fracindex.js",
  "prompt": "$",
  "steps": [
    { "comment": "the three drawbacks Figma documents, reproduced" },
    { "cmd": "node fracindex.js", "output": "two objects:  a=\"7\"  b=\"g\"\n\n1. keys grow with edit history, not document size:\n    20 inserts ->  5 chars\n    40 inserts -> 11 chars\n    60 inserts -> 17 chars\n   final key: \"f ~ ~ ~ ~ ~ ~ ~ |\"\n\n2. two clients insert into the same gap at the same moment:\n   client 1 picks \"O\", client 2 picks \"O\"\n   no position exists between \"O\" and \"O\"\n\n3. two clients each paste three objects into the same gap:\n   all positions unique: true\n   merged order: one-1  two-1  two-2  one-2  two-3  one-3" }
  ]
}
```

**Keys grow.** In this implementation, sixty inserts into the same gap take the index from one character to seventeen, and the growth is driven by edit history rather than by document size. Those numbers describe the allocator above, not a measurement of Figma's. Their position is that growth "isn't a concern for us since we don't need to order huge numbers of elements", which is a reasonable thing to say once you have looked at it and a dangerous thing to assume if your sequences are long-lived.

**Two clients can pick the same position.** Both computed a position in the same gap and got a byte-identical string, and now nothing can be placed between them, which is the error the second block prints. Figma's fix is the referee again: "The server can avoid ever having two objects with an identical position by just generating and assigning a unique position to the second insert operation." A decentralised design has to solve that some other way.

**Runs interleave.** This is the one to look at:

```text
all positions unique: true
merged order: one-1  two-1  two-2  one-2  two-3  one-3
```

Two people each pasted a group of three objects into the same gap. The server resolved every collision, so no two objects share a position, and every object sits exactly where its position says. The runs are still shuffled together, because each client computed its next position against a document that did not contain the other client's objects. Grouping was information the model never held. Figma acknowledges it plainly: "Merging new elements from multiple clients may interleave them."

Interleaving here is not a bug in the implementation. It is the shape of a system that resolves per item when the user was thinking per group. Figma treats it as a drawback to live with rather than a defect to fix, which for dragged design objects is a fair call, and is a call you should make deliberately rather than discover.

## When the dumber algorithm is the right one

Wallace draws the conclusion himself, and it is a statement about engineering rather than about computer science:

> it's much more beneficial for the Figma platform to use simple algorithms that are easy to understand and implement than to use the most advanced algorithms out there

The trap this avoids does not feel like over-engineering at the time. It feels like diligence. You find the algorithm with the proof, and the proof is real, and the property it proves is real. What is easy to miss is that the property is only worth its cost if you need it, and convergence without a referee is only needed by systems without a referee.

A checklist that transfers:

- **Do you have a central authority?** If every client already talks to your server, you get ordering from it, and you should not also pay for a structure whose purpose is deriving order without one.
- **How small can the unit of change be?** Most merge difficulty is a property of the unit. A document that is a flat map of independent cells has little merge problem left.
- **What does the losing write cost?** Taking one of two values is fine for a coordinate, which the user can redo in a second. It is not fine for a field somebody spent a minute typing into.
- **Is the collaborative content a sequence?** Text and ordered lists are where registers stop working, and you can choose a different mechanism for those fields without changing the architecture.
- **Does the user think in groups?** If so, expect interleaving, and hold the grouping somewhere the model can see.

## The parts that are not realtime at all

One last thing, because it is where a lot of the engineering time on a feature like this goes and it never appears in the architecture diagram. These are recommendations rather than anything Figma has written about.

**The document has to be durable.** The authoritative state in this model is a set of `(object, property, value)` cells, which is a shape an ordinary database holds well. It is also a case where per-branch database copies earn their keep, because the schema is the product: a service like [Neon](https://neon.com) can branch a Postgres database so a migration can be rehearsed against a copy of real document shapes rather than against fixtures.

**Other systems need to know.** Integrations, audit logs and customer automations want to hear that a document changed, and they are not on your WebSocket. That is webhook delivery, with retries, signatures and stable event identifiers, and it is an unpleasant thing to write twice. [Svix](https://www.svix.com) exists because that problem looks the same everywhere.

**Most collaborators are not connected.** The person who needs to know about a comment is asleep. The escape hatch from a realtime system is email, and a transactional sender such as [SMTPfast](https://smtpfa.st) covers it. The thing to get right is the same one as in the live session: do not notify someone about their own change.

None of these are realtime problems, and none of them get easier by being treated as part of the realtime system.

## Summary

Figma did not avoid CRDTs because CRDTs are bad. They rejected Operational Transforms as too complex to reason about, took inspiration from several CRDTs, and removed the machinery that exists to make replicas agree without a referee, because they have a referee.

What is left is a flat map of cells with last-writer-wins per cell, a client that applies its own edits immediately and ignores conflicting news until acknowledged, and fractional indices for order. Each piece is small. The engineering is not in any of them individually, it is in the decision about which properties were worth paying for.

The two demos below reproduce the drawbacks Figma documents for the ordering scheme, and the flicker their client-side rule exists to prevent. A model whose limits are cheap to demonstrate is a model you can reason about, which was the point of choosing it.

## The demos in full

Save these as `lww.js` and `fracindex.js` and run them with `node`. No dependencies.

```javascript
// lww.js
// A document as Figma describes it: Map<ObjectID, Map<Property, Value>>.
// The server keeps the latest value any client sent for a given property on a
// given object. That is the whole conflict resolution rule.
const server = { doc: new Map(), clients: [] };

const put = (doc, id, prop, value) => {
  if (!doc.has(id)) doc.set(id, new Map());
  doc.get(id).set(prop, value);
};
const get = (doc, id, prop) => doc.get(id)?.get(prop);

class Client {
  constructor(name, { predict }) {
    this.name = name;
    this.predict = predict;       // keep my own value until the server agrees
    this.doc = new Map();
    this.pending = new Set();     // "object.property" I have sent, not yet acked
    this.seen = [];               // what the user on this screen watched happen
    server.clients.push(this);
  }
  edit(id, prop, value) {
    put(this.doc, id, prop, value);          // applied immediately, always
    this.pending.add(`${id}.${prop}`);
    inflight.push({ from: this, id, prop, value });
  }
  receive(id, prop, value) {
    // Figma discards incoming changes that conflict with an unacknowledged
    // local change: our own change is the most recent one we know about.
    if (this.predict && this.pending.has(`${id}.${prop}`)) return;
    if (get(this.doc, id, prop) !== value) this.seen.push(`${prop}=${value}`);
    put(this.doc, id, prop, value);
  }
  ack(id, prop) { this.pending.delete(`${id}.${prop}`); }
}

// The acknowledgement below carries the server's value back to the sender.
// Figma's posts describe the discard rule, not their ack format; this is a
// model that converges, not a claim about their protocol.
let inflight = [];
function deliver() {
  const batch = inflight;
  inflight = [];
  for (const m of batch) {
    put(server.doc, m.id, m.prop, m.value);       // last writer wins, in order
    for (const c of server.clients) if (c !== m.from) c.receive(m.id, m.prop, m.value);
  }
  // The ack carries the server's value, so a client whose change lost the race
  // converges instead of sitting on its own number forever.
  for (const m of batch) {
    m.from.ack(m.id, m.prop);
    m.from.receive(m.id, m.prop, get(server.doc, m.id, m.prop));
  }
}

function run(predict) {
  server.doc = new Map(); server.clients = []; inflight = [];
  const alice = new Client("alice", { predict });
  const bob = new Client("bob", { predict });

  // Both drag the same rectangle at the same moment. Alice's packet is second.
  bob.edit("rect1", "x", 100);
  alice.edit("rect1", "x", 420);
  deliver();

  console.log(`  server x = ${get(server.doc, "rect1", "x")}, alice sees ${get(alice.doc, "rect1", "x")}, bob sees ${get(bob.doc, "rect1", "x")}`);
  for (const c of [alice, bob])
    console.log(`  ${c.name} (${c === alice ? "her edit won" : "his edit lost"}) watched: ${c.seen.length ? c.seen.join(" then ") : "nothing move under the cursor"}`);
}

console.log("without the discard rule:");
run(false);
console.log("\nwith the discard rule (what Figma does):");
run(true);

// Different properties on the same object, and the same property on different
// objects. Neither is a conflict.
console.log("\nunrelated edits, same instant:");
server.doc = new Map(); server.clients = []; inflight = [];
const a = new Client("a", { predict: true }), b = new Client("b", { predict: true });
a.edit("rect1", "x", 10);      b.edit("rect1", "fill", "red");
a.edit("rect2", "x", 99);      b.edit("rect3", "x", 7);
deliver();
console.log(`  rect1.x=${get(server.doc,"rect1","x")} rect1.fill=${get(server.doc,"rect1","fill")} rect2.x=${get(server.doc,"rect2","x")} rect3.x=${get(server.doc,"rect3","x")}`);

// Text is one property value, so it is atomic. Two people typing lose one.
console.log("\nboth type into the same text layer:");
server.doc = new Map(); server.clients = []; inflight = [];
const c1 = new Client("c1", { predict: true }), c2 = new Client("c2", { predict: true });
put(c1.doc, "text1", "characters", "Hello"); put(c2.doc, "text1", "characters", "Hello");
c1.edit("text1", "characters", "Hello there");
c2.edit("text1", "characters", "Hello world");
deliver();
console.log(`  server = ${JSON.stringify(get(server.doc, "text1", "characters"))}`);
```

```javascript
// fracindex.js
// Fractional indexing as Figma describes it: every index is a fraction between
// 0 and 1 exclusive, stored as a string so precision never runs out, base 95
// over printable ASCII with the leading "0." left off.
const BASE = 95, FIRST = 32; // ' ' .. '~'

const digits = (s) => [...s].map((c) => c.charCodeAt(0) - FIRST);
const str = (d) => d.map((n) => String.fromCharCode(n + FIRST)).join("");

/**
 * A position strictly between two fractions. Not the arithmetic mean: it walks
 * digit by digit and stops at the first place with room, which is what keeps
 * keys short. There is always room, so the only unanswerable case is a pair
 * that is not strictly ordered.
 */
function between(a, b) {
  if (a >= b) throw new Error(`no position exists between ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
  const x = digits(a), y = digits(b);
  const out = [];
  let carry = 0;
  for (let i = 0; ; i++) {
    const lo = (x[i] ?? 0) + carry * BASE;
    const hi = y[i] ?? BASE;
    if (hi - lo > 1) {
      out.push(Math.floor((lo + hi) / 2));
      return str(out);
    }
    out.push(lo % BASE);
    carry = lo >= BASE ? 0 : hi - lo;
  }
}

const A = str([BASE >> 2]), B = str([(BASE * 3) >> 2]);
console.log(`two objects:  a=${JSON.stringify(A)}  b=${JSON.stringify(B)}`);

// 1. Keys grow. One person dropping objects into the same gap, over and over.
let lo = A;
const lengths = [];
for (let i = 1; i <= 60; i++) {
  lo = between(lo, B);
  if (i % 20 === 0) lengths.push(`${String(i).padStart(3)} inserts -> ${String(lo.length).padStart(2)} chars`);
}
console.log("\n1. keys grow with edit history, not document size:");
for (const l of lengths) console.log("   " + l);
console.log(`   final key: ${JSON.stringify(lo)}`);

// 2. Two clients computing a position in the same gap get the same string, and
//    nothing can then be placed between them.
console.log("\n2. two clients insert into the same gap at the same moment:");
const mine = between(A, B), yours = between(A, B);
console.log(`   client 1 picks ${JSON.stringify(mine)}, client 2 picks ${JSON.stringify(yours)}`);
try { between(mine, yours); } catch (e) { console.log(`   ${e.message}`); }

// Figma's fix is the central server: it hands the second insert a different
// position. Here it slots the duplicate in just after the key it collided with.
class Server {
  constructor(keys) { this.keys = [...keys].sort(); }
  insert(wanted) {
    if (!this.keys.includes(wanted)) { this.keys.push(wanted); this.keys.sort(); return wanted; }
    const next = this.keys.find((k) => k > wanted);
    const fixed = between(wanted, next ?? B);
    this.keys.push(fixed); this.keys.sort();
    return fixed;
  }
}

// 3. Interleaving. Each client pastes a run of three into the same gap. Every
//    position below is unique, assigned by the server. The runs still split.
console.log("\n3. two clients each paste three objects into the same gap:");
const server = new Server([A, B]);
const placed = [];
const cursors = { one: A, two: A };
for (let i = 1; i <= 3; i++) {
  for (const who of ["one", "two"]) {
    const wanted = between(cursors[who], B);   // computed against what the client can see
    const actual = server.insert(wanted);
    if (who === "one") cursors.one = wanted;   // client 1 never saw client 2's objects
    else cursors.two = wanted;
    placed.push([`${who}-${i}`, actual]);
  }
}
console.log(`   all positions unique: ${new Set(placed.map(([, k]) => k)).size === placed.length}`);
const order = [...placed].sort((p, q) => (p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0));
console.log("   merged order: " + order.map(([n]) => n).join("  "));
```

## Sources

- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/), Evan Wallace, 16 October 2019
- [Realtime editing of ordered sequences](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/), Evan Wallace, 6 March 2017

Both posts describe Figma as of their publication dates. Nothing here establishes how the product works today.
