---
title: 'Secure Coding Practices Every DevOps Engineer Should Know'
excerpt: 'A practical guide to writing secure code: input validation, output encoding, error handling, and authentication. With real examples in Python, JavaScript, and Go.'
category:
  name: 'Security'
  slug: 'security'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-01-24T09:00:00Z'
readingTime: '11 min read'
coverImage: '/images/posts/secure-coding-practices-guide.png'
ogImage: '/images/posts/secure-coding-practices-guide.svg'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - Secure Coding
  - Input Validation
  - OWASP
---

The majority of security vulnerabilities come from a handful of coding mistakes: trusting user input, sloppy error handling, and weak authentication. These are not exotic attacks. They are basic errors that keep showing up in breach after breach because developers treat security as something to bolt on later.

If you write infrastructure as code, deployment scripts, automation tools, or internal APIs, you write code that can be attacked. The same secure coding principles that apply to product engineers apply to you. This guide covers the four areas that matter most: input validation, output encoding, error handling, and authentication.

## Input Validation: Never Trust Anything

Every piece of data that enters your application must be validated before use. This includes form fields, URL parameters, API request bodies, file uploads, HTTP headers (including cookies and User-Agent), and environment variables. Any of these can be manipulated by an attacker.

### Allowlists Beat Denylists Every Time

A denylist tries to block known-bad input. It always fails because attackers find bypasses through encoding tricks, Unicode characters, and new vectors you have not thought of:

```python
# BAD: Denylist approach - attackers will bypass this
def sanitize_input_bad(user_input):
    dangerous = ["'", '"', ';', '--', '/*', '*/', '<', '>']
    for char in dangerous:
        user_input = user_input.replace(char, '')
    return user_input
```

An allowlist only permits known-good input. It is much harder to bypass because you define exactly what is acceptable:

```python
import re

# GOOD: Allowlist approach - define what's allowed
def validate_username(username):
    pattern = r'^[a-zA-Z0-9_]{3,20}$'
    if re.match(pattern, username):
        return username
    raise ValueError("Invalid username format")
```

### SQL Injection Prevention

This is the most common and dangerous injection attack. The fix is simple: never concatenate user input into SQL strings.

```python
# VULNERABLE: String concatenation
def get_user_bad(username):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return db.execute(query)  # Attacker input: ' OR '1'='1

# SECURE: Parameterized queries
def get_user_good(username):
    query = "SELECT * FROM users WHERE username = %s"
    return db.execute(query, (username,))
```

Always use parameterized queries or an ORM. There is no good reason to build SQL strings by hand in 2025.

### Command Injection Prevention

This one is especially dangerous in DevOps scripts where you are already running system commands:

```python
import subprocess

# VULNERABLE: Shell injection via string formatting
# An attacker could pass "google.com; rm -rf /" as the hostname
def ping_host_bad(hostname):
    subprocess.run(f"ping -c 4 {hostname}", shell=True)

# SECURE: Use subprocess with list arguments
def ping_host_good(hostname):
    import re
    if not re.match(r'^[a-zA-Z0-9.-]+$', hostname):
        raise ValueError("Invalid hostname")
    result = subprocess.run(
        ['ping', '-c', '4', hostname],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout
```

Pass arguments as a list, not a string. Avoid `shell=True`. If shell interpolation is unavoidable, use `shlex.quote()`.

### File Upload Validation

File uploads are particularly dangerous. Never trust the file extension alone:

```python
import magic

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_MIME_TYPES = {'image/png', 'image/jpeg', 'image/gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def validate_image_upload(file):
    # Check file size
    file.seek(0, os.SEEK_END)
    if file.tell() > MAX_FILE_SIZE:
        raise ValueError("File too large")
    file.seek(0)

    # Check extension
    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Extension not allowed")

    # Verify actual content type using magic bytes
    mime_type = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Content type not allowed: {mime_type}")

    # Sanitize filename to prevent path traversal
    return os.path.basename(file.filename)
```

Verify content type using magic bytes. Sanitize filenames. Set strict size limits. Store files outside the web root.

### Validate at Every Layer

Client-side validation is for user experience only. It can always be bypassed. Server-side validation is required. Database constraints are your last line of defense. Use all three.

```python
from pydantic import BaseModel, validator, Field

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: str = Field(..., max_length=254)
    age: Optional[int] = Field(None, ge=13, le=150)

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').isalnum():
            raise ValueError('Username must be alphanumeric')
        return v.lower()
```

## Output Encoding: Context Matters

Input validation controls what comes in. Output encoding ensures data is safely rendered when it goes out. The most common vulnerability prevented by proper output encoding is Cross-Site Scripting (XSS).

The same user input requires different encoding depending on where it appears:

```html
<p>Hello, USER_INPUT</p>              <!-- HTML context -->
<a href="/search?q=USER_INPUT">Link</a> <!-- URL context -->
<script>var name = 'USER_INPUT';</script> <!-- JavaScript context -->
```

Each context has different dangerous characters and requires different encoding.

### HTML Context

```python
import html

# SECURE: HTML escaping
def safe_html_output(user_input):
    return f"<p>Hello, {html.escape(user_input)}</p>"
```

### JavaScript Context

Never use string interpolation. Use JSON encoding:

```python
import json

@app.route('/page')
def page():
    user_data = {'name': request.args.get('name', '')}
    return f'''
    <script>
        const userData = {json.dumps(user_data)};
    </script>
    '''
```

### URL Context

```python
from urllib.parse import quote, urlencode

def build_search_url(query, page):
    params = urlencode({'q': query, 'page': page})
    return f"/search?{params}"
```

### Use Framework Auto-Escaping

