---
title: 'What Is the Quickest Way to HTTP GET in Python?'
excerpt: "Need to make a quick HTTP GET request in Python? Here's how to do it with standard libraries and third-party tools, including pros and tradeoffs."
category:
  name: 'Python'
  slug: 'python'
date: '2024-08-11'
publishedAt: '2024-08-11T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Python
  - HTTP
  - Networking
  - Requests
  - CLI
---

When you're working with Python, sometimes you just want to grab the contents of a URL with as little friction as possible. Whether you're debugging an API, scraping data, or automating some monitoring script, knowing how to quickly perform an HTTP GET request is a must.

This post shows you the fastest ways to do it in Python, using both built-in modules and popular third-party libraries.

## Prerequisites

- Python 3.x installed on your system
- Terminal access or a Python script file

No need for a full project structure. These are all one-liners or short snippets you can drop into your scripts.

## Method 1: Using `requests` (Recommended for Most Use Cases)

The [`requests`](https://docs.python-requests.org/en/latest/) library is the most popular way to make HTTP requests in Python. It's not part of the standard library, but it's well-maintained and intuitive.

Install it first:

```bash
pip install requests
```

Then, to make a GET request:

```python
import requests

response = requests.get("https://api.github.com")
print(response.status_code)
print(response.text)
```

**Why it matters:**

- Handles redirects, SSL, and headers out of the box
- Easy to work with JSON APIs (`response.json()`)
- Supports timeouts, sessions, and retries

Use this when you're building anything more than a one-off script.

## Method 2: Using `http.client` (Built-in, but Verbose)

If you don't want any external dependencies, `http.client` is built into the Python standard library.

```python
import http.client

conn = http.client.HTTPSConnection("api.github.com")
conn.request("GET", "/")
response = conn.getresponse()
print(response.status, response.read().decode())
```

**Why it matters:**

- No need to install anything
- Good for learning how HTTP works under the hood

However, it's quite low-level. You'll need to manage headers, handle redirects manually, and decode content yourself.

## Method 3: Using `urllib.request` (Also Built-in, Slightly Cleaner)

`urllib.request` is another standard library option. It's higher-level than `http.client` but still less ergonomic than `requests`.

```python
import urllib.request

with urllib.request.urlopen("https://api.github.com") as response:
    content = response.read().decode()
    print(content)
```

**Why it matters:**

- Standard library
- Less boilerplate than `http.client`

Still, you'll find yourself handling things manually more often.

## Method 4: Using `httpx` (Modern Alternative to `requests`)

[`httpx`](https://www.python-httpx.org/) is a newer HTTP client designed to work in both synchronous and asynchronous contexts. It's especially helpful if you're already using `asyncio`.

Install it with:

```bash
pip install httpx
```

Then:

```python
import httpx

response = httpx.get("https://api.github.com")
print(response.status_code)
print(response.text)
```

**Why it matters:**

- Drop-in replacement for `requests`
- Supports async with `httpx.AsyncClient()`

Use this if you're building a modern async application or want better performance.

## Bonus: One-Liner with `requests` in a Script or REPL

If you just need a quick test from the REPL:

```python
__import__('requests').get('https://httpbin.org/get').text
```

Not pretty, but useful when debugging from the command line.

---

For anything more than a throwaway script, stick with `requests` or `httpx`. Built-in tools are good in environments where you can't install packages or want to reduce dependencies.

Want to explore further? Try handling timeouts, setting custom headers, or working with APIs that require authentication.
