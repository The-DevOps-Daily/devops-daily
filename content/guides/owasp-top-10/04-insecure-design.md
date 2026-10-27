---
title: 'A06:2025 Insecure Design'
description: 'A06:2025 Insecure Design: business logic flaws, threat modeling, abuse cases turned into tests, safe recovery flows and paved roads for secure defaults.'
order: 7
---

**TLDR**: Insecure design means a security control was never planned, so no amount of careful coding adds it later: a checkout that trusts the price the browser sends, a booking flow with no limit on group size, a password reset based on security questions. Find these flaws before code exists, with threat modeling during refinement, and write down the abuse cases next to the user stories. Then turn each abuse case into a test, and give teams secure building blocks (paved roads) so the safe way is also the easy way.

The OWASP Top 10 separates two kinds of flaws. An **implementation defect** is a mistake in building a control that was designed correctly, such as the SQL injection in [A05](/guides/owasp-top-10/03-injection). An **insecure design** is a control that is missing from the design itself. The [A06:2025 page](https://owasp.org/Top10/2025/A06_2025-Insecure_Design/) puts it plainly: an insecure design cannot be fixed by a perfect implementation.

The category slid from fourth to sixth place in 2025, and OWASP credits better threat modeling and secure design practices across the industry. It groups 39 CWEs, including trust boundary violations (CWE-501), unrestricted file upload (CWE-434) and unprotected storage of credentials (CWE-256), and it explicitly includes flaws in business logic.

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- The basics of threat modeling help. The [Threat Modeling guide](/guides/threat-modeling) covers STRIDE and attack trees.

## Design Security In, Then Test It

OWASP describes three parts of secure design: gathering security requirements with the business, creating a secure design with threat modeling, and a secure development lifecycle that learns from mistakes. In day-to-day work that becomes a loop for every significant feature:

```diagram
{
  "type": "loop",
  "nodes": [
    { "label": "Requirements", "sub": "data, users, limits", "variant": "soft" },
    { "label": "Threat model", "sub": "what can go wrong?", "variant": "soft" },
    { "label": "Abuse cases", "sub": "written into the story", "variant": "solid" },
    { "label": "Tests", "sub": "one per abuse case", "variant": "solid" },
    { "label": "Review", "sub": "incidents and findings", "variant": "accent" }
  ],
  "loopBack": "update the model when the feature changes",
  "goal": "controls that exist because someone planned them"
}
```

The useful questions in a refinement session are short:

- What data does this feature touch, and who may see or change it?
- Which values come from the client, and which must the server decide?
- What are the business limits (amounts, quantities, rates), and where are they enforced?
- What happens when a step fails halfway, or runs twice, or runs in parallel?
- How would someone abuse this feature at scale, with a script?

## Business Logic: Trust the Server, Not the Client

The vulnerable app's checkout accepts the total that the client sends:

```javascript
// A06: the client sends the total and the server believes it
app.post('/api/orders', (req, res) => {
  const { totalCents } = req.body;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO orders (user_id, total_cents) VALUES (?, ?)')
    .run(req.user.id, totalCents);
  res.status(201).json({ orderId: Number(lastInsertRowid), totalCents });
});
```

Nothing in that code is "injection" or a "missing check" in the usual sense; it does exactly what it was designed to do. The design is the problem: the browser decides the price. The fixed design lets the client choose only what it is allowed to choose, the product and the quantity, and derives everything else on the server, including a business limit that came from the requirements:

```javascript
// POST /api/orders: the server sets the price and enforces the business limits.
const MAX_QUANTITY = 10; // a business rule, written down in the user story

export function createOrder({ db }) {
  const product = db.prepare('SELECT id, price_cents FROM products WHERE id = ?');
  const insert = db.prepare('INSERT INTO orders (user_id, total_cents) VALUES (?, ?)');

  return (req, res) => {
    const { productId, quantity } = req.body ?? {};
    if (!Number.isSafeInteger(productId) || !Number.isSafeInteger(quantity)) {
      return res.status(400).json({ error: 'productId and quantity must be integers' });
    }
    if (quantity < 1 || quantity > MAX_QUANTITY) {
      return res.status(422).json({ error: `quantity must be between 1 and ${MAX_QUANTITY}` });
    }
    const p = product.get(productId);
    if (!p) return res.status(404).json({ error: 'Unknown product' });
    // Any price or total in the request body is ignored.
    const totalCents = p.price_cents * quantity;
    const { lastInsertRowid } = insert.run(req.user.id, totalCents);
    res.status(201).json({ orderId: Number(lastInsertRowid), totalCents });
  };
}
```

```terminal
{
  "title": "the server sets the price and the limits",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export DEMO_PASSWORD='correct horse battery staple'"
    },
    {
      "cmd": "node src/server.js > app.log 2>&1 &"
    },
    {
      "cmd": "until curl -s -o /dev/null localhost:3000/; do sleep 0.2; done"
    },
    {
      "cmd": "ALICE=$(curl -s localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"correct horse battery staple\"}' | jq -r .token)"
    },
    {
      "cmd": "curl -s localhost:3000/api/orders -H \"authorization: Bearer $ALICE\" -H 'content-type: application/json' -d '{\"productId\": 1, \"quantity\": 2, \"totalCents\": 1}'; echo",
      "output": "{\"orderId\":1,\"totalCents\":99800}"
    },
    {
      "cmd": "curl -s localhost:3000/api/orders -H \"authorization: Bearer $ALICE\" -H 'content-type: application/json' -d '{\"productId\": 2, \"quantity\": 600}'; echo",
      "output": "{\"error\":\"quantity must be between 1 and 10\"}"
    },
    {
      "cmd": "kill %1"
    }
  ]
}
```

The `totalCents` that the client sent was ignored. The second request is OWASP's cinema example in miniature: a group booking flow with no upper limit lets one request book hundreds of seats. The limit belongs in the requirements, and the code enforces what the requirements say.

## Turn Abuse Cases Into Tests

OWASP recommends writing use cases and misuse cases for each tier and testing that critical flows resist the threat model. The companion app's design tests are two abuse cases written as code:

```javascript
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startApp } from './helpers.js';

describe('A06 insecure design: orders', () => {
  let app, alice;
  before(async () => {
    app = await startApp();
    alice = await app.loginAs('alice');
  });
  after(() => app.close());

  const order = (body) => app.call('POST', '/api/orders', { token: alice, body });

  it('ignores a total sent by the client', async () => {
    const res = await order({ productId: 1, quantity: 2, totalCents: 1 });
    assert.equal(res.status, 201);
    assert.equal(res.json.totalCents, 2 * 49900);
  });

  it('enforces the quantity limit from the business rules', async () => {
    assert.equal((await order({ productId: 2, quantity: 600 })).status, 422);
  });
});
```

```terminal
{
  "title": "the abuse cases as tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/design.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/design.test.js\n\n▶ A06 insecure design: orders\n  ✔ ignores a total sent by the client (39.788155ms)\n  ✔ enforces the quantity limit from the business rules (29.672456ms)\n✔ A06 insecure design: orders (526.774299ms)\nℹ tests 2\nℹ suites 1\nℹ pass 2\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1519.860053"
    }
  ]
}
```

Good abuse cases name the attacker's goal, not a technical trick: "a customer pays less than the price", "a user reads another tenant's report", "a bot buys the whole stock in the first second". Each one should end up as at least one test.

## Common Design Flaws

### Recovery Flows

OWASP's first example is a credential recovery flow based on security questions, which NIST SP 800-63B, the OWASP ASVS and the Top 10 all reject, because other people can know or find the answers. Design account recovery around something the user has: a reset link sent to a verified email address, or a recovery code issued when the account was created. Reset tokens need their own design:

```javascript
import { createHash, randomBytes } from 'node:crypto';

// Store only a hash of the token, give it a short life, and allow one use.
export function createResetToken(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
  db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
    userId,
    tokenHash,
    Date.now() + 15 * 60 * 1000
  );
  return token; // goes into the email link, never into a log
}
```

When the user follows the link, look the token up by its hash, check the expiry, delete the row in the same transaction that changes the password, and end the user's other sessions. Answer the reset request with the same message whether or not the address has an account.

### Automation and Abuse at Scale

Rate limits protect against more than password guessing. OWASP's scalper example is a store where bots buy every graphics card in the first seconds of a launch. Each business action that has value at scale (sign-ups, coupons, bookings, purchases of scarce stock, sending messages) needs its own limit and its own signals, such as purchases within seconds of availability. Decide them in the design, because they change the user experience.

### Trust Boundaries and Tenants

Write down where data crosses a trust boundary (browser to API, API to a partner, one tenant to another) and what is checked at each crossing. In a multi-tenant system, carry the tenant ID from the session through every layer, and segregate tenants by design: separate schemas, databases or row-level policies, not only a `WHERE tenant_id = ?` that every query must remember. File uploads are another boundary: decide the allowed types, sizes and storage location (outside the web root, on a separate domain) before writing the upload handler.

## Paved Roads

The most effective secure design work makes the safe way the default. OWASP calls these paved roads and secure component libraries: a shared project template, internal libraries and platform defaults that already include the controls, so each team does not design them again.

The companion app's `createApp` is a small example: every route it serves gets security headers, a request ID, a body size limit, `no-store` on API responses, authentication by default under `/api`, and the central error handler, without the route's author doing anything:

```javascript
export function createApp({ db, log, safeFetch = createSafeFetch() }) {
  const app = express();
  // Security headers; helmet also removes X-Powered-By. The CSP replaces helmet's
  // "https:" and "data:" sources with 'self', since this app loads nothing else.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'font-src': ["'self'"],
          'img-src': ["'self'"],
          'style-src': ["'self'"],
          'frame-ancestors': ["'none'"],
        },
      },
    })
  );
  app.use((req, res, next) => {
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(requestId);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); // API responses hold private data and tokens
    next();
  });
  app.use(express.json({ limit: '10kb' })); // nothing without a limit

  app.get('/', home);
  app.get('/hello', hello);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5, // failed attempts per client IP per window
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Requests over the limit never reach the login handler, so log them here.
    handler: (req, res, next, options) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.slice(0, 64) : '';
      log.warn(
        { event: `authn_login_fail_max:${name},${options.limit}`, ip: req.ip, reqId: req.id },
        'login rate limit'
      );
      res.status(options.statusCode).json({ error: 'Too many login attempts, try again later' });
    },
  });
  app.post('/api/login', loginLimiter, login({ db, log }));
```

In a larger organization, the same idea scales to a service template, an internal SDK with an SSRF-safe HTTP client, a shared authorization module and infrastructure modules with secure defaults.

## Common Mistakes

- **Threat modeling once.** Update the model when the data flows or permissions change.
- **Requirements without limits.** "Users can book seats" needs "up to 15 per booking".
- **Trusting values the client computes**: prices, totals, discounts, roles, account IDs.
- **Security questions and other knowledge-based recovery.**
- **Testing only the happy path.** Every abuse case from the threat model needs a test.
- **Leaving each team to design its own controls.** Build paved roads instead.

## Summary

- Insecure design is a missing control, and code alone cannot add it later.
- Threat model features during refinement, and write abuse cases into the stories.
- Derive prices, totals and limits on the server; the client chooses only what it may choose.
- Design recovery, rate limits, trust boundaries and tenant isolation up front.
- Turn abuse cases into tests, and give teams secure defaults they get for free.

Next, [A07:2025 Authentication Failures](/guides/owasp-top-10/07-authentication-failures) covers logins, passwords, sessions and MFA.

## Keep Learning

- [Threat Modeling guide](/guides/threat-modeling)
- [Practical exercises in the Threat Modeling guide](/guides/threat-modeling/04-practical-exercises)
- [Designing Rate Limiting for APIs](/posts/designing-rate-limiting-for-apis)
- [Interview questions: Security Architecture and DevSecOps](/interview-questions/senior/security-architecture)
