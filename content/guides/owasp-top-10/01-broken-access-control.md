---
title: 'A01:2025 Broken Access Control'
description: 'A01:2025 Broken Access Control: IDOR, missing role checks, CORS, path traversal and CSRF, with Express fixes and tests that prove every check.'
order: 1
---

**TLDR**: Broken access control means a user can read or change something that is not theirs, or call a function above their role. It is first in the OWASP Top 10:2025, as it was in 2021, and now also covers server-side request forgery. Check ownership on the server for every request, ideally inside the database query; deny by default; return 404 for records that exist but are not the caller's; and write a test for each check, so removing one fails the build.

Access control decides who may do what. Authentication answers "who is this?"; access control (authorization) answers "may this user do this to this record?". A login screen does not protect anything on its own: once a user has a session, every route still has to check what that session is allowed to touch.

In the 2025 data, every tested application had some form of broken access control. The category groups 40 CWEs, the most occurrences of any category (1.8 million) and the second most CVEs, according to the [A01:2025 page](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/). Server-side request forgery (CWE-918, covered in [the next part](/guides/owasp-top-10/10-ssrf)) joined it in 2025, next to weaknesses it already included, such as cross-site request forgery (CWE-352).

## Prerequisites

- The companion app set up as described in the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- `curl` and `jq` to call the API.

## How Access Control Fails

The OWASP description lists the usual ways:

- **Insecure direct object references (IDOR)**: changing an ID in a URL or request body to reach someone else's record.
- **Missing function-level checks**: an admin route that checks for a login but not for the admin role, often on `POST`, `PUT` and `DELETE`.
- **Force browsing**: requesting URLs the interface never links to, such as `/admin`.
- **Checks only in the front end**: hiding a button is not access control; anyone can send the request with `curl`.
- **Tampered tokens and metadata**: editing a cookie, a hidden field or an unverified JWT claim such as `role: admin`.
- **CORS misconfiguration**: letting any website call your API with the user's credentials.
- **Path traversal**: a file name such as `../../etc/passwd` that escapes the intended directory.

The companion app shows the first two in code, and the other patterns follow later in this part.

## Insecure Direct Object References

Here is the invoice route in the vulnerable version. It checks that the caller is logged in (the `authenticate` middleware runs before it), but not whose invoice it is:

```javascript
// A01: any logged-in user can read any invoice by changing the ID
app.get('/api/invoices/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  res.json(invoice);
});
```

Invoice IDs are sequential, so a logged-in user can walk through all of them. Unpredictable IDs such as UUIDs make guessing harder, but they are not access control: IDs leak through logs, shared links and browser history.

The fixed route puts the owner into the query itself. A record that exists but belongs to someone else is indistinguishable from one that does not exist:

```javascript
// GET /api/invoices/:id: the owner check is part of the query itself.
r.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const invoice = db
    .prepare('SELECT id, amount_cents, memo FROM invoices WHERE id = ? AND user_id = ?')
    .get(id, req.user.id);
  if (!invoice) {
    // 404 for "missing" and "not yours", so IDs cannot be probed.
    log.warn(
      { event: `authz_fail:${req.user.name},invoice ${id}`, ip: req.ip, reqId: req.id },
      'not found'
    );
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(invoice);
});
```

Three details matter here:

- **The check is part of the data access.** `WHERE id = ? AND user_id = ?` cannot forget the owner the way a separate `if` after the query can.
- **404, not 403.** A 403 would confirm that invoice 1002 exists. Use 403 when the caller may know the resource exists but may not use it, such as an admin page.
- **The failure is logged** with a standard event name, `authz_fail`, so repeated attempts can raise an alert ([A09](/guides/owasp-top-10/09-logging-failures) covers this).

## Missing Function-Level Checks

The vulnerable app's admin endpoint is only behind the login check:

```javascript
// A01: an admin function that only checks for a login, not for the admin role
app.get('/api/admin/users', (req, res) => {
  res.json(db.prepare('SELECT id, name, role FROM users ORDER BY id').all());
});
```

The fixed app adds a role check middleware in front of the handler:

```javascript
// Vertical access control: deny unless the role matches.
export function requireRole(role, { log }) {
  return (req, res, next) => {
    if (req.user?.role === role) return next();
    log.warn(
      {
        event: `authz_fail:${req.user?.name},${req.method} ${req.path}`,
        ip: req.ip,
        reqId: req.id,
      },
      'forbidden'
    );
    res.status(403).json({ error: 'Forbidden' });
  };
}
```

```javascript
app.get('/api/admin/users', requireRole('admin', { log }), (req, res) => {
  res.json(db.prepare('SELECT id, name, role FROM users ORDER BY id').all());
});
```

## Try It

Start the fixed app, log in as `alice`, and request her invoice, Bob's invoice and the admin list:

```terminal
{
  "title": "access control in the fixed app",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export DEMO_PASSWORD='correct horse battery staple'"
    },
    {
      "cmd": "node src/server.js > app.log 2>&1 &"
    },
    {
      "comment": "wait until the server answers",
      "cmd": "until curl -s -o /dev/null localhost:3000/; do sleep 0.2; done"
    },
    {
      "cmd": "ALICE=$(curl -s localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"correct horse battery staple\"}' | jq -r .token)"
    },
    {
      "cmd": "curl -s localhost:3000/api/invoices/1001 -H \"authorization: Bearer $ALICE\"; echo",
      "output": "{\"id\":1001,\"amount_cents\":12000,\"memo\":\"Alice: hosting, October\"}"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/invoices/1002 -H \"authorization: Bearer $ALICE\"",
      "output": "{\"error\":\"Not found\"} 404"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/admin/users -H \"authorization: Bearer $ALICE\"",
      "output": "{\"error\":\"Forbidden\"} 403"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/invoices/1001",
      "output": "{\"error\":\"Authentication required\"} 401"
    }
  ]
}
```

Alice gets her own invoice, a 404 for Bob's, a 403 for the admin function, and a request without a token gets a 401. Stop the server when you are done:

```terminal
{
  "title": "stop the server",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kill %1"
    }
  ]
}
```

## Prove Each Check With a Test

Code review misses access checks because a missing line is hard to see. A test that logs in as one user and asks for another user's data catches it every time. This is the access control test file from the companion app:

```javascript
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startApp } from './helpers.js';

describe('A01 broken access control', () => {
  let app, alice, admin;
  before(async () => {
    app = await startApp();
    alice = await app.loginAs('alice');
    admin = await app.loginAs('admin');
  });
  after(() => app.close());

  it('rejects requests without a session', async () => {
    assert.equal((await app.call('GET', '/api/invoices/1001')).status, 401);
  });

  it('lets alice read her own invoice', async () => {
    const res = await app.call('GET', '/api/invoices/1001', { token: alice });
    assert.equal(res.status, 200);
    assert.equal(res.json.id, 1001);
  });

  it("does not let alice read bob's invoice", async () => {
    const res = await app.call('GET', '/api/invoices/1002', { token: alice });
    assert.equal(res.status, 404);
  });

  it('keeps the admin user list from regular users', async () => {
    assert.equal((await app.call('GET', '/api/admin/users', { token: alice })).status, 403);
    assert.equal((await app.call('GET', '/api/admin/users', { token: admin })).status, 200);
  });
});
```

Against the fixed app, all four tests pass:

```terminal
{
  "title": "the tests against the fixed app",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/access.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/access.test.js\n\n▶ A01 broken access control\n  ✔ rejects requests without a session (25.831397ms)\n  ✔ lets alice read her own invoice (20.389544ms)\n  ✔ does not let alice read bob's invoice (17.297918ms)\n  ✔ keeps the admin user list from regular users (30.725647ms)\n✔ A01 broken access control (726.224167ms)\nℹ tests 4\nℹ suites 1\nℹ pass 4\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1550.242313"
    }
  ]
}
```

Now run the same file against the vulnerable version. This is what your CI shows when someone removes an ownership check:

```terminal
{
  "title": "the same tests against the vulnerable app",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "APP=vulnerable npm test -- tests/access.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/access.test.js\n\n▶ A01 broken access control\n  ✔ rejects requests without a session (22.918399ms)\n  ✔ lets alice read her own invoice (24.182345ms)\n  ✖ does not let alice read bob's invoice (26.899605ms)\n  ✖ keeps the admin user list from regular users (20.478876ms)\n✖ A01 broken access control (660.415224ms)\nℹ tests 4\nℹ suites 1\nℹ pass 2\nℹ fail 2\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1602.084435\n\n✖ failing tests:\n\ntest at tests/access.test.js:24:3\n✖ does not let alice read bob's invoice (26.899605ms)\n  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\n  200 !== 404"
    }
  ]
}
```

Write one such test for each resource type and each role boundary. They are cheap, fast and permanent, unlike a one-off penetration test.

## Deny by Default

Most access control bugs are a route that nobody remembered to protect. Structure the app so that a new route is protected unless someone opts out on purpose. In the companion app, the login route and the public pages are registered first, and everything under `/api` registered after them goes through `authenticate`:

```javascript
app.post('/api/login', loginLimiter, login({ db, log }));

// Everything below needs a valid session.
app.use('/api', authenticate({ db, log }));
app.post('/api/logout', logout({ db, log }));
app.use('/api/invoices', invoiceRoutes({ db, log }));
```

The same idea applies at every layer: an API gateway or ingress that rejects unauthenticated requests by default, a cloud IAM policy that starts from no permissions, and a database role that can read only the tables it needs.

As the rules grow (teams, shared documents, delegated access), move them out of scattered `if` statements into one policy module or a policy engine. [Moving Authorization Out of Your App Code](/posts/authorization-if-statements-vs-cerbos-vs-spicedb) compares plain code, Cerbos and SpiceDB with measurements.

## Other Access Control Failures

### Checks Only in the Front End

