---
title: 'Python Functions: Arguments, Type Hints, Generators and Decorators'
description: 'Write Python functions for ops scripts: keyword-only arguments, type hints checked by mypy, the mutable default trap, generators and a retry decorator.'
order: 4
---

The scripts in Part 3 work, but each one is a single block of code. As soon as you want the same check in two places, or a test for one piece, you need **functions**: named, reusable blocks that take inputs and return a result. Functions are also where Python's type hints pay off, because a checker can verify every call against the definition.

This part covers defining and calling functions, the kinds of parameters, return values, type hints and a real run of the mypy type checker, scope, functions as values, generators for batching work, recursion over nested configuration, and decorators, ending with a retry decorator you will reuse later in the guide.

## Prerequisites

- The `~/pyops` project from [Part 1](/guides/introduction-to-python/01-getting-started), with its virtual environment active.
- Loops and `match` from [Part 3](/guides/introduction-to-python/03-control-flow).

## Define and Call a Function

`def` names a function and lists its **parameters**. The indented body runs each time you call the function, and `return` sends a value back to the caller. A string right after the `def` line is the **docstring**: it documents the function, and tools and `help()` show it.

```python
"""Parse durations such as 90s, 15m, 2h and 1d."""

UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def parse_duration(text: str) -> int:
    """Return the number of seconds in a duration such as '15m' or '2h'."""
    number, unit = text[:-1], text[-1:]
    if unit not in UNITS or not number.isdigit():
        raise ValueError(f"bad duration {text!r}, use a number and one of s, m, h, d")
    return int(number) * UNITS[unit]


def format_duration(seconds: int) -> str:
    """Return a short human form: 5400 -> '1h30m'."""
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    text = ""
    if hours:
        text += f"{hours}h"
    if minutes:
        text += f"{minutes}m"
    if secs or not text:
        text += f"{secs}s"
    return text


if __name__ == "__main__":
    for value in ["90s", "15m", "2h", "1d"]:
        seconds = parse_duration(value)
        print(f"{value:>4} = {seconds:>6} s = {format_duration(seconds)}")
    print(parse_duration("1w"))
```

```terminal
{
  "title": "call the functions",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python durations.py",
      "output": " 90s =     90 s = 1m30s\n 15m =    900 s = 15m\n  2h =   7200 s = 2h\n  1d =  86400 s = 24h\nTraceback (most recent call last):\n  File \"/home/dev/pyops/durations.py\", line 32, in <module>\n    print(parse_duration(\"1w\"))\n          ~~~~~~~~~~~~~~^^^^^^\n  File \"/home/dev/pyops/durations.py\", line 10, in parse_duration\n    raise ValueError(f\"bad duration {text!r}, use a number and one of s, m, h, d\")\nValueError: bad duration '1w', use a number and one of s, m, h, d"
    }
  ]
}
```

`raise ValueError(...)` stops the function and reports the problem to the caller, who can handle it (Part 8 shows how). That is better than returning a special value such as `-1`, which a caller can forget to check. `divmod(a, b)` returns the quotient and the remainder at once, and the `if __name__ == "__main__":` block runs only when you run the file directly, not when another file imports it ([Part 6](/guides/introduction-to-python/06-modules-and-packages) explains why that matters).

A function without a `return` (or with a bare `return`) returns `None`. Forgetting the `return` is a common bug, and the result is a confusing error somewhere else:

```terminal
{
  "title": "a missing return",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> def disk_free_percent(free, total):\n...     percent = free / total * 100\n...\n>>> result = disk_free_percent(20, 80)\n>>> print(result)\nNone\n>>> result > 10\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    result > 10\nTypeError: '>' not supported between instances of 'NoneType' and 'int'\n>>> exit()"
    }
  ]
}
```

## Parameters and Arguments

When you call a function you can pass arguments by position or by name. A parameter with a **default value** is optional. Parameters after a bare `*` are **keyword-only**: callers must name them, which keeps calls readable when a function has several options of the same type:

