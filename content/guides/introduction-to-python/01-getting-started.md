---
title: 'Install Python 3.14 with uv on Linux, macOS and Windows'
description: 'Pick a Python version for October 2026, install it with uv or your OS, avoid the PEP 668 "externally managed" error, and run your first script.'
order: 1
---

Python is the second language of most DevOps work, after the shell. Cloud SDKs such as boto3, configuration tools such as Ansible, and many of the command-line tools you run every day are written in it. You reach for Python when a Bash script starts to parse JSON, call HTTP APIs, retry on errors or needs tests: those jobs take a few lines in Python and a lot of care in Bash.

This part gets a current Python onto your machine without breaking the one your operating system depends on. You choose a version, install it with **uv** or with your package manager, meet the "externally managed environment" error that `pip` shows on Debian and Ubuntu (and the fix), create the virtual environment the rest of the guide uses, and run your first script.

## Prerequisites

- A Linux, macOS or Windows computer with a terminal. This part shows the Windows commands, but later parts use Linux commands and a Bash shell (`&`, `echo $?`, `chmod`, signals), so on Windows follow the rest of the guide in WSL 2, and install uv and Python inside WSL with the Linux commands.
- Basic terminal use: `cd`, `ls`, editing a file. The [Linux command line part](/guides/introduction-to-linux/03-command-line-interface) of the Linux guide covers it.
- No Python experience. If you already write Python, skim this part for the version notes and the uv setup, then move on.

## Which Python Version to Use in October 2026

