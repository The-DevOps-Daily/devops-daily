---
title: 'Input Validation'
description: 'Learn how to validate user input securely: allowlists vs denylists, validation strategies, and preventing injection attacks.'
---

Input validation is the first line of defense against attacks. The principle is simple: **never trust user input**. Every piece of data that enters your application—from form fields, URL parameters, API requests, file uploads, or environment variables—must be validated before use.

## The Golden Rule: Never Trust User Input

User input includes more than just form fields:

- HTTP headers (including cookies, User-Agent, Referer)
- URL parameters and path segments
- Request body (JSON, XML, form data)
- File uploads (filename, content, MIME type)
- Environment variables (in shared hosting environments)
- Database records (if data came from users originally)

Any of these can be manipulated by an attacker.

## Allowlist vs Denylist Validation

There are two fundamental approaches to validation:

### Denylist (Blocklist) - The Wrong Approach

A denylist attempts to block known-bad input:

```python
# BAD: Denylist approach
def sanitize_input_bad(user_input):
    # Try to block dangerous characters
    dangerous = ["'", '"', ';', '--', '/*', '*/', '<', '>']
    for char in dangerous:
        user_input = user_input.replace(char, '')
    return user_input
```

**Why denylists fail:**
- Attackers find bypasses using encoding (URL encoding, Unicode, HTML entities)
- New attack vectors emerge that aren't in your list
- Maintaining a comprehensive list is impossible

### Allowlist (Whitelist) - The Right Approach

An allowlist only permits known-good input:

```python
import re

# GOOD: Allowlist approach
def validate_username(username):
    # Only allow alphanumeric characters and underscores, 3-20 chars
    pattern = r'^[a-zA-Z0-9_]{3,20}$'
    if re.match(pattern, username):
        return username
    raise ValueError("Invalid username format")

def validate_age(age_input):
    # Only allow integers in a reasonable range
    try:
        age = int(age_input)
        if 0 <= age <= 150:
            return age
    except ValueError:
        pass
    raise ValueError("Invalid age")
```

**Why allowlists work:**
- You define exactly what's acceptable
- Unknown inputs are rejected by default
- Much harder to bypass

## Validation Strategies by Data Type

### String Validation

```python
import re
from typing import Optional

def validate_email(email: str) -> str:
    """Validate email format using a reasonable pattern."""
    # Note: Full RFC 5322 compliance is complex; this covers common cases
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not email or len(email) > 254:  # RFC 5321 limit
        raise ValueError("Invalid email length")
    if not re.match(pattern, email):
        raise ValueError("Invalid email format")
    return email.lower().strip()

def validate_slug(slug: str) -> str:
    """Validate URL slug format."""
    pattern = r'^[a-z0-9]+(?:-[a-z0-9]+)*$'
    if not slug or len(slug) > 100:
        raise ValueError("Invalid slug length")
    if not re.match(pattern, slug):
        raise ValueError("Invalid slug format")
    return slug
```

### Numeric Validation

```python
def validate_integer(value: str, min_val: int = None, max_val: int = None) -> int:
    """Validate and convert string to integer within bounds."""
    try:
        num = int(value)
    except (ValueError, TypeError):
        raise ValueError("Value must be an integer")
    
    if min_val is not None and num < min_val:
        raise ValueError(f"Value must be at least {min_val}")
    if max_val is not None and num > max_val:
        raise ValueError(f"Value must be at most {max_val}")
    
    return num

# Usage
page_number = validate_integer(request.args.get('page', '1'), min_val=1, max_val=10000)
```

### File Upload Validation

File uploads are particularly dangerous:

```python
import os
import magic  # python-magic library

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_MIME_TYPES = {'image/png', 'image/jpeg', 'image/gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def validate_image_upload(file):
    """Validate an uploaded image file."""
    # Check file size
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    
    if size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Maximum size is {MAX_FILE_SIZE} bytes")
    
    # Validate filename
    filename = file.filename
    if not filename:
        raise ValueError("No filename provided")
    
    # Check extension (but don't trust it alone)
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"File extension not allowed. Allowed: {ALLOWED_EXTENSIONS}")
    
    # Verify actual content type using magic bytes
    file_content = file.read(2048)  # Read first 2KB for detection
    file.seek(0)
    
    mime_type = magic.from_buffer(file_content, mime=True)
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"File content type not allowed: {mime_type}")
    
    # Sanitize filename to prevent path traversal
    safe_filename = secure_filename(filename)
    
    return safe_filename

def secure_filename(filename: str) -> str:
    """Remove any path components and dangerous characters."""
    # Remove any directory components
    filename = os.path.basename(filename)
    # Remove null bytes
    filename = filename.replace('\x00', '')
    # Only allow safe characters
    safe_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-')
    filename = ''.join(c for c in filename if c in safe_chars)
    return filename or 'unnamed'
```

