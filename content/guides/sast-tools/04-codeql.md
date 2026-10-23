---
title: 'CodeQL Tutorial: Code Scanning Setup, CLI and Custom Queries'
description: 'Set up CodeQL code scanning on GitHub with default or advanced setup, run the CodeQL CLI locally, and write and test custom queries. CodeQL 2.27.'
order: 4
---

**TLDR**: CodeQL turns your code into a database and runs queries against it. On GitHub, turn on **default setup** (Settings, Advanced Security, CodeQL analysis) and you get scans on pushes, pull requests and a weekly schedule with no workflow file; a configuration file can add your own queries and path exclusions. Switch to **advanced setup** (a `codeql.yml` workflow with `github/codeql-action@v4`) when you need a custom build command, other triggers such as pull requests from forks, or the whole configuration in a reviewed workflow file. CodeQL is free for public repositories; private repositories need GitHub Code Security. Locally, `codeql database create` and `codeql database analyze` give you the same results as SARIF, and custom queries live in a CodeQL pack with tests.

CodeQL is the analysis engine behind GitHub code scanning. Instead of matching patterns in text, it extracts your code into a relational database (syntax, types, control flow, data flow) and runs queries written in QL, a logic language, against it. Its standard queries follow untrusted data across functions and files, which is why it finds bugs that single-function tools miss.

In this part you turn on code scanning for a repository, scan the `notes-api` app from [Part 1](/guides/sast-tools/01-sast-fundamentals#h2-the-sample-app-used-in-this-guide) with the CodeQL CLI, and write two custom queries with tests.

## Prerequisites

- A GitHub repository where you are an administrator. Public repositories need nothing else; private ones need GitHub Code Security.
- For the CLI: Linux (x64 or arm64), macOS or Windows, a few GB of free disk for the CodeQL bundle, and the `notes-api` app from Part 1.
- Optional: Visual Studio Code with the CodeQL extension, for writing queries with autocomplete.

## How CodeQL Works

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Source code", "sub": "and its build", "icon": "box", "tone": "slate" },
    { "label": "Extractor", "sub": "per language", "icon": "gear", "tone": "blue" },
    { "label": "CodeQL database", "sub": "AST, types, data flow", "icon": "database", "tone": "violet" },
    { "label": "Queries", "sub": "packs and suites", "icon": "shield", "tone": "amber" },
    { "label": "SARIF", "sub": "code scanning alerts", "icon": "check", "tone": "green" }
  ]
}
```

1. **Extraction.** For each language, an extractor reads the code and writes a database. Interpreted languages (Python, JavaScript and TypeScript, Ruby, GitHub Actions workflows) need no build. Java, C#, C and C++ and Rust can be extracted without a build (`build-mode: none`). Go, Swift and Kotlin need a build (`autobuild` or `manual`).
2. **Queries.** Queries come in **packs** (for example `codeql/python-queries`), and **suites** pick queries from a pack. The standard suites are `code-scanning` (the default, high precision), `security-extended` (more queries, some lower precision) and `security-and-quality` (adds maintainability and correctness queries).
3. **Results.** Each result is a SARIF alert. Data-flow results include the full path from source to sink.

## GitHub Code Security Licensing

- **Public repositories:** CodeQL code scanning, Copilot Autofix for CodeQL alerts and secret scanning are free.
- **Private repositories:** you need **GitHub Code Security** ($30 per active committer per month on GitHub Team or Enterprise). Since 1 April 2025, GitHub sells the old Advanced Security bundle as two products: Code Security (code scanning, the CodeQL CLI, Copilot Autofix, security campaigns, dependency review, security overview) and **GitHub Secret Protection** ($19 per active committer per month: secret scanning and push protection).
- **The CodeQL CLI on its own:** its licence allows free use for academic research and for analysing open source code. Running it on private code needs a Code Security (or older Advanced Security) licence, even outside GitHub.

Third-party SARIF uploads, such as the Semgrep results from [Part 3](/guides/sast-tools/03-semgrep#h3-github-actions-with-semgrep-ce), follow the same rules: free on public repositories, Code Security on private ones.

## Turn On Default Setup

Default setup is the fastest way to start and the right choice for most repositories:

1. Open the repository's **Settings**.
2. In the "Security and quality" section of the sidebar, click **Advanced Security**.
3. Next to **CodeQL analysis**, click **Set up**, then **Default**.
4. Optionally click **Edit** to change the languages or pick the **Extended** query suite.
5. Click **Enable CodeQL**.

GitHub Actions must be enabled. Default setup then:

- detects the supported languages in the repository;
- scans on every push to the default branch and protected branches, and on pull requests to them, except pull requests from forks;
- adds a weekly scan once a push or pull request has triggered an analysis, and keeps it while there has been one in the last 180 days (the first validation scan does not count);
- uses `build-mode: none` for Java, C#, C and C++ and Rust, and `autobuild` for Go, Swift and Kotlin;
- shows results in the **Security** tab and as annotations on pull requests.

## Use Advanced Setup When You Need Control

Default setup can also read a CodeQL configuration file. Set the repository custom property `github-codeql-config-file` to the path of a file like the `codeql-config.yml` below (organization owners can set a default for all repositories), and code scanning merges it with the generated configuration. That adds your own queries and path exclusions without a workflow.

Switch to advanced setup when you need a custom build command, other triggers (for example pull requests from forks), or the whole configuration in a workflow file that is reviewed like other code. In the same settings page, choose **Advanced** to get a starter workflow, or commit one yourself:

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '27 4 * * 1' # weekly, so new queries also check old code

permissions:
  contents: read

jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    permissions:
      security-events: write # upload results
      packages: read # download query packs
      actions: read
      contents: read
    strategy:
      fail-fast: false
      matrix:
        include:
          - language: actions
            build-mode: none
          - language: python
            build-mode: none
    steps:
      - uses: actions/checkout@v7

      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          build-mode: ${{ matrix.build-mode }}
          config-file: ./.github/codeql/codeql-config.yml

      - uses: github/codeql-action/analyze@v4
        with:
          category: '/language:${{ matrix.language }}'
```

