---
title: 'Ubuntu 26.10 Moves cp, mv and rm to Rust. We Ran 162 Shell Commands Through GNU and uutils to See What Changes'
excerpt: 'Ubuntu 26.10 ships on October 15 with Rust coreutils for every tool. On the same system, 150 of our 162 shell test cases gave byte-identical results with GNU and uutils. The other 12 come down to four changes that can break a script (GNU detection, cut -c, timeout -s KILL, base64 -d) and five error messages.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-10-12'
publishedAt: '2026-10-12T09:00:00Z'
updatedAt: '2026-10-12T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - Ubuntu
  - Bash
  - Rust
  - Coreutils
  - Shell Scripting
  - DevOps
---

Ubuntu 26.10 comes out on Thursday, October 15. Its [release notes](https://documentation.ubuntu.com/release-notes/26.10/) say that "the default core utilities now run entirely on the Rust-based uutils implementation", and that the last GNU holdouts, `cp`, `mv` and `rm`, "have now been migrated". Every `ls`, `sort`, `date`, `cut` and `cp` in your shell scripts now runs Rust code.

Most of that move happened earlier than people think. In 26.04 LTS most tools already come from uutils, so the question for most teams is narrower: what is different in practice, and what will your scripts notice? We ran 162 shell test cases in chroots of the Ubuntu 24.04, 25.10, 26.04 LTS and 26.10 beta base images, and in 26.10 we ran each one twice: once with uutils and once with the GNU binaries Ubuntu still ships. Same files, same OS, only the implementation changed.

## TLDR

- On the same 26.10 system, **150 of 162 test cases gave byte-identical captured stdout, stderr and exit codes** with GNU and uutils.
- **The other 12 come down to four changes that can alter what a script does, plus five error messages:**
  - `ls --version` now says "uutils coreutils", so scripts that look for "GNU" to pick GNU or BSD flags take the wrong branch.
  - `cut -c` counts characters, not bytes, on UTF-8 text. This is new in 26.10; 26.04 still counts bytes.
  - `timeout -s KILL` exits with 124 instead of 137.
  - `base64 -d` printed nothing for our invalid input, where GNU printed the bytes it decoded before failing.
- **The rest are message text:** different wording and quote marks in errors. They matter only if a script greps stderr.
- **If you are on 26.04 LTS,** most of this already applies to you. 26.10 changes 6 of our cases: the version strings, `cut -c`, and three error messages.
- **25.10 shipped real bugs that are gone now:** `comm` dropped a line in up to 19 of 20 runs, and `date -r` ignored the file.
- **Speed, on our Raspberry Pi 4:** plain sorts and counting got faster (`sort` about 16 to 19%), hashing is the same, and multi-key sorts and walking many small files got slower (`sort -k` 35%, copying a 5,000-file tree 61%, `ls -lR` twice as slow).
- **Two other 26.10 changes servers will notice:** dbus-broker replaces dbus-daemon, and the default OpenSSH client no longer understands GSSAPI options.

## Prerequisites

- A Linux machine with `sudo`, `curl`, Python 3 and about 2 GB of free disk if you want to run the tests yourself. No Docker is needed: the scripts use `chroot` on Ubuntu's base images. They download the `arm64` images (we ran them on a Raspberry Pi 4); change the file names in `scripts/01-fetch.sh` for `amd64`.
- The repo:

```github
The-DevOps-Daily/ubuntu-2610-coreutils-check
```

## What changed, release by release

We checked each base image with `dpkg-query` and by following the `/usr/bin` links (`results/inventory.txt` in the repo):

| Release | coreutils implementation | Still GNU |
|---|---|---|
| 24.04.5 LTS | GNU 9.4 | everything |
| 25.10 | uutils 0.2.2 | `cp`, `mv`, `rm`, `chmod`, `chown`, `df`, `true` |
| 26.04.1 LTS | uutils 0.8.0 | `cp`, `mv`, `rm`, `df`, `true` |
| 26.10 beta | uutils 0.12.0 | nothing |

The GNU code has not gone away. Every release since 25.10 ships the `gnu-coreutils` package, with each tool installed under a `gnu` prefix: `gnuls`, `gnucp`, `gnusort`. In 26.10 that is 104 binaries, and it is what made a clean comparison possible.

```terminal
{
  "title": "ubuntu 26.10 beta",
  "prompt": "#",
  "steps": [
    { "cmd": "ls --version | head -1", "output": "ls (uutils coreutils) 0.12.0" },
    { "cmd": "gnuls --version | head -1", "output": "ls (GNU coreutils) 9.10" },
    { "cmd": "readlink -f /usr/bin/cp", "output": "/usr/lib/cargo/bin/coreutils/cp" }
  ]
}
```

## How we tested

Each test is one line in `cases.tsv`, run with `bash -c` in a fresh copy of the same input files, with `LC_ALL=C.UTF-8` and `TZ=UTC`. The "releases" are chroots of Ubuntu's arm64 base images on one Raspberry Pi 4 host (kernel 6.12), with the host's `/dev` mounted read-only and a fresh `/proc`, running as root. That is enough for coreutils, which is userspace, but it says nothing about kernel, service or permission behavior. We wrote the cases from what shell scripts actually do: `ls -l` with time styles, `sort -h`, `-V` and `-k`, `date -d` parsing, `stat -c`, `cut`, `tr`, `sha256sum -c`, `timeout`, `mktemp`, `install -D`, `dd`, error messages for missing files and bad options, and so on.

We ran all 162 cases in five setups:

- `gnu-24.04`: Ubuntu 24.04.5, GNU 9.4.
- `mixed-25.10`: Ubuntu 25.10.
- `mixed-26.04`: Ubuntu 26.04.1 LTS.
- `uutils-26.10`: Ubuntu 26.10 beta, as shipped.
- `gnu-26.10`: the same 26.10 rootfs with a directory of links to the `gnu*` binaries first in `PATH`.

A case "differs" when its captured stdout, stderr or exit code is not byte-identical. Some cases filter output through `awk`, `head` or `sed`, or print a tool's exit code with `echo "rc=$?"` (so the captured exit code is the shell's), and file side effects are only checked where a case looks at them. Bash builtins (`echo`, `printf`, `test`) would hide the coreutils binary, so those cases call the binary through `env`.

