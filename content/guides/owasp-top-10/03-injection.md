---
title: 'A03: Injection'
description: 'Learn about injection vulnerabilities including SQL injection, NoSQL injection, and command injection. Understand how attackers exploit these flaws and how to prevent them.'
---

Injection attacks occur when untrusted data is sent to an interpreter as part of a command or query. This was the #1 vulnerability on the OWASP Top 10 for years and remains at #3 in 2021 because injection flaws continue to be discovered and exploited.

The fundamental problem is simple: the application doesn't distinguish between code and data. When user input becomes part of a command, attackers can inject their own instructions.

## What is Injection?

Injection happens when an attacker can insert or "inject" malicious content into a query or command that's executed by an interpreter. Common injection types include:

- **SQL Injection** - Manipulating database queries
- **NoSQL Injection** - Attacking document databases like MongoDB
- **Command Injection** - Executing system commands
- **LDAP Injection** - Manipulating directory service queries
- **XPath Injection** - Attacking XML document queries
- **Template Injection** - Exploiting server-side template engines

## SQL Injection: The Classic Attack

SQL injection is the most well-known and still one of the most common injection attacks.

### How It Works

Consider a simple login form that checks credentials:

```javascript
// VULNERABLE: String concatenation creates SQL injection risk
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // User input directly concatenated into SQL query
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  
  const result = await db.query(query);
  if (result.rows.length > 0) {
    res.json({ success: true, user: result.rows[0] });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

A normal login attempt generates:

```sql
SELECT * FROM users WHERE username = 'alice' AND password = 'secret123'
```

But an attacker entering `' OR '1'='1' --` as the username creates:

```sql
SELECT * FROM users WHERE username = '' OR '1'='1' --' AND password = 'anything'
```

The `--` comments out the rest of the query, and `'1'='1'` is always true, so this returns ALL users. The attacker bypasses authentication entirely.

### More Dangerous Exploits

SQL injection isn't just about authentication bypass. Attackers can:

**Extract entire databases:**

```sql
-- Using UNION to retrieve data from other tables
' UNION SELECT username, password, email FROM users --
```

**Modify data:**

```sql
-- Inject an UPDATE statement
'; UPDATE users SET role = 'admin' WHERE username = 'attacker'; --
```

**Delete data:**

```sql
-- The infamous DROP TABLE
'; DROP TABLE users; --
```

### Prevention: Parameterized Queries

The solution is to use parameterized queries (also called prepared statements). These separate the SQL structure from the data:

```javascript
// SECURE: Parameterized query
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // $1 and $2 are placeholders - the database treats them as DATA, not SQL
  const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
  const values = [username, password];
  
  const result = await db.query(query, values);
  if (result.rows.length > 0) {
    res.json({ success: true, user: result.rows[0] });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

Now, even if an attacker enters `' OR '1'='1' --` as the username, it's treated as a literal string value:

```sql
SELECT * FROM users WHERE username = ''' OR ''1''=''1'' --' AND password = 'anything'
```

The special characters are escaped, and the query looks for a user with that exact (nonsensical) username.

### Using an ORM

ORMs (Object-Relational Mappers) typically use parameterized queries by default:

```javascript
// Using Sequelize ORM - parameterized by default
const user = await User.findOne({
  where: {
    username: req.body.username,
    password: req.body.password
  }
});

// Using Prisma ORM
const user = await prisma.user.findFirst({
  where: {
    username: req.body.username,
    password: req.body.password
  }
});
```

However, watch out for raw query methods that can reintroduce injection:

```javascript
// VULNERABLE: Raw query in Sequelize
const users = await sequelize.query(
  `SELECT * FROM users WHERE name = '${req.body.name}'`
);

// SECURE: Raw query with replacements
const users = await sequelize.query(
  'SELECT * FROM users WHERE name = :name',
  {
    replacements: { name: req.body.name },
    type: QueryTypes.SELECT
  }
);
```

## NoSQL Injection

NoSQL databases like MongoDB are not immune to injection attacks, though they look different.

### How It Works

MongoDB queries use JavaScript objects, and attackers can inject operators:

```javascript
// VULNERABLE: Direct use of request body in query
app.post('/login', async (req, res) => {
  const user = await User.findOne({
    username: req.body.username,
    password: req.body.password
  });
  // ...
});
```

This looks safe, but what if the attacker sends:

```json
{
  "username": "admin",
  "password": { "$gt": "" }
}
```

The query becomes:

```javascript
User.findOne({ username: "admin", password: { $gt: "" } })
```

The `$gt: ""` operator matches any non-empty password, bypassing authentication!

### Prevention

**Type checking and validation:**

```javascript
// SECURE: Validate input types
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Ensure both are strings
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  
  const user = await User.findOne({ username, password });
  // ...
});
```

**Using a validation library:**

```javascript
const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).max(100).required()
});

app.post('/login', async (req, res) => {
  // Validation rejects non-string values and malicious operators
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  
  const { username, password } = value;
  const user = await User.findOne({ username, password });
  // ...
});
```

**Mongoose with sanitization:**

