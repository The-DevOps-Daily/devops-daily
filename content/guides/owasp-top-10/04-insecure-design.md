---
title: 'A04: Insecure Design'
description: 'Learn about insecure design vulnerabilities, the difference between secure design and secure implementation, and how to build security into your applications from the start.'
---

Insecure Design is a new category in the 2021 OWASP Top 10, focusing on risks related to design and architectural flaws. This is different from implementation bugs—insecure design means that even a perfect implementation of a flawed design is still insecure.

## What is Insecure Design?

Insecure design occurs when security requirements and controls are not considered during the design phase. It's the difference between:

- **Insecure Implementation** - A flaw in how you built something (e.g., SQL injection from string concatenation)
- **Insecure Design** - A flaw in what you decided to build (e.g., no rate limiting on password attempts)

You can't fix insecure design with a perfect implementation. If you design a house with no locks on the doors, installing the doors perfectly doesn't make the house secure.

## Common Insecure Design Patterns

### 1. Missing Rate Limiting

**The Problem:**

Without rate limiting, attackers can make unlimited attempts at guessing passwords, brute-forcing tokens, or overwhelming your system.

```javascript
// INSECURE DESIGN: No rate limiting on login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  
  if (user && await bcrypt.compare(password, user.password)) {
    return res.json({ token: generateToken(user) });
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
});
```

An attacker can try millions of password combinations with no restrictions.

**Secure Design:**

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Global rate limiter for all requests
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests, please try again later'
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts per window
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later',
  // Use Redis for distributed rate limiting across multiple servers
  store: new RedisStore({ client: redisClient })
});

// Apply limiters
app.use(globalLimiter);
app.post('/login', authLimiter, loginHandler);
app.post('/forgot-password', authLimiter, forgotPasswordHandler);
```

Also implement account lockout after repeated failures:

```javascript
async function loginHandler(req, res) {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  
  // Check if account is locked
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const remainingTime = Math.ceil((user.lockedUntil - new Date()) / 60000);
    return res.status(423).json({
      error: `Account locked. Try again in ${remainingTime} minutes.`
    });
  }
  
  if (user && await bcrypt.compare(password, user.password)) {
    // Reset failed attempts on successful login
    await User.updateOne(
      { _id: user._id },
      { $set: { failedAttempts: 0, lockedUntil: null } }
    );
    return res.json({ token: generateToken(user) });
  }
  
  // Track failed attempts
  if (user) {
    const failedAttempts = (user.failedAttempts || 0) + 1;
    const update = { failedAttempts };
    
    // Lock account after 5 failed attempts
    if (failedAttempts >= 5) {
      update.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
    
    await User.updateOne({ _id: user._id }, { $set: update });
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
}
```

### 2. Predictable Resource Identifiers

**The Problem:**

Using sequential or predictable identifiers makes it easy for attackers to enumerate resources.

```javascript
// INSECURE DESIGN: Sequential user IDs
// /api/users/1, /api/users/2, /api/users/3...
const user = await User.findById(req.params.id);  // id = 1, 2, 3...

// INSECURE DESIGN: Predictable reset tokens
const resetToken = `reset-${userId}-${Date.now()}`;
```

**Secure Design:**

```javascript
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Use UUIDs for resource identifiers
const newUser = new User({
  publicId: uuidv4(),  // 550e8400-e29b-41d4-a716-446655440000
  // ...
});

// Use cryptographically random tokens
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');  // 64 character hex string
}

