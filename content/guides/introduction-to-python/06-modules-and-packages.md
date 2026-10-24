---
title: 'Python Modules, Packages and Virtual Environments with uv and pip'
description: 'Python imports and packages, the standard library for ops, virtual environments, PEP 668, uv projects and lock files, and PEP 723 single-file scripts.'
order: 6
---

So far every script has been a single file, and every module came with Python. Real tools outgrow both: the same helper ends up copied into five scripts, and you need libraries from the Python Package Index (PyPI), such as an HTTP client or a YAML parser. Getting this right is mostly about two things: organizing your own code into **modules and packages** that import cleanly, and installing other people's code into an **isolated environment** with versions you can reproduce on the next machine.

This part covers imports and how Python finds modules, packages and `python -m`, a tour of the standard library for operations work, virtual environments and the PEP 668 rule you met in Part 1, `pip` and `uv`, project files (`pyproject.toml` and `uv.lock`), command-line tools, and single-file scripts that declare their own dependencies.

## Prerequisites

- The `~/pyops` project from [Part 1](/guides/introduction-to-python/01-getting-started), with its virtual environment active, and uv installed.
- The `durations.py` and `retrying.py` files from [Part 4](/guides/introduction-to-python/04-functions). If you skipped them, this part shows what goes into each module.
- Network access to PyPI for the install steps.

## Modules and import

Every `.py` file is a **module**, and its name is the file name without `.py`. `import` runs the module once, the first time it is imported, and gives you its names. There are three forms:

```terminal
{
  "title": "import forms",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import json\n>>> json.dumps({\"ok\": True})\n'{\"ok\": true}'\n>>> from pathlib import Path\n>>> Path(\"/etc/hosts\").name\n'hosts'\n>>> import datetime as dt\n>>> dt.date(2026, 10, 24).isoformat()\n'2026-10-24'\n>>> exit()"
    }
  ]
}
```

- `import json` keeps the module name as a prefix (`json.dumps`), which makes it obvious where a name comes from.
- `from pathlib import Path` imports one name directly. Use it for names you use often.
- `import ... as ...` gives a module a shorter or clearer name.

Avoid `from module import *`: it dumps every public name into your file, hides where names come from and can silently replace your own names.

## Turn Helpers into a Package

A **package** is a directory of modules with an `__init__.py` file. Move the functions from Part 4 into a package called `opskit`, so every script can import them instead of copying them:

- `opskit/durations.py`: Part 4's `durations.py`, without its last line (the `print(parse_duration("1w"))` that shows the error).
- `opskit/retrying.py`: Part 4's `retrying.py`, without the demo at the bottom (everything from `calls = 0` down).

`opskit/__init__.py` runs when you import the package. It can be empty; here it re-exports the main functions with **relative imports** (the leading dot means "from this package"), so callers can write `from opskit import parse_duration`:

```python
"""Small helpers for operations scripts."""

from .durations import format_duration, parse_duration
from .retrying import retry

__all__ = ["format_duration", "parse_duration", "retry"]
__version__ = "0.1.0"
```

And `opskit/__main__.py` is what `python -m opskit` runs:

```python
"""Convert durations: python -m opskit 15m 2h"""

import sys

from . import __version__, format_duration, parse_duration

print(f"opskit {__version__}")
for arg in sys.argv[1:]:
    seconds = parse_duration(arg)
    print(f"{arg} = {seconds} s ({format_duration(seconds)})")
```

```terminal
{
  "title": "use the package",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "find opskit -name '*.py' | sort",
      "output": "opskit/__init__.py\nopskit/__main__.py\nopskit/durations.py\nopskit/retrying.py"
    },
    {
      "cmd": "python -c 'from opskit import parse_duration; print(parse_duration(\"15m\"))'",
      "output": "900"
    },
    {
      "comment": "run a module of the package as a script",
      "cmd": "python -m opskit.durations",
      "output": "<frozen runpy>:130: RuntimeWarning: 'opskit.durations' found in sys.modules after import of package 'opskit', but prior to execution of 'opskit.durations'; this may result in unpredictable behaviour\n 90s =     90 s = 1m30s\n 15m =    900 s = 15m\n  2h =   7200 s = 2h\n  1d =  86400 s = 24h"
    },
    {
      "comment": "run the package itself (opskit/__main__.py)",
      "cmd": "python -m opskit 90m 1d",
      "output": "opskit 0.1.0\n90m = 5400 s (1h30m)\n1d = 86400 s (24h)"
    }
  ]
}
```