Python releases a new minor version every October. Each one gets about two years of bug fixes and then security fixes only, until it reaches end of life five years after its release. This is where every version stands today (from the [release cycle data](https://devguide.python.org/versions/) on python.org):

| Version | First released  | Latest release              | Status                   | End of life  |
| ------- | --------------- | --------------------------- | ------------------------ | ------------ |
| 3.15    | 9 October 2026  | 3.15.1 (21 October 2026)    | Bug fixes                | October 2031 |
| 3.14    | 7 October 2025  | 3.14.9 (21 October 2026)    | Bug fixes                | October 2030 |
| 3.13    | 7 October 2024  | 3.13.17 (21 October 2026)   | Security fixes only      | October 2029 |
| 3.12    | 2 October 2023  | 3.12.15 (30 September 2026) | Security fixes only      | October 2028 |
| 3.11    | 24 October 2022 | 3.11.17 (1 October 2026)    | Security fixes only      | October 2027 |
| 3.10    | 4 October 2021  | none                        | End of life (1 Oct 2026) | Ended        |

**This guide uses Python 3.14.** It is the newest version that has had a full year of bug fixes, it is the `python3` of Ubuntu 26.04 LTS and Fedora 44, and every library the guide uses ships ready-made packages for it. Python 3.15 came out on 9 October 2026 and 3.15.1 followed on 21 October. It is a good choice for new projects once the libraries you depend on support it; Part 10 runs the example project's tests on 3.15 as well. Avoid 3.10 and older for anything new: they no longer get security fixes.

The Python your operating system ships is often older, and it belongs to the operating system:

| System                   | `python3` version (October 2026)            |
| ------------------------ | ------------------------------------------- |
| Ubuntu 24.04 LTS         | 3.12.3                                      |
| Ubuntu 26.04 LTS         | 3.14.4                                      |
| Debian 12 (bookworm)     | 3.11.2                                      |
| Debian 13 (trixie)       | 3.13.5                                      |
| Fedora 44                | 3.14.8                                      |
| RHEL 9 and its rebuilds  | 3.9 (3.11, 3.12 and 3.14 as extra packages) |
| RHEL 10 and its rebuilds | 3.12                                        |
| macOS                    | none of its own (see the macOS tab below)   |
| Windows                  | none                                        |

Tools such as cloud-init, Ubuntu's `unattended-upgrades` and `add-apt-repository`, `dnf` on RHEL, and parts of your desktop run on that system Python. Upgrading or replacing it breaks them, and installing packages into it with `sudo pip` is the classic way to break a server. So the rule for the whole guide is: **leave the system Python alone, and give each project its own Python packages in a virtual environment.**

## Install uv and Python

[uv](https://docs.astral.sh/uv/) is a single program, written in Rust by Astral, that installs Python versions, creates virtual environments, installs packages and manages projects. It replaces `pyenv`, `virtualenv`, `pip`, `pip-tools` and `pipx` for most people, and it is much faster than those tools. You do not need it to learn Python, but it is the simplest way to get the same Python 3.14 on Linux, macOS and Windows, and Part 6 uses it for packaging.

```tabs
{
  "title": "Install uv",
  "tabs": [
    {
      "label": "Linux",
      "lang": "bash",
      "code": "# The official installer puts uv and uvx in ~/.local/bin.\n# Read it first if you like: curl -LsSf https://astral.sh/uv/install.sh | less\ncurl -LsSf https://astral.sh/uv/install.sh | sh\n\n# Or pin the version, so every machine gets the same uv:\ncurl -LsSf https://astral.sh/uv/0.13.5/install.sh | sh\n\n# Without uv: the distribution's Python plus venv support\nsudo apt update && sudo apt install python3 python3-venv   # Debian, Ubuntu\nsudo dnf install python3                                   # Fedora, RHEL"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# With Homebrew (https://brew.sh):\nbrew install uv\n\n# Or the official installer:\ncurl -LsSf https://astral.sh/uv/install.sh | sh\n\n# macOS has no Python of its own. /usr/bin/python3 is a stub that offers\n# to install the Xcode Command Line Tools, whose older Python 3 is meant\n# for Apple's developer tools. Do not build on it. Without uv, use\n# brew install python@3.14 or the installer from python.org."
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# uv, with WinGet or the official installer:\nwinget install --id=astral-sh.uv -e\npowershell -ExecutionPolicy ByPass -c \"irm https://astral.sh/uv/install.ps1 | iex\"\n\n# Without uv: install the Python install manager from the Microsoft Store\n# or python.org/downloads, then:\npy install 3.14\npy list\n# The classic full installer is deprecated since 3.14 and will not be\n# produced for 3.16."
    }
  ]
}
```

Piping a script from the internet into `sh` runs whatever the server sends, so read it first when that matters to you, or install uv from your package manager. Here is a real run of the pinned installer on Linux:

```terminal
{
  "title": "install uv",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "curl -LsSf https://astral.sh/uv/0.13.5/install.sh | sh",
      "output": "downloading uv 0.13.5 aarch64-unknown-linux-gnu\ninstalling to /home/dev/.local/bin\n  uv\n  uvx\neverything's installed!\n\nTo add $HOME/.local/bin to your PATH, either restart your shell or run:\n\n    source $HOME/.local/bin/env (sh, bash, zsh)\n    source $HOME/.local/bin/env.fish (fish)"
    },
    {
      "comment": "load the new PATH into this shell, as the installer says",
      "cmd": "source \"$HOME/.local/bin/env\""
    },
    {
      "cmd": "uv --version",
      "output": "uv 0.13.5 (aarch64-unknown-linux-gnu)"
    }
  ]
}
```

The installer also added `~/.local/bin` to your `PATH` in your shell's startup files, so new terminals find `uv` without the `source` line.

Now install Python 3.14. uv downloads a ready-made build of CPython (the standard Python, from the [python-build-standalone](https://github.com/astral-sh/python-build-standalone) project) into your home directory. Nothing touches the system Python, and you do not need `sudo`:

```terminal
{
  "title": "install Python 3.14",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uv python install 3.14",
      "output": "Downloading cpython-3.14.9-linux-aarch64-gnu (download) (29.2MiB)\n Downloaded cpython-3.14.9-linux-aarch64-gnu (download)\nInstalled Python 3.14.9 in 3.51s\n + cpython-3.14.9-linux-aarch64-gnu (python3.14)"
    },
    {
      "cmd": "uv python list --only-installed",
      "output": "cpython-3.14.9-linux-aarch64-gnu    .local/bin/python3.14 -> .local/share/uv/python/cpython-3.14-linux-aarch64-gnu/bin/python3.14\ncpython-3.14.9-linux-aarch64-gnu    .local/share/uv/python/cpython-3.14-linux-aarch64-gnu/bin/python3.14\ncpython-3.11.2-linux-aarch64-gnu    /usr/bin/python3.11\ncpython-3.11.2-linux-aarch64-gnu    /usr/bin/python3 -> python3.11\ncpython-3.11.2-linux-aarch64-gnu    /usr/bin/python -> python3"
    },
    {
      "cmd": "python3.14 --version",
      "output": "Python 3.14.9"
    }
  ]
}
```

`uv python list` shows both: the 3.14.9 that uv manages, and the system's own `/usr/bin/python3` (3.11.2 on this Debian 12 machine), which stays untouched. `uv python install 3.15` would add Python 3.15 next to it in the same way, and `uv python upgrade 3.14` moves you to the next 3.14 bug-fix release when it comes out.

## The "Externally Managed Environment" Error

If you use the distribution's Python instead, you will meet this sooner or later. Here is a fresh Ubuntu 26.04 LTS server with the `python3` and `python3-pip` packages installed:

```terminal
{
  "title": "pip on Ubuntu 26.04",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python3 --version",
      "output": "Python 3.14.4"
    },
    {
      "cmd": "pip install requests",
      "output": "error: externally-managed-environment\n\n× This environment is externally managed\n╰─> To install Python packages system-wide, try apt install\n    python3-xyz, where xyz is the package you are trying to\n    install.\n\n    If you wish to install a non-Debian-packaged Python package,\n    create a virtual environment using python3 -m venv path/to/venv.\n    Then use path/to/venv/bin/python and path/to/venv/bin/pip. Make\n    sure you have python3-full installed.\n\n    If you wish to install a non-Debian packaged Python application,\n    it may be easiest to use pipx install xyz, which will manage a\n    virtual environment for you. Make sure you have pipx installed.\n\n    See /usr/share/doc/python3.14/README.venv for more information.\n\nnote: If you believe this is a mistake, please contact your Python installation or OS distribution provider. You can override this, at the risk of breaking your Python installation or OS, by passing --break-system-packages.\nhint: See PEP 668 for the detailed specification."
    }
  ]
}
```

This is [PEP 668](https://peps.python.org/pep-0668/) at work. Debian, Ubuntu, Arch Linux and Alpine put a file called `EXTERNALLY-MANAGED` next to the system Python's standard library, and `pip` refuses to install anything into that Python, because the packages you install could replace the ones the package manager installed and break system tools. `pip install --user` is refused too. Fedora and RHEL do not ship the marker, but the advice is the same there: do not install into the system Python with `sudo pip`. The error lists the ways out; the right one for your own code is a **virtual environment**: a directory with its own `python` and its own packages, built on top of a base Python.

On Debian and Ubuntu, the module that creates virtual environments is packaged separately, so the obvious command fails on a fresh system:

```terminal
{
  "title": "venv without python3-venv",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python3 -m venv .venv",
      "output": "The virtual environment was not created successfully because ensurepip is not\navailable.  On Debian/Ubuntu systems, you need to install the python3-venv\npackage using the following command.\n\n    apt install python3.14-venv\n\nYou may need to use sudo with that command.  After installing the python3-venv\npackage, recreate your virtual environment.\n\nFailing command: /home/dev/.venv/bin/python3"
    }
  ]
}
```

Install the package once (it is `python3-venv`, which pulls in the right version-specific package), and it works:

```terminal
{
  "title": "install venv support",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo apt install -y python3-venv",
      "output": "Setting up python3-setuptools-whl (78.1.1-0.1build1) ...\nSetting up python3-pip-whl (25.1.1+dfsg-1ubuntu2) ...\nSetting up python3.14-venv (3.14.4-1ubuntu0.2) ...\nSetting up python3-venv (3.14.3-0ubuntu2) ..."
    }
  ]
}
```

```terminal
{
  "title": "a virtual environment on Ubuntu",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python3 -m venv .venv"
    },
    {
      "cmd": ".venv/bin/pip install --quiet requests"
    },
    {
      "cmd": ".venv/bin/python -c 'import requests; print(requests.__version__)'",
      "output": "2.34.2"
    }
  ]
}
```

Never "fix" the error with `pip install --break-system-packages` or by deleting the `EXTERNALLY-MANAGED` file on a server. [Part 6](/guides/introduction-to-python/06-modules-and-packages) explains virtual environments, `pip`, `uv` and the other options in depth.

## Create the Project for This Guide

Parts 1 to 9 of this guide work in one directory, `~/pyops`, with one virtual environment in it (Part 10 creates a project of its own). Create both with uv:

```terminal
{
  "title": "the practice project",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir ~/pyops && cd ~/pyops"
    },
    {
      "cmd": "uv venv --python 3.14",
      "output": "Using CPython 3.14.9\nCreating virtual environment at: .venv\nActivate with: source .venv/bin/activate"
    },
    {
      "cmd": "source .venv/bin/activate"
    },
    {
      "prompt": "(pyops) $",
      "cmd": "python --version",
      "output": "Python 3.14.9"
    },
    {
      "prompt": "(pyops) $",
      "cmd": "which python",
      "output": "/home/dev/pyops/.venv/bin/python"
    }
  ]
}
```

**Activating** a virtual environment only changes your shell: it puts `.venv/bin` first in `PATH` (so `python` is the environment's own) and adds `(pyops)` to the prompt. An environment created by uv contains no `pip`; you install packages into it with `uv pip install` or `uv add`, as [Part 6](/guides/introduction-to-python/06-modules-and-packages) shows. `deactivate` undoes it. You can also skip activation and call `.venv/bin/python` directly, which is what scripts and cron jobs should do.

```tabs
{
  "title": "Activate the environment",
  "tabs": [
    { "label": "Linux and macOS", "lang": "bash", "code": "cd ~/pyops\nsource .venv/bin/activate\n# leave it again:\ndeactivate" },
    { "label": "Windows (PowerShell)", "lang": "powershell", "code": "cd ~\\pyops\n.venv\\Scripts\\Activate.ps1\n# If PowerShell refuses to run the script, allow local scripts once:\n#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned\ndeactivate" },
    { "label": "Without uv", "lang": "bash", "code": "# Use Python 3.14 to get the same results as the guide; a few\n# examples (t-strings, tarfile defaults) need it.\nmkdir ~/pyops && cd ~/pyops\npython3.14 -m venv .venv\nsource .venv/bin/activate" }
  ]
}
```

In every later part, start by going to the project and activating it: `cd ~/pyops && source .venv/bin/activate`. The commands in the guide then use `python`, which is the environment's Python 3.14.

## The Interactive Shell

Run `python` with no arguments and you get the **REPL** (read, evaluate, print loop), where each line runs as soon as you press Enter. It is the fastest way to try something out:

```terminal
{
  "title": "the Python REPL",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python",
      "output": "Python 3.14.9 (main, Oct 21 2026, 17:47:14) [Clang 23.1.3 ] on linux\nType \"help\", \"copyright\", \"credits\" or \"license\" for more information.\n>>> 2 ** 10\n1024\n>>> name = \"web-01\"\n>>> f\"{name}.example.com\"\n'web-01.example.com'\n>>> name.upper()\n'WEB-01'\n>>> len(name)\n6\n>>> for port in [80, 443]:\n...     print(f\"{name}:{port}\")\n...\nweb-01:80\nweb-01:443\n>>> help(len)\nHelp on built-in function len in module builtins:\n\nlen(obj, /)\n    Return the number of items in a container.\n\n>>> exit()"
    }
  ]
}
```

Since Python 3.13 the REPL is much nicer to use: it colours the prompt and tracebacks (3.14 adds syntax highlighting as you type), lets you edit a whole multi-line block with the arrow keys, and understands `exit` and `help` without parentheses. Press **F1** for help, **F2** to browse your history and **F3** for paste mode when you paste a block of code. The transcripts in this guide come from the basic REPL (`PYTHON_BASIC_REPL=1`), which shows the same text without the colours.

Leave the REPL with `exit` (`exit()` in the basic REPL) or Ctrl+D (Ctrl+Z then Enter on Windows).

## Your First Script

A script is a text file of Python code. Save this as `~/pyops/hostinfo.py`:

```python
#!/usr/bin/env python3
"""Print a short report about the machine this script runs on."""

import getpass
import os
import platform
import shutil
import socket
import sys


def main() -> None:
    total, _used, free = shutil.disk_usage("/")
    print(f"host:   {socket.gethostname()}")
    print(f"user:   {getpass.getuser()}")
    print(f"python: {platform.python_version()} ({sys.executable})")
    print(f"system: {platform.system()} {platform.machine()}, {os.cpu_count()} CPUs")
    print(f"disk /: {free / 2**30:.1f} GiB free of {total / 2**30:.1f} GiB")


if __name__ == "__main__":
    main()
```

Each `import` line loads a module from the **standard library**, the large set of modules that comes with Python: `socket` knows the host name, `shutil` the disk usage, `platform` the system. `def main()` defines a function, the indented lines are its body (Python uses indentation, not braces, to group code), and the last two lines call `main()` when you run the file. Every later part explains these pieces properly; for now, run it:

```terminal
{
  "title": "run a script",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python hostinfo.py",
      "output": "host:   devbox\nuser:   dev\npython: 3.14.9 (/home/dev/pyops/.venv/bin/python)\nsystem: Linux aarch64, 4 CPUs\ndisk /: 1.1 GiB free of 28.5 GiB"
    },
    {
      "comment": "or make it executable: the first line tells the system which program runs it",
      "cmd": "chmod +x hostinfo.py"
    },
    {
      "cmd": "./hostinfo.py | head -n 3",
      "output": "host:   devbox\nuser:   dev\npython: 3.14.9 (/home/dev/pyops/.venv/bin/python3)"
    }
  ]
}
```

The first line, `#!/usr/bin/env python3`, is the **shebang**. It runs the first `python3` in your `PATH`, which is the virtual environment's while it is active, and the system's otherwise. For a script that must always use the project's environment (from cron, for example), call it as `/home/dev/pyops/.venv/bin/python hostinfo.py`, or make it self-contained with inline dependencies as shown in [Part 6](/guides/introduction-to-python/06-modules-and-packages).

## Python One-Liners for the Terminal

Python also runs code straight from the command line. Three forms are worth knowing on day one:

```terminal
{
  "title": "python -c and python -m",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -c 'import secrets; print(secrets.token_urlsafe(16))'",
      "output": "bIEF7D99DoKqS5q5vOJJtA"
    },
    {
      "comment": "pretty-print and validate JSON",
      "cmd": "echo '{\"service\": \"api\", \"replicas\": 3, \"ports\": [80, 443]}' | python -m json.tool",
      "output": "{\n    \"service\": \"api\",\n    \"replicas\": 3,\n    \"ports\": [\n        80,\n        443\n    ]\n}"
    },
    {
      "comment": "invalid JSON fails with a clear message and exit code 1",
      "cmd": "echo '{\"service\": \"api\",}' | python -m json.tool",
      "output": "Illegal trailing comma before end of object: line 1 column 18 (char 17)"
    },
    {
      "cmd": "echo $?",
      "output": "1"
    }
  ]
}
```

`python -m module` runs a standard library module as a program. Others you will use: `python -m http.server 8000` serves the current directory over HTTP (handy for testing, never for production), `python -m venv` creates virtual environments, and `python -m pip` runs the `pip` that belongs to that exact Python.

## Pick an Editor

Any editor works, but one that understands Python saves time: it shows errors as you type, completes names and runs the tests.

- **[Visual Studio Code](https://code.visualstudio.com/)** with Microsoft's Python extension, plus the Ruff extension for linting and formatting. Use "Python: Select Interpreter" and choose `~/pyops/.venv`, so the editor sees the same packages as your terminal.
- **[PyCharm](https://www.jetbrains.com/pycharm/)** from JetBrains, which detects the `.venv` directory on its own.
- **Vim, Neovim, Emacs or Helix** with a language server such as Pyright or the one built into Ruff.

## Common Mistakes

- **`sudo pip install ...`** on a server. It mixes your packages with the ones `apt` or `dnf` manages and can break system tools. Use a virtual environment, or `uv tool install` for command-line tools (Part 6).
- **Typing `python` on Debian or Ubuntu** and getting "command not found". Those systems only ship `python3` (the `python-is-python3` package adds the short name). Inside an activated virtual environment, `python` always works.
- **Running a script with the wrong Python.** If an import fails with `ModuleNotFoundError` for a package you installed, check `which python` and whether the environment is active.
- **Replacing or upgrading the system Python** to get a newer version. Install the newer version next to it with uv, your package manager's extra packages, or Homebrew.
- **Using Python 3.10 or older** for new work. It no longer gets security fixes.
- **Saving a script with Windows line endings (CRLF).** Python itself does not mind, but the shebang line then names a program called `python3` followed by a carriage return, which does not exist. Save scripts with LF line endings (every code editor has a setting), or convert them with `dos2unix hostinfo.py` (in the package manager of every Linux distribution and in Homebrew):

```terminal
{
  "title": "a shebang with CRLF line endings",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '#!/usr/bin/env python3\\r\\nprint(\"hello\")\\r\\n' > crlf.py && chmod +x crlf.py && ./crlf.py",
      "output": "/usr/bin/env: ‘python3\\r’: No such file or directory\n/usr/bin/env: use -[v]S to pass options in shebang lines"
    },
    {
      "cmd": "python crlf.py",
      "output": "hello"
    }
  ]
}
```

## Summary

- Python 3.14 is the version this guide uses; 3.15 is out since 9 October 2026, and 3.10 reached end of life on 1 October 2026.
- uv installs any Python version into your home directory, next to the system Python, without `sudo`.
- `pip` refuses to install into a distribution's Python (PEP 668). Use a virtual environment; on Debian and Ubuntu, install `python3-venv` first.
- The guide's project lives in `~/pyops` with a virtual environment in `.venv`; activate it with `source .venv/bin/activate`.
- `python` starts the REPL, `python file.py` runs a script, and `python -m module` runs a module such as `json.tool` or `http.server`.

Next: [Variables and Data Types](/guides/introduction-to-python/02-variables-and-data-types), where you read settings from environment variables and learn why `bool("false")` is `True`.

## Keep Learning

- [Python 3.15 made UTF-8 the default](/posts/python-3-15-utf-8-default-linux-locales): what changes on Linux servers when you upgrade.
- [What Is Bash?](/guides/introduction-to-bash/01-what-is-bash): the shell you will run Python from, and where Bash stops being the right tool.
- The [Python Fundamentals Quiz](/quizzes/python-quiz), to test yourself once you have worked through a few parts.
