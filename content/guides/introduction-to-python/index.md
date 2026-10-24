---
title: 'Introduction to Python'
seoTitle: 'Python for DevOps: A Hands-On Tutorial from First Script to Tested CLI'
description: 'Learn Python for DevOps with real output: Python 3.14 and uv, files and YAML, subprocess, HTTP retries, logging, classes, pytest and a packaged CLI.'
category:
  name: Python
  slug: python
publishedAt: '2025-05-21'
updatedAt: '2026-10-24T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - 'Python'
  - 'Scripting'
  - 'Automation'
  - 'uv'
  - 'pytest'
  - 'DevOps'
---

**Python** is the language DevOps engineers reach for when a shell script stops being enough: when you need to parse JSON or YAML, call an HTTP API with retries, handle errors properly, or test what you wrote. Cloud SDKs such as boto3, tools such as Ansible, and countless internal scripts and CLIs are written in it.

This guide teaches Python from the first line, through the lens of operations work. Every example is a small piece of something you would really write: reading settings from environment variables, waiting for a port to open, rolling out in batches, finding drift between two inventories, parsing gzipped logs, calling an API with timeouts and retries, running commands without a shell. Along the way the pieces grow into **svcheck**, a tested and packaged command-line tool that runs service checks from a TOML file, built in [Part 10](/guides/introduction-to-python/10-building-a-python-project).

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Parts 1 to 3", "sub": "install, types, control flow", "icon": "cpu", "tone": "slate" },
    { "label": "Parts 4 and 5", "sub": "functions, data structures", "icon": "gear", "tone": "blue" },
    { "label": "Parts 6 to 8", "sub": "packages, files, errors, HTTP", "icon": "box", "tone": "violet" },
    { "label": "Parts 9 and 10", "sub": "classes, a tested CLI tool", "icon": "check", "tone": "green" }
  ]
}
```

## What You'll Learn

1. **[Install Python 3.14 with uv](/guides/introduction-to-python/01-getting-started)**: which version to use in October 2026, uv and the system Python, the PEP 668 "externally managed" error, virtual environments, the REPL and your first script.
2. **[Variables and Data Types](/guides/introduction-to-python/02-variables-and-data-types)**: numbers and their traps, strings and f-strings, `bytes` versus `str`, truthiness, and settings from environment variables.
3. **[Control Flow](/guides/introduction-to-python/03-control-flow)**: `if`, `match`, `for` loops over hosts and batches, and `while` loops with deadlines, backoff and jitter.
4. **[Functions](/guides/introduction-to-python/04-functions)**: parameters, type hints checked by mypy, the mutable default trap, generators, recursion and a retry decorator.
5. **[Data Structures](/guides/introduction-to-python/05-data-structures)**: lists, dictionaries, sets, comprehensions, `Counter` and `defaultdict`, deep copies, and a drift report.
6. **[Modules and Packages](/guides/introduction-to-python/06-modules-and-packages)**: imports and packages, the standard library, virtual environments, pip and uv, lock files, a supply-chain cooldown and PEP 723 scripts.
7. **[File Operations](/guides/introduction-to-python/07-file-operations)**: `pathlib`, encodings, gzipped logs, JSON, YAML and TOML (and their traps), atomic writes, permissions and safe tar extraction.
8. **[Error Handling](/guides/introduction-to-python/08-error-handling)**: tracebacks, exceptions, logging, exit codes and `SIGTERM`, `subprocess` without injection, and HTTP calls with timeouts and retries.
9. **[Object-Oriented Programming](/guides/introduction-to-python/09-object-oriented)**: classes, dataclasses, enums, properties, special methods, Protocols and an API client class.
10. **[Building a Python Project](/guides/introduction-to-python/10-building-a-python-project)**: svcheck with a `src` layout, `pyproject.toml`, argparse, threads, pytest, Ruff, mypy `--strict`, Python 3.12 to 3.15, boto3 and CI.

## Python for DevOps at a Glance

- **Never install into the system Python.** Use a virtual environment per project and `uv tool install` for tools ([Part 1](/guides/introduction-to-python/01-getting-started), [Part 6](/guides/introduction-to-python/06-modules-and-packages)).
- **Lock your dependencies** with `uv.lock` (or hashed requirements) and update them on purpose ([Part 6](/guides/introduction-to-python/06-modules-and-packages)).
- **Convert and validate everything from outside**: environment variables, files and API responses are strings or untyped data until you check them ([Part 2](/guides/introduction-to-python/02-variables-and-data-types), [Part 7](/guides/introduction-to-python/07-file-operations)).
- **Every wait and every network call gets a timeout**, and retries get backoff and jitter ([Part 3](/guides/introduction-to-python/03-control-flow), [Part 8](/guides/introduction-to-python/08-error-handling)).
- **Pass `encoding="utf-8"`**, write important files atomically, and use `yaml.safe_load()` ([Part 7](/guides/introduction-to-python/07-file-operations)).
- **Run commands with a list of arguments and `check=True`**, never a shell string built from input ([Part 8](/guides/introduction-to-python/08-error-handling)).
- **Log to standard error, exit with meaningful codes**, and handle `SIGTERM` ([Part 8](/guides/introduction-to-python/08-error-handling)).
- **Type hints, Ruff, mypy and pytest in CI**, on every Python version you claim to support ([Part 10](/guides/introduction-to-python/10-building-a-python-project)).

## Which Versions This Guide Uses

The guide was updated on 24 October 2026. Python 3.15.0 was released on 9 October 2026 and 3.15.1 on 21 October; the guide uses **Python 3.14**, the mature current release (see [Part 1](/guides/introduction-to-python/01-getting-started) for why), and the tool built in Part 10 is also tested on 3.12 and 3.15. The terminal output comes from real runs as a normal user (`dev`) on a machine called `devbox`:

- **CPython 3.14.9 installed with uv 0.13.5** on Debian 12 (arm64), for almost everything.
- **Ubuntu 26.04.1 LTS** with its own Python 3.14.4 and pip 25.1.1, for the "externally managed environment" and `python3-venv` errors in Part 1.
- **CPython 3.12.15 and 3.15.1**, for the Part 10 tests on other versions.
- **httpx 0.28.1, PyYAML 6.0.3, pytest 9.1.1, Ruff 0.17.2, mypy 2.4.0, boto3 1.43.118 and actionlint 1.7.12.**

What is not a real run: the macOS and Windows tabs, the `requests` tab in Part 8, the systemd, cron and container examples in Part 10, the GitHub Actions workflow (checked with actionlint, not run on GitHub), and any call to a real AWS account (the AWS runs in Part 10 use no credentials and botocore's Stubber). Timings come from a small ARM board, so yours will be faster.

If you learned Python from an older tutorial, these are the changes that matter most:

| Old habit                                       | Now                                              | Why                                                      |
| ----------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| `sudo pip install x`                            | A virtual environment, or `uv tool install x`    | PEP 668 blocks it, and it can break system tools         |
| `setup.py` and a bare `requirements.txt`        | `pyproject.toml` and a lock file (`uv.lock`)     | Standard metadata; exact, hashed, reproducible installs  |
| `"%s" % x` and `"{}".format(x)`                 | f-strings (`logging` keeps `%` style)            | Shorter and easier to read                               |
| `os.path.join()` and friends                    | `pathlib.Path`                                   | One object for paths, listing, reading and writing       |
| `open(path)`                                    | `open(path, encoding="utf-8")`                   | The default depended on the locale until 3.15            |
| `datetime.utcnow()`                             | `datetime.now(UTC)`                              | Deprecated since 3.12; naive datetimes get mixed up      |
| `yaml.load(f)`                                  | `yaml.safe_load(f)`                              | Can run code; an error without a `Loader` since PyYAML 6 |
| `requests.get(url)`                             | `httpx.get(url)`, or `requests` with `timeout=`  | `requests` has no default timeout                        |
| `os.system(cmd)`, `shell=True` with input       | `subprocess.run([...], check=True, timeout=...)` | Injection, ignored failures, hangs                       |
| `tar.extractall(path)`                          | `tar.extractall(path, filter="data")`            | Path traversal; `data` is the default since 3.14         |
| `asyncio.get_event_loop().run_until_complete()` | `asyncio.run(main())`                            | `get_event_loop()` raises without a loop since 3.14      |
| `import telnetlib`, `cgi`, `distutils`          | Maintained libraries, `setuptools`               | Removed in Python 3.12 and 3.13                          |

## Prerequisites

- A computer with Linux, macOS or Windows, and a terminal. On Windows, follow the guide in WSL 2, because the examples use Linux commands. [Part 1](/guides/introduction-to-python/01-getting-started) installs everything else.
- Basic command-line use. If `cd`, pipes and environment variables are new to you, read the [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface) first; the [Bash guide](/guides/introduction-to-bash) is a good companion, since Python scripts usually run from the shell.
- No previous programming experience is needed, though it helps.

## Practice Hands-On

Parts 1 to 9 work in one directory, `~/pyops`, with one virtual environment, created in [Part 1](/guides/introduction-to-python/01-getting-started); Part 10 builds a separate project, `~/svcheck`. Each example is a complete file you can save and run, and the output you see is what it printed. Part 8 gives you a small local test API, so the HTTP examples work without any account or internet service.

## Keep Learning

- Test yourself with the [Python Fundamentals Quiz](/quizzes/python-quiz).
- [Python 3.15 made UTF-8 the default](/posts/python-3-15-utf-8-default-linux-locales): what changes on Linux when you upgrade.
- [What is the quickest way to HTTP GET in Python?](/posts/what-is-the-quickest-way-to-http-get-in-python) and [why open() does not create a file](/posts/python-open-does-not-create-file), two short answers to common questions.
- [Shai-Hulud reaches PyPI](/posts/shai-hulud-hades-pypi-wave-june-2026): the supply-chain risk behind lock files and cooldowns.
- Next guide: [Introduction to Ansible](/guides/introduction-to-ansible), configuration management written in, and extensible with, Python.

Start with [Part 1: Install Python 3.14 with uv](/guides/introduction-to-python/01-getting-started), or jump to [error handling, subprocess and HTTP retries](/guides/introduction-to-python/08-error-handling) if that is what you need today.