```yaml
name: notes-api CodeQL config

queries:
  - uses: security-extended # standard suite
  - uses: ./codeql/notes-queries # in-repository pack (below)

paths-ignore:
  - semgrep-rules
  - '**/tests/**'

query-filters:
  - exclude:
      id: py/clear-text-logging-sensitive-data
```

- The matrix scans the Python code and the repository's own GitHub Actions workflows (language `actions`), which catches problems such as untrusted input in `run:` steps.
- `security-events: write` is required to upload results; `contents: read` is required for private repositories.
- `category` keeps the results of each language apart.
- The configuration file adds the `security-extended` suite and an in-repository query pack, skips the Semgrep rule tests and test folders (`paths-ignore` applies to languages that are not built, such as Python), and turns off one query by ID.
- `github/codeql-action` v4 runs on Node 24. If you still use v3, move to v4: v3 is deprecated together with GitHub Enterprise Server 3.19 in December 2026.

For a compiled language that needs your own build, set `build-mode: manual` and add the build between `init` and `analyze`:

```yaml
- uses: github/codeql-action/init@v4
  with:
    languages: java-kotlin
    build-mode: manual
- run: ./mvnw --batch-mode -DskipTests package
- uses: github/codeql-action/analyze@v4
  with:
    category: '/language:java-kotlin'
```

## Run CodeQL Locally With the CLI

The CLI gives you the same analysis on your own machine: useful for writing queries, for checking a fix before you push, and for running CodeQL in another CI system.

### Install the CodeQL bundle

