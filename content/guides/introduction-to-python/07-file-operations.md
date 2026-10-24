---
title: 'Python File Handling: pathlib, Logs, JSON, YAML, TOML and Safe Writes'
description: 'Python file handling with pathlib: encodings, gzipped logs, JSON, YAML and TOML traps, atomic writes, file permissions and safe tar extraction.'
order: 7
---

Operations scripts spend much of their time on files: they read logs and configuration, write reports and state, rotate, compress, copy and clean up. The mistakes here are expensive. A config file written halfway when the disk fills up, a secret saved with permissions anyone can read, a YAML value that silently turns into a different type, or an archive that writes outside its target directory.

This part covers paths with `pathlib`, reading and writing text and bytes with the right encoding, finding files, parsing plain and gzipped logs, JSON, YAML and TOML (and their traps), CSV, writing files atomically and with safe permissions, temporary files, and archives.

## Prerequisites

- The `~/pyops` project from [Part 6](/guides/introduction-to-python/06-modules-and-packages), with its virtual environment active and PyYAML installed (`uv add pyyaml`).
- Collections and `Counter` from [Part 5](/guides/introduction-to-python/05-data-structures).

## Paths with pathlib

`pathlib.Path` represents a file system path as an object. The `/` operator joins parts, properties give you the name, suffix and parent, and methods read, write, list and test files. It replaces most of `os.path`, and it uses the right separator on Windows:

```terminal
{
  "title": "Path basics",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> from pathlib import Path\n>>> log = Path(\"/var/log/nginx\") / \"access.log\"\n>>> log\nPosixPath('/var/log/nginx/access.log')\n>>> log.name, log.stem, log.suffix\n('access.log', 'access', '.log')\n>>> log.parent, log.parts\n(PosixPath('/var/log/nginx'), ('/', 'var', 'log', 'nginx', 'access.log'))\n>>> log.with_name(\"access.log.1.gz\")\nPosixPath('/var/log/nginx/access.log.1.gz')\n>>> Path(\"~/.ssh/config\").expanduser()\nPosixPath('/home/dev/.ssh/config')\n>>> Path(\"logs/../logs/app.log\").resolve()\nPosixPath('/home/dev/pyops/logs/app.log')\n>>> Path(\"/etc/hostname\").is_file(), Path(\"/etc/no-such-file\").exists()\n(True, False)\n>>> exit()"
    }
  ]
}
```

`resolve()` makes a path absolute and removes `..` parts. Relative paths are relative to the **current working directory** of the process, which is wherever the script was started from, not where the script lives. When a script needs a file next to itself, build the path from `Path(__file__).parent`.

| os.path / os                    | pathlib                                |
| ------------------------------- | -------------------------------------- |
| `os.path.join(a, b)`            | `Path(a) / b`                          |
| `os.path.basename(p)`           | `p.name`                               |
| `os.path.dirname(p)`            | `p.parent`                             |
| `os.path.splitext(p)[1]`        | `p.suffix`                             |
| `os.path.exists(p)`             | `p.exists()`                           |
| `os.makedirs(p, exist_ok=True)` | `p.mkdir(parents=True, exist_ok=True)` |
| `os.listdir(p)`                 | `p.iterdir()`                          |
| `glob.glob("*.log")`            | `p.glob("*.log")`, `p.rglob("*.log")`  |
| `open(p).read()`                | `p.read_text(encoding="utf-8")`        |

## Create Some Sample Logs

The rest of this part works on a small set of web server logs. This script writes them, which also shows the three ways to write a file: `write_text()` for text, `gzip.open()` in text mode for a compressed file, and `write_bytes()` for raw bytes:

