---
title: 'Python Variables and Data Types: Numbers, Strings, bytes and None'
description: 'Python variables and types for scripts: int and float traps, string methods and f-strings, bytes vs str, truthiness, and reading settings from env vars.'
order: 2
---

Every script you write moves data around: a port number from an environment variable, a host name from a file, a JSON field from an API, the output of a command. Before you can do anything clever with that data, you need to know what kind of value you have, because Python treats the number `8080` and the text `"8080"` very differently.

This part covers variables and the built-in types you use every day: integers and floats (and their traps), strings and f-strings, `bytes`, booleans and `None`. It ends with a script that reads a service's settings from environment variables, which is how containers and CI jobs pass configuration to your code.

## Prerequisites

- The `~/pyops` project from [Part 1](/guides/introduction-to-python/01-getting-started), with its virtual environment active: `cd ~/pyops && source .venv/bin/activate`.

## Variables Are Names for Values

A variable is a name that points to a value. You create it by assigning with `=`; there is no declaration and no type to write down:

```terminal
{
  "title": "names and types",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> replicas = 3\n>>> service = \"api\"\n>>> type(replicas), type(service)\n(<class 'int'>, <class 'str'>)\n>>> replicas = replicas + 1\n>>> replicas\n4\n>>> service + 1\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    service + 1\n    ~~~~~~~~^~~\nTypeError: can only concatenate str (not \"int\") to str\n>>> exit()"
    }
  ]
}
```

Two things to notice:

- **The value has a type, the name does not.** `replicas` could point to a string later. Python is _dynamically typed_.
- **Python does not convert types for you.** `"api" + 1` is an error, not `"api1"` or `1`. Python is _strongly typed_. The last line of the traceback names the problem, and [Part 8](/guides/introduction-to-python/08-error-handling) shows how to read the rest.

Names may contain letters, digits and underscores, cannot start with a digit, and are case-sensitive. The convention is `snake_case` for variables and functions, and `UPPER_CASE` for values that should not change, such as `DEFAULT_PORT = 8080`. Python does not enforce that last rule; it is a signal to the reader.

A few assignment forms you will see constantly:

```terminal
{
  "title": "assignment forms",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> host, port = \"db-01\", 5432\n>>> host, port\n('db-01', 5432)\n>>> retries = 0\n>>> retries += 1\n>>> retries\n1\n>>> a, b = 1, 2\n>>> a, b = b, a\n>>> a, b\n(2, 1)\n>>> exit()"
    }
  ]
}
```

`host, port = ...` is **unpacking**: the values on the right go into the names on the left in order. It is how functions return several values, and how you swap two variables without a temporary one.

## Numbers: int and float

Python has two number types you will use: `int` for whole numbers and `float` for numbers with a decimal point. Integers have no size limit, so byte counts and IDs never overflow:

```terminal
{
  "title": "arithmetic",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> 10 / 4\n2.5\n>>> 10 // 4\n2\n>>> 10 % 4\n2\n>>> 2 ** 64\n18446744073709551616\n>>> 1_500_000 * 8\n12000000\n>>> int(\"755\", 8)\n493\n>>> oct(0o640)\n'0o640'\n>>> int(\"ff\", 16)\n255\n>>> exit()"
    }
  ]
}
```

`/` always gives a float, `//` divides and rounds down, `%` gives the remainder, and `**` is a power. Underscores in a number literal are only for readability. `int(text, base)` parses other bases, which helps with file modes (`0o640`) and hexadecimal IDs.

Floats are binary fractions, so most decimal numbers are stored as a close approximation. That causes the most common surprise in the language:

```terminal
{
  "title": "float traps",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> 0.1 + 0.2\n0.30000000000000004\n>>> 0.1 + 0.2 == 0.3\nFalse\n>>> import math\n>>> math.isclose(0.1 + 0.2, 0.3)\nTrue\n>>> round(2.5), round(3.5)\n(2, 4)\n>>> from decimal import Decimal\n>>> Decimal(\"0.10\") * 3\nDecimal('0.30')\n>>> exit()"
    }
  ]
}
```