**Key file upload security points:**
- Never trust the file extension alone
- Verify content type using magic bytes (file signatures)
- Sanitize filenames to prevent path traversal
- Set strict size limits
- Store files outside the web root

## Validation at Every Layer

Defense in depth means validating at multiple points:

```
Client (JavaScript) → Optional, UX only
      ↓
API Gateway → Rate limiting, basic format checks
      ↓
Application → Business logic validation (REQUIRED)
      ↓
Database → Constraints, type enforcement
```

**Important:** Client-side validation is for user experience only. It can always be bypassed.

### Example: Multi-Layer Validation

```python
# Application layer - the primary validation
from pydantic import BaseModel, validator, Field
from typing import Optional

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: str = Field(..., max_length=254)
    age: Optional[int] = Field(None, ge=13, le=150)
    
    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').isalnum():
            raise ValueError('Username must be alphanumeric with underscores only')
        return v.lower()
    
    @validator('email')
    def email_format(cls, v):
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError('Invalid email format')
        return v.lower()

# Usage
try:
    user_data = CreateUserRequest(**request.json())
except ValidationError as e:
    return {'errors': e.errors()}, 400
```

## SQL Injection Prevention

SQL injection occurs when user input is concatenated directly into SQL queries:

```python
# VULNERABLE: String concatenation
def get_user_bad(username):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return db.execute(query)  # Attacker input: ' OR '1'='1

# SECURE: Parameterized queries
def get_user_good(username):
    query = "SELECT * FROM users WHERE username = %s"
    return db.execute(query, (username,))  # Parameters are escaped

# SECURE: Using an ORM
def get_user_orm(username):
    return User.query.filter_by(username=username).first()
```

**Rules for SQL injection prevention:**
1. Always use parameterized queries or prepared statements
2. Use an ORM when possible
3. Never concatenate user input into SQL strings
4. Apply the principle of least privilege to database accounts

## Command Injection Prevention

Command injection is especially dangerous in DevOps scripts:

```python
import subprocess
import shlex

# VULNERABLE: Shell injection
def ping_host_bad(hostname):
    os.system(f"ping -c 4 {hostname}")  # Attacker: google.com; rm -rf /

# SECURE: Use subprocess with list arguments
def ping_host_good(hostname):
    # Validate hostname format first
    import re
    if not re.match(r'^[a-zA-Z0-9.-]+$', hostname):
        raise ValueError("Invalid hostname")
    
    # Use list form - no shell interpretation
    result = subprocess.run(
        ['ping', '-c', '4', hostname],
        capture_output=True,
        text=True,
        timeout=30
    )
    return result.stdout

# If you must use shell=True, escape properly
def run_with_shell(user_input):
    safe_input = shlex.quote(user_input)
    subprocess.run(f"echo {safe_input}", shell=True)
```

**Rules for command injection prevention:**
1. Avoid `shell=True` in subprocess calls
2. Pass arguments as a list, not a string
3. Validate and sanitize any user input used in commands
4. Use `shlex.quote()` if shell interpolation is unavoidable

## Path Traversal Prevention

Path traversal attacks attempt to access files outside intended directories:

```python
import os

# VULNERABLE: Direct path concatenation
def read_file_bad(filename):
    return open(f"/app/uploads/{filename}").read()  # Attacker: ../../../etc/passwd

# SECURE: Validate and resolve the path
def read_file_good(filename, base_dir='/app/uploads'):
    # Remove any path components from filename
    filename = os.path.basename(filename)
    
    # Construct the full path
    full_path = os.path.join(base_dir, filename)
    
    # Resolve to absolute path and verify it's within base_dir
    full_path = os.path.realpath(full_path)
    base_dir = os.path.realpath(base_dir)
    
    if not full_path.startswith(base_dir + os.sep):
        raise ValueError("Access denied: path traversal detected")
    
    if not os.path.isfile(full_path):
        raise FileNotFoundError("File not found")
    
    return open(full_path).read()
```

## Key Takeaways

1. **Never trust user input** - Validate everything from every source
2. **Use allowlists, not denylists** - Define what's allowed, reject everything else
3. **Validate at the server** - Client-side validation is for UX only
4. **Use parameterized queries** - Never concatenate SQL
5. **Avoid shell commands** - Use libraries instead; if unavoidable, escape properly
6. **Validate file paths** - Resolve and verify before access
7. **Fail closed** - When validation fails, deny by default

## Practice Exercise

Review this code and identify all input validation issues:

```python
@app.route('/search')
def search():
    query = request.args.get('q')
    limit = request.args.get('limit', 10)
    
    sql = f"SELECT * FROM products WHERE name LIKE '%{query}%' LIMIT {limit}"
    results = db.execute(sql)
    
    return render_template('search.html', query=query, results=results)
```

**Issues to find:**
1. SQL injection in the `query` parameter
2. SQL injection in the `limit` parameter (not validated as integer)
3. Reflected XSS - `query` is rendered in template (covered in next section)
4. No input length limits
5. No rate limiting (DoS potential)
