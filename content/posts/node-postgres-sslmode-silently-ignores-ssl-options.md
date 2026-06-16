---
title: 'node-postgres Silently Ignores Your TLS Config When the URL Says sslmode'
excerpt: 'If your connection string contains sslmode=require, the pg library throws away the ssl options object where you loaded your CA certificate, and verification fails with "self-signed certificate in certificate chain". Here is the trap, the fix, and the v9 changes coming.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-10'
publishedAt: '2026-06-10T20:00:00Z'
updatedAt: '2026-06-10T20:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - postgres
  - nodejs
  - tls
  - supabase
  - debugging
  - databases
---

While building a [benchmark harness for Neon and Supabase](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks), we lost an hour to a TLS failure that made no sense. The CA certificate was correct. The chain verified fine with `openssl`. A raw Node `tls.connect` with the same CA returned `authorized: true`. And node-postgres still failed every connection with:

```
Error: self-signed certificate in certificate chain
```

The cause turned out to be a behavior of `pg` (node-postgres) that is easy to hit and hard to suspect: **when your connection string contains an `sslmode` parameter, the `ssl` options object you pass to the client is silently ignored.** Your carefully loaded CA file never reaches the TLS socket.

## The trap, reproduced

This is the code almost everyone writes when a provider's certs chain to a private CA (Supabase, DigitalOcean managed Postgres, Crunchy Bridge, most internal platforms):

```javascript
import pg from 'pg';
import { readFileSync } from 'node:fs';

const client = new pg.Client({
  connectionString: 'postgresql://user:pass@db.example.com:5432/postgres?sslmode=require',
  ssl: {
    ca: readFileSync('./provider-ca.crt', 'utf8'),
  },
});

await client.connect();
// => Error: self-signed certificate in certificate chain
```

It reads like "require TLS, and here is the CA to verify against". What actually happens: `pg-connection-string` parses `sslmode=require` from the URL into its own ssl configuration, and that parsed value takes precedence over the `ssl` object you passed. Your `ca` is gone. The connection attempts full verification against the system trust store, the private CA is not in it, and you get the self-signed error even though you are holding the right certificate in your hand.

The same code with the parameter removed from the URL works immediately:

```javascript
const client = new pg.Client({
  // no sslmode in the URL
  connectionString: 'postgresql://user:pass@db.example.com:5432/postgres',
  ssl: {
    ca: readFileSync('./provider-ca.crt', 'utf8'),
  },
});

await client.connect(); // verified against your CA, connects fine
```

Nothing about the error message points at the URL. That is what makes this trap expensive: every debugging instinct says "wrong CA file" or "incomplete chain", and both are red herrings you can burn an hour on, like we did.

## The rule to remember

**Configure TLS in exactly one place.** With node-postgres, that place should be the `ssl` option:

- Strip `sslmode` (and `sslcert`, `sslkey`, `sslrootcert`) out of connection strings your code receives, or never put them there.
- Put everything TLS-related in the `ssl` object: `ca` for private CAs, plus client certs if you use them.
- An `ssl` object with a `ca` implies verification. Never "fix" this error with `rejectUnauthorized: false`; that disables verification entirely and turns your database connection into a man-in-the-middle exercise.

If the connection string comes from an environment variable you do not control, sanitize it:

```javascript
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete('sslmode');

const client = new pg.Client({
  connectionString: url.toString(),
  ssl: { ca: readFileSync('./provider-ca.crt', 'utf8') },
});
```

## It gets stranger: sslmode does not mean what libpq taught you

If you watched your Node process closely while reproducing this, you saw a warning that documents a second surprise:

```
Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'
are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these
modes will adopt standard libpq semantics, which have weaker security guarantees.
```

In libpq (the C library that psql and most languages' drivers wrap), `sslmode=require` means "encrypt, but do not verify the certificate". In current node-postgres, `require` is treated as `verify-full`: encrypt AND verify hostname AND chain. Stricter than what the same string means everywhere else, which is exactly why the failure above happens with providers on private CAs: psql connects happily with `sslmode=require` while your Node service refuses.

Two practical consequences:

- A connection string copied from provider docs (written with libpq semantics in mind) can work in psql and fail in Node with the same `sslmode=require`.
- When pg v9 lands, the same string changes meaning again, to the weaker libpq behavior. If you rely on `sslmode=require` giving you verification today, that silently stops being true on upgrade. One more reason to own TLS in the `ssl` object and keep the URL clean. If you need the libpq behavior now, pg already supports `uselibpqcompat=true&sslmode=require`.

## The Supabase specifics, since that is where most people hit this

Three details that compound the confusion when the provider is Supabase:

**Their certs chain to a private CA.** Database connections present certificates signed by "Supabase Root 2021 CA", not a public authority. Download the root from the dashboard (Database settings, SSL) and pass it via `ssl.ca`. With the URL trap above, this is the step that looks broken even when you did it right.

**Free-plan direct hosts are IPv6-only.** `db.<ref>.supabase.co` has no A record. If your client runs on an IPv4-only network (most CI runners, many VPSes, lots of home ISPs), direct connections cannot work at all and you must use their Supavisor pooler instead: session mode on port 5432, transaction mode on 6543. The pooler presents the same private-CA chain, so the `ssl.ca` requirement follows you there.

**The pooler hostname varies per project.** Our first benchmark project landed on `aws-1-eu-central-1.pooler.supabase.com` while most docs and tutorials show `aws-0-...`. Both clusters exist. Read your project's actual connection details from the dashboard or the Management API rather than pattern-matching a tutorial.

None of this is unique to Supabase; any provider with a private CA plus a pooler can serve the same combination. Supabase just happens to be where a lot of Node developers meet all three at once.

## A five-line sanity test that would have saved us an hour

When TLS fails and you suspect the CA, test the chain without pg in the way:

```javascript
import tls from 'node:tls';
import net from 'node:net';
import { readFileSync } from 'node:fs';

const sock = net.connect(5432, 'your-db-host', () => {
  sock.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])); // Postgres SSLRequest
  sock.once('data', () => {
    const t = tls.connect(
      { socket: sock, ca: readFileSync('./provider-ca.crt'), servername: 'your-db-host' },
      () => console.log('authorized:', t.authorized, t.authorizationError ?? '')
    );
  });
});
```

Postgres TLS starts with an in-protocol handshake (that 8-byte `SSLRequest` message), so plain `openssl s_client` needs `-starttls postgres` for the same check. If this prints `authorized: true` while pg fails with the same CA, you are not fighting certificates. You are fighting configuration precedence, and the URL is the first place to look.

## Takeaways

- `sslmode` in a node-postgres connection string overrides your `ssl` options object. Silently. Keep TLS config in the `ssl` object and keep `sslmode` out of your URLs.
- node-postgres currently treats `require` as `verify-full`, unlike libpq. pg v9 will flip to libpq semantics, weakening what your existing strings mean.
- Never reach for `rejectUnauthorized: false`. The fix is removing the conflicting URL parameter, not removing verification.
- For Supabase specifically: grab their root CA, expect IPv6-only direct hosts on the free plan, and read the pooler hostname from your own project settings.

The full context, with measured numbers around it, is in our [Neon vs Supabase free tier benchmarks](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks), and the harness where we hit this is open at [The-DevOps-Daily/serverless-postgres-benchmarks](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks) with a [live results dashboard](https://postgres-benchmarks.devops-daily.com/).