### `if __name__ == "__main__":`

When Python runs a file as a script, it sets the module's `__name__` to `"__main__"`; when another file imports it, `__name__` is the module name (`opskit.durations`). The `if __name__ == "__main__":` block therefore runs only in the first case. Put demo code, a CLI entry point or a `main()` call there, so importing the module never has side effects such as parsing arguments or starting a server.

`python -m opskit.durations` runs a module _by its import name_. Prefer it over `python opskit/durations.py`: it sets up the import path the same way an import would, so relative imports inside the package keep working. The `RuntimeWarning` in the output is real and worth understanding: `python -m` first imports the package, `opskit/__init__.py` imports `opskit.durations`, and then Python runs the same file again as `__main__`, so the module exists twice. It is harmless here, but it is a sign to give a package one entry point, `__main__.py`, as the last command does.

## How Python Finds Modules

`import x` looks through the directories in `sys.path`, in order, and takes the first `x.py` or `x/` it finds:

```terminal
{
  "title": "the import path",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -c 'import sys, pprint; pprint.pprint(sys.path)'",
      "output": "['',\n '/home/dev/.local/share/uv/python/cpython-3.14.9-linux-aarch64-gnu/lib/python314.zip',\n '/home/dev/.local/share/uv/python/cpython-3.14.9-linux-aarch64-gnu/lib/python3.14',\n '/home/dev/.local/share/uv/python/cpython-3.14.9-linux-aarch64-gnu/lib/python3.14/lib-dynload',\n '/home/dev/pyops/.venv/lib/python3.14/site-packages']"
    }
  ]
}
```

