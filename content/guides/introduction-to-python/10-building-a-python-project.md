---
title: 'Build a Python CLI Tool: uv, argparse, pytest, Ruff, mypy and CI'
description: 'Package a Python CLI with uv: src layout, pyproject.toml, argparse, threads, pytest, Ruff, mypy --strict, tests on 3.12 to 3.15, boto3 and CI.'
order: 10
---

The earlier parts built the pieces: settings from the environment, retry loops, data structures, files and TOML, exceptions, logging, `subprocess`, HTTP clients and check classes. This part puts them together into **svcheck**, a small command-line tool that runs HTTP, TCP, disk and command checks from a TOML file, in parallel, and exits with a code that cron, systemd or a CI job can act on.

More important than the tool is the project around it, because that is what makes Python code maintainable in a team: a standard `pyproject.toml`, a `src` layout, a lock file, an installable command, tests with pytest, linting and formatting with Ruff, type checking with mypy, tests on every supported Python version, and a CI workflow that runs all of it.

## Prerequisites

- uv and Python 3.14 from [Part 1](/guides/introduction-to-python/01-getting-started). Start in a new terminal (or run `deactivate`), because this project gets its own environment instead of the `~/pyops` one.
- The check classes from [Part 9](/guides/introduction-to-python/09-object-oriented) and the test API `fakeapi.py` from [Part 8](/guides/introduction-to-python/08-error-handling), running on port 8080 in a second terminal.
- Git, for the CI part, and optionally [actionlint](https://github.com/rhysd/actionlint) (`brew install actionlint`, or a binary from its releases page) to check the workflow file.

## What You Are Building

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "services.toml", "sub": "which checks to run", "icon": "box", "tone": "slate" },
    { "label": "config.py", "sub": "load and validate", "icon": "gear", "tone": "blue" },
    { "label": "runner.py", "sub": "threads and retries", "icon": "cpu", "tone": "violet" },
    { "label": "checks.py", "sub": "HTTP, TCP, disk, command, S3", "icon": "activity", "tone": "green" },
    { "label": "report.py", "sub": "table or JSON, exit code", "icon": "check", "tone": "amber" }
  ]
}
```

```text
svcheck/
├── pyproject.toml          project metadata, dependencies, tool settings
├── uv.lock                 exact versions of every dependency
├── .python-version         the Python version uv uses for development
├── src/svcheck/
│   ├── __init__.py         the version number
│   ├── __main__.py         python -m svcheck
│   ├── cli.py              argparse, logging, exit codes
│   ├── config.py           TOML to check objects, with clear errors
│   ├── checks.py           Status, Result, the Check protocol and the checks
│   ├── runner.py           parallel runs and retries
│   ├── report.py           table, JSON, exit code
│   └── aws.py              an optional S3 check that needs boto3
├── tests/                  pytest tests
└── .github/workflows/ci.yml
```

The **src layout** (code under `src/svcheck/` rather than `svcheck/` at the top) means tests and scripts can only import the package after it is installed, so they test what users will actually get, not whatever happens to be in the current directory.

## Create the Project

`uv init --package` creates a project that is built as an installable package, with a `src` layout and a command-line entry point:

```terminal
{
  "title": "uv init --package",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~ && uv init --package svcheck --python 3.14",
      "output": "Initialized project `svcheck` at `/home/dev/svcheck`"
    },
    {
      "cmd": "cd svcheck && find . -path ./.git -prune -o -type f -print | sort",
      "output": "./.gitignore\n./.python-version\n./README.md\n./pyproject.toml\n./src/svcheck/__init__.py"
    }
  ]
}
```

Now replace `pyproject.toml` with the full project definition:

```toml
[project]
name = "svcheck"
version = "0.1.0"
description = "Run HTTP, TCP, disk and command checks from a TOML file"
readme = "README.md"
requires-python = ">=3.12"
dependencies = ["httpx>=0.28.1"]

[project.optional-dependencies]
aws = ["boto3>=1.43"]

[project.scripts]
svcheck = "svcheck.cli:main"

[build-system]
requires = ["uv_build>=0.13.5,<0.14.0"]
build-backend = "uv_build"

[dependency-groups]
dev = ["mypy>=2.4", "pytest>=9.1", "ruff>=0.17"]

[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "W", "I", "B", "UP", "SIM", "RUF"]

[tool.mypy]
strict = true
files = ["src", "tests"]

[[tool.mypy.overrides]]
module = ["boto3", "botocore.*"]
ignore_missing_imports = true

[tool.pytest]
addopts = ["-ra"]
testpaths = ["tests"]
```

Section by section:

- **`[project]`** is the standard metadata ([PEP 621](https://peps.python.org/pep-0621/)) that every tool reads. `requires-python = ">=3.12"` promises support for 3.12 and newer, and the tests below hold the code to that. `dependencies` lists what the tool needs at runtime, with minimum versions; the exact versions go into `uv.lock`.
- **`[project.optional-dependencies]`** defines an **extra**: `svcheck[aws]` also installs boto3, for users who want the S3 check. Everyone else does not pay for it.
- **`[project.scripts]`** creates the `svcheck` command, which calls `main()` in `svcheck/cli.py` and exits with its return value.
- **`[build-system]`** says how to build the package. `uv_build` is uv's own backend; `hatchling` and `setuptools` are common alternatives, and any standard frontend (`pip`, `uv`, `build`) can use whichever you choose.
- **`[dependency-groups]`** ([PEP 735](https://peps.python.org/pep-0735/)) holds development tools. They are installed by `uv sync` but are not part of the published package.
- **`[tool.*]`** tables configure Ruff, mypy and pytest, so every developer and CI run uses the same settings. pytest 9 reads its own `[tool.pytest]` table.

## The Code

`checks.py` is the Part 9 module with three additions: every `Result` says whether the failure is `retryable` (a timeout, a refused connection or a 503 may go away; a 404 will not), `DiskCheck` turns a bad path into a failed result instead of an exception, and `CommandCheck` runs a command with `subprocess` (Part 8), with a timeout and no shell:

```python
"""The checks svcheck can run, and the Result each one returns."""

import shutil
import socket
import subprocess
import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

import httpx


class Status(StrEnum):
    OK = "ok"
    WARN = "warn"
    FAIL = "fail"


@dataclass(frozen=True, slots=True)
class Result:
    name: str
    status: Status
    detail: str
    duration_ms: float = 0.0
    retryable: bool = False  # True when trying again later may give a different answer


class Check(Protocol):
    """Anything with a name and a run() method that returns a Result."""

    name: str

    def run(self) -> Result: ...


RETRY_STATUSES = {429, 500, 502, 503, 504}


def elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)


