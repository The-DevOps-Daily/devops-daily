---
title: 'Python Classes and Dataclasses: Object-Oriented Code for Ops Tools'
description: 'Python classes for real tools: dataclasses, enums, properties, special methods, Protocols vs inheritance, and an API client class, with real runs and mypy.'
order: 9
---

By now you have functions that check things, dictionaries that describe services and results, and an HTTP client with settings. As a tool grows, those pieces want to travel together: a check needs its settings _and_ the code that runs it, a result needs a fixed set of fields that every part of the program agrees on, and an API client needs its base URL, token and connection pool in one place. **Classes** bundle data with the functions that work on it.

This part covers classes and instances, the dataclass shortcut you will use most, enums for fixed sets of values, properties, special methods, and the choice between inheritance and Protocols. It ends with the check classes that [Part 10](/guides/introduction-to-python/10-building-a-python-project) packages into a command-line tool.

## Prerequisites

- The `~/pyops` project with httpx installed, and the test API `fakeapi.py` from [Part 8](/guides/introduction-to-python/08-error-handling) running in a second terminal: `python fakeapi.py 8080`.
- Functions, type hints and decorators from [Part 4](/guides/introduction-to-python/04-functions).

## Classes and Instances

A **class** describes a kind of object; an **instance** is one object of that kind. `__init__` runs when you create an instance and sets its **attributes**; methods are functions defined in the class, and they receive the instance as their first parameter, called `self` by convention:

```terminal
{
  "title": "a first class",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> class Server:\n...     def __init__(self, name, cpus, memory_gib):\n...         self.name = name\n...         self.cpus = cpus\n...         self.memory_gib = memory_gib\n...     def fits(self, cpus, memory_gib):\n...         return cpus <= self.cpus and memory_gib <= self.memory_gib\n...     def __repr__(self):\n...         return f\"Server({self.name!r}, cpus={self.cpus}, memory_gib={self.memory_gib})\"\n...\n>>> web = Server(\"web-01\", 4, 8)\n>>> web\nServer('web-01', cpus=4, memory_gib=8)\n>>> web.fits(2, 4), web.fits(8, 4)\n(True, False)\n>>> web.cpus = 8\n>>> web.fits(8, 4)\nTrue\n>>> exit()"
    }
  ]
}
```

`__repr__` is a **special method** (a "dunder" method, for the double underscores): Python calls it when it needs to show the object, in the REPL, in logs and in tracebacks. Without it you get `<__main__.Server object at 0x7f...>`, which tells you nothing.

### Class attributes are shared

A variable assigned in the class body, outside any method, belongs to the _class_ and is shared by every instance. That is fine for constants, and a classic bug for anything mutable:

```terminal
{
  "title": "a shared class attribute",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> class Host:\n...     tags = []\n...     def __init__(self, name):\n...         self.name = name\n...\n>>> web, db = Host(\"web-01\"), Host(\"db-01\")\n>>> web.tags.append(\"frontend\")\n>>> db.tags\n['frontend']\n>>> exit()"
    }
  ]
}
```

Create per-instance values in `__init__` (`self.tags = []`), or use a dataclass with a default factory, which the next section shows.

## Dataclasses

Most classes in operations code are mainly data: an endpoint, a check, a result, a deployment. Writing `__init__`, `__repr__` and `__eq__` for each one is boilerplate. The `@dataclass` decorator generates them from annotated fields:

```python
from dataclasses import asdict, dataclass, field, replace


@dataclass(frozen=True, slots=True, order=True)
class Endpoint:
    host: str
    port: int = 443
    tags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not 1 <= self.port <= 65535:
            raise ValueError(f"port out of range: {self.port}")

    @property
    def url(self) -> str:
        return f"https://{self.host}:{self.port}/"


@dataclass(slots=True)
class Service:
    name: str
    endpoints: list[Endpoint] = field(default_factory=list)
    replicas: int = 1
```

