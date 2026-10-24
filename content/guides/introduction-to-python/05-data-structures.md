---
title: 'Python Data Structures: Lists, Dicts, Sets and collections'
description: 'Python lists, tuples, dicts and sets for inventories and config: comprehensions, Counter and defaultdict, deep copies, and a drift report.'
order: 5
---

Most operations data is a collection: a list of hosts, a mapping from service names to ports, the set of containers that should run, a count of status codes in a log. Python's built-in collections cover all of these, and picking the right one makes code shorter and faster. A set answers "is this host in the inventory?" in constant time; a dictionary turns a list of records into a lookup table; `Counter` turns a log into a histogram in one line.

This part covers lists, tuples, dictionaries and sets, comprehensions, the `collections` module, the copy trap with nested configuration, and ends with a drift report that compares the desired state of a deployment with what is actually running.

## Prerequisites

- The `~/pyops` project from [Part 1](/guides/introduction-to-python/01-getting-started), with its virtual environment active.
- Functions and lambdas from [Part 4](/guides/introduction-to-python/04-functions).

## Which Collection When

| Type    | Literal                | Ordered         | Changeable | Duplicates  | Typical use                             |
| ------- | ---------------------- | --------------- | ---------- | ----------- | --------------------------------------- |
| `list`  | `["web-01", "web-02"]` | Yes             | Yes        | Yes         | A sequence you add to, sort and slice   |
| `tuple` | `("db-01", 5432)`      | Yes             | No         | Yes         | A fixed record; a dictionary key        |
| `dict`  | `{"api": 8080}`        | Insertion order | Yes        | Unique keys | Look up a value by a key                |
| `set`   | `{"api", "worker"}`    | No              | Yes        | No          | Membership, de-duplication, differences |

## Lists

A list is an ordered, changeable sequence. Indexing and slicing work as for strings, and methods change the list in place:

```terminal
{
  "title": "list basics",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> hosts = [\"web-01\", \"web-02\", \"db-01\"]\n>>> hosts.append(\"web-03\")\n>>> hosts.extend([\"cache-01\", \"cache-02\"])\n>>> hosts.insert(0, \"lb-01\")\n>>> hosts\n['lb-01', 'web-01', 'web-02', 'db-01', 'web-03', 'cache-01', 'cache-02']\n>>> hosts.remove(\"db-01\")\n>>> last = hosts.pop()\n>>> last, hosts\n('cache-02', ['lb-01', 'web-01', 'web-02', 'web-03', 'cache-01'])\n>>> hosts[1:3], hosts[-1], len(hosts)\n(['web-01', 'web-02'], 'cache-01', 5)\n>>> \"web-02\" in hosts\nTrue\n>>> hosts.index(\"web-03\")\n3\n>>> exit()"
    }
  ]
}
```

`append` adds one item; `extend` adds every item of another list (`append` of a list would add the list itself as one item). `pop()` removes and returns the last item, `pop(0)` the first.

### Sort with a key

`list.sort()` sorts in place and returns `None`; `sorted()` returns a new list and works on any iterable. Both take a `key` function, and a key that returns a tuple sorts by several fields at once:

```terminal
{
  "title": "sorting",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> servers = [(\"web-02\", \"web\", 4), (\"db-01\", \"db\", 16), (\"api-01\", \"web\", 4), (\"cache-01\", \"cache\", 2)]\n>>> sorted(servers)\n[('api-01', 'web', 4), ('cache-01', 'cache', 2), ('db-01', 'db', 16), ('web-02', 'web', 4)]\n>>> sorted(servers, key=lambda s: (s[1], s[0]))\n[('cache-01', 'cache', 2), ('db-01', 'db', 16), ('api-01', 'web', 4), ('web-02', 'web', 4)]\n>>> sorted(servers, key=lambda s: s[2], reverse=True)\n[('db-01', 'db', 16), ('web-02', 'web', 4), ('api-01', 'web', 4), ('cache-01', 'cache', 2)]\n>>> sorted([\"web-10\", \"web-9\", \"web-1\"])\n['web-1', 'web-10', 'web-9']\n>>> sorted([\"web-10\", \"web-9\", \"web-1\"], key=lambda h: int(h.split(\"-\")[1]))\n['web-1', 'web-9', 'web-10']\n>>> exit()"
    }
  ]
}
```

