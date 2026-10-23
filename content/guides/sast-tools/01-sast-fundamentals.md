---
title: 'SAST Fundamentals: How Static Analysis Finds Vulnerabilities'
description: 'How SAST tools find vulnerabilities: parsing, pattern rules, taint analysis, false positives, SARIF, and where to run scans in your CI/CD pipeline.'
order: 1
---

**TLDR**: A SAST tool parses your code into a model (syntax tree, control flow, data flow) and runs rules against it. Pattern rules match the shape of code. Taint rules follow untrusted data from a **source** (a request parameter) to a **sink** (a SQL query or a shell command). How far a tool can follow that data, inside one function, across functions or across files, decides what it finds. Every tool reports false positives and misses real bugs, so you run it in several places (editor, pull request, scheduled full scans), block only on new high-confidence findings, and triage the rest.

Static Application Security Testing (SAST) reads source code and reports security bugs without running the program. You can scan every commit, the scan needs no test environment, and each finding points to a file and a line, so a developer can fix it while the change is still fresh.

This part explains how SAST tools work, so the results of SonarQube, Semgrep and CodeQL in the next parts make sense: why one tool finds a bug that another misses, why a finding can be wrong, and where scans belong in a pipeline.

## Prerequisites

- You can read a little Python. The examples use a small Flask app, but the ideas apply to every language.
- You know the common web vulnerabilities by name (SQL injection, command injection). The [OWASP Top 10 guide](/guides/owasp-top-10) covers them.
- Optional: Semgrep, if you want to run the two commands in this part yourself ([Part 3](/guides/sast-tools/03-semgrep) shows the install).

## The Sample App Used in This Guide

Every part scans the same small Flask service, `notes-api`. It has six common flaws and one safe query, so you can compare what each tool finds. To follow along, save it as `notes-api/app.py` and commit it to a new Git repository with a `main` branch (`git init -b main`, `git add app.py`, `git commit`). It is deliberately vulnerable: scan it, never run it.

```python
import hashlib
import sqlite3
import subprocess

from flask import Flask, request

app = Flask(__name__)
app.secret_key = "dev-secret-change-me"


def get_db():
    return sqlite3.connect("notes.db")


@app.route("/notes")
def search_notes():
    term = request.args.get("q", "")
    db = get_db()
    rows = db.execute(f"SELECT id, title FROM notes WHERE title LIKE '%{term}%'").fetchall()
    return {"notes": rows}


@app.route("/notes/<int:note_id>")
def get_note(note_id):
    db = get_db()
    row = db.execute("SELECT id, title, body FROM notes WHERE id = ?", (note_id,)).fetchone()
    return {"note": row}


@app.route("/ping")
def ping():
    host = request.args.get("host", "localhost")
    result = subprocess.run(f"ping -c 1 {host}", shell=True, capture_output=True, text=True)
    return {"output": result.stdout}


@app.route("/export")
def export():
    name = request.args.get("name", "notes")
    return run_export(name)


def run_export(name):
    return subprocess.check_output("tar czf /tmp/" + name + ".tgz notes.db", shell=True)


def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()


if __name__ == "__main__":
    app.run(debug=True)
```

| Line | What is wrong                                                                            | Weakness |
| ---- | ---------------------------------------------------------------------------------------- | -------- |
| 8    | The Flask secret key is in the source, so anyone with the code can forge session cookies | CWE-798  |
| 19   | The search term is formatted into the SQL string                                         | CWE-89   |
| 26   | Nothing: a parameterized query. A good tool stays quiet here                             |          |
| 33   | The `host` parameter goes into a shell command in the same function                      | CWE-78   |
| 44   | The `name` parameter goes into a shell command through a helper function                 | CWE-78   |
| 48   | Passwords are hashed with MD5, which is fast and therefore easy to brute-force           | CWE-916  |
| 52   | Debug mode turns on the Werkzeug debugger, which can run code sent by a visitor          | CWE-489  |

Lines 33 and 44 are the same bug. The only difference is that in line 44 the user input crosses a function call before it reaches the shell. That difference matters a lot, as you will see below.

## How Static Analysis Works

