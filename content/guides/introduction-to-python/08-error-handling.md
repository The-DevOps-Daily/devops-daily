---
title: 'Python Error Handling: Exceptions, Logging, subprocess and HTTP Retries'
description: 'Python exceptions and tracebacks, logging, exit codes and SIGTERM, safe subprocess calls, and HTTP APIs with timeouts and retries, with real output.'
order: 8
---

Operations code runs where things fail: a file is missing, a disk is full, a service times out, a command exits with an error, someone presses Ctrl+C or Kubernetes sends `SIGTERM`. What separates a reliable script from a fragile one is what happens then. Does it stop with a clear message and the right exit code, retry what is worth retrying, clean up after itself, and leave a log that explains what happened?

This part covers reading tracebacks, catching and raising exceptions, your own exception types, context managers, the `logging` module, exit codes and signals, running commands with `subprocess`, and calling HTTP APIs with timeouts, retries and a token from the environment, all against a small test server you run locally.

## Prerequisites

- The `~/pyops` project from [Part 6](/guides/introduction-to-python/06-modules-and-packages), with httpx installed (`uv add httpx`) and the virtual environment active.
- Functions and the retry decorator from [Part 4](/guides/introduction-to-python/04-functions), and file handling from [Part 7](/guides/introduction-to-python/07-file-operations).

## Read a Traceback

When an exception is not handled, Python prints a **traceback** and exits with code 1. Read it from the bottom up: the last line is the exception type and message, and the lines above it show the chain of calls that led there, oldest first, with the failing line of each:

```json
{ "environments": { "staging": { "replicas": 2 } } }
```

```python
import json


def load_config(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def replicas_for(config, env):
    return config["environments"][env]["replicas"]


def main():
    config = load_config("deploy.json")
    print(replicas_for(config, "prod"))


main()
```

```terminal
{
  "title": "a traceback",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python replicas.py; echo \"exit code $?\"",
      "output": "Traceback (most recent call last):\n  File \"/home/dev/pyops/replicas.py\", line 18, in <module>\n    main()\n    ~~~~^^\n  File \"/home/dev/pyops/replicas.py\", line 15, in main\n    print(replicas_for(config, \"prod\"))\n          ~~~~~~~~~~~~^^^^^^^^^^^^^^^^\n  File \"/home/dev/pyops/replicas.py\", line 10, in replicas_for\n    return config[\"environments\"][env][\"replicas\"]\n           ~~~~~~~~~~~~~~~~~~~~~~^^^^^\nKeyError: 'prod'\nexit code 1"
    }
  ]
}
```

The bottom line says what went wrong (`KeyError: 'prod'`), and the frame above it shows where: line 10, in `replicas_for`, with markers under the exact expression that failed (Python 3.11 and later). The frames above show how the program got there. In a terminal, Python 3.13 and later also colour tracebacks; set `NO_COLOR=1` or `PYTHON_COLORS=0` to turn that off for log files.

## The Exceptions You Will Meet

Exceptions are classes arranged in a hierarchy, and an `except` clause catches the class you name _and all its subclasses_. These are the ones operations code meets most:

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "base", "label": "BaseException", "sub": "do not catch this", "icon": "box", "tone": "slate" }
    ],
    [
      { "id": "exit", "label": "SystemExit, KeyboardInterrupt", "sub": "sys.exit(), Ctrl+C", "icon": "activity", "tone": "red" },
      { "id": "exc", "label": "Exception", "sub": "everything else", "icon": "box", "tone": "blue" }
    ],
    [
      { "id": "value", "label": "ValueError", "sub": "int('80a'), JSONDecodeError", "icon": "gear", "tone": "violet" },
      { "id": "lookup", "label": "LookupError", "sub": "KeyError, IndexError", "icon": "database", "tone": "violet" },
      { "id": "os", "label": "OSError", "sub": "FileNotFoundError, PermissionError, ConnectionError, TimeoutError", "icon": "server", "tone": "amber" },
      { "id": "lib", "label": "Library errors", "sub": "CalledProcessError, httpx.HTTPError", "icon": "net", "tone": "green" }
    ]
  ],
  "edges": [
    ["base", "exit"],
    ["base", "exc"],
    ["exc", "value"],
    ["exc", "lookup"],
    ["exc", "os"],
    ["exc", "lib"]
  ]
}
```

`SystemExit` and `KeyboardInterrupt` derive from `BaseException`, not `Exception`, so that `except Exception:` does not swallow `sys.exit()` or Ctrl+C. File and socket errors, and the error for a program that cannot be started, are subclasses of `OSError`, each with an `errno` that says exactly what happened. A command that runs but fails raises `subprocess.CalledProcessError`, and one that runs too long `subprocess.TimeoutExpired`; both derive from `subprocess.SubprocessError`.

## Catch Exceptions with try and except

Put the code that can fail in a `try` block and handle each failure you expect in its own `except` clause. Catch the narrowest exception that describes the problem, and only where you can do something useful about it: use a default, add context, retry, or turn it into a clear message.

This function reads a port number from a file. A missing file means "use the default", but an unreadable file or a bad value is a real configuration error, which it reports as its own exception type:

```python
"""Read a port number from a file: read_port.py FILE"""

