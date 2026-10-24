---
title: 'Python Control Flow: if, match, for and while Loops with Retries'
description: 'Python if, elif and match, for loops over hosts and batches, while loops with deadlines, and exponential backoff with jitter, with real output.'
order: 3
---

Scripts make decisions and repeat work: skip a host that is in maintenance, retry a request that timed out, restart servers two at a time and stop at the first failure. That is **control flow**: `if` and `match` choose what runs, and `for` and `while` repeat it.

This part covers conditions and the truthiness rules behind them, the `match` statement (Python 3.10 and later), `for` loops over lists, ranges and batches, and `while` loops that wait for a service with a deadline and exponential backoff.

## Prerequisites

- The `~/pyops` project from [Part 1](/guides/introduction-to-python/01-getting-started), with its virtual environment active.
- Strings, numbers and environment variables from [Part 2](/guides/introduction-to-python/02-variables-and-data-types).

## if, elif and else

An `if` statement runs its block when the condition is true. `elif` (else if) adds more conditions, checked in order, and `else` catches everything left. The block is the indented lines after the colon; Python uses the indentation, not braces, so it must be consistent (four spaces is the standard):

```python
"""Check a service's settings before it starts."""

import os
import sys

port = int(os.environ.get("APP_PORT", "8080"))
workers = int(os.environ.get("APP_WORKERS", "4"))
env = os.environ.get("APP_ENV", "dev")

if not 1 <= port <= 65535:
    sys.exit(f"APP_PORT must be between 1 and 65535, got {port}")
elif port < 1024:
    print(f"warning: port {port} needs root or CAP_NET_BIND_SERVICE")

if workers < 1:
    sys.exit("APP_WORKERS must be at least 1")

if env == "prod" and workers < 2:
    sys.exit("prod needs at least 2 workers")

mode = "production" if env == "prod" else "development"
print(f"settings ok: port={port} workers={workers} env={env} ({mode} mode)")
```

```terminal
{
  "title": "validate settings",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python validate.py",
      "output": "settings ok: port=8080 workers=4 env=dev (development mode)"
    },
    {
      "cmd": "APP_PORT=443 APP_ENV=prod APP_WORKERS=8 python validate.py",
      "output": "warning: port 443 needs root or CAP_NET_BIND_SERVICE\nsettings ok: port=443 workers=8 env=prod (production mode)"
    },
    {
      "cmd": "APP_PORT=70000 python validate.py; echo \"exit code $?\"",
      "output": "APP_PORT must be between 1 and 65535, got 70000\nexit code 1"
    },
    {
      "cmd": "APP_ENV=prod APP_WORKERS=1 python validate.py; echo \"exit code $?\"",
      "output": "prod needs at least 2 workers\nexit code 1"
    }
  ]
}
```

A few things in that script are worth reusing:

- **Chained comparisons**: `1 <= port <= 65535` means `1 <= port and port <= 65535`.
- **`sys.exit("message")`** prints the message to standard error and exits with code 1, so a shell script or CI job sees the failure. `sys.exit()` with no argument, or with 0, exits successfully.
- **A conditional expression**, `a if condition else b`, picks one of two values in a single line. Use it for simple choices only.

Indentation is part of the syntax, so a missing indent is an error before anything runs:

```terminal
{
  "title": "indentation is syntax",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf 'if True:\\nprint(\"missing indent\")\\n' > bad_indent.py && python bad_indent.py",
      "output": "  File \"/home/dev/pyops/bad_indent.py\", line 2\n    print(\"missing indent\")\n    ^^^^^\nIndentationError: expected an indented block after 'if' statement on line 1"
    }
  ]
}
```

## Conditions, and and or

Conditions use `==`, `!=`, `<`, `<=`, `>`, `>=`, `in` (membership), `is` (identity, for `None`) and `not`. Combine them with `and` and `or`, which **short-circuit**: `or` stops at the first true value and `and` at the first false one. They also return that value, not just `True` or `False`, which gives you a compact way to apply defaults:

```terminal
{
  "title": "and, or and defaults",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> region = \"\" or \"eu-west-1\"\n>>> region\n'eu-west-1'\n>>> retries = 0\n>>> retries or 3\n3\n>>> retries if retries is not None else 3\n0\n>>> status = 503\n>>> status in (429, 502, 503, 504)\nTrue\n>>> status == 500 or 503\n503\n>>> exit()"
    }
  ]
}
```