@dataclass(slots=True)
class HttpCheck:
    name: str
    url: str
    timeout: float = 2.0
    expect_status: int = 200

    def run(self) -> Result:
        start = time.perf_counter()
        try:
            response = httpx.get(self.url, timeout=self.timeout)
        except httpx.InvalidURL as err:
            return Result(self.name, Status.FAIL, f"invalid URL: {err}", elapsed_ms(start))
        except httpx.HTTPError as err:
            detail = f"{type(err).__name__}: {err}"
            return Result(self.name, Status.FAIL, detail, elapsed_ms(start), retryable=True)
        detail = f"HTTP {response.status_code}"
        if response.status_code == self.expect_status:
            return Result(self.name, Status.OK, detail, elapsed_ms(start))
        retryable = response.status_code in RETRY_STATUSES
        return Result(self.name, Status.FAIL, detail, elapsed_ms(start), retryable=retryable)


@dataclass(slots=True)
class TcpCheck:
    name: str
    host: str
    port: int
    timeout: float = 2.0

    def run(self) -> Result:
        start = time.perf_counter()
        try:
            with socket.create_connection((self.host, self.port), timeout=self.timeout):
                pass
        except OSError as err:
            return Result(self.name, Status.FAIL, str(err), elapsed_ms(start), retryable=True)
        detail = f"{self.host}:{self.port} accepts connections"
        return Result(self.name, Status.OK, detail, elapsed_ms(start))


@dataclass(slots=True)
class DiskCheck:
    name: str
    path: str = "/"
    warn_percent: float = 80.0
    max_used_percent: float = 90.0

    def run(self) -> Result:
        start = time.perf_counter()
        try:
            usage = shutil.disk_usage(self.path)
        except OSError as err:
            return Result(self.name, Status.FAIL, str(err), elapsed_ms(start))
        if usage.total <= 0:  # /proc and other virtual file systems report no size
            return Result(self.name, Status.FAIL, "no measurable capacity", elapsed_ms(start))
        used = usage.used / usage.total * 100
        if used >= self.max_used_percent:
            status = Status.FAIL
        elif used >= self.warn_percent:
            status = Status.WARN
        else:
            status = Status.OK
        return Result(self.name, status, f"{used:.1f}% used", elapsed_ms(start))


@dataclass(slots=True)
class CommandCheck:
    name: str
    command: list[str]
    timeout: float = 10.0

    def run(self) -> Result:
        start = time.perf_counter()
        try:
            proc = subprocess.run(
                self.command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.timeout,
            )
        except (OSError, subprocess.TimeoutExpired) as err:
            return Result(self.name, Status.FAIL, str(err), elapsed_ms(start))
        output = (proc.stdout or proc.stderr).strip().splitlines()
        first_line = output[0] if output else ""
        if proc.returncode != 0:
            detail = f"exit {proc.returncode}: {first_line}"
            return Result(self.name, Status.FAIL, detail, elapsed_ms(start))
        return Result(self.name, Status.OK, first_line, elapsed_ms(start))
```

`config.py` turns the TOML file into check objects. TOML gives you types, but not the _right_ types: `port = "ssh"` or `command = "true"` is valid TOML. So every value goes through a small validation function (numbers must also be finite, because TOML has `nan` and `inf`; percentages stop at 100; URLs need `http` or `https` and a numeric port), and every way a config can be wrong, including a file that is not UTF-8, becomes a `ConfigError` with the file name and the check number, so the user sees one clear line instead of a traceback. `raise ... from None` drops the original exception from the traceback here on purpose, because the message already says everything:

```python
"""Load checks from a TOML file, with a clear error for every mistake."""

import math
import tomllib
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from svcheck.checks import Check, CommandCheck, DiskCheck, HttpCheck, TcpCheck


class ConfigError(Exception):
    """The configuration file is missing or invalid."""


def load_config(path: Path) -> tuple[list[Check], int]:
    """Return the checks defined in path, and how often to retry a failed check."""
    try:
        with path.open("rb") as f:
            data = tomllib.load(f)
    except FileNotFoundError:
        raise ConfigError(f"{path}: no such file") from None
    except (OSError, UnicodeDecodeError, tomllib.TOMLDecodeError) as err:
        raise ConfigError(f"{path}: {err}") from None

    defaults = data.get("defaults", {})
    entries = data.get("check", [])
    if not isinstance(defaults, dict):
        raise ConfigError(f"{path}: defaults must be a [defaults] table")
    if not isinstance(entries, list) or not all(isinstance(e, dict) for e in entries):
        raise ConfigError(f"{path}: checks must be [[check]] tables")
    if not entries:
        raise ConfigError(f"{path}: no [[check]] tables")
    try:
        timeout = positive_number(defaults.get("timeout", 2.0), "timeout")
        retries = whole_number(defaults.get("retries", 0), "retries")
    except ValueError as err:
        raise ConfigError(f"{path}: [defaults]: {err}") from None

    checks = []
    for number, entry in enumerate(entries, start=1):
        try:
            checks.append(build_check(entry, timeout))
        except KeyError as err:
            raise ConfigError(f"{path}: check {number}: missing key {err}") from None
        except ValueError as err:
            raise ConfigError(f"{path}: check {number}: {err}") from None
    names = [check.name for check in checks]
    duplicates = sorted({name for name in names if names.count(name) > 1})
    if duplicates:
        raise ConfigError(f"{path}: duplicate check names: {', '.join(duplicates)}")
    return checks, retries


def build_check(entry: dict[str, Any], default_timeout: float) -> Check:
    name = string(entry["name"], "name")
    timeout = positive_number(entry.get("timeout", default_timeout), "timeout")
    match entry["type"]:
        case "http":
            expect = whole_number(entry.get("expect_status", 200), "expect_status")
            return HttpCheck(name, http_url(entry["url"]), timeout, expect)
        case "tcp":
            return TcpCheck(name, string(entry["host"], "host"), port(entry["port"]), timeout)
        case "disk":
            warn = percent(entry.get("warn_percent", 80), "warn_percent")
            limit = percent(entry.get("max_used_percent", 90), "max_used_percent")
            if warn > limit:
                raise ValueError("warn_percent must not be above max_used_percent")
            return DiskCheck(name, string(entry.get("path", "/"), "path"), warn, limit)
        case "command":
            return CommandCheck(name, command(entry["command"]), timeout)
        case "s3":
            from svcheck.aws import S3BucketCheck  # needs the "aws" extra at run time

            return S3BucketCheck(name, string(entry["bucket"], "bucket"), timeout)
        case other:
            raise ValueError(f"unknown type {other!r}")


