---
title: 'Language-Specific Security Patterns'
description: 'Learn security patterns and anti-patterns specific to Python, JavaScript, Go, and Java during code review.'
---

Each programming language has its own security pitfalls and best practices. This section covers language-specific patterns to watch for during code review.

## Python Security Patterns

### Dangerous Functions

Watch for these high-risk functions:

```python
# eval/exec - Code execution
eval(user_input)      # VULNERABLE
exec(user_input)      # VULNERABLE
compile(user_input, '<string>', 'exec')  # VULNERABLE

# pickle - Arbitrary code execution on deserialize
import pickle
pickle.loads(user_data)  # VULNERABLE

# yaml.load without SafeLoader
import yaml
yaml.load(user_data)  # VULNERABLE - can execute code
yaml.safe_load(user_data)  # SECURE

# subprocess with shell=True
subprocess.run(cmd, shell=True)  # VULNERABLE if cmd contains user input
```

### Safe Alternatives

```python
# Instead of eval for JSON
import json
data = json.loads(user_input)  # SECURE

# Instead of pickle for serialization
import json
data = json.dumps(obj)  # SECURE

# Instead of yaml.load
import yaml
data = yaml.safe_load(user_input)  # SECURE

# Instead of shell=True
subprocess.run(['cmd', 'arg1', 'arg2'], shell=False)  # SECURE
```

### Python-Specific Review Checklist

- [ ] No `eval()`, `exec()`, or `compile()` with user input
- [ ] No `pickle.loads()` on untrusted data
- [ ] `yaml.safe_load()` instead of `yaml.load()`
- [ ] `subprocess` uses list args, not shell=True
- [ ] No `__import__()` with user input
- [ ] Template strings don't use user input in format specifiers

## JavaScript/Node.js Security Patterns

### Dangerous Functions

```javascript
// eval and Function constructor - Code execution
eval(userInput);  // VULNERABLE
new Function(userInput)();  // VULNERABLE
setTimeout(userInput, 1000);  // VULNERABLE if string
setInterval(userInput, 1000);  // VULNERABLE if string

// DOM XSS vectors
element.innerHTML = userInput;  // VULNERABLE
element.outerHTML = userInput;  // VULNERABLE
document.write(userInput);  // VULNERABLE

// Node.js specific
require(userInput);  // VULNERABLE - arbitrary module load
child_process.exec(userInput);  // VULNERABLE
vm.runInContext(userInput);  // VULNERABLE
```

### Safe Alternatives

```javascript
// Safe DOM manipulation
element.textContent = userInput;  // SECURE
element.setAttribute('data-value', userInput);  // SECURE (mostly)

// Safe JSON parsing
const data = JSON.parse(userInput);  // SECURE

// Safe child process
const { spawn } = require('child_process');
spawn('cmd', ['arg1', 'arg2']);  // SECURE - no shell

// Safe timeout/interval
setTimeout(() => safeFunction(), 1000);  // SECURE - function ref
```

### Prototype Pollution

A JavaScript-specific vulnerability:

```javascript
// VULNERABLE - prototype pollution
function merge(target, source) {
    for (let key in source) {
        target[key] = source[key];
    }
}
// Attacker sends: {"__proto__": {"isAdmin": true}}
// Now ALL objects have isAdmin = true

// SECURE - check for prototype keys
function safeMerge(target, source) {
    for (let key in source) {
        if (key === '__proto__' || key === 'constructor') continue;
        if (source.hasOwnProperty(key)) {
            target[key] = source[key];
        }
    }
}
```

### JavaScript-Specific Review Checklist

- [ ] No `eval()`, `Function()`, or string-based `setTimeout`
- [ ] No `innerHTML` with user input
- [ ] Object merging checks for `__proto__` and `constructor`
- [ ] `JSON.parse()` instead of `eval()` for JSON
- [ ] No `require()` with user-controlled paths
- [ ] CSP headers configured to prevent inline scripts

## Go Security Patterns

### Dangerous Patterns

```go
// SQL injection
query := "SELECT * FROM users WHERE id = " + userID  // VULNERABLE
db.Query(query)

// Command injection
cmd := exec.Command("sh", "-c", userInput)  // VULNERABLE

// Path traversal
path := filepath.Join("/uploads", userFilename)  // VULNERABLE
// filepath.Join doesn't prevent ../

// SSRF
resp, _ := http.Get(userURL)  // VULNERABLE
```