Two traps in that transcript:

- `retries or 3` gives 3 when you asked for 0 retries, because 0 is false. Use `or` for defaults only when the empty value really means "not set"; otherwise test `is None`.
- `status == 500 or 503` does not mean "500 or 503". It means `(status == 500) or 503`, which is always true. Write `status in (500, 503)`.

## match: Choose by Shape

The `match` statement (Python 3.10 and later) compares a value against **patterns**. Each `case` can match a literal, several alternatives with `|`, a guard with `if`, or the _shape_ of a list or dictionary, and it can pull values out of it at the same time. Here it classifies HTTP status codes:

```python
"""Decide what to do with an HTTP status code."""

for code in [200, 204, 301, 404, 429, 500, 503]:
    match code:
        case 200 | 201 | 204:
            action = "ok"
        case 301 | 302 | 307 | 308:
            action = "follow the redirect"
        case 429 | 502 | 503 | 504:
            action = "retry later"
        case _ if 400 <= code < 500:
            action = "client error: fix the request, do not retry"
        case _:
            action = "server error: alert"
    print(f"{code}: {action}")
```

```terminal
{
  "title": "match on status codes",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python classify.py",
      "output": "200: ok\n204: ok\n301: follow the redirect\n404: client error: fix the request, do not retry\n429: retry later\n500: server error: alert\n503: retry later"
    }
  ]
}
```

`case _:` matches anything, like `else`. Patterns really pay off with structured data. A health endpoint might return one of several JSON shapes, and `match` both recognizes the shape and extracts the fields:

```python
"""Turn health check responses of different shapes into one line each."""

import json

responses = [
    '{"status": "ok", "version": "1.4.2"}',
    '{"status": "degraded", "failing": ["db", "cache"]}',
    '{"error": "timeout", "after_ms": 2000}',
    '{"status": "maintenance"}',
]

for text in responses:
    match json.loads(text):
        case {"status": "ok", "version": str(version)}:
            print(f"healthy, version {version}")
        case {"status": "degraded", "failing": [*parts]}:
            print(f"degraded: {', '.join(parts)} failing")
        case {"error": message, "after_ms": int(ms)}:
            print(f"check failed: {message} after {ms} ms")
        case other:
            print(f"unknown response: {other}")
```

```terminal
{
  "title": "match on JSON shapes",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python health.py",
      "output": "healthy, version 1.4.2\ndegraded: db, cache failing\ncheck failed: timeout after 2000 ms\nunknown response: {'status': 'maintenance'}"
    }
  ]
}
```

A dictionary pattern matches when the listed keys exist with matching values; extra keys are ignored. `str(version)` matches only a string and binds it to `version`, and `[*parts]` matches any list. The last case binds the whole value to `other`.

`match` also works on a list of words, which makes a small command dispatcher readable. `sys.argv` holds the script's command-line arguments (`sys.argv[0]` is the script name):

```python
"""A tiny command dispatcher: python deployctl.py deploy staging --dry-run"""

import sys

ENVIRONMENTS = ("dev", "staging", "prod")

match sys.argv[1:]:
    case ["deploy", env] if env in ENVIRONMENTS:
        print(f"deploying to {env}")
    case ["deploy", env, "--dry-run"] if env in ENVIRONMENTS:
        print(f"would deploy to {env}")
    case ["deploy", env, *_]:
        sys.exit(f"unknown environment {env!r}, choose from {', '.join(ENVIRONMENTS)}")
    case ["rollback", release] if release.isdigit():
        print(f"rolling back to release {int(release)}")
    case ["rollback", release]:
        sys.exit(f"release must be a number, got {release!r}")
    case ["status"] | []:
        print("all services healthy")
    case [command, *_]:
        sys.exit(f"unknown command {command!r}")
```

```terminal
{
  "title": "match on arguments",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python deployctl.py deploy staging",
      "output": "deploying to staging"
    },
    {
      "cmd": "python deployctl.py deploy prod --dry-run",
      "output": "would deploy to prod"
    },
    {
      "cmd": "python deployctl.py deploy qa",
      "output": "unknown environment 'qa', choose from dev, staging, prod"
    },
    {
      "cmd": "python deployctl.py rollback latest",
      "output": "release must be a number, got 'latest'"
    },
    {
      "cmd": "python deployctl.py",
      "output": "all services healthy"
    }
  ]
}
```

