---
title: 'A08:2025 Software or Data Integrity Failures'
description: 'A08:2025 Software or Data Integrity Failures: mass assignment, unsafe deserialization, Subresource Integrity, signed updates and build provenance.'
order: 9
---

**TLDR**: Integrity failures happen when an application treats code or data as trustworthy without checking it: a request body copied onto a user record, serialized objects accepted from clients, a script loaded from a CDN, an update downloaded without a signature, an artifact nobody can trace to its build. Copy only the fields a client may set, parse untrusted data into plain data and validate it, sign what you hand out and verify what you take back, pin third-party scripts with Subresource Integrity, and verify signatures and build provenance before you install or deploy.

The category kept eighth place in 2025 with a small rename, from "Software and Data Integrity Failures" to "Software or Data Integrity Failures". The [A08:2025 page](https://owasp.org/Top10/2025/A08_2025-Software_or_Data_Integrity_Failures/) describes it as failing to maintain trust boundaries and verify integrity at a lower level than [A03 Software Supply Chain Failures](/guides/owasp-top-10/06-vulnerable-components): A03 is about where your components come from, A08 about checking each piece of code or data before you trust it. Its notable CWEs are inclusion of functionality from an untrusted source (CWE-829), mass assignment (CWE-915) and deserialization of untrusted data (CWE-502).

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- OpenSSL 3 for the signing example.
- The GitHub CLI (`gh`), logged in with `gh auth login`, to download the release and verify its attestation.

## Mass Assignment

The vulnerable profile route copies the whole request body onto the user:

```javascript
// A08: every field in the request body is copied onto the user (mass assignment)
app.patch('/api/profile', (req, res) => {
  const user = db
    .prepare('SELECT name, role, display_name AS displayName FROM users WHERE id = ?')
    .get(req.user.id);
  Object.assign(user, req.body);
  db.prepare('UPDATE users SET role = ?, display_name = ? WHERE id = ?').run(
    user.role,
    user.displayName,
    req.user.id
  );
  res.json(user);
});
```

The client was meant to change its display name. Because nothing limits which fields it sends, it can also send `"role": "admin"`. The data crosses a trust boundary (from the client into the user record) without a check. The fixed route accepts only the fields on an allowlist and refuses the request if anything else arrives:

```javascript
// PATCH /api/profile: copy only the fields a user may change.
const EDITABLE = new Set(['displayName']);

export function updateProfile({ db, log }) {
  return (req, res) => {
    const body = req.body ?? {};
    const rejected = Object.keys(body).filter((k) => !EDITABLE.has(k));
    if (rejected.length > 0) {
      log.warn(
        { event: `input_validation_fail:${rejected},${req.user.name}`, ip: req.ip, reqId: req.id },
        'profile'
      );
      return res.status(400).json({ error: `not editable: ${rejected.join(', ')}` });
    }
    const { displayName } = body;
    if (typeof displayName !== 'string' || displayName.length < 1 || displayName.length > 50) {
      return res.status(400).json({ error: 'displayName must be 1 to 50 characters' });
    }
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, req.user.id);
    const user = db
      .prepare('SELECT name, role, display_name AS displayName FROM users WHERE id = ?')
      .get(req.user.id);
    res.json(user);
  };
}
```

```terminal
{
  "title": "only editable fields get through",
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
      "cmd": "curl -s -X PATCH localhost:3000/api/profile -H \"authorization: Bearer $ALICE\" -H 'content-type: application/json' -d '{\"displayName\": \"Alice A.\"}'; echo",
      "output": "{\"name\":\"alice\",\"role\":\"user\",\"displayName\":\"Alice A.\"}"
    },
    {
      "cmd": "curl -s -w ' %{http_code}\\n' -X PATCH localhost:3000/api/profile -H \"authorization: Bearer $ALICE\" -H 'content-type: application/json' -d '{\"displayName\": \"Alice\", \"role\": \"admin\"}'",
      "output": "{\"error\":\"not editable: role\"} 400"
    },
    {
      "cmd": "kill %1"
    }
  ]
}
```

Rejecting the request is stricter than silently dropping unknown fields, and it makes client bugs visible. Either is fine; copying everything is not. ORMs make this mistake easy (`User.update(req.body)`). The [project Semgrep rules](/guides/owasp-top-10/03-injection#h2-find-injection-before-review-does) catch the plain JavaScript forms, `Object.assign` and object spread; add patterns for your ORM's update methods. The tests check the route:

```terminal
{
  "title": "the integrity tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/integrity.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/integrity.test.js\n\n▶ A08 data integrity: profile updates\n  ✔ changes an editable field (51.932585ms)\n  ✔ refuses a field the user must not set (36.582363ms)\n✔ A08 data integrity: profile updates (553.972991ms)\nℹ tests 2\nℹ suites 1\nℹ pass 2\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1511.792739"
    }
  ]
}
```

## Untrusted Data Stays Data

Deserialization turns bytes back into objects. Formats that can describe types and behavior, not only data, let the sender choose what gets created: Java serialization (OWASP's example is a client that notices the `rO0` signature of serialized Java objects in a request), Python's `pickle`, PHP's `unserialize`, and JavaScript libraries that revive functions.

- Accept plain data formats from clients: JSON, parsed with `JSON.parse`, then validated against a schema (Zod, Ajv) before use.
- Never pass input to `eval`, `new Function` or `vm.runInContext`; the `vm` module is not a security boundary.
- For YAML, use a parser that only builds plain data. In js-yaml 4 and later, `load()` is safe by default; the old `safeLoad` is gone, and JavaScript-specific types such as functions moved to a separate package.
- If data must go to the client and come back unchanged (state in a form, a cursor, a cookie), sign it, and verify the signature before you use it:

```javascript
import { createHmac, timingSafeEqual } from 'node:crypto';

// 32 random bytes from a secrets manager, base64-encoded; refuse to start without them
const key = Buffer.from(process.env.STATE_SIGNING_KEY ?? '', 'base64');
if (key.length !== 32) throw new Error('STATE_SIGNING_KEY must hold 32 random bytes');

export function sign(data) {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const mac = createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verify(signed) {
  const [body, mac] = signed.split('.');
  const expected = createHmac('sha256', key).update(body).digest();
  const given = Buffer.from(mac ?? '', 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new Error('state was changed');
  }
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}
```

Add an expiry inside the signed data if replaying old values would be a problem.

## Third-Party Code in the Browser

A script tag that loads a library from a CDN gives that CDN, and anyone who compromises it, full control of your page. Subresource Integrity (SRI) pins the exact file: the browser refuses to run it if its hash does not match. Compute the hash from the file you reviewed:

```terminal
{
  "title": "an SRI hash for a pinned library version",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s https://cdn.jsdelivr.net/npm/htmx.org@2.0.11/dist/htmx.min.js | openssl dgst -sha384 -binary | openssl base64 -A; echo",
      "output": "2OatzQy1H+Zd/IIrjr1TcuDGqLXeHhbooAyJY1KdQMKnr4LZ22k31GBLdYKHmVjg"
    }
  ]
}
```

```html
<script
  src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.11/dist/htmx.min.js"
  integrity="sha384-2OatzQy1H+Zd/IIrjr1TcuDGqLXeHhbooAyJY1KdQMKnr4LZ22k31GBLdYKHmVjg"
  crossorigin="anonymous"
></script>
```

SRI only works with a fixed version in the URL; a "latest" URL changes under you and the page breaks, which is the point. Serving the file from your own origin is simpler still, and your CSP can then exclude other script sources.

OWASP's first example in A08 is a subtler form of the same trust problem: a company maps `support.example.com` to a third-party support provider with a DNS record, and every cookie set for `example.com` now goes to that provider. Keep third-party services off domains that receive your session cookies, and use host-only `__Host-` cookies ([A02](/guides/owasp-top-10/05-security-misconfiguration#h3-cookies)).

## Verify Updates and Artifacts

Software that downloads updates must check that they come from you. A signature over the file does that; a checksum fetched from the same server does not, because an attacker who can replace the file can replace the checksum too. With OpenSSL and an Ed25519 key pair:

```terminal
{
  "title": "sign a release, verify it, and catch a changed file",
  "prompt": "$",
  "steps": [
    {
      "cmd": "npm pack --ignore-scripts --silent",
      "output": "owasp-top-10-demo-1.0.0.tgz"
    },
    {
      "cmd": "openssl genpkey -algorithm ed25519 -out release.key"
    },
    {
      "cmd": "openssl pkey -in release.key -pubout -out release.pub"
    },
    {
      "cmd": "openssl pkeyutl -sign -inkey release.key -rawin -in owasp-top-10-demo-1.0.0.tgz -out owasp-top-10-demo-1.0.0.tgz.sig"
    },
    {
      "cmd": "openssl pkeyutl -verify -pubin -inkey release.pub -rawin -in owasp-top-10-demo-1.0.0.tgz -sigfile owasp-top-10-demo-1.0.0.tgz.sig",
      "output": "Signature Verified Successfully"
    },
    {
      "cmd": "cp owasp-top-10-demo-1.0.0.tgz changed.tgz && printf 'x' >> changed.tgz"
    },
    {
      "cmd": "openssl pkeyutl -verify -pubin -inkey release.pub -rawin -in changed.tgz -sigfile owasp-top-10-demo-1.0.0.tgz.sig",
      "output": "Signature Verification Failure"
    }
  ]
}
```

The updater ships with the public key and refuses anything that fails verification. Keep the private key in a key service or hardware token, never on a build agent's disk. In practice, use an established tool instead of raw OpenSSL: Sigstore (cosign) for containers and blobs, minisign for files, and your package manager's signing.

### Build Provenance

A signature says who signed. Provenance says how the artifact was built: from which repository, commit and workflow. The companion repository's capture workflow builds the package tarball and attests it with GitHub artifact attestations, which sign a SLSA provenance statement with a short-lived Sigstore certificate:

```yaml
attest:
  # Only main, which needs a reviewed pull request, may publish the attested package.
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-24.04
  timeout-minutes: 15
  permissions:
    contents: write # publish the tarball as a release asset
    id-token: write # Sigstore signing certificate
    attestations: write
  steps:
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      with:
        persist-credentials: false
    - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
      with:
        node-version: 24
    - name: Build the package tarball
      run: npm pack --ignore-scripts
    - uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
      with:
        subject-path: owasp-top-10-demo-1.0.0.tgz
    - name: Publish the tarball as a release asset
      env:
        GH_TOKEN: ${{ github.token }}
      run: |
        gh release view v1 > /dev/null 2>&1 || gh release create v1 --title 'Attested package' \
          --notes 'The npm pack tarball of this repository, with a build provenance attestation.'
        gh release upload v1 owasp-top-10-demo-1.0.0.tgz --clobber
```

The job then publishes the attested tarball as a release asset. Download it into its own directory and check it against the attestation, pinning the repository, the workflow that must have built it and the branch it must have been built from (`main`, which only changes through reviewed pull requests; the attest job also runs only there):

```terminal
{
  "title": "verify the build provenance of a package",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "gh release download v1 --repo The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27 --pattern 'owasp-top-10-demo-1.0.0.tgz' --dir release --clobber"
    },
    {
      "cmd": "gh attestation verify release/owasp-top-10-demo-1.0.0.tgz --repo The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27 --signer-workflow The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27/.github/workflows/guide.yml --source-ref refs/heads/main",
      "output": "Loaded digest sha256:2e566bdaa737e97640cfe014b530e6d9647e03387b3d697fea0a01fcfa8aa74a for file://release/owasp-top-10-demo-1.0.0.tgz\nLoaded 1 attestation from GitHub API\n\nThe following policy criteria will be enforced:\n- Predicate type must match:................ https://slsa.dev/provenance/v1\n- Source Repository Owner URI must match:... https://github.com/The-DevOps-Daily\n- Source Repository URI must match:......... https://github.com/The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27\n- Source repo ref must match:............... refs/heads/main\n- Subject Alternative Name must match regex: ^https://github\\.com/The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27/\\.github/workflows/guide\\.yml(@(refs/.*|[0-9a-fA-F]+))?$\n- OIDC Issuer must match:................... https://token.actions.githubusercontent.com\n\n✓ Verification succeeded!\n\nThe following 1 attestation matched the policy criteria\n\n- Attestation #1\n  - Build repo:..... The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27\n  - Build workflow:. .github/workflows/guide.yml@refs/heads/main\n  - Signer repo:.... The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27\n  - Signer workflow: .github/workflows/guide.yml@refs/heads/main"
    }
  ]
}
```

Provenance proves origin, not intent: the [TanStack worm](/posts/tanstack-npm-worm-dead-mans-switch) published malicious versions with valid provenance from the real project's pipeline, and the [LiteLLM release](/posts/litellm-1-107-0-compromise-pypi-provenance) was built by the real workflow from a lookalike fork. Provenance tells you which pipeline to investigate, and lets you reject artifacts that did not come from it.

### Pipeline Integrity

The CI/CD pipeline is where code turns into artifacts, so it needs the same integrity checks: changes reach the main branch only through reviewed pull requests, workflow and policy files have code owners, actions are pinned to commit SHAs, and deployments take an artifact that was built and verified once, instead of rebuilding it per environment. [A03](/guides/owasp-top-10/06-vulnerable-components#h2-your-cicd-is-part-of-the-supply-chain) shows a workflow with these properties and the zizmor scan that checks it.

## Common Mistakes

- **`Object.assign(record, req.body)`** or `Model.update(req.body)`.
- **Checksums from the same place as the download**, or signatures that are never verified.
- **CDN scripts without SRI**, or SRI with an unpinned URL.
- **Trusting data that round-trips through the client** without a signature.
- **Accepting provenance from any repository**: pin the expected source and workflow.
- **Rebuilding for each environment**, so the artifact in production is not the one that was tested.

## Summary

- Allowlist the fields a client may change; reject the rest.
- Accept plain data, validate it, and sign anything that must come back unchanged.
- Pin third-party browser code with SRI, or host it yourself.
- Sign releases and updates, verify before installing, and keep signing keys off build machines.
- Attest build provenance and verify the expected repository and workflow before deploying.

Next, [A09:2025 Security Logging and Alerting Failures](/guides/owasp-top-10/09-logging-failures) covers noticing when an attack is happening.

## Keep Learning

- [Software Supply Chain Security: SBOMs, Sigstore, and SLSA in Practice](/posts/software-supply-chain-security)
- [LiteLLM 1.107.0 Was Built From a Lookalike Fork: What PyPI Provenance Can and Cannot Tell You](/posts/litellm-1-107-0-compromise-pypi-provenance)
- [TanStack npm Worm: The Supply-Chain Attack With a Dead-Man's Switch](/posts/tanstack-npm-worm-dead-mans-switch)
- [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)
