---
title: 'SAST Fundamentals'
description: 'Understand how static analysis works, different analysis techniques, and the limitations of SAST tools.'
---

Before diving into specific tools, you need to understand how static analysis works and what it can (and cannot) do. This knowledge helps you configure tools effectively, interpret results accurately, and set realistic expectations.

## How Static Analysis Works

Static analysis examines source code without executing it. The analyzer builds a representation of your code—typically an Abstract Syntax Tree (AST)—and then applies rules to detect patterns that indicate vulnerabilities.

### The Analysis Pipeline

```
Source Code → Parsing → AST → Analysis Engine → Rules → Findings
     │           │         │          │            │         │
     ▼           ▼         ▼          ▼            ▼         ▼
  .java,     Lexical    Tree      Data flow,   Security   Vulnerabilities
  .py, .js   tokens     structure  taint,      patterns   with severity
                                   control flow
```

**Step by step:**

1. **Parsing** — Convert source code into tokens, then build an AST
2. **Semantic Analysis** — Resolve types, scopes, and symbol references
3. **Control Flow Analysis** — Map possible execution paths
4. **Data Flow Analysis** — Track how data moves through the program
5. **Pattern Matching** — Apply security rules to find vulnerabilities
6. **Reporting** — Generate findings with severity, location, and remediation

## Types of Static Analysis

Different tools use different analysis techniques. Understanding these helps you choose the right tool.

### Pattern Matching (Syntactic Analysis)

The simplest approach: look for code patterns that match known-bad signatures.

```python
# Rule: Detect hardcoded passwords
# Pattern: variable named "password" assigned a string literal

password = "secretpassword123"  # FLAGGED: Hardcoded credential

api_key = "AKIA1234567890ABCDEF"  # FLAGGED: AWS key pattern
```

**Pros:**
- Fast execution (simple string/regex matching)
- Easy to write custom rules
- Low false positive rate for simple patterns

**Cons:**
- Misses complex vulnerabilities
- Easy to bypass (variable renaming, string concatenation)
- No understanding of data flow

**Tools:** Semgrep (primarily), grep-based custom scripts

### Data Flow Analysis

Tracks how data moves from sources (user input) to sinks (dangerous functions).

```python
# Data flow analysis tracks this:

def process_user(request):
    username = request.get('username')     # SOURCE: User input
    
    # Data flows through transformations...
    processed = username.strip()
    lower_name = processed.lower()
    
    # Eventually reaches a dangerous sink
    query = f"SELECT * FROM users WHERE name = '{lower_name}'"  # SINK: SQL
    cursor.execute(query)  # FLAGGED: Tainted data reaches SQL sink
```

The analyzer traces the "taint" from `request.get()` through all transformations to `cursor.execute()`. If no sanitization occurs, it reports a SQL injection.

**Pros:**
- Catches complex vulnerabilities across function boundaries
- Understands when data is sanitized
- Fewer false negatives than pattern matching

**Cons:**
- More false positives (sanitizers not recognized)
- Slower analysis (must trace all paths)
- Requires language-specific implementation

**Tools:** CodeQL, Fortify, Checkmarx

### Taint Tracking

A specialized form of data flow analysis that specifically tracks "tainted" (untrusted) data.

```javascript
// Taint tracking example

// Configuration defines:
// - Sources: req.body, req.query, req.params
// - Sinks: eval(), exec(), innerHTML
// - Sanitizers: DOMPurify.sanitize(), escapeHtml()

function handleRequest(req, res) {
    const userInput = req.body.content;    // TAINTED
    
    // Option A: No sanitization - VULNERABLE
    document.innerHTML = userInput;         // FLAGGED: XSS
    
    // Option B: With sanitization - SAFE
    const clean = DOMPurify.sanitize(userInput);  // Taint removed
    document.innerHTML = clean;             // OK: Input was sanitized
}
```

**Pros:**
- Precise tracking of untrusted data
- Understands sanitization functions
- Can trace across file boundaries

**Cons:**
- Must configure sources, sinks, and sanitizers
- Cannot track through reflection or dynamic code
- Complex interprocedural analysis is slow

**Tools:** CodeQL, SonarQube (advanced rules)

### Control Flow Analysis

Examines the possible execution paths through your code.

```python
def process_payment(user, amount):
    # Control flow analysis builds this graph:
    #
    #     ┌──────────────────┐
    #     │   Start          │
    #     └────────┬─────────┘
    #              │
    #     ┌────────▼─────────┐
    #     │ user.is_admin?   │
    #     └───────┬──┬───────┘
    #         yes │  │ no
    #     ┌───────▼┐ │
    #     │ bypass │ │
    #     │ check  │ │
    #     └───┬────┘ │
    #         │  ┌───▼────────┐
    #         │  │ verify()   │
    #         │  └───┬────────┘
    #         │      │
    #     ┌───▼──────▼────────┐
    #     │ execute_payment() │
    #     └───────────────────┘
    
    if user.is_admin:
        pass  # Admin bypass - potential issue!
    else:
        if not verify_payment(amount):
            raise PaymentError("Verification failed")
    
    execute_payment(user, amount)  # Reached on both paths
```

Control flow analysis can detect:
- Dead code (unreachable paths)
- Missing authorization checks on certain paths
- Exception handling gaps