The cases are tried from top to bottom, so put specific patterns before general ones. For a real command-line tool, use `argparse`, which also gives you `--help` and error messages; [Part 10](/guides/introduction-to-python/10-building-a-python-project) builds one.

## for Loops

A `for` loop runs its block once for each item of a sequence: a list, a string, the lines of a file, the keys of a dictionary. Three helpers cover most needs: `enumerate()` adds a counter, `zip()` walks several lists side by side, and `range()` produces numbers:

```terminal
{
  "title": "for, enumerate, zip and range",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> hosts = [\"web-01\", \"web-02\", \"web-03\", \"db-01\"]\n>>> zones = [\"a\", \"b\", \"c\", \"a\"]\n>>> for number, host in enumerate(hosts, start=1):\n...     print(f\"{number}. {host}\")\n...\n1. web-01\n2. web-02\n3. web-03\n4. db-01\n>>> for host, zone in zip(hosts, zones, strict=True):\n...     print(f\"{host} runs in zone {zone}\")\n...\nweb-01 runs in zone a\nweb-02 runs in zone b\nweb-03 runs in zone c\ndb-01 runs in zone a\n>>> list(range(0, 10, 3))\n[0, 3, 6, 9]\n>>> exit()"
    }
  ]
}
```

`zip(..., strict=True)` (Python 3.10 and later) raises an error when the lists have different lengths, instead of silently dropping the extra items.

`break` leaves the loop early and `continue` skips to the next item. A loop can also have an `else` block, which runs only when the loop finished _without_ `break`. It reads oddly at first, but it is exactly what a search needs:

```terminal
{
  "title": "break and for...else",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> hosts = [\"web-01\", \"web-02\", \"web-03\"]\n>>> for host in hosts:\n...     if host.startswith(\"db-\"):\n...         print(f\"found a database host: {host}\")\n...         break\n... else:\n...     print(\"no database host in the list\")\n...\nno database host in the list\n>>> exit()"
    }
  ]
}
```

### Roll Out in Batches

Here is a pattern you will write in some form for any rollout: restart hosts in batches, check each one, and stop everything at the first failure. `range(0, len(hosts), batch_size)` gives the start index of each batch, and a slice takes the batch. The health results are hard-coded so you can see the control flow; Part 8 replaces them with real HTTP checks:

```python
"""Restart hosts in batches and stop at the first failed health check."""

hosts = ["web-01", "web-02", "web-03", "web-04", "web-05"]
healthy_after_restart = {
    "web-01": True,
    "web-02": True,
    "web-03": False,
    "web-04": True,
    "web-05": True,
}
batch_size = 2

failed = None
for start in range(0, len(hosts), batch_size):
    batch = hosts[start : start + batch_size]
    print(f"batch {start // batch_size + 1}: {', '.join(batch)}")
    for host in batch:
        if not healthy_after_restart[host]:
            print(f"  {host}: FAILED health check")
            failed = host
            break
        print(f"  {host}: healthy")
    if failed:
        break

if failed:
    untouched = len(hosts) - hosts.index(failed) - 1
    print(f"rollout stopped at {failed}, {untouched} hosts not restarted")
else:
    print("rollout complete")
```

```terminal
{
  "title": "a batched rollout",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python rollout.py",
      "output": "batch 1: web-01, web-02\n  web-01: healthy\n  web-02: healthy\nbatch 2: web-03, web-04\n  web-03: FAILED health check\nrollout stopped at web-03, 2 hosts not restarted"
    }
  ]
}
```

`break` only leaves the innermost loop, so the outer loop checks `failed` and breaks as well. When nested loops get hard to follow, move the inner loop into a function that returns early; [Part 4](/guides/introduction-to-python/04-functions) does that.

## while Loops: Wait for a Service

A `while` loop repeats as long as its condition is true. Its classic job in operations code is waiting: for a port to open, a deployment to finish, a file to appear. Every such loop needs two things: a **deadline**, so it cannot run forever, and a **sleep** between attempts, so it does not hammer the service or burn a CPU core.

