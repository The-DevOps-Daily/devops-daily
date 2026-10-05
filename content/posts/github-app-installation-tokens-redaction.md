---
title: 'GITHUB_TOKEN Is Now 377 Characters Long. We Tested Which Redaction Rules Still Catch It'
excerpt: 'GitHub finished moving App installation tokens, including the Actions GITHUB_TOKEN, to a new ghs_<app id>_<JWT> format on October 2. We ran 40 real tokens through the usual redaction regexes and one through gitleaks, trufflehog and detect-secrets. The latest gitleaks release found nothing, and the common patterns either missed the token or hid only its first 40 to 46 characters, which were the same in all 40 tokens.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-10-05'
publishedAt: '2026-10-05T09:00:00Z'
updatedAt: '2026-10-05T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - GitHub Actions
  - GitHub Apps
  - Secrets Management
  - CI/CD
  - DevSecOps
---

On October 2, GitHub [finished the rollout](https://github.blog/changelog/2026-10-02-stateless-github-app-installation-tokens-rolled-out/) of a new format for GitHub App installation tokens. By default, every newly minted `ghs_` token, including the `GITHUB_TOKEN` that Actions gives each job, is now `ghs_<app id>_<JWT>` instead of a 40-character opaque string. GitHub's checklist tells you to look at length checks, database columns, proxies, and "logging and secret redaction rules that only match the legacy token pattern." We wanted to know how many of those rules actually break, so we ran 40 real tokens through the usual regexes, and one of them through three popular secret scanners and two databases.

Most of them missed. The latest gitleaks release, with its default rules, found nothing. The common hand-written patterns hid only the first 40 to 46 characters, and in our sample that part never changed from one token to the next, so the "redacted" log line still held everything an attacker needs.

## TLDR

- **The Actions token we measured is 377 characters,** not the "about 520" in GitHub's changelog. All 40 samples had the same length and shape: `ghs_15368_` plus a three-part JWT signed with ES256.
- **The first 46 characters were identical in all 40 tokens.** They are the app ID of GitHub Actions and a base64url JWT header that never changed. A rule that redacts only that part hides nothing secret.
- **Five common patterns redacted the whole token in 0 of 40 cases.** Three never matched at all, so the full token would stay in the log. Two matched only the 40 or 46 public characters.
- **GitHub's own first recommended regex left the hyphen out.** The May 15 version, `ghs_[A-Za-z0-9\._]{36,}`, fully matched 8 of 40 tokens, because 32 had a `-` in the JWT. GitHub corrected it on May 26, and the fixed regex matched all 40.
- **gitleaks 8.30.1 (latest release, March 21) reported 0 findings.** trufflehog 3.97.9 found a 46-character fragment and marked it unverified. detect-secrets 1.5.0 flagged the line. Fixes for gitleaks and trufflehog have been open pull requests since July.
- **Storage fails loudly, except one case.** Postgres and default MySQL 8.4 reject the token in a `VARCHAR(255)` column. MySQL with strict mode off stores the first 255 characters with only a warning.
- **Two custom rules, gitleaks and trufflehog, catch the full 377-character token today.** Both are below and in the companion repo.

## Prerequisites

- Code, logs, or a database that handles GitHub App installation tokens or the Actions `GITHUB_TOKEN`
- [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`) to search a codebase for old patterns
- Optional: a GitHub account to fork the test repo and run it against your own rules

## What changed, and when

GitHub announced the change on [April 24](https://github.blog/changelog/2026-04-24-notice-about-upcoming-new-format-for-github-app-installation-tokens/). The staged rollout started on April 27 with the Actions `GITHUB_TOKEN` and first-party integrations, then moved to all App installation tokens from mid-May to late June. The October 2 post marks it as complete.

What changed:

- **Format:** `ghs_APPID_JWT`. The `ghs_` prefix stays.
- **Length:** "~520 characters" in GitHub's words, and it "will vary based on the data stored within it."
- **Contents:** GitHub says the JWT "contains details about the token such as the target installation, the application, and basic validation details," and that clients must not validate it or depend on its contents.

What did not change: permissions, repository scoping, the one-hour expiration, and the REST endpoint that mints the token. GitHub Enterprise Server is not affected.

One date still matters. GitHub added a temporary `X-GitHub-Stateless-S2S-Token` request header in [May](https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/) so apps could force either format. Apps that send `disabled` to keep getting old tokens lose that option on **November 30, 2026**, when GitHub stops respecting the header.

## How we tested without leaking a token

We did not have a third-party GitHub App to mint tokens from, so we used the token every Actions job already has. GitHub's April notice says the new format covers "GitHub App installation server-to-server tokens, including Actions `GITHUB_TOKEN`." A workflow in a private test repository read `secrets.GITHUB_TOKEN` and passed it to small Python scripts that print only structure: lengths, separator positions, the decoded JWT header, the claim names, and how many characters each regex leaves visible. No step printed the payload values or the signature, and we checked the downloaded logs for any token value before making the repository public.

Two workflows ran on October 5, 2026, on `ubuntu-latest`:

- `check.yml`: one token through the shape script, the regex list, gitleaks, trufflehog, detect-secrets, and Postgres and MySQL service containers.
- `sample.yml`: 40 matrix jobs, one token each, to see whether the results hold across tokens.

This is the shape script's output from the recorded check run:

```terminal
{
  "title": "check.yml, Token shape step",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "comment": "TOKEN is the job's GITHUB_TOKEN; the script prints structure only" },
    {
      "cmd": "python3 scripts/shape.py",
      "output": "length: 377\nprefix: ghs_\nseparators (index, char): [(3, '_'), (9, '_'), (46, '.'), (290, '.'), (321, '-'), (360, '-')]\napp id segment: 15368 (public: the app's numeric id)\nsegment lengths header/payload/signature: 36 243 86\nchars used outside [A-Za-z0-9]: ['-']\nheader: {\"alg\":\"ES256\",\"typ\":\"JWT\"}\npayload claim names: ['aud', 'ctx', 'exp', 'iat', 'iss', 'jti', 'ver']\nexp - iat (s): 3600\nsignature bytes: 64"
    }
  ]
}
```

Put together, a current `GITHUB_TOKEN` looks like this:

```text
ghs_15368_eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.<243-character payload>.<86-character signature>
|____________________________________________|
  46 characters, the same in all 40 samples:
  ghs_ + 15368 (the app ID of GitHub Actions) + _ +
  the base64url of {"alg":"ES256","typ":"JWT"}