The third example attack in the OWASP A01 page is an application that keeps all its access control in browser JavaScript. The attacker skips the browser and calls the API with `curl`. Hiding a menu item is good user experience; the server must still enforce the same rule.

### CORS Misconfiguration

Cross-Origin Resource Sharing (CORS) tells browsers which other websites may call your API from JavaScript. Reflecting every origin while allowing credentials lets any website make requests with your users' cookies:

```javascript
import cors from 'cors';

// VULNERABLE: any website may call the API with the user's cookies
app.use(cors({ origin: true, credentials: true }));
```

Allow only the origins you serve, and only on the routes that need it:

```javascript
import cors from 'cors';

const allowedOrigins = new Set(['https://app.example.com', 'https://admin.example.com']);

app.use(
  '/api',
  cors({
    origin: (origin, callback) => callback(null, allowedOrigins.has(origin)),
    credentials: true,
  })
);
```

CORS is a browser rule, not access control. It does nothing against `curl` or a server-side client, so the checks above still apply.

### Path Traversal

A route that serves files by name must not let the name leave its directory:

```javascript
import path from 'node:path';

// VULNERABLE: "../../etc/passwd" leaves the uploads directory
app.get('/files/:name', (req, res) => {
  res.sendFile(path.join('/srv/uploads', req.params.name));
});
```

Use the `root` option of `res.sendFile`, which rejects paths that try to leave the root, and validate the name against what your application creates:

```javascript
const FILE_NAME = /^[a-z0-9-]{1,64}\.(pdf|png)$/;

app.get('/files/:name', (req, res) => {
  if (!FILE_NAME.test(req.params.name)) return res.status(400).end();
  res.sendFile(req.params.name, { root: '/srv/uploads' });
});
```

Then apply the ownership check to the file as to any other record: a valid file name is not permission to read it.

### Sessions, Tokens and CSRF

- End sessions on the server at logout. A stateless JWT stays valid until it expires, so keep access tokens short-lived and revoke refresh tokens. [Part 8](/guides/owasp-top-10/07-authentication-failures) covers session handling.
- Never trust a role or user ID that the client can edit, such as a claim in an unverified token or a hidden form field. Read it from the server-side session or a verified token.
- Cross-site request forgery (CSRF) affects applications that authenticate with cookies, because browsers attach cookies to requests from other sites. Use `SameSite=Lax` or `Strict` cookies and a CSRF token, or reject state-changing requests whose `Origin` or `Sec-Fetch-Site` header shows another site. The companion app uses bearer tokens in the `Authorization` header, which browsers never add on their own, so CSRF does not apply to it.

## Defense in Depth: Row-Level Security

If your database supports row-level security (RLS), it can enforce ownership even when application code forgets. In PostgreSQL, the application sets the current user for each transaction, and a policy filters every query:

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY; -- apply it to the table owner too

CREATE POLICY invoices_owner ON invoices
  USING (user_id = current_setting('app.user_id')::integer)
  WITH CHECK (user_id = current_setting('app.user_id')::integer);

-- In the application, inside each transaction:
BEGIN;
SELECT set_config('app.user_id', '1', true); -- true: only for this transaction
SELECT id, memo FROM invoices; -- returns only user 1's rows
COMMIT;
```

Two caveats: superusers and roles with `BYPASSRLS` skip the policies, so connect as an ordinary role; and with a connection pool, always set the user inside the transaction (the `true` argument), so it cannot leak to the next request on the same connection.

## Common Mistakes

- **Checking authentication only.** A valid session says who the user is, not what they may access.
- **Fetching first, checking later.** A check after the query is easy to skip in one handler. Put the owner in the query.
- **Trusting IDs from the client for ownership.** Take the user ID from the session, never from the request body.
- **Protecting `GET` but not `PUT` and `DELETE`.** Test every method on every route.
- **Relying on UUIDs.** Hard-to-guess IDs reduce enumeration; they do not replace a check.
- **No tests.** An access check without a test disappears in the next refactor.

## Summary

- Broken access control is still the most common serious risk, and in 2025 it also includes SSRF.
- Enforce ownership on the server, inside the data access, for every request and method.
- Deny by default: protect a whole route prefix, then open specific routes on purpose.
- Return 404 for records that are not the caller's, and log the failure.
- Write a test per boundary, and run it against a broken version once to see it fail.

Next, the [SSRF part](/guides/owasp-top-10/10-ssrf) covers the access control failure that turns your own server into the attacker's client.

## Keep Learning

- [Moving Authorization Out of Your App Code: If-Statements vs Cerbos vs SpiceDB](/posts/authorization-if-statements-vs-cerbos-vs-spicedb)
- [The gRPC-Go Auth Bypass Hiding in Your Dependency Tree](/posts/grpc-go-authorization-bypass-cve-2026-33186)
- [STRIDE in the Threat Modeling guide](/guides/threat-modeling/01-stride), for finding access control gaps before you write code
- [Security-Focused Code Reviews](/posts/security-focused-code-reviews)