This script waits until a TCP port accepts connections. `time.monotonic()` is a clock that never jumps (unlike the wall clock, which NTP can move), so it is the right one for measuring timeouts. `try` and `except OSError` catch the error that a refused connection raises; [Part 8](/guides/introduction-to-python/08-error-handling) covers exceptions in detail:

```python
"""Wait until a TCP port accepts connections: wait_for_port.py HOST PORT [TIMEOUT]"""

import math
import socket
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])
timeout = float(sys.argv[3]) if len(sys.argv) > 3 else 30.0
if not 1 <= port <= 65535:
    sys.exit(f"PORT must be between 1 and 65535, got {port}")
if not math.isfinite(timeout) or timeout <= 0:  # float() also accepts "nan" and "inf"
    sys.exit(f"TIMEOUT must be a positive number of seconds, got {timeout}")

start = time.monotonic()
deadline = start + timeout
delay = 0.5
attempt = 0
last_error = None
while True:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        sys.exit(f"{host}:{port} still down after {attempt} attempts: {last_error}")
    attempt += 1
    try:
        # one attempt never gets more than the time that is left
        with socket.create_connection((host, port), timeout=min(1.0, remaining)):
            break
    except OSError as err:
        last_error = err
        wait = min(delay, deadline - time.monotonic())
        if wait > 0:
            print(f"attempt {attempt}: {err}, retrying in {wait:.1f}s")
            time.sleep(wait)
        delay = min(delay * 2, 5.0)

print(f"{host}:{port} is up after {attempt} attempts ({time.monotonic() - start:.1f}s)")
```

The first checks reject a port outside 1 to 65535 and a timeout such as `nan` or `inf`, with which the deadline would never arrive. To try it, start a web server that only begins listening after three seconds, in the background, and wait for it. Then wait for a port where nothing will ever listen, and pass a bad timeout:

```terminal
{
  "title": "wait for a port",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "(sleep 3 && exec python -m http.server 8000 --bind 127.0.0.1) >/dev/null 2>&1 &"
    },
    {
      "cmd": "python wait_for_port.py 127.0.0.1 8000 10",
      "output": "attempt 1: [Errno 111] Connection refused, retrying in 0.5s\nattempt 2: [Errno 111] Connection refused, retrying in 1.0s\nattempt 3: [Errno 111] Connection refused, retrying in 2.0s\n127.0.0.1:8000 is up after 4 attempts (4.4s)"
    },
    {
      "cmd": "python wait_for_port.py 127.0.0.1 8001 3; echo \"exit code $?\"",
      "output": "attempt 1: [Errno 111] Connection refused, retrying in 0.5s\nattempt 2: [Errno 111] Connection refused, retrying in 1.0s\nattempt 3: [Errno 111] Connection refused, retrying in 1.4s\n127.0.0.1:8001 still down after 3 attempts: [Errno 111] Connection refused\nexit code 1"
    },
    {
      "cmd": "python wait_for_port.py 127.0.0.1 8001 nan; echo \"exit code $?\"",
      "output": "TIMEOUT must be a positive number of seconds, got nan\nexit code 1"
    },
    {
      "cmd": "kill %1"
    }
  ]
}
```

The delay doubles after each failed attempt (0.5, 1, 2 seconds, up to a cap of 5): this is **exponential backoff**. The loop checks the deadline before every attempt, the last sleep is cut short at the deadline, and each connection attempt gets at most the time that is left. Two things can still stretch it: looking up a host name has its own resolver timeouts, and for a name with several addresses `create_connection()` tries each address with that timeout. For an IP address, as here, the deadline holds.

### Backoff with Jitter

When many clients retry on the same schedule, they all hit the recovering service at the same moments. Adding randomness, **jitter**, spreads them out. The common "full jitter" approach waits a random time between zero and the exponential ceiling:

```python
"""Print a retry schedule with exponential backoff and full jitter."""

import random

random.seed(7)  # a fixed seed makes this run repeatable; leave it out in real code
base, cap = 0.5, 30.0

total = 0.0
for attempt in range(1, 9):
    ceiling = min(cap, base * 2 ** (attempt - 1))
    delay = random.uniform(0, ceiling)
    total += delay
    print(f"attempt {attempt}: ceiling {ceiling:5.1f}s, wait {delay:5.2f}s")
print(f"worst case {sum(min(cap, base * 2**n) for n in range(8)):.1f}s, this run {total:.1f}s")
```