```terminal
{
  "title": "dataclasses at work",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> from dataclasses import asdict, replace\n>>> from endpoints import Endpoint, Service\n>>> api = Endpoint(\"api.internal\", tags=(\"public\",))\n>>> api\nEndpoint(host='api.internal', port=443, tags=('public',))\n>>> api == Endpoint(\"api.internal\", 443, (\"public\",))\nTrue\n>>> api.url\n'https://api.internal:443/'\n>>> sorted([Endpoint(\"db\", 5432), Endpoint(\"api\"), Endpoint(\"api\", 8443)])\n[Endpoint(host='api', port=443, tags=()), Endpoint(host='api', port=8443, tags=()), Endpoint(host='db', port=5432, tags=())]\n>>> replace(api, port=8443)\nEndpoint(host='api.internal', port=8443, tags=('public',))\n>>> svc = Service(\"checkout\", [api])\n>>> asdict(svc)\n{'name': 'checkout', 'endpoints': [{'host': 'api.internal', 'port': 443, 'tags': ('public',)}], 'replicas': 1}\n>>> api.port = 80\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    api.port = 80\n    ^^^^^^^^\n  File \"<string>\", line 34, in __setattr__\ndataclasses.FrozenInstanceError: cannot assign to field 'port'\n>>> Endpoint(\"db\", 70000)\nTraceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\n    Endpoint(\"db\", 70000)\n    ~~~~~~~~^^^^^^^^^^^^^\n  File \"<string>\", line 6, in __init__\n  File \"/home/dev/pyops/endpoints.py\", line 12, in __post_init__\n    raise ValueError(f\"port out of range: {self.port}\")\nValueError: port out of range: 70000\n>>> exit()"
    }
  ]
}
```

What each option does:

- **Generated methods**: `__init__` takes the fields in order with their defaults, `__repr__` shows them, and `__eq__` compares them, so two endpoints with the same values are equal.
- **`frozen=True`** makes instances read-only: assigning to a field raises `FrozenInstanceError`. Frozen instances are also hashable, so they can go in sets and be dictionary keys, as long as every field is hashable. Freezing stops reassignment, not changes _inside_ a mutable field such as a list, which is why `Endpoint` keeps its tags in a tuple. Use it for values that should not change after creation, such as results and configuration.
- **`order=True`** adds `<`, `>` and friends, comparing fields in order, so `sorted()` works.
- **`slots=True`** (Python 3.10 and later) stores attributes in fixed slots instead of a dictionary: less memory, and a typo such as `api.prot = 80` raises an error instead of quietly creating a new attribute.
- **`__post_init__`** runs after the generated `__init__`; it is the place for validation.
- **`field(default_factory=list)`** gives each instance its own new list. A plain `= []` default is refused outright, because it would be shared (the trap from Part 4):

```terminal
{
  "title": "no mutable defaults",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> from dataclasses import dataclass\n>>> try:\n...     @dataclass\n...     class Bad:\n...         tags: list[str] = []\n... except ValueError as err:\n...     print(err)\n...\nmutable default <class 'list'> for field tags is not allowed: use default_factory\n>>> exit()"
    }
  ]
}
```

`asdict()` converts a dataclass (recursively) into dictionaries and lists, ready for `json.dumps()`, and `replace()` returns a copy with some fields changed, which is how you "modify" a frozen instance.

## Enums for Fixed Sets of Values

When a value can only be one of a few things (a check status, an environment, a log level), an **enum** turns typos into errors and gives you one place that lists the options. `StrEnum` (Python 3.11 and later) members are also real strings, so they compare with strings and serialize to JSON as is:

```terminal
{
  "title": "StrEnum",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import json\n>>> from enum import StrEnum\n>>> class Status(StrEnum):\n...     OK = \"ok\"\n...     WARN = \"warn\"\n...     FAIL = \"fail\"\n...\n>>> Status.FAIL, Status.FAIL == \"fail\"\n(<Status.FAIL: 'fail'>, True)\n>>> Status(\"warn\")\n<Status.WARN: 'warn'>\n>>> [s.value for s in Status]\n['ok', 'warn', 'fail']\n>>> json.dumps({\"api\": Status.OK})\n'{\"api\": \"ok\"}'\n>>> try:\n...     Status(\"broken\")\n... except ValueError as err:\n...     print(err)\n...\n'broken' is not a valid Status\n>>> exit()"
    }
  ]
}
```

## Properties

A **property** is a method that you read like an attribute. Use it for values computed from other fields, so they can never be out of date. `Endpoint.url` above is one; here is another:

