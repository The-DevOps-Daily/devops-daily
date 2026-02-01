---
title: 'Authentication & Session Security'
description: 'Learn secure authentication practices: password handling, session management, token security, and common vulnerabilities.'
---

Authentication verifies identity. Session management maintains that identity across requests. Both are critical security functions, and mistakes in either can compromise your entire application. This section covers secure implementation patterns for passwords, sessions, and tokens.

## Secure Password Handling

### Never Store Plain Text Passwords

This should be obvious, but breaches still happen:

```python
# NEVER DO THIS
user.password = request.form['password']  # Plain text storage

# Also never do this
user.password = hashlib.md5(password.encode()).hexdigest()  # Weak hash, no salt
user.password = hashlib.sha256(password.encode()).hexdigest()  # No salt
```

### Use Modern Password Hashing

Use algorithms specifically designed for password hashing:

```python
# RECOMMENDED: Use bcrypt, Argon2, or scrypt
import bcrypt

def hash_password(password: str) -> str:
    """Hash a password for storage."""
    # bcrypt automatically generates a salt and includes it in the hash
    salt = bcrypt.gensalt(rounds=12)  # Work factor of 12
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())

# Or use Argon2 (winner of Password Hashing Competition)
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=3,      # Number of iterations
    memory_cost=65536, # 64 MB memory usage
    parallelism=4      # Number of parallel threads
)

def hash_password_argon2(password: str) -> str:
    return ph.hash(password)

def verify_password_argon2(password: str, hash: str) -> bool:
    try:
        ph.verify(hash, password)
        return True
    except:
        return False
```

**Why these algorithms?**
- **Slow by design** - Makes brute-force attacks expensive
- **Memory-hard** (Argon2) - Resists GPU/ASIC attacks
- **Automatic salting** - Prevents rainbow table attacks
- **Adjustable work factor** - Can increase as hardware gets faster

### Password Policy Enforcement

```python
import re
from zxcvbn import zxcvbn  # Password strength estimator

class PasswordPolicy:
    MIN_LENGTH = 12
    MAX_LENGTH = 128
    MIN_STRENGTH_SCORE = 3  # zxcvbn score 0-4
    
    @classmethod
    def validate(cls, password: str, user_inputs: list = None) -> tuple[bool, list[str]]:
        """Validate password against policy. Returns (valid, errors)."""
        errors = []
        
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters")
        
        if len(password) > cls.MAX_LENGTH:
            errors.append(f"Password must be at most {cls.MAX_LENGTH} characters")
        
        # Check against common passwords and user-specific data
        result = zxcvbn(password, user_inputs=user_inputs or [])
        if result['score'] < cls.MIN_STRENGTH_SCORE:
            errors.append(f"Password is too weak: {result['feedback']['warning']}")
            if result['feedback']['suggestions']:
                errors.extend(result['feedback']['suggestions'])
        
        return len(errors) == 0, errors

# Usage
valid, errors = PasswordPolicy.validate(
    password,
    user_inputs=[user.email, user.username, user.name]  # Penalize passwords similar to user data
)
```

### Password Reset Security

```python
import secrets
from datetime import datetime, timedelta

def create_password_reset_token(user):
    """Generate a secure password reset token."""
    # Use cryptographically secure random token
    token = secrets.token_urlsafe(32)
    
    # Store hash of token, not the token itself
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    user.reset_token_hash = token_hash
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
    
    return token  # Send this to user via email

def verify_reset_token(user, token):
    """Verify a password reset token."""
    if not user.reset_token_hash or not user.reset_token_expires:
        return False
    
    if datetime.utcnow() > user.reset_token_expires:
        return False
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if not secrets.compare_digest(token_hash, user.reset_token_hash):
        return False
    
    return True

def complete_password_reset(user, token, new_password):
    """Complete password reset and invalidate token."""
    if not verify_reset_token(user, token):
        raise ValidationError("Invalid or expired reset token")
    
    user.password_hash = hash_password(new_password)
    user.reset_token_hash = None
    user.reset_token_expires = None
    
    # Invalidate all existing sessions
    invalidate_all_sessions(user)
    
    db.session.commit()
```

## Session Security

### Secure Session Configuration

```python
# Flask example
app.config.update(
    SECRET_KEY=os.environ['SECRET_KEY'],  # At least 32 bytes of randomness
    SESSION_COOKIE_SECURE=True,     # Only send over HTTPS
    SESSION_COOKIE_HTTPONLY=True,   # Not accessible via JavaScript
    SESSION_COOKIE_SAMESITE='Lax',  # CSRF protection
    PERMANENT_SESSION_LIFETIME=timedelta(hours=24),
)

# Express.js example
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,        // HTTPS only
        httpOnly: true,      // No JavaScript access
        sameSite: 'lax',     // CSRF protection
        maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
}));
```

### Session ID Security

```python
import secrets

def generate_session_id():
    """Generate a cryptographically secure session ID."""
    # At least 128 bits of randomness
    return secrets.token_hex(32)  # 256 bits = 64 hex characters

def regenerate_session(old_session):
    """Regenerate session ID after privilege change."""
    # Copy important data
    user_id = old_session.get('user_id')
    
    # Clear old session
    old_session.clear()
    
    # Create new session with new ID
    new_session_id = generate_session_id()
    old_session['user_id'] = user_id
    old_session.modified = True
    
    return new_session_id
```

**Regenerate session ID after:**
- Login (prevent session fixation)
- Privilege escalation (e.g., entering admin area)
- Password change

### Session Fixation Prevention

```python
@app.route('/login', methods=['POST'])
def login():
    user = authenticate(request.form['username'], request.form['password'])
    if user:
        # IMPORTANT: Regenerate session to prevent fixation
        session.clear()
        session['user_id'] = user.id
        session['created_at'] = datetime.utcnow().isoformat()
        session['ip_address'] = request.remote_addr
        session.regenerate()  # Framework-specific method
        
        return redirect('/dashboard')
    return render_template('login.html', error='Invalid credentials')
```