```python
"""Write sample logs into ./logs for the examples in this part."""

import gzip
from pathlib import Path

CURRENT = """\
10.0.0.5 - - [24/Oct/2026:09:00:01 +0000] "GET /api/orders HTTP/1.1" 200 512 "-" "curl/8.14.1"
10.0.0.7 - - [24/Oct/2026:09:00:02 +0000] "GET /api/orders HTTP/1.1" 200 498 "-" "Mozilla/5.0"
10.0.0.5 - - [24/Oct/2026:09:00:04 +0000] "POST /api/pay HTTP/1.1" 502 157 "-" "python-httpx/0.28.1"
10.0.0.9 - - [24/Oct/2026:09:00:05 +0000] "GET /health HTTP/1.1" 200 2 "-" "kube-probe/1.34"
10.0.0.5 - - [24/Oct/2026:09:00:07 +0000] "POST /api/pay HTTP/1.1" 502 157 "-" "python-httpx/0.28.1"
10.0.0.7 - - [24/Oct/2026:09:00:08 +0000] "GET /api/orders/77 HTTP/1.1" 404 21 "-" "Mozilla/5.0"
10.0.0.5 - - [24/Oct/2026:09:00:09 +0000] "POST /api/pay HTTP/1.1" 200 64 "-" "python-httpx/0.28.1"
10.0.0.12 - - [24/Oct/2026:09:00:11 +0000] "GET /admin HTTP/1.1" 403 9 "-" "sqlmap/1.9"
10.0.0.9 - - [24/Oct/2026:09:00:15 +0000] "GET /health HTTP/1.1" 200 2 "-" "kube-probe/1.34"
10.0.0.7 - - [24/Oct/2026:09:00:16 +0000] "GET /api/orders HTTP/1.1" 500 87 "-" "Mozilla/5.0"
this line is not in the access log format
"""

ROTATED = """\
10.0.0.5 - - [24/Oct/2026:08:59:58 +0000] "GET /api/orders HTTP/1.1" 200 501 "-" "curl/8.14.1"
10.0.0.9 - - [24/Oct/2026:08:59:59 +0000] "GET /health HTTP/1.1" 200 2 "-" "kube-probe/1.34"
10.0.0.7 - - [24/Oct/2026:08:59:59 +0000] "POST /api/pay HTTP/1.1" 503 157 "-" "Mozilla/5.0"
"""

logs = Path("logs")
logs.mkdir(exist_ok=True)
(logs / "access.log").write_text(CURRENT, encoding="utf-8")
with gzip.open(logs / "access.log.1.gz", "wt", encoding="utf-8") as f:
    f.write(ROTATED)
# an application log with one line that is not valid UTF-8 (a Latin-1 byte)
(logs / "app.log").write_bytes(b"INFO started\nWARN user caf\xe9 not found\nINFO ready\n")
print(f"wrote {len(list(logs.iterdir()))} files to {logs.resolve()}")
```

```terminal
{
  "title": "sample logs",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python make_logs.py",
      "output": "wrote 3 files to /home/dev/pyops/logs"
    }
  ]
}
```

The `"""\` starts a multi-line string; the backslash stops it from beginning with an empty line. The `with` block opens the gzip file and closes it when the block ends, even if an error happens inside. Always open files with `with` (or use the `read_text`/`write_text` methods, which close the file for you).

## Find Files

`iterdir()` lists a directory, `glob()` matches a pattern in it and `rglob()` matches in every subdirectory. `stat()` returns size, permissions and times:

```python
"""List log files, largest first, with size and modification time."""

from datetime import UTC, datetime
from pathlib import Path

files = sorted(Path("logs").glob("*.log*"), key=lambda p: p.stat().st_size, reverse=True)
for path in files:
    info = path.stat()
    modified = datetime.fromtimestamp(info.st_mtime, tz=UTC)
    print(f"{info.st_size:>6} B  {modified:%Y-%m-%d %H:%M}  {path}")