## Understanding SAST Limitations

SAST tools are powerful but not perfect. Understanding their limitations helps you use them effectively.

### False Positives

A false positive is when the tool reports a vulnerability that is not actually exploitable.

```python
# Common false positive: Framework-provided sanitization

from django.db import connection

def search_users(request):
    name = request.GET.get('name')
    
    # Django's parameterized queries are safe, but some tools still flag this
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT * FROM users WHERE name = %s",  # Safe: parameterized
            [name]
        )
```

**Managing false positives:**

1. **Tune your rules** — Adjust sensitivity settings
2. **Add suppression comments** — Mark known false positives
3. **Configure sanitizers** — Tell the tool about your framework
4. **Review regularly** — Some "false positives" are actually true issues

### False Negatives

A false negative is when the tool misses a real vulnerability.

```python
# SAST tools struggle with dynamic code

def execute_dynamic(request):
    func_name = request.GET.get('action')
    
    # Dynamic function lookup - hard to analyze statically
    func = getattr(my_module, func_name)
    func()  # Potential command injection, but SAST may miss it

# Also hard to detect:
# - Vulnerabilities in third-party libraries (SAST only sees your code)
# - Business logic flaws (tool doesn't understand your requirements)
# - Configuration issues (SAST analyzes code, not config files)
```

### Analysis Boundaries

SAST tools have limits on what they can analyze:

| Can Analyze | Cannot Analyze |
|-------------|----------------|
| Source code you provide | Binary dependencies |
| Known frameworks | Custom frameworks |
| Direct function calls | Reflection/dynamic dispatch |
| Compile-time values | Runtime configurations |
| Code paths | Business logic correctness |

## Choosing the Right Analysis Depth

Different tools offer different tradeoffs:

| Tool Type | Speed | Accuracy | Setup Effort |
|-----------|-------|----------|-------------|
| Pattern matching (Semgrep) | Fast | Medium | Low |
| Data flow (SonarQube) | Medium | High | Medium |
| Semantic analysis (CodeQL) | Slow | Highest | High |

**For most teams, a layered approach works best:**

1. **IDE/Pre-commit** — Fast pattern matching (Semgrep)
2. **CI Pipeline** — Comprehensive analysis (SonarQube)
3. **Weekly/Deep Scans** — Semantic analysis (CodeQL) for critical repos

## SAST vs. Other Security Testing

SAST is one tool in your security arsenal:

| Type | When | What It Finds | Limitations |
|------|------|---------------|-------------|
| **SAST** | Compile-time | Code vulnerabilities | Misses runtime/config issues |
| **DAST** | Runtime | Deployment vulnerabilities | Needs running app, slow |
| **SCA** | Build-time | Vulnerable dependencies | Only known CVEs |
| **IAST** | Runtime | Runtime code paths | Requires instrumentation |
| **Secrets Scanning** | Commit-time | Leaked credentials | Only known patterns |

**DAST (Dynamic Application Security Testing)** tests the running application from the outside—like an attacker would. It catches issues SAST misses (misconfigured servers, deployment issues) but requires a deployed environment.

**SCA (Software Composition Analysis)** scans your dependencies for known vulnerabilities. SAST only analyzes your code, not the libraries you use.

## Integrating SAST Into Your Workflow

For maximum effectiveness, integrate SAST at multiple points:

### 1. Developer IDE

Catch issues as code is written:

```
Developer writes code → IDE plugin highlights issue → Immediate fix
```

**Benefits:** Fastest feedback, easiest to fix
**Challenge:** Must keep IDE plugins updated

### 2. Pre-commit Hooks

Prevent vulnerable code from being committed:

```bash
#!/bin/bash
# .git/hooks/pre-commit

semgrep --config=p/security-audit --error .
if [ \$? -ne 0 ]; then
    echo "Security issues detected. Please fix before committing."
    exit 1
fi
```

**Benefits:** Prevents issues from entering codebase
**Challenge:** Can slow down commits

### 3. CI/CD Pipeline

Run comprehensive scans on every pull request:

```yaml
# GitHub Actions example
security-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run SAST
      run: |
        sonar-scanner \\
          -Dsonar.projectKey=my-project \\
          -Dsonar.sources=. \\
          -Dsonar.host.url=\${{ secrets.SONAR_URL }}
```

**Benefits:** Catches issues before merge, detailed reports
**Challenge:** Adds time to CI pipeline

### 4. Scheduled Scans

Run deep analysis periodically:

```yaml
# Weekly CodeQL scan
on:
  schedule:
    - cron: '0 3 * * 0'  # Every Sunday at 3 AM
```

**Benefits:** Catches issues introduced by dependency updates
**Challenge:** Delayed feedback

## Key Takeaways

Before proceeding to specific tools, remember:

1. **No single tool catches everything** — Use SAST alongside DAST, SCA, and manual review
2. **Tune for your stack** — Configure tools to understand your frameworks and sanitizers
3. **Start with high-confidence rules** — Reduce false positives to build developer trust
4. **Shift left gradually** — Add IDE plugins and pre-commit hooks once CI integration is stable
5. **Treat findings as tech debt** — Track, prioritize, and fix systematically

Now let's get hands-on with SonarQube, Semgrep, and CodeQL.