def string(value: object, key: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{key} must be a non-empty string, not {value!r}")
    return value


def positive_number(value: object, key: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError(f"{key} must be a positive number, not {value!r}")
    if not math.isfinite(value) or value <= 0:  # TOML also has nan and inf
        raise ValueError(f"{key} must be a positive number, not {value!r}")
    return float(value)


def percent(value: object, key: str) -> float:
    number = positive_number(value, key)
    if number > 100:
        raise ValueError(f"{key} must be at most 100, not {value!r}")
    return number


def http_url(value: object) -> str:
    url = string(value, "url")
    parts = urlsplit(url)
    try:
        _ = parts.port  # raises ValueError when the port is not a number
    except ValueError:
        raise ValueError(f"url has an invalid port: {url!r}") from None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError(f"url must be an http:// or https:// URL, not {url!r}")
    return url


def whole_number(value: object, key: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{key} must be a whole number of 0 or more, not {value!r}")
    return value


def port(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 65535:
        raise ValueError(f"port must be a whole number from 1 to 65535, not {value!r}")
    return value


def command(value: object) -> list[str]:
    if not isinstance(value, list) or not value or not all(isinstance(a, str) for a in value):
        raise ValueError(f"command must be a non-empty list of strings, not {value!r}")
    return value
```

`runner.py` runs the checks in parallel and retries the failures that may go away, with exponential backoff and jitter (Part 3). It waits between retries with `stop.wait()` instead of `time.sleep()`, so a stop request ends the wait at once, and on the way out it cancels the checks that have not started yet. It never retries a permanent failure, and it never retries a command check, because running a command twice is not always safe. Checks spend their time waiting for the network, a disk or another process, and Python releases the global interpreter lock (GIL) while a thread waits, so a thread pool runs many checks at once even on a regular build of Python. `pool.map()` returns results in the order of the input, so the report always lists checks in config order. The parameter is a `Sequence[Check]` rather than a `list[Check]`, so callers can pass a list of any class that matches the Protocol (mypy treats `list` as invariant):

```python
"""Run checks in parallel threads, retrying failures that may go away."""

import logging
import random
import threading
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor

from svcheck.checks import Check, Result, Status

log = logging.getLogger(__name__)


def run_one(check: Check, retries: int, delay: float, stop: threading.Event) -> Result:
    result = check.run()
    for attempt in range(1, retries + 1):
        if result.status is not Status.FAIL or not result.retryable:
            break
        wait = random.uniform(0, delay * 2**attempt)  # exponential backoff, full jitter
        log.info("%s: %s, retry %d/%d in %.1fs", check.name, result.detail, attempt, retries, wait)
        if stop.wait(wait):  # returns True at once when svcheck is told to stop
            break
        result = check.run()
    return result


def run_checks(
    checks: Sequence[Check],
    retries: int = 0,
    delay: float = 0.5,
    workers: int = 8,
    stop: threading.Event | None = None,
) -> list[Result]:
    """Run every check, at most `workers` at a time; results keep the config order."""
    if stop is None:
        stop = threading.Event()
    pool = ThreadPoolExecutor(max_workers=workers)
    try:
        return list(pool.map(lambda check: run_one(check, retries, delay, stop), checks))
    finally:
        # after SIGTERM: drop the checks that have not started, wait for the running ones
        pool.shutdown(wait=True, cancel_futures=True)
```

`report.py` formats the results and decides the exit code: warnings do not fail the run, failures do:

```python
"""Turn results into a table, JSON and an exit code."""

import contextlib
import json
import os
import stat
import tempfile
from dataclasses import asdict
from pathlib import Path

from svcheck.checks import Result, Status


def as_table(results: list[Result]) -> str:
    width = max(len(result.name) for result in results)
    lines = [f"{'STATUS':<6}  {'CHECK':<{width}}  {'TIME':>7}  DETAIL"]
    for r in results:
        lines.append(
            f"{r.status.upper():<6}  {r.name:<{width}}  {r.duration_ms:>5.0f}ms  {r.detail}"
        )
    counts = {status: sum(r.status is status for r in results) for status in Status}
    lines.append(", ".join(f"{count} {status}" for status, count in counts.items()))
    return "\n".join(lines)


def as_json(results: list[Result]) -> str:
    return json.dumps([asdict(result) for result in results], indent=2)


def exit_code(results: list[Result]) -> int:
    """0 when nothing failed (warnings are fine), 1 when any check failed."""
    return 1 if any(result.status is Status.FAIL for result in results) else 0


def write_atomic(path: Path, text: str) -> None:
    """Replace path with text so readers never see a partial file (Part 7).

    A new report is readable only by its owner (mkstemp's 0600), because it can contain
    command output; an existing report keeps the mode someone gave it.
    """
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        if path.exists():
            os.chmod(tmp, stat.S_IMODE(path.stat().st_mode))
        os.replace(tmp, path)
    except BaseException:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(tmp)
        raise
```

`cli.py` is the only module that knows about command-line arguments, logging setup, signals and exit codes. Everything else is plain functions and classes that tests can call directly. Two details come from earlier parts: `--output` writes the report with the atomic write from Part 7 (now in `report.py`), so a monitoring system never reads half a file, and `SIGTERM` becomes a normal exit, as in Part 8. The handler also sets a `threading.Event` that tells the runner to start no new attempts:

```python
"""The svcheck command: svcheck CONFIG [--json] [--workers N] [-v]"""

import argparse
import logging
import signal
import threading
from pathlib import Path

from svcheck import __version__
from svcheck.config import ConfigError, load_config
from svcheck.report import as_json, as_table, exit_code, write_atomic
from svcheck.runner import run_checks

log = logging.getLogger("svcheck")


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="svcheck",
        description="Run HTTP, TCP, disk and command checks from a TOML file.",
        epilog="Exit codes: 0 nothing failed, 1 a check failed, 2 usage or config error.",
    )
    parser.add_argument("config", type=Path, help="TOML file with [[check]] tables")
    parser.add_argument("--json", action="store_true", help="print the results as JSON")
    parser.add_argument(
        "--workers", type=int, default=8, metavar="N", help="checks to run at once (default: 8)"
    )
    parser.add_argument(
        "--output", type=Path, metavar="FILE", help="also write the report to FILE, atomically"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="log retries")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    args = parser.parse_args(argv)
    if args.workers < 1:
        parser.error("--workers must be at least 1")
    return args


def main(argv: list[str] | None = None) -> int:
    stop = threading.Event()

    def on_sigterm(signum: int, frame: object) -> None:
        stop.set()  # no new attempts or retries
        raise SystemExit(128 + signum)  # then exit like Ctrl+C would (Part 8)

    signal.signal(signal.SIGTERM, on_sigterm)
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    try:
        checks, retries = load_config(args.config)
    except ConfigError as err:
        log.error("%s", err)
        return 2
    results = run_checks(checks, retries=retries, workers=args.workers, stop=stop)
    report = as_json(results) if args.json else as_table(results)
    print(report)
    if args.output:
        write_atomic(args.output, report + "\n")
    return exit_code(results)
```

`argparse` generates `--help`, rejects unknown options and converts types (`type=Path`, `type=int`); `parser.error()` prints a usage message and exits with 2. `main()` takes an optional argument list, so tests can call `main(["services.toml", "--json"])` without touching `sys.argv`.

The package's `__init__.py` reads the version from the installed package metadata, so `pyproject.toml` stays the only place it is written, and `__main__.py` makes `python -m svcheck` work:

```python
"""Run HTTP, TCP, disk and command checks from a TOML file."""

from importlib.metadata import version

__version__ = version("svcheck")
```

```python
from svcheck.cli import main

raise SystemExit(main())
```

`aws.py` holds the optional S3 check, explained in [Talking to AWS with boto3](#h2-talking-to-aws-with-boto3) below. It imports boto3 only when it runs, so svcheck works without the `aws` extra, and it passes the check's timeout to botocore, whose own defaults are a 60-second timeout and several retries:

```python
"""An optional check that needs boto3: install svcheck with the "aws" extra."""

import time
from dataclasses import dataclass
from typing import Any

from svcheck.checks import Result, Status, elapsed_ms


@dataclass(slots=True)
class S3BucketCheck:
    name: str
    bucket: str
    timeout: float = 5.0
    client: Any = None  # a boto3 S3 client; None means "build one from the environment"

    def run(self) -> Result:
        start = time.perf_counter()
        try:
            import boto3  # imported here, so svcheck works without boto3 installed
            from botocore.config import Config
            from botocore.exceptions import BotoCoreError, ClientError
        except ImportError:
            detail = "needs boto3: install svcheck with the aws extra"
            return Result(self.name, Status.FAIL, detail, elapsed_ms(start))
        try:
            # botocore waits 60 s and retries on its own by default: keep both bounded
            config = Config(
                connect_timeout=self.timeout,
                read_timeout=self.timeout,
                retries={"mode": "standard", "max_attempts": 2},
            )
            client = self.client or boto3.client("s3", config=config)
            client.head_bucket(Bucket=self.bucket)
        except ClientError as err:
            code = err.response.get("Error", {}).get("Code", "unknown")
            return Result(self.name, Status.FAIL, f"{self.bucket}: {code}", elapsed_ms(start))
        except BotoCoreError as err:  # no or partial credentials, unknown profile, network
            return Result(self.name, Status.FAIL, str(err), elapsed_ms(start))
        return Result(self.name, Status.OK, f"{self.bucket} is reachable", elapsed_ms(start))
```

Install everything, including the `aws` extra and the development tools. `uv sync` creates `.venv`, writes `uv.lock` and installs svcheck itself in **editable** mode, so changes to the source take effect without reinstalling:

```terminal
{
  "title": "uv sync",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv sync --all-extras 2>&1 | tail -n 4",
      "output": " + six==1.17.0\n + svcheck==0.1.0 (from file:///home/dev/svcheck)\n + typing-extensions==4.16.0\n + urllib3==2.8.0"
    },
    {
      "cmd": "uv run svcheck --version",
      "output": "svcheck 0.1.0"
    }
  ]
}
```

## Run It

A config for this machine, using the test API on port 8080 for the HTTP checks:

```toml
# Checks for this host: svcheck services.toml
[defaults]
timeout = 2.0
retries = 2

[[check]]
name = "api"
type = "http"
url = "http://127.0.0.1:8080/health"

[[check]]
name = "api-warmup"
type = "http"
url = "http://127.0.0.1:8080/flaky?client=svcheck"

[[check]]
name = "postgres"
type = "tcp"
host = "127.0.0.1"
port = 5432
timeout = 1.0

[[check]]
name = "tmp-disk"
type = "disk"
path = "/tmp"

[[check]]
name = "git"
type = "command"
command = ["git", "--version"]
```

```terminal
{
  "title": "svcheck in action",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv run svcheck services.toml -v; echo \"exit code $?\"",
      "output": "INFO svcheck.runner: postgres: [Errno 111] Connection refused, retry 1/2 in 0.5s\nINFO svcheck.runner: api-warmup: HTTP 503, retry 1/2 in 0.8s\nINFO svcheck.runner: postgres: [Errno 111] Connection refused, retry 2/2 in 1.6s\nINFO svcheck.runner: api-warmup: HTTP 503, retry 2/2 in 0.8s\nSTATUS  CHECK          TIME  DETAIL\nOK      api           479ms  HTTP 200\nOK      api-warmup     44ms  HTTP 200\nFAIL    postgres        0ms  [Errno 111] Connection refused\nOK      tmp-disk        4ms  0.0% used\nOK      git            10ms  git version 2.39.5\n4 ok, 0 warn, 1 fail\nexit code 1"
    },
    {
      "comment": "the warm-up endpoint is healthy by now; JSON for other tools",
      "cmd": "uv run svcheck services.toml --json | head -n 8",
      "output": "[\n  {\n    \"name\": \"api\",\n    \"status\": \"ok\",\n    \"detail\": \"HTTP 200\",\n    \"duration_ms\": 127.5,\n    \"retryable\": false\n  },"
    },
    {
      "cmd": "printf '[[check]]\\nname = \"db\"\\ntype = \"tcp\"\\nhost = \"db-01\"\\n' > broken.toml && uv run svcheck broken.toml; echo \"exit code $?\"",
      "output": "ERROR svcheck: broken.toml: check 1: missing key 'port'\nexit code 2"
    },
    {
      "cmd": "uv run svcheck --help",
      "output": "usage: svcheck [-h] [--json] [--workers N] [--output FILE] [-v] [--version]\n               config\n\nRun HTTP, TCP, disk and command checks from a TOML file.\n\npositional arguments:\n  config         TOML file with [[check]] tables\n\noptions:\n  -h, --help     show this help message and exit\n  --json         print the results as JSON\n  --workers N    checks to run at once (default: 8)\n  --output FILE  also write the report to FILE, atomically\n  -v, --verbose  log retries\n  --version      show program's version number and exit\n\nExit codes: 0 nothing failed, 1 a check failed, 2 usage or config error."
    }
  ]
}
```

The first run shows the whole design at work. With `-v`, the log lines (on standard error) show `api-warmup` failing twice and passing on its second retry, while `postgres` failed all three attempts because nothing listens on port 5432 here. The table lists the last attempt of each check, and the exit code is 1 because a check failed. A broken config exits with 2 and one line that names the file, the check and the problem.

### Threads in action

Five checks against an endpoint that takes a second to answer show what the thread pool buys you. The `time` numbers come from a small ARM board, and include just under a second for `uv run` and Python to start:

```toml
[[check]]
name = "slow-1"
type = "http"
url = "http://127.0.0.1:8080/slow?seconds=1&n=1"

