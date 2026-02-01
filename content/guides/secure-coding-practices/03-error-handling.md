---
title: 'Secure Error Handling'
description: 'Learn secure error handling practices: preventing information disclosure, logging safely, and failing securely.'
---

Error handling is often an afterthought, but insecure error handling can leak sensitive information to attackers, cause denial of service, or leave systems in vulnerable states. The goal is to handle errors gracefully while revealing nothing useful to attackers.

## The Information Disclosure Problem

Verbose error messages can reveal:

- **Stack traces** - Internal file paths, framework versions, code structure
- **Database errors** - Table names, column names, query structure
- **Configuration details** - Environment variables, internal IPs, API endpoints
- **Business logic** - How validation works, what checks are performed

### Example: Too Much Information

```python
# VULNERABLE: Exposes internal details
@app.route('/user/<id>')
def get_user(id):
    try:
        user = db.execute(f"SELECT * FROM users WHERE id = {id}").fetchone()
        return jsonify(user)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        # Output: "OperationalError: no such column: users.passwrod
        #          at /app/src/routes/user.py line 42"
```

This error message tells an attacker:
- The database table is named `users`
- There might be a typo in column name (`passwrod`)
- The application path is `/app/src/routes/user.py`
- SQL is being constructed with string formatting (potential injection)

## The Principle: Fail Securely

**Fail securely** means:
1. When something goes wrong, deny access by default
2. Log detailed errors internally, show generic messages externally
3. Don't leave the system in an inconsistent state
4. Handle all error cases explicitly

## Environment-Based Error Responses

Show detailed errors only in development:

```python
import os
import traceback
from flask import Flask, jsonify

app = Flask(__name__)
IS_PRODUCTION = os.getenv('FLASK_ENV') == 'production'

@app.errorhandler(Exception)
def handle_exception(error):
    # Always log the full error internally
    app.logger.exception(f"Unhandled exception: {error}")
    
    if IS_PRODUCTION:
        # Generic message for production
        return jsonify({
            'error': 'An internal error occurred',
            'request_id': get_request_id()  # For correlation
        }), 500
    else:
        # Detailed error for development
        return jsonify({
            'error': str(error),
            'type': type(error).__name__,
            'traceback': traceback.format_exc()
        }), 500

def get_request_id():
    """Generate or retrieve a request ID for log correlation."""
    from flask import g, request
    if not hasattr(g, 'request_id'):
        g.request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
    return g.request_id
```

## Secure Error Handling Patterns

### Pattern 1: Catch Specific Exceptions

```python
from sqlalchemy.exc import IntegrityError, OperationalError

def create_user(username, email):
    try:
        user = User(username=username, email=email)
        db.session.add(user)
        db.session.commit()
        return user
    except IntegrityError:
        db.session.rollback()
        # Don't reveal which field caused the conflict
        raise ValidationError("Username or email already exists")
    except OperationalError:
        db.session.rollback()
        app.logger.error(f"Database connection error during user creation")
        raise ServiceError("Service temporarily unavailable")
```

### Pattern 2: Consistent Error Response Format

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class APIError(Exception):
    message: str
    status_code: int = 400
    error_code: Optional[str] = None
    
    def to_response(self):
        return jsonify({
            'error': {
                'message': self.message,
                'code': self.error_code
            }
        }), self.status_code

class NotFoundError(APIError):
    def __init__(self, resource: str):
        super().__init__(
            message=f"{resource} not found",
            status_code=404,
            error_code='RESOURCE_NOT_FOUND'
        )

class ValidationError(APIError):
    def __init__(self, message: str):
        super().__init__(
            message=message,
            status_code=400,
            error_code='VALIDATION_ERROR'
        )

@app.errorhandler(APIError)
def handle_api_error(error):
    return error.to_response()
```

### Pattern 3: Authentication Error Handling

Don't reveal whether a username exists:

```python
def login(username, password):
    user = User.query.filter_by(username=username).first()
    
    # VULNERABLE: Reveals username existence
    # if not user:
    #     return error("User not found")
    # if not check_password(password, user.password_hash):
    #     return error("Incorrect password")
    
    # SECURE: Generic message
    if not user or not check_password(password, user.password_hash):
        # Use constant-time comparison and add delay to prevent timing attacks
        time.sleep(0.1 + random.uniform(0, 0.05))
        return error("Invalid username or password")
    
    return success(generate_token(user))
```

## Secure Logging Practices

### What to Log

```python
import logging
import hashlib

logger = logging.getLogger(__name__)

def process_payment(user_id, card_number, amount):
    # Log the operation with safe identifiers
    logger.info(
        "Payment initiated",
        extra={
            'user_id': user_id,
            'amount': amount,
            'card_last_four': card_number[-4:],
            'card_hash': hashlib.sha256(card_number.encode()).hexdigest()[:12]
        }
    )
    
    try:
        result = payment_gateway.charge(card_number, amount)
        logger.info(f"Payment successful for user {user_id}")
        return result
    except PaymentError as e:
        logger.error(
            f"Payment failed for user {user_id}",
            extra={
                'error_code': e.code,
                'user_id': user_id
            }
        )
        raise