```text
gnu-26.10  vs uutils-26.10   12 of 162 differ   (same OS, only the implementation)
gnu-24.04  vs uutils-26.10   13 of 162 differ   (an LTS user jumping to 26.10)
gnu-24.04  vs mixed-26.04    12 of 162 differ   (LTS to LTS)
mixed-26.04 vs uutils-26.10   6 of 162 differ   (what 26.10 adds)
gnu-24.04  vs gnu-26.10       4 of 162 differ   (GNU 9.4 to 9.10 on its own; one is only a PID in a bash message)
```

## The four changes that can change what a script does

### 1. Scripts that detect GNU now take the BSD branch

Portable scripts often check whether they run with GNU or BSD tools, because the flags differ (`date -d` vs `date -v`, `stat -c` vs `stat -f`). The most common check reads the version string:

```bash
if date --version 2>/dev/null | grep -q GNU; then
  tomorrow=$(date -d tomorrow +%F)      # GNU flags
else
  tomorrow=$(date -v+1d +%F)            # BSD and macOS flags
fi
```

On 26.10, `date --version` prints `date (uutils coreutils) 0.12.0` (on 26.04, `0.8.0`). The `grep` fails, the script takes the BSD branch, and `date -v+1d` fails with an unknown-option error. Our `detect-gnu-date` and `detect-gnu-stat` cases printed `gnu-path` on 24.04 and `bsd-path` on 25.10, 26.04 and 26.10.

uutils implements the GNU flags, so the fix is to test for the feature, not the vendor:

```bash
if date -d tomorrow +%F >/dev/null 2>&1; then
  tomorrow=$(date -d tomorrow +%F)      # GNU-style date: GNU or uutils
else
  tomorrow=$(date -v+1d +%F)            # BSD and macOS
fi
```

Search your repos for `--version | grep` and `--version 2>&1 | grep -q GNU`. This one is easy to miss, because nothing errors where the check runs. The script fails later, in a branch that was written for a Mac.

### 2. `cut -c` counts characters now (new in 26.10)

```terminal
{
  "title": "cut -c1-4 on UTF-8 text",
  "prompt": "$",
  "steps": [
    { "comment": "input: 'héllo wörld' and 'naïve café'" },
    { "comment": "GNU 9.4, GNU 9.10, and uutils 0.8.0 on 26.04" },
    { "cmd": "cut -c1-4 utf8.txt", "output": "hél\nnaï" },
    { "comment": "uutils 0.12.0 on 26.10" },
    { "cmd": "cut -c1-4 utf8.txt", "output": "héll\nnaïv" }
  ]
}
```