[[check]]
name = "slow-2"
type = "http"
url = "http://127.0.0.1:8080/slow?seconds=1&n=2"

[[check]]
name = "slow-3"
type = "http"
url = "http://127.0.0.1:8080/slow?seconds=1&n=3"

[[check]]
name = "slow-4"
type = "http"
url = "http://127.0.0.1:8080/slow?seconds=1&n=4"

[[check]]
name = "slow-5"
type = "http"
url = "http://127.0.0.1:8080/slow?seconds=1&n=5"
```

```terminal
{
  "title": "one worker versus five",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "time uv run svcheck slow.toml --workers 1 > /dev/null",
      "output": "real\t0m5.855s\nuser\t0m0.768s\nsys\t0m0.086s"
    },
    {
      "cmd": "time uv run svcheck slow.toml --workers 5 > /dev/null",
      "output": "real\t0m1.728s\nuser\t0m0.706s\nsys\t0m0.116s"
    }
  ]
}
```

Stopping a run is quick too. With one worker, a `SIGTERM` after 1.5 seconds lets the check in progress finish, drops the queued checks and exits with 143. The running check is not interrupted, and httpx's timeouts limit each wait for the server, not the whole request, so a server that keeps sending a little data now and then can hold that last check open for longer. The command calls `.venv/bin/svcheck` directly, so the signal goes straight to svcheck rather than to `uv run`:

```terminal
{
  "title": "a clean stop on SIGTERM",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "start=$SECONDS; .venv/bin/svcheck slow.toml --workers 1 & pid=$!; sleep 1.5; kill -TERM \"$pid\"; wait \"$pid\"; echo \"exit code $?, stopped after $((SECONDS - start))s\"",
      "output": "exit code 143, stopped after 1s"
    }
  ]
}
```

For checks like these, threads are the simplest choice. The alternatives, for when you need them:

- **asyncio** with `httpx.AsyncClient` and `asyncio.TaskGroup` (Python 3.11 and later) handles thousands of concurrent connections in one thread. Start it with `asyncio.run(main())`: since Python 3.14, `asyncio.get_event_loop()` raises a `RuntimeError` when there is no current event loop instead of creating one, which breaks some older code. Python 3.14 can also show what a running asyncio program is waiting on with `python -m asyncio ps PID`.
- **Processes** (`concurrent.futures.ProcessPoolExecutor`) for CPU-heavy work such as parsing huge files, because the GIL lets only one thread run Python code at a time. On Linux, Python 3.14 changed the default way of starting worker processes from `fork` to `forkserver`, which can break code that relied on `fork` copying the parent's state.
- **The free-threaded build** (`uv python install 3.14t`) runs Python threads truly in parallel. Since 3.14 it is officially supported but optional, single-threaded code is about 5 to 10% slower on it, and every compiled library you use must support it.

## Test with pytest

pytest finds files named `test_*.py`, runs every function named `test_*` and reports each `assert` that fails with the values involved. **Fixtures** provide what tests need: pytest's built-in `tmp_path` (a fresh directory), `monkeypatch` (temporarily replace a function or environment variable), `capsys` and `caplog` (captured output and logs), and your own fixtures in `conftest.py`. This one starts a real HTTP server on a free port, so the HTTP check is tested over a real connection without mocking anything:

```python
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        status = {"/health": 200, "/missing": 404}.get(self.path, 503)
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        pass


