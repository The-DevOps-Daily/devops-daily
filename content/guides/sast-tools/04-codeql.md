---
title: 'CodeQL'
description: 'Master CodeQL for deep semantic code analysis. Learn the query language, run security queries, and integrate with GitHub Advanced Security.'
---

CodeQL is GitHub's semantic code analysis engine. Unlike pattern-based tools, CodeQL treats code as data—you query it using a specialized language to find complex vulnerabilities that simpler tools miss.

## How CodeQL Works

CodeQL operates in two phases:

```
1. Database Creation
   Source Code → CodeQL Extractor → CodeQL Database
   
2. Query Execution
   CodeQL Database + Queries → Results
```

**Database creation** parses your code into a relational database containing:
- Abstract Syntax Tree (AST) nodes
- Data flow information
- Control flow graphs
- Type information
- Call graphs

**Query execution** runs QL queries against this database to find patterns.

## Installation

### CodeQL CLI

```bash
# macOS
brew install codeql

# Download from GitHub
# https://github.com/github/codeql-cli-binaries/releases

# Verify installation
codeql --version
# CodeQL command-line toolchain release 2.16.0
```

### Standard Query Packs

```bash
# Download standard libraries and queries
codeql pack download codeql/python-queries
codeql pack download codeql/javascript-queries
codeql pack download codeql/java-queries
```

## Creating a CodeQL Database

Before running queries, you must create a database from your source code:

```bash
# Python project
codeql database create ./codeql-db \\
  --language=python \\
  --source-root=./src

# JavaScript/TypeScript project
codeql database create ./codeql-db \\
  --language=javascript \\
  --source-root=.

# Java project (requires build)
codeql database create ./codeql-db \\
  --language=java \\
  --command='mvn clean compile'
```

**Note:** Compiled languages (Java, C++, Go) require CodeQL to observe the build process. Interpreted languages (Python, JavaScript) don't need a build command.

## Running Security Queries

### Using Query Packs

```bash
# Run all security queries for Python
codeql database analyze ./codeql-db \\
  codeql/python-queries:codeql-suites/python-security-extended.qls \\
  --format=sarif-latest \\
  --output=results.sarif

# Run specific query
codeql database analyze ./codeql-db \\
  codeql/python-queries:Security/CWE-089/SqlInjection.ql \\
  --format=sarif-latest \\
  --output=sql-injection.sarif
```

### Query Suites

| Suite | Description | Use Case |
|-------|-------------|----------|
| `security-extended.qls` | Comprehensive security queries | Deep security audits |
| `security-and-quality.qls` | Security + code quality | General CI scanning |
| `code-scanning.qls` | GitHub Code Scanning defaults | PR checks |

## Understanding the QL Language

QL is a declarative, object-oriented query language. Learning the basics helps you understand query results and write custom queries.

### Basic Query Structure

```ql
/**
 * @name Find calls to eval
 * @description Detects calls to the eval function
 * @kind problem
 * @problem.severity warning
 * @id py/call-to-eval
 */

import python

from Call call, Name name
where
  call.getFunc() = name and
  name.getId() = "eval"
select call, "Call to eval() detected"
```

**Query components:**

- `import python` — Import the Python standard library
- `from ... where ... select` — SQL-like query structure
- `@kind problem` — Query produces alert-style results
- `@problem.severity` — warning, error, or recommendation

### Finding SQL Injection (Python)

```ql
/**
 * @name SQL injection vulnerability
 * @description User input flows to SQL query without sanitization
 * @kind path-problem
 * @problem.severity error
 * @id py/sql-injection
 */

import python
import semmle.python.dataflow.new.DataFlow
import semmle.python.dataflow.new.TaintTracking
import semmle.python.Concepts

module SqlInjectionConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource
  }

  predicate isSink(DataFlow::Node sink) {
    exists(SqlExecution sql | sql.getSql() = sink)
  }
}

module SqlInjectionFlow = TaintTracking::Global<SqlInjectionConfig>;

from SqlInjectionFlow::PathNode source, SqlInjectionFlow::PathNode sink
where SqlInjectionFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "SQL injection from $@", source.getNode(), "user input"
```

This query:
1. Defines sources (user input from HTTP requests)
2. Defines sinks (SQL execution functions)
3. Uses taint tracking to find paths from sources to sinks
4. Reports vulnerabilities with data flow paths

### Common QL Concepts

**Classes and predicates:**

```ql
// Class representing function calls
class DangerousCall extends Call {
  DangerousCall() {
    this.getFunc().(Name).getId() in ["eval", "exec", "compile"]
  }
}

// Predicate (reusable condition)
predicate isUserInput(Expr e) {
  exists(Call call | 
    call.getFunc().(Attribute).getName() = "get" and
    call.getFunc().(Attribute).getObject().(Name).getId() in ["request", "args", "form"] and
    call = e
  )
}
```

**Data flow:**

```ql
// Track data from source to sink
from DataFlow::Node source, DataFlow::Node sink
where
  source instanceof RemoteFlowSource and
  sink = any(Call c | c.getFunc().(Name).getId() = "eval").getAnArg() and
  DataFlow::localFlow(source, sink)
select sink, "User input flows to eval"
```

## GitHub Code Scanning Integration

The easiest way to use CodeQL is through GitHub's free Code Scanning feature.

### Enable Code Scanning

1. Go to your repository on GitHub
2. Click **Security** > **Code scanning**
3. Click **Set up code scanning**
4. Select **CodeQL Analysis**
5. Review and commit the workflow