```terminal
{
  "title": "a computed property",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> import shutil\n>>> from dataclasses import dataclass\n>>> @dataclass(frozen=True)\n... class DiskUsage:\n...     total: int\n...     used: int\n...     @property\n...     def used_percent(self):\n...         return round(self.used / self.total * 100, 1)\n...\n>>> usage = DiskUsage(*shutil.disk_usage(\"/tmp\")[:2])\n>>> usage.used_percent\n0.0\n>>> DiskUsage(total=100, used=91).used_percent\n91.0\n>>> exit()"
    }
  ]
}
```

Do not write Java-style `get_x()` and `set_x()` methods. Start with a plain attribute; if you later need logic, turn it into a property and no caller has to change.

## Special Methods: Make Objects Behave Like Built-ins

Special methods let your objects work with Python's syntax and built-in functions: `len()` calls `__len__`, `in` calls `__contains__`, a `for` loop calls `__iter__`, and `with` calls `__enter__` and `__exit__`. An inventory class that supports all of them reads naturally:

```python
from collections.abc import Iterator


class Inventory:
    """Hosts and the roles they have."""

    def __init__(self) -> None:
        self._roles: dict[str, set[str]] = {}

    def add(self, host: str, *roles: str) -> None:
        self._roles.setdefault(host, set()).update(roles)

    def with_role(self, role: str) -> list[str]:
        return sorted(host for host, roles in self._roles.items() if role in roles)

    def __len__(self) -> int:
        return len(self._roles)

    def __contains__(self, host: object) -> bool:
        return host in self._roles

    def __iter__(self) -> Iterator[str]:
        return iter(sorted(self._roles))

    def __repr__(self) -> str:
        return f"Inventory({len(self)} hosts)"
```

```terminal
{
  "title": "an inventory that acts like a collection",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> from inventory import Inventory\n>>> inv = Inventory()\n>>> inv.add(\"web-01\", \"web\", \"prod\")\n>>> inv.add(\"web-02\", \"web\", \"prod\")\n>>> inv.add(\"db-01\", \"db\", \"prod\")\n>>> inv.add(\"web-01\", \"canary\")\n>>> inv, len(inv), \"db-01\" in inv, \"db-02\" in inv\n(Inventory(3 hosts), 3, True, False)\n>>> list(inv)\n['db-01', 'web-01', 'web-02']\n>>> inv.with_role(\"web\"), inv.with_role(\"canary\")\n(['web-01', 'web-02'], ['web-01'])\n>>> exit()"
    }
  ]
}
```

The leading underscore in `self._roles` marks the attribute as internal: Python does not enforce it, but it tells other code not to touch it, so the class can change how it stores hosts later.

## Inheritance, ABCs and Protocols

**Inheritance** lets a class reuse and extend another: `class TcpCheck(Check)` gets every method of `Check` and can override some. An **abstract base class** (from the `abc` module) declares methods that every subclass must implement, and Python refuses to create an instance of a subclass that forgot one.

For tools like this one there is usually a better fit: a **Protocol** (from `typing`). A Protocol describes what an object must _have_, and any class with those attributes and methods qualifies, without inheriting from anything. That is Python's duck typing ("if it has a `run()` method, it is a check"), made checkable by mypy. Here are the checks from the earlier parts as classes that all satisfy one Protocol:

```python
"""Health checks as small classes: python checks.py"""

import shutil
import socket
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


class Check(Protocol):
    """Anything with a name and a run() method that returns a Result."""

    name: str

    def run(self) -> Result: ...


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
        except httpx.HTTPError as err:
            return Result(self.name, Status.FAIL, f"{type(err).__name__}: {err}", elapsed_ms(start))
        ok = response.status_code == self.expect_status
        return Result(self.name, Status.OK if ok else Status.FAIL, f"HTTP {response.status_code}", elapsed_ms(start))


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
            return Result(self.name, Status.FAIL, str(err), elapsed_ms(start))
        return Result(self.name, Status.OK, f"{self.host}:{self.port} accepts connections", elapsed_ms(start))


@dataclass(slots=True)
class DiskCheck:
    name: str
    path: str = "/"
    warn_percent: float = 80.0
    max_used_percent: float = 90.0

    def run(self) -> Result:
        usage = shutil.disk_usage(self.path)
        if usage.total <= 0:  # /proc and other virtual file systems report no size
            return Result(self.name, Status.FAIL, "no measurable capacity")
        used = usage.used / usage.total * 100
        if used >= self.max_used_percent:
            status = Status.FAIL
        elif used >= self.warn_percent:
            status = Status.WARN
        else:
            status = Status.OK
        return Result(self.name, status, f"{used:.1f}% used")


def run_all(checks: list[Check]) -> list[Result]:
    return [check.run() for check in checks]


if __name__ == "__main__":
    checks: list[Check] = [
        HttpCheck("api", "http://127.0.0.1:8080/health"),
        HttpCheck("deploys", "http://127.0.0.1:8080/deploys"),
        TcpCheck("postgres", "127.0.0.1", 5432, timeout=1.0),
        DiskCheck("tmp-disk", path="/tmp"),
    ]
    for result in sorted(run_all(checks), key=lambda r: r.status != Status.FAIL):
        print(f"{result.status.upper():<4}  {result.name:<9} {result.detail} ({result.duration_ms} ms)")
```

```terminal
{
  "title": "checks as classes",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python checks.py",
      "output": "FAIL  deploys   HTTP 401 (28.0 ms)\nFAIL  postgres  [Errno 111] Connection refused (1.1 ms)\nOK    api       HTTP 200 (587.2 ms)\nOK    tmp-disk  0.0% used (0.0 ms)"
    }
  ]
}
```

Every check is a small dataclass with its settings as fields and one `run()` method that returns a `Result`. `run_all()` does not know or care which classes it gets: anything with a `name` and a `run()` that returns a `Result` works, including test doubles and checks you add later. The `deploys` check failed because it sends no token, and `postgres` because nothing listens on port 5432 here.

The Protocol is not just documentation. If someone writes a check with the wrong method name, mypy catches it before it runs:

```python
from dataclasses import dataclass

from checks import Result, Status, run_all


@dataclass
class PingCheck:
    name: str
    host: str

    def check(self) -> Result:  # should be run()
        return Result(self.name, Status.OK, "pong")


run_all([PingCheck("gateway", "10.0.0.1")])
```

```terminal
{
  "title": "mypy enforces the Protocol",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "uvx --with httpx mypy ping.py",
      "output": "Installed 12 packages in 79ms\nping.py:15: error: List item 0 has incompatible type \"PingCheck\"; expected \"Check\"  [list-item]\nping.py:15: note: \"PingCheck\" is missing following \"Check\" protocol member:\nping.py:15: note:     run\nFound 1 error in 1 file (checked 1 source file)"
    }
  ]
}
```

(`--with httpx` installs httpx next to mypy, so mypy can see its type information when it follows the import of `checks.py`.)

When should you inherit instead? When subclasses really share _code_, not just a shape: for example, a base class whose `run()` handles timing and error wrapping and calls an abstract `_probe()` that each subclass implements. Keep hierarchies shallow, one or two levels; deep inheritance trees are hard to follow and harder to change. For most tools, small dataclasses plus a Protocol, combined by **composition** (objects holding other objects, like `Service` holding `Endpoint`s), are enough.

## Class Methods and Static Methods

A `@classmethod` receives the class instead of an instance, which makes it the standard way to write **alternative constructors**: build an object from a dictionary, a file or an environment. A `@staticmethod` is a plain function that lives in the class's namespace; a module-level function is usually just as good.

```terminal
{
  "title": "an alternative constructor",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python -q",
      "output": ">>> from dataclasses import dataclass\n>>> @dataclass(frozen=True)\n... class TcpTarget:\n...     host: str\n...     port: int\n...     @classmethod\n...     def parse(cls, text):\n...         host, _, port = text.rpartition(\":\")\n...         return cls(host.strip(\"[]\"), int(port))\n...\n>>> TcpTarget.parse(\"db-01.internal:5432\")\nTcpTarget(host='db-01.internal', port=5432)\n>>> TcpTarget.parse(\"[2001:db8::10]:443\")\nTcpTarget(host='2001:db8::10', port=443)\n>>> exit()"
    }
  ]
}
```