import sys
from pathlib import Path


class ConfigError(Exception):
    """The configuration is missing or invalid."""


def read_port(path: Path) -> int:
    try:
        text = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return 8080  # no file: use the default
    except PermissionError as err:
        raise ConfigError(f"cannot read {path}: permission denied") from err
    try:
        port = int(text)
    except ValueError as err:
        raise ConfigError(f"{path} must contain a port number, not {text!r}") from err
    if not 1 <= port <= 65535:
        raise ConfigError(f"{path}: port {port} is out of range")
    return port


def main() -> int:
    try:
        port = read_port(Path(sys.argv[1]))
    except ConfigError as err:
        print(f"error: {err}", file=sys.stderr)
        return 2
    print(f"using port {port}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

```terminal
{
  "title": "expected failures, clear messages",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python read_port.py port.txt",
      "output": "using port 8080"
    },
    {
      "cmd": "echo 8443 > port.txt && python read_port.py port.txt",
      "output": "using port 8443"
    },
    {
      "cmd": "echo 80a > port.txt && python read_port.py port.txt; echo \"exit code $?\"",
      "output": "error: port.txt must contain a port number, not '80a'\nexit code 2"
    },
    {
      "cmd": "chmod 000 port.txt && python read_port.py port.txt; echo \"exit code $?\"",
      "output": "error: cannot read port.txt: permission denied\nexit code 2"
    },
    {
      "comment": "make it readable again for the next example",
      "cmd": "chmod 644 port.txt"
    }
  ]
}
```

A few patterns in that file:

- **A custom exception type.** `ConfigError` is one line, but it lets `main()` catch exactly the problems it knows how to report and let everything else (a bug) surface with a full traceback.
- **`raise ... from err`** keeps the original exception attached as the cause. Uncaught, both appear in the traceback:

```terminal
{
  "title": "a chained exception",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> from pathlib import Path\n>>> from read_port import read_port\n>>> read_port(Path(\"port.txt\"))\nTraceback (most recent call last):\n  File \"/home/dev/pyops/read_port.py\", line 19, in read_port\n    port = int(text)\nValueError: invalid literal for int() with base 10: '80a'\n\nThe above exception was the direct cause of the following exception:\n\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    read_port(Path(\"port.txt\"))\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^\n  File \"/home/dev/pyops/read_port.py\", line 21, in read_port\n    raise ConfigError(f\"{path} must contain a port number, not {text!r}\") from err\nread_port.ConfigError: port.txt must contain a port number, not '80a'\n>>> exit()"
    }
  ]
}
```

- **`sys.exit(main())`**: `main()` returns an exit code, and the script exits with it. Use 0 for success, 1 for failures and 2 for usage or configuration errors, which is what most Unix tools and `argparse` do.
- **Error messages go to standard error** (`file=sys.stderr`), so they do not mix with the program's real output when someone pipes it into another tool.

`except (FileNotFoundError, PermissionError):` catches several types in one clause. Python 3.14 also accepts the form without parentheses when there is no `as` (PEP 758), but use the parentheses as long as your code must run on 3.13 or older.

### else and finally

A `try` statement can have two more blocks. `else` runs only if the `try` block raised nothing, which keeps the `try` block small. `finally` runs no matter what, even after `return`, `break` or an exception, so it is the place for cleanup. Here they guard a deployment with a lock file, so two deployments cannot run at once:

```python
import os
import sys
from pathlib import Path

lock = Path("deploy.lock")
try:
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)  # fails if the file exists
except FileExistsError:
    sys.exit(f"another deployment holds {lock}")
else:
    try:
        os.write(fd, f"{os.getpid()}\n".encode())
        print("deploying...")
        if len(sys.argv) > 1:
            raise RuntimeError(sys.argv[1])
        print("deployed")
    finally:
        os.close(fd)
        lock.unlink()
        print("lock released")
```

```terminal
{
  "title": "else and finally",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python locked_deploy.py",
      "output": "deploying...\ndeployed\nlock released"
    },
    {
      "cmd": "python locked_deploy.py \"health check failed\" 2>&1 | tail -n 3",
      "output": "  File \"/home/dev/pyops/locked_deploy.py\", line 15, in <module>\n    raise RuntimeError(sys.argv[1])\nRuntimeError: health check failed"
    },
    {
      "cmd": "touch deploy.lock && python locked_deploy.py; echo \"exit code $?\"",
      "output": "another deployment holds deploy.lock\nexit code 1"
    },
    {
      "comment": "remove the stale lock again",
      "cmd": "rm deploy.lock"
    }
  ]
}
```

The lock was released even when the deployment raised an exception. `os.O_EXCL` makes creating the lock file atomic: of two processes that try at the same moment, exactly one succeeds. Checking `lock.exists()` first and then creating the file would leave a gap in which both could pass the check.

That gap is a general rule. "Look before you leap" (check, then act) is racy for anything another process can change; "easier to ask forgiveness than permission" (try it and handle the exception) is the Python way, and it is also simpler.

## Context Managers

The `with` statement runs setup code, then your block, then teardown code that is guaranteed to run, like a `try`/`finally` you can reuse. Files, locks, network clients and temporary directories all work this way. `contextlib.contextmanager` turns a generator into your own context manager: the code before `yield` is the setup, the code after it the teardown:

```python
import os
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def deploy_lock(path: Path) -> Iterator[None]:
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
    try:
        yield
    finally:
        os.close(fd)
        path.unlink()


@contextmanager
def timed(label: str) -> Iterator[None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        print(f"{label} took {time.perf_counter() - start:.2f}s")


with deploy_lock(Path("deploy.lock")), timed("deploy"):
    time.sleep(0.3)
print("lock exists afterwards:", Path("deploy.lock").exists())
```

```terminal
{
  "title": "your own context managers",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python locks.py",
      "output": "deploy took 0.30s\nlock exists afterwards: False"
    }
  ]
}
```

`contextlib` has more: `suppress(FileNotFoundError)` ignores one exception type for a block (for example, when deleting a file that may already be gone), `chdir(path)` changes directory for a block (Python 3.11 and later), and `ExitStack` manages a variable number of context managers.

## Log, Do Not Print

`print()` is fine for a script's output. For messages _about_ what the script is doing, use the `logging` module: it adds timestamps and levels, writes to standard error by default, and lets the operator choose how much detail to see without editing code.

```python
import logging
import os

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
log = logging.getLogger("deploy")

log.debug("loaded %d hosts from %s", 3, "inventory.yaml")
log.info("deploying version %s", "1.4.2")
log.warning("web-03 is slow to respond (%.1fs)", 2.4)
try:
    replicas = int("three")
except ValueError:
    log.exception("bad replica count, using 1")
    replicas = 1
log.error("rollout finished with %d failed hosts", 1)
```

```terminal
{
  "title": "logging levels",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python logdemo.py",
      "output": "2026-10-24T09:35:25+0000 INFO    deploy: deploying version 1.4.2\n2026-10-24T09:35:25+0000 WARNING deploy: web-03 is slow to respond (2.4s)\n2026-10-24T09:35:25+0000 ERROR   deploy: bad replica count, using 1\nTraceback (most recent call last):\n  File \"/home/dev/pyops/logdemo.py\", line 15, in <module>\n    replicas = int(\"three\")\nValueError: invalid literal for int() with base 10: 'three'\n2026-10-24T09:35:25+0000 ERROR   deploy: rollout finished with 1 failed hosts"
    },
    {
      "comment": "more detail, without changing the code",
      "cmd": "LOG_LEVEL=debug python logdemo.py 2>&1 | head -n 2",
      "output": "2026-10-24T09:35:25+0000 DEBUG   deploy: loaded 3 hosts from inventory.yaml\n2026-10-24T09:35:25+0000 INFO    deploy: deploying version 1.4.2"
    },
    {
      "comment": "logs go to standard error, so stdout stays clean for data",
      "cmd": "python logdemo.py 2>/dev/null | wc -l",
      "output": "0"
    }
  ]
}
```

- **Levels**: `DEBUG` for detail, `INFO` for normal progress, `WARNING` for something odd that the script handled, `ERROR` for a failure, `CRITICAL` for "about to stop". The configured level hides everything below it.
- **`logging.getLogger(name)`**: one logger per module, usually `logging.getLogger(__name__)`. The name appears in each line, and libraries' loggers (httpx logs every request at `INFO`) can be tuned separately.
- **`log.exception()`** inside an `except` block logs at `ERROR` and adds the traceback.
- **Pass values as arguments** (`log.info("version %s", version)`) rather than formatting with an f-string. The message is only built if the level is enabled, and log aggregators can group lines by the unformatted message.
- **`basicConfig()` once**, in the program's entry point, never in a library module.

For JSON logs that a log platform can parse, set a custom `Formatter` or use a library such as `structlog` or `python-json-logger`.

## Exit Codes and Signals

Shells, CI systems, cron, systemd and Kubernetes all judge your script by its **exit code**. An uncaught exception exits with 1, `sys.exit(n)` with `n`, and Ctrl+C with 130 (the shell's code for "killed by `SIGINT`").

`SIGTERM` is the polite "please stop" that `kill`, systemd and Kubernetes send before they force a kill. Python's default reaction is to die immediately, _without_ running `finally` blocks or `with` cleanup. Turn the signal into an exception and your cleanup runs:

```python
import logging
import signal
import sys
import time

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("worker")


def on_sigterm(signum: int, frame: object) -> None:
    log.info("got SIGTERM, shutting down")
    sys.exit(128 + signum)  # raises SystemExit, so finally blocks run


signal.signal(signal.SIGTERM, on_sigterm)
try:
    for batch in range(1, 100):
        log.info("processing batch %d", batch)
        time.sleep(0.4)
finally:
    log.info("cleanup: closing connections, releasing the lock")
```

```terminal
{
  "title": "a graceful SIGTERM",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python worker.py & pid=$!; sleep 1.5; kill -TERM \"$pid\"; wait \"$pid\"; echo \"exit code $?\"",
      "output": "INFO processing batch 1\nINFO processing batch 2\nINFO processing batch 3\nINFO processing batch 4\nINFO got SIGTERM, shutting down\nINFO cleanup: closing connections, releasing the lock\nexit code 143"
    }
  ]
}
```

The exit code 143 is 128 plus the signal number 15, the same code a shell reports for a process killed by `SIGTERM`, so orchestration tools read it correctly. In a container, make sure your Python process is PID 1 or is started with `exec`, otherwise the signal goes to a shell that does not pass it on.

## Run Commands with subprocess

`subprocess.run()` starts a program, waits for it and returns a `CompletedProcess` with its exit code and, if you ask, its output. Pass the command as a **list**: each element becomes exactly one argument, with no shell in between to split words or interpret `;`, `$` or `*`:

```terminal
{
  "title": "subprocess.run",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import subprocess\n>>> result = subprocess.run([\"git\", \"--version\"], capture_output=True, text=True, check=True)\n>>> result.returncode, result.stdout.strip()\n(0, 'git version 2.39.5')\n>>> result = subprocess.run([\"ls\", \"/no/such/dir\"], capture_output=True, text=True)\n>>> result.returncode, result.stderr.strip()\n(2, \"ls: cannot access '/no/such/dir': No such file or directory\")\n>>> try:\n...     subprocess.run([\"ls\", \"/no/such/dir\"], capture_output=True, text=True, check=True)\n... except subprocess.CalledProcessError as err:\n...     print(f\"exit {err.returncode}: {err.stderr.strip()}\")\n...\nexit 2: ls: cannot access '/no/such/dir': No such file or directory\n>>> try:\n...     subprocess.run([\"kubectl-typo\", \"get\", \"pods\"], check=True)\n... except FileNotFoundError as err:\n...     print(err)\n...\n[Errno 2] No such file or directory: 'kubectl-typo'\n>>> try:\n...     subprocess.run([\"sleep\", \"5\"], timeout=1)\n... except subprocess.TimeoutExpired as err:\n...     print(err)\n...\nCommand '['sleep', '5']' timed out after 1 seconds\n>>> exit()"
    }
  ]
}
```

The four options you almost always want:

- **`check=True`** raises `CalledProcessError` on a non-zero exit code. Without it, a failed command is silently ignored unless you check `returncode` yourself.
- **`capture_output=True`** collects standard output and standard error instead of letting them go to the terminal.
- **`text=True`** (with `encoding="utf-8"` if the output may not match the locale) gives you `str` instead of `bytes`.
- **`timeout=`** kills the command and raises `TimeoutExpired` if it hangs. Commands that talk to the network hang more often than you think.

A missing program raises `FileNotFoundError` before anything runs. Use `shutil.which("kubectl")` to check for required tools up front and fail with a clear message.

### Never build a shell command from input

`shell=True` passes one string to `/bin/sh`, which interprets it. If any part of that string comes from outside (a file name, a branch name, an API response), it can run commands you never wrote:

```python
import subprocess

filename = "report.txt; echo INJECTED: this ran as a second command"

print("with shell=True:", flush=True)
subprocess.run(f"wc -l {filename}", shell=True)

print("with a list, no shell:", flush=True)
subprocess.run(["wc", "-l", filename])
```

```terminal
{
  "title": "shell injection",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"one line\" > report.txt && python injection.py",
      "output": "with shell=True:\n1 report.txt\nINJECTED: this ran as a second command\nwith a list, no shell:\nwc: 'report.txt; echo INJECTED: this ran as a second command': No such file or directory"
    }
  ]
}
```

(`flush=True` makes Python write its own line before the child process writes, so the output appears in order when it goes to a pipe or a file.) With the list form, the whole string is one argument, a strange file name that does not exist, and nothing else runs. If you really need shell features such as pipes, do the work in Python instead (read the output and filter it), or quote every outside value with `shlex.quote()`. Two more options you will use: `cwd=` runs the command in another directory, and `env={**os.environ, "LC_ALL": "C"}` passes a modified environment (the child gets _only_ what you pass, so start from `os.environ`).

## Call HTTP APIs with Timeouts and Retries

Most of what operations scripts talk to is an HTTP API: a cloud provider, a deployment tool, a health endpoint, an incident tool. The two rules are the same as for commands: **always set a timeout**, and **retry only errors that can go away**. [httpx](https://www.python-httpx.org/) is a modern client with timeouts on by default (5 seconds); the older `requests` library has **no default timeout**, so a request without `timeout=` can hang forever.

To have something to fail against, save this small test API as `~/pyops/fakeapi.py`. It uses only the standard library: `/health` works, `/flaky` fails twice per URL before it works, `/slow` answers late, `/limited` always answers 429 with a `Retry-After` header, and `/deploys` needs a token:

```python
"""A small HTTP API for testing clients: python fakeapi.py [PORT]"""

import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

hits: dict[str, int] = {}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        url = urlparse(self.path)
        hits[self.path] = hits.get(self.path, 0) + 1
        match url.path:
            case "/health":
                self.reply(200, {"status": "ok", "version": "1.4.2"})
            case "/flaky":  # each distinct URL fails twice, then works
                if hits[self.path] <= 2:
                    self.reply(503, {"error": "warming up"})
                else:
                    self.reply(200, {"status": "ok", "attempt": hits[self.path]})
            case "/slow":
                time.sleep(float(parse_qs(url.query).get("seconds", ["3"])[0]))
                self.reply(200, {"status": "ok"})
            case "/limited":  # always rate limited, with a hint when to come back
                self.reply(429, {"error": "too many requests"}, {"Retry-After": "1"})
            case "/deploys":
                if self.headers.get("Authorization") != "Bearer test-token":
                    self.reply(401, {"error": "missing or wrong token"})
                else:
                    self.reply(200, [{"id": 41, "version": "1.4.1"}, {"id": 42, "version": "1.4.2"}])
            case _:
                self.reply(404, {"error": f"no route {url.path}"})

    def reply(self, status: int, body: object, headers: dict[str, str] | None = None) -> None:
        data = json.dumps(body).encode()
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the client gave up (a timeout) before the answer was ready

    def log_message(self, format: str, *args: object) -> None:
        pass  # keep the terminal quiet


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"fakeapi listening on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()
```

Start it in a second terminal (or in the background, as here) and try one request:

```terminal
{
  "title": "the test API",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python fakeapi.py 8080 &"
    },
    {
      "cmd": "python -c 'import httpx; r = httpx.get(\"http://127.0.0.1:8080/health\"); print(r.status_code, r.json())'",
      "output": "200 {'status': 'ok', 'version': '1.4.2'}"
    },
    {
      "cmd": "python -c 'import httpx; httpx.get(\"http://127.0.0.1:8080/slow?seconds=3\", timeout=1.0)' 2>&1 | tail -n 1",
      "output": "httpx.ReadTimeout: timed out"
    }
  ]
}
```

Now a client that does it properly. It reuses one `httpx.Client` (which keeps connections open between requests), sets separate connect and read timeouts, reads its token from the environment, retries connection errors, timeouts, 429 and 5xx responses with backoff and jitter, honours `Retry-After` (which can be a number of seconds or an HTTP date) up to a limit, and fails fast on everything else:

```python
"""GET JSON from an API with timeouts and retries: apiclient.py PATH..."""

import email.utils
import logging
import os
import random
import sys
import time
from datetime import UTC, datetime

import httpx

log = logging.getLogger("apiclient")
RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_WAIT = 30.0  # give up rather than sleep longer than this between attempts


class RetryableError(Exception):
    """A failure that may go away if we try again later."""

    def __init__(self, reason: str, retry_after: float | None = None) -> None:
        super().__init__(reason)
        self.retry_after = retry_after


def retry_after_seconds(value: str) -> float | None:
    """Parse a Retry-After header: a number of seconds or an HTTP date."""
    if value.isdigit():
        return float(value)
    try:
        when = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if when.tzinfo is None:
        return None
    return max(0.0, (when - datetime.now(UTC)).total_seconds())


def get_once(client: httpx.Client, path: str) -> object:
    try:
        response = client.get(path)
    except httpx.TransportError as err:  # refused, reset, DNS, timeouts
        raise RetryableError(f"{type(err).__name__}: {err}") from err
    if response.status_code in RETRY_STATUSES:
        wait = retry_after_seconds(response.headers.get("Retry-After", ""))
        raise RetryableError(f"HTTP {response.status_code}", wait)
    response.raise_for_status()  # other 4xx and 5xx: retrying will not help
    return response.json()


def get_json(client: httpx.Client, path: str, attempts: int = 4) -> object:
    for attempt in range(1, attempts):
        try:
            return get_once(client, path)
        except RetryableError as err:
            delay = err.retry_after
            if delay is None:
                delay = random.uniform(0, 0.5 * 2**attempt)  # backoff with full jitter
            if delay > MAX_WAIT:
                raise  # the server asks for a longer pause than this client will wait
            log.warning("GET %s: %s (attempt %d/%d), retrying in %.1fs", path, err, attempt, attempts, delay)
            time.sleep(delay)
    return get_once(client, path)  # the last attempt: errors reach the caller


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # httpx logs every request at INFO
    token = os.environ.get("API_TOKEN")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    failed = 0
    with httpx.Client(
        base_url=os.environ.get("API_URL", "http://127.0.0.1:8080"),
        headers=headers,
        timeout=httpx.Timeout(2.0, connect=1.0),
    ) as client:
        for path in sys.argv[1:]:
            try:
                print(path, get_json(client, path))
            except (RetryableError, httpx.HTTPStatusError) as err:
                log.error("GET %s failed: %s", path, err)
                failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
```

```terminal
{
  "title": "timeouts, retries and auth",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python apiclient.py /health /flaky",
      "output": "WARNING apiclient: GET /flaky: HTTP 503 (attempt 1/4), retrying in 0.3s\nWARNING apiclient: GET /flaky: HTTP 503 (attempt 2/4), retrying in 1.6s\n/health {'status': 'ok', 'version': '1.4.2'}\n/flaky {'status': 'ok', 'attempt': 3}"
    },
    {
      "cmd": "python apiclient.py /limited; echo \"exit code $?\"",
      "output": "WARNING apiclient: GET /limited: HTTP 429 (attempt 1/4), retrying in 1.0s\nWARNING apiclient: GET /limited: HTTP 429 (attempt 2/4), retrying in 1.0s\nWARNING apiclient: GET /limited: HTTP 429 (attempt 3/4), retrying in 1.0s\nERROR apiclient: GET /limited failed: HTTP 429\nexit code 1"
    },
    {
      "cmd": "python apiclient.py /deploys; echo \"exit code $?\"",
      "output": "ERROR apiclient: GET /deploys failed: Client error '401 Unauthorized' for url 'http://127.0.0.1:8080/deploys'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401\nexit code 1"
    },
    {
      "cmd": "API_TOKEN=test-token python apiclient.py /deploys",
      "output": "/deploys [{'id': 41, 'version': '1.4.1'}, {'id': 42, 'version': '1.4.2'}]"
    },
    {
      "cmd": "python apiclient.py '/slow?seconds=3'; echo \"exit code $?\"",
      "output": "WARNING apiclient: GET /slow?seconds=3: ReadTimeout: timed out (attempt 1/4), retrying in 1.0s\nWARNING apiclient: GET /slow?seconds=3: ReadTimeout: timed out (attempt 2/4), retrying in 1.1s\nWARNING apiclient: GET /slow?seconds=3: ReadTimeout: timed out (attempt 3/4), retrying in 3.8s\nERROR apiclient: GET /slow?seconds=3 failed: ReadTimeout: timed out\nexit code 1"
    },
    {
      "cmd": "API_URL=http://127.0.0.1:8099 python apiclient.py /health; echo \"exit code $?\"",
      "output": "WARNING apiclient: GET /health: ConnectError: [Errno 111] Connection refused (attempt 1/4), retrying in 0.1s\nWARNING apiclient: GET /health: ConnectError: [Errno 111] Connection refused (attempt 2/4), retrying in 1.7s\nWARNING apiclient: GET /health: ConnectError: [Errno 111] Connection refused (attempt 3/4), retrying in 1.3s\nERROR apiclient: GET /health failed: ConnectError: [Errno 111] Connection refused\nexit code 1"
    }
  ]
}
```

What each run shows:

- **`/flaky`** failed twice with 503 and succeeded on the third attempt, after short random waits.
- **`/limited`** answered 429 every time; the client waited the 1 second the server asked for, gave up after four attempts and exited with 1.
- **`/deploys`** without a token got 401, which no retry can fix, so it failed at once. With `API_TOKEN` set, it worked. The token came from the environment and appears nowhere in the code or the logs.
- **`/slow`** took longer than the 2-second read timeout every time. Note what that timeout measures: httpx applies its timeouts to each step (connecting, each read, each write, waiting for a free connection), not to the request as a whole, so a server that sends a byte every second never trips a 2-second read timeout. When you need a hard limit on the total time, use the async client inside `asyncio.timeout()` (Python 3.11 and later).
- **Port 8099**, where nothing listens, refused the connection at once on every attempt. The 1-second connect timeout matters for the worse case, a host that does not answer at all (for example behind a firewall that drops packets).

Retry only requests that are safe to repeat. A `GET` is; a `POST` that creates something is not, unless the API supports an idempotency key (see [how Stripe avoids double charging](/posts/how-stripe-avoids-double-charging-idempotency-keys)). For production code, `tenacity` or `stamina` give you a tested retry decorator. With `requests`, the same setup looks like this (shown for comparison, not run here):

```tabs
{
  "title": "The same client setup",
  "tabs": [
    {
      "label": "httpx",
      "lang": "python",
      "code": "import httpx\n\n# Timeouts are on by default (5 s); set them explicitly anyway.\n# transport retries cover connection errors only, not 5xx responses.\nclient = httpx.Client(\n    base_url=\"https://api.example.com\",\n    headers={\"Authorization\": f\"Bearer {token}\"},\n    timeout=httpx.Timeout(10.0, connect=3.0),\n    transport=httpx.HTTPTransport(retries=2),\n)\nresponse = client.get(\"/deploys\")\nresponse.raise_for_status()"
    },
    {
      "label": "requests",
      "lang": "python",
      "code": "import requests\nfrom requests.adapters import HTTPAdapter\nfrom urllib3.util import Retry\n\nretry = Retry(\n    total=4,\n    backoff_factor=0.5,\n    status_forcelist=[429, 500, 502, 503, 504],\n    allowed_methods={\"GET\"},\n    respect_retry_after_header=True,\n)\nsession = requests.Session()\nsession.mount(\"https://\", HTTPAdapter(max_retries=retry))\nsession.headers[\"Authorization\"] = f\"Bearer {token}\"\n# requests has NO default timeout: pass one on every call.\nresponse = session.get(\"https://api.example.com/deploys\", timeout=(3, 10))\nresponse.raise_for_status()"
    }
  ]
}
```

### Secrets

Read tokens and passwords from environment variables or from files that your platform mounts (Docker puts secrets under `/run/secrets/`, and Kubernetes mounts them wherever the pod spec says), never from the source code. Do not log them, do not put them in exception messages and do not pass them on a command line, where other users can see them in `ps`. When a person must type one, `getpass.getpass()` reads it without echoing. [Secrets management](/posts/secrets-management-guide) covers where they should live in the first place.

## Common Mistakes

- **A bare `except:` or `except Exception: pass`.** It hides bugs, and a bare `except:` also catches Ctrl+C and `sys.exit()`.
- **Catching too much in one `try` block.** Keep the `try` block to the lines that can raise what you catch.
- **Hiding where an error came from.** Re-raise with a bare `raise`. When you raise a new exception in an `except` block, write `raise NewError(...) from err`: Python keeps the original either way ("During handling of the above exception, another exception occurred"), but `from err` marks it as the cause, and `from None` hides it when your message says everything.
- **`print()` for diagnostics.** Use `logging`, and send it to standard error.
- **Ignoring exit codes**, both of the commands you run (`check=True`) and of your own script (`sys.exit(main())`).
- **No timeouts** on HTTP calls, socket connections and `subprocess.run`.
- **`shell=True` with any outside value.**
- **Retrying everything**, including 4xx errors and requests that are not safe to repeat, or retrying without backoff.
- **No `SIGTERM` handling** in long-running workers, so cleanup never runs when the platform stops them.

## Summary

- Read tracebacks from the bottom; the last line names the exception, the frames above show the path.
- Catch narrow exceptions where you can act on them; raise your own types with `raise ... from err`; use `else` and `finally` for the success path and cleanup.
- Context managers (`with`, `contextlib.contextmanager`) make cleanup automatic.
- `logging` with levels, a format and `LOG_LEVEL` from the environment replaces `print` for diagnostics.
- Exit with meaningful codes, and turn `SIGTERM` into an exception so cleanup runs.
- `subprocess.run([...], check=True, capture_output=True, text=True, timeout=...)`, never a shell string with outside input.
- HTTP: one client, explicit timeouts, retries with backoff only for transport errors, 429 and 5xx, `Retry-After` respected, tokens from the environment.

Next: [Object-Oriented Programming](/guides/introduction-to-python/09-object-oriented), where checks, results and the API client become classes and dataclasses.

## Keep Learning

- [How to artificially create a connection timeout error](/posts/how-to-artificially-create-connection-timeout-error), to test timeouts against real network behaviour.
- [What does set -e mean in a Bash script?](/posts/what-does-set-e-mean-in-bash-script): the shell's version of "stop on errors", and its traps.
- [Your trace dies the moment the pipeline shells out](/posts/trace-context-environment-variables), on passing context through `subprocess` environments.