### Default Workflow

```yaml
# .github/workflows/codeql.yml
name: "CodeQL"

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly on Monday

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    strategy:
      fail-fast: false
      matrix:
        language: ['python', 'javascript']

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

### Custom Queries in CI

Add your own queries to the analysis:

```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: ${{ matrix.language }}
    queries: +security-and-quality
    # Add custom query pack
    packs: my-org/my-custom-queries@1.0.0
```

Or reference local queries:

```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: python
    queries: ./codeql/custom-queries/
```

## Writing Custom Queries

### Query Pack Structure

```
my-queries/
├── qlpack.yml          # Pack metadata
├── codeql-suites/
│   └── my-suite.qls    # Query suite definition
└── src/
    └── security/
        ├── HardcodedCredentials.ql
        └── InsecureRandomness.ql
```

**qlpack.yml:**

```yaml
name: my-org/my-queries
version: 1.0.0
dependencies:
  codeql/python-all: "*"
```

**Query suite (my-suite.qls):**

```yaml
- queries: .
- include:
    kind: problem
- include:
    kind: path-problem
```

### Example: Detecting Hardcoded Secrets

```ql
/**
 * @name Hardcoded credentials
 * @description Credentials should not be hardcoded in source code
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id py/hardcoded-credentials
 * @tags security
 *       external/cwe/cwe-798
 */

import python

predicate isCredentialVariable(Name name) {
  name.getId().toLowerCase().regexpMatch(".*\\b(password|passwd|pwd|secret|api_key|apikey|token|auth)\\b.*")
}

from Assign assign, Name target, StrConst value
where
  assign.getATarget() = target and
  assign.getValue() = value and
  isCredentialVariable(target) and
  value.getText().length() > 4  // Ignore empty/short strings
select assign, "Potential hardcoded credential in variable '" + target.getId() + "'"
```

### Testing Your Queries

CodeQL supports unit testing for queries:

```
my-queries/
└── test/
    └── security/
        ├── HardcodedCredentials/
        │   ├── test.py           # Test code
        │   └── HardcodedCredentials.expected  # Expected results
```

**test.py:**

```python
# Test file for hardcoded credentials detection

password = "secret123"  # $result
api_key = "AKIA1234567890ABCDEF"  # $result

username = "admin"  # Safe - not a credential variable
safe_value = get_password_from_vault()  # Safe - not a string literal
```

**Run tests:**

```bash
codeql test run my-queries/test/
```

## Best Practices

### 1. Start with Standard Queries

CodeQL's built-in queries are well-tested. Customize only when you have specific needs.

### 2. Use Path Queries for Data Flow

Path queries (`@kind path-problem`) show the complete data flow from source to sink, making vulnerabilities easier to understand and fix.

### 3. Tune for Your Codebase

Exclude generated code and vendor directories:

```yaml
# codeql-config.yml
paths-ignore:
  - node_modules
  - vendor
  - "**/*.generated.py"
```

### 4. Cache Databases

CodeQL database creation is expensive. Cache it in CI:

```yaml
- name: Cache CodeQL database
  uses: actions/cache@v3
  with:
    path: .codeql-db
    key: codeql-${{ hashFiles('**/*.py') }}
```

### 5. Review Alerts Systematically

GitHub Code Scanning shows alerts in the Security tab. Triage them:
- **Dismiss** with reason if false positive
- **Create issue** for real vulnerabilities
- **Fix in PR** for easy fixes

## CodeQL vs. Other Tools

| Feature | CodeQL | Semgrep | SonarQube |
|---------|--------|---------|----------|
| Analysis depth | Deepest | Pattern-based | Deep |
| Speed | Slow | Fast | Medium |
| Custom rules | Complex (QL) | Easy (YAML) | Medium |
| Data flow | Excellent | Pro only | Good |
| Free for private repos | Paid | Limited | Community Ed |
| GitHub integration | Native | Good | Good |

**Use CodeQL when:**
- You need to find complex vulnerabilities
- You're using GitHub and want native integration
- You have time for thorough analysis (weekly scans)
- You're auditing security-critical code

## GitHub Advanced Security Pricing

- **Free** for public repositories
- **Paid** for private repositories (GitHub Advanced Security license)
- Includes: Code Scanning, Secret Scanning, Dependency Review

## Troubleshooting

### Database Creation Fails

```bash
# Verbose output for debugging
codeql database create ./codeql-db \\
  --language=python \\
  --source-root=. \\
  --verbosity=progress
```

### Query Times Out

```bash
# Increase timeout (default 5 minutes)
codeql database analyze ./codeql-db \\
  codeql/python-queries:codeql-suites/python-security-extended.qls \\
  --timeout=1800  # 30 minutes
```

### Too Many Results

```bash
# Limit to high-precision queries
codeql database analyze ./codeql-db \\
  codeql/python-queries:codeql-suites/python-security-extended.qls \\
  --sarif-add-snippets \\
  --threads=4
```

## Key Takeaways

1. **CodeQL is the deepest analysis** — Best for finding complex vulnerabilities
2. **Database creation is a separate step** — Plan for build time
3. **QL is powerful but complex** — Start with standard queries
4. **GitHub integration is seamless** — Free for open source
5. **Combine with faster tools** — Use Semgrep for pre-commit, CodeQL for weekly deep scans

You now have a comprehensive SAST toolkit: SonarQube for platform-wide visibility, Semgrep for fast custom rules, and CodeQL for deep semantic analysis. Layer these tools to catch vulnerabilities at every stage of development.