total = sum(p.stat().st_size for p in Path("logs").rglob("*") if p.is_file())
print(f"total {total} bytes in {len(files)} files")
```

```terminal
{
  "title": "find and stat files",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python list_logs.py",
      "output": "   999 B  2026-10-24 09:35  logs/access.log\n   196 B  2026-10-24 09:35  logs/access.log.1.gz\n    49 B  2026-10-24 09:35  logs/app.log\ntotal 1244 bytes in 3 files"
    }
  ]
}
```

To find old files, compare `st_mtime` with `time.time() - days * 86400`. To delete them, call `path.unlink()`, and print what you would delete on a first `--dry-run` pass: there is no undo.

## Read Text, and Always Pass an Encoding

`open()` returns a file object; the **mode** says what you want to do with it:

| Mode                   | Meaning                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `"r"`                  | Read text (the default)                                     |
| `"w"`                  | Write text; **creates the file or empties an existing one** |
| `"a"`                  | Append text to the end; creates the file if needed          |
| `"x"`                  | Create a new file; fails if it already exists               |
| `"rb"`, `"wb"`, `"ab"` | The same with bytes instead of text                         |

Text modes decode bytes into `str` with an **encoding**. Up to Python 3.14 the default comes from the locale, so the same script can behave differently on a server, in a container and on Windows; Python 3.15 makes UTF-8 the default everywhere (PEP 686). Pass `encoding="utf-8"` and your code behaves the same on every version and system.

Iterating over a file object reads one line at a time, so even a multi-gigabyte log uses little memory. But logs are not always clean UTF-8, and one bad byte stops a strict read:

```terminal
{
  "title": "a bad byte in a log",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> from pathlib import Path\n>>> with open(\"logs/app.log\", encoding=\"utf-8\") as f:\n...     for line in f:\n...         print(line.rstrip(\"\\n\"))\n...\nTraceback (most recent call last):\n  File \"<stdin>\", line 2, in <module>\n    for line in f:\n                ^\n  File \"<frozen codecs>\", line 325, in decode\nUnicodeDecodeError: 'utf-8' codec can't decode byte 0xe9 in position 26: invalid continuation byte\n>>> with open(\"logs/app.log\", encoding=\"utf-8\", errors=\"replace\") as f:\n...     for line in f:\n...         print(line.rstrip(\"\\n\"))\n...\nINFO started\nWARN user caf� not found\nINFO ready\n>>> Path(\"logs/app.log\").read_bytes()[18:30]\nb'user caf\\xe9 no'\n>>> exit()"
    }
  ]
}
```

`errors="replace"` turns undecodable bytes into the replacement character `�` and keeps going, which is the right choice for reading logs. Use the default strict mode for configuration and data files, where a bad byte means a real problem. [Python 3.15 made UTF-8 the default](/posts/python-3-15-utf-8-default-linux-locales) has the details of what changes between versions and locales.

## Parse Access Logs, Plain and Gzipped

A regular expression with named groups turns each access log line into a dictionary. `gzip.open()` in text mode (`"rt"`) reads a rotated `.gz` log exactly like a plain one, so one function handles both:

```python
"""Summarize nginx access logs (plain and .gz): logsummary.py DIRECTORY"""

import gzip
import json
import re
import sys
from collections import Counter
from collections.abc import Iterator
from pathlib import Path

LINE = re.compile(
    r'(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<method>\S+) (?P<path>\S+) [^"]*" '
    r"(?P<status>\d{3}) (?P<bytes>\d+|-)"
)


def read_lines(path: Path) -> Iterator[str]:
    """Yield the lines of a log file, decompressing .gz files on the fly."""
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
            yield from f
    else:
        with path.open(encoding="utf-8", errors="replace") as f:
            yield from f


def summarize(directory: Path) -> dict[str, object]:
    statuses: Counter[str] = Counter()
    errors: Counter[str] = Counter()
    total_bytes = parsed = skipped = 0
    for path in sorted(directory.glob("access.log*")):
        for line in read_lines(path):
            match = LINE.match(line)
            if match is None:
                skipped += 1
                continue
            parsed += 1
            statuses[match["status"]] += 1
            if match["status"].startswith("5"):
                errors[f"{match['method']} {match['path']}"] += 1
            if match["bytes"] != "-":
                total_bytes += int(match["bytes"])
    return {
        "requests": parsed,
        "skipped_lines": skipped,
        "bytes_sent": total_bytes,
        "statuses": dict(sorted(statuses.items())),
        "error_rate": round(sum(errors.values()) / parsed, 3) if parsed else 0.0,
        "top_errors": errors.most_common(3),
    }


if __name__ == "__main__":
    print(json.dumps(summarize(Path(sys.argv[1])), indent=2))