```terminal
{
  "title": "a jittered schedule",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python backoff.py",
      "output": "attempt 1: ceiling   0.5s, wait  0.16s\nattempt 2: ceiling   1.0s, wait  0.15s\nattempt 3: ceiling   2.0s, wait  1.30s\nattempt 4: ceiling   4.0s, wait  0.29s\nattempt 5: ceiling   8.0s, wait  4.29s\nattempt 6: ceiling  16.0s, wait  5.85s\nattempt 7: ceiling  30.0s, wait  1.74s\nattempt 8: ceiling  30.0s, wait 15.22s\nworst case 91.5s, this run 29.0s"
    }
  ]
}
```

Retry only what is safe to repeat (a GET, a health check, an idempotent API call), and only on errors that can go away: timeouts, connection errors, 429 and 5xx responses. A 404 will not fix itself. [Part 4](/guides/introduction-to-python/04-functions) wraps this loop in a reusable retry decorator, and Part 8 applies it to real HTTP calls.

## The Walrus Operator

`:=` assigns a value inside an expression (Python 3.8 and later). It shortens the common "compute, then test" pattern, for example matching a regular expression and using the match:

```terminal
{
  "title": "assign inside a condition",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import re\n>>> line = \"GET /api/orders 503 0.412\"\n>>> if (m := re.search(r\" (\\d{3}) \", line)) and m.group(1).startswith(\"5\"):\n...     print(f\"server error {m.group(1)}\")\n...\nserver error 503\n>>> exit()"
    }
  ]
}
```

Use it where it makes the code shorter _and_ clearer; a plain assignment on the line before is often easier to read.

## Common Mistakes

- **`if status == 500 or 503:`** is always true. Use `status in (500, 503)`.
- **`value or default` when 0, `""` or `[]` are valid values.** Test `is None` instead.
- **A `while` loop without a deadline or a sleep.** It can hang a deployment forever or spin a CPU at 100%.
- **Measuring timeouts with `time.time()`.** The wall clock can jump; use `time.monotonic()`.
- **Changing a list while looping over it.** Removing items shifts the rest, so the loop skips some:

```terminal
{
  "title": "do not remove while iterating",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> hosts = [\"web-01\", \"web-02\", \"db-01\", \"db-02\"]\n>>> for host in hosts:\n...     if host.startswith(\"db-\"):\n...         hosts.remove(host)\n...\n>>> hosts\n['web-01', 'web-02', 'db-02']\n>>> hosts = [\"web-01\", \"web-02\", \"db-01\", \"db-02\"]\n>>> [host for host in hosts if not host.startswith(\"db-\")]\n['web-01', 'web-02']\n>>> exit()"
    }
  ]
}
```

Build a new list instead (the last line is a _list comprehension_, covered in [Part 5](/guides/introduction-to-python/05-data-structures)), or loop over a copy with `for host in list(hosts):`.

- **Retrying errors that cannot succeed**, such as a 400 or 404, or retrying a request that is not safe to repeat.

## Summary

- `if`, `elif` and `else` choose a block; indentation defines the blocks.
- `and` and `or` short-circuit and return one of their operands; `x or default` treats 0 and empty values as missing.
- `match` compares a value against patterns and extracts parts of lists and dictionaries; put specific cases first.
- `for` loops over any sequence; `enumerate`, `zip(strict=True)` and `range` cover counters, parallel lists and batches; `for ... else` runs when no `break` happened.
- Wait loops need a deadline, a sleep, `time.monotonic()` and backoff with jitter.

Next: [Functions](/guides/introduction-to-python/04-functions), where these loops become reusable functions with type hints, and the retry logic becomes a decorator.

## Keep Learning

- [Designing rate limiting for APIs](/posts/designing-rate-limiting-for-apis): what the server side of a 429 looks like.
- [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) on the AWS Architecture Blog, where the "full jitter" strategy comes from.
- [How to sleep for milliseconds](/posts/sleep-for-milliseconds) in Bash and Linux, for the shell side of wait loops.