const resetToken = generateSecureToken();
// Store hashed version of token, send plain version to user
const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
```

### 3. Missing Business Logic Validation

**The Problem:**

Trusting client-side validation or not validating business rules on the server.

```javascript
// INSECURE DESIGN: Trust client-provided price
app.post('/checkout', async (req, res) => {
  const { items, total } = req.body;  // Client sends the total!
  
  await Order.create({
    items,
    total,  // Attacker could send total: 0.01
    userId: req.user.id
  });
});
```

**Secure Design:**

```javascript
// SECURE: Calculate total server-side
app.post('/checkout', async (req, res) => {
  const { items } = req.body;
  
  // Fetch current prices from database
  const productIds = items.map(item => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  
  // Create price lookup map
  const priceMap = new Map(products.map(p => [p._id.toString(), p.price]));
  
  // Calculate total server-side with validation
  let total = 0;
  for (const item of items) {
    const price = priceMap.get(item.productId);
    if (!price) {
      return res.status(400).json({ error: `Invalid product: ${item.productId}` });
    }
    if (item.quantity < 1 || item.quantity > 100) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    total += price * item.quantity;
  }
  
  await Order.create({
    items,
    total,  // Server-calculated, tamper-proof
    userId: req.user.id
  });
});
```

### 4. Insufficient Anti-Automation

**The Problem:**

Not protecting sensitive operations from automated abuse.

```javascript
// INSECURE DESIGN: No CAPTCHA on registration
app.post('/register', async (req, res) => {
  const user = await User.create(req.body);
  res.json({ success: true });
});
// Bots can create thousands of fake accounts
```

**Secure Design:**

```javascript
const axios = require('axios');

async function verifyCaptcha(token) {
  const response = await axios.post(
    'https://www.google.com/recaptcha/api/siteverify',
    null,
    {
      params: {
        secret: process.env.RECAPTCHA_SECRET,
        response: token
      }
    }
  );
  return response.data.success && response.data.score >= 0.5;
}

app.post('/register', async (req, res) => {
  // Verify CAPTCHA first
  const captchaValid = await verifyCaptcha(req.body.captchaToken);
  if (!captchaValid) {
    return res.status(400).json({ error: 'CAPTCHA verification failed' });
  }
  
  const user = await User.create(req.body);
  res.json({ success: true });
});
```

## Secure Design Principles

### 1. Threat Modeling

Before writing code, identify potential threats using frameworks like STRIDE:

- **S**poofing - Can someone impersonate a user?
- **T**ampering - Can data be modified in transit or at rest?
- **R**epudiation - Can actions be denied without proof?
- **I**nformation Disclosure - Can sensitive data leak?
- **D**enial of Service - Can the system be overwhelmed?
- **E**levation of Privilege - Can users gain unauthorized access?

### 2. Defense in Depth

Don't rely on a single security control. Layer multiple defenses:

```javascript
// Multiple layers protecting sensitive data
app.get('/api/admin/users', 
  authenticateRequest,     // Layer 1: Must be logged in
  requireRole('admin'),    // Layer 2: Must be admin
  rateLimit({ max: 100 }), // Layer 3: Rate limiting
  validateQuery,           // Layer 4: Input validation
  auditLog,                // Layer 5: Logging for detection
  adminUsersHandler
);
```

### 3. Secure by Default

Default configurations should be secure. Users should have to explicitly enable risky features.

```javascript
// Secure defaults for session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,        // Default: HTTPS only
    httpOnly: true,      // Default: No JavaScript access
    sameSite: 'strict',  // Default: CSRF protection
    maxAge: 3600000      // Default: 1 hour expiry
  }
};

// Only allow insecure cookies in development
if (process.env.NODE_ENV === 'development') {
  sessionConfig.cookie.secure = false;
}
```

### 4. Fail Securely

When errors occur, fail in a secure state:

```javascript
// INSECURE: Fail open
async function checkPermission(userId, resource) {
  try {
    const hasAccess = await permissionService.check(userId, resource);
    return hasAccess;
  } catch (error) {
    console.error('Permission check failed:', error);
    return true;  // WRONG: Allow access on error
  }
}

// SECURE: Fail closed
async function checkPermission(userId, resource) {
  try {
    const hasAccess = await permissionService.check(userId, resource);
    return hasAccess;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;  // CORRECT: Deny access on error
  }
}
```

## Key Takeaways

1. **Design security in from the start** - Retrofitting security is expensive and often incomplete
2. **Perform threat modeling** - Identify risks before they become vulnerabilities
3. **Never trust client input** - Validate all business logic server-side
4. **Implement rate limiting** - Protect against brute force and enumeration
5. **Use unpredictable identifiers** - UUIDs and cryptographic tokens
6. **Apply defense in depth** - Multiple layers of security controls
7. **Fail securely** - Deny access when something goes wrong
8. **Secure by default** - Require explicit action to enable risky features

Secure design requires thinking like an attacker during the planning phase. The effort invested in secure design pays dividends throughout the application's lifetime.