```

```terminal
{
  "title": "summarize the logs",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python logsummary.py logs",
      "output": "{\n  \"requests\": 13,\n  \"skipped_lines\": 1,\n  \"bytes_sent\": 2169,\n  \"statuses\": {\n    \"200\": 7,\n    \"403\": 1,\n    \"404\": 1,\n    \"500\": 1,\n    \"502\": 2,\n    \"503\": 1\n  },\n  \"error_rate\": 0.308,\n  \"top_errors\": [\n    [\n      \"POST /api/pay\",\n      3\n    ],\n    [\n      \"GET /api/orders\",\n      1\n    ]\n  ]\n}"
    }
  ]
}
```

Three details make this script hold up on real servers: it counts lines it cannot parse instead of crashing on them, it reads with `errors="replace"`, and `read_lines()` is a generator (`yield from` passes on every line of the file), so files are never loaded whole. `match["status"]` reads a named group; `re.compile()` builds the pattern once instead of on every line.

## JSON

The `json` module converts between JSON text and Python dictionaries, lists, strings, numbers, booleans and `None`. `load()` and `dump()` work on files; `loads()` and `dumps()` on strings:

```terminal
{
  "title": "json round trip",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import json\n>>> from datetime import datetime, UTC\n>>> from pathlib import Path\n>>> report = {\"service\": \"api\", \"checked_at\": datetime(2026, 10, 24, 9, 0, tzinfo=UTC), \"ok\": True}\n>>> try:\n...     json.dumps(report)\n... except TypeError as err:\n...     print(err)\n...\nObject of type datetime is not JSON serializable\n>>> text = json.dumps(report, default=str, indent=2, sort_keys=True)\n>>> print(text)\n{\n  \"checked_at\": \"2026-10-24 09:00:00+00:00\",\n  \"ok\": true,\n  \"service\": \"api\"\n}\n>>> Path(\"report.json\").write_text(text + \"\\n\", encoding=\"utf-8\")\n82\n>>> json.loads(Path(\"report.json\").read_text(encoding=\"utf-8\"))[\"ok\"]\nTrue\n>>> try:\n...     json.loads('{\"replicas\": 3,}')\n... except json.JSONDecodeError as err:\n...     print(f\"{type(err).__name__}: {err}\")\n...\nJSONDecodeError: Illegal trailing comma before end of object: line 1 column 15 (char 14)\n>>> exit()"
    }
  ]
}
```

- JSON has no date type, so `dumps()` refuses a `datetime`. `default=str` converts anything unknown with `str()`; for dates, `.isoformat()` gives the standard form.
- `indent=2, sort_keys=True` gives stable, readable output that diffs well in Git.
- `json.JSONDecodeError` (a subclass of `ValueError`) tells you the line and column of a syntax error.
- For logs and streams, write **JSON Lines**: one `json.dumps()` per line, without `indent`, so each line can be parsed on its own.

## YAML: Use safe_load, and Quote Your Strings

YAML is everywhere in operations: Kubernetes manifests, CI workflows, Ansible, Compose files. Python reads it with the PyYAML library (`uv add pyyaml`). Two rules matter.

First, always use `yaml.safe_load()`. The full loader can build arbitrary Python objects from tags in the document, which makes loading untrusted YAML a code execution risk. Since PyYAML 6.0, `yaml.load()` without an explicit `Loader` is an error.

Second, PyYAML implements YAML 1.1, where many unquoted values are not strings. Load this file:

```yaml
country: NO
debug: off
file_mode: 0755
version: 1.10
port: 22:22
image_tag: 1.4
```

```terminal
{
  "title": "YAML 1.1 surprises",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -c 'import yaml, pprint; pprint.pprint(yaml.safe_load(open(\"surprise.yaml\", encoding=\"utf-8\")), sort_dicts=False)'",
      "output": "{'country': False,\n 'debug': False,\n 'file_mode': 493,\n 'version': 1.1,\n 'port': 1342,\n 'image_tag': 1.4}"
    }
  ]
}
```

Every value changed type: `NO` and `off` became booleans, `0755` an octal number (493), `1.10` the float `1.1`, and `22:22` a base-60 number (22 × 60 + 22 = 1342), which is why Docker Compose tells you to quote port mappings. Quote every string that could look like something else (`"NO"`, `"0755"`, `"1.10"`, `"22:22"`), and validate types after loading. Other YAML parsers disagree on some of these values (a YAML 1.2 parser reads `NO` and `off` as strings), which is one more reason to quote.

Here is the drift report's desired state from Part 5, now loaded from a file:

```yaml
# What should run in production. Reviewed in pull requests.
api:
  image: 'ghcr.io/acme/api:1.4.2'
  replicas: 3
