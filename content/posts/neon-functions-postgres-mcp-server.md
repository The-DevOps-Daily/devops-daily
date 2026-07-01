---
title: 'A Postgres-Backed MCP Server in ~20 Lines'
excerpt: 'Most of what an MCP server does is run database queries on behalf of an AI agent. So I put one right next to the database. Here is a Postgres-backed MCP server built on Neon Functions, deployed onto a database branch, with the code, a live client test, and the repo.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-01'
publishedAt: '2026-07-01T15:00:00Z'
updatedAt: '2026-07-01T15:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - mcp
  - postgres
  - functions
  - ai-agents
  - serverless
---

The Model Context Protocol is how an AI agent gets tools. You stand up an MCP server, it advertises a set of tools with typed inputs, and the agent calls them. For a huge number of real MCP servers, those tools are thin wrappers around a database: search these records, create this row, update that field. The server is mostly a translator between JSON-RPC and SQL.

Which raises an obvious question. If an MCP server spends its life talking to Postgres, why does it so often run somewhere far away from Postgres? The usual setup is an MCP server on one host and the database on another, so every tool call pays a network round trip to reach the data it needs.

Neon Functions let you skip that. You deploy the MCP server as a function that lives on the same database branch it queries, in the same region, so the server-to-Postgres hop is a local one. In this post I build a Postgres-backed MCP server, deploy it onto a branch, connect a real MCP client, and show what the round trips actually look like. The whole thing is about twenty lines of interesting code, and the [repo](https://github.com/The-DevOps-Daily/neon-mcp-demo) is at the end.

## TL;DR

- An MCP server that exposes database tools is mostly network plus queries. Running it next to the database removes a cross-region hop from every tool call.
- Neon Functions deploy your MCP server onto a database branch, co-located with Postgres. The server-to-database query is a same-region hop of a millisecond or two, not a transatlantic one.
- The core is small: define a Drizzle schema, register a tool whose handler runs a query, and expose the MCP server over the streamable HTTP transport at `/mcp`. That is the ~20 lines.
- Any MCP client that speaks streamable HTTP connects to it: `mcporter`, the MCP SDK, or an agent like Claude or Cursor pointed at the URL.
- Each branch gets its own function URL, so every preview or test branch can have its own isolated MCP endpoint over its own copy of the data.

## Prerequisites

- Node.js 20+ and the Neon CLI (`npm i -g neon`, then `neon login`)
- A Neon account with the platform preview enabled (Functions, new `us-east-2` projects)
- Basic familiarity with Postgres and TypeScript
- Optional: an MCP client to point at it, such as `mcporter`, Claude, or Cursor

## What an MCP server actually is

Strip away the branding and an MCP server is a small RPC service. It speaks JSON-RPC over a transport, and it advertises a list of tools. Each tool has a name, a description, and an input schema. When the agent decides to call a tool, the server runs a handler and returns a result. That is the whole contract.

The transport here is streamable HTTP: the client POSTs JSON-RPC messages to a single endpoint (`/mcp`) and reads responses back, with server-sent events for anything streamed. It works over plain HTTPS, which is exactly what a serverless function serves, so an MCP server and a Neon Function are a natural fit.

## The ~20 lines

Here is the core of a Postgres-backed MCP server. A schema, one tool whose handler runs a query, and the wiring to expose it over streamable HTTP. Everything else is more of the same.

```typescript
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ilike } from 'drizzle-orm';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { contacts } from './db/schema';

// One pool per isolate, reused across requests.
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));

const mcp = new McpServer({ name: 'contacts', version: '1.0.0' });

mcp.registerTool(
  'search_contacts',
  {
    description: 'Search contacts by name. Omit the query to list everyone.',
    inputSchema: { query: z.string().optional().describe('substring to match') },
  },
  async ({ query }) => {
    const rows = await db
      .select()
      .from(contacts)
      .where(query ? ilike(contacts.name, `%${query}%`) : undefined);
    return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
  },
);

// Expose the server over streamable HTTP at /mcp.
const app = new Hono();
const transport = new StreamableHTTPTransport();
app.all('/mcp', async (c) => {
  if (!mcp.isConnected()) await mcp.connect(transport);
  return transport.handleRequest(c);
});

export default app;
```

The tool handler is the interesting part. It is just a query. `registerTool` gives the agent the name, the description, and a Zod input schema (the SDK turns that into the JSON schema the model sees), and your handler returns content. The [companion repo](https://github.com/The-DevOps-Daily/neon-mcp-demo) fills this out to full CRUD (`create_contact`, `update_contact`, `delete_contact`, `search_contacts`) against a small `contacts` table, but every tool follows this same shape: describe it, run a query, return the rows.

The schema is ordinary Drizzle:

```typescript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  company: text('company'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

And the function declaration that tells Neon what to deploy:

```typescript
// neon.ts
import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  preview: {
    functions: {
      contacts: { name: 'contacts mcp server', source: 'src/index.ts' },
    },
  },
});
```

## Deploy it onto the branch

The Neon CLI scaffolds the template, links (or creates) a project, pushes the schema, and deploys the function. From an empty directory:

```terminal
{
  "title": "deploy the MCP server",
  "prompt": "$",
  "steps": [
    { "comment": "scaffold the mcp template" },
    { "cmd": "npx neon bootstrap ./mcp-demo --template mcp", "output": "Scaffolded \"MCP server\" (23 files) into mcp-demo." },
    { "cmd": "cd mcp-demo && npm install", "output": "added 180 packages" },
    { "comment": "create + link a project in us-east-2, pulls DATABASE_URL into .env.local" },
    { "cmd": "neon link", "output": "Created project platform-demo-mcp in aws-us-east-2 and linked branch main." },
    { "comment": "create the contacts table on the branch" },
    { "cmd": "npm run db:push", "output": "[✓] Changes applied" },
    { "cmd": "neon deploy", "output": "Applied changes\n  create  function:contacts\nFunction URLs\n  contacts: https://<branch>-contacts.compute.c-3.us-east-2.aws.neon.tech/" }
  ]
}
```

That last URL is the deployed MCP server. The function and the Postgres branch it queries are in the same region, `us-east-2`. The MCP endpoint is that URL plus `/mcp`.

:::warning
A Neon Function has a **public HTTPS URL, reachable by anyone who has it.** This example does not authenticate callers, which is fine for a demo but not for anything real. Before you expose a database-backed MCP server, check an API key or token at the top of the handler, and remember that the tools can read and write your data.
:::

## Wire up a client and watch it work

Any MCP client that speaks streamable HTTP can connect to `/mcp`. Here are three ways: a CLI, the SDK, and adding it to an agent.

```tabs
{
  "title": "Connect an MCP client to the deployed server",
  "tabs": [
    {
      "label": "mcporter (CLI)",
      "lang": "bash",
      "code": "# List the tools the server advertises\nmcporter list https://<branch>-contacts.compute.c-3.us-east-2.aws.neon.tech/mcp --schema\n\n# Call a tool\nmcporter call \".../mcp.create_contact\" name=\"Ada Lovelace\" company=\"Analytical Engines\"\nmcporter call \".../mcp.search_contacts\" query=\"engine\""
    },
    {
      "label": "MCP SDK (Node)",
      "lang": "javascript",
      "code": "import { Client } from '@modelcontextprotocol/sdk/client/index.js';\nimport { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';\n\nconst url = new URL('https://<branch>-contacts.compute.c-3.us-east-2.aws.neon.tech/mcp');\nconst client = new Client({ name: 'test', version: '1.0.0' });\nawait client.connect(new StreamableHTTPClientTransport(url));\n\nconsole.log((await client.listTools()).tools.map((t) => t.name));\nconst r = await client.callTool({ name: 'search_contacts', arguments: { query: 'ada' } });\nconsole.log(r.content[0].text);"
    },
    {
      "label": "Claude / Cursor",
      "lang": "bash",
      "code": "# Point an MCP-aware agent at the URL as a streamable HTTP server.\n# add-mcp writes the client config for you:\nnpx add-mcp https://<branch>-contacts.compute.c-3.us-east-2.aws.neon.tech/mcp -a claude\n\n# Then in the agent: \"search my contacts for anyone at the Navy\""
    }
  ]
}
```

I ran the SDK client against the deployed server from a machine in Europe. The handshake and the tool calls all worked on the first try:

```text
connect (initialize + handshake): ~1.5 s   (cold start ~2 s the first time)
tools/list: create_contact, update_contact, delete_contact, search_contacts
create_contact: 196 ms  ->  { "created": { "id": 1, "name": "Ada Lovelace", ... } }
search_contacts "navy": 150 ms  ->  { "count": 1, "contacts": [ { "name": "Grace Hopper", ... } ] }
```

A direct `SELECT count(*)` against the branch afterwards showed the rows really landed in Postgres. Nothing is held in memory; the tools are just queries.

## Why co-location is the point

Those tool-call numbers are around 150 to 200 milliseconds, but that is a measurement of my distance to the function, not the function's speed. I am in Europe and the function is in `us-east-2`, so each call is roughly one transatlantic round trip. An agent running near the region, or the model provider's own infrastructure calling the tool, sees a small fraction of that.

The number that does not move with the client's location is the hop from the function to Postgres, and that is the one co-location fixes. In the [first post in this series](https://devops-daily.com/posts/neon-functions-compute-on-your-database-branch) I measured exactly that: a `SELECT` from inside the function against the co-located branch ran in about 1.2 ms, versus about 135 ms for the same query issued across the Atlantic.

```chart
{
  "type": "bar",
  "title": "The hop that a database-backed MCP server actually spends its time on",
  "unit": "ms",
  "caption": "Query from inside the Neon Function to its co-located Postgres branch, vs the same query issued cross-region (measured in the Functions #1 demo, us-east-2). Lower is better.",
  "rows": [
    { "label": "Function -> co-located Postgres", "value": 1.2, "series": "co-located" },
    { "label": "Cross-region -> Postgres", "value": 135, "series": "cross-region" }
  ],
  "series": [
    { "name": "co-located", "color": "#f59e0b" },
    { "name": "cross-region", "color": "#94a3b8" }
  ]
}
```

A tool call that runs one or two queries inherits that difference on every invocation. Put the MCP server a region away from its database and each tool call carries an extra cross-region round trip on top of whatever the client already paid to reach the server. Put the server on the branch and that part is effectively free. For a server whose entire job is querying Postgres, that is the hop worth optimizing.

## One endpoint per branch

There is a second thing you get for free here. Neon Functions are deployed per branch, and each branch has its own function URL. Because a branch is also a copy of your data, that means every branch can have its own MCP server over its own dataset.

Spin up a branch for a preview environment and it comes with an MCP endpoint backed by that branch's data. Give an agent a scratch branch to work against and it cannot touch production. Run your CI against a branch and the agent's tools operate on the ephemeral copy, then it all gets thrown away with the branch. You are not standing up and tearing down a separate MCP service per environment; the endpoint rides along with the branch you already have.

## The repo

The full example, with all four CRUD tools, the schema, the deploy config, and client test scripts, is here:

```github
https://github.com/The-DevOps-Daily/neon-mcp-demo
```

## Wrapping up

An MCP server that fronts a database is mostly network and queries, and the network part is worth taking seriously because an agent may call these tools dozens of times in a single task. Neon Functions let you collapse the server-to-database distance to a same-region hop by deploying the MCP server onto the branch it queries, and the code to do it is small: a schema, a tool that runs a query, and the streamable HTTP transport. Point any MCP client at the URL and the agent has typed, database-backed tools running right next to the data. Give each branch its own endpoint and you get isolated, per-environment agent tooling without any extra services to run.