```

### What NOT to Log

```python
# NEVER log these:
# - Passwords (even hashed ones in most cases)
# - Full credit card numbers
# - API keys or tokens
# - Personal health information
# - Social security numbers
# - Session tokens

# BAD
logger.info(f"Login attempt: user={username}, password={password}")
logger.debug(f"API request with token: {api_token}")

# GOOD
logger.info(f"Login attempt: user={username}")
logger.debug(f"API request with token: {api_token[:8]}...")
```

### Structured Logging for Security Events

```python
import json
from datetime import datetime

class SecurityLogger:
    def __init__(self, logger):
        self.logger = logger
    
    def log_event(self, event_type, user_id=None, ip_address=None, **details):
        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'user_id': user_id,
            'ip_address': ip_address,
            'details': details
        }
        self.logger.info(json.dumps(event))
    
    def login_success(self, user_id, ip_address):
        self.log_event('LOGIN_SUCCESS', user_id=user_id, ip_address=ip_address)
    
    def login_failure(self, username, ip_address, reason):
        self.log_event(
            'LOGIN_FAILURE',
            ip_address=ip_address,
            username_hash=hashlib.sha256(username.encode()).hexdigest()[:16],
            reason=reason
        )
    
    def permission_denied(self, user_id, resource, action):
        self.log_event(
            'PERMISSION_DENIED',
            user_id=user_id,
            resource=resource,
            action=action
        )

security_log = SecurityLogger(logging.getLogger('security'))
```

## Error Handling in Different Contexts

### API Endpoints

```python
from functools import wraps

def handle_errors(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValidationError as e:
            return jsonify({'error': str(e)}), 400
        except NotFoundError:
            return jsonify({'error': 'Resource not found'}), 404
        except PermissionError:
            return jsonify({'error': 'Access denied'}), 403
        except Exception as e:
            app.logger.exception("Unhandled error")
            return jsonify({'error': 'Internal server error'}), 500
    return decorated

@app.route('/api/users/<int:user_id>')
@handle_errors
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        raise NotFoundError()
    return jsonify(user.to_dict())
```

### Background Jobs

```python
from celery import Celery

celery = Celery('tasks')

@celery.task(bind=True, max_retries=3)
def process_order(self, order_id):
    try:
        order = Order.query.get(order_id)
        if not order:
            logger.error(f"Order {order_id} not found - not retrying")
            return  # Don't retry for missing data
        
        process_payment(order)
        send_confirmation(order)
        
    except PaymentGatewayTimeout:
        # Transient error - retry with exponential backoff
        logger.warning(f"Payment timeout for order {order_id}, retrying")
        raise self.retry(countdown=2 ** self.request.retries)
        
    except InvalidPaymentMethod:
        # Permanent error - don't retry, notify customer
        logger.error(f"Invalid payment for order {order_id}")
        notify_customer_payment_failed(order)
        
    except Exception as e:
        # Unknown error - log and alert
        logger.exception(f"Unexpected error processing order {order_id}")
        alert_ops_team(f"Order processing failed: {order_id}")
        raise
```

### Database Transactions

```python
from contextlib import contextmanager

@contextmanager
def transaction():
    """Context manager for safe database transactions."""
    try:
        yield db.session
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

def transfer_funds(from_account, to_account, amount):
    """Transfer funds atomically between accounts."""
    with transaction():
        # Both operations must succeed or both fail
        from_account.balance -= amount
        to_account.balance += amount
        
        if from_account.balance < 0:
            raise ValidationError("Insufficient funds")
        
        # Log the transfer (inside transaction)
        TransferLog.create(
            from_id=from_account.id,
            to_id=to_account.id,
            amount=amount
        )
```

## Key Takeaways

1. **Show generic errors to users** - Log details internally, show "Something went wrong" externally
2. **Use request IDs** - Correlate user-facing errors with detailed logs
3. **Catch specific exceptions** - Handle known error cases explicitly
4. **Fail closed** - When in doubt, deny access
5. **Don't log sensitive data** - Passwords, tokens, PII should never hit logs
6. **Use structured logging** - JSON format enables searching and alerting
7. **Handle transactions properly** - Rollback on failure, don't leave partial state

## Practice Exercise

Review this code and identify the error handling issues:

```python
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        user = User.query.filter_by(email=data['email']).first()
        
        if not user:
            return {'error': f"No user found with email {data['email']}"}, 404
        
        if user.password != data['password']:
            logger.warning(f"Failed login for {data['email']} with password {data['password']}")
            return {'error': 'Wrong password'}, 401
        
        return {'token': generate_token(user)}
        
    except Exception as e:
        return {'error': f"Database error: {str(e)}"}, 500
```

**Issues to find:**
1. Username enumeration (different messages for non-existent user vs wrong password)
2. Logging the password in plain text
3. Exposing database error details
4. Storing/comparing passwords in plain text
5. No rate limiting on login attempts