worker:
  image: 'ghcr.io/acme/worker:1.4.2'
  replicas: 2
```

```terminal
{
  "title": "load and dump YAML",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import yaml\n>>> with open(\"desired.yaml\", encoding=\"utf-8\") as f:\n...     desired = yaml.safe_load(f)\n...\n>>> desired[\"api\"][\"replicas\"]\n3\n>>> desired[\"api\"][\"replicas\"] = 4\n>>> print(yaml.safe_dump(desired, sort_keys=False))\napi:\n  image: ghcr.io/acme/api:1.4.2\n  replicas: 4\nworker:\n  image: ghcr.io/acme/worker:1.4.2\n  replicas: 2\n\n>>> exit()"
    }
  ]
}
```

`safe_dump()` writes valid YAML but drops comments and formatting. To edit YAML files that people maintain by hand, use `ruamel.yaml`, which keeps comments and order on a round trip.

## TOML: Read with tomllib

TOML is the format of `pyproject.toml` and many tool configurations. It has real types (strings are always quoted, dates are dates), so it has none of YAML's surprises. `tomllib` (Python 3.11 and later) reads it; it needs the file opened in **binary** mode. Part 10's tool reads its list of checks from a file like this one:

```toml
# Checks for svcheck (Part 10).
[defaults]
timeout = 2.0
retries = 2

[[check]]
name = "api"
type = "http"
url = "http://127.0.0.1:8080/health"

[[check]]
name = "postgres"
type = "tcp"
host = "127.0.0.1"
port = 5432
timeout = 1.0

[[check]]
name = "root-disk"
type = "disk"
path = "/"
max_used_percent = 90
```

```terminal
{
  "title": "tomllib",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import tomllib\n>>> with open(\"services.toml\", \"rb\") as f:\n...     config = tomllib.load(f)\n...\n>>> config[\"defaults\"]\n{'timeout': 2.0, 'retries': 2}\n>>> [(c[\"name\"], c[\"type\"]) for c in config[\"check\"]]\n[('api', 'http'), ('postgres', 'tcp'), ('root-disk', 'disk')]\n>>> config[\"check\"][1].get(\"timeout\", config[\"defaults\"][\"timeout\"])\n1.0\n>>> try:\n...     tomllib.loads('timeout = 2.0\\nretries = \"two\\n')\n... except tomllib.TOMLDecodeError as err:\n...     print(err)\n...\nIllegal character '\\n' (at line 2, column 15)\n>>> exit()"
    }
  ]
}
```

`[[check]]` defines an array of tables, which arrives as a list of dictionaries. `tomllib` only reads; to write TOML, use the `tomli-w` package. Python 3.15's `tomllib` also accepts TOML 1.1 (for example, inline tables over several lines).

## CSV

The `csv` module handles quoting and commas inside values. Open CSV files with `newline=""`, as the documentation says, so the module controls line endings itself:

```python
import csv
import sys

rows = [
    {"host": "web-01", "mount": "/", "used_percent": 91.5},
    {"host": "db-01", "mount": "/var/lib/postgresql", "used_percent": 62.0},
    {"host": "web-02", "mount": "/", "used_percent": 97.2},
]