Modern frameworks handle encoding by default. React escapes JSX output. Jinja2 auto-escapes templates. Go's `html/template` package is context-aware. Do not disable these protections unless you have a very good reason.

The exception is rich text content where users need some HTML. Use a sanitization library like bleach (Python) or DOMPurify (JavaScript) with a strict allowlist of tags:

```python
import bleach

ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a']

def sanitize_rich_text(html_content):
    return bleach.clean(html_content, tags=ALLOWED_TAGS, strip=True)
```

### Add Content Security Policy Headers

CSP is a defense-in-depth mechanism that mitigates XSS even if your encoding fails:

```python
@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "frame-ancestors 'none';"
    )
    return response
```

## Error Handling: Reveal Nothing Useful

Verbose error messages are a gift to attackers. A stack trace can reveal internal file paths, framework versions, database table names, and query structure. A different error message for "user not found" versus "wrong password" tells an attacker which usernames exist.

### The Principle: Fail Securely

Log detailed errors internally. Show generic messages externally. Never leave the system in an inconsistent state.

```python
import os

IS_PRODUCTION = os.getenv('FLASK_ENV') == 'production'

@app.errorhandler(Exception)
def handle_exception(error):
    app.logger.exception(f"Unhandled exception: {error}")

    if IS_PRODUCTION:
        return jsonify({
            'error': 'An internal error occurred',
            'request_id': get_request_id()
        }), 500
    else:
        return jsonify({
            'error': str(error),
            'traceback': traceback.format_exc()
        }), 500
```

### Authentication Errors Should Be Generic

Do not reveal whether a username exists:

```python
def login(username, password):
    user = User.query.filter_by(username=username).first()

    # WRONG: Different messages leak information
    # if not user: return error("User not found")
    # if not check_password(...): return error("Incorrect password")

    # RIGHT: Generic message for all failures
    if not user or not check_password(password, user.password_hash):
        time.sleep(0.1 + random.uniform(0, 0.05))  # Prevent timing attacks
        return error("Invalid username or password")

    return success(generate_token(user))
```

### What to Log and What Not to Log

Log security events with structured data for searching and alerting. Never log passwords, full credit card numbers, API keys, tokens, or PII.

```python
# BAD
logger.info(f"Login attempt: user={username}, password={password}")

# GOOD
logger.info(f"Login attempt: user={username}")
logger.debug(f"API request with token: {api_token[:8]}...")
```

### Handle Transactions Properly

When database operations fail, roll back. Do not leave partial state:

```python
@contextmanager
def transaction():
    try:
        yield db.session
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
```

## Authentication and Session Security

Authentication is where most high-impact breaches start. Get this wrong and nothing else matters.

### Password Hashing

Use bcrypt or Argon2. Never MD5 or SHA256 alone. Never store plain text.

```python
import bcrypt

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())
```

These algorithms are slow by design, making brute-force attacks expensive. They handle salting automatically, which prevents rainbow table attacks. And you can increase the work factor as hardware gets faster.

### Secure Session Configuration

```python
# Flask
app.config.update(
    SECRET_KEY=os.environ['SECRET_KEY'],
    SESSION_COOKIE_SECURE=True,      # HTTPS only
    SESSION_COOKIE_HTTPONLY=True,     # No JavaScript access
    SESSION_COOKIE_SAMESITE='Lax',   # CSRF protection
    PERMANENT_SESSION_LIFETIME=timedelta(hours=24),
)
```

```javascript
// Express.js
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));
```

Regenerate the session ID after login, privilege escalation, and password changes. This prevents session fixation attacks.

### JWT Security

JWTs are popular but easy to misconfigure:

```python
import jwt

JWT_SECRET = os.environ['JWT_SECRET']  # At least 256 bits
ACCESS_TOKEN_EXPIRE_MINUTES = 15

def create_access_token(user_id: int) -> str:
    payload = {
        'sub': str(user_id),
        'type': 'access',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        'jti': secrets.token_hex(16)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid token")
```

The common JWT mistakes: using the `none` algorithm, accepting the algorithm from the token header (algorithm confusion attack), storing sensitive data in the payload (it is base64, not encrypted), using weak secrets, and forgetting to set expiration. Avoid all of them.

### Rate Limiting

Every authentication endpoint needs rate limiting. Without it, brute force attacks are trivial:

```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=get_remote_address)

@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    # authentication logic
    pass

@app.route('/api/password-reset', methods=['POST'])
@limiter.limit("3 per hour")
def request_password_reset():
    # reset logic
    pass
```

### Password Reset Security

Generate cryptographically secure tokens. Store the hash, not the token itself. Set short expiration times. Invalidate all existing sessions after a password change:

```python
def create_password_reset_token(user):
    token = secrets.token_urlsafe(32)
    user.reset_token_hash = hashlib.sha256(token.encode()).hexdigest()
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
    return token  # Send this via email
```

## The Checklist

These are the non-negotiable practices:

1. **Validate all input** with allowlists, not denylists
2. **Use parameterized queries** for all database access
3. **Avoid shell commands** in application code; when unavoidable, use subprocess with list arguments
4. **Encode output** based on the rendering context (HTML, URL, JavaScript)
5. **Use framework auto-escaping** and do not disable it
6. **Show generic error messages** to users; log details internally
7. **Hash passwords** with bcrypt or Argon2
8. **Set Secure, HttpOnly, and SameSite** flags on all session cookies
9. **Keep access tokens short-lived** (15 minutes or less)
10. **Rate limit** every authentication endpoint
11. **Add CSP headers** as a defense-in-depth measure
12. **Regenerate session IDs** after login and privilege changes

None of these are difficult. None of them require expensive tools. They just require discipline and the decision to treat security as a first-class concern in your code, not something to add before the audit.
