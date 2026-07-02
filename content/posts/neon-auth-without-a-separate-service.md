---
title: 'Auth for a Postgres App, Without a Separate Service'
excerpt: 'The usual way to add auth is to run a second system next to your database and spend forever keeping the two in sync. Neon Auth puts the auth server in the same project as Postgres: one line in a config file, one deploy, and the user who signs in is a row you can join to your own tables. Here is how it works and why the reconciliation tax disappears.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-20'
publishedAt: '2026-07-20T09:00:00Z'
updatedAt: '2026-07-20T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - auth
  - postgres
  - jwt
  - serverless
  - devops
---

Adding authentication to an app usually means running a second system. You already have Postgres for your data, and now you stand up an auth service next to it: a hosted one like Auth0, Clerk, or Cognito, or a self-hosted stack like Keycloak or Ory. Either way you now have two sources of truth. The auth service knows who your users are; your database knows what they own. And you spend a surprising amount of engineering keeping those two pictures in agreement: a webhook to copy new users into your `users` table, a nightly job to catch the webhooks that failed, a foreign key that points at an id living in someone else's system.

Neon Auth takes a different position: the auth server runs in the same project as your database. You turn it on with one line of config, and after a deploy the user who signs in is a row in your Postgres, in a schema you can query and join against your own tables. This post walks through how that works, what you actually get, and why the sync layer you are used to writing simply goes away. There is a working [repo](https://github.com/The-DevOps-Daily/neon-auth-demo) at the end.

## TL;DR

- Neon Auth is an auth server that lives inside your Neon project. Enable it with `auth: true` in `neon.ts` and provision it with one `neon deploy`.
- It issues signed JWTs and publishes a JWKS endpoint, so any backend verifies a token with public-key crypto and no shared secret.
- User, session, and account data live in a `neon_auth` schema in the same Postgres. The id in the token is the primary key of `neon_auth.user`, so it is a real foreign key for your tables, no webhook sync required.
- Because auth state lives in Postgres, it branches with your database: a preview branch gets its own isolated set of users.
- It is built on [Better Auth](https://www.better-auth.com/), so the sign-in, sign-up, and token endpoints are the standard ones you may already know.

## Prerequisites

- A [Neon](https://neon.com) project on the platform preview (`us-east-2`, new projects)
- The Neon CLI (`npm i -g neon`) and a linked project
- Familiarity with JWTs at the level of "a signed token with claims"

## The reconciliation tax

Here is the shape most apps end up with. Two systems, and glue in the middle to keep them agreeing:

```text
Auth service                     Your database
┌───────────────┐   webhook      ┌───────────────┐
│ users         │ ─────────────▶ │ users (copy)  │
│ sessions      │   + retry job  │ orders        │
│ oauth config  │ ◀───reconcile─ │ ...           │
└───────────────┘                └───────────────┘
        the id here  ─── must match ─── the foreign key here
```

None of that glue is business logic. It exists only because identity lives in one place and your data lives in another, and the two have to be reconciled. When they drift, you get the classic bugs: an order row whose `user_id` points at a user your database never heard about, or a user who can sign in but has no profile because the webhook that was supposed to create it got a 500 and never retried.

Neon Auth removes the two-systems problem by putting the auth server in the same project as the database.

## Turn it on

The whole configuration is one property. In `neon.ts`, the file that declares what services your Neon project runs, you set `auth: true`:

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Provisions a Neon Auth server on this branch. Postgres is on by default.
  auth: true,
});
```

Then deploy. `neon deploy` provisions the service and writes its connection details into your local `.env.local` for development:

```terminal
{
  "title": "provision auth",
  "prompt": "$",
  "steps": [
    { "cmd": "neon deploy", "output": "Applied changes\n  create  service  auth\nUtilized services: Postgres, Neon Auth" },
    { "comment": "the auth server's URLs are injected for you" },
    { "cmd": "grep NEON_AUTH .env.local", "output": "NEON_AUTH_BASE_URL=\"https://<id>.neonauth.<region>.aws.neon.tech/neondb/auth\"\nNEON_AUTH_JWKS_URL=\"https://<id>.neonauth.<region>.aws.neon.tech/neondb/auth/.well-known/jwks.json\"" }
  ]
}
```

That is the entire setup. There is no second project to create, no separate dashboard, no API key to copy between systems. The base URL is where users sign in and out; the JWKS URL is where you fetch the public keys to verify tokens.

## What you get: a token and a way to trust it

Neon Auth is built on Better Auth, so the HTTP surface is the standard set of endpoints under the base URL: `/sign-up/email`, `/sign-in/email`, `/get-session`, `/token`, and the JWKS at `/.well-known/jwks.json`. A signed-in session exchanges for a JWT at `/token`. Decoded, that token carries the claims you would expect:

```json
{
  "sub": "e2163035-50f4-4753-906d-78b79a124b0b",
  "name": "Alice",
  "email": "alice@example.com",
  "role": "authenticated",
  "iss": "https://<id>.neonauth.<region>.aws.neon.tech",
  "exp": 1782990705
}
```

The token is signed with EdDSA (an Ed25519 key), and the JWKS endpoint serves the matching public key. That means any backend can verify a token without sharing a secret with the auth server: fetch the public key, check the signature, check the issuer. In a Neon Function the whole verification is a few lines with [jose](https://github.com/panva/jose):

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;

async function verify(token: string) {
  // Throws if the signature, issuer, or expiry is wrong.
  const { payload } = await jwtVerify(token, jwks, { issuer });
  return { id: payload.sub as string, name: payload.name as string };
}
```

`createRemoteJWKSet` fetches and caches the public keys, so this does not hit the network on every request. Nothing here is Neon-specific cryptography; it is standard JWT verification against a JWKS, which is exactly the point. Your backend does not need a Neon SDK to trust a Neon Auth token.

On the frontend you do not hand-roll any of this. The `@neondatabase/auth` package gives you a client and server helper, and `@neondatabase/auth-ui` ships the sign-in and sign-up screens, so a Next.js app wires up with a provider and a catch-all route rather than a login form you build yourself. The demo repo has the full wiring.

## The part that matters: the user is a row in your database

This is where the single-project design pays off. Neon Auth stores its data in a `neon_auth` schema inside the same Postgres as your app. It is not hidden behind an API; it is tables you can query:

```terminal
{
  "title": "auth data is just Postgres",
  "prompt": "=>",
  "steps": [
    { "cmd": "\\dt neon_auth.*", "output": "neon_auth.user\nneon_auth.session\nneon_auth.account\nneon_auth.verification\nneon_auth.jwks   ..." },
    { "cmd": "select id, name, email from neon_auth.\"user\";", "output": "e2163035-...  Alice      alice@example.com\n957f0068-...  Chat Test  chat-test@example.com" }
  ]
}
```

The `id` in `neon_auth.user` is the same value as the `sub` claim in the JWT. So when your app stores something owned by a user, you store that id, and it is a genuine foreign key into a table sitting in the same database. You can join across the two:

```sql
-- messages your app wrote, next to the identity that wrote them,
-- resolved in one query against one database.
select m.id, m.body, u.email
from public.messages m
join neon_auth."user" u on u.id::text = m.user_id
order by m.id;
```

```text
 id |     body      |        email
----+---------------+----------------------
  1 | hello         | alice@example.com
  2 | welcome back  | chat-test@example.com
```

There is no webhook that copied `alice@example.com` into your schema, and no reconciliation job to make sure it stays copied. The message row and the user row are in the same Postgres, so the join is a normal join. That is the whole reconciliation tax from earlier, gone: not automated, just absent.

:::note
`neon_auth.user.id` is a `uuid`, so if you store the user id as `text` in your own tables you cast with `u.id::text` in the join (as above). Store the column as `uuid` from the start and the cast goes away. Either way it is one database and one query.
:::

## Auth that branches with your data

Neon's headline feature is database branching: fork the whole database, data and all, in seconds. Because auth state lives in the same Postgres, it branches too. Create a branch for a preview environment and it comes with its own `neon_auth` schema, its own users, its own sessions. Someone signing up against a preview branch is not creating an account in production.

With a separate auth service this is genuinely hard. You either point every preview at one shared auth tenant (so preview signups pollute real data) or you script the creation and teardown of a throwaway tenant per environment. When auth lives in the branch, you get an isolated identity store for free every time you branch, and it disappears when the branch does.

## The repo

A full working example, a Next.js app with Neon Auth plus a WebSocket chat backend that verifies these tokens, is here:

```github
https://github.com/The-DevOps-Daily/neon-auth-demo
```

The next post in this series, [realtime chat with auth](https://devops-daily.com/posts/neon-realtime-chat-with-auth), builds on this and takes the token to the hard place: authenticating a WebSocket, where the browser cannot even set an `Authorization` header.

## Wrapping up

Most auth setups carry a hidden cost that has nothing to do with authentication: the work of keeping a separate identity system in sync with your database. Neon Auth removes that cost by not having a separate system. One line of config provisions an auth server in your project; it issues standard JWTs you verify against a JWKS with no shared secret; and the users it manages are rows in a `neon_auth` schema you can join to your own tables. The identity that signs in and the data it owns live in the same Postgres, and branch together. That is a smaller, more boring architecture than the two-system norm, which is exactly what you want from the auth layer.