with open("disks.csv", "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["host", "mount", "used_percent"])
    writer.writeheader()
    writer.writerows(rows)

with open("disks.csv", encoding="utf-8", newline="") as f:
    full = [row for row in csv.DictReader(f) if float(row["used_percent"]) > 90]

csv.writer(sys.stdout).writerows([[r["host"], r["mount"]] for r in full])
```

```terminal
{
  "title": "csv",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python disk_report.py",
      "output": "web-01,/\nweb-02,/"
    },
    {
      "cmd": "cat disks.csv",
      "output": "host,mount,used_percent\nweb-01,/,91.5\ndb-01,/var/lib/postgresql,62.0\nweb-02,/,97.2"
    }
  ]
}
```

`DictReader` gives every value as a string; convert numbers yourself, as the `float()` call does.

## Write Files Safely

`open(path, "w")` empties the file _first_ and then writes. If the script crashes, the disk fills up or the machine loses power in between, you are left with a half-written file, which for a config or state file can take a service down. The fix is an **atomic write**: write a temporary file in the same directory, flush it to disk, then rename it over the target. A rename within one file system is atomic on Linux and macOS, so readers see either the old file or the new one, never a mix.

Files with secrets need one more step: create them with restrictive permissions from the start, instead of fixing the mode afterwards (which leaves a window where the file is readable):

```python
"""Atomic writes with chosen permissions."""

import os
import tempfile
from pathlib import Path


def write_atomic(path: Path, text: str, mode: int = 0o644) -> None:
    """Replace path with text so readers never see a partial file."""
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise
    # make the rename itself survive a power cut (Linux and macOS)
    dir_fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


if __name__ == "__main__":
    write_atomic(Path("app.conf"), "port = 8080\nworkers = 4\n")
    write_atomic(Path("db.env"), "DB_PASSWORD=change-me\n", mode=0o600)
    for name in ["app.conf", "db.env"]:
        print(f"{Path(name).stat().st_mode & 0o777:o} {name}")
    try:
        with open("app.conf", "x", encoding="utf-8") as f:
            f.write("never written\n")
    except FileExistsError as err:
        print(f"refused: {err}")
```

```terminal
{
  "title": "atomic writes and permissions",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python safe_write.py",
      "output": "644 app.conf\n600 db.env\nrefused: [Errno 17] File exists: 'app.conf'"
    },
    {
      "cmd": "ls -l app.conf db.env",
      "output": "-rw-r--r-- 1 dev dev 24 Oct 24 09:35 app.conf\n-rw------- 1 dev dev 22 Oct 24 09:35 db.env"
    }
  ]
}
```

How it works: `tempfile.mkstemp()` creates the temporary file with mode `0600`, readable only by you, in the target's directory (so the rename stays on one file system). `os.fsync()` makes sure the data is on disk before the rename, `os.replace()` swaps the files, and the `except` block removes the temporary file if anything fails, then re-raises the error (`raise` with no argument, covered in Part 8). The last step syncs the directory, so the rename itself is on disk too. Mode `"x"` is the other safety tool: it refuses to overwrite a file that already exists.

## Temporary Files and Directories, and shutil

`tempfile.TemporaryDirectory()` creates a private directory and deletes it with everything inside when the `with` block ends, which is ideal for unpacking or building something. `shutil` covers whole-file and whole-tree operations:

```terminal
{
  "title": "tempfile and shutil",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import shutil, tempfile\n>>> from pathlib import Path\n>>> with tempfile.TemporaryDirectory(prefix=\"deploy-\") as tmp:\n...     work = Path(tmp)\n...     shutil.copytree(\"logs\", work / \"logs\")\n...     print(sorted(p.name for p in (work / \"logs\").iterdir()))\n...     archive = shutil.make_archive(str(work / \"logs-backup\"), \"gztar\", root_dir=work, base_dir=\"logs\")\n...     print(Path(archive).name, Path(archive).stat().st_size > 0)\n...\nPosixPath('/tmp/deploy-aq0leg9m/logs')\n['access.log', 'access.log.1.gz', 'app.log']\nlogs-backup.tar.gz True\n>>> Path(tmp).exists()\nFalse\n>>> shutil.which(\"ssh\"), shutil.which(\"does-not-exist\")\n('/usr/bin/ssh', None)\n>>> exit()"
    }
  ]
}
```

Other `shutil` functions you will use: `copy2()` (copy a file with its timestamps), `move()`, `rmtree()` (delete a tree; double-check the path first), and `disk_usage()` from Part 1.

## Archives: Extract Safely

A tar archive can contain members named `../../etc/cron.d/job` or absolute paths, symbolic links pointing outside the target, or device files. Extracting such an archive blindly writes outside the directory you chose. Python's `tarfile` has **extraction filters** for this (Python 3.12 and later, and backported to security releases of older versions), and since Python 3.14 the safe `"data"` filter is the default. Build a malicious archive and try it:

```python
import io
import tarfile

