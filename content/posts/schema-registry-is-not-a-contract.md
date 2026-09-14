---
title: 'The Producer Changed the Schema and Nobody Told the Consumer'
excerpt: 'A schema registry stops the obvious breakages and sleeps through the expensive ones. Two changes to the same event, demonstrated live: one the registry rejects before it is published, one it cannot see at all because the schema never changed.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-14'
publishedAt: '2026-09-14T09:00:00Z'
updatedAt: '2026-09-14T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kafka
  - Streaming
  - Avro
  - Schema
  - Data Engineering
---

Somebody on the orders team adds a field. The pull request is small, the tests pass, the schema registry accepts the new version, and it ships on a Tuesday afternoon. On Thursday the finance team asks why revenue looks wrong.

Nothing failed. No consumer crashed, no alert fired, no dead letter queue filled up. The pipeline ran all week and produced numbers that were quietly, confidently incorrect.

This is the failure mode that a schema registry does not cover, and the gap is wider than most teams assume. A registry checks that a new schema is structurally compatible with an old one. It does not check that the data still means what it meant last week, and it does not, on its default setting, check against any version except the one immediately before.

This post shows both gaps with code you can run.

## TLDR

- A registry validates **structure**, not **meaning**. Changing a field from cents to dollars is invisible to it, because the schema is byte for byte identical.
- Confluent Schema Registry's default compatibility mode is **`BACKWARD`, which is explicitly non-transitive**. It compares your new schema against the previous version only.
- That makes two individually valid changes into one invalid jump for any consumer that skipped a release. Demonstrated below with a field renamed twice.
- Compatibility modes are a property of the **subject**, not the topic, and the default `TopicNameStrategy` gives you one subject per topic. Multi-event topics need a different strategy or the checks compare unrelated schemas.
- The registry is a gate, not a contract. The contract is the part that says what the numbers mean, who consumes them, and what happens when that changes.

## Prerequisites

- Familiarity with Kafka or a similar log, and with the idea of a schema registry sitting in front of it.
- Python 3.9 or newer if you want to run the examples. One dependency, `fastavro`, and no Kafka cluster required.
- The examples use Avro because its resolution rules are written down precisely. The same holes exist in Protobuf and JSON Schema; the details differ.

## Setting up

Everything below runs locally with no broker:

```bash
python3 -m venv venv && ./venv/bin/pip install fastavro
```

We will use one event. An order, with an id and a total in cents:

```python
CONSUMER = {"type": "record", "name": "Order", "fields": [
    {"name": "id", "type": "string"},
    {"name": "total_cents", "type": "long"},
]}
```

And one consumer that does something with it, which is where the money is:

```python
def revenue(order):
    """What the billing consumer does with every order it sees."""
    return order["total_cents"] / 100
```

## The change a registry catches

The producer team decides `total_cents` belongs on a separate pricing event and removes it.

This is the textbook incompatible change, and the registry does its job. A consumer whose schema requires a field that the writer no longer provides has nothing to fall back on, because the field has no default:

```terminal
{
  "title": "the registry earns its keep",
  "prompt": "$",
  "steps": [
    { "comment": "producer drops a field the consumer requires" },
    { "cmd": "./venv/bin/python two_changes.py", "output": "CHANGE 1: the producer drops a field the consumer requires\n  consumer FAILS: No default value for field total_cents in Order\n  a registry set to BACKWARD rejects this schema before it is ever published\n\nCHANGE 2: the producer switches the same field from cents to dollars\n  schemas identical: True\n  order a1 (cents)   -> consumer bills $49.99\n  order a2 (dollars) -> consumer bills $0.49\n  no error, no warning, nothing for a registry to check. The schema never changed." }
  ]
}
```

With compatibility set to `BACKWARD`, that schema is rejected at registration. It never reaches the topic, the producer's deploy fails, and somebody has a conversation before any data moves. This is exactly what you bought the registry for and it works.

Now look at the second half of that output.

## The change a registry cannot see

The same team has a different requirement: the payments provider returns dollars, and rather than convert on the way in, somebody writes the dollar figure into `total_cents`. The field name is now a lie, but nothing about the schema changes.

There is nothing to register. No new version, no compatibility check, no gate to fail. The producer ships, and the consumer keeps doing exactly what it was written to do:

```
order a1 (cents)   -> consumer bills $49.99
order a2 (dollars) -> consumer bills $0.49
```

A hundredfold error in your billing, with a green pipeline and no exception anywhere. The registry compared two identical schemas and correctly concluded that nothing had changed.

This is the shape of the expensive incidents. Not a crash, which you find in minutes, but a silent semantic drift that you find in a reconciliation weeks later, by which point the bad data is downstream in a warehouse, in invoices, and in a dashboard somebody has been making decisions from.

**No registry solves this**, because it is not a structural property. What helps is treating the meaning as part of the interface: a unit in the field name (`total_minor_units`), a logical type, a doc string that the code review actually reads, and a test on the consumer side that asserts a range rather than a type. None of that is enforced by the registry, which is the point.

## The default that surprises people

Here is the second gap, and this one is structural, so you might expect the registry to catch it.

Confluent's documentation is unambiguous about the default:

> The default compatibility mode is BACKWARD.

and

> The Confluent Schema Registry default compatibility type `BACKWARD` is non-transitive, which means that it's not `BACKWARD_TRANSITIVE`.

Non-transitive means the check compares your new schema against **the immediately previous version only**. Not against every version in the subject's history. Against one.