@pytest.fixture
def http_server() -> Iterator[str]:
    """A real HTTP server on a free port: /health 200, /missing 404, anything else 503."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()
```

```python
import socket
from types import SimpleNamespace

import pytest

from svcheck.checks import CommandCheck, DiskCheck, HttpCheck, Status, TcpCheck


def test_http_ok(http_server: str) -> None:
    assert HttpCheck("api", f"{http_server}/health").run().status is Status.OK


def test_http_permanent_failure(http_server: str) -> None:
    result = HttpCheck("api", f"{http_server}/missing").run()
    assert (result.status, result.detail, result.retryable) == (Status.FAIL, "HTTP 404", False)


def test_http_temporary_failure(http_server: str) -> None:
    result = HttpCheck("api", f"{http_server}/busy").run()
    assert (result.status, result.detail, result.retryable) == (Status.FAIL, "HTTP 503", True)


def test_tcp_open_then_closed() -> None:
    with socket.create_server(("127.0.0.1", 0)) as listener:
        port = listener.getsockname()[1]
        assert TcpCheck("db", "127.0.0.1", port).run().status is Status.OK
    assert TcpCheck("db", "127.0.0.1", port, timeout=0.5).run().status is Status.FAIL


@pytest.mark.parametrize(
    ("used", "expected"),
    [(50, Status.OK), (85, Status.WARN), (95, Status.FAIL)],
)
def test_disk_thresholds(monkeypatch: pytest.MonkeyPatch, used: int, expected: Status) -> None:
    fake = SimpleNamespace(total=100, used=used, free=100 - used)
    monkeypatch.setattr("svcheck.checks.shutil.disk_usage", lambda path: fake)
    assert DiskCheck("root").run().status is expected


def test_disk_without_capacity(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = SimpleNamespace(total=0, used=0, free=0)  # what /proc reports on Linux
    monkeypatch.setattr("svcheck.checks.shutil.disk_usage", lambda path: fake)
    result = DiskCheck("proc", path="/proc").run()
    assert (result.status, result.detail) == (Status.FAIL, "no measurable capacity")


def test_command_results() -> None:
    assert CommandCheck("ok", ["true"]).run().status is Status.OK
    failed = CommandCheck("fails", ["false"]).run()
    assert (failed.status, failed.detail) == (Status.FAIL, "exit 1: ")
    slow = CommandCheck("slow", ["sleep", "5"], timeout=0.2).run()
    assert slow.status is Status.FAIL
    assert "timed out" in slow.detail
    assert CommandCheck("missing", ["no-such-command"]).run().status is Status.FAIL
```

`@pytest.mark.parametrize` runs one test function with several inputs, and each case is reported separately. The disk test uses `monkeypatch` to replace `shutil.disk_usage` with a function that returns fixed numbers, because the real disk's usage is not under the test's control.

The config tests write small TOML files into `tmp_path` and check that every kind of mistake gives the right message:

```python
from pathlib import Path

import pytest

from svcheck.checks import HttpCheck, TcpCheck
from svcheck.config import ConfigError, load_config

VALID = """
[defaults]
timeout = 3.0
retries = 1

[[check]]
name = "api"
type = "http"
url = "http://127.0.0.1:8080/health"