A SAST tool does what a compiler front end does, then asks questions about the result:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Source code", "sub": "app.py", "icon": "box", "tone": "slate" },
    { "label": "Parse", "sub": "syntax tree", "icon": "branch", "tone": "blue" },
    { "label": "Model", "sub": "control and data flow", "icon": "gear", "tone": "violet" },
    { "label": "Rules", "sub": "patterns, taint, queries", "icon": "shield", "tone": "amber" },
    { "label": "Findings", "sub": "SARIF, PR comments", "icon": "check", "tone": "green" }
  ]
}
```

1. **Parse.** The tool turns each file into an abstract syntax tree (AST). Most tools parse without building the project; CodeQL needs a build for some compiled languages, such as Go, Swift and Kotlin.
2. **Model.** The tool resolves names and types, builds a **control flow graph** (the order in which statements can run) and a **call graph** (which function calls which), and works out how values move between variables.
3. **Apply rules.** Rules describe bad code. Depending on the tool they are YAML patterns (Semgrep), built-in rules written in Java (SonarQube) or queries in a query language (CodeQL).
4. **Report.** Each finding has a rule ID, a location, a severity and, for data-flow findings, the path the data took. Most tools can write **SARIF**, a standard JSON format that GitHub code scanning, GitLab and IDEs read.

## Pattern Matching

The simplest rules match the shape of the code. This Semgrep rule, saved as `semgrep-rules/flask-debug.yaml` in `notes-api`, reports a Flask app started with `debug=True`:

```yaml
rules:
  - id: flask-debug-enabled
    languages: [python]
    severity: WARNING
    message: Flask debug mode exposes the Werkzeug debugger. Do not enable it in code that can reach production.
    pattern: $APP.run(..., debug=True, ...)
    metadata:
      cwe: 'CWE-489: Active Debug Code'
```

`$APP` matches any expression and `...` matches any other arguments, so the rule finds `app.run(debug=True)`, `app.run("0.0.0.0", debug=True)` and `server.run(port=80, debug=True)`, but not a comment or a string that contains the same text. Semgrep also tracks simple constants, so `flag = True` followed by `app.run(debug=flag)` matches too. Semgrep puts the folder name in front of the rule ID, which is why the finding is called `semgrep-rules.flask-debug-enabled`:

```terminal
{
  "title": "a pattern rule",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --config semgrep-rules/flask-debug.yaml app.py",
      "output": "┌────────────────┐\n│ 1 Code Finding │\n└────────────────┘\n\n    app.py\n    ❯❱ semgrep-rules.flask-debug-enabled\n          ❰❰ Blocking ❱❱\n          Flask debug mode exposes the Werkzeug debugger. Do not enable it in code that can reach production.\n\n           52┆ app.run(debug=True)"
    }
  ]
}
```

Pattern rules are fast, easy to write and easy to read. They are the right tool for "never call this function" or "never set this option" rules. They cannot tell where a value came from, though: a pattern that reports every `subprocess.run(..., shell=True)` also reports the ones that only ever run a fixed string.

## Data Flow and Taint Analysis

Injection bugs are about data, not shapes. **Taint analysis** marks values from untrusted places as tainted and follows them through the program:

- A **source** produces untrusted data: `request.args`, request bodies, headers, environment variables or files, depending on the rule.
- A **sink** is a place where tainted data is dangerous: `cursor.execute()`, `subprocess.run(..., shell=True)`, `eval()`, an HTML response.
- A **sanitizer** makes data safe for a sink: an escaping function, a cast to `int`, an allowlist check.
- **Propagators** pass taint along: string formatting, concatenation, `.strip()`, assignments.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "request.args.get(\"q\")", "sub": "source, line 17", "icon": "globe", "tone": "red" },
    { "label": "term", "sub": "tainted variable", "icon": "activity", "tone": "amber" },
    { "label": "f\"... {term} ...\"", "sub": "taint propagates", "icon": "gear", "tone": "amber" },
    { "label": "db.execute()", "sub": "sink, line 19", "icon": "database", "tone": "red" }
  ]
}
```

The tool reports a finding when tainted data reaches a sink without passing a sanitizer. Line 26 is safe because the user value goes in as a query parameter, not as part of the SQL text, and a taint rule that models `execute()` correctly only treats the first argument as the sink.

### Inside one function, across functions, across files

The most important difference between SAST engines is how far they follow taint:

- **Intraprocedural** analysis follows data inside one function. It finds line 33, where the request value and the shell call are in `ping()`.
- **Interprocedural** analysis follows data through function calls. Only this finds line 44, where `export()` passes the value to `run_export()`.
- **Inter-file** analysis follows calls into other files and modules, which is where most real code keeps its helpers.

In the later parts of this guide the same taint rule gives these real results on `notes-api`:

| Engine                                | Line 33 (same function) | Line 44 (through a helper) |
| ------------------------------------- | ----------------------- | -------------------------- |
| Semgrep Community Edition, taint mode | Found                   | Missed                     |
| Opengrep with `--taint-intrafile`     | Found                   | Found                      |
| CodeQL, `security-extended` suite     | Found                   | Found                      |

Semgrep's Pro engine and SonarQube's taint analysis (Server Developer edition and up, and SonarQube Cloud) also follow data across functions and files. When you compare tools, put an interprocedural case like line 44 in your test app; a demo with one vulnerable function makes every tool look equal.