The last two lines show the classic trap: strings sort character by character, so `web-10` comes before `web-9`. Sort by the number when names contain numbers.

## Tuples

A tuple is an ordered sequence that cannot change. Use it for small records whose fields have a fixed meaning by position, such as a host and port, and for multiple return values. Because tuples cannot change, they can be dictionary keys and set members (as long as everything inside them can, too); lists cannot:

```terminal
{
  "title": "tuples as records and keys",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> endpoint = (\"db-01\", 5432)\n>>> host, port = endpoint\n>>> latency_ms = {(\"db-01\", 5432): 1.8, (\"db-02\", 5432): 2.4}\n>>> latency_ms[(\"db-02\", 5432)]\n2.4\n>>> endpoint[1] = 5433\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    endpoint[1] = 5433\n    ~~~~~~~~^^^\nTypeError: 'tuple' object does not support item assignment\n>>> {[\"db-01\", 5432]: 1.8}\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    {[\"db-01\", 5432]: 1.8}\nTypeError: cannot use 'list' as a dict key (unhashable type: 'list')\n>>> exit()"
    }
  ]
}
```

When a record has more than two or three fields, give them names. A `dataclass` (Part 9) is usually the best choice; `collections.namedtuple` and `typing.NamedTuple` give you a tuple with named fields.

## Dictionaries

A dictionary maps **keys** to **values**. Lookups by key are fast however large the dictionary is, and since Python 3.7 a dictionary keeps the order in which keys were inserted. Keys must be hashable (strings, numbers, tuples); values can be anything, including other dictionaries:

```terminal
{
  "title": "dictionary basics",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> services = {\"api\": {\"port\": 8080, \"replicas\": 3}, \"worker\": {\"port\": None, \"replicas\": 2}}\n>>> services[\"api\"][\"port\"]\n8080\n>>> services[\"cron\"]\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    services[\"cron\"]\n    ~~~~~~~~^^^^^^^^\nKeyError: 'cron'\n>>> services.get(\"cron\")\n>>> services.get(\"cron\", {}).get(\"replicas\", 0)\n0\n>>> services[\"cron\"] = {\"port\": None, \"replicas\": 1}\n>>> for name, spec in services.items():\n...     print(f\"{name:<7} replicas={spec['replicas']}\")\n...\napi     replicas=3\nworker  replicas=2\ncron    replicas=1\n>>> \"worker\" in services\nTrue\n>>> del services[\"cron\"]\n>>> list(services)\n['api', 'worker']\n>>> exit()"
    }
  ]
}
```

- `d[key]` raises `KeyError` for a missing key. Use it when the key must exist; the error tells you exactly what is missing.
- `d.get(key, default)` returns the default instead. Chaining `.get(..., {})` walks optional nested keys without errors.
- `for key in d` loops over the keys; `d.items()` gives key and value pairs, and `d.values()` the values.
- `key in d` tests for a key, not a value.

### Layer configuration with |

The `|` operator (Python 3.9 and later) merges two dictionaries into a new one; on duplicate keys, the right side wins. That is exactly how layered configuration works: defaults, then a file, then environment overrides:

```terminal
{
  "title": "merge layers",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> defaults = {\"port\": 8080, \"workers\": 4, \"log_level\": \"info\"}\n>>> from_file = {\"workers\": 8}\n>>> from_env = {\"log_level\": \"debug\"}\n>>> defaults | from_file | from_env\n{'port': 8080, 'workers': 8, 'log_level': 'debug'}\n>>> defaults\n{'port': 8080, 'workers': 4, 'log_level': 'info'}\n>>> exit()"
    }
  ]
}
```

The merge is shallow: a nested dictionary on the right replaces the whole nested dictionary on the left. For deep merges, write a small recursive function like the `flatten()` from Part 4.

### setdefault and dictionary comprehensions

