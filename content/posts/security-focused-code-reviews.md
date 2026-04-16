---
title: 'Security-Focused Code Reviews: Catching Vulnerabilities Before Production'
excerpt: 'Learn how to review code with a security mindset. This guide covers common vulnerability patterns, language-specific pitfalls, and practical checklists for finding injection flaws, auth bypass, and logic bugs that automated tools miss.'
category:
  name: 'Security'
  slug: 'security'
coverImage: '/images/posts/security-focused-code-reviews.png'
ogImage: '/images/posts/security-focused-code-reviews.svg'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-01-24T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - Code Review
  - Vulnerabilities
---

Automated security tools are great at finding obvious issues. SQL injection with string concatenation, known vulnerable dependencies, hardcoded API keys. But they are terrible at understanding your application's logic. They cannot tell you that your payment endpoint lets users transfer money from accounts they do not own, or that your session management has a race condition that allows account takeover.

That is where security-focused code review comes in. Research suggests that human reviewers catch 50 to 70 percent of security issues that automated tools miss. The combination of both approaches provides the strongest defense.

**TLDR**: Security code review requires a different mindset than functional review. Instead of asking "does this work?", you ask "how could this be abused?" This guide covers the vulnerability patterns to watch for, language-specific pitfalls, and a practical process for reviewing code with security in mind.

## Think Like an Attacker

The single biggest shift in security review is your perspective. A developer asks "how do I make this work?" A security reviewer asks "how could this be abused?"

```
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

# SECURE - list arguments, no shell
subprocess.run(["ping", "-c", "4", hostname], shell=False)
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

If you see `hashlib` anywhere near passwords, flag it immediately:

```python
# VULNERABLE - too fast, no salt
user.password = hashlib.sha256(password.encode()).hexdigest()

# SECURE - slow, salted, purpose-built
from argon2 import PasswordHasher
ph = PasswordHasher()
hashed = ph.hash(password)
```

The only acceptable password hashing algorithms are bcrypt, argon2, and scrypt. MD5, SHA1, and SHA256 are not password hashing algorithms. They are fast hashing algorithms, and fast is exactly what you do not want for passwords.

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
        if (source.hasOwnProperty(key)) {
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

```
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
- Output encoding for HTML/JS
- Secrets not in code

**Red flags:**
- String concatenation near SQL or shell commands
- `eval()`, `exec()`, `pickle`, `yaml.load()`
- `innerHTML` with user data
- `shell=True` with user input
- Missing authorization checks
- Hardcoded secrets or passwords

Security review is a skill that improves with practice. Start by picking one category from this guide and focusing on it during your next review cycle. Once it becomes second nature, add another. Within a few months, you will catch issues that both automated tools and other reviewers miss.