```python
"""Build an ssh command line as a list of arguments."""


def ssh_command(
    host: str,
    command: str,
    *,
    user: str = "deploy",
    port: int = 22,
    connect_timeout: int = 10,
) -> list[str]:
    """Return the argument list for running command on host over SSH."""
    return [
        "ssh",
        "-p", str(port),
        "-o", f"ConnectTimeout={connect_timeout}",
        "-o", "BatchMode=yes",
        f"{user}@{host}",
        command,
    ]


print(ssh_command("web-01", "uptime"))
print(ssh_command("web-02", "df -h /", user="admin", port=2222))
options = {"user": "ops", "connect_timeout": 3}
print(ssh_command("db-01", "systemctl is-active postgresql", **options))
print(ssh_command("web-01", "uptime", "admin"))
```

```terminal
{
  "title": "positional, keyword and keyword-only",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python sshcmd.py",
      "output": "['ssh', '-p', '22', '-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes', 'deploy@web-01', 'uptime']\n['ssh', '-p', '2222', '-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes', 'admin@web-02', 'df -h /']\n['ssh', '-p', '22', '-o', 'ConnectTimeout=3', '-o', 'BatchMode=yes', 'ops@db-01', 'systemctl is-active postgresql']\nTraceback (most recent call last):\n  File \"/home/dev/pyops/sshcmd.py\", line 27, in <module>\n    print(ssh_command(\"web-01\", \"uptime\", \"admin\"))\n          ~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nTypeError: ssh_command() takes 2 positional arguments but 3 were given"
    }
  ]
}
```

The last call fails on purpose: `"admin"` cannot be passed by position, so nobody can mix up the user and, say, the port. `**options` unpacks a dictionary into keyword arguments, and `*items` unpacks a list into positional ones. Returning the command as a **list** rather than one string is deliberate; Part 8 passes such lists to `subprocess.run` without a shell, which avoids quoting bugs and injection on your machine. It does not protect the remote side: `ssh` joins its command arguments into one string that the remote user's shell interprets, so `command` must come from you, or every untrusted part of it must be quoted with `shlex.quote()`.

Functions can also accept any number of arguments. `*args` collects extra positional arguments into a tuple and `**kwargs` collects extra keyword arguments into a dictionary. A small structured logger shows both:

```terminal
{
  "title": "*args and **kwargs",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> def log(event, *tags, **fields):\n...     pairs = \" \".join(f\"{key}={value}\" for key, value in fields.items())\n...     print(f\"event={event} tags={','.join(tags) or '-'} {pairs}\")\n...\n>>> log(\"deploy.start\", \"prod\", \"web\", version=\"1.4.2\", replicas=3)\nevent=deploy.start tags=prod,web version=1.4.2 replicas=3\n>>> log(\"deploy.done\", duration_s=41.7)\nevent=deploy.done tags=- duration_s=41.7\n>>> exit()"
    }
  ]
}
```

## Return Several Values

`return a, b` returns a tuple, and the caller unpacks it:

```terminal
{
  "title": "return a tuple",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> def split_image(image):\n...     name, _, tag = image.rpartition(\":\")\n...     if not name or \"/\" in tag:\n...         return image, \"latest\"\n...     return name, tag\n...\n>>> split_image(\"ghcr.io/acme/api:1.4.2\")\n('ghcr.io/acme/api', '1.4.2')\n>>> split_image(\"nginx\")\n('nginx', 'latest')\n>>> repo, tag = split_image(\"localhost:5000/tools\")\n>>> repo, tag\n('localhost:5000/tools', 'latest')\n>>> exit()"
    }
  ]
}
```

The last example shows why the function checks for `/` in the tag: in `localhost:5000/tools`, the colon belongs to the registry's port, not to a tag.

## Type Hints and mypy

The hints in `parse_duration(text: str) -> int` say that the function takes a string and returns an integer. Python does not check them at runtime, but a type checker reads them and checks every call before the code runs. The most common hints are:

| Hint                 | Meaning                                    |
| -------------------- | ------------------------------------------ |
| `int`, `str`, `bool` | That type                                  |
| `list[str]`          | A list of strings                          |
| `dict[str, int]`     | A dictionary from strings to integers      |
| `tuple[str, int]`    | A pair: a string, then an integer          |
| `str \| None`        | A string or `None` (Python 3.10 and later) |
| `-> None`            | The function returns nothing               |