```javascript
const mongoSanitize = require('express-mongo-sanitize');

// Middleware removes $ and . from request data
app.use(mongoSanitize());

// Now { "password": { "$gt": "" } } becomes { "password": { "gt": "" } }
// The injection fails
```

## Command Injection

Command injection occurs when an application passes user input to a system shell.

### How It Works

```javascript
// VULNERABLE: User input in shell command
const { exec } = require('child_process');

app.get('/ping', (req, res) => {
  const host = req.query.host;
  
  // Dangerous: user controls part of the command
  exec(`ping -c 4 ${host}`, (error, stdout, stderr) => {
    res.send(`<pre>${stdout}</pre>`);
  });
});
```

A normal request like `/ping?host=google.com` runs:

```bash
ping -c 4 google.com
```

But an attacker can chain commands using `;`, `&&`, `||`, or backticks:

```
/ping?host=google.com; cat /etc/passwd
```

This runs:

```bash
ping -c 4 google.com; cat /etc/passwd
```

The attacker now sees the contents of `/etc/passwd`. They could run any command the application has permission to execute.

### Prevention

**Option 1: Avoid shell commands entirely**

```javascript
// SECURE: Use execFile with arguments array
const { execFile } = require('child_process');

app.get('/ping', (req, res) => {
  const host = req.query.host;
  
  // Validate the host first
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    return res.status(400).send('Invalid hostname');
  }
  
  // execFile doesn't spawn a shell, arguments are passed directly
  execFile('ping', ['-c', '4', host], (error, stdout, stderr) => {
    res.send(`<pre>${stdout}</pre>`);
  });
});
```

`execFile` runs the command directly without a shell, so shell metacharacters like `;` have no special meaning.

**Option 2: Use purpose-built libraries**

```javascript
// Instead of shelling out to ping, use a library
const ping = require('ping');

app.get('/ping', async (req, res) => {
  const host = req.query.host;
  
  // Validate hostname format
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    return res.status(400).send('Invalid hostname');
  }
  
  const result = await ping.promise.probe(host);
  res.json(result);
});
```

**Option 3: Strict allowlist validation**

```javascript
// Only allow specific, pre-approved values
const ALLOWED_HOSTS = ['google.com', 'cloudflare.com', '8.8.8.8'];

app.get('/ping', (req, res) => {
  const host = req.query.host;
  
  if (!ALLOWED_HOSTS.includes(host)) {
    return res.status(400).send('Host not allowed');
  }
  
  // Now safe because host is from a known-good list
  exec(`ping -c 4 ${host}`, (error, stdout, stderr) => {
    res.send(`<pre>${stdout}</pre>`);
  });
});
```

## Template Injection

Server-side template injection (SSTI) occurs when user input is embedded into templates and executed.

### How It Works

```javascript
// VULNERABLE: User input in template string
const ejs = require('ejs');

app.get('/greet', (req, res) => {
  const name = req.query.name;
  
  // User input becomes part of the template
  const template = `<h1>Hello, ${name}!</h1>`;
  const html = ejs.render(template);
  res.send(html);
});
```

An attacker can inject template syntax to execute code:

```
/greet?name=<%= process.env.SECRET_KEY %>
```

### Prevention

```javascript
// SECURE: Pass user input as data, not part of template
const ejs = require('ejs');

app.get('/greet', (req, res) => {
  const name = req.query.name;
  
  // Template is static, user input is passed as data
  const template = '<h1>Hello, <%= name %>!</h1>';
  const html = ejs.render(template, { name: name });
  res.send(html);
});
```

## Comprehensive Prevention Strategy

### 1. Input Validation Layer

Create a validation middleware that sanitizes all input:

```javascript
const Joi = require('joi');

// Define schemas for each endpoint
const schemas = {
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).max(100).required()
  }),
  
  search: Joi.object({
    query: Joi.string().max(200).required(),
    page: Joi.number().integer().min(1).default(1)
  })
};

// Validation middleware factory
function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    
    // Replace body with validated/sanitized values
    req.body = value;
    next();
  };
}

// Usage
app.post('/login', validate('login'), loginHandler);
app.get('/search', validate('search'), searchHandler);
```

### 2. Security Headers and Content Security Policy

```javascript
const helmet = require('helmet');

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],  // No inline scripts
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  }
}));
```

### 3. Security Testing in CI/CD

Include injection testing in your pipeline using SAST tools like Semgrep with the OWASP Top 10 ruleset. You can also run automated SQL injection tests against staging environments using tools like sqlmap.

## Key Takeaways

1. **Never concatenate user input** into queries or commands
2. **Use parameterized queries** for all database operations
3. **Validate and sanitize** all input before use
4. **Use allowlists** when possible instead of blocklists
5. **Avoid shell commands** - use libraries or execFile with argument arrays
6. **Pass user data to templates**, don't embed it in template strings
7. **Test for injection** vulnerabilities in your CI/CD pipeline
8. **Apply defense in depth** - multiple layers of protection

Injection attacks are conceptually simple but can have catastrophic consequences. The good news is that they're also straightforward to prevent with consistent secure coding practices.