## Token-Based Authentication (JWT)

### Secure JWT Implementation

```python
import jwt
from datetime import datetime, timedelta

JWT_SECRET = os.environ['JWT_SECRET']  # At least 256 bits
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(user_id: int) -> str:
    """Create a short-lived access token."""
    payload = {
        'sub': str(user_id),
        'type': 'access',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        'jti': secrets.token_hex(16)  # Unique token ID
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    """Create a longer-lived refresh token."""
    token_id = secrets.token_hex(16)
    payload = {
        'sub': str(user_id),
        'type': 'refresh',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        'jti': token_id
    }
    
    # Store token ID in database for revocation
    RefreshToken.create(user_id=user_id, token_id=token_id)
    
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str, expected_type: str) -> dict:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        if payload.get('type') != expected_type:
            raise jwt.InvalidTokenError("Invalid token type")
        
        # For refresh tokens, check if revoked
        if expected_type == 'refresh':
            if not RefreshToken.exists(payload['jti']):
                raise jwt.InvalidTokenError("Token revoked")
        
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired")
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(f"Invalid token: {e}")
```

### JWT Security Considerations

```python
# NEVER do these:

# 1. Don't use 'none' algorithm
jwt.decode(token, options={"verify_signature": False})  # DANGEROUS

# 2. Don't accept algorithm from token header
header = jwt.get_unverified_header(token)
jwt.decode(token, secret, algorithms=[header['alg']])  # Algorithm confusion attack

# 3. Don't store sensitive data in JWT (it's base64, not encrypted)
payload = {'user_id': 1, 'password': 'secret'}  # NEVER

# 4. Don't use weak secrets
JWT_SECRET = 'secret'  # Too short and predictable

# ALWAYS:
# - Use strong secrets (>= 256 bits)
# - Specify allowed algorithms explicitly
# - Keep access tokens short-lived
# - Implement token revocation for refresh tokens
```

## Multi-Factor Authentication (MFA)

### TOTP Implementation

```python
import pyotp
import qrcode
from io import BytesIO
import base64

def setup_totp(user):
    """Generate TOTP secret for user."""
    # Generate a random secret
    secret = pyotp.random_base32()
    
    # Store encrypted secret (encrypt at rest)
    user.totp_secret = encrypt(secret)
    user.mfa_enabled = False  # Not enabled until verified
    db.session.commit()
    
    # Generate provisioning URI for authenticator apps
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(
        name=user.email,
        issuer_name="MyApp"
    )
    
    # Generate QR code
    qr = qrcode.make(uri)
    buffer = BytesIO()
    qr.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        'secret': secret,  # Show once for manual entry
        'qr_code': f"data:image/png;base64,{qr_base64}"
    }

def verify_totp(user, code):
    """Verify a TOTP code."""
    if not user.totp_secret:
        return False
    
    secret = decrypt(user.totp_secret)
    totp = pyotp.TOTP(secret)
    
    # valid_window allows for clock skew (1 = 30 seconds before/after)
    return totp.verify(code, valid_window=1)
```

### Backup Codes

```python
def generate_backup_codes(user, count=10):
    """Generate one-time backup codes for MFA recovery."""
    codes = [secrets.token_hex(4).upper() for _ in range(count)]
    
    # Store hashed codes
    user.backup_codes = [
        hashlib.sha256(code.encode()).hexdigest()
        for code in codes
    ]
    db.session.commit()
    
    # Return plain codes to user (show once)
    return codes

def use_backup_code(user, code):
    """Verify and consume a backup code."""
    code_hash = hashlib.sha256(code.upper().encode()).hexdigest()
    
    if code_hash in user.backup_codes:
        user.backup_codes.remove(code_hash)
        db.session.commit()
        return True
    
    return False
```

## Rate Limiting Authentication

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")  # Strict limit on login
def login():
    # ... authentication logic
    pass

@app.route('/api/password-reset', methods=['POST'])
@limiter.limit("3 per hour")  # Very strict for password reset
def request_password_reset():
    # ... password reset logic
    pass
```

## Key Takeaways

1. **Use modern password hashing** - Argon2 or bcrypt, never MD5/SHA alone
2. **Secure session cookies** - HttpOnly, Secure, SameSite flags
3. **Regenerate sessions** - After login and privilege changes
4. **Keep access tokens short-lived** - 15 minutes or less
5. **Implement token revocation** - Especially for refresh tokens
6. **Add rate limiting** - Prevent brute force attacks
7. **Support MFA** - TOTP with backup codes
8. **Use constant-time comparison** - Prevent timing attacks

## Practice Exercise

Review this authentication code and identify the security issues:

```python
@app.route('/login', methods=['POST'])
def login():
    user = User.query.filter_by(email=request.form['email']).first()
    
    if user and user.password == hashlib.md5(request.form['password'].encode()).hexdigest():
        session['user_id'] = user.id
        session['is_admin'] = user.is_admin
        return redirect('/dashboard')
    
    return 'Invalid credentials', 401

@app.route('/api/token')
def get_token():
    user_id = request.args.get('user_id')
    token = jwt.encode(
        {'user_id': user_id},
        'secret',
        algorithm='HS256'
    )
    return {'token': token}
```

**Issues to find:**
1. MD5 for password hashing (weak, unsalted)
2. Session not regenerated after login (fixation vulnerability)
3. Storing `is_admin` in session (can be tampered if session is client-side)
4. JWT secret is too weak ("secret")
5. JWT has no expiration
6. Token endpoint doesn't require authentication
7. User ID from query parameter without validation