Most of the time that is fine, because most consumers are close to current. It stops being fine the moment two changes stack.

Take a field rename, done properly with an Avro alias so old data still resolves:

```python
# v2 renames amount -> total, with an alias so v2 readers can still read v1 data.
V2 = {"type": "record", "name": "Order", "fields": [
    {"name": "id", "type": "string"},
    {"name": "total", "type": "long", "aliases": ["amount"]},
]}

# v3 renames total -> sum, with an alias pointing at v2's name.
V3 = {"type": "record", "name": "Order", "fields": [
    {"name": "id", "type": "string"},
    {"name": "sum", "type": "long", "aliases": ["total"]},
]}
```

Each rename is correct. Each carries the alias that the previous version needs. Each passes a `BACKWARD` check against the version before it, so the registry accepts both:

```terminal
{
  "title": "two safe steps, one unsafe jump",
  "prompt": "$",
  "steps": [
    { "comment": "each rename checked against the version immediately before it" },
    { "cmd": "./venv/bin/python pairwise.py", "output": "Each rename checked against the version immediately before it:\n  v1 data read by a v2 consumer        OK    {'id': 'a1', 'total': 4999}\n  v2 data read by a v3 consumer        OK    {'id': 'a1', 'sum': 4999}\n\nThe consumer that was on holiday for one release:\n  v1 data read by a v3 consumer        FAILS No default value for field sum in Order" }
  ]
}
```

The alias chain is one hop deep. `sum` knows it used to be `total`. It has never heard of `amount`. A consumer still on v1 sends data that a v3 consumer cannot resolve, and the registry approved every step that got you there.

Which consumer is two versions behind? The batch job that runs monthly. The partner integration nobody owns. The replay of last quarter's topic when somebody asks where a number came from. **Historical data is a consumer too**, and it is always the version that is furthest behind.

The fix is a setting:

```bash
curl -X PUT http://registry:8081/config/orders-value \
  -H "Content-Type: application/json" \
  -d '{"compatibility": "BACKWARD_TRANSITIVE"}'
```

`BACKWARD_TRANSITIVE` checks against every previous version, and it would have rejected v3. The cost is that schema evolution gets harder, which is the trade you are making on purpose: harder to change, safer to consume.

## Subjects are not topics

One more thing that catches teams, because the default hides it.

Compatibility is configured per **subject**, not per topic. With the default `TopicNameStrategy` a subject is `<topic>-value`, so the two look identical and the distinction never comes up.

It comes up when a topic carries more than one event type, which is common when you want ordering guarantees across related events. With one subject per topic, the registry compares an `OrderPlaced` against an `OrderCancelled` and finds them incompatible, because they are different records that were never meant to evolve into one another.

The answer is `RecordNameStrategy` or `TopicRecordNameStrategy`, which give each record type its own subject and its own compatibility history. Worth knowing before you put two event types on a topic rather than after.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "producer", "sub": "registers a schema", "icon": "box", "tone": "blue" },
    { "label": "registry", "sub": "checks structure only", "icon": "shield", "tone": "amber" },
    { "label": "topic", "sub": "bytes plus a schema id", "icon": "queue", "tone": "violet" },
    { "label": "consumer", "sub": "resolves, then trusts", "icon": "cpu", "tone": "green" }
  ]
}
```

## Where the tooling actually helps

A registry is a runtime gate. It tells you a schema is invalid at the moment you register it, which is after the pull request was approved and usually during a deploy.

The more useful place to catch this is the pull request, and that is what the schema tooling market has been moving toward:

**[Buf](https://buf.build)** does this for Protobuf. `buf breaking` compares your branch against a baseline and fails the build, so the incompatible change is a review comment rather than a failed deploy. It is the same check, moved left far enough to be cheap.

**[Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/index.html)** is the reference implementation of the runtime gate, and its Maven and Gradle plugins can run the compatibility check in CI too. If you use it, change the default on any subject that matters, because `BACKWARD` non-transitive is a weaker guarantee than most people think they are getting.

**[Gable](https://www.gable.ai)** works the layer above: which consumers depend on which fields, so the producer's pull request can say who breaks. That is aimed at the problem this post opens with, the change that is structurally fine and semantically wrong, because the only way to catch that is to know who is reading and what they assume.

None of them solve the cents-to-dollars problem outright. What they do is make the blast radius visible before the change ships.

## What to do on Monday

- **Check your compatibility mode**, per subject, not per cluster: `GET /config/<subject>`. If it returns the global default, you are on non-transitive `BACKWARD`.
- **Move the important subjects to `_TRANSITIVE`.** The ones feeding billing, reporting, or anything a partner reads.
- **Run the compatibility check in CI**, not just at registration. A failed deploy is a bad place to find out.
- **Put units in field names.** `total_cents` is better than `total`, and `total_minor_units` is better than both. This is the cheapest defence against the failure that costs the most.
- **Write down who consumes each topic.** Not a diagram, a list. When a producer asks "can I change this", the answer should take a minute rather than a week.
- **Assert on ranges in consumers, not just on types.** An order total between 1 and 10,000,000 minor units catches the dollar bug on the first message. A type check never will.

## Summary

A schema registry is genuinely useful and it is not a contract. It rejects structurally incompatible changes against, by default, exactly one previous version, and it has no view at all on whether the data still means what it used to mean.

The two demonstrations in this post are twelve and twenty lines. Run them, and then go and look at what `GET /config/<your-subject>` returns, because that one line tells you how much of your history is actually being checked.