`d.setdefault(key, default)` returns the value for `key`, inserting the default first if the key is missing. A **dictionary comprehension** builds a dictionary from a loop in one expression:

```terminal
{
  "title": "setdefault and comprehensions",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> by_role = {}\n>>> for host in [\"web-01\", \"db-01\", \"web-02\", \"cache-01\", \"web-03\"]:\n...     by_role.setdefault(host.split(\"-\")[0], []).append(host)\n...\n>>> by_role\n{'web': ['web-01', 'web-02', 'web-03'], 'db': ['db-01'], 'cache': ['cache-01']}\n>>> {role: len(members) for role, members in by_role.items()}\n{'web': 3, 'db': 1, 'cache': 1}\n>>> {role: members for role, members in by_role.items() if len(members) > 1}\n{'web': ['web-01', 'web-02', 'web-03']}\n>>> exit()"
    }
  ]
}
```

## Sets

A set holds unique values with no order. Membership tests are fast, and the set operators answer the questions drift detection asks:

```terminal
{
  "title": "set operations",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> desired = {\"api\", \"worker\", \"scheduler\", \"metrics\"}\n>>> running = {\"api\", \"worker\", \"debug-shell\"}\n>>> desired - running\n{'metrics', 'scheduler'}\n>>> running - desired\n{'debug-shell'}\n>>> desired & running\n{'worker', 'api'}\n>>> desired ^ running\n{'metrics', 'scheduler', 'debug-shell'}\n>>> set([\"web-01\", \"web-02\", \"web-01\"])\n{'web-01', 'web-02'}\n>>> type({}), type(set())\n(<class 'dict'>, <class 'set'>)\n>>> exit()"
    }
  ]
}
```

`-` gives what is missing (desired but not running), the reverse gives what is unexpected, `&` what matches, `^` everything that differs and `|` the union. Note the last line: `{}` is an empty _dictionary_. Write `set()` for an empty set.

## Comprehensions and Generator Expressions

A **list comprehension** builds a list from a loop and an optional condition: `[expression for item in iterable if condition]`. It replaces the "create an empty list, loop, append" pattern. With parentheses instead of brackets you get a **generator expression**, which produces values one at a time; pass one straight to `sum()`, `any()`, `all()`, `max()` or `"".join()`:

```terminal
{
  "title": "comprehensions",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> disks = {\"web-01\": 91.5, \"db-01\": 62.0, \"web-02\": 97.2, \"cache-01\": 40.1}\n>>> [host for host, used in disks.items() if used > 90]\n['web-01', 'web-02']\n>>> {host.upper() for host in disks}\n{'WEB-02', 'DB-01', 'CACHE-01', 'WEB-01'}\n>>> sum(used for used in disks.values()) / len(disks)\n72.7\n>>> any(used > 95 for used in disks.values())\nTrue\n>>> all(used < 99 for used in disks.values())\nTrue\n>>> max(disks, key=disks.get)\n'web-02'\n>>> exit()"
    }
  ]
}
```

Keep comprehensions to one loop and one condition. If you need nested loops, several conditions or side effects such as printing, a plain `for` loop is clearer.

## The collections Module

The `collections` module adds specialized containers. Three of them show up in almost every log-processing or inventory script:

```python
from collections import Counter, defaultdict, deque

log_lines = [
    "10.0.0.5 GET /api/orders 200",
    "10.0.0.7 GET /api/orders 200",
    "10.0.0.5 POST /api/pay 502",
    "10.0.0.9 GET /health 200",
    "10.0.0.5 POST /api/pay 502",
    "10.0.0.7 GET /api/orders 404",
    "10.0.0.5 POST /api/pay 200",
]

# Counter: count anything hashable
statuses = Counter(line.split()[-1] for line in log_lines)
print(statuses)
print(statuses.most_common(2))
print(statuses["500"])  # missing keys count as 0

# defaultdict: a dictionary that creates missing values
paths_by_ip: defaultdict[str, set[str]] = defaultdict(set)
for line in log_lines:
    ip, _method, path, _status = line.split()
    paths_by_ip[ip].add(path)
for ip, paths in sorted(paths_by_ip.items()):
    print(ip, sorted(paths))

# deque with maxlen: keep only the last n items, like tail -n
last_three = deque(log_lines, maxlen=3)
print(list(last_three))
```