- Never compare floats with `==`. Use `math.isclose()`, or compare with a tolerance.
- `round()` rounds halves to the nearest even number (banker's rounding), so `round(2.5)` is `2`. When you format a number for display, use an f-string format such as `f"{value:.1f}"` instead.
- For money, use `decimal.Decimal` built from a string, not a float.

## Strings

A string (`str`) is text. Single and double quotes are the same; triple quotes allow several lines. Strings are **immutable**: every method returns a new string and leaves the original alone. These are the methods that do most of the work when you parse command output, file names and host names:

```terminal
{
  "title": "string methods",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> line = \"  web-01.prod.example.com  \"\n>>> host = line.strip()\n>>> host\n'web-01.prod.example.com'\n>>> host.split(\".\")\n['web-01', 'prod', 'example', 'com']\n>>> host.split(\".\", 1)\n['web-01', 'prod.example.com']\n>>> name, _, domain = host.partition(\".\")\n>>> name, domain\n('web-01', 'prod.example.com')\n>>> host.startswith(\"web-\"), host.endswith(\".com\")\n(True, True)\n>>> host.removesuffix(\".example.com\")\n'web-01.prod'\n>>> \"prod\" in host\nTrue\n>>> host.upper()\n'WEB-01.PROD.EXAMPLE.COM'\n>>> \",\".join([\"web-01\", \"web-02\", \"db-01\"])\n'web-01,web-02,db-01'\n>>> host[:6], host[-3:]\n('web-01', 'com')\n>>> exit()"
    }
  ]
}
```

- `strip()` removes whitespace (including the newline at the end of a line read from a file or a command).
- `split()` with no argument splits on any run of whitespace, which is what you want for columns of command output; `split(",")` splits on exactly that separator.
- `removeprefix()` and `removesuffix()` (Python 3.9 and later) remove a fixed string. Do not use `strip(".example.com")` for that: `strip` removes any of those _characters_ from both ends.
- `[start:end]` takes a **slice**. Indexes start at 0, the end is not included, and negative numbers count from the end.

### f-strings

An **f-string** (a string with `f` in front) puts the value of any expression between `{}` into the text. After a colon you can add a format: width, alignment, decimals, thousands separators, percentages:

```python
service = "checkout"
cpu = 7.25
mem_bytes = 1_610_612_736
error_rate = 0.0042
replicas = 3

print(f"{'SERVICE':<10}|{'CPU':>7}|{'MEMORY':>12}|{'ERRORS':>7}")
print(f"{service:<10}|{cpu:>6.1f}%|{mem_bytes / 2**20:>8,.0f} MiB|{error_rate:>7.2%}")
print(f"{replicas=} {service!r}")
print(f"{service.upper()} has {replicas * 2} pods after scaling")
```

```terminal
{
  "title": "f-string formats",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python report_line.py",
      "output": "SERVICE   |    CPU|      MEMORY| ERRORS\ncheckout  |   7.2%|   1,536 MiB|  0.42%\nreplicas=3 'checkout'\nCHECKOUT has 6 pods after scaling"
    }
  ]
}
```

`<10` left-aligns in a column 10 characters wide, `>6.1f` right-aligns with one decimal, `,` adds thousands separators and `.2%` multiplies by 100 and adds a percent sign. Notice that `7.25` printed as `7.2`: like `round()`, formatting rounds an exact half to the even digit. `{replicas=}` prints the expression and its value, which is handy for quick debugging, and `!r` shows the value as Python would write it (with quotes for a string).

You will still meet the older styles in existing code: `"%s:%d" % (host, port)` and `"{}:{}".format(host, port)`. Both work. Use f-strings in new code, with one exception: the `logging` module expects `%` style (Part 8 explains why).

Python 3.14 adds **template strings**, written with `t` instead of `f`. A t-string does not produce text; it produces a `Template` object that keeps the literal parts and the values apart, so a library can escape the values before it builds SQL, HTML or a shell command:

```terminal
{
  "title": "a t-string (Python 3.14)",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> user_input = \"web-01; rm -rf /\"\n>>> template = t\"ping -c 1 {user_input}\"\n>>> type(template)\n<class 'string.templatelib.Template'>\n>>> template.strings, template.values\n(('ping -c 1 ', ''), ('web-01; rm -rf /',))\n>>> exit()"
    }
  ]
}
```

You will rarely write t-strings yourself until the libraries you use accept them. Know that they exist and that they are not a safer f-string on their own: the safety comes from the code that processes the template.

## bytes Versus str

`str` holds text (Unicode characters); `bytes` holds raw bytes. Files, sockets and processes deal in bytes, and you convert at the edges: `.decode()` turns bytes into text and `.encode()` turns text into bytes, both using UTF-8 unless you say otherwise. You meet `bytes` as soon as you decode a Kubernetes Secret or read a command's output without `text=True`:

```terminal
{
  "title": "bytes and str",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import base64\n>>> encoded = \"cGFzc3dvcmQxMjM=\"\n>>> raw = base64.b64decode(encoded)\n>>> raw\nb'password123'\n>>> raw.decode()\n'password123'\n>>> \"café\".encode()\nb'caf\\xc3\\xa9'\n>>> len(\"café\"), len(\"café\".encode())\n(4, 5)\n>>> b\"200 OK\" + \" body\"\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    b\"200 OK\" + \" body\"\n    ~~~~~~~~~~^~~~~~~~~\nTypeError: can't concat str to bytes\n>>> exit()"
    }
  ]
}
```

A `b` before the quotes marks a bytes value. `len()` counts characters for a `str` but bytes for `bytes`, which matters when a protocol or a database column limits the size in bytes. Mixing the two is an error, just like mixing strings and numbers.

## Booleans, None and Truthiness

`True` and `False` are the two booleans, and `None` means "no value": a function that returns nothing returns `None`, and it is the usual default for an optional setting. Check for it with `is None`, not `== None`.

In an `if` or `while`, every value counts as true or false. Zero, empty strings, empty collections and `None` are false; almost everything else is true. That includes some strings you might expect to be false:

```terminal
{
  "title": "truthiness",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> bool(0), bool(\"\"), bool([]), bool({}), bool(None)\n(False, False, False, False, False)\n>>> bool(\"0\"), bool(\"false\"), bool(\"no\"), bool(\" \")\n(True, True, True, True)\n>>> setting = None\n>>> setting is None\nTrue\n>>> exit()"
    }
  ]
}
```

`bool("false")` is `True`, because it is a non-empty string. This is the trap the next section avoids.

## Read Settings from Environment Variables

Containers, systemd units and CI jobs pass configuration through environment variables, and `os.environ` gives you all of them as **strings**. Convert each value to the type you need, and give every setting a default:

```python
"""Read a service's settings from environment variables."""

import os

service = os.environ.get("APP_NAME", "api")
port = int(os.environ.get("APP_PORT", "8080"))
workers = int(os.environ.get("APP_WORKERS", "4"))
timeout = float(os.environ.get("APP_TIMEOUT", "2.5"))
debug_raw = os.environ.get("APP_DEBUG", "false")
debug = debug_raw.strip().lower() in ("1", "true", "yes", "on")
memory_mib = workers * 256

print(f"{service} listens on port {port} with {workers} workers")
print(f"timeout={timeout}s debug={debug} memory={memory_mib:,} MiB")
print(f"(bool({debug_raw!r}) would have been {bool(debug_raw)})")
```

`os.environ.get(name, default)` returns the default when the variable is not set; `os.environ[name]` raises an error instead, which is right for settings that have no sensible default, such as a database password. Run it with the defaults, then the way a container would run it:

```terminal
{
  "title": "settings from the environment",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python env_config.py",
      "output": "api listens on port 8080 with 4 workers\ntimeout=2.5s debug=False memory=1,024 MiB\n(bool('false') would have been True)"
    },
    {
      "cmd": "APP_NAME=checkout APP_PORT=8443 APP_WORKERS=16 APP_DEBUG=False python env_config.py",
      "output": "checkout listens on port 8443 with 16 workers\ntimeout=2.5s debug=False memory=4,096 MiB\n(bool('False') would have been True)"
    },
    {
      "comment": "a typo in a value stops the script",
      "cmd": "APP_PORT=80a python env_config.py",
      "output": "Traceback (most recent call last):\n  File \"/home/dev/pyops/env_config.py\", line 6, in <module>\n    port = int(os.environ.get(\"APP_PORT\", \"8080\"))\nValueError: invalid literal for int() with base 10: '80a'"
    }
  ]
}
```

`int("80a")` raises a `ValueError` and the script stops before it does anything with a wrong port. That is the behaviour you want; [Part 3](/guides/introduction-to-python/03-control-flow) adds range checks, and Part 8 turns the traceback into a one-line error message.

`int()` and `float()` accept surrounding whitespace and a newline (`int(" 42\n")` is `42`), so values read from files and commands convert cleanly after you read them. `int()` rejects everything else, including `"8080.0"`. `float()` is more forgiving than you might like: it also accepts `"nan"` and `"inf"`, so check the range after converting (Part 3 shows how; `math.isfinite()` rejects both).

## Type Hints

You can write the expected type after a name. These **type hints** document your intent and let tools check your code before it runs, but Python itself ignores them at runtime:

```terminal
{
  "title": "hints are not checks",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> port: int = 8080\n>>> port = \"8080\"\n>>> port\n'8080'\n>>> exit()"
    }
  ]
}
```

Nothing stopped the string. A type checker such as mypy would report that line, and Part 4 runs one. This guide uses hints on functions from Part 4 on, because they catch real bugs and make code easier to read.

## Common Mistakes

- **Comparing with `is` instead of `==`.** `is` checks whether two names point to the _same object_; `==` checks whether the values are equal. Use `is` only for `None`, `True` and `False`. Python warns when you get it wrong with a literal:

```terminal
{
  "title": "is versus ==",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -c 'status = \"ok\"; print(status is \"ok\")'",
      "output": "<string>:1: SyntaxWarning: \"is\" with 'str' literal. Did you mean \"==\"?\nTrue"
    }
  ]
}
```

- **`bool()` on a string from the environment or a file.** Compare against a list of accepted values instead.
- **Forgetting that `input()`, `os.environ` and file reads return strings.** Convert with `int()` or `float()` before you do arithmetic.
- **Comparing floats with `==`**, and using floats for money.
- **`strip()` to remove a suffix.** Use `removesuffix()`.
- **Shadowing built-in names** such as `list`, `dict`, `str`, `type`, `id` or `input` with your own variables. The built-in stops working for the rest of the scope.

## Summary

- A variable is a name for a value; values have types, and Python does not convert between them for you.
- `int` has no size limit; `float` is approximate, so use `math.isclose()` and `Decimal` where it matters.
- String methods (`strip`, `split`, `partition`, `removesuffix`, `join`) and f-strings with format specs cover most text handling in scripts.
- `bytes` is raw data; `.decode()` and `.encode()` convert at the edges of your program.
- Empty values, zero and `None` are false; `bool("false")` is true.
- Environment variables are strings: convert them, default them, and fail early on bad values.

Next: [Control Flow](/guides/introduction-to-python/03-control-flow), where you validate those settings, match on HTTP status codes and write a retry loop that waits for a service to come up.

## Keep Learning

- [Why Python open() does not create a file if it does not exist](/posts/python-open-does-not-create-file), a first look at file modes before Part 7.
- [How to decode a Kubernetes Secret](/posts/how-to-decode-a-kubernetes-secret): the same base64 step from the command line.