The first entry, `''`, stands for the current directory (with `python script.py` it is the script's directory instead). Then come the standard library and the environment's `site-packages`, where installed packages live. That order explains one of the most confusing errors in Python: a file of yours with the same name as a module you import **shadows** it. Since Python 3.13 the error message says so:

```terminal
{
  "title": "a file that shadows the standard library",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p ~/shadow && cd ~/shadow && printf 'import random\\nprint(random.choice([\"web-01\", \"web-02\"]))\\n' > random.py"
    },
    {
      "cmd": "python random.py",
      "output": "Traceback (most recent call last):\n  File \"/home/dev/shadow/random.py\", line 1, in <module>\n    import random\n  File \"/home/dev/shadow/random.py\", line 2, in <module>\n    print(random.choice([\"web-01\", \"web-02\"]))\n          ^^^^^^^^^^^^^\nAttributeError: module 'random' has no attribute 'choice' (consider renaming '/home/dev/shadow/random.py' since it has the same name as the standard library module named 'random' and prevents importing that standard library module)"
    },
    {
      "cmd": "cd ~/pyops && rm -r ~/shadow"
    }
  ]
}
```

Never name your files after modules you use: `random.py`, `json.py`, `logging.py`, `email.py`, `test.py`, `requests.py`, `yaml.py`.

## The Standard Library for Operations Work

Python ships with a large standard library, so many scripts need no third-party packages at all. These are the modules this guide uses, and the ones worth knowing first:

| Module                                   | Use it for                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `pathlib`, `shutil`, `tempfile`          | Paths, copying and deleting trees, disk usage, temporary files (Part 7) |
| `json`, `tomllib`, `csv`, `configparser` | Reading and writing data formats (Part 7)                               |
| `subprocess`, `shlex`                    | Running commands safely (Part 8)                                        |
| `logging`                                | Log messages with levels and timestamps (Part 8)                        |
| `argparse`                               | Command-line options and `--help` (Part 10)                             |
| `os`, `sys`, `platform`                  | Environment variables, exit codes, system information                   |
| `datetime`, `zoneinfo`, `time`           | Timestamps, time zones, durations and monotonic clocks                  |
| `socket`, `ipaddress`, `ssl`             | Ports, addresses and networks, certificates                             |
| `urllib.request`                         | Simple HTTP without dependencies                                        |
| `hashlib`, `hmac`, `secrets`             | Checksums, webhook signatures, tokens and passwords                     |
| `re`                                     | Regular expressions                                                     |
| `concurrent.futures`                     | Running checks in parallel threads (Part 10)                            |

Three of them in action. `ipaddress` answers network questions that are easy to get wrong with string handling, `hashlib` checksums a file, and `datetime` with `UTC` gives timezone-aware timestamps:

```terminal
{
  "title": "ipaddress, hashlib and datetime",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import ipaddress\n>>> net = ipaddress.ip_network(\"10.20.0.0/22\")\n>>> net.num_addresses, net.netmask, str(net.broadcast_address)\n(1024, IPv4Address('255.255.252.0'), '10.20.3.255')\n>>> ipaddress.ip_address(\"10.20.3.17\") in net\nTrue\n>>> [str(s) for s in net.subnets(new_prefix=24)]\n['10.20.0.0/24', '10.20.1.0/24', '10.20.2.0/24', '10.20.3.0/24']\n>>> import hashlib\n>>> hashlib.sha256(b\"release-1.4.2.tar.gz contents\").hexdigest()[:16]\n'0e1d03bbf0a28d49'\n>>> from datetime import datetime, UTC\n>>> stamp = datetime(2026, 10, 24, 9, 30, tzinfo=UTC)\n>>> stamp.isoformat()\n'2026-10-24T09:30:00+00:00'\n>>> datetime.fromisoformat(\"2026-10-24T11:30:00+02:00\") == stamp\nTrue\n>>> exit()"
    }
  ]
}
```

For real files, `hashlib.file_digest(f, "sha256")` (Python 3.11 and later) hashes an open binary file without loading it all into memory.

Always use **timezone-aware** datetimes in operations code: logs, certificates and APIs all deal in UTC. The old `datetime.utcnow()` returns a naive datetime that is easy to mix up with local time, and it is deprecated since Python 3.12:

```python
from datetime import UTC, datetime

old = datetime.utcnow()  # deprecated: a naive datetime, no time zone attached
new = datetime.now(UTC)  # aware: carries its UTC offset
print(old.tzinfo, new.tzinfo, new.isoformat(timespec="seconds"))
```

```terminal
{
  "title": "utcnow is deprecated",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python stamp.py",
      "output": "/home/dev/pyops/stamp.py:3: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).\n  old = datetime.utcnow()  # deprecated: a naive datetime, no time zone attached\nNone UTC 2026-10-24T09:34:44+00:00"
    }
  ]
}
```

Python 3.13 also _removed_ some old modules (PEP 594), including `telnetlib`, `cgi`, `cgitb`, `crypt`, `nntplib`, `pipes` and `audioop`; Python 3.12 removed `distutils`, `imp`, `asyncore` and `asynchat`. An old script that imports one of them fails with `ModuleNotFoundError` on a current Python. The replacements are `subprocess` and `shlex.quote` for `pipes`, a maintained library such as `telnetlib3` or `pexpect` for `telnetlib`, and `setuptools` or another build tool for `distutils`.

## Virtual Environments

A **virtual environment** is a directory with its own `site-packages` and a `python` that uses it, built on a base Python. Packages you install there do not affect the base Python or any other environment, so each project can have its own versions. It is just files; look inside the one Part 1 created:

```terminal
{
  "title": "inside .venv",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cat .venv/pyvenv.cfg",
      "output": "home = /home/dev/.local/share/uv/python/cpython-3.14-linux-aarch64-gnu/bin\nimplementation = CPython\nuv = 0.13.5\nversion_info = 3.14\ninclude-system-site-packages = false"
    },
    {
      "cmd": "ls .venv/bin",
      "output": "activate\nactivate.bat\nactivate.csh\nactivate.fish\nactivate.nu\nactivate.ps1\nactivate.xsh\nactivate_this.py\ndeactivate.bat\npydoc.bat\npython\npython3\npython3.14"
    },
    {
      "cmd": "python -c 'import sys; print(sys.prefix); print(sys.base_prefix)'",
      "output": "/home/dev/pyops/.venv\n/home/dev/.local/share/uv/python/cpython-3.14.9-linux-aarch64-gnu"
    }
  ]
}
```

`pyvenv.cfg` points to the base Python (`home`), and `bin/python` is a link to it. Python sees the config file, sets `sys.prefix` to the environment and keeps `sys.base_prefix` pointing at the base installation. Because the environment holds absolute paths, you cannot move or copy it to another directory or machine; recreate it instead (it takes seconds). Never commit `.venv` to Git.

Since this environment came from uv, its base is the uv-managed 3.14 directory, not a fixed patch version: `uv python upgrade 3.14` moves it to the next bug-fix release without recreating anything.

### PEP 668 and the system Python, again

Part 1 showed `pip install` failing on Ubuntu with "externally-managed-environment". Here are your options on a machine with a distribution Python, from best to worst:

| You want to                         | Do this                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Develop or run your own project     | A virtual environment per project (`uv venv`, `python3 -m venv`)                           |
| Install a command-line tool         | `uv tool install <tool>` or `pipx install <tool>`                                          |
| Use a library from system scripts   | The distribution's package: `apt install python3-requests`, `dnf install python3-requests` |
| Run a one-off script with a library | A script with inline metadata and `uv run` (below)                                         |
| Install into the system Python      | Do not. `--break-system-packages` exists, but it can break `apt` and other system tools    |

The same rule holds inside containers built from a distribution image: create a virtual environment in the image, or use the official `python` images, which are not marked as externally managed.

## Install Packages with pip and uv

The classic tool is **pip**, which installs packages from PyPI into the environment of the Python that runs it. Always run it as `python -m pip`, so you know which environment it installs into. One surprise: environments created by `uv venv` do not contain pip at all:

```terminal
{
  "title": "no pip in a uv environment",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -m pip install httpx",
      "output": "/home/dev/pyops/.venv/bin/python: No module named pip"
    }
  ]
}
```

You have three choices: use `uv pip`, uv's faster drop-in for the same commands, which installs into the active environment; create the environment with `uv venv --seed` to include pip; or create it with `python -m venv`, which always includes pip. With uv:

```terminal
{
  "title": "uv pip",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv pip install httpx",
      "output": "Resolved 7 packages in 183ms\nInstalled 7 packages in 11ms\n + anyio==4.15.1\n + certifi==2026.10.23\n + h11==0.16.0\n + httpcore==1.0.9\n + httpx==0.28.1\n + idna==3.20\n + typing-extensions==4.16.0"
    },
    {
      "cmd": "uv pip list",
      "output": "Package           Version\n----------------- ----------\nanyio             4.15.1\ncertifi           2026.10.23\nh11               0.16.0\nhttpcore          1.0.9\nhttpx             0.28.1\nidna              3.20\ntyping-extensions 4.16.0"
    },
    {
      "cmd": "uv pip freeze > requirements.txt && cat requirements.txt",
      "output": "anyio==4.15.1\ncertifi==2026.10.23\nh11==0.16.0\nhttpcore==1.0.9\nhttpx==0.28.1\nidna==3.20\ntyping-extensions==4.16.0"
    }
  ]
}
```

A **wheel** (`.whl`) is a ready-to-install package; for libraries with compiled code there is one per Python version and platform. When no wheel fits, pip and uv download the source distribution and build it, which needs a compiler and takes much longer. That is one reason to wait a few weeks before moving to a brand-new Python version.

`requirements.txt` with exact versions (`pip freeze`, `uv pip freeze`) is the traditional way to make an environment reproducible: `pip install -r requirements.txt` or `uv pip install -r requirements.txt` recreates it. It has two weaknesses: you have to separate the packages you chose from the ones they pulled in yourself, and it says nothing about the Python version. A project file and a lock file solve both.

## Projects: pyproject.toml and uv.lock

`pyproject.toml` is the standard file that describes a Python project: its name, the Python versions it supports and its direct dependencies. A **lock file** records the exact version (and file hashes) of every package in the resolved dependency tree, so every machine installs the same thing. uv manages both. Turn `~/pyops` into a project and add the two libraries the next parts use:

```terminal
{
  "title": "a uv project",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv init --bare --name pyops --python 3.14",
      "output": "Initialized project `pyops`"
    },
    {
      "cmd": "uv add httpx pyyaml",
      "output": "Resolved 9 packages in 223ms\nInstalled 1 package in 3ms\n + pyyaml==6.0.3"
    },
    {
      "cmd": "cat pyproject.toml",
      "output": "[project]\nname = \"pyops\"\nversion = \"0.1.0\"\nrequires-python = \">=3.14\"\ndependencies = [\n    \"httpx>=0.28.1\",\n    \"pyyaml>=6.0.3\",\n]"
    },
    {
      "cmd": "uv tree",
      "output": "Resolved 9 packages in 2ms\npyops v0.1.0\n├── httpx v0.28.1\n│   ├── anyio v4.15.1\n│   │   ├── idna v3.20\n│   │   └── typing-extensions v4.16.0\n│   ├── certifi v2026.10.23\n│   ├── httpcore v1.0.9\n│   │   ├── certifi v2026.10.23\n│   │   └── h11 v0.16.0\n│   └── idna v3.20\n└── pyyaml v6.0.3"
    }
  ]
}
```

`uv add` did four things: it added the dependencies to `pyproject.toml` with a minimum version, resolved the full tree, wrote `uv.lock`, and **synced** `.venv` with the lock (`httpx` was already installed, so only PyYAML was new). A full `uv sync` makes the environment match the lock _exactly_, so it also removes anything you installed by hand:

```terminal
{
  "title": "uv sync is exact",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv pip install --quiet six"
    },
    {
      "cmd": "uv sync",
      "output": "Resolved 9 packages in 2ms\nUninstalled 1 package in 1ms\n - six==1.17.0"
    }
  ]
}
```

Add packages with `uv add` and they stay. Commit `pyproject.toml` and `uv.lock` to Git; on another machine, `uv sync` recreates the same environment, and in CI `uv sync --locked` fails if the lock file is out of date instead of silently updating it.

`uv run <command>` syncs the environment first and then runs the command in it, so it works without activating anything:

```terminal
{
  "title": "uv run and uv lock",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv run python -c 'import httpx, yaml; print(httpx.__version__, yaml.__version__)'",
      "output": "0.28.1 6.0.3"
    },
    {
      "cmd": "grep -c '^\\[\\[package\\]\\]' uv.lock",
      "output": "9"
    },
    {
      "comment": "pip-compatible output for tools that do not read uv.lock",
      "cmd": "uv export --format requirements.txt --no-hashes --quiet | grep -v '^#'",
      "output": "anyio==4.15.1\n    # via httpx\ncertifi==2026.10.23\n    # via\n    #   httpcore\n    #   httpx\nh11==0.16.0\n    # via httpcore\nhttpcore==1.0.9\n    # via httpx\nhttpx==0.28.1\n    # via pyops\nidna==3.20\n    # via\n    #   anyio\n    #   httpx\npyyaml==6.0.3\n    # via pyops\ntyping-extensions==4.16.0 ; python_full_version < '3.15'\n    # via anyio"
    }
  ]
}
```

`uv export` writes the locked versions as `requirements.txt` (with hashes by default) or as `pylock.toml`, the standard lock file format from [PEP 751](https://peps.python.org/pep-0751/) that other installers are adopting. Other useful commands: `uv lock --upgrade-package httpx` updates one package, `uv lock --upgrade` updates everything within your constraints, and `uv remove` drops a dependency.

### A cooldown against compromised releases

Most attacks through PyPI publish a malicious version of a popular package and rely on people installing it within hours, before it is reported and removed. uv can refuse anything uploaded too recently. Add this to `pyproject.toml`:

```toml
[tool.uv]
exclude-newer = "7 days"
```

```terminal
{
  "title": "lock with a seven-day cooldown",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv lock",
      "output": "Resolving despite existing lockfile due to addition of global exclude newer 2026-10-17T09:34:48.177376942Z\nResolved 9 packages in 201ms\nUpdated certifi v2026.10.23 -> v2026.7.22"
    }
  ]
}
```

Packages released in the last seven days are skipped, and the lock moves back to the newest version that is older than that. For a security fix you need sooner, `exclude-newer-package` can exempt one package. Together with the lock file, code review of dependency changes and a scanner such as `pip-audit` in CI, this blocks most supply-chain attacks of the kind described in [Shai-Hulud reaches PyPI](/posts/shai-hulud-hades-pypi-wave-june-2026).

## Install Command-Line Tools

Tools such as Ruff, Ansible or the AWS CLI are applications, not libraries for your project. Install each into its own environment, with its commands linked into `~/.local/bin`, using `uv tool install` (or `pipx install`, which does the same with pip). For a one-off run, `uvx` (short for `uv tool run`) uses a cached temporary environment:

```terminal
{
  "title": "uv tool",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv tool install ruff",
      "output": "Resolved 1 package in 323ms\nInstalled 1 package in 3ms\n + ruff==0.17.2\nInstalled 1 executable: ruff"
    },
    {
      "cmd": "ruff --version",
      "output": "ruff 0.17.2"
    },
    {
      "cmd": "uv tool list",
      "output": "ruff v0.17.2\n- ruff"
    },
    {
      "cmd": "uvx mypy --version",
      "output": "Installed 6 packages in 79ms\nmypy 2.4.0 (compiled: yes)"
    }
  ]
}
```

## Single-File Scripts with Inline Dependencies

Many operations scripts are one file that needs one or two libraries. Making a whole project for each is overkill, and installing the library globally is what PEP 668 forbids. [PEP 723](https://peps.python.org/pep-0723/) solves it: a script declares its Python version and dependencies in a comment block at the top, and a runner such as `uv run` (or `pipx run`) creates a matching environment on the fly:

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "httpx>=0.28",
# ]
# ///
"""Fetch a JSON status document and print one line: fetch_status.py URL"""

import sys

import httpx


def main() -> int:
    response = httpx.get(sys.argv[1], timeout=5.0)
    response.raise_for_status()
    status = response.json()
    healthy = status.get("healthy") is True
    print(f"{status['service']} {status['version']}: {'healthy' if healthy else 'UNHEALTHY'}")
    return 0 if healthy else 1


if __name__ == "__main__":
    sys.exit(main())
```

You do not have to write the block by hand: `uv init --script fetch_status.py` creates it, and `uv add --script fetch_status.py httpx` adds a dependency to it. To try the script, serve a small JSON file with Python's built-in web server in the background:

```terminal
{
  "title": "a self-contained script",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p www && echo '{\"service\": \"api\", \"version\": \"1.4.2\", \"healthy\": true}' > www/status.json"
    },
    {
      "cmd": "chmod +x fetch_status.py"
    },
    {
      "cmd": "python -m http.server 8000 --bind 127.0.0.1 --directory www >/dev/null 2>&1 &"
    },
    {
      "cmd": "deactivate && cd /tmp"
    },
    {
      "prompt": "$",
      "cmd": "uv run ~/pyops/fetch_status.py http://127.0.0.1:8000/status.json",
      "output": "Installed 7 packages in 10ms\napi 1.4.2: healthy"
    },
    {
      "comment": "the shebang runs it through uv, so it also works as a command",
      "prompt": "$",
      "cmd": "~/pyops/fetch_status.py http://127.0.0.1:8000/status.json; echo \"exit code $?\"",
      "output": "api 1.4.2: healthy\nexit code 0"
    },
    {
      "comment": "stop the web server and go back to the project",
      "prompt": "$",
      "cmd": "kill %1; cd ~/pyops && source .venv/bin/activate"
    }
  ]
}
```

The script ran from `/tmp` with no environment active. uv read the block, created a cached environment with httpx, and ran the script in it; the second run reused that environment. `env -S` lets the shebang pass two arguments (`uv run --script`) to `env`; it works on Linux with coreutils 8.30 or later and on macOS. For a script you run from cron or a CI job, lock it with `uv lock --script fetch_status.py` (it writes `fetch_status.py.lock` next to it), so it gets the same versions every time; a cooldown (`exclude-newer` in the block's `[tool.uv]` table) additionally keeps brand-new releases out.

## pip, pipx, uv, Poetry: Which Tool?

| Tool (October 2026) | What it does                                                             | Use it when                                   |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| pip 26.2 + venv     | Installs packages into one environment; `venv` comes with Python         | Nothing else is available; minimal containers |
| pipx 1.18           | Installs command-line apps, each in its own environment                  | You install tools with pip-based workflows    |
| uv 0.13             | Python versions, environments, packages, projects, locks, tools, scripts | New projects; the fastest option in CI        |
| Poetry 2.5          | Projects, dependency groups, locks and publishing                        | Your team already uses it                     |
| PDM 2.29            | Projects and locks with standard `pyproject.toml` metadata               | Your team already uses it                     |
| conda / mamba       | Environments that include non-Python libraries (CUDA, GDAL)              | Data science and scientific stacks            |

The project tools (uv, Poetry since 2.0, PDM, and pip when it builds or installs a project) all read the standard `[project]` table in `pyproject.toml`, so moving between them is easier than it used to be. This guide uses uv because one binary covers installing Python, environments, projects and tools on every operating system.

## Common Mistakes

- **Naming a file like a module you import** (`random.py`, `yaml.py`). Python imports your file instead.
- **`pip install` without knowing which Python runs it.** Use `python -m pip` or `uv pip`, inside an environment.
- **Committing `.venv`**, or copying it to another machine. Commit `pyproject.toml` and the lock file; recreate the environment.
- **Unpinned dependencies in production.** Lock them (`uv.lock`, or `requirements.txt` with hashes), and update on purpose.
- **Imports with side effects.** Keep work out of module top level; put it under `if __name__ == "__main__":`.
- **Using removed modules** such as `telnetlib`, `cgi` or `distutils`. They are gone in 3.13 and 3.12.
- **`datetime.utcnow()`.** Use `datetime.now(UTC)`.

## Summary

- A module is a `.py` file; a package is a directory with `__init__.py`. Run modules with `python -m`.
- `sys.path` decides where imports come from, and the script's directory comes first; do not shadow module names.
- The standard library covers files, data formats, processes, logging, networking and hashing without any installs.
- A virtual environment is a directory with its own packages; distribution Pythons refuse system-wide installs (PEP 668).
- `uv add` maintains `pyproject.toml` and `uv.lock`; `uv sync --locked` reproduces the environment; `exclude-newer` adds a supply-chain cooldown.
- `uv tool install` and `uvx` handle command-line tools, and PEP 723 inline metadata makes single-file scripts self-contained.

Next: [File Operations](/guides/introduction-to-python/07-file-operations), where you read logs and YAML, TOML and JSON configuration, and write files safely.

## Keep Learning

- [Shai-Hulud reaches PyPI](/posts/shai-hulud-hades-pypi-wave-june-2026) and [Mini Shai-Hulud: PyTorch Lightning](/posts/mini-shai-hulud-pytorch-lightning-supply-chain-attack): what compromised packages do, and why lock files and cooldowns matter.
- [Should lock files be in your .gitignore?](/posts/should-terraform-lock-be-in-your-gitignore) The same answer applies to `uv.lock`: commit it.
- The [uv documentation](https://docs.astral.sh/uv/) and the [Python Packaging User Guide](https://packaging.python.org/).