[[check]]
name = "db"
type = "tcp"
host = "127.0.0.1"
port = 5432
timeout = 1.0
"""


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "services.toml"
    path.write_text(text, encoding="utf-8")
    return path


def test_valid_config(tmp_path: Path) -> None:
    checks, retries = load_config(write(tmp_path, VALID))
    assert retries == 1
    assert checks == [
        HttpCheck("api", "http://127.0.0.1:8080/health", 3.0),
        TcpCheck("db", "127.0.0.1", 5432, 1.0),
    ]


@pytest.mark.parametrize(
    ("text", "message"),
    [
        ("", "no [[check]] tables"),
        ('[[check]]\nname = "x"\ntype = "ftp"\n', "unknown type 'ftp'"),
        ('[[check]]\nname = "x"\ntype = "tcp"\nhost = "h"\n', "missing key 'port'"),
        ('[[check]]\nname = "x"\ntype = "tcp"\nhost = "h"\nport = "ssh"\n', "port must be"),
        ('[[check]]\nname = "x"\ntype = "command"\ncommand = "true"\n', "non-empty list"),
        ('defaults = 1\n[[check]]\nname = "x"\ntype = "disk"\n', "[defaults] table"),
        ('[defaults]\ntimeout = "oops"\n[[check]]\nname = "x"\ntype = "disk"\n', "positive number"),
        ('[[check]]\nname = "x"\ntype = "disk"\nmax_used_percent = nan\n', "positive number"),
        ('[[check]]\nname = "x"\ntype = "http"\nurl = "http://localhost:abc/"\n', "invalid port"),
        ('[[check]]\nname = "x"\ntype = "http"\nurl = "ftp://files/"\n', "http:// or https://"),
        ('[[check]]\nname = "x"\ntype = "disk"\n' * 2, "duplicate check names: x"),
        ("[[check]\n", "at line 1"),
    ],
)
def test_invalid_config(tmp_path: Path, text: str, message: str) -> None:
    with pytest.raises(ConfigError) as info:
        load_config(write(tmp_path, text))
    assert message in str(info.value)


def test_not_utf8(tmp_path: Path) -> None:
    path = tmp_path / "services.toml"
    path.write_bytes(b'[[check]]\nname = "caf\xe9"\n')
    with pytest.raises(ConfigError, match="can't decode"):
        load_config(path)


def test_missing_file(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="no such file"):
        load_config(tmp_path / "missing.toml")
```

And the CLI tests check the contract that scripts depend on, the output format and the exit codes:

```python
import json
from pathlib import Path

import pytest

from svcheck.cli import main


def test_json_output_and_exit_code(
    tmp_path: Path, http_server: str, capsys: pytest.CaptureFixture[str]
) -> None:
    config = tmp_path / "services.toml"
    config.write_text(
        f'[[check]]\nname = "api"\ntype = "http"\nurl = "{http_server}/health"\n\n'
        f'[[check]]\nname = "broken"\ntype = "http"\nurl = "{http_server}/broken"\n',
        encoding="utf-8",
    )
    report = tmp_path / "last.json"
    assert main([str(config), "--json", "--output", str(report)]) == 1
    results = json.loads(capsys.readouterr().out)
    assert [(r["name"], r["status"]) for r in results] == [("api", "ok"), ("broken", "fail")]
    assert json.loads(report.read_text(encoding="utf-8")) == results
    assert report.stat().st_mode & 0o777 == 0o600


def test_config_error_exits_2(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    assert main([str(tmp_path / "missing.toml")]) == 2
    assert "no such file" in caplog.text


def test_bad_option_exits_2() -> None:
    with pytest.raises(SystemExit) as info:
        main(["services.toml", "--workers", "0"])
    assert info.value.code == 2
```

The runner test needs no network at all. A small fake class that matches the `Check` Protocol fails a set number of times, which pins down exactly when the runner retries:

```python
import threading
from dataclasses import dataclass

from svcheck.checks import Result, Status
from svcheck.runner import run_checks


@dataclass
class FlakyCheck:
    """A fake check that fails a given number of times, then passes."""

    name: str
    failures: int
    retryable: bool = True
    calls: int = 0

    def run(self) -> Result:
        self.calls += 1
        if self.calls <= self.failures:
            return Result(self.name, Status.FAIL, "down", retryable=self.retryable)
        return Result(self.name, Status.OK, "up")


def test_retries_until_success() -> None:
    check = FlakyCheck("api", failures=2)
    [result] = run_checks([check], retries=2, delay=0)
    assert (result.status, check.calls) == (Status.OK, 3)


def test_gives_up_after_the_last_retry() -> None:
    check = FlakyCheck("api", failures=5)
    [result] = run_checks([check], retries=2, delay=0)
    assert (result.status, check.calls) == (Status.FAIL, 3)


def test_never_retries_a_permanent_failure() -> None:
    check = FlakyCheck("api", failures=5, retryable=False)
    [result] = run_checks([check], retries=2, delay=0)
    assert (result.status, check.calls) == (Status.FAIL, 1)


def test_stop_ends_retries_at_once() -> None:
    stop = threading.Event()
    stop.set()
    check = FlakyCheck("api", failures=5)
    [result] = run_checks([check], retries=2, delay=10, stop=stop)
    assert (result.status, check.calls) == (Status.FAIL, 1)
```

And the AWS tests use botocore's `Stubber`, explained in the AWS section below:

```python
import pytest

boto3 = pytest.importorskip("boto3")
from botocore.stub import Stubber  # noqa: E402

from svcheck.aws import S3BucketCheck  # noqa: E402
from svcheck.checks import Status  # noqa: E402


def make_client() -> object:
    # Fake credentials and a fixed region: the Stubber answers, nothing reaches AWS.
    return boto3.client(
        "s3",
        region_name="eu-west-1",
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )


def test_bucket_reachable() -> None:
    client = make_client()
    with Stubber(client) as stub:
        stub.add_response("head_bucket", {}, {"Bucket": "backups"})
        result = S3BucketCheck("backups", "backups", client=client).run()
    assert result.status is Status.OK


def test_bucket_missing() -> None:
    client = make_client()
    with Stubber(client) as stub:
        stub.add_client_error(
            "head_bucket",
            service_error_code="404",
            http_status_code=404,
            expected_params={"Bucket": "backups"},
        )
        result = S3BucketCheck("backups", "backups", client=client).run()
    assert (result.status, result.detail) == (Status.FAIL, "backups: 404")
```

```terminal
{
  "title": "run the tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv run pytest",
      "output": "============================= test session starts ==============================\nplatform linux -- Python 3.14.9, pytest-9.1.1, pluggy-1.7.0\nrootdir: /home/dev/svcheck\nconfigfile: pyproject.toml\ntestpaths: tests\nplugins: anyio-4.15.1\ncollected 33 items\n\ntests/test_aws.py ..                                                     [  6%]\ntests/test_checks.py .........                                           [ 33%]\ntests/test_cli.py ...                                                    [ 42%]\ntests/test_config.py ...............                                     [ 87%]\ntests/test_runner.py ....                                                [100%]\n\n============================== 33 passed in 6.12s =============================="
    }
  ]
}
```

## Lint, Format and Type Check

**Ruff** is a linter and formatter in one fast binary: `ruff check` finds bugs and bad patterns (the rules selected in `pyproject.toml` include pyflakes, bugbear, import sorting and pyupgrade), and `ruff format` formats code in a style compatible with Black. **mypy** with `strict = true` checks every function's types, including the tests:

```terminal
{
  "title": "ruff and mypy",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv run ruff check",
      "output": "All checks passed!"
    },
    {
      "cmd": "uv run ruff format --check",
      "output": "15 files already formatted"
    },
    {
      "cmd": "uv run mypy",
      "output": "Success: no issues found in 14 source files"
    }
  ]
}
```

To see them earn their keep, make two typical mistakes. Add an import nobody uses to the top of `src/svcheck/report.py`, after `import os`:

```python
import os
import shutil
import stat
```

and save a small script, `src/svcheck/scratch.py`, that mixes up a number and a string:

```python
from svcheck.checks import DiskCheck

result = DiskCheck("root").run()
print("took " + result.duration_ms + " ms")
```

```terminal
{
  "title": "both tools catch a mistake",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv run ruff check",
      "output": "F401 [*] `shutil` imported but unused\n --> src/svcheck/report.py:6:8\n  |\n4 | import json\n5 | import os\n6 | import shutil\n  |        ^^^^^^\n7 | import stat\n8 | import tempfile\n  |\nhelp: Remove unused import: `shutil`\n  |\n5 | import os\n  - import shutil\n6 | import stat\n  |\n\nFound 1 error.\n[*] 1 fixable with `--fix`."
    },
    {
      "cmd": "uv run mypy",
      "output": "src/svcheck/scratch.py:4: error: Unsupported operand types for + (\"str\" and \"float\")  [operator]\nFound 1 error in 1 file (checked 15 source files)"
    },
    {
      "comment": "let Ruff fix the import, delete the scratch file, check again",
      "cmd": "uv run ruff check --fix",
      "output": "Found 1 error (1 fixed, 0 remaining)."
    },
    {
      "cmd": "rm src/svcheck/scratch.py && uv run mypy",
      "output": "Success: no issues found in 14 source files"
    }
  ]
}
```

The string mistake would otherwise only show up when that line runs, as a `TypeError`; mypy finds it without running anything. Run these tools in your editor as you type, in a pre-commit hook, and in CI.

## Test on Every Supported Python

`requires-python = ">=3.12"` is a promise. `uv run --isolated --python X` runs the tests in a temporary environment with another Python version, downloading it if needed, and leaves the project's `.venv` on 3.14:

```terminal
{
  "title": "3.12 and 3.15",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv run --isolated --all-extras --python 3.12 pytest -q 2>&1 | tail -n 2",
      "output": ".................................                                        [100%]\n33 passed in 11.28s"
    },
    {
      "cmd": "uv run --isolated --all-extras --python 3.15 pytest -q 2>&1 | tail -n 2",
      "output": ".................................                                        [100%]\n33 passed in 13.89s"
    }
  ]
}
```

The same code passes on Python 3.12 and on 3.15.1. Nothing in svcheck depends on a 3.13 or 3.14 feature; if it did (for example `except A, B:` without parentheses or a t-string, which need 3.14), the 3.12 run would fail here, long before a user hit it.

## Build and Install the Tool

`uv build` produces the two standard distribution files: a **source distribution** (`.tar.gz`) and a **wheel** (`.whl`), the ready-to-install package. Because svcheck is pure Python, one wheel (`py3-none-any`) works on every platform:

```terminal
{
  "title": "build and install",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv build",
      "output": "Building source distribution...\nBuilding wheel from source distribution...\nSuccessfully built dist/svcheck-0.1.0.tar.gz\nSuccessfully built dist/svcheck-0.1.0-py3-none-any.whl"
    },
    {
      "cmd": "uv tool install dist/svcheck-0.1.0-py3-none-any.whl",
      "output": "Resolved 7 packages in 199ms\nPrepared 1 package in 9ms\nInstalled 7 packages in 10ms\n + anyio==4.15.1\n + certifi==2026.10.23\n + h11==0.16.0\n + httpcore==1.0.9\n + httpx==0.28.1\n + idna==3.20\n + svcheck==0.1.0 (from file:///home/dev/svcheck/dist/svcheck-0.1.0-py3-none-any.whl)\nInstalled 1 executable: svcheck"
    },
    {
      "cmd": "cd /tmp && which svcheck && svcheck ~/svcheck/services.toml | tail -n 1",
      "output": "/home/dev/.local/bin/svcheck\n4 ok, 0 warn, 1 fail"
    },
    {
      "cmd": "cd ~/svcheck"
    }
  ]
}
```

`uv tool install` gave svcheck its own environment and put the command in `~/.local/bin`, so it runs from any directory with no virtual environment active, exactly as it would on a server. To share it, publish the wheel to PyPI or a private index (`uv publish`; on GitHub, use trusted publishing so no long-lived token is stored), or install straight from Git: `uv tool install git+https://github.com/<you>/svcheck`.

## Talking to AWS with boto3

Cloud providers ship Python SDKs, and in AWS's case the SDK is **boto3**. svcheck's optional `S3BucketCheck` (`src/svcheck/aws.py`, shown above) checks that a bucket exists and is reachable with the current credentials. It follows the usual boto3 pattern: create a **client** for the service, call an API operation (`head_bucket`), and handle two kinds of errors. `ClientError` means AWS answered with an error code (`403`, `404`, `NoSuchBucket`, ...), and `BotoCoreError` means the request never got an answer (no credentials, a network problem, a bad configuration). This guide uses no AWS account, so it does not show a successful call; the runs below test the code without one.

Never put access keys in code or in the config file. boto3 finds credentials itself and uses the first source that has them: environment variables (`AWS_ACCESS_KEY_ID` and friends), a web identity token (EKS IRSA), the shared files `~/.aws/credentials` and `~/.aws/config` (including SSO profiles selected with `AWS_PROFILE`), and finally the role of the container or machine it runs on (an ECS task role, EKS Pod Identity or an EC2 instance profile). The boto3 documentation lists the exact order. In production, use a role; on a laptop, use SSO.

Without any credentials, the check fails cleanly instead of crashing. `AWS_EC2_METADATA_DISABLED=true` stops boto3 from first trying the EC2 metadata endpoint, which only exists on EC2 and otherwise costs a few seconds of timeouts:

```terminal
{
  "title": "no credentials",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "AWS_EC2_METADATA_DISABLED=true uv run python -c 'from svcheck.aws import S3BucketCheck; print(S3BucketCheck(\"backups\", \"acme-backups\").run())'",
      "output": "Result(name='backups', status=<Status.FAIL: 'fail'>, detail='Unable to locate credentials', duration_ms=832.5, retryable=False)"
    }
  ]
}
```

To test code that calls AWS without an account, botocore's `Stubber` replaces the HTTP layer of a client with canned responses and checks the parameters you send. That is what `tests/test_aws.py` above does, with fake credentials and a fixed region so nothing ever reaches AWS; both of its tests were part of the run above. For larger AWS test suites, the `moto` library emulates whole services in memory. Two more boto3 habits: use **paginators** (`client.get_paginator("list_objects_v2")`) for any list call, because AWS list APIs return results in pages (S3's `list_objects_v2` returns at most 1,000 keys per call), and prefer **clients** to the older `resource` interface, which the boto3 team no longer adds features to.

## Continuous Integration

A workflow that runs the same commands on every push and pull request, on every supported Python version. The actions are pinned to full commit SHAs (with the version in a comment), so a moved tag cannot change what runs, and `uv sync --locked` fails if `uv.lock` is out of date with `pyproject.toml`:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: false
      matrix:
        python: ['3.12', '3.13', '3.14', '3.15']
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: astral-sh/setup-uv@07a047e608db84b3d8c06cd9a7c7dcc9c355c18e # v10.3.2
        with:
          version: '0.13.5'
          python-version: ${{ matrix.python }}
          enable-cache: true
      - run: uv sync --locked --all-extras
      - run: uv run ruff check
      - run: uv run ruff format --check
      - run: uv run mypy
      - run: uv run pytest
```

```terminal
{
  "title": "lint the workflow",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "actionlint && echo \"workflow ok\"",
      "output": "workflow ok"
    }
  ]
}
```

[actionlint](https://github.com/rhysd/actionlint) checks the workflow's syntax, expressions and action inputs (see the prerequisites for installing it). The workflow itself was not run on GitHub for this guide. The [CI/CD guide](/guides/introduction-to-cicd) covers workflows, caching and hardening in depth.

## Run It on a Schedule

On a single server, cron or a systemd timer runs the checks and alerting picks up the exit code or the JSON. These are examples to adapt, not runs from this guide:

```tabs
{
  "title": "Schedule svcheck",
  "tabs": [
    {
      "label": "systemd timer",
      "lang": "ini",
      "code": "# /etc/systemd/system/svcheck.service\n[Unit]\nDescription=Run service checks\n\n[Service]\nType=oneshot\nUser=svcheck\nExecStart=/home/svcheck/.local/bin/svcheck /etc/svcheck/services.toml --json\n\n# /etc/systemd/system/svcheck.timer\n[Unit]\nDescription=Run service checks every 5 minutes\n\n[Timer]\nOnBootSec=2min\nOnUnitActiveSec=5min\n\n[Install]\nWantedBy=timers.target"
    },
    {
      "label": "cron",
      "lang": "bash",
      "code": "# crontab -e for a dedicated user; cron uses /bin/sh and a minimal PATH,\n# so give the full path to the installed command. --output replaces\n# last.json atomically after the checks; a config error leaves the old one.\n*/5 * * * * /home/svcheck/.local/bin/svcheck /etc/svcheck/services.toml --json --output /var/log/svcheck/last.json > /dev/null 2>> /var/log/svcheck/errors.log"
    },
    {
      "label": "container",
      "lang": "dockerfile",
      "code": "FROM python:3.14-slim\nCOPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv\nWORKDIR /app\nCOPY pyproject.toml uv.lock README.md ./\nCOPY src ./src\nRUN uv sync --locked --no-dev --no-editable\nUSER nobody\nENTRYPOINT [\"/app/.venv/bin/svcheck\"]\nCMD [\"/etc/svcheck/services.toml\", \"--json\"]"
    }
  ]
}
```

In the container, the `ENTRYPOINT` in exec form makes svcheck PID 1, so it receives `SIGTERM` directly. That only helps because `cli.py` handles the signal: Linux does not apply the default "terminate" action to PID 1, so a PID 1 without a handler ignores `SIGTERM` until Docker kills it after its grace period.

## Where to Go Next

You now have the skills and the project structure for real operations tooling. Directions worth exploring from here:

- **Typer or Click** instead of `argparse` for larger command-line tools with many subcommands. Typer builds the interface from type hints.
- **Pydantic** for validating complex configuration and API payloads into typed objects.
- **asyncio** for tools that talk to hundreds of endpoints at once.
- **Ansible modules and plugins**, which are Python, for automation that should live in your playbooks; see the [Ansible guide](/guides/introduction-to-ansible).
- **Python 3.15** features once your dependencies support it: explicit lazy imports (`lazy import json`) for faster start-up of command-line tools, the `frozendict` built-in, and Tachyon, a sampling profiler in the new `profiling.sampling` module that attaches to a running process.

## Common Mistakes

- **Code next to `pyproject.toml` instead of in `src/`.** Tests then pass against the working directory and fail against the installed package.
- **No lock file in Git**, or CI that updates it silently. Commit `uv.lock` and use `uv sync --locked`.
- **Logic in the CLI layer.** Keep `cli.py` thin, so tests can call plain functions.
- **Tests that need the network, a real cloud account or a particular disk.** Use local servers, `tmp_path`, `monkeypatch` and stubbers.
- **Testing only on your own Python version** when `requires-python` promises more.
- **Unpinned CI actions and tools**, and secrets in the workflow file.
- **`pip install` of tools into a project environment.** Use dependency groups for project tools and `uv tool install` for standalone commands.

## Summary

- `uv init --package` creates a `src` layout project; `pyproject.toml` holds metadata, dependencies, extras, dependency groups, the command entry point and tool settings; `uv.lock` pins everything.
- Split a tool into small modules: configuration, checks, running, reporting, and a thin CLI with `argparse` and clear exit codes.
- A thread pool runs I/O-bound checks in parallel; asyncio, processes and the free-threaded build are there when you need more.
- pytest with fixtures, `parametrize`, `tmp_path` and `monkeypatch` tests real behaviour; Ruff and mypy `--strict` catch mistakes before tests run; `uv run --isolated --python X` tests other versions.
- `uv build` makes a wheel, `uv tool install` installs it as a command, and a pinned CI workflow runs every check on every change.
- boto3 takes credentials from the environment or a role; `Stubber` and moto test AWS code without an account.

This is the end of the guide. Go back to the [guide overview](/guides/introduction-to-python) for the full list of parts, or test what you learned with the [Python Fundamentals Quiz](/quizzes/python-quiz).

## Keep Learning

- [Introduction to CI/CD with GitHub Actions](/guides/introduction-to-cicd), to run svcheck's checks in a full pipeline.
- [Shai-Hulud reaches PyPI](/posts/shai-hulud-hades-pypi-wave-june-2026): why pinned actions, locked dependencies and a release cooldown matter.
- [Why your Docker container exits immediately](/posts/why-docker-container-exits-immediately), for the PID 1 and signal behaviour of the container example.
- The [pytest documentation](https://docs.pytest.org/), the [Ruff rules](https://docs.astral.sh/ruff/rules/) and the [mypy cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html).
