---
title: 'A05:2025 Injection'
description: 'A05:2025 Injection: SQL, OS command and cross-site scripting in Node.js, parameterized queries and output encoding, and Semgrep rules that catch them.'
order: 6
---

**TLDR**: Injection happens when user input reaches an interpreter (a SQL database, a shell, a browser) and the interpreter runs part of it as code. The fix is always the same idea: keep data separate from code. Use parameterized queries, call libraries instead of shells, let a template engine or an escaping helper encode output for HTML, and validate input against what you expect. Then check the code automatically, and add your own scanner rules for the sinks that the public rule packs do not know.

Injection fell from third to fifth place in the 2025 list, but it still has the most CVEs of any category: more than 62,000 across 37 CWEs, according to the [A05:2025 page](https://owasp.org/Top10/2025/A05_2025-Injection/). Cross-site scripting (XSS) accounts for more than 30,000 of them (common, usually lower impact), and SQL injection for more than 14,000 (rarer, usually severe). Prompt injection in applications built on large language models is related; OWASP covers it separately as LLM01 in the [Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/).

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- Basic SQL and HTML.

## Keep Data Separate From Code

OWASP orders the defenses:

1. **A safe API** that never mixes data into code: parameterized queries, library calls instead of shell commands, templates that escape output.
2. **Positive (allowlist) validation** of input: the format, length and type you expect. It is not a complete defense on its own, because many fields must accept special characters.
3. **Escaping** for the specific interpreter, for anything dynamic that remains. It is easy to get wrong, so it is the last resort.

## SQL Injection

The first example attack on the OWASP page builds a query by concatenating a request parameter into the SQL text. The vulnerable app's invoice filter does the same:

```javascript
// A05: user input concatenated into SQL
app.get('/api/invoices', (req, res) => {
  const sql = `SELECT * FROM invoices WHERE user_id = ${req.user.id} AND memo = '${req.query.memo}'`;
  res.json(db.prepare(sql).all());
});
```

With the input from the OWASP example, `' OR '1'='1`, the `WHERE` clause becomes `user_id = 1 AND memo = '' OR '1'='1'`. Since `AND` binds tighter than `OR`, the condition is true for every row, and the query returns every user's invoices. Other inputs can read other tables or change data.

The fixed route uses placeholders:

```javascript
// GET /api/invoices?memo=text: a parameterized query, scoped to the caller.
r.get('/', (req, res) => {
  const memo = req.query.memo;
  if (typeof memo !== 'string' || memo.length > 100) {
    return res.status(400).json({ error: 'memo must be a string of up to 100 characters' });
  }
  const rows = db
    .prepare('SELECT id, amount_cents, memo FROM invoices WHERE user_id = ? AND memo = ?')
    .all(req.user.id, memo);
  res.json(rows);
});
```

A parameterized query does not escape the input. The database receives the SQL text with `?` placeholders, parses and plans it, and only then receives the values. The values are never parsed as SQL, whatever characters they contain:

```terminal
{
  "title": "SQL syntax stays data",
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
      "cmd": "curl -s -G localhost:3000/api/invoices --data-urlencode \"memo=' OR '1'='1\" -H \"authorization: Bearer $ALICE\"; echo",
      "output": "[]"
    },
    {
      "cmd": "curl -s -G localhost:3000/api/invoices --data-urlencode 'memo=Alice: hosting, October' -H \"authorization: Bearer $ALICE\"; echo",
      "output": "[{\"id\":1001,\"amount_cents\":12000,\"memo\":\"Alice: hosting, October\"}]"
    }
  ]
}
```

### Dynamic Identifiers

Placeholders work for values, not for table names, column names or sort directions. When users choose a sort column, map their choice to a fixed list:

```javascript
const SORT_COLUMNS = new Map([
  ['amount', 'amount_cents'],
  ['id', 'id'],
]);

app.get('/api/invoices/sorted', (req, res) => {
  const column = SORT_COLUMNS.get(req.query.sort) ?? 'id'; // a Map has no inherited keys
  const direction = req.query.dir === 'desc' ? 'DESC' : 'ASC';
  const rows = db
    .prepare(
      `SELECT id, amount_cents FROM invoices WHERE user_id = ? ORDER BY ${column} ${direction}`
    )
    .all(req.user.id);
  res.json(rows);
});
```

Only strings from the code reach the SQL text; the user's input only selects one of them.

### ORMs and Stored Procedures

ORMs parameterize by default, but each has a raw escape hatch. In Prisma, the `$queryRaw` tagged template sends interpolated values as parameters, while `$queryRawUnsafe` with a string built from input does not:

```javascript
// Safe: the tagged template turns ${name} into a parameter
const users = await prisma.$queryRaw`SELECT id FROM users WHERE name = ${name}`;

// VULNERABLE: the string is built before Prisma sees it
const rows = await prisma.$queryRawUnsafe(`SELECT id FROM users WHERE name = '${name}'`);
```

Stored procedures are not automatically safe either: a procedure that concatenates its parameters into dynamic SQL (`EXECUTE`, `exec()`) has the same flaw inside the database.

## NoSQL Operator Injection

Document databases parse queries from objects. If a JSON body is passed straight into a MongoDB query, a client can send an object with a query operator where your code expects a string, and change what the query matches. Check types before building the query:

```javascript
app.post('/login', async (req, res) => {
  const { name, password } = req.body ?? {};
  if (typeof name !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'name and password must be strings' });
  }
  // ...look the user up by name only, then verify the password hash
});
```

Express 5 changed the default query string parser to `simple`, which no longer turns `?a[b]=c` into nested objects, but JSON bodies still can contain them. A schema validator (Zod, Ajv) applied to every request body enforces types in one place.

## OS Command Injection

The third OWASP example passes a domain name to `nslookup` through a shell. The vulnerable app has the same route:

```javascript
// A05: user input in a shell command
app.get('/api/lookup', (req, res) => {
  exec(`nslookup ${req.query.host}`, (err, stdout) => res.type('text').send(stdout));
});
```

`exec` runs the string through `/bin/sh`, so `;`, `&&`, `|` and `$(...)` in the input start new commands with the server's permissions. The OWASP page's example input, `example.com; cat /etc/passwd`, runs a second command.

The best fix is not to start a program at all. Node.js resolves names itself:

```javascript
import { boundedLookup, isPublicAddress, SsrfError } from './safe-fetch.js';

// GET /api/lookup?host=example.com: a library call instead of a shell command.
const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export async function dnsLookup(req, res) {
  const host = req.query.host;
  if (typeof host !== 'string' || !HOSTNAME.test(host)) {
    return res.status(400).json({ error: 'host must be a hostname' });
  }
  try {
    const all = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new SsrfError('lookup timed out')), 3000);
      boundedLookup(host, { all: true }, (err, result) => {
        clearTimeout(timer);
        return err ? reject(err) : resolve(result);
      });
    });
    // Internal names and addresses are not the caller's business.
    const addresses = all.map((a) => a.address).filter(isPublicAddress);
    if (addresses.length === 0) return res.status(404).json({ error: 'host not found' });
    res.json({ host, addresses });
  } catch (err) {
    if (err instanceof SsrfError) return res.status(503).json({ error: 'busy, try again' });
    res.status(404).json({ error: 'host not found' });
  }
}
```

The route also filters the answer through the [SSRF part's](/guides/owasp-top-10/10-ssrf) `isPublicAddress`, so it cannot be used to map internal host names:

```terminal
{
  "title": "the lookup route",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s -G localhost:3000/api/lookup --data-urlencode 'host=example.com; cat /etc/passwd' -H \"authorization: Bearer $ALICE\" -w ' %{http_code}\\n'",
      "output": "{\"error\":\"host must be a hostname\"} 400"
    },
    {
      "cmd": "curl -s -G localhost:3000/api/lookup --data-urlencode 'host=localhost' -H \"authorization: Bearer $ALICE\" -w ' %{http_code}\\n'",
      "output": "{\"error\":\"host not found\"} 404"
    }
  ]
}
```

If you must run a program, use `execFile` or `spawn` with an argument array and no shell, validate each argument, and end the options with `--` so an argument cannot become a flag:

```javascript
import { execFile } from 'node:child_process';

// No shell: each array element is one argument, whatever characters it contains.
execFile('git', ['log', '--oneline', '-n', '5', '--', filePath], { timeout: 5000 }, callback);
```

Never pass `shell: true` with user input.

## Cross-Site Scripting

XSS is injection into a browser: user input written into a page is parsed as HTML or JavaScript and runs in other users' sessions. The vulnerable app greets users by name:

```javascript
// A05: user input written into HTML without encoding (cross-site scripting)
app.get('/hello', (req, res) => {
  res.send(`<p>Hello, ${req.query.name}!</p>`);
});
```

The fixed app builds HTML with a small tagged template that escapes every interpolated value, so a page cannot forget to:

```javascript
const escapeHtml = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

// A tagged template that HTML-escapes every ${value}, so a page cannot forget to.
const html = (strings, ...values) =>
  strings.reduce((out, part, i) => out + escapeHtml(String(values[i - 1])) + part);
```

```terminal
{
  "title": "markup in a name is shown, not run",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s -G localhost:3000/hello --data-urlencode 'name=<b>Ann</b>'",
      "output": "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Invoices demo</title></head>\n<body><p>Hello, &lt;b&gt;Ann&lt;/b&gt;!</p></body>\n</html>"
    },
    {
      "cmd": "kill %1"
    }
  ]
}
```

In a real application, use a template engine or framework that escapes by default (React, Vue, Svelte, Nunjucks with `autoescape`), and treat their escape hatches as dangerous: `dangerouslySetInnerHTML`, `v-html`, `innerHTML` and the `|safe` filters. Encoding depends on the context: a value inside an HTML attribute, a URL or a `<script>` block needs different escaping, which is why hand-written HTML is risky. When users must submit HTML (a rich text editor), sanitize it with a maintained sanitizer such as DOMPurify.

Add a Content Security Policy as a second layer. The fixed app's policy allows scripts only from its own origin and no inline scripts, so an injected `<script>` block does not run even if escaping fails somewhere ([A02](/guides/owasp-top-10/05-security-misconfiguration#h2-security-headers) shows the header).

The injection tests cover the SQL filter, the lookup route and the HTML escaping:

```terminal
{
  "title": "the injection tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/injection.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/injection.test.js\n\n▶ A05 injection\n  ✔ treats SQL syntax in a filter as data (42.936946ms)\n  ✔ still finds a real memo (23.220098ms)\n  ✔ rejects a host name with shell syntax (17.258325ms)\n  ✔ HTML-encodes user input in pages (16.214395ms)\n✔ A05 injection (563.642458ms)\nℹ tests 4\nℹ suites 1\nℹ pass 4\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1576.194272"
    }
  ]
}
```

## Template Injection

Server-side template injection happens when user input becomes part of a template's source rather than its data, for example by building the template string with input and then rendering it. Always render fixed templates and pass user input as data.

## Find Injection Before Review Does

Static analysis (SAST) follows data from a source, such as `req.query`, to a sink, such as a SQL call. This is Semgrep with its public JavaScript and OWASP Top 10 rule packs on the vulnerable app, from the companion repository's CI:

```terminal
{
  "title": "Semgrep public rules, vulnerable app",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "semgrep scan --config p/javascript --config p/owasp-top-ten --metrics off vulnerable/",
      "output": "┌─────────────┐\n│ Scan Status │\n└─────────────┘\n  Scanning 2 files tracked by git with 563 Code rules:\n\n  Language      Rules   Files          Origin      Rules\n ─────────────────────────────        ───────────────────\n  js               68       2          Community     563\n  <multilang>       5       2\n\n\n\n┌─────────────────┐\n│ 2 Code Findings │\n└─────────────────┘\n\n    vulnerable/app.js\n    ❯❱ javascript.express.security.audit.xss.direct-response-write.direct-response-write\n          ❰❰ Blocking ❱❱\n          Detected directly writing to a Response object from user-defined input. This bypasses any HTML\n          escaping and may expose your application to a Cross-Site-scripting (XSS) vulnerability. Instead, use\n          'resp.render()' to render safely escaped HTML.\n          Details: https://sg.run/vzGl\n\n           18┆ res.send(`<p>Hello, ${req.query.name}!</p>`);\n\n    ❯❱ javascript.express.security.injection.raw-html-format.raw-html-format\n          ❰❰ Blocking ❱❱\n          User data flows into the host portion of this manually-constructed HTML. This can introduce a Cross-\n          Site-Scripting (XSS) vulnerability if this comes from user-provided input. Consider using a\n          sanitization library such as DOMPurify to sanitize the HTML within.\n          Details: https://sg.run/5DO3\n\n           18┆ res.send(`<p>Hello, ${req.query.name}!</p>`);"
    }
  ]
}
```

It found the cross-site scripting twice, and missed the SQL injection, the command injection and the SSRF in the same file. Rule packs know the popular libraries; they did not know the built-in `node:sqlite` module, and their command injection and SSRF rules did not match these routes. A scanner reports only the patterns it has rules for, so a clean scan is not proof of safe code.

Close the gap with project rules for the sinks your code uses. The companion repository's `semgrep.yml` adds three taint rules (SQL text, shell commands and fetch URLs) and one pattern rule for mass assignment; this is the first one:

```yaml
- id: request-data-in-sql-text
  mode: taint
  languages: [javascript]
  severity: ERROR
  message: >-
    Request data reaches the SQL text of a query. Use ? placeholders and pass the
    values to run(), get() or all().
  metadata:
    owasp: 'A05:2025 - Injection'
    cwe: 'CWE-89'
  pattern-sources:
    - pattern: $REQ.query
    - pattern: $REQ.params
    - pattern: $REQ.body
  pattern-sinks:
    - patterns:
        - pattern-inside: $DB.prepare($SQL)
        - pattern: $SQL
```

```terminal
{
  "title": "Semgrep project rules, both versions",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "semgrep scan --config semgrep.yml --metrics off vulnerable/ src/",
      "output": "┌─────────────┐\n│ Scan Status │\n└─────────────┘\n  Scanning 18 files tracked by git with 4 Code rules:\n  Scanning 18 files with 4 js rules.\n\n\n┌─────────────────┐\n│ 4 Code Findings │\n└─────────────────┘\n\n    vulnerable/app.js\n   ❯❯❱ request-data-in-sql-text\n          ❰❰ Blocking ❱❱\n          Request data reaches the SQL text of a query. Use ? placeholders and pass the values to run(), get()\n          or all().\n\n           35┆ res.json(db.prepare(sql).all());\n\n   ❯❯❱ request-body-copied-onto-object\n          ❰❰ Blocking ❱❱\n          Every field of the request body is copied onto an object (mass assignment). Copy only the fields the\n          caller may change.\n\n           57┆ Object.assign(user, req.body);\n\n   ❯❯❱ request-data-as-fetch-url\n          ❰❰ Blocking ❱❱\n          Request data decides which URL the server fetches (SSRF). Use the address-checking safeFetch() from\n          src/safe-fetch.js, or an allowlist.\n\n           68┆ const page = await fetch(req.body.url);\n\n   ❯❯❱ request-data-in-shell-command\n          ❰❰ Blocking ❱❱\n          Request data reaches a shell command. Use a library call, or execFile() with an argument array and\n          strict validation.\n\n           75┆ exec(`nslookup ${req.query.host}`, (err, stdout) => res.type('text').send(stdout));"
    }
  ]
}
```

All four findings are in `vulnerable/`, and none in `src/`. With all three rule sets and `--error`, the scan fails the build on any finding, and the fixed code passes:

```terminal
{
  "title": "Semgrep, all rules, fixed app",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "semgrep scan --config p/javascript --config p/owasp-top-ten --config semgrep.yml --metrics off --error src/",
      "output": " • Findings: 0 (0 blocking)\n • Rules run: 77\n • Targets scanned: 16\n • Parsed lines: ~100.0%\n • Scan was limited to files tracked by git\n • For a detailed list of skipped files and lines, run semgrep with the --verbose flag\nRan 77 rules on 16 files: 0 findings.\n(need more rules? `semgrep login` for additional free Semgrep Registry rules)\n\nIf Semgrep missed a finding, please send us feedback to let us know!\nSee https://semgrep.dev/docs/reporting-false-negatives/"
    }
  ]
}
```

An earlier version of the fixed `hello` route escaped the name with a helper inside an ordinary template string, and the public XSS rule flagged it anyway: a false positive. Moving to the escaping `html` tag both removed the finding and made the safe way the default. When a finding is a false positive, prefer a change like that over a suppression, and keep any suppressions in one reviewed file, as the [A02 part](/guides/owasp-top-10/05-security-misconfiguration#h2-fix-or-accept-never-ignore-silently) does for Trivy. The [SAST Tools guide](/guides/sast-tools/03-semgrep) covers Semgrep rules in depth.

## Common Mistakes

- **Escaping instead of parameterizing.** Hand-written escaping misses cases; placeholders do not.
- **Validating on the client only.** Attackers call the API directly.
- **Blocklists of bad characters.** Allowlist the expected format instead.
- **Trusting the ORM everywhere.** Search the code for raw query methods.
- **`exec` with a template string.** Use a library, or `execFile` with an argument array.
- **Building HTML by hand.** Use escaping templates, and a CSP as backup.
- **Treating a clean scan as proof.** Check what the rules cover, and add your own.

## Summary

- Injection is data treated as code by an interpreter; separate the two.
- Use placeholders for SQL values and allowlists for identifiers.
- Avoid shells; when you must run a program, pass an argument array.
- Escape output for its context, by default, and add a CSP.
- Run SAST in CI with project rules for your own sinks, and test the fixes.

Next, [A06:2025 Insecure Design](/guides/owasp-top-10/04-insecure-design) covers flaws that no input validation can fix, because the control was never designed.

## Keep Learning

- [Semgrep in the SAST Tools guide](/guides/sast-tools/03-semgrep)
- [Two Composer Command Injection Flaws Let Attackers Run Arbitrary Code](/posts/composer-command-injection-cve-2026)
- [One git push to RCE: the anatomy of CVE-2026-3854](/posts/github-rce-git-push-header-injection-cve-2026-3854)
- [Security-Focused Code Reviews](/posts/security-focused-code-reviews)
