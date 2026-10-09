---
title: 'Python 3.15 Made UTF-8 the Default. We Ran 13 Cases in Seven Linux Locales to See What Changes'
excerpt: 'Python 3.15 turns on UTF-8 mode everywhere. With container locale settings, none of our 13 encoding cases changed. On a UTF-8 server, only stdin and stdout changed. On a legacy-locale host, almost everything did, and the PYTHONUTF8=0 opt-out dropped LC_ALL=C processes to ASCII.'
category:
  name: 'Python'
  slug: 'python'
date: '2026-10-10'
publishedAt: '2026-10-10T09:00:00Z'
updatedAt: '2026-10-10T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Python
  - Python 3.15
  - UTF-8
  - Unicode
  - Linux
  - Containers
  - DevOps
---

Python 3.15.0 came out on October 9. The headline change for anyone who runs Python on servers is [PEP 686](https://peps.python.org/pep-0686/): UTF-8 mode is now on by default. The [What's New page](https://docs.python.org/3.15/whatsnew/3.15.html) says that `open('flying-circus.txt')` with no `encoding` now reads UTF-8, "independent of the system's environment". The PEP says the change "mostly affects Windows users", because most Unix systems already use a UTF-8 locale.

"Mostly" is not "only". We wanted to know exactly what changes on Linux, so we ran the same 13 cases on Python 3.14.8 and 3.15.0, each with its default settings and with `PYTHONUTF8=0`, in seven locales, from a bare container to a Latin-1 server. A file read with no `encoding` is the least of it. The changes we found are in stdin and stdout, on hosts with an old locale, and in what the opt-out switch really gives you.

## TLDR

- **Container locale settings: no change.** With no locale, `LANG=C` or `LC_ALL=C`, 3.14 and 3.15 gave the same result in all 13 cases. Python 3.7 and later already turn UTF-8 mode on in the C locale. The official `python` images set no `LANG` from 3.13, and `LANG=C.UTF-8` before that. Both settings gave zero differences.
- **UTF-8 servers (`en_US.UTF-8`): only stdin and stdout change.** `open()`, `subprocess` and environment variables gave the same results. Bytes that are not valid UTF-8 on stdin crashed 3.14 and pass through on 3.15 as lone surrogates. When we turned them into JSON, jq and Node replaced them with U+FFFD, so the original byte was lost.
- **Legacy locales (`LANG=en_US`, which is ISO-8859-1 in glibc, and `ja_JP.eucJP`): 11 and 10 of 13 cases change.** UTF-8 data starts to work. ISO-8859-1 data stops working. In the ISO-8859-1 locale, 3.14 never raised an error on UTF-8 input. It gave mojibake.
- **The opt-out is not "what 3.14 did".** `PYTHONUTF8=0` gave the same result on 3.14 and 3.15 in every case. What changed is the default: 3.14 turned UTF-8 mode on by itself in the C locale. So with `LC_ALL=C`, 3.15 with `PYTHONUTF8=0` fell back to ASCII. 7 cases differed from 3.14's defaults, and 4 that worked raised errors.
- **You can find the affected calls today.** `-X warn_default_encoding` reported the same 4 calls on 3.14 and 3.15. On a sample script, our static checker and the runtime warning reported the same 6 lines.

## Prerequisites

- Python 3.14 or 3.15 on Linux, and a shell
- Optional: the [demo repo](https://github.com/The-DevOps-Daily/python-315-utf8-default), which needs [uv](https://docs.astral.sh/uv/) and glibc's `localedef`

## What UTF-8 mode changes, and where it was already on

UTF-8 mode is not new. [PEP 540](https://peps.python.org/pep-0540/) added it in Python 3.7. When it is on, Python ignores the locale encoding for four things, which the [3.15 docs](https://docs.python.org/3.15/library/os.html#utf8-mode) list:

1. `sys.getfilesystemencoding()` returns `utf-8`, so file names, `os.environ` and `sys.argv` decode as UTF-8.
2. `locale.getpreferredencoding()` returns `utf-8`, so `open()`, `Path.read_text()` and `subprocess` with `text=True` use UTF-8 when you give no `encoding`.
3. stdin and stdout use UTF-8 with the `surrogateescape` error handler.
4. `os.device_encoding()` returns `utf-8` for a terminal on Unix.

Before 3.15, the 3.14 docs say, it was on "if the LC_CTYPE locale is `C` or `POSIX` at Python startup". [PEP 538](https://peps.python.org/pep-0538/), also in 3.7, coerces a C locale to `C.UTF-8` and gives the coercion target locales `surrogateescape` on stdin and stdout too. That covers most containers. So on Linux, 3.15 changes behaviour in two places: real UTF-8 locales such as `en_US.UTF-8`, and locales that are not UTF-8 at all.

## The test

The [repo](https://github.com/The-DevOps-Daily/python-315-utf8-default) has 13 small cases. Each one does one thing that depends on the default encoding: read an ISO-8859-1 file, read a UTF-8 file, write `café 25€`, read a child process's output with `text=True`, read an ISO-8859-1 value from `os.environ` and `sys.argv`, read stdin, print a file name that is not valid UTF-8, and so on. Two of the 13 are controls that should not depend on the locale: a read with `encoding="locale"`, and the `EncodingWarning` check. A separate check, `handoff`, has one version write a file and the other read it on the same host.

The runner starts every case from an empty environment, with only `PATH`, `LOCPATH`, `PYTHONDONTWRITEBYTECODE` and the locale variables. It runs each case with four interpreter settings (3.14.8 and 3.15.0, each with its default and with `PYTHONUTF8=0`) in seven locales:

| Locale             | Stands for                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------- |
| no locale          | an image that sets no locale, such as the official `python:3.13` and later images        |
| `LANG=C`           | an image or script that sets the C locale                                                |
| `LC_ALL=C`         | the same, set the way build scripts set it for stable sort order                         |
| `LANG=C.UTF-8`     | the official `python:3.12` and older images                                              |
| `LANG=en_US.UTF-8` | a typical server or laptop                                                               |
| `LANG=en_US`       | ISO-8859-1 in glibc's list of supported locales: an older server set up for a legacy app |
| `LANG=ja_JP.eucJP` | a legacy CJK locale                                                                      |

`localedef` builds the locales into the repo, so the result does not depend on what the host has installed. Before it trusts a row, the runner checks that the locale reports the encoding it should. If it does not, the runner stops, so a missing locale cannot pass as a result. A case "differs" between two settings when anything recorded differs: the returned value, the error message, the exit code or the bytes written. We wrote the claim in [`CLAIM.md`](https://github.com/The-DevOps-Daily/python-315-utf8-default/blob/main/CLAIM.md) before the first run, with the results that would prove it wrong, and `check_claim.py` checks it against the recorded results.

```terminal
{
  "title": "python-315-utf8-default",
  "prompt": "$",
  "steps": [
    { "cmd": "./scripts/setup.sh", "output": "locales: C.UTF-8 en_US en_US.UTF-8 ja_JP.eucJP" },
    { "cmd": "python3 scripts/run_matrix.py", "output": "406 results from 420 interpreter runs written to results/matrix.json" }
  ]
}
```

Then `python3 scripts/check_claim.py` checks the claim. This is what it wrote to `results/claim-check.txt`:

```text
PASS  no locale: 3.14 and 3.15 agree in every case
PASS  LANG=C: 3.14 and 3.15 agree in every case
PASS  LC_ALL=C: 3.14 and 3.15 agree in every case
PASS  LANG=C.UTF-8: open(), subprocess and environment cases agree
FAIL  LANG=C.UTF-8: invalid UTF-8 on stdin/stdout differs between 3.14 and 3.15
      differs: nothing
PASS  LANG=en_US.UTF-8: open(), subprocess and environment cases agree
      stdin_latin1, stdin_to_json, stdout_filename
PASS  LANG=en_US.UTF-8: invalid UTF-8 on stdin/stdout differs between 3.14 and 3.15
      differs: stdin_latin1, stdin_to_json, stdout_filename
PASS  LANG=en_US: every case that uses the default encoding differs (11 of 13)
      agree: read_latin1_locale, encoding_warning
FAIL  LANG=ja_JP.eucJP: every case that uses the default encoding differs (10 of 13)
      agree: read_latin1_locale, environ_argv, encoding_warning
FAIL  3.15 + PYTHONUTF8=0 gives the 3.14 default result in every case
      LC_ALL=C: read_latin1; LC_ALL=C: read_utf8; LC_ALL=C: write_text; LC_ALL=C: subprocess_latin1; LC_ALL=C: subprocess_utf8; LC_ALL=C: stdin_utf8; LC_ALL=C: stdout_utf8
PASS  PYTHONUTF8=0 gives the same result on 3.14 and 3.15 in every case
PASS  -X warn_default_encoding reports the same 4 calls on 3.14 and 3.15
```

The three `FAIL` lines are where our claim was wrong. We expected `C.UTF-8` to behave like `en_US.UTF-8`. We expected every default-encoding case to change in `ja_JP.eucJP`. And we expected `PYTHONUTF8=0` to bring back 3.14 behaviour everywhere. All three are covered below.

```chart
{
  "type": "bar",
  "title": "Cases where 3.15 gives a different result from 3.14",
  "unit": " of 13",
  "caption": "13 cases per locale, Python 3.14.8 vs 3.15.0, Linux aarch64, glibc 2.36. A case differs when the value, error, exit code or bytes written differ. The last row compares 3.14 defaults with 3.15 run with PYTHONUTF8=0. Source: results/matrix.json in the demo repo.",
  "rows": [
    { "label": "no locale", "value": 0, "series": "3.15 default" },
    { "label": "LANG=C", "value": 0, "series": "3.15 default" },
    { "label": "LC_ALL=C", "value": 0, "series": "3.15 default" },
    { "label": "LANG=C.UTF-8", "value": 0, "series": "3.15 default" },
    { "label": "LANG=en_US.UTF-8", "value": 3, "series": "3.15 default" },
    { "label": "LANG=en_US (ISO-8859-1)", "value": 11, "series": "3.15 default" },
    { "label": "LANG=ja_JP.eucJP", "value": 10, "series": "3.15 default" },
    { "label": "LC_ALL=C, PYTHONUTF8=0", "value": 7, "series": "3.15 with PYTHONUTF8=0" }
  ],
  "series": [
    { "name": "3.15 default", "color": "#f59e0b" },
    { "name": "3.15 with PYTHONUTF8=0", "color": "#ef4444" }
  ]
}
```

## Container locale settings: nothing changed

In the first three locales, 3.14 and 3.15 agreed in every case, including the ones that fail. An ISO-8859-1 file read with no `encoding` raised `UnicodeDecodeError` on both. A UTF-8 file read correctly on both. That is UTF-8 mode working on 3.14 already, because the locale was C.

We expected `LANG=C.UTF-8` to show the stdin and stdout change, since 3.14 has UTF-8 mode off there. It did not. 3.14 already uses `surrogateescape` on stdin and stdout in `C.UTF-8`, because that is one of the locales PEP 538 coerces C to, and the PEP gives those locales the same error handler. So all four container-style locales agreed on all 13 cases.

That matters for images. The [official python Dockerfiles](https://github.com/docker-library/python) dropped `ENV LANG C.UTF-8` for 3.13 and later in [December 2023](https://github.com/docker-library/python/commit/0d539116871a326fd6b3d35b0c528b8fbdffe573), and the 3.12 and older images still set it. Both settings are rows with zero differences. We did not run the images themselves. We ran their locale settings with uv's Python builds on one glibc host, so treat this as the result for those settings, not a test of every image. Alpine uses musl, a different C library, and we did not test it.

## UTF-8 servers: stdin and stdout are what change

In `en_US.UTF-8`, the `open()`, `subprocess` and environment cases agreed. The locale encoding was UTF-8, so the default was UTF-8 before and after. Three cases changed, and all three are about bytes that are not valid UTF-8 on stdin or stdout:

| Case, `LANG=en_US.UTF-8`             | 3.14                                                                     | 3.15                              |
| ------------------------------------ | ------------------------------------------------------------------------ | --------------------------------- |
| `sys.stdin.read()` on `caf\xe9`      | `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe9 in position 3` | `'caf\udce9\n'`                   |
| Print a file named `report-\xe9.csv` | exit 1, `UnicodeEncodeError: ... surrogates not allowed`                 | exit 0, writes the original bytes |
| stdin to `json.dumps` to a file      | `UnicodeDecodeError` at the read                                         | writes `{"line": "caf\udce9\n"}`  |

3.14 used the `strict` error handler on stdin and stdout in a normal UTF-8 locale. 3.15 uses `surrogateescape`, which maps each bad byte to a lone surrogate (`\udce9` for `0xe9`). You get the original byte back only where something encodes the text with `surrogateescape` again. stdout does, which is why printing the odd file name now works. A strict UTF-8 encode, such as writing to a file opened with `encoding="utf-8"`, raises. And some consumers replace the surrogate. So the error moves from the input to a later step, or there is no error and the data changes.

The JSON case shows the second outcome. `json.dumps` with its defaults writes the surrogate as the escape `\udce9`, which is valid JSON syntax but not a valid character. [RFC 8259 section 8.2](https://www.rfc-editor.org/rfc/rfc8259#section-8.2) says the behaviour of software that receives such values "is unpredictable". We piped the line into two consumers:

```text
input bytes on stdin:   63 61 66 e9 0a (the script strips the newline)
3.15 wrote:             {"line": "caf\udce9"}
jq-1.6 -r .line: 63 61 66 ef bf bd 0a
node v24.14.0 JSON.parse, written as UTF-8: 63 61 66 ef bf bd 0a
ef bf bd is U+FFFD, the replacement character: the original byte e9 is gone.
```

On 3.14 this pipeline crashed at the read, on a UTF-8 server. On 3.15 it runs, and both consumers we tried replaced the byte with U+FFFD. In the container locales, 3.14 already wrote the same line, so the risk is not new. What is new is that a log shipper or ETL script that crashed on bad input on your UTF-8 servers now writes slightly wrong data instead.

If you want the 3.14 crash back for one script, either of the first two lines below works on 3.15. The third keeps the raw bytes instead:

```text
default:                      'caf\udce9\n'
stdin.reconfigure(strict):    UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe9 in position 3: invalid continuation byte
PYTHONIOENCODING=utf-8:strict UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe9 in position 3: invalid continuation byte
sys.stdin.buffer (bytes):     b'caf\xe9\n'
```

`sys.stdin.reconfigure(errors="strict")` at the top of the script is the most explicit way to fail at the input. If the input can be any bytes, read `sys.stdin.buffer` and decode it yourself with the encoding you expect.

## Legacy locales: one set of failures for another

On a host with `LANG=en_US`, glibc uses ISO-8859-1. 11 of the 13 cases changed, which is every case except the two controls:

- **Five got better.** Reading a UTF-8 file, writing `café 25€`, reading UTF-8 from a child process, reading UTF-8 on stdin, and printing `café 25€` all work on 3.15. On 3.14, the two that write `€` raised errors, because ISO-8859-1 has no `€`. The other three gave mojibake with no error: `'caf\xc3\xa9 25\xe2\x82\xac'` instead of `café 25€`. ISO-8859-1 maps every byte to a character, so decoding never fails. It only gives wrong text.
- **Five got worse.** Reading an ISO-8859-1 file now raises `UnicodeDecodeError`. So does reading ISO-8859-1 output from a child process. An ISO-8859-1 value in `os.environ` or `sys.argv` now decodes as `'caf\udce9'` and fails later, when you encode it as UTF-8. Stdin turns into surrogates, and the JSON line changes from `caf\u00e9` to `caf\udce9`.
- **One printed the same bytes** by a different route: `os.listdir()` returned a different string, and stdout turned it back into the same bytes.

In `ja_JP.eucJP`, 10 of 13 cases changed. The environment case did not, because its ISO-8859-1 byte is invalid in EUC-JP too, so both versions decode it to the same surrogate. Here 3.14's EUC-JP decoder raised on UTF-8 input, where ISO-8859-1 had given mojibake. Our fixtures hold UTF-8 and ISO-8859-1 text only, so this row says nothing about valid EUC-JP data. If you have Japanese legacy data, test it with your own files.

The `handoff` check shows the risk during a rolling upgrade. On the `LANG=en_US` host, a 3.15 job wrote `café 25€` as UTF-8, and a 3.14 job read it back as `'caf\xc3\xa9 25\xe2\x82\xac\n'`, with no error. The other direction failed loudly: 3.14 could not encode `€` in ISO-8859-1, and because `open("w")` creates or truncates the file before the write, it left an empty file.

If your legacy data really is ISO-8859-1, say so in the code. `encoding="latin-1"` reads it correctly on every version. `encoding="locale"`, added in Python 3.10, uses the locale encoding even in UTF-8 mode. It read the ISO-8859-1 file correctly on 3.14 and 3.15 in the `en_US` locale.

## The opt-out is not "what 3.14 did"

The release notes give one way back: "To retain the previous behaviour, Python's UTF-8 mode may be disabled with the `PYTHONUTF8=0` environment variable or the `-X utf8=0` command-line option." The switch itself did not change. With `PYTHONUTF8=0`, 3.14 and 3.15 gave the same result in all 13 cases in all seven locales. What changed is the default, and the default in 3.14 was not "off". It was "on in the C locale, off elsewhere". `PYTHONUTF8=0` is off everywhere.

In six of the seven locales, that made no difference: 3.15 with `PYTHONUTF8=0` matched 3.14's defaults. With `LANG=C`, PEP 538 still coerces the locale to `C.UTF-8`, so the encoding stays UTF-8. With `LC_ALL=C`, coercion does not happen (PEP 538 skips it when `LC_ALL` is set), so the locale encoding is ASCII, and that is what 3.15 used:

```text
## LC_ALL=C with PYTHONUTF8=0: reading a UTF-8 file
no encoding:                  UnicodeDecodeError: 'ascii' codec can't decode byte 0xc3 in position 3: ordinal not in range(128)
encoding="utf-8":             'caf\xe9 25\u20ac\n'
```

7 of the 13 cases differed from 3.14's defaults. Four that worked on 3.14 raised: reading a UTF-8 file, writing `café 25€`, reading UTF-8 from a child process, and printing `café 25€`. One more turned UTF-8 on stdin into surrogates with no error. The other two failed on both, with a different error message.

So do not put `PYTHONUTF8=0` in a base image or a shared profile as a "keep the old behaviour" switch. Any job that also runs with `LC_ALL=C` gets ASCII, which 3.14 with its defaults never gave it. If you need the opt-out, set it only for the processes that run in a legacy locale and read legacy data, and plan to remove it.

## What to do before you upgrade

Most of this goes away when the code names its encoding. Three steps, in order:

1. **Find the calls.** The repo has a static checker, `check_default_encoding.py`. It reports `open()` without `encoding` (or with `encoding=None`), `Path.read_text()` and `write_text()`, `.open()` on a `Path` it can see, `subprocess` in text mode with no `encoding`, `os.popen()`, logging file handlers, `tempfile` and `gzip.open()` in text mode, `io.TextIOWrapper()` and `locale.getpreferredencoding()`. On a sample release-notes script, it found 6 calls:

   ```text
   examples/release_notes.py:12:1: logging.basicConfig(filename=...) without encoding
   examples/release_notes.py:16:11: subprocess.run() in text mode without encoding
   examples/release_notes.py:23:24: .read_text() without encoding
   examples/release_notes.py:24:16: open() without encoding
   examples/release_notes.py:27:5: .write_text() without encoding
   examples/release_notes.py:28:10: open() without encoding
   6 call(s) use the default encoding
   ```

   When the same script ran on 3.15 with `-X warn_default_encoding`, Python reported `EncodingWarning` on the same 6 lines. A static check misses calls through variables, wrappers and `**kwargs` it cannot read, so do step 2 as well.

2. **Run your tests with the warning as an error.** This works on 3.10 and later, so you can do it on 3.14 now:

   ```bash
   python -X warn_default_encoding -W error::EncodingWarning -m pytest
   ```

   In our matrix, the warning fired for the same 4 calls on 3.14 and 3.15. Fix each `open()`-style call with `encoding="utf-8"`, or `encoding="locale"` where the file really follows the locale. `locale.getpreferredencoding()` takes no encoding: replace it with `locale.getencoding()` if you need the locale encoding, or with `"utf-8"` if that is what the code meant.

3. **Decide what stdin and stdout should do with bad bytes.** If a script reads input it does not control, such as logs, file names or another tool's output, choose on purpose: `sys.stdin.reconfigure(errors="strict")` to fail at the input, or `sys.stdin.buffer` to keep the bytes. Do not let the default choose for you.

Then check which locale your hosts really run in. `locale` and `python3 -c "import locale; print(locale.getencoding())"` on each host type tell you. If every host is `C`, `C.UTF-8` or no locale, none of our 13 cases changed for those settings.

```github
https://github.com/The-DevOps-Daily/python-315-utf8-default
```

## What we could not conclude

- **Windows was not tested.** The PEP says Windows is where most of the change is, because the locale encoding there is the ANSI code page, for example cp1252. If you run Python on Windows hosts or build agents, run the checker and the warning there first.
- **macOS and musl (Alpine) were not tested.** We ran uv's Python builds on Linux aarch64 with glibc 2.36. We have no result for either platform.
- **The EUC-JP row used UTF-8 and ISO-8859-1 fixtures**, not valid EUC-JP text.
- **13 cases are not your code.** Third-party libraries that call `locale.getpreferredencoding()` themselves now get `utf-8` in UTF-8 mode. The checker only sees the code you point it at.
- **We did not count how many hosts use legacy locales.** We know the behaviour on such a host, not how common those hosts are.

## Summary

PEP 686 is a smaller change for Linux containers than its headline suggests, because Python has used UTF-8 mode in the C locale since 3.7. With the locale settings that containers use, it changed none of our 13 cases. It changes how stdin and stdout treat invalid bytes on UTF-8 servers, so a crash at the input becomes a lone surrogate further down the pipeline. It changes almost everything on hosts with a legacy locale. And its opt-out, `PYTHONUTF8=0`, means "off", so `LC_ALL=C` processes get ASCII, which 3.14 with its defaults never gave them. Name the encoding in your code, run your tests once with `-X warn_default_encoding`, and decide what your scripts do with bytes that are not UTF-8.