### Control flow and framework models

Data flow depends on control flow: a value that is checked and rejected on one branch is still dangerous on the other. Tools also need **models** of your frameworks. CodeQL and SonarQube know that Flask's `request.args` is user input and that `sqlite3` executes SQL because someone wrote that model. If you use an in-house HTTP framework or database wrapper, the tool sees no sources or sinks until you add a model or a custom rule, and it reports nothing.

## False Positives and False Negatives

No static analyzer is both complete and exact, so you will see both kinds of error.

A **false positive** is a finding that is not exploitable. Typical causes:

- The tool does not know your sanitizer. If `is_allowed_host(host)` only returns true for two host names, a tool that has never seen that helper still reports the shell call that follows it.
- The rule is broader than the bug. A pattern for `shell=True` fires on fixed strings too.
- The code cannot run in production: test fixtures, examples, dead code.

A **false negative** is a real bug the tool misses. Typical causes:

- Data takes a path the engine cannot follow: through a function call (line 44 for an intraprocedural engine), another file, a queue, a database row or another service.
- Dynamic code: `getattr(module, name)()`, reflection, dependency injection, templates.
- Unmodelled frameworks and libraries.
- Logic flaws. SAST does not know that `/admin/export` should check the user's role, so a missing authorization check looks like normal code.

Handle false positives on purpose, not by turning rules off in bulk: fix the code if the fix is cheap, add a sanitizer model or tighten the rule if the tool is wrong, and otherwise suppress the single finding with a comment that says why (`# nosemgrep: <rule-id>`, `# NOSONAR`, or a dismissal reason in GitHub code scanning). A suppression without a reason is a bug report nobody can review.

## What SAST Can and Cannot See

| SAST sees                           | SAST does not see                                   |
| ----------------------------------- | --------------------------------------------------- |
| Code in the repository it scans     | Vulnerable versions of your dependencies (use SCA)  |
| Data flow the engine can model      | Runtime configuration, headers, TLS, cloud settings |
| Known frameworks and libraries      | Behaviour of services your code calls               |
| Hard-coded values, insecure API use | Business logic and authorization rules              |

That is why SAST is one layer among several:

| Test type           | When it runs                 | What it finds                                      | Main limit                                |
| ------------------- | ---------------------------- | -------------------------------------------------- | ----------------------------------------- |
| **SAST**            | Editor, commit, pull request | Injection, unsafe APIs, hard-coded secrets in code | False positives; no runtime view          |
| **SCA**             | Build, pull request, daily   | Dependencies with known CVEs, licences             | Only known vulnerabilities                |
| **Secret scanning** | Commit, push, history        | Keys and tokens in code and history                | Only patterns it knows                    |
| **IaC scanning**    | Pull request                 | Misconfigured Terraform, Kubernetes, Dockerfiles   | Only what is in the templates             |
| **DAST**            | Staging, after deploy        | Exploitable behaviour of the running app           | Needs a running app; finds no line number |
| **IAST**            | During tests                 | Vulnerable paths seen while tests run              | Needs an agent and good test coverage     |

The posts on [dependency scanning](/posts/dependency-scanning-guide), [pre-commit secret scanning](/posts/pre-commit-hooks-security-guide) and [DAST with OWASP ZAP](/posts/dast-integration-guide) cover the other layers.

## SARIF: the Common Output Format

Semgrep and CodeQL write **SARIF** (Static Analysis Results Interchange Format, version 2.1.0); SonarQube can import SARIF from other tools but does not export its own issues in that format. One result from the rule above looks like this:

```terminal
{
  "title": "one SARIF result",
  "prompt": "$",
  "steps": [
    {
      "cmd": "semgrep scan --quiet --config semgrep-rules/flask-debug.yaml --sarif app.py | jq '.runs[0].results[0]'",
      "output": "{\n  \"fingerprints\": {\n    \"matchBasedId/v1\": \"requires login\"\n  },\n  \"locations\": [\n    {\n      \"physicalLocation\": {\n        \"artifactLocation\": {\n          \"uri\": \"app.py\",\n          \"uriBaseId\": \"%SRCROOT%\"\n        },\n        \"region\": {\n          \"endColumn\": 24,\n          \"endLine\": 52,\n          \"snippet\": {\n            \"text\": \"    app.run(debug=True)\"\n          },\n          \"startColumn\": 5,\n          \"startLine\": 52\n        }\n      }\n    }\n  ],\n  \"message\": {\n    \"text\": \"Flask debug mode exposes the Werkzeug debugger. Do not enable it in code that can reach production.\"\n  },\n  \"properties\": {},\n  \"ruleId\": \"semgrep-rules.flask-debug-enabled\"\n}"
    }
  ]
}
```

