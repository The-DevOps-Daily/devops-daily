---
title: 'A09: Security Logging and Monitoring Failures'
description: 'Learn about the importance of security logging and monitoring, common failures that allow attacks to go undetected, and how to implement effective security observability.'
---

Security Logging and Monitoring Failures occur when breaches cannot be detected, escalated, or alerted on due to insufficient logging, detection, monitoring, or response. Without proper logging, attackers can persist in your systems undetected for months.

## Why Logging Matters

Studies show that the average time to detect a breach is over 200 days. During this time, attackers can:

- Exfiltrate sensitive data
- Establish persistent access
- Move laterally through your network
- Cover their tracks

Proper logging and monitoring can reduce detection time from months to minutes.

## Common Logging Failures

### 1. Insufficient Logging

**The Problem:**

Not logging security-relevant events.

```javascript
// VULNERABLE: No logging of authentication events
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user.id;
    return res.json({ success: true });
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
  // Failed login attempt not logged!
});
```

**Secure Implementation:**

```javascript
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-service' },
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console()
  ]
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const clientIP = req.ip;
  const userAgent = req.get('User-Agent');
  
  const user = await User.findOne({ email });
  
  if (user && await bcrypt.compare(password, user.password)) {
    securityLogger.info('Successful login', {
      event: 'LOGIN_SUCCESS',
      userId: user.id,
      email: email,
      ip: clientIP,
      userAgent: userAgent
    });
    
    req.session.userId = user.id;
    return res.json({ success: true });
  }
  
  securityLogger.warn('Failed login attempt', {
    event: 'LOGIN_FAILURE',
    email: email,
    ip: clientIP,
    userAgent: userAgent,
    reason: user ? 'invalid_password' : 'user_not_found'
  });
  
  res.status(401).json({ error: 'Invalid credentials' });
});
```

### 2. Sensitive Data in Logs

**The Problem:**

Logging sensitive information that could be exposed.

```javascript
// VULNERABLE: Logging sensitive data
logger.info('User registered', {
  email: user.email,
  password: user.password,  // NEVER log passwords!
  creditCard: user.creditCard  // NEVER log payment info!
});

// VULNERABLE: Logging full request bodies
app.use((req, res, next) => {
  logger.info('Request', { body: req.body });  // Could contain passwords!
  next();
});
```

**Secure Implementation:**

```javascript
// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'creditCard', 
  'ssn', 'apiKey', 'authorization'
];

function redactSensitive(obj, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== 'object') return obj;
  
  const redacted = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    )) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

// Request logging middleware with redaction
app.use((req, res, next) => {
  logger.info('Request', {
    method: req.method,
    path: req.path,
    query: redactSensitive(req.query),
    body: redactSensitive(req.body),
    ip: req.ip
  });
  next();
});
```

### 3. No Alerting on Suspicious Activity

**The Problem:**

Logs exist but no one monitors them.

```javascript
// Logs are written but never reviewed
securityLogger.warn('5 failed login attempts from same IP');
// ... nobody sees this until months later during incident investigation
```

**Secure Implementation:**

```javascript
// Alert on suspicious patterns
const alertThresholds = {
  failedLogins: { count: 5, windowMinutes: 15 },
  suspiciousIPs: { count: 10, windowMinutes: 60 }
};

async function checkAndAlert(event, metadata) {
  const redis = require('redis');
  const client = redis.createClient();
  
  if (event === 'LOGIN_FAILURE') {
    const key = `failed_logins:${metadata.ip}`;
    const count = await client.incr(key);
    await client.expire(key, 15 * 60);  // 15 minute window
    
    if (count >= alertThresholds.failedLogins.count) {
      await sendAlert({
        severity: 'high',
        title: 'Multiple failed login attempts',
        message: `${count} failed attempts from ${metadata.ip}`,
        metadata
      });
    }
  }
}

async function sendAlert(alert) {
  // Send to Slack
  await fetch(process.env.SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.message}`
    })
  });
  
  // Also send to PagerDuty for critical alerts
  if (alert.severity === 'critical') {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: process.env.PAGERDUTY_KEY,
        event_action: 'trigger',
        payload: {
          summary: alert.title,
          severity: alert.severity,
          source: 'security-service'
        }
      })
    });
  }
}
```

## What to Log

### Security Events to Always Log

```javascript
const SECURITY_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: 'info',
  LOGIN_FAILURE: 'warn',
  LOGOUT: 'info',
  PASSWORD_CHANGE: 'info',
  PASSWORD_RESET_REQUEST: 'info',
  MFA_ENABLED: 'info',
  MFA_DISABLED: 'warn',
  
  // Authorization
  ACCESS_DENIED: 'warn',
  PRIVILEGE_ESCALATION_ATTEMPT: 'error',
  
  // Data Access
  SENSITIVE_DATA_ACCESS: 'info',
  BULK_DATA_EXPORT: 'warn',
  
  // System
  ADMIN_ACTION: 'info',
  CONFIG_CHANGE: 'warn',
  API_KEY_CREATED: 'info',
  API_KEY_REVOKED: 'info'
};

function logSecurityEvent(event, metadata) {
  const level = SECURITY_EVENTS[event] || 'info';
  
  securityLogger[level](`Security Event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...metadata
  });
  
  // Check if this event should trigger an alert
  checkAndAlert(event, metadata);
}
```

### Log Format Best Practices

```javascript
// Structured logging for easy querying
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "warn",
  "event": "LOGIN_FAILURE",
  "service": "auth-service",
  "traceId": "abc123",
  "context": {
    "userId": null,
    "email": "attacker@example.com",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "geoLocation": "Unknown",
    "reason": "invalid_password"
  }
}
```

## Centralized Logging

Send logs to a centralized system for analysis:

```javascript
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const esTransport = new ElasticsearchTransport({
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL,
    auth: {
      username: process.env.ES_USER,
      password: process.env.ES_PASSWORD
    }
  },
  indexPrefix: 'security-logs'
});

const logger = winston.createLogger({
  transports: [
    esTransport,
    new winston.transports.Console()
  ]
});
```

## Key Takeaways

1. **Log security-relevant events** - authentication, authorization, data access
2. **Never log sensitive data** - passwords, tokens, PII
3. **Use structured logging** - JSON format for easy parsing
4. **Centralize logs** - aggregate from all services
5. **Set up alerts** - don't just collect logs, monitor them
6. **Include context** - IP, user agent, trace IDs for correlation
7. **Protect your logs** - logs are a target too
8. **Test your monitoring** - verify alerts work before you need them

Effective logging and monitoring is your last line of defense. When prevention fails, detection gives you the chance to respond before damage escalates.
