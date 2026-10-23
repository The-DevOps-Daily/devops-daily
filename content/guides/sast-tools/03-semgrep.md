---
title: 'Semgrep Tutorial: Custom Rules, Taint Mode and CI/CD'
description: 'Scan code with Semgrep: registry rules, custom YAML rules and tests, taint mode, diff-aware scans, SARIF, and CI/CD with GitHub Actions and GitLab.'
order: 3
---

**TLDR**: Install Semgrep with `pipx install semgrep` or use the `semgrep/semgrep` image, scan with `semgrep scan --config <rules> .`, and write your own rules in YAML that look like the code they match. Test rules with `semgrep scan --test`. Taint mode follows request data to sinks, but in Semgrep Community Edition only inside one function. In CI, use `--baseline-commit` (or `semgrep ci` with a Semgrep account) so pull requests fail only on new findings, and upload SARIF to GitHub code scanning.

Semgrep is a pattern-based static analyzer for more than 30 languages. Its rules are YAML files whose patterns look like the code you want to find, so a developer can write a useful rule in minutes. That makes it the usual choice for fast pull request checks, pre-commit hooks and team-specific rules.

In this part you scan the `notes-api` sample app from [Part 1](/guides/sast-tools/01-sast-fundamentals#h2-the-sample-app-used-in-this-guide) with registry rules, write and test your own rules, compare taint analysis in Semgrep and its fork Opengrep, and wire Semgrep into CI.

## Prerequisites

- Python 3.10 or newer with `pipx` (or `pip` in a virtual environment), Homebrew, or Docker.
- The `notes-api` app from Part 1 in a Git repository.
- `jq` for a few of the output examples.

## Semgrep Editions and the Opengrep Fork

Semgrep changed its licensing and names in December 2024. What you get today:

|                | Semgrep Community Edition                                     | Semgrep AppSec Platform                                                                                                  | Opengrep                                                                   |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| What it is     | The open source CLI (formerly Semgrep OSS)                    | Semgrep's hosted product: Code, Supply Chain, Secrets                                                                    | A community fork of Semgrep CE 1.100.0, started in January 2025            |
| Licence        | Engine LGPL 2.1                                               | Commercial                                                                                                               | Engine LGPL 2.1                                                            |
| Taint analysis | Inside one function                                           | Across functions and files (Pro engine)                                                                                  | Inside one function; across functions in one file with `--taint-intrafile` |
| Rules          | Registry rules under the Semgrep Rules License, plus your own | Pro rules, registry rules, your own                                                                                      | Your own; no registry of its own                                           |
| Price          | Free                                                          | Code and Supply Chain free for up to 10 contributors and 10 private repositories; Secrets and larger teams on paid plans | Free                                                                       |

Two consequences of the 2024 change are easy to miss:

- **The rules are no longer open source.** The rules in the Semgrep Registry use the Semgrep Rules License v1.0, which allows internal use but forbids using them in a competing product or SaaS. Scanning your own code with them in your own CI is fine.
- **Some output moved behind a login.** Without a login, Semgrep writes `"requires login"` in place of the fingerprint (you saw it in the [SARIF example in Part 1](/guides/sast-tools/01-sast-fundamentals#h2-sarif-the-common-output-format)), and its JSON output also leaves out the matched source lines and the metavariable values.

Opengrep was started by a group of security vendors after that change. It reads the same rule format and adds cross-function taint inside a file, native Windows builds, and fingerprints and metavariable values in its JSON and SARIF output. Most commands in this part work the same with `opengrep scan`.

## Install Semgrep

```tabs
{
  "title": "Install Semgrep",
  "tabs": [
    {
      "label": "pipx (Linux, macOS)",
      "lang": "bash",
      "code": "# pipx installs Semgrep into its own virtual environment\npipx install semgrep"
    },
    {
      "label": "Homebrew",
      "lang": "bash",
      "code": "brew install semgrep"
    },
    {
      "label": "Windows (beta)",
      "lang": "powershell",
      "code": "# Native Windows support is in beta; install Python first and add it to PATH\n[System.Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')\npipx install semgrep"
    },
    {
      "label": "Docker",
      "lang": "bash",
      "code": "# Mount the project and run Semgrep from the official image\ndocker run --rm -v \"${PWD}:/src\" -w /src semgrep/semgrep:1.182.0 \\\n  semgrep scan --config p/python ."
    },
    {
      "label": "Opengrep",
      "lang": "bash",
      "code": "# The fork ships self-contained binaries for Linux, macOS and Windows\ncurl -fsSL https://raw.githubusercontent.com/opengrep/opengrep/main/install.sh | bash"
    }
  ]
}
```

Native Windows support is still marked beta; WSL and Docker work too. Pin the version in CI, because the rules engine changes every week or two. This guide uses Semgrep 1.182.0, released on 20 October 2026:

```terminal
{
  "title": "check the install",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep --version",
      "output": "1.182.0"
    }
  ]
}
```

All the Semgrep and Opengrep output in this part is from real runs of these versions against `notes-api`.

## Scan With Registry Rules

The [Semgrep Registry](https://semgrep.dev/explore) has rule packs per language and topic. Scan `notes-api` with the Python pack and list each finding as line, severity and rule ID:

```terminal
{
  "title": "scan with p/python",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --config p/python --metrics=off --quiet --json . | jq -r '.results[] | \"\\(.start.line)  \\(.extra.severity)  \\(.check_id)\"'",
      "output": "17  WARNING  python.django.security.injection.sql.sql-injection-using-db-cursor-execute.sql-injection-db-cursor-execute\n19  ERROR  python.flask.security.injection.tainted-sql-string.tainted-sql-string\n33  ERROR  python.flask.security.injection.subprocess-injection.subprocess-injection\n33  ERROR  python.lang.security.dangerous-subprocess-use.dangerous-subprocess-use\n33  ERROR  python.lang.security.audit.subprocess-shell-true.subprocess-shell-true\n44  ERROR  python.lang.security.audit.subprocess-shell-true.subprocess-shell-true\n48  WARNING  python.lang.security.insecure-hash-algorithms-md5.insecure-hash-algorithm-md5\n48  WARNING  python.lang.security.audit.md5-used-as-password.md5-used-as-password\n52  WARNING  python.flask.security.audit.debug-enabled.debug-enabled"
    }
  ]
}
```

Without `--json`, Semgrep prints each finding with its message, a link to the rule and the matching code. Compare the result with the [list of flaws in Part 1](/guides/sast-tools/01-sast-fundamentals#h2-the-sample-app-used-in-this-guide):

- **Found:** the SQL injection (line 19), both shell commands (33 and 44), MD5 for passwords (48) and debug mode (52).
- **Only by a pattern rule:** line 44 comes from `subprocess-shell-true`, which flags every `shell=True`. The taint rules (`subprocess-injection`, `dangerous-subprocess-use`) only see the flow in line 33, because in line 44 the request value arrives through a function call.
- **Noise:** line 17 is matched by a Django rule, and its advice (use Django QuerySets) does not apply to a Flask app.
- **Missed:** the hard-coded secret key in line 8. You write a rule for it in the next section.
- **Quiet:** the parameterized query in line 26. Good.

Useful packs and their size when this guide was written (23 October 2026):

| Pack               | Rules       | Use it for                                                                                         |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------------- |
| `p/default`        | about 1,070 | A broad first look at a codebase                                                                   |
| `p/ci`             | about 160   | Pull request checks: rules picked for low noise                                                    |
| `p/security-audit` | about 225   | Security review; noisier, better as non-blocking                                                   |
| `p/owasp-top-ten`  | about 560   | Findings mapped to OWASP categories                                                                |
| `p/secrets`        | 52          | Hard-coded keys and tokens                                                                         |
| `p/python`         | about 150   | Python rules; `p/javascript` (about 75), `p/java` (60) and `p/golang` (about 40) work the same way |

:::note
`--metrics=off` stops Semgrep from sending anonymous usage data. With registry configs the default (`auto`) sends it. `--config auto`, which picks rules for your languages, only works with metrics on.
:::

## Write Your First Rule

Rules are YAML. A rule needs an `id`, the target `languages`, a `message`, a `severity` (`ERROR`, `WARNING` or `INFO`) and at least one pattern. This one catches the hard-coded secret key that the registry missed:

```yaml
rules:
  - id: flask-hardcoded-secret-key
    languages: [python]
    severity: ERROR
    message: The Flask secret key is hard-coded. Anyone who can read the code can forge session cookies. Load it from the environment or a secret store.
    pattern-either:
      - pattern: $APP.secret_key = "..."
      - pattern: $APP.config["SECRET_KEY"] = "..."
      - pattern: $APP.config.update(..., SECRET_KEY="...", ...)
    metadata:
      cwe: 'CWE-798: Use of Hard-coded Credentials'
      category: security
```

`"..."` matches any string literal, so a key read from `os.environ` does not match. Run the rule:

```terminal
{
  "title": "a custom rule",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --config semgrep-rules/flask-secret-key.yaml app.py",
      "output": "┌────────────────┐\n│ 1 Code Finding │\n└────────────────┘\n\n    app.py\n   ❯❯❱ semgrep-rules.flask-hardcoded-secret-key\n          ❰❰ Blocking ❱❱\n          The Flask secret key is hard-coded. Anyone who can read the code can forge session cookies. Load it\n          from the environment or a secret store.\n\n            8┆ app.secret_key = \"dev-secret-change-me\""
    }
  ]
}
```

To run every rule in the folder, point `--config` at the folder: `semgrep scan --config semgrep-rules/ .`. You can repeat `--config` to combine your rules with registry packs.

### Pattern syntax

Patterns are code with placeholders. The pieces you use most:

| Syntax         | Matches                                   | Example                                |
| -------------- | ----------------------------------------- | -------------------------------------- |
| `$X`           | Any expression, bound to the name `X`     | `$DB.execute($QUERY)`                  |
| `...`          | Any arguments, statements or characters   | `requests.get(..., verify=False, ...)` |
| `"..."`        | Any string literal                        | `$APP.secret_key = "..."`              |
| `<... $X ...>` | An expression that contains `$X` anywhere | `print(<... password ...>)`            |
| `$...ARGS`     | Zero or more arguments, bound to a name   | `log($...ARGS)`                        |

Patterns combine with operators:

- `pattern-either`: any of the patterns (OR).
- `patterns`: all of the patterns (AND).
- `pattern-not`: removes matches, for example the safe form of a call.
- `pattern-inside` and `pattern-not-inside`: only matches inside (or outside) some code, such as a function with a route decorator.
- `metavariable-regex`: the text of a metavariable must match a regular expression.
- `focus-metavariable`: report only the part of the match bound to a metavariable, which gives a precise location.

For example, this rule reports HTTP calls that turn off TLS certificate checks, and skips the `tests/` folder:

```yaml
rules:
  - id: requests-verify-disabled
    languages: [python]
    severity: WARNING
    message: TLS certificate verification is disabled for this request.
    patterns:
      - pattern-either:
          - pattern: requests.$METHOD(..., verify=False, ...)
          - pattern: httpx.$METHOD(..., verify=False, ...)
      - metavariable-regex:
          metavariable: $METHOD
          regex: ^(get|post|put|patch|delete|request)$
    paths:
      exclude:
        - 'tests/'
```

### Test your rules

A rule without tests breaks quietly the first time someone edits it. Put a test file with the same name as the rule file next to it, and mark the lines that must match with `# ruleid: <id>` and the lines that must not match with `# ok: <id>`:

```python
import os

from flask import Flask

app = Flask(__name__)

# ruleid: flask-hardcoded-secret-key
app.secret_key = "dev-secret-change-me"

# ruleid: flask-hardcoded-secret-key
app.config["SECRET_KEY"] = "dev-secret-change-me"

# ruleid: flask-hardcoded-secret-key
app.config.update(DEBUG=False, SECRET_KEY="dev-secret-change-me")

# ok: flask-hardcoded-secret-key
app.secret_key = os.environ["FLASK_SECRET_KEY"]

# ok: flask-hardcoded-secret-key
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY")
```

```terminal
{
  "title": "test the rules",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --test semgrep-rules/",
      "output": "1/1: ✓ All tests passed\nNo tests for fixes found."
    }
  ]
}
```

If a `ruleid` line is not matched, or an `ok` line is, the test fails, names the rule and lists the missed or unexpected lines, and the command exits with code 1. Run the tests in CI whenever the rules folder changes. `semgrep scan --validate --config semgrep-rules/` checks the rule syntax without scanning anything.

:::tip
Use the [Semgrep Playground](https://semgrep.dev/playground) to try a pattern against a snippet before you write the test file. Paste only code you are allowed to share: the playground runs on Semgrep's servers.
:::

## Taint Mode

Pattern rules see shapes. For injection bugs you want to know whether request data can reach a dangerous call, which is what `mode: taint` does ([Part 1](/guides/sast-tools/01-sast-fundamentals#h2-data-flow-and-taint-analysis) explains sources, sinks and sanitizers):

```yaml
rules:
  - id: flask-sql-injection
    mode: taint
    languages: [python]
    severity: ERROR
    message: Request data reaches a SQL string. Pass it as a query parameter instead.
    pattern-sources:
      - pattern: flask.request.$ATTR.get(...)
    pattern-sanitizers:
      - pattern: int(...)
    pattern-sinks:
      - patterns:
          - pattern: $DB.execute($QUERY, ...)
          - focus-metavariable: $QUERY
    metadata:
      cwe: 'CWE-89: SQL Injection'

  - id: flask-command-injection
    mode: taint
    languages: [python]
    severity: ERROR
    message: Request data reaches a shell command. Pass a list of arguments and drop shell=True.
    pattern-sources:
      - pattern: flask.request.$ATTR.get(...)
    pattern-sinks:
      - patterns:
          - pattern: subprocess.$FUNC($CMD, ..., shell=True, ...)
          - focus-metavariable: $CMD
    metadata:
      cwe: 'CWE-78: OS Command Injection'
```

- The source `flask.request.$ATTR.get(...)` covers `request.args.get()`, `request.form.get()` and `request.headers.get()`. Semgrep resolves the import, so the rule also matches when the code says `from flask import request`.
- The SQL sink is only the first argument of `execute()`. A value passed as a query parameter, as in line 26, is not a sink.
- `int(...)` is a sanitizer: a number cannot carry SQL.
- `focus-metavariable` reports the exact argument rather than the whole call.

Run both rules with Semgrep CE:

```terminal
{
  "title": "taint mode in Semgrep CE",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --json --config semgrep-rules/flask-taint.yaml app.py | jq -r '.results[] | \"\\(.start.line)  \\(.check_id)\"'",
      "output": "19  semgrep-rules.flask-sql-injection\n33  semgrep-rules.flask-command-injection"
    }
  ]
}
```

The SQL injection (line 19) and the shell command in `ping()` (line 33) are found. The shell command in line 44 is not: in `export()` the request value goes into `run_export(name)`, and Semgrep Community Edition only follows taint inside one function. Opengrep can follow it across functions in the same file:

```terminal
{
  "title": "the same rule in Opengrep",
  "prompt": "$",
  "steps": [
    {
      "cmd": "opengrep --version",
      "output": "1.32.0"
    },
    {
      "comment": "default: inside one function, like Semgrep CE",
      "cmd": "opengrep scan --quiet --json --config semgrep-rules/flask-taint.yaml app.py | jq -r '.results[] | \"\\(.start.line)  \\(.check_id)\"'",
      "output": "19  semgrep-rules.flask-sql-injection\n33  semgrep-rules.flask-command-injection"
    },
    {
      "comment": "--taint-intrafile: across functions in the same file",
      "cmd": "opengrep scan --quiet --json --taint-intrafile --config semgrep-rules/flask-taint.yaml app.py | jq -r '.results[] | \"\\(.start.line)  \\(.check_id)\"'",
      "output": "19  semgrep-rules.flask-sql-injection\n33  semgrep-rules.flask-command-injection\n44  semgrep-rules.flask-command-injection"
    }
  ]
}
```

Semgrep's own answer is its Pro engine (`semgrep scan --pro-intrafile` for one file, `--pro` across files), which needs a Semgrep account and `semgrep install-semgrep-pro`. If your important flows cross files, compare those options with CodeQL in [Part 4](/guides/sast-tools/04-codeql), which follows this flow out of the box.

## Ignore Findings and Files

### Ignore one finding

Add a `nosemgrep` comment with the rule ID and a reason on the line Semgrep reports. In `notes-api`, debug mode is only used by the local development entry point; production runs the app with a WSGI server, so that finding can be accepted:

```python
if __name__ == "__main__":
    app.run(debug=True)  # nosemgrep: semgrep-rules.flask-debug-enabled -- local dev server only
```

```terminal
{
  "title": "nosemgrep",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --json --config semgrep-rules/flask-debug.yaml app.py | jq '.results | length'",
      "output": "0"
    }
  ]
}
```

A bare `# nosemgrep` ignores every rule on that line. Always name the rule, so a new rule that fires on the same line is still reported. Remove the comment again if you are following along: the next sections use the original `app.py`.

### Ignore files

Scan the whole repository and look at which files Semgrep read:

```terminal
{
  "title": "what gets scanned",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --json --config semgrep-rules/ . | jq -c '.paths.scanned'",
      "output": "[\"app.py\",\"semgrep-rules/flask-secret-key.py\"]"
    }
  ]
}
```

The test file `semgrep-rules/flask-secret-key.py` is scanned like application code, so its deliberate bad examples become findings. Without a `.semgrepignore` file, Semgrep uses a built-in list (`.git/`, `node_modules/`, `vendor/`, `build/`, `dist/`, `test/`, `tests/`, minified files and similar) plus your `.gitignore` for untracked files. A `.semgrepignore` file **replaces** that built-in list, so add back what you still need:

```text
# This file replaces Semgrep's built-in ignore list
:include .gitignore
semgrep-rules/
tests/
```

```terminal
{
  "title": "with .semgrepignore",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --json --config semgrep-rules/ . | jq -c '.paths.scanned'",
      "output": "[\"app.py\"]"
    }
  ]
}
```

`:include .gitignore` pulls in the patterns from `.gitignore`. For one-off runs, `--exclude` and `--include` take the same glob syntax: `semgrep scan --config semgrep-rules/ --exclude 'migrations' .`.

## Scan Only What a Change Adds

On a pull request you want to fail only on findings the change introduces. `--baseline-commit` scans the current code, scans the baseline commit, and reports only the difference. Commit the rules, create a branch (`git checkout -b count-endpoint`), add a new endpoint after the `run_export()` function (the decorator goes on line 47, after the two blank lines), and commit it:

```python
@app.route("/notes/count")
def count_notes():
    owner = request.args.get("owner", "")
    db = get_db()
    return {"count": db.execute("SELECT count(*) FROM notes WHERE owner = '" + owner + "'").fetchone()[0]}
```

```terminal
{
  "title": "diff-aware scan",
  "prompt": "$",
  "steps": [
    {
      "comment": "full scan: every finding in the repository",
      "cmd": "semgrep scan --quiet --json --config semgrep-rules/ . | jq -r '.results[] | \"\\(.start.line)  \\(.check_id)\"'",
      "output": "8  semgrep-rules.flask-hardcoded-secret-key\n19  semgrep-rules.flask-sql-injection\n33  semgrep-rules.flask-command-injection\n51  semgrep-rules.flask-sql-injection\n59  semgrep-rules.flask-debug-enabled"
    },
    {
      "comment": "only what this branch adds compared with main",
      "cmd": "semgrep scan --quiet --error --config semgrep-rules/ --baseline-commit main . ; echo \"exit code: $?\"",
      "output": "┌────────────────┐\n│ 1 Code Finding │\n└────────────────┘\n\n    app.py\n   ❯❯❱ semgrep-rules.flask-sql-injection\n          ❰❰ Blocking ❱❱\n          Request data reaches a SQL string. Pass it as a query parameter instead.\n\n           51┆ return {\"count\": db.execute(\"SELECT count(*) FROM notes WHERE owner = '\" + owner +\n               \"'\").fetchone()[0]}\n\nexit code: 1"
    }
  ]
}
```

The full scan reports the old findings plus the new SQL injection in line 51 (debug mode moved to line 59). The diff-aware scan reports only the new one and exits with code 1 because of `--error`, which is what fails the CI job. The baseline must be a commit in your local clone, so CI needs the full history or at least the base branch (`fetch-depth: 0` in GitHub Actions). Switch back with `git checkout main` before you continue.

## Output Formats

| Flag                                         | Format             | Use it for                              |
| -------------------------------------------- | ------------------ | --------------------------------------- |
| (default)                                    | Text               | People                                  |
| `--json`, `--json-output=FILE`               | Semgrep JSON       | Scripts, custom reports                 |
| `--sarif`, `--sarif-output=FILE`             | SARIF 2.1.0        | GitHub code scanning, IDEs, other tools |
| `--gitlab-sast`, `--gitlab-sast-output=FILE` | GitLab SAST report | GitLab merge request security widget    |
| `--junit-xml`, `--junit-xml-output=FILE`     | JUnit XML          | CI test report views                    |

The `--*-output=FILE` flags write a file in addition to the terminal output, so one run can feed several systems:

```terminal
{
  "title": "several outputs from one run",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --config semgrep-rules/ --sarif-output=semgrep.sarif --gitlab-sast-output=gl-sast-report.json . > /dev/null"
    },
    {
      "cmd": "jq '.runs[0].results | length' semgrep.sarif",
      "output": "4"
    },
    {
      "cmd": "jq '.vulnerabilities | length' gl-sast-report.json",
      "output": "4"
    }
  ]
}
```

## Run Semgrep in CI/CD

### GitHub Actions with Semgrep CE

This workflow needs no Semgrep account. On pull requests it fails only on new findings from your own rules; on every run it uploads all findings, including the noisier registry pack, to GitHub code scanning:

```yaml
name: Semgrep

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '17 3 * * 1' # weekly full scan with the newest rules

permissions:
  contents: read

jobs:
  semgrep:
    runs-on: ubuntu-latest
    if: github.actor != 'dependabot[bot]'
    permissions:
      contents: read
      security-events: write # upload SARIF to code scanning
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # the baseline commit must exist locally

      - name: Install Semgrep
        run: pipx install semgrep==1.182.0

      - name: Block new findings (pull requests)
        if: github.event_name == 'pull_request'
        env:
          BASE_REF: ${{ github.base_ref }}
        run: |
          semgrep scan --config semgrep-rules/ --metrics=off --error \
            --baseline-commit "$(git merge-base HEAD "origin/$BASE_REF")" .

      - name: Full scan for code scanning
        if: always()
        run: |
          semgrep scan --config semgrep-rules/ --config p/python --metrics=off \
            --sarif-output=semgrep.sarif . > /dev/null

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: semgrep.sarif
          category: semgrep
```

- The base branch name goes through an environment variable instead of being pasted into the script, the safe habit for any `github.*` value in a `run:` step.
- `git merge-base` finds the base commit the pull request is compared with. It works whether the job checks out GitHub's merge commit (the default for `pull_request`) or the branch head.
- Code scanning on a private repository needs GitHub Code Security; on public repositories it is free. [Part 4](/guides/sast-tools/04-codeql#h2-github-code-security-licensing) explains the licensing.

Then make the check required in a branch ruleset, so a pull request cannot merge while it fails.

### GitHub Actions with Semgrep AppSec Platform

With a Semgrep account, `semgrep ci` downloads the rules and policies you configured in the Semgrep web app, scans only the changed code on pull requests, fails on findings from rules in blocking mode, and sends results to the platform. Create a token in the Semgrep web app and store it as the `SEMGREP_APP_TOKEN` secret:

```yaml
name: Semgrep

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  semgrep:
    name: semgrep/ci
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep:1.182.0
    # Secrets are not available to Dependabot or to pull requests from forks
    if: >-
      github.actor != 'dependabot[bot]' &&
      (github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository)
    steps:
      - uses: actions/checkout@v7
      - run: semgrep ci
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
```

`semgrep ci` without a token stops and tells you to log in or use `semgrep scan`. GitHub does not pass secrets to pull requests from forks, so this job skips them; the blocking step of the account-free workflow above needs no secrets and still runs for them. Use `semgrep scan` with `--config` when you do not want an account.

### GitLab CI

GitLab shows reports in its own SAST format, which Semgrep can write directly:

```yaml
# .gitlab-ci.yml
semgrep:
  stage: test
  image: semgrep/semgrep:1.182.0
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - semgrep scan --config semgrep-rules/ --config p/python --metrics=off
      --gitlab-sast-output=gl-sast-report.json .
  artifacts:
    reports:
      sast: gl-sast-report.json
```

The security widget in merge requests needs GitLab Ultimate; on other tiers the report is a downloadable artifact. GitLab's own SAST template (`include: template: Jobs/SAST.gitlab-ci.yml`) runs a Semgrep-based analyzer with GitLab's rules, which is an alternative if you do not need custom rules.

### Pre-commit hook

The [pre-commit](https://pre-commit.com) framework installs and pins Semgrep for every developer. Add this to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/semgrep/semgrep
    rev: v1.182.0
    hooks:
      - id: semgrep
        args: ['--config', 'semgrep-rules/', '--error', '--quiet', '--metrics=off']
```

Run `pre-commit install` once per clone to activate it. pre-commit passes the staged files to Semgrep and stashes unstaged changes while the hook runs, so the hook scans exactly what you are committing. Your `args` replace the hook's defaults, which is why `--quiet` is repeated here. Keep the hook to your own fast rules; run the large registry packs in CI.

## Make Scans Fast

- **Scan less.** Use `.semgrepignore` for vendored and generated code, and diff-aware scans on pull requests.
- **Use fewer, better rules.** `p/ci` and your own rules are faster and quieter than `p/default` plus `p/security-audit`.
- **Use the limits.** `--timeout` (default 5 seconds per rule per file), `--max-target-bytes` (default 1 MB per file) and `--jobs` (by default based on the number of CPU cores) control the cost of large or odd files.
- **Find the slow rule.** `--time` adds per-rule and per-file timings to the output.

## Common Mistakes

- **Using `--config auto` or `p/default` as a blocking gate on an old codebase.** Start with your own rules and `p/ci`, block on new findings only, and report the rest.
- **Expecting cross-function taint from Semgrep CE.** It follows data inside one function. Test your important flows, and use the Pro engine, Opengrep or CodeQL where they cross functions or files.
- **Forgetting that `.semgrepignore` replaces the built-in list.** Add `tests/`, `vendor/` and `:include .gitignore` back yourself.
- **Writing rules without tests.** A small `ruleid`/`ok` file catches most mistakes in a new pattern.
- **Shipping registry rules in your own product.** The Semgrep Rules License allows internal use, not redistribution in a competing product or SaaS.
- **Shallow clones with `--baseline-commit`.** The baseline commit must exist locally; use `fetch-depth: 0`.

## Summary

- `semgrep scan --config <rules> .` scans with registry packs or your own YAML rules; `--quiet`, `--json` and `--sarif-output` control the output.
- Rules look like code: metavariables, `...` and a few operators cover most needs. Test them with `ruleid`/`ok` comments and `semgrep scan --test`.
- Taint mode follows request data to sinks. Semgrep CE stays inside one function, which missed line 44 of `notes-api`; Opengrep's `--taint-intrafile` and Semgrep's Pro engine follow it further.
- `nosemgrep: <rule-id>` ignores one finding, and `.semgrepignore` replaces the built-in ignore list.
- In CI, block on new findings with `--baseline-commit` or `semgrep ci`, and upload SARIF to code scanning.

In [Part 4](/guides/sast-tools/04-codeql), you scan the same app with CodeQL, which follows the data in line 44 across the function call, and write custom queries.

## Keep Learning

- [Pre-commit Hooks for Security](/posts/pre-commit-hooks-security-guide), for secret scanning before commit
- [Secure Coding Practices Every DevOps Engineer Should Know](/posts/secure-coding-practices-guide)
- [GitHub Actions Workflows Quiz](/quizzes/github-actions-quiz)
- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup)
