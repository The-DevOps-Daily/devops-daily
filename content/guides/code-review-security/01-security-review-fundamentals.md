---
title: 'Security Review Fundamentals'
description: 'Learn the foundational skills for security-focused code review, including threat modeling, attack surface analysis, and systematic review approaches.'
---

Security code review is a skill that improves with practice. This section covers the foundational concepts and techniques that make security reviews effective.

## The Attacker's Perspective

Before reviewing code, consider who might attack it and why:

- **External attackers** - Looking for data theft, service disruption, or system access
- **Malicious insiders** - Employees or contractors with legitimate access
- **Automated bots** - Scanning for known vulnerabilities at scale
- **Competitors** - Industrial espionage or competitive advantage

Each attacker type has different capabilities and motivations. A determined attacker with insider knowledge is more dangerous than an opportunistic bot.

## Attack Surface Analysis

The attack surface is everywhere untrusted data enters your system:

```
Attack Surface Entry Points
---------------------------

[HTTP Requests]     -> Query params, headers, body, cookies
[File Uploads]      -> Filenames, content, metadata
[Database]          -> Data from other systems, user-generated content
[Environment]       -> Env vars, config files, secrets
[External APIs]     -> Responses from third-party services
[Message Queues]    -> Events from other services
[User Input]        -> Forms, CLI args, interactive prompts
```

During review, trace how data flows from these entry points through the code. Any place where untrusted data influences behavior is a potential vulnerability.

## What Automated Tools Miss

SAST tools excel at pattern matching but struggle with:

### Business Logic Flaws

```python
# Tool sees nothing wrong, but this is a vulnerability
def transfer_money(from_account, to_account, amount):
    # Missing: Check that user owns from_account
    # Missing: Check for negative amounts
    # Missing: Check for sufficient balance
    from_account.balance -= amount
    to_account.balance += amount
```

### Authorization Bypass

```python
# Tool can't understand authorization requirements
@app.route('/admin/users/<user_id>')
def get_user(user_id):
    # Missing: Verify current user has admin role
    # Missing: Verify user_id belongs to same organization
    return User.query.get(user_id).to_dict()
```

### Timing Attacks

```python
# Tool doesn't understand timing vulnerabilities
def verify_token(provided_token, stored_token):
    # Vulnerable: String comparison leaks timing information
    return provided_token == stored_token

# Secure version uses constant-time comparison
import hmac
def verify_token_secure(provided_token, stored_token):
    return hmac.compare_digest(provided_token, stored_token)
```

### Race Conditions

```python
# Tool doesn't detect TOCTOU (time-of-check-time-of-use)
def withdraw(account_id, amount):
    account = get_account(account_id)
    if account.balance >= amount:  # Check
        # Race condition: balance could change here
        account.balance -= amount  # Use
        save_account(account)
```

## Systematic Review Approach

Don't rely on intuition alone. Use a systematic approach:

### 1. Understand the Context

Before diving into code, understand:

- What does this feature do?
- What data does it handle (PII, financial, credentials)?
- Who can access it (public, authenticated, admin)?
- What are the trust boundaries?

### 2. Identify Entry Points

Find all places where external data enters:

```python
# HTTP entry points
request.args.get('id')        # Query parameter
request.form.get('name')      # Form data
request.json                  # JSON body
request.headers.get('X-API-Key')  # Header
request.cookies.get('session')    # Cookie

# File entry points
uploaded_file.filename        # User-controlled filename
uploaded_file.read()          # File content

# Database entry points (data from other sources)
user.bio                      # Previously stored user input
```

### 3. Trace Data Flow

Follow untrusted data through the code:

```python
# Entry point
user_id = request.args.get('user_id')  # Untrusted

# Data flow
query = f"SELECT * FROM users WHERE id = {user_id}"  # Dangerous!
result = db.execute(query)

# Exit point
return jsonify(result)  # Could leak data
```

### 4. Check Security Controls

Verify that appropriate controls exist:

- **Input validation** - Is input validated before use?
- **Output encoding** - Is output encoded for its context?
- **Authentication** - Is the user's identity verified?
- **Authorization** - Is the user allowed to perform this action?
- **Logging** - Are security-relevant events logged?

### 5. Consider Edge Cases

Think about unusual inputs and scenarios:

- Empty strings, null values, very long strings
- Negative numbers, zero, maximum integer values
- Special characters, Unicode, encoded data
- Concurrent requests, race conditions
- Error conditions, partial failures

## Trust Boundaries

A trust boundary is where data moves between different trust levels:

```
Trust Boundary Example
----------------------

[Internet]          <-- Untrusted
     |
     v
[Load Balancer]     <-- Semi-trusted (validates some things)
     |
     v
[Application]       <-- Trusted code, untrusted data
     |
     v
[Database]          <-- Trusted storage, mixed data
     |
     v
[Internal API]      <-- Trusted, but verify anyway
```

Every time data crosses a trust boundary, it should be validated. Don't assume that because data came from your database, it's safe - it might contain user input that was stored earlier.

## Common Review Questions

Ask these questions during every security review:

### Input Handling
- Is all input validated before use?
- Are validation rules appropriate for the data type?
- Is there a allowlist approach (preferred) or denylist?
- Are error messages informative without leaking details?

### Authentication
- Is authentication required for sensitive operations?
- Are credentials handled securely (not logged, properly hashed)?
- Is session management implemented correctly?
- Are password requirements strong enough?

### Authorization
- Is authorization checked for every sensitive operation?
- Are authorization checks performed on the server side?
- Is there protection against horizontal privilege escalation?
- Is there protection against vertical privilege escalation?

### Data Protection
- Is sensitive data encrypted at rest and in transit?
- Are cryptographic algorithms current (no MD5, SHA1 for security)?
- Are keys managed securely (not hardcoded)?
- Is PII handled according to privacy requirements?

### Error Handling
- Do error messages avoid leaking sensitive information?
- Are exceptions handled appropriately?
- Do failures default to a secure state?
- Are errors logged for security monitoring?

## Review Prioritization

Not all code carries equal risk. Prioritize review of:

1. **Authentication and session management** - Account takeover impact
2. **Authorization and access control** - Data breach impact
3. **Input handling and validation** - Injection attack surface
4. **Cryptography and secrets** - Data protection
5. **File operations** - Path traversal, upload vulnerabilities
6. **External integrations** - SSRF, injection via APIs

## Time-Boxing Reviews

Security review can be endless. Set reasonable time limits:

| Change Size | Suggested Time |
|-------------|----------------|
| Small (< 100 lines) | 15-30 minutes |
| Medium (100-500 lines) | 30-60 minutes |
| Large (500+ lines) | 1-2 hours, split into sessions |

If you find significant issues early, stop and request changes before continuing. There's no point reviewing code that will be rewritten.

