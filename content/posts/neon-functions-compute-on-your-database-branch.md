---
title: 'Compute That Lives on Your Database Branch'
excerpt: 'Neon Functions run your code in the same region as your Postgres, on a per-branch URL. To see why that matters I deployed a small API and timed a query from inside the function versus from a machine across the Atlantic: 1.2 ms against 135 ms. Here is how it works, with the real numbers and the repo.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-27'
publishedAt: '2026-06-27T09:00:00Z'
updatedAt: '2026-06-27T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - serverless
  - postgres
  - functions
  - platform-engineering
---

Ask where your backend code runs relative to your database and the answer is often "somewhere else." Your function is in one provider's `us-east-1`, your Postgres is in another region entirely, and every query crosses that gap. Most of the time you don't see it, because one query is fast enough to ignore. Then a request makes eight queries in sequence, each pays the round trip, and suddenly an endpoint that should take milliseconds takes most of a second.

[Neon Functions](https://neon.com/docs/compute/functions/overview), part of Neon's June 2026 platform preview, takes a different position: run the compute in the same region as the database branch, on a URL scoped to that branch. This is the first in a series on what that buys you. It is also the simplest to demonstrate, because the benefit is something you can measure. I deployed a small REST API and timed a trivial query two ways. The numbers are at the bottom, and they are not close.

(Companion repo, deploy it yourself: [The-DevOps-Daily/neon-functions-demo](https://github.com/The-DevOps-Daily/neon-functions-demo).)

## The whole backend is one config file

Neon ships starter templates through its CLI. The REST API is one of them:

```terminal
{
  "title": "scaffold + deploy",
  "steps": [
    { "comment": "scaffold a Hono + Drizzle REST API" },
    { "cmd": "neonctl bootstrap ./api --template hono", "output": "Scaffolded 23 files into ./api" },
    { "comment": "create a project (us-east-2, preview only) and deploy" },
    { "cmd": "neonctl link --project-name api --region-id aws-us-east-2", "output": "Created project (\"api\") in aws-us-east-2 and linked .neon on branch main" },
    { "cmd": "neonctl deploy", "output": "Applied changes\n  create  service  function:todos\n\nFunction URLs\n  todos: https://br-restless-sound-...-todos.compute.c-3.us-east-2.aws.neon.tech/\n\nUtilized services: Postgres, Functions" }
  ]
}
```

What gets deployed is declared in `neon.ts`. For this API it is three lines of intent: take `src/index.ts` and run it as a function called `todos`.

```ts
import { defineConfig } from '@neondatabase/config/v1';

export default defineConfig({
  preview: {
    functions: {
      todos: { name: 'todo api', source: 'src/index.ts' },
    },
  },
});
```

No connection string in there, no region to pick for the compute, no URL to reserve. The `DATABASE_URL` is injected at deploy time, and the function lands in the same region as the branch automatically.

## The function is a normal web handler

There is nothing Neon-specific in the application code. It is a standard [Hono](https://hono.dev) app talking to Postgres through a connection pool, the same code you would write for any Node host:

```ts
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { parseEnv } from '@neondatabase/env';
import config from '../neon';
import { todos } from './db/schema';

const env = parseEnv(config);
const pool = new Pool({ connectionString: env.postgres.databaseUrl, max: 5 });
const db = drizzle(pool);

const app = new Hono();
app.get('/todos', async (c) => c.json(await db.select().from(todos)));
app.post('/todos', async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  const [row] = await db.insert(todos).values({ text }).returning();
  return c.json(row, 201);
});

export default app;
```

After `neonctl deploy`, that handler answers at a branch-scoped URL, and the create/read path works end to end:

```bash
curl -X POST "$URL/todos" -H 'content-type: application/json' -d '{"text":"ship it"}'
# {"id":1,"text":"ship it","createdAt":"2026-06-25T16:17:10.692Z"}  (201)
curl "$URL/todos"
# [{"id":1,"text":"ship it","createdAt":"2026-06-25T16:17:10.692Z"}]  (200)
```

The phrase "branch-scoped URL" is the part worth slowing down on. Open a branch off this one and it gets its own function at its own URL, running your latest code against that branch's data. The preview environment for a pull request stops being "the frontend plus a shared backend" and becomes a real, isolated copy. We will spend a whole post on that later; for now, the point is that the function and the branch are one unit.

## Now measure the distance

Here is the part you can put a number on. The function exposes a `/db-latency` endpoint that times thirty `SELECT 1` round trips from inside the handler and returns the median. Because the function runs in the same region as the branch, this is the local hop:

```bash
curl "$URL/db-latency"
# { "from": "neon function (us-east-2, co-located with Postgres)",
#   "runs": 30, "min_ms": 1.13, "median_ms": 1.19, "p95_ms": 1.62 }
```

Just over a millisecond. Then I ran the exact same `SELECT 1`, against the exact same database, from a machine in Europe (this site's build box, a Raspberry Pi a long way from `us-east-2`):

```bash
# same query, same database, from a machine on another continent
# { "from": "europe -> us-east-2", "runs": 30,
#   "min_ms": 130.46, "median_ms": 134.54, "p95_ms": 138 }
```

Same query, same database. The only thing that changed is where the caller sits.

```chart
{
  "type": "bar",
  "title": "Median time for one SELECT 1 round trip",
  "unit": "ms",
  "caption": "Median of 30 round trips to the same Neon Postgres (us-east-2), warm connection. 'From the function' runs inside Neon Functions, co-located with the branch. 'From Europe' is a machine on another continent. Your own gap depends on where your compute runs, but distance is latency.",
  "rows": [
    { "label": "From the function (us-east-2)", "value": 1.19 },
    { "label": "From Europe", "value": 134.54 }
  ]
}
```

About 113x. And that is for one round trip. A request that reads a session, loads a user, fetches their settings, and runs three more queries pays that distance once per query if it runs them in sequence. At 1.2 ms the six-query endpoint spends roughly 7 ms talking to the database; at 135 ms it spends most of a second, and no amount of application tuning fixes it, because the time is in the network. This is the tax co-located compute removes. It is also where a lot of "serverless Postgres is slow" folklore actually comes from: not the database, but a function in one region reconnecting to a database in another on every cold start.

To be fair about the comparison: a real deployment is rarely as far away as Europe-to-Virginia. If your Lambda and your database are both in `us-east-1` the gap is smaller. But "both in the same region" is exactly the property Neon Functions give you by default instead of by careful configuration, and "smaller" is not "zero."

## What it is, and what it is not

A few things are worth stating plainly before you build around this, because it is a private preview and it has clear edges.

:::warning
**Private preview, one region, new projects only.** Everything is in AWS `us-east-2` and only works on projects created inside the preview. You cannot turn this on for an existing production database today.
:::

Beyond that:

- **These are request/response functions, not a job runner.** They are built for APIs, agents, webhooks, and real-time connections (they support streaming and long-lived sockets, not just quick replies). Background work, queues, retries, and schedules are a different kind of compute; pair them with something like Inngest or QStash.
- **Function memory is fixed** (2048 MiB at preview), so this is not yet a knob-for-everything compute platform.
- **It is a Neon-shaped commitment.** One config file declaring your functions is convenient precisely because it is integrated. That is coupling, traded for the locality and the branching.

## Who this is for

If your backend already lives in mature infrastructure-as-code with compute and database carefully placed in the same region, Neon Functions are not solving a problem you have. You already paid the cost to make the hop short.

The teams this helps are the ones who never got around to that: side projects and small teams whose compute and database drifted into different regions because nobody decided otherwise, and anyone who wants a pull request to spin up a genuinely isolated backend without wiring it by hand. For them, "the function runs next to the database, on this branch's data, at this URL" is a real reduction in both latency and moving parts, and it is the default rather than a configuration you have to get right.

We dig into the bigger picture in [Neon is becoming a backend platform, not just Postgres](https://devops-daily.com/posts/neon-backend-platform-not-just-postgres), and the rest of this series walks through the other things a branch-scoped function unlocks: streaming agents, MCP servers, and preview environments that include the backend. The full demo, including the `/db-latency` endpoint, is here:

```github
https://github.com/The-DevOps-Daily/neon-functions-demo
```