```

A few things we did not expect:

- **377, not 520.** All 40 Actions tokens were exactly 377 characters. GitHub's "about 520" probably describes tokens for other apps, which carry more claims. We could not mint one, so we cannot confirm that. Plan for at least 520, as GitHub asks, and do not assume a fixed length either way.
- **The prefix is public.** The 46-character head (`ghs_15368_` plus the header segment) had one SHA-256 value across all 40 samples. It decodes to `{"alg":"ES256","typ":"JWT"}`, which anyone can encode.
- **The JWT uses base64url, so `-` and `_` appear inside it.** 32 of the 40 tokens had a `-`, 27 had a `_`, and only 3 had neither. This detail breaks the most regexes.
- **Actions masks the token in its own logs, but nobody else does.** GitHub masks secret values in workflow logs and says that this [redaction is not guaranteed](https://docs.github.com/en/actions/reference/security/secure-use#use-secrets-for-sensitive-information). Your application logs, proxies, error trackers, and log pipelines do not get that masking at all.

## The redaction test

For each pattern, the scripts ran `re.search` against the token and counted the characters outside the first match. Every pattern here starts with `ghs_`, which appears once per token, so that is also what a `re.sub` replacement would leave visible. The patterns are ones you find in real redaction code: GitHub's old documented shape, the regexes from the current gitleaks and trufflehog releases, the two regexes GitHub recommended in May, and the regexes from the open scanner fixes.

| Pattern                                          | Matched             | Whole token redacted (40 tokens) | Most characters left visible |
| ------------------------------------------------ | ------------------- | -------------------------------- | ---------------------------- |
| `ghs_[0-9a-zA-Z]{36}` (legacy shape)             | never               | 0                                | 377                          |
| `(?:ghu\|ghs)_[0-9a-zA-Z]{36}` (gitleaks 8.30.1) | never               | 0                                | 377                          |
| `\bghs_[A-Za-z0-9_]{36}\b`                       | never               | 0                                | 377                          |
| `(?:ghu\|ghs)_[A-Za-z0-9_]{36}`                  | first 40 characters | 0                                | 337                          |
| trufflehog 3.97.9 GitHub detector                | first 46 characters | 0                                | 331                          |
| `ghs_[A-Za-z0-9\._]{36,}` (GitHub, May 15)       | up to the first `-` | 8                                | 86                           |
| `ghs_[A-Za-z0-9\.\-_]{36,}` (GitHub, May 26)     | whole token         | 40                               | 0                            |
| gitleaks PR #2193                                | whole token         | 40                               | 0                            |
| trufflehog PR #5156                              | whole token         | 40                               | 0                            |

```chart
{
  "type": "bar",
  "title": "Tokens fully redacted, out of 40 real GITHUB_TOKENs",
  "caption": "Each pattern run with Python re against 40 Actions tokens minted on 2026-10-05 (sample.yml in The-DevOps-Daily/ghs-token-check). 'Fully redacted' means re.sub would replace all 377 characters.",
  "rows": [
    { "label": "Legacy ghs_ + 36", "value": 0, "series": "Old shape" },
    { "label": "gitleaks 8.30.1 rule", "value": 0, "series": "Old shape" },
    { "label": "Word-bounded 36", "value": 0, "series": "Old shape" },
    { "label": "Underscore 36", "value": 0, "series": "Old shape" },
    { "label": "trufflehog 3.97.9 rule", "value": 0, "series": "Old shape" },
    { "label": "GitHub, May 15", "value": 8, "series": "New-format aware" },
    { "label": "GitHub, May 26", "value": 40, "series": "New-format aware" },
    { "label": "gitleaks PR #2193", "value": 40, "series": "New-format aware" },
    { "label": "trufflehog PR #5156", "value": 40, "series": "New-format aware" }
  ],
  "series": [
    { "name": "Old shape", "color": "#ef4444" },
    { "name": "New-format aware", "color": "#10b981" }
  ]
}
```

The failures fall into three groups.

**Never matches, so the full token stays in the log.** The legacy shape and the gitleaks rule expect 36 letters or digits right after `ghs_`. The new token has five digits (`15368`) and then an underscore, so the match fails at character 10. The word-bounded variant allows underscores, but its 36 characters end in the middle of the header, where no word boundary exists.

**Matches the public prefix only.** Allow underscores and the pattern matches `ghs_15368_` plus 30 header characters. Make it open-ended (`{36,255}`, which is what trufflehog uses) and it runs to the first `.` and stops at 46 characters. Either way, the payload and the full signature stay in the log line. In our sample the part that disappeared was the same in every token, so anyone who reads the redacted line can paste the prefix back. The result is a working token for as long as it lives, which for an installation token is up to an hour.

**Stops at the first hyphen.** GitHub's May 15 changelog recommended `ghs_[A-Za-z0-9\._]{36,}` "to match both new and current format tokens." A [snapshot from May 19](http://web.archive.org/web/20260519035919/https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/) shows that version. An editor's note dated May 26 updated it to `ghs_[A-Za-z0-9\.\-_]{36,}`. The first version has no `-`, and base64url uses `-`. In our sample, the match stopped somewhere in the signature on 32 of 40 tokens and left 8 to 86 characters visible. For redaction this is the least bad failure, because the hidden part always includes the payload, and in most of those 32 tokens part of the signature too. In one sample the whole signature stayed visible. For **validation** it is worse: code that checks a token with `fullmatch` against the May 15 regex rejects every token that contains a hyphen. In our sample that was 80% of real tokens.

If you copied GitHub's regex in the second half of May, check which version you have.

## What the scanners found

The check workflow wrote the token into a file as `GITHUB_TOKEN=<token>` and pointed the latest release of each scanner at it:

```text
gitleaks v8.30.1
gitleaks findings: 0
trufflehog 3.97.9
trufflehog findings: 1
  Github verified False raw_len 46