The `ruleId` and the location identify the alert. The fingerprint normally lets a platform recognise the same finding after the code around it moves; Semgrep Community Edition writes `requires login` there, and GitHub's SARIF upload action then calculates its own fingerprint from the source line. Because the format is shared, you can upload Semgrep results next to CodeQL results and triage them in one place ([Part 3](/guides/sast-tools/03-semgrep#h2-run-semgrep-in-cicd) shows the upload).

## Where to Run SAST

Run fast checks close to the developer and complete checks where time is cheap:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Editor", "sub": "seconds, on save", "icon": "box", "tone": "slate" },
    { "label": "Pre-commit", "sub": "changed files", "icon": "check", "tone": "blue" },
    { "label": "Pull request", "sub": "new findings block", "icon": "branch", "tone": "amber" },
    { "label": "Default branch", "sub": "full scan", "icon": "shield", "tone": "violet" },
    { "label": "Scheduled", "sub": "new rules, old code", "icon": "activity", "tone": "green" }
  ]
}
```

| Stage                  | What to run                                    | Should it block?                              |
| ---------------------- | ---------------------------------------------- | --------------------------------------------- |
| Editor                 | SonarQube for IDE, the Semgrep extension       | No, it is feedback                            |
| Pre-commit hook        | A small set of fast, precise Semgrep rules     | Yes, but keep it under a few seconds          |
| Pull request           | Diff-aware scan: only findings the change adds | Yes, for high-confidence, high-severity rules |
| Push to default branch | Full scan, results to the dashboard            | No, it records the baseline                   |
| Weekly schedule        | Full scan with the newest rules and queries    | No, it finds old code that new rules now flag |

Two rules make this work in practice:

- **Block on new findings only.** A legacy codebase has hundreds of existing findings. If the pull request check fails on all of them, people disable it. Semgrep (`--baseline-commit` or `semgrep ci`), SonarQube (quality gates on new code) and GitHub code scanning (alerts on the pull request diff) all compare against a baseline.
- **Start with a small, precise rule set.** Turn on the noisy audit rules later, in a mode that reports but does not block.

For pre-commit checks, use the [pre-commit](https://pre-commit.com) framework rather than a hand-written `.git/hooks/pre-commit` script. It installs the same tool version for everyone, passes only the staged files to the hook, and stashes unstaged changes first, so it checks exactly what you are about to commit. [Part 3](/guides/sast-tools/03-semgrep#h3-pre-commit-hook) shows the Semgrep hook, and the post on [pre-commit hooks for security](/posts/pre-commit-hooks-security-guide) adds secret scanning. For gating deployments on scan results, see the [Security Gates guide](/guides/security-gates).

## Triage: What Happens After a Finding

A finding is only useful if someone acts on it. A simple process:

1. **Confirm.** Read the data path. Is the source really reachable by a user? Is there a sanitizer the tool missed?
2. **Decide.** Fix it, mark it as a false positive with a reason, or accept the risk with an owner and a date.
3. **Fix the class, not the line.** If one query is built with an f-string, search for the others, and add a rule so the pattern cannot come back.
4. **Feed back.** Every false positive is a chance to tune a rule or add a model; every missed bug you find later is a chance to add a custom rule or query.

## Common Mistakes

- **Running every rule and blocking on all of them.** The first scan of a real codebase can report thousands of findings. Start small and block on new findings only.
- **Judging a tool on a toy app.** Put cross-function and cross-file flows, your own frameworks and known false positives in your test set.
- **Treating "no findings" as "secure".** SAST does not see dependencies, configuration, runtime behaviour or business logic.
- **Suppressing without a reason.** Every ignore comment or dismissal needs a short explanation that a reviewer can check.
- **Scanning only the default branch.** Findings are cheapest to fix in the pull request that introduces them.

## Summary

- SAST parses code into a model and runs pattern rules, taint rules or queries against it.
- Taint analysis follows untrusted data from sources to sinks; interprocedural and inter-file analysis find bugs that single-function analysis misses.
- False positives come from unknown sanitizers and broad rules; false negatives come from paths and frameworks the engine cannot model.
- SARIF lets you collect results from several tools in one place.
- Run fast rules early, full scans on the default branch and on a schedule, and block pull requests on new, high-confidence findings.

In [Part 2](/guides/sast-tools/02-sonarqube), you set up SonarQube and scan `notes-api` with it.

## Keep Learning

- [Secure Coding Practices Every DevOps Engineer Should Know](/posts/secure-coding-practices-guide)
- [Security-Focused Code Reviews](/posts/security-focused-code-reviews), for the bugs SAST cannot see
- [Injection in the OWASP Top 10 guide](/guides/owasp-top-10/03-injection)
- [Interview question: security architecture and DevSecOps](/interview-questions/senior/security-architecture)