GNU `cut` treats `-c` as bytes, so `é` (two bytes in UTF-8) takes two of the four positions. [POSIX](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/cut.html) says `-c` selects characters, and uutils 0.12.0 now does that, so the new behavior is the standard one. Either way, the output changed under the same command, and 26.04 LTS still behaves like GNU. If a script slices fixed-width fields out of text that can contain non-ASCII names, paths or log messages, the columns shift. Use `cut -b` when you mean bytes.

### 3. `timeout -s KILL` exits with 124, not 137

```text
$ timeout -s KILL 1 sleep 5; echo "rc=$?"

GNU 9.4 / 9.10:   bash: line 1: ... Killed   timeout -s KILL 1 sleep 5
                  rc=137
uutils (25.10+):  rc=124
```

GNU documents this in `timeout --help`: it exits with 137 "if COMMAND (or timeout itself) is sent the KILL (9) signal (128+9)". uutils returns 124. A wrapper that treats 124 as "timed out" and anything else as "the command failed" now reports a timeout where it used to report a failure, or the other way around. Check for both. The default signal (TERM) returned 124 in every setup, and `--preserve-status` behaved the same everywhere.

### 4. `base64 -d` on bad input prints nothing

```text
$ echo 'not*base64' | base64 -d; echo "rc=$?"

GNU:     <two garbage bytes>rc=1      stderr: base64: invalid input
uutils:  rc=1                         stderr: base64: error: invalid input
```

Both fail with exit code 1. GNU writes the bytes it managed to decode before it hit the bad character, and for this input uutils wrote nothing. We tested one short malformed input, so do not assume either tool decodes all-or-nothing on long streams. This only matters if something downstream reads partial output, but that is exactly the kind of thing that turns up in a script that pipes `base64 -d` into a file without checking the exit code.

## Error messages: different text, same exit codes

The other differences are wording. Exit codes matched in every case below, so they only affect scripts that parse stderr or tests that compare it:

| Case | GNU | uutils 0.12.0 |
|---|---|---|
| `ls --bogus` | `ls: unrecognized option '--bogus'` | `error: unexpected argument '--bogus' found` plus a usage block |
| `date -d 'not a date'` | `invalid date ‘not a date’` (curly quotes) | `invalid date 'not a date'` (straight quotes) |
| `env printf '%d' abc` (the binary, not the bash builtin) | `‘abc’: expected a numeric value` | `'abc': expected a numeric value` |
| `ln -s` onto an existing file | `...: File exists` | `...: Already exists` |
| `cp -n` | warns that `-n` is non-portable | no warning |

The quote marks are worth knowing about: GNU uses Unicode curly quotes in a UTF-8 locale, so a `grep "invalid date 'not"` in a test suite matched nothing on GNU and matches now.

## A change that is not about Rust: `mv -n`