detect-secrets 1.5.0
detect-secrets findings: 2
  JSON Web Token
  GitHub Token
```

- **gitleaks 8.30.1 found nothing.** Its `github-app-token` rule is `(?:ghu|ghs)_[0-9a-zA-Z]{36}`, the first "never matches" case above. Someone reported the format change in [issue #2192](https://github.com/gitleaks/gitleaks/issues/2192) on July 15, and [PR #2193](https://github.com/gitleaks/gitleaks/pull/2193) with a fix has been open since July 16. The latest release is from March 21. If gitleaks 8.30.1 with its default rules guards your pre-commit hook or CI, its rule cannot match this token shape, and it did not flag our test file.
- **trufflehog 3.97.9 found a fragment.** Its detector matched the 46-character prefix and reported that fragment as an unverified finding. Most examples in trufflehog's README run with `--results=verified`, and that filter drops this finding. [PR #5156](https://github.com/trufflesecurity/trufflehog/pull/5156), open since July 27, adds a pattern for the new format.
- **detect-secrets 1.5.0 flagged the line twice,** once as a JSON Web Token and once as a GitHub Token. Its GitHub pattern also matches only a prefix, but a scanner only needs to flag the line, and it did.

That last point explains why the same partial match is fine in one tool and bad in another. A **scanner** that matches 46 characters still points a person at the right line. A **redactor** that matches 46 characters prints the rest of the token.

## Storing the token

GitHub asks for columns that "accept at least 520 characters." We inserted the 377-character token into narrow columns to see how each database reacts:

```text
postgres t40:
ERROR:  value too long for type character varying(40)
postgres t255:
ERROR:  value too long for type character varying(255)
mysql 8.4 default sql_mode: ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
mysql strict t255:
ERROR 1406 (22001) at line 1: Data too long for column 'tok' at row 1
mysql non-strict t255:
stored_len
255
```

Postgres and MySQL 8.4 with its default strict mode fail on insert, which is the good outcome: the error is in your logs the first time a new token arrives. MySQL with `sql_mode` cleared, which some older applications set on purpose, stores the first 255 characters and keeps going. The insert succeeds with a warning that is easy to miss, and the failure shows up later as a 401 from the GitHub API.

Installation tokens last an hour, so most apps cache them rather than store them for long. Look anyway: caches with fixed-size keys or values, cookie-backed sessions, and old migrations from when the token was always 40 characters.

## What to change

**1. Find the old patterns.** Search code and config for anything that encodes the old shape:

```bash
# regexes that expect the old 36-character body, and anything mentioning ghs_
rg -n --hidden --glob '!.git' --glob '!node_modules' -e 'ghs_' -e 'gh\[[a-z]+\]_' -e '\{36\}' .