## A Client Class for an API

The HTTP client from Part 8 becomes a class: the constructor takes the settings, methods hide the URLs and turn JSON into dataclasses, and `__enter__`/`__exit__` close the connection pool, so `with` works. Note the `__repr__`: it shows the URL but never the token, so the object is safe to log:

```python
import os
from dataclasses import dataclass
from types import TracebackType
from typing import Self

import httpx


@dataclass(frozen=True, slots=True)
class Deploy:
    id: int
    version: str


class DeployAPI:
    """A client for the deployment API of the test server."""

    def __init__(self, base_url: str, token: str | None = None, timeout: float = 2.0) -> None:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.Client(base_url=base_url, headers=headers, timeout=timeout)

    @classmethod
    def from_env(cls) -> Self:
        return cls(os.environ.get("API_URL", "http://127.0.0.1:8080"), os.environ.get("API_TOKEN"))

    def deploys(self) -> list[Deploy]:
        response = self._client.get("/deploys")
        response.raise_for_status()
        return [Deploy(**item) for item in response.json()]

    def latest(self) -> Deploy:
        return max(self.deploys(), key=lambda d: d.id)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def __repr__(self) -> str:
        return f"DeployAPI({str(self._client.base_url)!r})"


if __name__ == "__main__":
    with DeployAPI.from_env() as api:
        print(api)
        print(api.latest())
```

```terminal
{
  "title": "the API client class",
  "prompt": "(pyops) $",
  "autoplay": false,
  "steps": [
    {
      "cmd": "API_TOKEN=test-token python deploy_api.py",
      "output": "DeployAPI('http://127.0.0.1:8080')\nDeploy(id=42, version='1.4.2')"
    },
    {
      "cmd": "python deploy_api.py 2>&1 | tail -n 2",
      "output": "httpx.HTTPStatusError: Client error '401 Unauthorized' for url 'http://127.0.0.1:8080/deploys'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401"
    }
  ]
}
```

`Self` (from `typing`, Python 3.11 and later) is the type hint for "an instance of this class", which keeps `from_env()` and `__enter__` correct in subclasses too. `Deploy(**item)` builds a dataclass from a dictionary whose keys match the fields; if the API adds a field, it raises a `TypeError`, which you may prefer to ignoring unknown data silently, or not (then pick the fields you need explicitly). For large API schemas, a validation library such as Pydantic builds typed objects from JSON with clear error messages.

## Common Mistakes

- **Mutable class attributes** used as per-instance state. Set them in `__init__` or use `field(default_factory=...)`.
- **Classes for everything.** A module with functions is often enough; add a class when data and behaviour belong together or you need several instances with different settings.
- **Getters and setters.** Use attributes, and properties when you need logic.
- **Deep inheritance** to share a few lines of code. Prefer composition and Protocols.
- **No `__repr__`**, or a `__repr__` that prints secrets.
- **Forgetting `self`** as the first parameter of a method, or calling a method on the class instead of an instance.
- **Mutable dataclasses for results and configuration.** Freeze them, so nothing changes them by accident after validation.

## Summary

- A class bundles data (attributes) with behaviour (methods); `__init__` sets up an instance and `self` is the instance.
- `@dataclass` generates `__init__`, `__repr__` and `__eq__`; use `frozen=True` for values, `slots=True` to catch typos, `field(default_factory=...)` for mutable defaults and `__post_init__` for validation.
- `StrEnum` gives you named, typo-proof constants that are still strings.
- Properties compute values on access; special methods make objects work with `len`, `in`, `for` and `with`.
- Protocols describe what an object must have, mypy checks them, and they keep tools open to new implementations without inheritance.

Next: [Building a Python Project](/guides/introduction-to-python/10-building-a-python-project), where the checks become `svcheck`, a packaged command-line tool with a TOML config, tests, linting, type checking and CI.

## Keep Learning

- The [dataclasses documentation](https://docs.python.org/3/library/dataclasses.html) and the [typing guide to Protocols](https://typing.python.org/en/latest/spec/protocol.html).
- [The Python Fundamentals Quiz](/quizzes/python-quiz) has questions on classes and dunder methods.