The **bundle** contains the CLI plus the precompiled standard queries. Download the one for your platform from the [codeql-action releases](https://github.com/github/codeql-action/releases) (tags start with `codeql-bundle-`):

```tabs
{
  "title": "Install the CodeQL bundle",
  "tabs": [
    {
      "label": "Linux x64",
      "lang": "bash",
      "code": "curl -LO https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.3/codeql-bundle-linux64.tar.gz\ntar -xzf codeql-bundle-linux64.tar.gz\nexport PATH=\"$PWD/codeql:$PATH\""
    },
    {
      "label": "Linux arm64",
      "lang": "bash",
      "code": "curl -LO https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.3/codeql-bundle-linux-arm64.tar.gz\ntar -xzf codeql-bundle-linux-arm64.tar.gz\nexport PATH=\"$PWD/codeql:$PATH\""
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "curl -LO https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.3/codeql-bundle-osx64.tar.gz\ntar -xzf codeql-bundle-osx64.tar.gz\nexport PATH=\"$PWD/codeql:$PATH\""
    },
    {
      "label": "Windows (PowerShell)",
      "lang": "powershell",
      "code": "Invoke-WebRequest -Uri https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.3/codeql-bundle-win64.tar.gz -OutFile codeql-bundle-win64.tar.gz\ntar -xzf codeql-bundle-win64.tar.gz\n$env:PATH = \"$PWD\\codeql;$env:PATH\""
    }
  ]
}
```

The Linux and Windows bundles are about 700 MB to download and the macOS bundle about 1.3 GB, so leave a few GB of disk free for the extracted files. With the GitHub CLI you can also run `gh extension install github/gh-codeql`, which downloads and updates CodeQL for you and runs it as `gh codeql`.

The runs below use CodeQL CLI 2.27.3 on Linux arm64. To save disk space they use the CLI-only download from the [codeql-cli-binaries releases](https://github.com/github/codeql-cli-binaries/releases) and fetch the Python queries with `codeql pack download`; with the bundle you can skip that step, because the standard packs are already inside.

Run the commands from the folder that contains `notes-api` (the home folder in these runs). By the end of this part it holds:

```text
~/
├── notes-api/               # the app from Part 1
├── notes-db/                # the CodeQL database
├── notes.sarif              # results of the standard queries
├── custom.sarif             # results of your own queries
└── notes-queries/           # your query pack
    ├── qlpack.yml
    ├── codeql-pack.lock.yml
    ├── HardcodedSecretKey.ql
    ├── SqlInjectionPath.ql
    └── test/
```

```terminal
{
  "title": "CodeQL CLI",
  "prompt": "$",
  "steps": [
    {
      "cmd": "codeql version",
      "output": "CodeQL command-line toolchain release 2.27.3.\nCopyright (C) 2019-2026 GitHub, Inc.\nUnpacked in: /opt/codeql\n   Analysis results depend critically on separately distributed query and\n   extractor modules. To list modules that are visible to the toolchain,\n   use 'codeql resolve packs' and 'codeql resolve languages'."
    },
    {
      "cmd": "codeql pack download codeql/python-queries",
      "output": "Package specifications to check for download: codeql/python-queries\nPackage install location: /home/dev/.codeql/packages\nInstalled fresh codeql/python-queries@1.8.13"
    }
  ]
}
```

### Create a database

```terminal
{
  "title": "create a database",
  "prompt": "$",
  "steps": [
    {
      "cmd": "codeql database create notes-db --language=python --source-root=notes-api",
      "output": "...\nTRAP import complete (5.3s).\nFinished zipping source archive (715.00 B).\nSuccessfully created database at /home/dev/notes-db."
    }
  ]
}
```

Only the last lines of the output are shown. These runs scan a copy of `notes-api` that contains only `app.py`. If yours also has the Semgrep rules and their test file from Part 3, CodeQL scans that file too and the custom query below reports it; pass the configuration file from the advanced setup, which ignores `semgrep-rules`, with `--codescanning-config=codeql-config.yml`. For Python no build command is needed; `--build-mode=none` is implied. For a compiled language you would pass the build with `--command`, for example `--command='./mvnw -DskipTests package'`, or use `--build-mode=none` where the language supports it.

### Analyze the database

Run the `security-extended` suite, write SARIF, and list the results:

```terminal
{
  "title": "analyze notes-api",
  "prompt": "$",
  "steps": [
    {
      "cmd": "codeql database analyze notes-db codeql/python-queries:codeql-suites/python-security-extended.qls --format=sarif-latest --output=notes.sarif --threads=0 --quiet",
      "output": "WARNING: Not caching stages during query-loading, since max heap size is only 1254 MB.\nCodeQL scanned 1 out of 1 Python files in this invocation. Typically CodeQL is configured to analyze a single CodeQL language per invocation, so check other invocations to determine overall coverage information."
    },
    {
      "cmd": "jq -r '.runs[0].results[] | \"\\(.locations[0].physicalLocation.region.startLine)  \\(.ruleId)\"' notes.sarif | sort -n",
      "output": "19  py/sql-injection\n33  py/command-line-injection\n44  py/command-line-injection\n48  py/weak-sensitive-data-hashing\n52  py/flask-debug"
    }
  ]
}
```

`--threads=0` uses one thread per CPU core. The warning about the heap appears on machines with little memory; `--ram=<MB>` sets the memory CodeQL may use. Compared with the [list of flaws in Part 1](/guides/sast-tools/01-sast-fundamentals#h2-the-sample-app-used-in-this-guide):

- **Found:** the SQL injection (19), both command injections (33 and 44), MD5 for passwords (48) and debug mode (52).
- **Quiet:** the parameterized query (26).
- **Missed:** the hard-coded Flask secret key (8). None of the standard Python queries look for it; you write one below.

Line 44 is the interesting one. Semgrep Community Edition's taint rules missed it because the request value crosses a function call (only its broad `shell=True` pattern rule flagged the line). The SARIF result contains the path CodeQL followed:

```terminal
{
  "title": "the data path for line 44",
  "prompt": "$",
  "steps": [
    {
      "cmd": "jq -r '.runs[0].results[] | select(.ruleId == \"py/command-line-injection\" and .locations[0].physicalLocation.region.startLine == 44) | .codeFlows[0].threadFlows[0].locations[] | \"app.py:\\(.location.physicalLocation.region.startLine)  \\(.location.message.text)\"' notes.sarif",
      "output": "app.py:5  ControlFlowNode for ImportMember\napp.py:5  ControlFlowNode for request\napp.py:39  ControlFlowNode for request\napp.py:39  ControlFlowNode for Attribute\napp.py:39  ControlFlowNode for Attribute()\napp.py:39  ControlFlowNode for name\napp.py:40  ControlFlowNode for name\napp.py:43  ControlFlowNode for name\napp.py:44  ControlFlowNode for BinaryExpr"
    }
  ]
}
```

The path starts at the `request` import (line 5), goes through `request.args.get()` in `export()` (39), into the call `run_export(name)` (40), into the parameter of `run_export()` (43) and ends in the shell command (44). On GitHub, the same path appears under **Show paths** on the alert.

### Upload results from another CI system

If your pipeline runs outside GitHub Actions, upload the SARIF file with the CLI. It needs a token with the `security_events` scope (or a fine-grained token with code scanning write access) in `GITHUB_TOKEN`:

```bash
codeql github upload-results \
  --repository=my-org/notes-api \
  --ref=refs/heads/main \
  --commit="$(git -C notes-api rev-parse HEAD)" \
  --checkout-path=notes-api \
  --sarif=notes.sarif
```

## Write Custom Queries

Custom queries cover what the standard packs do not: your frameworks, your conventions, and bugs you have already had once. Start with the secret key that every standard query missed.

### A problem query

A query has a metadata comment, imports, and a `from ... where ... select` clause. Save it as `notes-queries/HardcodedSecretKey.ql`:

```ql
/**
 * @name Hard-coded Flask secret key
 * @description A secret key in source code lets anyone who can read the code
 *              forge session cookies.
 * @kind problem
 * @problem.severity error
 * @security-severity 7.5
 * @precision high
 * @id notes/flask-hardcoded-secret-key
 * @tags security
 *       external/cwe/cwe-798
 */

import python

from AssignStmt assign, Attribute target
where
  assign.getATarget() = target and
  target.getName() = "secret_key" and
  assign.getValue() instanceof StringLiteral
select assign, "Hard-coded Flask secret key. Load it from the environment or a secret store."
```

- `@kind problem` produces one alert per result; `@id` must be unique and stable, because code scanning tracks alerts by it.
- `@security-severity` (0.0 to 10.0) sets the severity GitHub shows: 7.5 is **High**.
- `from` declares variables with their types, `where` constrains them, `select` returns the element to flag and the message.
- `StringLiteral` is the current class for string constants. Older examples use `StrConst`, which is deprecated.

### A path query

For injection bugs you want a **path problem**: a taint-tracking configuration with sources and sinks, plus the path in the result. This query, saved as `notes-queries/SqlInjectionPath.ql`, reports request data that reaches a SQL string, using the same library classes as the built-in `py/sql-injection` query:

```ql
/**
 * @name SQL query built from request data
 * @description Request data reaches a SQL query without a parameter.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 8.8
 * @precision high
 * @id notes/sql-injection
 * @tags security
 *       external/cwe/cwe-089
 */

import python
import semmle.python.dataflow.new.DataFlow
import semmle.python.dataflow.new.TaintTracking
import semmle.python.dataflow.new.RemoteFlowSources
import semmle.python.Concepts

module SqlFromRequestConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) { source instanceof RemoteFlowSource }

  predicate isSink(DataFlow::Node sink) { sink = any(SqlExecution e).getSql() }
}

module SqlFromRequestFlow = TaintTracking::Global<SqlFromRequestConfig>;

import SqlFromRequestFlow::PathGraph

from SqlFromRequestFlow::PathNode source, SqlFromRequestFlow::PathNode sink
where SqlFromRequestFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "This SQL query depends on $@.", source.getNode(),
  "request data"
```

- `RemoteFlowSource` covers request data from every web framework the Python library models (Flask, Django, FastAPI and others).
- `SqlExecution` covers every database API the library models; `getSql()` is the argument that holds the SQL text, so a value passed as a parameter (line 26) is not a sink.
- `TaintTracking::Global` follows data across functions and files. A `ConfigSig` module can also define `isBarrier` for sanitizers.
- `import SqlFromRequestFlow::PathGraph` adds the path edges that the `path-problem` result needs.

### Put the queries in a pack

A **query pack** declares its dependencies, like a package manifest. Save this as `notes-queries/qlpack.yml`; `extractor: python` lets the same pack hold tests:

```yaml
name: notes/python-queries
version: 0.1.0
dependencies:
  codeql/python-all: '*'
extractor: python
```

```terminal
{
  "title": "install the dependencies",
  "prompt": "$",
  "steps": [
    {
      "cmd": "codeql pack install notes-queries",
      "output": "...\nInstalled fresh codeql/util@2.0.47 (library)\nInstalled fresh codeql/xml@1.0.60 (library)\nInstalled fresh codeql/yaml@1.0.60 (library)"
    }
  ]
}
```

`codeql pack install` writes a `codeql-pack.lock.yml` with the exact versions. Commit it, so CI uses the same library version as your machine. Now run both queries against the database:

```terminal
{
  "title": "run the custom queries",
  "prompt": "$",
  "steps": [
    {
      "cmd": "codeql database analyze notes-db notes-queries/ --format=sarif-latest --output=custom.sarif --quiet",
      "output": "WARNING: Not caching stages during query-loading, since max heap size is only 1254 MB."
    },
    {
      "cmd": "jq -r '.runs[0].results[] | \"\\(.locations[0].physicalLocation.region.startLine)  \\(.ruleId)  \\(.message.text)\"' custom.sarif | sort -n",
      "output": "8  notes/flask-hardcoded-secret-key  Hard-coded Flask secret key. Load it from the environment or a secret store.\n19  notes/sql-injection  This SQL query depends on [request data](1)."
    }
  ]
}
```

The first run compiles the queries, which takes a few minutes; later runs reuse the compiled cache. In the advanced setup above, the pack sits in the repository as `codeql/notes-queries` and the configuration file runs it with `uses: ./codeql/notes-queries`. To share a pack across repositories, publish it to the GitHub Container registry with `codeql pack publish` and reference it by name and version (for example `my-org/python-queries@0.1.0`) in the `packs` input. A published pack's scope must be your GitHub organization or user name.

### Test your queries

Query tests are small source files with the expected results next to them. Create a test folder with a `.qlref` file that points to the query, a test file, and an empty `.expected` file:

```text
notes-queries/
├── qlpack.yml
├── HardcodedSecretKey.ql
├── SqlInjectionPath.ql
└── test/
    └── HardcodedSecretKey/
        ├── HardcodedSecretKey.qlref       # contains: HardcodedSecretKey.ql
        ├── HardcodedSecretKey.expected    # empty at first
        └── test.py
```

```python
import os

from flask import Flask

app = Flask(__name__)
app.secret_key = "dev-secret-change-me"  # should be reported
app.secret_key = os.environ["SECRET_KEY"]  # fine: read at runtime
app.debug_key = "not-a-secret"  # fine: another attribute
```

The first run fails, because the expected file is empty, and shows what the query actually returned. If that is right, `--learn` writes it to the `.expected` file, and the next run passes:

```terminal
{
  "title": "test the query",
  "prompt": "$",
  "steps": [
    {
      "cmd": "codeql test run notes-queries/test/",
      "output": "...\n--- expected\n+++ actual\n@@ -1,1 +1,1 @@\n-\n+| test.py:6:1:6:39 | AssignStmt | Hard-coded Flask secret key. Load it from the environment or a secret store. |\n[1/1 comp 4.4s eval 19.1s] FAILED(RESULT) /home/dev/notes-queries/test/HardcodedSecretKey/HardcodedSecretKey.qlref\nCompleted in 2m12s (extract 1m37s comp 4.4s eval 19.8s).\n0 tests passed; 1 tests failed:\n  FAILED: /home/dev/notes-queries/test/HardcodedSecretKey/HardcodedSecretKey.qlref"
    },
    {
      "cmd": "codeql test run --learn notes-queries/test/",
      "output": "Executing 1 tests in 1 directories.\nExtracting test database in /home/dev/notes-queries/test/HardcodedSecretKey.\nCompiling /home/dev/notes-queries/HardcodedSecretKey.ql.\nFound in cache: /home/dev/notes-queries/HardcodedSecretKey.ql (4.3s).\nExecuting tests in /home/dev/notes-queries/test/HardcodedSecretKey.\n--- expected\n+++ actual\n@@ -1,1 +1,1 @@\n-\n+| test.py:6:1:6:39 | AssignStmt | Hard-coded Flask secret key. Load it from the environment or a secret store. |\n[1/1 comp 4.3s eval 20.2s] PASSED /home/dev/notes-queries/test/HardcodedSecretKey/HardcodedSecretKey.qlref\nCompleted in 2m8s (extract 1m33s comp 4.3s eval 21.1s).\nAll 1 tests passed."
    },
    {
      "cmd": "cat notes-queries/test/HardcodedSecretKey/HardcodedSecretKey.expected",
      "output": "| test.py:6:1:6:39 | AssignStmt | Hard-coded Flask secret key. Load it from the environment or a secret store. |"
    },
    {
      "cmd": "codeql test run notes-queries/test/",
      "output": "...\nCompleted in 2m0s (extract 1m27s comp 3.3s eval 18.1s).\nAll 1 tests passed."
    }
  ]
}
```

Commit the `.expected` file. From then on, any change that alters the query's results makes the test fail, and you either fix the query or accept the new output with `--learn`. Run `codeql test run` in CI for every change to the pack.

## Triage Alerts, Autofix and Merge Protection

**Alerts.** Code scanning alerts appear in the **Security** tab and as annotations on pull requests. Dismiss an alert as _False positive_, _Used in tests_ or _Won't fix_, with a comment; dismissals are recorded and show up in the security overview.

**Copilot Autofix.** For CodeQL alerts, GitHub can suggest a code change that fixes the alert, on the pull request or on the alert page. It does not need a Copilot subscription, is on by default for public repositories, and is part of Code Security for private ones. It covers CodeQL alerts and a few partner tools such as ESLint; results you upload from other tools, such as Semgrep SARIF, get no fix suggestions. Review the suggested change like any other code: it is generated, and it can be wrong.

**Merge protection.** To block pull requests that add alerts, add the **Require code scanning results** rule to a branch ruleset (**Settings**, **Rules**, **Rulesets**). For each tool you choose a threshold, for example security alerts of **High or higher**. The check is based on the alerts the pull request adds, so the existing backlog does not block every change.

**Backlog.** On an old codebase the first scan can produce many alerts. Fix new alerts on pull requests first, then work through the backlog by rule or by directory; Code Security's security campaigns help track that work across repositories.

## Speed and Troubleshooting

- **Slow analysis.** Analysis time grows with code size and the number of queries. Use the default suite on pull requests and `security-extended` on the schedule, give CodeQL more threads and memory (`--threads=0`, `--ram`), use `build-mode: none` where your language supports it, and turn on `dependency-caching: true` in the `init` step for Java, Go and C# dependencies.
- **Few or no results for a compiled language.** If `autobuild` cannot build the project (missing tools, private dependencies, an unusual build system), extraction finds little or nothing. Switch to `build-mode: manual` and run your real build command, or use `build-mode: none` where the language supports it.
- **Missing languages.** In advanced setup, only the languages in the matrix are scanned; default setup detects them for you.
- **Generated or vendored code.** Exclude it with `paths-ignore` in the configuration file (for Python, JavaScript and other languages without a build).
- **Duplicate or replaced results.** Give each analysis its own `category`. Since July 2025, code scanning rejects a SARIF upload that contains several runs from the same tool with the same category.

## Common Mistakes

- **Writing a workflow when default setup would do.** Start with default setup and move to advanced setup when you hit a real limit.
- **Treating CodeQL as free for private code.** The CLI licence covers open source and research; private repositories need Code Security.
- **Wrong build mode for compiled code.** A failed or partial build means little or no extracted code. Use `none` for Java, C#, C and C++ or Rust when a build is hard to reproduce, and a working build for Go, Swift and Kotlin.
- **Using the old dataflow API.** Queries that extend `TaintTracking::Configuration` or use `StrConst` come from older tutorials; use `ConfigSig` modules with `TaintTracking::Global` and `StringLiteral`.
- **Custom queries without tests.** A library upgrade can change what a query matches; `codeql test run` in CI tells you before your alerts change.
- **Blocking on every alert.** Set the merge protection threshold to security alerts of High or higher, not to every warning and note.

## Summary

- CodeQL extracts code into a database and runs QL queries; its taint tracking follows data across functions and files, so it found the flow in line 44 of `notes-api` that Semgrep CE's taint rules missed.
- Default setup is a few clicks and needs no workflow file, and a configuration file can add queries to it; advanced setup (`github/codeql-action@v4`) adds custom builds, other triggers and the full configuration in a workflow.
- Public repositories get CodeQL and Copilot Autofix for free; private repositories need GitHub Code Security ($30 per active committer per month).
- The CLI runs the same analysis locally: `codeql database create`, `codeql database analyze`, SARIF out.
- Custom queries live in a pack with a lock file and tests (`codeql test run`, `--learn`).

That completes the toolkit: SonarQube for code quality and security dashboards ([Part 2](/guides/sast-tools/02-sonarqube)), Semgrep for fast custom rules ([Part 3](/guides/sast-tools/03-semgrep)), and CodeQL for deep data-flow analysis. The [guide overview](/guides/sast-tools) compares the three side by side.

## Keep Learning

- [Security Gates guide](/guides/security-gates), to turn scan results into pipeline policies
- [The pwn request just got harder: what actions/checkout v7 changes](/posts/pwn-request-github-actions-checkout-v7), for GitHub Actions security
- [Software Supply Chain Security: SBOMs, Sigstore, and SLSA](/posts/software-supply-chain-security)
- [GitHub Actions Workflows Quiz](/quizzes/github-actions-quiz)