### Safe Patterns

```go
// Parameterized queries - SECURE
query := "SELECT * FROM users WHERE id = $1"
db.Query(query, userID)

// Safe command execution - SECURE
cmd := exec.Command("ls", "-la", safeArg)
// Never use "sh", "-c" with user input

// Path traversal prevention - SECURE
cleanPath := filepath.Clean(userFilename)
if strings.Contains(cleanPath, "..") {
    return errors.New("invalid path")
}
fullPath := filepath.Join("/uploads", cleanPath)
if !strings.HasPrefix(fullPath, "/uploads/") {
    return errors.New("path escape detected")
}

// SSRF prevention - SECURE
parsedURL, _ := url.Parse(userURL)
if parsedURL.Host != "allowed-host.com" {
    return errors.New("invalid host")
}
```

### Go-Specific Review Checklist

- [ ] SQL uses parameterized queries (`$1`, `?`)
- [ ] No `exec.Command("sh", "-c", ...)` with user input
- [ ] Path operations validate against directory escape
- [ ] HTTP clients validate URLs before requests
- [ ] Error messages don't leak sensitive information
- [ ] Goroutines don't have race conditions with shared state

## Java Security Patterns

### Dangerous Patterns

```java
// SQL injection
String query = "SELECT * FROM users WHERE id = " + userId;  // VULNERABLE
statement.executeQuery(query);

// XML External Entity (XXE)
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
// Default config is VULNERABLE to XXE
Document doc = dbf.newDocumentBuilder().parse(userInput);

// Deserialization
ObjectInputStream ois = new ObjectInputStream(userInputStream);
Object obj = ois.readObject();  // VULNERABLE - arbitrary code execution

// LDAP injection
String filter = "(uid=" + username + ")";  // VULNERABLE
```

### Safe Patterns

```java
// Prepared statements - SECURE
PreparedStatement ps = conn.prepareStatement(
    "SELECT * FROM users WHERE id = ?"
);
ps.setInt(1, userId);
ResultSet rs = ps.executeQuery();

// XXE prevention - SECURE
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

// Safe serialization - use JSON instead
ObjectMapper mapper = new ObjectMapper();
MyClass obj = mapper.readValue(jsonString, MyClass.class);  // SECURE

// LDAP filter escaping - SECURE
String safeUsername = LdapEncoder.filterEncode(username);
String filter = "(uid=" + safeUsername + ")";
```

### Java-Specific Review Checklist

- [ ] SQL uses PreparedStatement with parameters
- [ ] XML parsers disable external entities (XXE prevention)
- [ ] No `ObjectInputStream.readObject()` on untrusted data
- [ ] LDAP queries use proper escaping
- [ ] Log4j is patched and JNDI lookup is disabled
- [ ] Spring Security CSRF protection is enabled

## Cross-Language Patterns

### Regular Expression DoS (ReDoS)

All languages are susceptible:

```python
# Catastrophic backtracking - VULNERABLE
import re
pattern = r'^(a+)+$'
re.match(pattern, 'a' * 30 + 'b')  # Hangs!

# Safe pattern - SECURE
pattern = r'^a+$'  # No nested quantifiers
```

**Review checklist for regex:**
- [ ] No nested quantifiers `(a+)+`, `(a*)*`, `(a+)*`
- [ ] No overlapping alternations `(a|a)+`
- [ ] Timeout on regex operations with user input

### SSRF (Server-Side Request Forgery)

Common across all languages:

```python
# VULNERABLE - user controls URL
response = requests.get(user_provided_url)

# SECURE - validate URL
from urllib.parse import urlparse

ALLOWED_HOSTS = ['api.example.com', 'cdn.example.com']

def safe_fetch(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise ValueError('Invalid scheme')
    if parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError('Host not allowed')
    # Also check for internal IPs
    ip = socket.gethostbyname(parsed.hostname)
    if ipaddress.ip_address(ip).is_private:
        raise ValueError('Private IP not allowed')
    return requests.get(url)
```

