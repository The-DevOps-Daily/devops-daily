---
title: 'Security-Focused Code Reviews: Catching Vulnerabilities Before Production'
excerpt: 'Learn how to review code with a security mindset: the vulnerability patterns and language-specific pitfalls to look for, the secure coding practices every change should follow, and checklists for finding injection flaws, auth bypass, and logic bugs that automated tools miss.'
category:
  name: 'Security'
  slug: 'security'
coverImage: '/images/posts/security-focused-code-reviews.jpg'
ogImage: '/images/posts/security-focused-code-reviews.svg'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '19 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - Code Review
  - Vulnerabilities
---

Automated security tools are great at finding obvious issues. SQL injection with string concatenation, known vulnerable dependencies, hardcoded API keys. But they are terrible at understanding your application's logic. They cannot tell you that your payment endpoint lets users transfer money from accounts they do not own, or that your session management has a race condition that allows account takeover.

That is where security-focused code review comes in. Scanners find patterns; reviewers find wrong decisions. Use both: let the tools catch the patterns, so reviewers have time for the logic.

**TLDR**: Security code review requires a different mindset than functional review. Instead of asking "does this work?", you ask "how could this be abused?" This guide covers the vulnerability patterns to watch for, language-specific pitfalls, and a practical process for reviewing code with security in mind.

## Think Like an Attacker

The single biggest shift in security review is your perspective. A developer asks "how do I make this work?" A security reviewer asks "how could this be abused?"

```text
Developer Mindset          Security Reviewer Mindset
------------------         -------------------------
"Happy path first"         "Edge cases and errors first"
"Trust user input"         "All input is malicious"
"This is internal only"    "Assume network is compromised"
"Users will behave"        "Assume malicious users"
```

This does not mean being paranoid about everything. It means systematically considering how each piece of code could be exploited by working through a consistent process.

### Identify the Attack Surface

Before reading code line by line, map out where untrusted data enters the system:

- **HTTP requests**: query params, headers, body, cookies
- **File uploads**: filenames, content, metadata
- **Database reads**: data from other systems or previously stored user input
- **External APIs**: responses from third-party services
- **Environment**: env vars, config files

Then trace how that data flows through the code. Any place where untrusted data influences behavior is a potential vulnerability.

## The Vulnerability Patterns That Matter Most

### Injection: The Classic That Still Ships

Injection happens when untrusted data is sent to an interpreter as part of a command or query. SQL injection is the most common, but command injection and XSS follow the same principle.

**SQL Injection - the vulnerable pattern:**

```python
# String concatenation with user input
query = f"SELECT * FROM users WHERE username = '{username}'"
cursor.execute(query)
```

**The fix is always parameterized queries:**

```python
query = "SELECT * FROM users WHERE id = %s"
cursor.execute(query, (user_id,))
```

During review, search for string concatenation near database calls. Check for raw SQL queries that include user input. Verify that ORM usage does not bypass parameterization. In Go, look for `"SELECT * FROM users WHERE id = " + userID`. In Java, look for `Statement` instead of `PreparedStatement`.

**Command injection follows the same pattern:**

```python
# VULNERABLE - shell=True with user input
subprocess.run(f"ping {hostname}", shell=True)

# SECURE - list arguments, no shell, and "--" ends the options
# (validate hostname first, see "Validate Input Against an Allowlist" below)
subprocess.run(["ping", "-c", "4", "--", hostname], shell=False)
```

Search for `shell=True`, `os.system`, and `os.popen`. These are red flags when they include anything derived from user input.

**XSS is injection into the browser:**

```javascript
// VULNERABLE
document.getElementById('output').innerHTML = userInput;

// SECURE
document.getElementById('output').textContent = userInput;
```

Look for `innerHTML`, `outerHTML`, `document.write`, the `| safe` filter in Jinja2 templates, and `dangerouslySetInnerHTML` in React. Any of these with user-controlled data is a problem.

### Authorization: The Most Commonly Missed Category

Tools struggle with authorization because they cannot understand your business rules. This is where human reviewers add the most value.

**The vulnerable pattern is depressingly common:**

