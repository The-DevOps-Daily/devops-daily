---
title: 'Review Process and Feedback'
description: 'Learn effective security review processes, checklists, and how to communicate security issues constructively during code review.'
---

Effective security review is not just about finding issues - it's about communicating them in a way that helps developers learn and fix problems quickly.

## Security Review Checklist

Use this checklist as a starting point for security reviews:

### Input Validation

```
[ ] All user input is validated before use
[ ] Validation uses allowlists where possible
[ ] Input length limits are enforced
[ ] Special characters are handled appropriately
[ ] Numeric inputs have range checks
[ ] File uploads validate type and size
```

### Authentication

```
[ ] Passwords are hashed with bcrypt/argon2/scrypt
[ ] Password requirements are enforced (length, complexity)
[ ] Rate limiting on login attempts
[ ] Session tokens are cryptographically random
[ ] Sessions are invalidated on logout
[ ] Session timeout is implemented
[ ] Password reset tokens expire quickly
[ ] MFA is available for sensitive operations
```

### Authorization

```
[ ] Authorization checked on every request
[ ] Authorization is server-side
[ ] Object-level authorization (user owns resource)
[ ] Function-level authorization (user has permission)
[ ] No direct object references without checks
[ ] Admin functions require admin role
[ ] API keys have appropriate scopes
```

### Data Protection

```
[ ] Sensitive data encrypted at rest
[ ] TLS 1.2+ for data in transit
[ ] No sensitive data in URLs
[ ] No sensitive data in logs
[ ] PII handled per privacy requirements
[ ] Secrets not hardcoded in source
[ ] Secrets not in version control
```

### Error Handling

```
[ ] Errors don't leak sensitive information
[ ] Stack traces not shown in production
[ ] Failed operations logged for monitoring
[ ] Failures default to secure state
[ ] Rate limiting on error-prone endpoints
```

### Security Headers

```
[ ] Content-Security-Policy configured
[ ] X-Content-Type-Options: nosniff
[ ] X-Frame-Options or frame-ancestors CSP
[ ] Strict-Transport-Security (HSTS)
[ ] Referrer-Policy configured
[ ] Permissions-Policy for sensitive APIs
```

## Prioritizing Findings

Not all security issues are equal. Use this framework to prioritize:

### Critical - Fix Before Merge

- SQL/Command injection
- Authentication bypass
- Remote code execution
- Exposed credentials/secrets
- Missing authorization on sensitive endpoints

### High - Fix Soon

- XSS vulnerabilities
- CSRF vulnerabilities
- Weak cryptography
- Session management issues
- Insecure deserialization

### Medium - Track and Plan

- Missing security headers
- Verbose error messages
- Missing rate limiting
- Weak password requirements
- Missing input validation

### Low - Improve Over Time

- Missing audit logging
- Code quality issues
- Documentation gaps
- Non-security best practices

## Writing Effective Feedback

Good security feedback is specific, actionable, and educational.

### Bad Feedback Examples

```
"This is insecure."
-> Too vague, doesn't help the developer

"You need to fix this SQL injection."
-> Missing specifics about what and how

"This is a security vulnerability, please fix."
-> No context, no guidance
```

### Good Feedback Examples

```
"SQL Injection vulnerability on line 42.

The user input `request.args.get('id')` is concatenated directly
into the SQL query without sanitization.

Attack example:
  id = "1; DROP TABLE users; --"

Fix: Use parameterized queries:
  cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))

Reference: https://owasp.org/www-community/attacks/SQL_Injection"
```

```
"Missing authorization check in get_document() (line 87).

Currently any authenticated user can access any document by ID.
This allows horizontal privilege escalation - User A can access
User B's documents by guessing document IDs.

Suggested fix:
  doc = Document.query.filter_by(
      id=doc_id,
      owner_id=current_user.id
  ).first_or_404()

This ensures users can only access their own documents."
```

### Feedback Template

```
## [Severity] Issue Title

**Location:** file.py, line 42

**Problem:** Brief description of the vulnerability

**Impact:** What could an attacker do?

**Proof of Concept:** Example attack input or scenario

**Suggested Fix:** Code example or approach

**References:** Links to learn more
```

## Handling Pushback

Developers may push back on security findings. Handle this constructively:

### "It's just internal / behind a VPN"

Response: "Defense in depth means we protect against internal threats too. VPNs can be compromised, and employees can be malicious. Let's add the protection anyway - it's low effort and high value."

### "We don't have time to fix this"

Response: "I understand the time pressure. Let's prioritize - the SQL injection is critical and must be fixed. The missing headers can wait for the next sprint. Can we create a ticket to track the lower-priority items?"

### "Nobody would actually exploit this"

Response: "Attackers actively scan for these patterns. There are automated tools that find SQL injection, XSS, etc. Even if the risk seems low, the fix is usually simple. Let's not leave a known vulnerability."

### "This is how we've always done it"

Response: "I understand it's existing code. Security standards evolve as new attacks emerge. Let's fix it going forward - we can add a ticket to remediate the existing instances."

## Review Tools and Automation

Combine manual review with automated tools:

### Pre-Review Automation

Run these before manual review to catch obvious issues:

```yaml
# GitHub Actions example
- name: Run SAST
  uses: github/codeql-action/analyze@v2

- name: Check dependencies
  run: npm audit --audit-level=high

- name: Secrets scan
  uses: gitleaks/gitleaks-action@v2
```

### During Review

Use IDE plugins and browser extensions:

- **SonarLint** - Real-time SAST in your IDE
- **Snyk** - Dependency vulnerability scanning
- **GitHub Security** - Code scanning alerts in PRs

### Post-Review

Track security debt:

```
# Security debt tracking example
| Issue | Severity | File | Created | Status |
|-------|----------|------|---------|--------|
| Missing rate limiting | Medium | auth.py | 2024-01-15 | Backlog |
| Verbose errors | Low | api.py | 2024-01-10 | In Progress |
```

## Building a Security Review Culture

### Make Security Everyone's Job

- Include security in definition of done
- Rotate security review responsibility
- Celebrate security fixes, not just features
- Share security knowledge in team meetings

### Provide Training

- Regular security awareness sessions
- OWASP Top 10 walkthrough
- Language-specific security training
- Incident post-mortems (redacted if needed)

### Measure and Improve

Track metrics to improve over time:

- Time to fix security issues
- Security issues found in review vs production
- Coverage of security review (% of PRs reviewed)
- Developer security training completion

## Quick Reference Card

Print this for your desk:

```
SECURITY CODE REVIEW QUICK REFERENCE
====================================

ALWAYS CHECK:
- User input -> validation -> use
- Authentication on sensitive endpoints
- Authorization on every data access
- Parameterized queries for SQL
- Output encoding for HTML/JS
- Secrets not in code

RED FLAGS:
- String concatenation + SQL/commands
- eval(), exec(), pickle, yaml.load()
- innerHTML with user data
- shell=True with user input
- Missing authorization checks
- Hardcoded secrets/passwords

QUESTIONS TO ASK:
- What if this input is malicious?
- Who should be allowed to do this?
- What data could leak on error?
- Is this logged for security monitoring?
```

