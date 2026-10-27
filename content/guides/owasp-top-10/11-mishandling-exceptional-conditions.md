---
title: 'A10:2025 Mishandling of Exceptional Conditions'
description: 'A10:2025 Mishandling of Exceptional Conditions, new in 2025: fail closed, roll back partial transactions, handle errors in one place, limit everything.'
order: 11
---

**TLDR**: A10 is new in the OWASP Top 10:2025. It covers what happens when something unexpected occurs: an exception halfway through a transfer, a permission service that times out, a missing parameter, a request that is too large. Fail closed (deny when a check cannot complete), roll back every partial transaction, catch errors where they happen and handle the rest in one global handler, return generic messages while logging the details, and put a limit on every resource.

The [A10:2025 page](https://owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions/) groups 24 CWEs that used to be filed under general code quality, such as error messages that contain sensitive information (CWE-209), failure to handle a missing parameter (CWE-234), improper handling of insufficient privileges (CWE-274), NULL pointer dereference (CWE-476) and not failing securely (CWE-636). OWASP describes three ways to fail: not preventing an unusual situation, not noticing it while it happens, and responding poorly or not at all afterwards.

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.

## Fail Closed

The classic exceptional-condition bug is a security check that allows access when it breaks. Here a permission check calls another service, and the error path returns the wrong answer:

```javascript
// VULNERABLE: fails open. A timeout or a bug in the policy service grants access.
async function canExport(req, report) {
  try {
    return await policyService.check(req.user.id, 'export', report.id);
  } catch (err) {
    log.error({ err, reqId: req.id }, 'policy check failed');
    return true;
  }
}
```

The fixed version denies on any error, and so does the code that calls it:

```javascript
// Fails closed: anything other than an explicit "true" from the policy service is a no.
async function canExport(req, report) {
  try {
    return (await policyService.check(req.user.id, 'export', report.id)) === true;
  } catch (err) {
    log.error(
      { err, event: `authz_fail:${req.user.name},export`, ip: req.ip, reqId: req.id },
      'policy check failed'
    );
    return false;
  }
}
```

The same rule applies to every security control that can fail: signature verification, token introspection, a malware scan of an upload, a feature flag that gates an admin function. When the check cannot finish, the answer is no, and the event is logged and, if it repeats, alerted ([A09](/guides/owasp-top-10/09-logging-failures)).

## Roll Back Partial Transactions

OWASP's third example attack is a multi-step money transfer that fails halfway: debit the source, credit the destination, log the transaction. If an error after the debit does not undo it, money disappears, or a retry sends it twice. The vulnerable app's transfer has exactly that shape:

```javascript
// A10: the debit stays when the credit fails
app.post('/api/transfers', (req, res) => {
  const { from, to, amountCents } = req.body;
  db.prepare(
    'UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ? AND user_id = ?'
  ).run(amountCents, from, req.user.id);
  const { changes } = db
    .prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?')
    .run(amountCents, to);
  if (changes !== 1) throw new Error(`account ${to} not found`);
  res.status(201).json({ from, to, amountCents });
});
```

Run both versions side by side and transfer 25.00 from Alice's account to an account that does not exist:

```terminal
{
  "title": "a failed transfer in the vulnerable app",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export DEMO_PASSWORD='correct horse battery staple'"
    },
    {
      "cmd": "node vulnerable/server.js > vulnerable.log 2>&1 &"
    },
    {
      "cmd": "node src/server.js > app.log 2>&1 &"
    },
    {
      "cmd": "until curl -s -o /dev/null localhost:3001/ && curl -s -o /dev/null localhost:3000/; do sleep 0.2; done"
    },
    {
      "cmd": "LOGIN='{\"name\": \"alice\", \"password\": \"correct horse battery staple\"}'"
    },
    {
      "cmd": "V=$(curl -s localhost:3001/api/login -H 'content-type: application/json' -d \"$LOGIN\" | jq -r .token)"
    },
    {
      "cmd": "curl -s localhost:3001/api/accounts -H \"authorization: Bearer $V\"; echo",
      "output": "[{\"id\":1,\"balance_cents\":10000}]"
    },
    {
      "cmd": "curl -s -o /dev/null -w '%{http_code}\\n' localhost:3001/api/transfers -H \"authorization: Bearer $V\" -H 'content-type: application/json' -d '{\"from\": 1, \"to\": 999, \"amountCents\": 2500}'",
      "output": "500"
    },
    {
      "cmd": "curl -s localhost:3001/api/accounts -H \"authorization: Bearer $V\"; echo",
      "output": "[{\"id\":1,\"balance_cents\":7500}]"
    }
  ]
}
```

The request failed with a 500, and Alice's balance dropped from 100.00 to 75.00 anyway: the debit was committed, the credit never happened. The fixed transfer runs both updates in one database transaction and rolls back on any error:

```javascript
// POST /api/transfers: move money between two accounts, all or nothing.
export function transfer({ db, log }) {
  const debit = db.prepare(
    'UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ? AND user_id = ?'
  );
  const credit = db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?');
  const audit = db.prepare(
    'INSERT INTO transfers (user_id, from_account, to_account, amount_cents) VALUES (?, ?, ?, ?)'
  );

  return (req, res) => {
    const { from, to, amountCents } = req.body ?? {};
    if (![from, to, amountCents].every(Number.isSafeInteger) || amountCents <= 0 || from === to) {
      return res.status(400).json({ error: 'from, to and a positive amountCents are required' });
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      // The CHECK (balance_cents >= 0) constraint throws on overdraft.
      if (debit.run(amountCents, from, req.user.id).changes !== 1) {
        throw Object.assign(new Error('source account not found'), { status: 404, expose: true });
      }
      if (credit.run(amountCents, to).changes !== 1) {
        throw Object.assign(new Error('destination account not found'), {
          status: 404,
          expose: true,
        });
      }
      // The audit record is part of the same transaction: no transfer without one.
      const { lastInsertRowid } = audit.run(req.user.id, from, to, amountCents);
      db.exec('COMMIT');
      log.info(
        {
          event: `transfer_created:${req.user.name}`,
          transferId: Number(lastInsertRowid),
          reqId: req.id,
        },
        'transfer'
      );
    } catch (err) {
      if (db.isTransaction) db.exec('ROLLBACK'); // fail closed: undo the debit too
      log.warn(
        { event: 'transfer_failed', reason: err.message, user: req.user.name, reqId: req.id },
        'rollback'
      );
      if (err.errstr === 'constraint failed') {
        throw Object.assign(new Error('insufficient funds'), { status: 409, expose: true });
      }
      throw err;
    }
    res.status(201).json({ from, to, amountCents });
  };
}
```

```terminal
{
  "title": "the same transfers in the fixed app",
  "prompt": "$",
  "steps": [
    {
      "cmd": "F=$(curl -s localhost:3000/api/login -H 'content-type: application/json' -d \"$LOGIN\" | jq -r .token)"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/transfers -H \"authorization: Bearer $F\" -H 'content-type: application/json' -d '{\"from\": 1, \"to\": 999, \"amountCents\": 2500}'",
      "output": "{\"error\":\"destination account not found\",\"requestId\":\"dcfaa247-5ab0-41c2-b051-9e9e77d81d54\"} 404"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/transfers -H \"authorization: Bearer $F\" -H 'content-type: application/json' -d '{\"from\": 1, \"to\": 2, \"amountCents\": 1000000}'",
      "output": "{\"error\":\"insufficient funds\",\"requestId\":\"6aa4493f-05a8-4a25-9d42-18f2becce63a\"} 409"
    },
    {
      "cmd": "curl -s localhost:3000/api/accounts -H \"authorization: Bearer $F\"; echo",
      "output": "[{\"id\":1,\"balance_cents\":10000}]"
    }
  ]
}
```

Both failures leave the balance untouched. Details of the design:

- **`BEGIN IMMEDIATE`** takes the write lock at the start, so two transfers cannot interleave between the debit and the credit.
- **The database enforces the invariant.** The `CHECK (balance_cents >= 0)` constraint makes an overdraft impossible even if the code forgets to check, and the error maps to a clear 409.
- **The audit record commits with the money.** The `transfers` row is written inside the same transaction, so there is never a transfer without a record, or a record without a transfer.
- **Rollback only if a transaction is open.** Calling `ROLLBACK` when SQLite has already ended the transaction would throw a second error and hide the first.
- **Retries need idempotency.** If a client retries after a timeout, the server must recognize the request (an idempotency key stored with the transfer) so it does not run twice ([How Stripe Avoids Double Charging](/posts/how-stripe-avoids-double-charging-idempotency-keys) shows the pattern). OWASP's example mentions this race too.

## Handle Errors in One Place

OWASP asks for two layers: catch errors where they happen and handle them meaningfully, and have one global handler for everything that slips through, so the application never ends up in an unknown state or leaks a stack trace. In Express 5, a handler that throws or returns a rejected promise passes the error to the error handler; in Express 4, a rejected promise from an `async` handler was not caught, which left the request hanging or crashed the process. The companion app's central handler is shown in [A02](/guides/owasp-top-10/05-security-misconfiguration#h2-errors-without-internals): it logs the details with a request ID and returns a short message. The vulnerable app has no handler of its own, so its log shows Express printing the full error:

```terminal
{
  "title": "what each app logged",
  "prompt": "$",
  "steps": [
    {
      "cmd": "grep -m1 -A2 '^Error' vulnerable.log",
      "output": "Error: account 999 not found\n    at file:///home/dev/guide-owasp-top-10-demo-2026-10-27/vulnerable/app.js:93:30\n    at Layer.handleRequest (/home/dev/guide-owasp-top-10-demo-2026-10-27/node_modules/router/lib/layer.js:152:17)"
    },
    {
      "cmd": "jq -c 'select(.msg == \"rollback\") | {level, event, reason, user}' app.log",
      "output": "{\"level\":40,\"event\":\"transfer_failed\",\"reason\":\"destination account not found\",\"user\":\"alice\"}\n{\"level\":40,\"event\":\"transfer_failed\",\"reason\":\"CHECK constraint failed: balance_cents >= 0\",\"user\":\"alice\"}"
    }
  ]
}
```

At the process level, let Node.js crash on errors that nothing handled. Since Node.js 15, an unhandled promise rejection ends the process by default, which is the right behavior: a process in an unknown state should restart, and the restart should be visible. Log the error and exit; do not swallow it:

```javascript
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaught exception');
  process.exit(1); // let systemd, Kubernetes or the process manager restart it
});
```

## Validate Missing and Unexpected Input

A missing parameter (CWE-234) or a value of the wrong type turns into `undefined` arithmetic, a `TypeError` deep in the code, or a database error with internals in the message. Check presence, type and range at the edge, and answer 400 before any work starts:

```terminal
{
  "title": "missing input is refused up front",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/transfers -H \"authorization: Bearer $F\" -H 'content-type: application/json' -d '{\"from\": 1, \"to\": 2}'",
      "output": "{\"error\":\"from, to and a positive amountCents are required\"} 400"
    }
  ]
}
```

## Put a Limit on Everything

OWASP's phrase for this is that nothing in information technology should be limitless: unlimited inputs lead to resource exhaustion, denial of service, successful brute force and very large cloud bills. The companion app limits request bodies to 10 kB, login attempts per client ([A07](/guides/owasp-top-10/07-authentication-failures#h2-limit-failed-attempts)), and the size and time of outbound fetches ([SSRF](/guides/owasp-top-10/10-ssrf)):

```terminal
{
  "title": "an oversized body is refused",
  "prompt": "$",
  "steps": [
    {
      "cmd": "BIG=$(head -c 20000 /dev/zero | tr '\\0' x)"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' -X PATCH localhost:3000/api/profile -H \"authorization: Bearer $F\" -H 'content-type: application/json' -d \"{\\\"displayName\\\": \\\"$BIG\\\"}\"",
      "output": "{\"error\":\"request entity too large\",\"requestId\":\"004865bd-c372-4e03-9e5c-57653710bd78\"} 413"
    },
    {
      "cmd": "kill %1 %2"
    }
  ]
}
```

Other limits worth setting explicitly: server timeouts (`server.requestTimeout` and `server.headersTimeout` in Node.js), database statement timeouts, connection pool sizes, upload sizes, pagination limits on list endpoints, and queue lengths. When an operation fails, release what it held: close files and connections in `finally` blocks, and use `stream.pipeline()`, which cleans up every stream in the chain when one of them fails. OWASP's first example in A10 is an upload handler that leaks a resource on every exception until none are left.

The error tests cover the headers, both failed transfers, malformed JSON and the size limit:

```terminal
{
  "title": "the error handling tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/errors.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/errors.test.js\n\n▶ A02 and A10: errors and exceptional conditions\n  ✔ sends security headers and no X-Powered-By (37.944437ms)\n  ✔ sends no-store on API responses, errors included (47.126537ms)\n  ✔ rolls back the debit when the credit fails (30.079116ms)\n  ✔ refuses an overdraft and keeps both balances (23.348854ms)\n  ✔ answers malformed JSON with 400 and no stack trace (18.910729ms)\n  ✔ refuses a request body over 10 kB (21.733617ms)\n✔ A02 and A10: errors and exceptional conditions (656.092673ms)\nℹ tests 6\nℹ suites 1\nℹ pass 6\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1554.163444"
    }
  ]
}
```

## Common Mistakes

- **`catch` blocks that return a default "allowed" value**, or swallow the error and continue.
- **Multi-step changes without a transaction**, or a transaction without a rollback on every error path.
- **Error messages with stack traces, SQL or internal paths**, which OWASP's second example shows are reconnaissance for the next attack.
- **Error handling scattered across the code**, each piece slightly different. Use one handler, the same way everywhere.
- **Retrying non-idempotent operations** without an idempotency key.
- **Limitless inputs and operations**: no body size, timeout, page size or rate limit.

## Summary

- A10:2025 is new: it covers errors, failing open and abnormal conditions.
- Fail closed: a check that cannot complete denies.
- Wrap multi-step changes in transactions, roll back on every error, and let the database enforce invariants.
- Catch errors where they happen, keep one global handler, log details and return generic messages.
- Validate input at the edge and put a limit on every resource.

This is the last category of the OWASP Top 10:2025. To go further, verify your application against the [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), use the [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) for testing, and measure your program with [OWASP SAMM](https://owaspsamm.org/). The [guide introduction](/guides/owasp-top-10) lists every part.

## Keep Learning

- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [Concurrency and Race Conditions quiz](/quizzes/concurrency-and-race-conditions-quiz)
- [How Stripe Avoids Double-Charging Anyone](/posts/how-stripe-avoids-double-charging-idempotency-keys)
- [Security Gates guide](/guides/security-gates)