```python
@app.route('/api/documents/<doc_id>')
@login_required
def get_document(doc_id):
    # Checks authentication but NOT authorization
    # Any logged-in user can access any document
    return Document.query.get(doc_id).to_dict()
```

**The fix is to scope queries to the current user:**

```python
@app.route('/api/documents/<doc_id>')
@login_required
def get_document(doc_id):
    doc = Document.query.filter_by(
        id=doc_id,
        owner_id=current_user.id
    ).first_or_404()
    return doc.to_dict()
```

During review, verify that every endpoint checks authorization, not just authentication. Look for direct object references (sequential IDs) without ownership checks. Check that authorization happens server-side, not just in the frontend. Verify that admin functions actually require the admin role.

### Weak Password Storage

If you see `hashlib.md5`, `hashlib.sha1` or `hashlib.sha256` near passwords, flag it immediately:

```python
# VULNERABLE - too fast, no salt
user.password = hashlib.sha256(password.encode()).hexdigest()

# SECURE - slow, salted, purpose-built
from argon2 import PasswordHasher
ph = PasswordHasher()
hashed = ph.hash(password)
```

MD5, SHA-1 and SHA-256 are not password hashing algorithms. They are fast, and fast is exactly what you do not want for passwords. The [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommends Argon2id, then scrypt. bcrypt is for legacy systems (it uses only the first 72 bytes of a password), and PBKDF2 is for systems that need FIPS 140 compliance. [A04:2025 Cryptographic Failures](/guides/owasp-top-10/02-cryptographic-failures) has the parameters and a measured comparison.

### Hardcoded Secrets

```python
# VULNERABLE
API_KEY = "sk_live_abc123xyz"
DB_PASSWORD = "supersecret123"

# SECURE
API_KEY = os.environ['API_KEY']
DB_PASSWORD = get_secret('prod/db/password')
```

Search for common patterns: `key`, `password`, `token`, `secret`, `credential`. Check config files for hardcoded values. Verify that secrets are not logged or included in error messages.

### File Handling

Path traversal and unrestricted file uploads are easy to miss:

```python
# VULNERABLE - attacker sends filename "../../../etc/passwd"
@app.route('/files/<filename>')
def get_file(filename):
    return send_file(f'/uploads/{filename}')

# SECURE
from werkzeug.utils import secure_filename

@app.route('/files/<filename>')
def get_file(filename):
    safe_name = secure_filename(filename)
    file_path = os.path.join('/uploads', safe_name)
    if not file_path.startswith('/uploads/'):
        abort(400)
    return send_file(file_path)
```

For file uploads, verify that both the extension and content type are validated, size limits are enforced, filenames are sanitized (or replaced with UUIDs), and files are saved outside the web root.

## Language-Specific Red Flags

### Python

These functions are dangerous when they touch user input:

- `eval()`, `exec()`, `compile()` for arbitrary code execution
- `pickle.loads()` for arbitrary code execution on deserialization
- `yaml.load()` without SafeLoader, use `yaml.safe_load()` instead
- `subprocess` with `shell=True` for command injection

### JavaScript / Node.js

- `eval()`, `new Function()`, string-based `setTimeout` for code execution
- `innerHTML`, `outerHTML`, `document.write` for XSS
- `require()` with user-controlled paths for arbitrary module loading
- Object merging without checking for `__proto__` and `constructor` for prototype pollution

Prototype pollution deserves special attention because it is JavaScript-specific and non-obvious:

```javascript
// VULNERABLE - attacker sends {"__proto__": {"isAdmin": true}}
function merge(target, source) {
  for (let key in source) {
    target[key] = source[key];
  }
}

// SECURE - filter dangerous keys
function safeMerge(target, source) {
  for (let key in source) {
    if (key === '__proto__' || key === 'constructor') continue;
    if (Object.hasOwn(source, key)) {
      target[key] = source[key];
    }
  }
}
```

### Go

- String concatenation in SQL queries, use parameterized queries with `$1` or `?`
- `exec.Command("sh", "-c", userInput)` for command injection
- `filepath.Join` does not prevent `..` traversal, validate paths after joining
- `http.Get(userURL)` without validation for SSRF

### Java

- `Statement` instead of `PreparedStatement` for SQL injection
- Default `DocumentBuilderFactory` config is vulnerable to XXE attacks
- `ObjectInputStream.readObject()` on untrusted data for arbitrary code execution
- LDAP queries without proper escaping

For XML parsing in Java, you must explicitly disable external entities:

```java
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
```

### Cross-Language: Regex DoS

All languages are susceptible to catastrophic backtracking:

```python
# VULNERABLE - hangs on malicious input
pattern = r'^(a+)+$'
re.match(pattern, 'a' * 30 + 'b')

# SECURE - no nested quantifiers
pattern = r'^a+$'
```

Watch for nested quantifiers like `(a+)+`, `(a*)*`, and `(a+)*` in any regex that processes user input.

## Which Secure Coding Practices Should Every Change Follow?

Twelve rules cover most of what a reviewer should expect in code that handles input, output, errors and logins:

1. Validate input on the server against an allowlist, and refuse what does not match.
2. Use parameterized queries for every database call.
3. Run programs with an argument list, never through a shell.
4. Encode output for the place it goes: HTML text, an attribute, a script or a URL.
5. Keep the framework's auto-escaping on.
6. Show users a generic error with a request ID, and log the details.
7. Give the same answer, after the same work, for every failed login.
8. Hash passwords with Argon2id, or with scrypt, bcrypt or PBKDF2 where you must.
9. Set `Secure`, `HttpOnly` and `SameSite` on session cookies, and start a new session at login.
10. Pin the JWT algorithm, require `exp`, and keep access tokens short-lived.
11. Rate limit logins and password resets, with a counter that all workers share.
12. Never log passwords, tokens, keys or full card numbers.

The sections above cover injection, password storage and file handling. The sections below cover the other rules, and the mistakes that make code look safe when it is not. The [OWASP Top 10 guide](/guides/owasp-top-10) has a runnable example for each risk.

### Validate Input Against an Allowlist

A denylist removes the characters you thought of. An allowlist accepts only the shape you expect. Use `re.fullmatch`, so the whole value must match, not only its start:

```python
import re

USERNAME = re.compile(r"[a-z0-9_]{3,20}")

def validate_username(value: str) -> str:
    if not USERNAME.fullmatch(value):
        raise ValueError("invalid username")
    return value
```

An allowlist can still let through more than you planned. A common hostname check, `^[a-zA-Z0-9.-]+$`, refuses `example.com; id`, but it accepts `-V`. Passed as `subprocess.run(["ping", "-c", "4", value])`, that value becomes an option: `ping` printed its version instead of sending a ping (tested with iputils 20221126). There is no shell involved, so this is argument injection, not command injection. Refuse a leading `-`, and put `--` before the positional argument when the program supports it:

```python
import re
import subprocess

HOSTNAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9.-]{0,252}")

def ping(host: str) -> str:
    if not HOSTNAME.fullmatch(host):
        raise ValueError("invalid hostname")
    result = subprocess.run(
        ["ping", "-c", "4", "--", host],
        capture_output=True, text=True, timeout=30, check=False,
    )
    return result.stdout
```

For a request body, validate the whole object with a schema. In Pydantic 2, constraints go in `Field`; the `@validator` decorator from Pydantic 1 is deprecated:

```python
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field

class CreateUser(BaseModel):
    username: Annotated[str, Field(pattern=r"^[a-z0-9_]{3,20}$")]
    email: Annotated[EmailStr, Field(max_length=254)]  # needs: pip install "pydantic[email]"
    age: Annotated[int | None, Field(ge=13, le=150)] = None

# Raises pydantic.ValidationError for anything that does not fit.
user = CreateUser.model_validate(request.get_json())
```

Checks in the browser are only for the user's convenience, because an attacker sends requests without the browser. Database constraints (`NOT NULL`, `CHECK`, unique indexes) are the last layer and catch what the code missed.

### Encode Output for the Place It Goes

The same value needs a different encoding in each place it can appear:

| Where the value goes      | What to use                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| HTML text                 | Template auto-escaping, or `html.escape()`                                                     |
| HTML attribute            | Quotes around the attribute, plus `html.escape()` (it escapes `"` and `'` by default)          |
| Inside a `<script>` block | Jinja2's `tojson` filter, or a `data-` attribute that the script reads                         |
| A query string            | `urllib.parse.urlencode()`                                                                     |
| An `href` or `src` value  | An allowlist of schemes such as `https:`, because encoding does not stop `javascript:alert(1)` |

`json.dumps()` is not safe inside a `<script>` block. It does not escape `<`, so a value that contains `</script>` ends the script element, and the browser runs whatever comes next. Jinja2's `tojson` filter escapes `<`, `>`, `&` and `'`:

```python
import json
from jinja2 import Environment

name = "</script><script>alert(1)</script>"
print(f"<script>const user = {json.dumps({'name': name})};</script>")

env = Environment(autoescape=True)
page = env.from_string("<script>const user = {{ data|tojson }};</script>")
print(page.render(data={"name": name}))
```

```text
<script>const user = {"name": "</script><script>alert(1)</script>"};</script>
<script>const user = {"name": "\u003c/script\u003e\u003cscript\u003ealert(1)\u003c/script\u003e"};</script>
```

The first line runs the attacker's script; the second is a harmless string (tested with Python 3.11 and Jinja2 3.1).

When users must send some HTML, such as comments with bold text and links, clean it with an allowlist of tags. Do not use bleach, which many older examples show: it was deprecated in January 2023, and since June 2026 it is archived, with no more releases, not even for security issues. Use a maintained sanitizer such as [nh3](https://github.com/messense/nh3) in Python or DOMPurify in the browser:

```python
import nh3

ALLOWED_TAGS = {"p", "br", "strong", "em", "ul", "ol", "li", "a"}

def clean_comment(html: str) -> str:
    return nh3.clean(html, tags=ALLOWED_TAGS)
```

Add a Content Security Policy as a second layer. If an encoding mistake slips through, a policy without `'unsafe-inline'` in `script-src` stops the injected inline script from running:

```python
@app.after_request
def add_security_headers(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; "
        "img-src 'self' data: https:; frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
```

The [Cross-Site Scripting section](/guides/owasp-top-10/03-injection#h2-cross-site-scripting) of the OWASP guide shows the same rules in a Node.js app.

### Fail Without Telling the Attacker Anything

A stack trace shows file paths, library versions and sometimes values from the failed query. Log the details with a request ID, and show the user only the ID:

```python
import logging
import uuid

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
log = logging.getLogger(__name__)

@app.errorhandler(Exception)
def handle_error(error):
    if isinstance(error, HTTPException):
        return error  # 404, 405 and the like keep their own status
    request_id = uuid.uuid4().hex
    log.exception("unhandled error, request_id=%s", request_id)
    return jsonify(error="internal error", request_id=request_id), 500
```

A view that raised `RuntimeError("could not connect to db-internal.example:5432 ...")` returned `{"error":"internal error","request_id":"4a54..."}` with status 500, and the traceback went only to the log (tested with Flask 2.2). The log gets the full exception message, so keep secrets out of exception messages in the first place. Make the generic answer the default. Code that shows details "unless production" fails open when an environment variable is missing or misspelled. Flask's own `FLASK_ENV` variable, which many examples check, was deprecated in Flask 2.2 and removed in 2.3.

A login must not reveal which usernames exist, in its message or in its timing. A random delay does not hide the difference. When the user does not exist, the code skips the password hash, and the hash is the slow part:

| Login attempt                 | With a random 100 to 150 ms sleep | With a dummy hash |
| ----------------------------- | --------------------------------- | ----------------- |
| Existing user, wrong password | 229 ms                            | 91 ms             |
| Unknown user                  | 123 ms                            | 95 ms             |

These are medians of 10 attempts per row on an arm64 Linux machine with Python 3.11, with `hashlib.scrypt` (n=2^14, r=8, p=1) standing in for the password hash; the numbers depend on the hash settings and the machine, but the gap comes from skipping the hash, so a slower hash makes it larger. Verify the password against a dummy hash when the user is missing, so both paths do the same work:

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()
DUMMY_HASH = ph.hash("not a real password")  # computed once, at start-up

def login(username: str, password: str):
    user = User.query.filter_by(username=username).first()
    try:
        ph.verify(user.password_hash if user else DUMMY_HASH, password)
    except VerifyMismatchError:
        return error("Invalid username or password")
    if user is None:
        return error("Invalid username or password")
    return success(start_session(user))
```

[One Answer for Every Failed Login](/guides/owasp-top-10/07-authentication-failures#h2-one-answer-for-every-failed-login) in the OWASP guide applies the same rule to registration and password reset.

Log security events (logins, permission changes, failed checks) with structured fields, but never passwords, tokens, API keys or full card numbers. Do not log "the first 8 characters" of a token either: many tokens start with a fixed prefix such as `ghp_` or `sk_live_`, so 8 characters can be half of the secret part. Log the ID of the key instead. When an error interrupts several writes, roll back the transaction, as [Roll Back Partial Transactions](/guides/owasp-top-10/11-mishandling-exceptional-conditions#h2-roll-back-partial-transactions) shows.

### Sessions, Tokens and Rate Limits

Session cookies need three flags: `Secure` (HTTPS only), `HttpOnly` (no access from JavaScript) and `SameSite=Lax` or `Strict` (not sent with most cross-site requests):

```python
import os
from datetime import timedelta

app.config.update(
    SECRET_KEY=os.environ["SECRET_KEY"],
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)
```

Start a new session at login and after a password change, so a session ID that an attacker planted before the login is worthless (session fixation). With server-side sessions, that means a new session ID, for example `req.session.regenerate()` in Express. Flask's default session is a signed cookie with no server-side ID: call `session.clear()` before you store the user in it, and keep a server-side session store if you need to log users out everywhere.

For JWTs, the library must decide which algorithm is valid, not the token. Pass `algorithms` to `jwt.decode()`, and make the claims you rely on required. PyJWT accepts a token without `exp` and treats it as valid forever, unless you require it (tested with PyJWT 2.6):

```python
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

JWT_KEY = os.environ["JWT_KEY"]  # at least 32 random bytes for HS256

def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)  # datetime.utcnow() is deprecated since Python 3.12
    claims = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(claims, JWT_KEY, algorithm="HS256")

def verify_access_token(token: str) -> dict:
    return jwt.decode(
        token, JWT_KEY, algorithms=["HS256"],
        options={"require": ["exp", "sub"]},
    )
```

A token without `exp` now fails with `MissingRequiredClaimError`, and a token with `"alg": "none"` fails with `InvalidAlgorithmError`. RFC 7518 requires an HS256 key of at least 256 bits. The payload is only base64-encoded, so anyone with the token can read it: never put secrets in it. When tokens come from an identity provider, verify them against its published keys, as [Tokens From an Identity Provider](/guides/owasp-top-10/07-authentication-failures#h3-tokens-from-an-identity-provider) shows.

Rate limit every login and password reset endpoint. Two details decide whether the limit works. The counter must be shared: with the default in-memory storage, each worker process counts on its own, so four Gunicorn workers allow four times the limit. And behind a load balancer, the client address is the load balancer's address unless you trust its `X-Forwarded-For` header, for example with Werkzeug's `ProxyFix`. With Flask-Limiter 3 and later, the key function is the first argument:

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)  # exactly one proxy in front
limiter = Limiter(get_remote_address, app=app, storage_uri="redis://localhost:6379")

@app.post("/login")
@limiter.limit("5 per minute")
def login_view():
    ...
```

Limits per IP address do not stop credential stuffing from many addresses. [Limit Failed Attempts](/guides/owasp-top-10/07-authentication-failures#h2-limit-failed-attempts) adds limits per account, and the [rate limit simulator](/games/rate-limit-simulator) shows how the common algorithms behave.

For password resets, send a random token, store only its hash, and let it expire:

```python
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

def create_password_reset_token(user) -> str:
    token = secrets.token_urlsafe(32)
    user.reset_token_hash = hashlib.sha256(token.encode()).hexdigest()
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.session.commit()
    return token  # send it by email; it is never stored in clear text
```

A fast hash is fine here, because the token has 256 random bits and cannot be guessed, unlike a password. Accept each token once, end every session of the user after the reset, and answer "if that address has an account, we sent a link" whether or not it has one.

## A Practical Review Process

### Step 1: Understand the Context

Before reading code, answer these questions: What does this feature do? What data does it handle (PII, financial, credentials)? Who can access it? What are the trust boundaries?

### Step 2: Trace Data Flow

Follow untrusted data from entry to exit:

```python
# Entry: untrusted input
user_id = request.args.get('user_id')

# Flow: used in a query
query = f"SELECT * FROM users WHERE id = {user_id}"  # Dangerous!
result = db.execute(query)

# Exit: returned to caller
return jsonify(result)  # Could leak data
```

### Step 3: Check Security Controls

For each piece of functionality, verify: Is input validated before use? Is the user authenticated? Is the user authorized for this specific action? Are errors handled without leaking details? Are security-relevant events logged?

### Step 4: Prioritize Your Findings

Not all issues are equal. Block the merge for critical items like injection, auth bypass, remote code execution, and exposed secrets. Flag as high priority items like XSS, CSRF, weak crypto, and session management flaws. Track medium items like missing security headers, verbose errors, and missing rate limiting in your backlog.

## Writing Feedback That Gets Fixes Shipped

Bad feedback: "This is insecure."

Good feedback:

```text
SQL Injection vulnerability on line 42.

The user input `request.args.get('id')` is concatenated directly
into the SQL query without sanitization.

Attack example:
  id = "1; DROP TABLE users; --"

Fix: Use parameterized queries:
  cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))
```

Every security finding should include the specific location, what the problem is, how it could be exploited, and a concrete fix. This turns a scary security comment into an actionable task.

### Handling Pushback

When someone says "it is just internal, behind a VPN," remind them that defense in depth protects against internal threats too, and VPNs can be compromised. When they say "nobody would actually exploit this," point out that automated scanners look for exactly these patterns. When there is genuine time pressure, help prioritize: fix the injection now, track the missing headers for next sprint.

## The Security Review Quick Reference

Keep this list handy during every review:

**Always check:**

- User input goes through validation before use
- Authentication on sensitive endpoints
- Authorization on every data access
- Parameterized queries for SQL
- Output encoding for the context: HTML, attribute, script or URL
- Secrets not in code, and not in logs
- Generic errors and the same answer for every failed login
- Rate limits on login and password reset

**Red flags:**

- String concatenation near SQL or shell commands
- `eval()`, `exec()`, `pickle`, `yaml.load()`
- `innerHTML` with user data
- `shell=True` with user input
- Missing authorization checks
- Hardcoded secrets or passwords
- `json.dumps()` output placed inside a `<script>` block
- `jwt.decode()` without `algorithms`, or without required `exp`

Security review is a skill that improves with practice. Start by picking one category from this guide and focusing on it during your next review cycle. Once it becomes second nature, add another. Within a few months, you will catch issues that both automated tools and other reviewers miss.

---

## Related Security Posts

- [OWASP Top 10 guide](/guides/owasp-top-10) - One chapter per risk of the 2025 list, each with vulnerable and fixed code in a runnable app
- [Pre-commit Hooks for Security](/posts/pre-commit-hooks-security-guide) - Automate the easy catches (hardcoded secrets, large binaries) so reviewers can focus on logic and architecture
- [How to Integrate DAST Into Your CI/CD Pipeline](/posts/dast-integration-guide) - Validate your review findings at runtime with automated scans that probe for the vulnerabilities you flagged

For a structured approach to identifying what to review first, see our guide on [threat modeling](/guides/threat-modeling).

A missing access check is hard to see in review, so back each one with a test, as [A01:2025 Broken Access Control](/guides/owasp-top-10/01-broken-access-control#h2-prove-each-check-with-a-test) in our OWASP Top 10 guide shows.