# build an archive with one normal member and one that climbs out of the target
with tarfile.open("bad.tar.gz", "w:gz") as tar:
    for name, data in [("notes.txt", b"fine\n"), ("../escaped.txt", b"oops\n")]:
        info = tarfile.TarInfo(name)
        info.size = len(data)
        tar.addfile(info, io.BytesIO(data))

with tarfile.open("bad.tar.gz") as tar:
    print([m.name for m in tar.getmembers()])
    try:
        tar.extractall("unpacked")  # Python 3.14: filter="data" is the default
    except tarfile.FilterError as err:
        print(f"blocked: {err}")
```

```terminal
{
  "title": "tarfile's data filter",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python tar_check.py",
      "output": "['notes.txt', '../escaped.txt']\nblocked: '../escaped.txt' would be extracted to '/home/dev/pyops/escaped.txt', which is outside the destination"
    },
    {
      "cmd": "ls unpacked; ls escaped.txt",
      "output": "notes.txt\nls: cannot access 'escaped.txt': No such file or directory"
    }
  ]
}
```

The normal member was extracted and the one that tried to escape was refused. On Python 3.12 and 3.13, pass `filter="data"` explicitly; without it those versions keep the old, unsafe behaviour and only show a `DeprecationWarning`. Write `tar.extractall(path, filter="data")` on every version, so the intent is visible, and keep Python itself updated: the filters received several security fixes in 2025, in 3.14 and in the security releases of older versions.

## Common Mistakes

- **No `encoding=`.** Output and behaviour then depend on the machine's locale (until 3.15). Pass `encoding="utf-8"`.
- **`open(path, "w")` on a file you care about.** It empties the file first; write atomically instead.
- **Fixing permissions after writing a secret.** Create the file with the right mode from the start.
- **Paths relative to the working directory** in scripts that cron or systemd start from `/`. Use absolute paths or `Path(__file__).parent`.
- **`yaml.load()` and unquoted YAML strings.** Use `safe_load()` and quote values such as `"NO"`, `"0755"` and `"22:22"`.
- **`f.read()` on a huge log.** Iterate over the lines instead.
- **Extracting archives from anywhere without `filter="data"`.**
- **`tomllib.load()` on a file opened in text mode.** It needs `"rb"`.

## Summary

- `pathlib.Path` handles paths, listing (`glob`, `rglob`), metadata (`stat`) and simple reads and writes.
- Pass `encoding="utf-8"` everywhere; read logs with `errors="replace"` and iterate line by line; `gzip.open("rt")` reads rotated logs.
- `json`, `tomllib` and `csv` come with Python; PyYAML's `safe_load()` reads YAML, whose unquoted values can change type.
- Write important files atomically (temporary file, `fsync`, `os.replace`) and secrets with mode `0600` from the start.
- `tempfile` and `shutil` handle scratch space and whole trees; `tarfile` with `filter="data"` refuses archives that try to escape.

Next: [Error Handling](/guides/introduction-to-python/08-error-handling), where you handle the exceptions these operations raise, log properly, run commands with `subprocess` and call HTTP APIs with timeouts and retries.

## Keep Learning

- [Why Python open() does not create a file if it does not exist](/posts/python-open-does-not-create-file), on file modes and the errors they raise.
- [Python 3.15 made UTF-8 the default](/posts/python-3-15-utf-8-default-linux-locales): 13 cases in seven Linux locales.
- [How to tar a directory while excluding files and folders](/posts/tar-directory-excluding-files-and-folders), the command-line side of archives.