One difference shows up between GNU versions, before uutils is involved. On 24.04 (GNU 9.4), `mv -n` onto an existing file prints `not replacing` and exits 1. GNU 9.5 and later (see the [9.5 release announcement](https://lists.gnu.org/archive/html/coreutils-announce/2024-03/msg00000.html)), and uutils, skip silently and exit 0. If you move from 24.04 to 26.04 or 26.10 and a script used `mv -n ... || handle_conflict`, the handler no longer runs.

## 25.10 shipped bugs that 26.04 fixed

The 25.10 results are a reminder of why interim releases exist. With uutils 0.2.2, 25.10 differed from 24.04 in 17 cases, and some were plain bugs:

- **`comm` lost a line.** `comm <(sort dup.txt | uniq) <(printf 'apple\ndate\n')` dropped `cherry` from the output. It is timing-dependent: in our batches of repeats it dropped the line 7 and 19 times out of 20 on 25.10, and never on 26.04 or 26.10 (`results/comm-repeat.txt` has the last batch).
- **`date -r FILE` ignored the file** and printed the current time instead of the file's modification time.
- **Error messages** for `cat` and `sha256sum` on a missing file ended with Rust's `(os error 2)`.

All three are fixed in 26.04 and 26.10, except that `stat` on a missing file still printed `(os error 2)` in 26.04; 26.10 fixed that too. 25.10 also gave a different order from GNU for `shuf --random-source` with the same source bytes. That is a compatibility difference rather than a bug, since nothing promises two implementations map random bytes the same way, and 26.04 matches GNU again. If you skipped 25.10, you never saw most of this.

## Speed

We timed 15 workloads with GNU 9.10 and uutils 0.12.0 in the same 26.10 rootfs on a Raspberry Pi 4 (4 cores, 4 GB): 9 runs each, alternating the two implementations, inputs already in the page cache, the first run dropped as a warm-up. The inputs were a million random integers (10 MB), a million lines of text (19 MB), a 100 MiB binary file and a tree of 5,000 small files. Each pair ran GNU first, then uutils. The harness records time only: it does not check exit codes or compare outputs, so treat these as timings of the same commands, not a validated benchmark suite.

```chart
{
  "type": "bar",
  "title": "uutils 0.12.0 run time as a share of GNU 9.10 (lower is faster)",
  "unit": "%",
  "caption": "Median of 8 timed runs per workload, Ubuntu 26.10 beta rootfs, Raspberry Pi 4. 100% = same speed as GNU. Raw runs in results/bench.tsv.",
  "rows": [
    { "label": "wc -l", "value": 55, "series": "faster" },
    { "label": "wc -w", "value": 77, "series": "faster" },
    { "label": "sort | uniq -c", "value": 80, "series": "faster" },
    { "label": "sort -n", "value": 81, "series": "faster" },
    { "label": "sort -u", "value": 81, "series": "faster" },
    { "label": "sort", "value": 84, "series": "faster" },
    { "label": "base64", "value": 89, "series": "about the same" },
    { "label": "sha256sum", "value": 102, "series": "about the same" },
    { "label": "md5sum", "value": 102, "series": "about the same" },
    { "label": "cut -d' ' -f2", "value": 107, "series": "about the same" },
    { "label": "tr a-z A-Z", "value": 107, "series": "about the same" },
    { "label": "sort -k3,3n -k1,1", "value": 135, "series": "slower" },
    { "label": "cp -r + rm -rf (5,000 files)", "value": 161, "series": "slower" },
    { "label": "du -s (5,000 files)", "value": 180, "series": "slower" },
    { "label": "ls -lR (5,000 files)", "value": 198, "series": "slower" }
  ],
  "series": [
    { "name": "faster", "color": "#10b981" },
    { "name": "about the same", "color": "#94a3b8" },
    { "name": "slower", "color": "#f59e0b" }
  ]
}
```

| Workload | GNU 9.10 | uutils 0.12.0 |
|---|---|---|
| `sort -n` on 1M integers | 1.26 s | 1.02 s |
| `sort` on 1M lines | 1.04 s | 0.87 s |
| `sort -k3,3n -k1,1` on 1M lines | 1.83 s | 2.47 s |
| `wc -l` on 19 MB | 0.039 s | 0.021 s |
| `sha256sum` on 100 MiB | 0.79 s | 0.81 s |
| `cp -r` then `rm -rf` of 5,000 small files | 0.50 s | 0.81 s |
| `ls -lR` of 5,000 small files | 0.056 s | 0.111 s |
| `du -s` of 5,000 small files | 0.020 s | 0.036 s |

On this machine and these inputs the spread between runs was small (`results/bench-summary.tsv` has the ranges), and the pattern is consistent: plain sorts and counting are faster with uutils, hashing is the same, and multi-key sorts and anything that walks many small files are slower. Copying and deleting the tree took 61% longer, `ls -lR` twice as long. Results on x86 servers and other disks can differ. For most scripts the absolute numbers are small. A backup or deploy script that copies a large tree of small files is where you would notice.

A note on method: our first benchmark run wrote every command's output to a regular file, because the chroot had no `/dev` and `>/dev/null` created one. That made output-heavy commands look slow on both sides. We threw those numbers away and reran with `/dev` mounted; the scripts in the repo do this.

## Two more 26.10 changes that servers notice

### dbus-broker replaces dbus-daemon

[Canonical announced in June](https://discourse.ubuntu.com/t/ubuntu-26-10-is-switching-to-dbus-broker/84060/) that 26.10 replaces dbus-daemon, the default since 2004, with dbus-broker for both the system bus and user session buses, on fresh installs and upgrades. The announcement calls it "a drop-in replacement. Same protocol, same config files, same bus policies." The archive shows the switch:

```text
                          26.04 LTS                 26.10 beta
provides the system bus   dbus                      dbus-broker
dbus-broker               universe                  main
dbus, dbus-daemon         main                      universe
```

For most servers nothing visible changes. The thing to check is a container image or CI job that installs `dbus` by name to get a session bus with `dbus-run-session` (headless browser tests often do). In 26.10, `apt-get install dbus` still pulls in `dbus-daemon`, but both are in universe now, so an image with universe disabled cannot install them. The announcement also documents how to switch back.

### The default OpenSSH client no longer understands GSSAPI

The release notes say OpenSSH has been split into `openssh` and `openssh-gssapi`, and that fresh installs get the version without GSSAPI and Kerberos. We installed the default client in each release and gave it the GSSAPI options that many existing configs carry:

```text
26.04 (OpenSSH 10.2p1):  no GSSAPI warning, exit 0
26.10 (OpenSSH 10.5p1):  /root/.ssh/config line 2: Unsupported option "gssapiauthentication"
                         /root/.ssh/config line 3: Unsupported option "gssapidelegatecredentials"
                         exit 0
```

We tested this with `ssh -G`, which evaluates the configuration without connecting. It warns and carries on, so a config with these lines still loads, and every `ssh` run that reads them will print the warning on stderr. Kerberos authentication is gone with the GSSAPI build, as the release notes say; we did not test a real Kerberos login. The default `/etc/ssh/ssh_config` in 26.04 had `GSSAPIAuthentication yes` enabled; in 26.10 that line is gone. If you use Kerberos for SSH, install `openssh-client-gssapi` (and `openssh-server-gssapi` on servers). If you do not, remove the GSSAPI lines from configs you copy onto new machines, or the warnings will end up in every log of every Ansible run.

## How to check your own scripts before you upgrade

1. **Run them against 26.10 without upgrading anything.** The repo downloads Ubuntu's base image and runs commands in a `chroot`. Put your script in `rootfs/26.10/work` and run it with `sudo chroot rootfs/26.10 /bin/bash -c 'cd /work && ./your-script.sh'`. Mount `/dev` and `/proc` first, as `scripts/03-run-cases.sh` does.
2. **Compare with GNU on the same box.** Put the `gnu*` binaries first in `PATH` with a directory of links (see `scripts/02-extract.sh`), run the script again, and diff the output.
3. **Grep for the patterns above:** `--version | grep`, `cut -c` on text that may hold non-ASCII, `timeout -s KILL`, and error-message matching in tests.
4. **Switch back if you need to.** Ubuntu's [26.04 notes](https://documentation.ubuntu.com/release-notes/26.04/summary-for-lts-users/) give the commands. They also apply to 26.10:

```bash
# to GNU coreutils
sudo apt install coreutils-from-gnu coreutils-from-uutils- --allow-remove-essential
# back to Rust coreutils
sudo apt install coreutils-from-uutils coreutils-from-gnu- --allow-remove-essential
```

For a single script, calling `gnudate`, `gnucut` or `gnutimeout` directly is enough.

## What we could not conclude

- **Locales other than C.UTF-8.** The base images ship no other locales, and `sort` and `ls` ordering depend on the locale. Test `en_US.UTF-8` on a full install if your scripts depend on sort order.
- **Long-running and terminal behavior.** We did not test `tail -f`, `stty`, `dd` progress output or anything that needs a TTY.
- **Your edge cases.** 150 of 162 identical test cases is a good sign, not a guarantee. The cases are in a text file in the repo; add yours and send them back.

## Summary

- 26.10 finishes a move that 26.04 LTS mostly made: `cp`, `mv` and `rm` are Rust now, and uutils jumps from 0.8.0 to 0.12.0.
- On the same system, 150 of 162 shell test cases gave identical captured results with GNU and uutils.
- Fix these before you upgrade: GNU detection by version string, `cut -c` on non-ASCII text, scripts that expect 137 from `timeout -s KILL`, and anything that parses error messages.
- Moving from 24.04, also check `mv -n`: its exit code changed in GNU itself.
- Check container images that install `dbus` by name (it is in universe now), and remove GSSAPI lines from SSH configs unless you install `openssh-client-gssapi`.