# columns that might hold a token and are too short
rg -n -i -e 'varchar\((40|64|100|128|255)\)' --glob '*.sql' --glob '*migration*' .
```

If your log pipeline or error tracker has its own scrubbing rules, check those too. A rule written for the old shape lives wherever someone pasted it.

**2. Redact with a pattern that covers the whole JWT.** GitHub's corrected regex works:

```python
import re

# GitHub's recommendation as of May 26, 2026; matches old and new ghs_ tokens
GHS = re.compile(r"ghs_[A-Za-z0-9\.\-_]{36,}")

def redact(line: str) -> str:
    return GHS.sub("ghs_[REDACTED]", line)
```

It is greedy, so it also eats a trailing `.` or `-` that ends a sentence. For redaction that is the right tradeoff.

**3. Do not validate the structure.** GitHub says clients "must not take a dependency on the contents of this JWT." If you check tokens at all, check the `ghs_` prefix and a generous maximum length, and let the GitHub API decide if the token is valid.

**4. Patch your scanners until the upstream fixes ship.** Both of these caught the full 377-character token in the recorded run (`gitleaks with config/gitleaks.toml findings: 1, secret_len 377` and `CustomRegex verified False raw_len 377`):

```tabs
{
  "title": "Custom rules for the new installation token format",
  "tabs": [
    {
      "label": "gitleaks",
      "lang": "toml",
      "code": "# .gitleaks.toml: keep the default rules, add one\n[extend]\nuseDefault = true\n\n[[rules]]\nid = \"github-app-installation-token-jwt\"\ndescription = \"GitHub App installation token, stateless ghs_<app id>_<JWT> format\"\nregex = '''ghs_[0-9]+_eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+'''\nkeywords = [\"ghs_\"]"
    },
    {
      "label": "trufflehog",
      "lang": "yaml",
      "code": "# trufflehog --config trufflehog.yaml\ndetectors:\n  - name: GitHubInstallationTokenJWT\n    keywords:\n      - ghs_\n    regex:\n      token: 'ghs_[0-9]+_eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+'"
    }
  ]
}
```

A trufflehog custom detector without a verification endpoint reports its findings as unverified. A run with `--results=verified` drops them too, so let unverified results through for this detector.

**5. Size storage for the documented length, not the one you measured.** Use `text` in Postgres, or at least `VARCHAR(1024)` where you need a bound, and make sure MySQL runs in strict mode so a short column fails on insert.

**6. Remove the override header.** If your app sends `X-GitHub-Stateless-S2S-Token: disabled` to keep old-format tokens, that stops working on November 30, 2026. Fix whatever needed it before then.

## Test your own rules

The workflows, scripts, and recorded results are public. Fork the repository, add your redaction or validation regex to `patterns.txt`, and run the workflows. The test uses the fork's own `GITHUB_TOKEN`, prints no token, and reports how much of a live token your rule leaves visible.

```github
https://github.com/The-DevOps-Daily/ghs-token-check
```

## What we could not test

- **Tokens from other GitHub Apps.** We measured only the Actions `GITHUB_TOKEN`. GitHub says other installation tokens are about 520 characters, and their payloads may differ. Every regex that covers the full JWT structure should still match, but we did not run one.
- **GitHub's own secret scanning and push protection.** Testing them means pushing a live token to a repository, which we chose not to do, and it would say little about your own pipeline.
- **Commercial log scrubbers.** We tested regexes and three open source scanners, not the built-in rules in Datadog, Splunk, or Sentry. Run your own provider's rule through the test repo if you can export it as a regex.
- **How long the prefix stays fixed.** In our 40 samples the header segment never changed. GitHub could change the signing algorithm or add a header field at any time, so treat "the first 46 characters are public" as a property of today's tokens, not a guarantee.

## Summary

GitHub warned about this change for five months and lists "logging and secret redaction rules" in its own checklist. The tools many teams use for that job have not caught up: the latest gitleaks release does not detect the new tokens, trufflehog sees only a fragment that it cannot verify, and the common hand-written patterns redact a prefix that, in our tests, was identical in every token. The fixes are small. Use a pattern that covers the whole JWT, add one custom rule to each scanner, give the column room for 520 characters or more, and test the result against a real token instead of a 40-character example in a unit test.

If you are reviewing the rest of your GitHub Actions setup, our posts on [self-hosted runner version enforcement](/posts/github-self-hosted-runner-version-window) and on [finding secrets before you have to rotate them](/posts/you-cannot-rotate-a-secret-you-cannot-find) cover two related changes.