Here is a script with two bugs that Python only finds when the bad line runs, if ever:

```python
from durations import parse_duration


def find_port(services: dict[str, int], name: str) -> int | None:
    """Return the port of a service, or None if it is unknown."""
    return services.get(name)


ports = {"api": 8080, "metrics": 9090}
timeout = parse_duration(90)
port = find_port(ports, "api")
print(f"api on {port + 1}")
```

[mypy](https://mypy-lang.org/) is the reference type checker. `uvx` (part of uv) runs a tool in a temporary environment without installing it into your project:

```terminal
{
  "title": "mypy finds the bugs",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uvx mypy typed.py",
      "output": "Installed 6 packages in 75ms\ntyped.py:10: error: Argument 1 to \"parse_duration\" has incompatible type \"int\"; expected \"str\"  [arg-type]\ntyped.py:12: error: Unsupported operand types for + (\"None\" and \"int\")  [operator]\ntyped.py:12: note: Left operand is of type \"int | None\"\nFound 2 errors in 1 file (checked 1 source file)"
    }
  ]
}
```

The first error is a wrong argument type. The second is subtler: `find_port` can return `None`, and `None + 1` would crash. The fix is to handle that case (`if port is None: ...`), after which mypy knows `port` is an `int`. You will run mypy on the whole project in [Part 10](/guides/introduction-to-python/10-building-a-python-project). Other checkers that read the same hints are Pyright (used by VS Code's Pylance) and Astral's newer `ty`, which is still in beta.

## The Mutable Default Argument Trap

Default values are created **once**, when Python runs the `def` line, not on every call. With an immutable default (a number, a string, `None`) that never matters. With a list or dictionary it does, because every call shares the same object:

```terminal
{
  "title": "a shared default list",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> def add_tag(tag, tags=[]):\n...     tags.append(tag)\n...     return tags\n...\n>>> add_tag(\"web\")\n['web']\n>>> add_tag(\"db\")\n['web', 'db']\n>>> def add_tag(tag, tags=None):\n...     if tags is None:\n...         tags = []\n...     tags.append(tag)\n...     return tags\n...\n>>> add_tag(\"web\")\n['web']\n>>> add_tag(\"db\")\n['db']\n>>> exit()"
    }
  ]
}
```

Use `None` as the default and create the list inside the function. Linters such as Ruff flag the mistake (rule `B006`).

## Scope: Where Names Live

Names assigned inside a function are **local**: they exist only during the call and do not affect names outside. A function can read names from the module around it, but assigning to one creates a new local name instead, unless you declare it `global`. Avoid `global` in real code; pass values in and return results, which also makes the function testable.

```terminal
{
  "title": "local and global names",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> environment = \"staging\"\n>>> def describe():\n...     return f\"deploying to {environment}\"\n...\n>>> describe()\n'deploying to staging'\n>>> def switch():\n...     environment = \"prod\"\n...     return environment\n...\n>>> switch(), environment\n('prod', 'staging')\n>>> exit()"
    }
  ]
}
```

A function defined inside another function can read the outer function's variables, even after the outer function has returned. Such a function is a **closure**, and it is how decorators (below) keep their settings. Use `nonlocal` when the inner function must also assign to the outer variable.

## Functions Are Values

A function is an object like any other: you can store it in a variable, put it in a list or pass it to another function. Many built-ins take a function as the `key` that decides how to compare items. A **lambda** is a short, unnamed function written in one expression:

```terminal
{
  "title": "functions as arguments",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> disks = [(\"web-01\", 91.5), (\"db-01\", 62.0), (\"web-02\", 97.2)]\n>>> sorted(disks, key=lambda disk: disk[1], reverse=True)\n[('web-02', 97.2), ('web-01', 91.5), ('db-01', 62.0)]\n>>> max(disks, key=lambda disk: disk[1])\n('web-02', 97.2)\n>>> def is_critical(disk):\n...     return disk[1] >= 95\n...\n>>> list(filter(is_critical, disks))\n[('web-02', 97.2)]\n>>> exit()"
    }
  ]
}
```

Note `key=is_critical` versus `key=is_critical()`: you pass the function itself, and the other function calls it.

## Generators: Produce Values One at a Time

A function that uses `yield` instead of `return` is a **generator**. Calling it returns an iterator that runs the body only as far as the next `yield` each time a loop asks for a value. That makes generators ideal for splitting work into batches and for reading large files, because nothing is computed (or loaded into memory) before it is needed.

Here the batched rollout from Part 3 becomes three small functions. `batches()` yields one batch at a time, and `rollout()` returns as soon as a host fails, which replaces the flag and the double `break`:

```python
"""Restart hosts in batches and stop at the first failed health check."""

from collections.abc import Callable, Iterator


def batches(items: list[str], size: int) -> Iterator[list[str]]:
    """Yield consecutive slices of items, each at most size long."""
    if size < 1:  # range() rejects 0, and a negative size would silently yield no batches
        raise ValueError(f"batch size must be at least 1, got {size}")
    for start in range(0, len(items), size):
        yield items[start : start + size]


def rollout(hosts: list[str], size: int, restart: Callable[[str], bool]) -> str | None:
    """Restart every host; return the first host that fails, or None."""
    for number, batch in enumerate(batches(hosts, size), start=1):
        print(f"batch {number}: {', '.join(batch)}")
        for host in batch:
            if not restart(host):
                return host
            print(f"  {host}: healthy")
    return None


def fake_restart(host: str) -> bool:
    return host != "web-03"


if __name__ == "__main__":
    hosts = ["web-01", "web-02", "web-03", "web-04", "web-05"]
    failed = rollout(hosts, 2, fake_restart)
    print(f"rollout stopped at {failed}" if failed else "rollout complete")
    print(list(batches(hosts, 3)))
```

```terminal
{
  "title": "the rollout as functions",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python rollout.py",
      "output": "batch 1: web-01, web-02\n  web-01: healthy\n  web-02: healthy\nbatch 2: web-03, web-04\nrollout stopped at web-03\n[['web-01', 'web-02', 'web-03'], ['web-04', 'web-05']]"
    }
  ]
}
```

`Callable[[str], bool]` is the type hint for "a function that takes a string and returns a bool". Because `rollout()` receives the restart function as an argument, a test can pass a fake one, as this script does, and the real script can pass one that calls SSH or an API.

## Recursion: Walk Nested Configuration

A **recursive** function calls itself on a smaller piece of the problem. Nested configuration, such as a Helm values file or a JSON document, is the classic case. This function flattens it into dotted keys and then into environment variable names:

```python
"""Flatten nested settings into dotted keys and environment variable names."""


def flatten(config: dict[str, object], prefix: str = "") -> dict[str, object]:
    flat: dict[str, object] = {}
    for key, value in config.items():
        name = f"{prefix}{key}"
        if isinstance(value, dict):
            flat.update(flatten(value, f"{name}."))
        else:
            flat[name] = value
    return flat


settings = {
    "app": {"name": "checkout", "port": 8080},
    "db": {"host": "db-01", "pool": {"min": 2, "max": 10}},
    "debug": False,
}
for key, value in flatten(settings).items():
    env_name = key.upper().replace(".", "_")
    print(f"{key:<12} {env_name:<12} {value}")
```

```terminal
{
  "title": "recursive flatten",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python flatten.py",
      "output": "app.name     APP_NAME     checkout\napp.port     APP_PORT     8080\ndb.host      DB_HOST      db-01\ndb.pool.min  DB_POOL_MIN  2\ndb.pool.max  DB_POOL_MAX  10\ndebug        DEBUG        False"
    }
  ]
}
```

Each call handles one level and hands nested dictionaries to a new call with a longer prefix. Python limits recursion depth (1,000 calls by default), which is plenty for configuration but not for walking a huge structure; use a loop with your own stack for that.

## Decorators: Wrap a Function

A **decorator** is a function that takes a function and returns a new one that adds behaviour around it: timing, logging, caching, retries. Writing `@retry(...)` above a `def` is shorthand for `fetch = retry(...)(fetch)`.

Here is a retry decorator with exponential backoff, the loop from Part 3 made reusable. It retries only the exception types you list, and it re-raises the last error when it runs out of attempts:

```python
"""A retry decorator with exponential backoff."""

import functools
import time
from collections.abc import Callable


def retry[**P, R](
    attempts: int = 3,
    delay: float = 0.5,
    exceptions: tuple[type[Exception], ...] = (OSError,),
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Retry the decorated function when it raises one of the given exceptions."""

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            for attempt in range(1, attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as err:
                    wait = delay * 2 ** (attempt - 1)
                    print(f"{func.__name__}: {err} (attempt {attempt}/{attempts}), retrying in {wait:.1f}s")
                    time.sleep(wait)
            return func(*args, **kwargs)  # the last attempt: errors reach the caller

        return wrapper

    return decorator


calls = 0


@retry(attempts=4, delay=0.2, exceptions=(ConnectionError,))
def fetch_status(service: str) -> str:
    """Pretend to call an API that fails twice before it answers."""
    global calls
    calls += 1
    if calls < 3:
        raise ConnectionError(f"{service} refused the connection")
    return f"{service}: ok after {calls} calls"


if __name__ == "__main__":
    print(fetch_status("payments"))
    print(fetch_status.__name__, "-", fetch_status.__doc__)
```

```terminal
{
  "title": "a retry decorator",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python retrying.py",
      "output": "fetch_status: payments refused the connection (attempt 1/4), retrying in 0.2s\nfetch_status: payments refused the connection (attempt 2/4), retrying in 0.4s\npayments: ok after 3 calls\nfetch_status - Pretend to call an API that fails twice before it answers."
    }
  ]
}
```

How it fits together:

- `retry(attempts=4, ...)` runs first and returns `decorator`, a closure that remembers the settings.
- `decorator(fetch_status)` returns `wrapper`, which replaces the original function.
- `functools.wraps` copies the name, docstring and other metadata onto `wrapper`, so `fetch_status.__name__`, `help()` and anything that prints the function's name still show `fetch_status`.
- `def retry[**P, R](...)` declares type parameters (Python 3.12 syntax): `P` stands for the wrapped function's parameters and `R` for its return type, so a type checker knows that the decorated function still takes a `str` and returns a `str`.

The `global calls` counter is only there to fake a flaky service; [Part 8](/guides/introduction-to-python/08-error-handling) uses the same decorator idea on real HTTP requests against a test server. For production code, the [tenacity](https://pypi.org/project/tenacity/) library offers the same thing with more options (jitter, stop after a total time, retry on results).

The standard library has a few decorators you will use as is: `@functools.cache` remembers results of a function for each set of arguments (good for expensive, pure lookups), `@property` and `@dataclass` appear in [Part 9](/guides/introduction-to-python/09-object-oriented), and `@contextlib.contextmanager` in Part 8.

## Common Mistakes

- **Forgetting `return`.** The function returns `None`, and the error shows up somewhere else.
- **A list or dictionary as a default value.** Use `None` and create it inside.
- **Passing `func()` where a function is expected** (`key=len()` instead of `key=len`).
- **Returning special values for errors** (`-1`, `""`, `False`). Raise an exception instead.
- **Many positional parameters of the same type.** Make the options keyword-only with `*`, or group them in a dataclass (Part 9).
- **Changing global variables from functions.** Pass values in and return results.
- **A decorator without `functools.wraps`.** Every decorated function then reports its name as `wrapper` and loses its docstring.

## Summary

- `def` defines a function; `return` sends back a value, and a function without one returns `None`.
- Parameters can be positional, keyword, defaulted, keyword-only (after `*`), or collected with `*args` and `**kwargs`.
- Type hints document intent; mypy checks them before the code runs, and `uvx mypy` runs it without installing anything.
- Defaults are created once: never use a mutable default.
- Generators (`yield`) produce values lazily; they are the natural way to batch work and read big inputs.
- Decorators wrap functions; a retry decorator with backoff is one you will reuse.

Next: [Data Structures](/guides/introduction-to-python/05-data-structures), where you work with lists, dictionaries and sets of hosts and find drift between what should run and what does.

## Keep Learning

- [What is the quickest way to HTTP GET in Python?](/posts/what-is-the-quickest-way-to-http-get-in-python), a preview of the HTTP clients in Part 8.
- The [mypy documentation](https://mypy.readthedocs.io/) and its cheat sheet of type hints.
