---
title: 'A07:2025 Authentication Failures'
description: 'A07:2025 Authentication Failures: credential stuffing, rate limits, breached-password checks, NIST password rules, sessions, JWTs, MFA and passkeys.'
order: 8
---

**TLDR**: Authentication failures let an attacker log in as someone else: by trying leaked passwords at scale, guessing weak ones, abusing a recovery flow, or reusing a session that should have ended. Give the same answer for every failed login, limit failed attempts per client and per account, reject passwords that appear in breach data, follow the NIST SP 800-63B-4 password rules, issue a new random session ID at login and end it on the server at logout, validate every claim of a token, and offer phishing-resistant MFA such as passkeys.

The 2025 edition renamed this category from "Identification and Authentication Failures" to Authentication Failures and kept it at seventh place. The [A07:2025 page](https://owasp.org/Top10/2025/A07_2025-Authentication_Failures/) maps 36 CWEs to it, including hard-coded passwords (CWE-259, CWE-798), session fixation (CWE-384) and improper certificate validation (CWE-297). OWASP notes that standard authentication frameworks have helped, and its best advice is to use a well-tested system for identity and sessions instead of building your own.

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- Network access for the breached-password check.

## How Logins Are Attacked

- **Credential stuffing**: trying username and password pairs leaked from other sites, because people reuse passwords.
- **Password spraying and hybrid attacks**: trying a few common passwords against many accounts, or variations of leaked ones (OWASP's example: `Winter2025` becomes `Winter2026`).
- **Brute force** against one account.
- **Weak recovery**: security questions or reset links that can be guessed (see [A06](/guides/owasp-top-10/04-insecure-design#h3-recovery-flows)).
- **Session problems**: IDs in URLs, IDs that survive login or logout, tokens accepted by services they were not issued for.

## One Answer for Every Failed Login

The fixed login handler returns the same message for an unknown user and a wrong password, and it runs the password hash even when the user does not exist, so the response time does not reveal which case it was:

```javascript
// POST /api/login: same answer for an unknown user and a wrong password.
export function login({ db, log }) {
  return async (req, res) => {
    const { name, password } = req.body ?? {};
    if (typeof name !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'name and password are required strings' });
    }
    if (name.length > 64 || password.length > 256) {
      return res.status(400).json({ error: 'name or password too long' });
    }
    const user = db.prepare('SELECT id, name, password_hash FROM users WHERE name = ?').get(name);
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      log.warn({ event: `authn_login_fail:${name}`, ip: req.ip, reqId: req.id }, 'login failed');
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    // A new random session ID on every login: 32 bytes from the CSPRNG. Expired
    // sessions go, and each user keeps at most MAX_SESSIONS (the oldest end first).
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare(
      `DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN (
         SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY expires_at DESC LIMIT ?)`
    ).run(user.id, user.id, MAX_SESSIONS - 1);
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      sha256(token),
      user.id,
      Date.now() + SESSION_TTL_MS
    );
    log.info({ event: `authn_login_success:${user.name}`, ip: req.ip, reqId: req.id }, 'login');
    res.json({ token, expiresInSeconds: SESSION_TTL_MS / 1000 });
  };
}
```

```terminal
{
  "title": "an unknown user and a wrong password look the same",
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
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"Winter2026!\"}'",
      "output": "{\"error\":\"Invalid username or password\"} 401"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"mallory\", \"password\": \"Winter2026!\"}'",
      "output": "{\"error\":\"Invalid username or password\"} 401"
    }
  ]
}
```

Apply the same rule to registration and password reset: "If that address has an account, we sent a link" for every address.

## Sessions

A session ID is a password with a short life. The companion app's sessions follow the OWASP rules:

- **New and random at every login**: 32 bytes from the cryptographically secure generator, so a session ID that existed before login (session fixation) can never become an authenticated one.
- **Stored as a hash**, so a database leak does not hand out live sessions.
- **Expiring and bounded**: an absolute timeout of one hour, expired rows removed at each login, and at most five sessions per user. Add an idle timeout for sensitive applications.
- **Ended on the server at logout**, not only forgotten by the client.

```javascript
// Every protected route runs this first. No valid session, no access.
export function authenticate({ db, log }) {
  return (req, res, next) => {
    const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get('authorization') ?? '');
    const row =
      m &&
      db
        .prepare(
          `SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ?`
        )
        .get(sha256(m[1]), Date.now());
    if (!row) {
      // A token that is wrong or expired is worth a log line; no token at all is routine.
      if (req.get('authorization')) {
        log.warn({ event: 'authn_token_invalid', ip: req.ip, reqId: req.id }, 'bad token');
      }
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = row;
    req.sessionTokenHash = sha256(m[1]);
    next();
  };
}
```

```terminal
{
  "title": "logout ends the session on the server",
  "prompt": "$",
  "steps": [
    {
      "cmd": "TOKEN=$(curl -s localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"bob\", \"password\": \"correct horse battery staple\"}' | jq -r .token)"
    },
    {
      "cmd": "curl -s -o /dev/null -w '%{http_code}\\n' localhost:3000/api/invoices/1002 -H \"authorization: Bearer $TOKEN\"",
      "output": "200"
    },
    {
      "cmd": "curl -s -o /dev/null -w '%{http_code}\\n' -X POST localhost:3000/api/logout -H \"authorization: Bearer $TOKEN\"",
      "output": "204"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' localhost:3000/api/invoices/1002 -H \"authorization: Bearer $TOKEN\"",
      "output": "{\"error\":\"Authentication required\"} 401"
    }
  ]
}
```

If you use cookies instead of bearer tokens, set `HttpOnly`, `Secure` and `SameSite`, as shown in [A02](/guides/owasp-top-10/05-security-misconfiguration#h3-cookies), and never put session IDs in URLs.

### Tokens From an Identity Provider

When another service issues the token (OAuth 2.0 or OpenID Connect), validate everything, not only the signature. OWASP's last point in A07 is to verify the intended use of credentials: the issuer, the audience and the scopes. With the [`jose`](https://github.com/panva/jose) library:

```javascript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = createRemoteJWKSet(new URL('https://auth.example.com/.well-known/jwks.json'));

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: 'https://auth.example.com/',
    audience: 'invoices-api', // a token for another API is rejected
    algorithms: ['RS256'], // never accept "none" or an algorithm the attacker picks
    requiredClaims: ['exp'], // a token without an expiry is rejected
  });
  if (
    !String(payload.scope ?? '')
      .split(' ')
      .includes('invoices:read')
  ) {
    throw new Error('missing scope invoices:read');
  }
  return payload;
}
```

`jwtVerify` checks the expiry when the token has one, and `requiredClaims` makes it mandatory. Keep access tokens short-lived and revoke refresh tokens at logout, since a stateless token cannot be ended on the server.

## Limit Failed Attempts

The companion app allows five failed logins per client IP address in 15 minutes, using [express-rate-limit](https://express-rate-limit.mintlify.app/):

```javascript
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

The two failed logins above already count. Three more fail normally, and then the limiter answers for the app:

```terminal
{
  "title": "the sixth failure is refused",
  "prompt": "$",
  "steps": [
    {
      "cmd": "for i in 1 2 3 4; do curl -s -o /dev/null -w '%{http_code} ' localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"guess\"}'; done; echo",
      "output": "401 401 401 429"
    },
    {
      "cmd": "curl -si localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"correct horse battery staple\"}' | grep -E -i '^(HTTP|ratelimit|retry-after)|error'",
      "output": "HTTP/1.1 429 Too Many Requests\nRateLimit: \"5-in-15min\"; r=0; t=900\nRateLimit-Policy: \"5-in-15min\"; q=5; w=900; pk=:MTJjYTE3YjQ5YWYy:\nRetry-After: 900\n{\"error\":\"Too many login attempts, try again later\"}"
    },
    {
      "cmd": "kill %1"
    }
  ]
}
```

Even the correct password is refused until the window passes, and the `RateLimit` and `Retry-After` headers tell well-behaved clients when to come back. Refused requests never reach the login handler, so the limiter's own `handler` logs them as `authn_login_fail_max` events, which the [A09 alert rules](/guides/owasp-top-10/09-logging-failures#h2-alerts-that-someone-acts-on) use. A per-IP limit alone does not stop credential stuffing from many addresses, so combine it with:

- **A per-account limit** that adds delays after repeated failures. OWASP warns not to lock accounts outright, because an attacker can then lock out any user; slow down instead, and alert.
- **A shared store** such as Redis for the counters when you run more than one instance, and the right `trust proxy` setting behind a load balancer, so the limit sees the real client address.
- **Bot and breached-credential signals** from your identity provider or edge network.
- **Alerts** on spikes of failed logins across accounts ([A09](/guides/owasp-top-10/09-logging-failures) shows the events).

The tests check the behaviors this part demonstrated: the uniform failure answer, new session IDs, logout, the session cap and the per-client limit:

```terminal
{
  "title": "the authentication tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/auth.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/auth.test.js\n\n▶ A07 authentication failures\n  ✔ gives the same answer for a wrong password and an unknown user (460.779054ms)\n  ✔ issues a new random session ID at each login (292.374893ms)\n  ✔ ends the session on the server at logout (154.956673ms)\n  ✔ keeps at most 5 sessions per user (751.912666ms)\n  ✔ blocks a client after 5 failed logins in 15 minutes (557.516502ms)\n✔ A07 authentication failures (2408.691329ms)\nℹ tests 5\nℹ suites 1\nℹ pass 5\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 3254.633575"
    }
  ]
}
```

## Passwords: The NIST SP 800-63B-4 Rules

[NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), final since July 2025, is the reference OWASP points to. Its password rules (section 3.1.1.2) are short:

- At least **15 characters** when the password is the only factor, at least 8 when it is used with MFA.
- Allow at least **64 characters**, and all printing characters including spaces.
- **No composition rules** (no "one uppercase, one digit, one symbol").
- **No periodic rotation**. Force a change only when there is evidence of compromise.
- **Check new passwords against a blocklist** of common, expected and compromised passwords.

Composition rules and rotation push people toward `Winter2026!`, a predictable pattern that meets every old rule. The blocklist check catches it. The [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords) API does it without sending the password: you send the first five hex characters of its SHA-1 hash and compare the rest locally (k-anonymity), and the `Add-Padding` header hides how many results your prefix has:

```terminal
{
  "title": "is this password in breach data?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "HASH=$(printf '%s' 'Winter2026!' | sha1sum | cut -c1-40 | tr a-f A-F)"
    },
    {
      "cmd": "curl -s \"https://api.pwnedpasswords.com/range/${HASH:0:5}\" -H 'Add-Padding: true' | grep \"^${HASH:5}:\"",
      "output": "9594223987C8C506A1232EF4AF7788DC831:9"
    },
    {
      "cmd": "HASH=$(printf '%s' 'correct horse battery staple' | sha1sum | cut -c1-40 | tr a-f A-F)"
    },
    {
      "cmd": "curl -s \"https://api.pwnedpasswords.com/range/${HASH:0:5}\" -H 'Add-Padding: true' | grep \"^${HASH:5}:\"",
      "output": "AD6438836DBE526AA231ABDE2D0EEF74D42:391"
    }
  ]
}
```

The number after the colon is how often the password appears in breach data. `Winter2026!` appears 9 times, and the famous four-word example this guide uses as its demo password appears 391 times: long is not the same as unknown. Reject both at registration and at password change. In application code:

```javascript
import { createHash } from 'node:crypto';

// True if the password appears in the Pwned Passwords data set.
export async function isBreached(password) {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
    headers: { 'Add-Padding': 'true' },
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Pwned Passwords returned ${res.status}`);
  const suffix = hash.slice(5);
  return (await res.text())
    .split('\n')
    .some((line) => line.startsWith(`${suffix}:`) && !line.trim().endsWith(':0'));
}
```

Padding rows have a count of 0, which is why the check ignores them. Decide what happens when the API is down; for a registration form, a local list of the most common passwords is a reasonable fallback. Store passwords as described in [A04](/guides/owasp-top-10/02-cryptographic-failures#h2-passwords-hash-with-a-slow-function).

## Multi-Factor Authentication and Passkeys

OWASP's first prevention point is MFA wherever possible, because it stops credential stuffing and the reuse of stolen passwords. Not all second factors are equal:

- **Passkeys (WebAuthn/FIDO2)** are phishing-resistant: the browser binds the credential to your site's domain, so a lookalike site cannot use it. Offer them first, and consider them as the primary login instead of a password.
- **Authenticator app codes (TOTP)** are a solid fallback, but a phishing page can relay them in real time.
- **SMS and email codes** are the weakest options, because of SIM swaps and mailbox takeovers.

OWASP also lists weak MFA fallbacks as a failure: if "I lost my phone" leads to a security question, the attacker uses that path. Recovery codes issued at enrollment are the usual answer. For the implementation, use your identity provider's MFA, or a maintained library such as SimpleWebAuthn for passkeys, rather than writing the protocol yourself.

## Credentials in Code

Hard-coded passwords and keys (CWE-259 and CWE-798) count as authentication failures too: anyone with the code, or a leaked image, can log in. Do not ship default admin accounts, load secrets from a secrets manager at runtime, and scan every commit and image for secrets. [You Cannot Rotate a Secret You Cannot Find](/posts/you-cannot-rotate-a-secret-you-cannot-find) covers finding the ones already out there.

## Common Mistakes

- **Different errors for "no such user" and "wrong password"**, or a faster response for one of them.
- **Account lockout without care**: it turns brute-force protection into a denial of service. Slow down and alert instead.
- **Password complexity rules and forced rotation**, which NIST now prohibits.
- **Sessions that survive logout**, or JWTs that live for days.
- **Validating a token's signature but not its audience**, so a token for one service works on another.
- **SMS as the only second factor** for high-value accounts.

## Summary

- Use a well-tested identity system where you can; the rest of this part is what it should do for you.
- Same response for every failed login; limits per client and per account, without hard lockouts.
- NIST SP 800-63B-4: 15 characters for password-only logins, no composition or rotation rules, and a breached-password check.
- New random session IDs at login, hashed at rest, ended on the server at logout; full validation of tokens.
- Offer passkeys first, TOTP as fallback, and safe recovery codes.

Next, [A08:2025 Software or Data Integrity Failures](/guides/owasp-top-10/08-software-integrity-failures) covers trusting code and data that nobody verified.

## Keep Learning

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Designing Rate Limiting for APIs](/posts/designing-rate-limiting-for-apis)
- [Ory: Identity and Auth on Kubernetes](/posts/ory-ecosystem-identity-auth-kubernetes)
- [Rate Limiting APIs quiz](/quizzes/rate-limiting-apis-quiz)