```terminal
{
  "title": "Counter, defaultdict and deque",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python collections_demo.py",
      "output": "Counter({'200': 4, '502': 2, '404': 1})\n[('200', 4), ('502', 2)]\n0\n10.0.0.5 ['/api/orders', '/api/pay']\n10.0.0.7 ['/api/orders']\n10.0.0.9 ['/health']\n['10.0.0.5 POST /api/pay 502', '10.0.0.7 GET /api/orders 404', '10.0.0.5 POST /api/pay 200']"
    }
  ]
}
```

- **`Counter`** counts items and returns 0 for anything it has not seen. `most_common(n)` gives the top entries, and counters can be added and subtracted.
- **`defaultdict(set)`** calls `set()` the first time you touch a missing key, so you can `.add()` straight away. `defaultdict(list)` and `defaultdict(int)` are the other common forms.
- **`deque(maxlen=n)`** drops items from the other end when it is full, which keeps the last n lines of a file without holding the whole file.

`collections.ChainMap` is worth knowing too: it looks keys up in several dictionaries in order without copying them, which is how you layer configuration when the layers can change later.

## Copies: Shallow and Deep

Assignment never copies. `b = a` makes `b` another name for the same list or dictionary, and `a.copy()` (or `dict(a)`, `list(a)`, `a[:]`) makes a **shallow** copy: a new outer container that still shares the nested objects. With nested configuration this causes a bug that is hard to spot:

```terminal
{
  "title": "a shallow copy shares nested data",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> defaults = {\"replicas\": 2, \"db\": {\"pool\": 10, \"timeout_s\": 5}}\n>>> prod = defaults.copy()\n>>> prod[\"replicas\"] = 6\n>>> prod[\"db\"][\"pool\"] = 50\n>>> defaults\n{'replicas': 2, 'db': {'pool': 50, 'timeout_s': 5}}\n>>> import copy\n>>> defaults = {\"replicas\": 2, \"db\": {\"pool\": 10, \"timeout_s\": 5}}\n>>> prod = copy.deepcopy(defaults)\n>>> prod[\"db\"][\"pool\"] = 50\n>>> defaults[\"db\"][\"pool\"], prod[\"db\"][\"pool\"]\n(10, 50)\n>>> exit()"
    }
  ]
}
```

Changing `replicas` on the copy was fine, but changing the nested `pool` also changed the defaults, because both dictionaries point to the same inner dictionary. `copy.deepcopy()` copies every level.

## Measure: list Versus set Membership

`x in some_list` checks the items one by one, so it gets slower as the list grows; `x in some_set` takes about the same time at any size. `python -m timeit` measures it (these numbers come from a small ARM board, so yours will be faster, but the ratio is what matters):

```terminal
{
  "title": "timeit: in on a list and on a set",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -m timeit -s 'hosts = [f\"host-{i}\" for i in range(100_000)]' '\"host-missing\" in hosts'",
      "output": "50 loops, best of 5: 5.26 msec per loop"
    },
    {
      "cmd": "python -m timeit -s 'hosts = {f\"host-{i}\" for i in range(100_000)}' '\"host-missing\" in hosts'",
      "output": "5000000 loops, best of 5: 66.2 nsec per loop"
    }
  ]
}
```

If a loop tests membership against a large list on every iteration, convert the list to a set once before the loop.

## Example: A Drift Report

Here is everything together. `desired` describes what should run (as you might load it from a file in Git), and `actual` is what an API reports (a list of records, the usual shape of API responses). The script turns the list into a dictionary keyed by name, then uses set operations to find what is missing and unexpected, and a loop with a dictionary comprehension to find what differs:

```python
"""Compare the desired state of a deployment with what is running."""

import json
from collections import Counter

desired = {
    "api": {"image": "ghcr.io/acme/api:1.4.2", "replicas": 3},
    "worker": {"image": "ghcr.io/acme/worker:1.4.2", "replicas": 2},
    "scheduler": {"image": "ghcr.io/acme/scheduler:1.4.0", "replicas": 1},
}

actual = [
    {"name": "api", "image": "ghcr.io/acme/api:1.4.2", "replicas": 3},
    {"name": "worker", "image": "ghcr.io/acme/worker:1.3.9", "replicas": 2},
    {"name": "debug-shell", "image": "busybox:1.37", "replicas": 1},
    {"name": "api-canary", "image": "ghcr.io/acme/api:1.5.0-rc1", "replicas": 1},
]

running = {item["name"]: item for item in actual}

changed = {}
for name, spec in desired.items():
    if name not in running:
        continue
    diffs = {
        field: {"want": want, "have": running[name][field]}
        for field, want in spec.items()
        if running[name][field] != want
    }
    if diffs:
        changed[name] = diffs

pods_per_tag: Counter[str] = Counter()
for item in actual:
    pods_per_tag[item["image"].rsplit(":", 1)[1]] += item["replicas"]

report = {
    "missing": sorted(desired.keys() - running.keys()),
    "unexpected": sorted(running.keys() - desired.keys()),
    "changed": changed,
    "pods_per_tag": pods_per_tag,
}

print(json.dumps(report, indent=2))
```

```terminal
{
  "title": "drift between desired and actual",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python drift.py",
      "output": "{\n  \"missing\": [\n    \"scheduler\"\n  ],\n  \"unexpected\": [\n    \"api-canary\",\n    \"debug-shell\"\n  ],\n  \"changed\": {\n    \"worker\": {\n      \"image\": {\n        \"want\": \"ghcr.io/acme/worker:1.4.2\",\n        \"have\": \"ghcr.io/acme/worker:1.3.9\"\n      }\n    }\n  },\n  \"pods_per_tag\": {\n    \"1.4.2\": 3,\n    \"1.3.9\": 2,\n    \"1.37\": 1,\n    \"1.5.0-rc1\": 1\n  }\n}"
    }
  ]
}
```

`desired.keys() - running.keys()` works because a dictionary's keys behave like a set. The first line, `{item["name"]: item for item in actual}`, is the standard way to index a list of records by one field. `json.dumps(..., indent=2)` prints the result as readable JSON, and it accepts a `Counter` because a `Counter` is a dictionary. [Part 7](/guides/introduction-to-python/07-file-operations) loads `desired` from a YAML file instead of hard-coding it.

## Common Mistakes

- **`{}` for an empty set.** It is a dictionary; use `set()`.
- **`d[key]` for optional keys**, or `.get()` for required ones. Pick the one that matches what a missing key means.
- **Shallow copies of nested data.** Use `copy.deepcopy()` before changing nested values of shared configuration.
- **A list or dict as a dictionary key or set member.** Convert to a tuple (or a frozenset).
- **`in` on a large list inside a loop.** Build a set once.
- **Sorting names that contain numbers as strings** (`web-10` before `web-9`). Sort by a key that extracts the number.
- **`list.sort()` in an expression.** It returns `None`; use `sorted()` when you need the result.

## Summary

- Lists are ordered and changeable; tuples are fixed records; dictionaries map keys to values in insertion order; sets hold unique values and answer membership and difference questions fast.
- `sorted(..., key=...)` with a tuple key sorts by several fields.
- `d.get()`, `|` merges and `setdefault()` cover most dictionary work; comprehensions build new collections in one expression.
- `Counter`, `defaultdict` and `deque(maxlen=n)` handle counting, grouping and "last n" without boilerplate.
- `copy()` is shallow; `copy.deepcopy()` copies nested data.

Next: [Modules and Packages](/guides/introduction-to-python/06-modules-and-packages), where the functions from the last two parts move into a package, and you install third-party libraries with pip and uv.

## Keep Learning

- [Finding local IP addresses using Python's standard library](/posts/finding-local-ip-addresses-using-pythons-stdlib), more standard library in a small, practical script.
- [Kill all processes with a given partial name](/posts/kill-processes-by-partial-name), the shell tools that produce the kind of lists you process here.
