---
title: 'What Does set -e Mean in Bash? Shebangs, sh vs bash and the Script Directory'
excerpt: 'The first lines of a Bash script decide which shell runs it, what happens when a command fails and where it finds its files. Learn what set -euo pipefail does and where it does not stop a script, which shebang to use, how sh differs from bash, and how to get the script directory.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-12-20'
publishedAt: '2024-12-20T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Error Handling
  - Shebang
  - POSIX sh
  - Linux
---

You're writing a Bash script to automate a deployment, and someone suggests adding `set -e` at the top. What does it actually do, and should you use it? The question comes with three others about the top of a script: which shebang line to use, whether `sh` and `bash` are the same, and how the script finds files that sit next to it.

Many scripts start with these three lines. This post explains each of them:

```bash
#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
```

## TLDR

| Question                         | Short answer                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| What does `set -e` do?           | The script exits when a command fails, except in conditions, `&&`/`\|\|` lists and some other places |
| What do `-u` and `pipefail` add? | `-u` stops on unset variables. `pipefail` makes a pipeline fail when any command in it fails         |
| Which shebang should I use?      | `#!/usr/bin/env bash` for portable scripts, `#!/bin/bash` for system scripts on known Linux hosts    |
| Is `sh` the same as `bash`?      | No. `sh` is the POSIX language, and `/bin/sh` is dash on Debian and Ubuntu                           |
| Where is my script?              | `"$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"`, plus `realpath` to resolve symlinks |

## Prerequisites

- Bash 4 or later. The examples also note what changes in POSIX `sh`.
- A Linux, macOS or WSL terminal to run the examples.

## What Does set -e Mean in a Bash Script?

`set -e` tells Bash to exit as soon as a command returns a non-zero exit code. Without it, Bash ignores the failure and runs the next line.

Every command returns an exit code from 0 to 255. 0 means success, and any other value means failure. `$?` holds the code of the last command:

```bash
ls /etc/hostname
echo $?   # 0

ls /nonexistent
echo $?   # 2 (GNU ls), another non-zero value on other systems
```

Here is a backup script without `set -e`:

```bash
#!/bin/bash

cd /backup/db
mysqldump mydb > dump.sql
gzip dump.sql
echo "Backup complete!"
```

If `/backup/db` does not exist, `cd` fails and the script stays in the directory it started in. `mysqldump` then writes `dump.sql` there, `gzip` compresses it in the wrong place, and the script prints "Backup complete!". With `set -e` on the second line, the script stops at the failed `cd` with a non-zero exit code, and a cron job or CI step can see the failure.

### When set -e Does Not Stop the Script

`set -e` ignores a failure when the command is part of a test. These exceptions are why a script with `set -e` can still continue after an error:

```bash
set -e

if grep -q "error" app.log; then echo "found"; fi   # a failed condition is a normal "false"
rm /tmp/cache.txt || echo "no cache"                # the left side of || or &&
! grep -q "error" app.log                           # a command negated with !
check_disk && echo "disk ok"                        # every command before the last && or ||
```

Three cases surprise people more:

- **Functions called as a condition.** `if deploy; then` turns `set -e` off for every command inside `deploy`. A failed step in the function does not stop it, and the `if` sees only the exit code of the last command.
- **`local` hides the failure.** `local out=$(false)` returns the exit code of `local`, which is 0. Write `local out` and `out=$(false)` on separate lines. A plain assignment, `out=$(false)`, does stop the script.
- **A test as the last line of a function.** `[[ -f "$file" ]] && echo "found"` as the last line returns 1 when the file is missing. The function then returns 1, and the call to it stops the script.

The [Bash best practices guide](/guides/introduction-to-bash/10-bash-best-practices#h2-where-set-e-does-not-stop-the-script) covers more cases, such as command substitution and `inherit_errexit`.

### What set -u and set -o pipefail Add

By default a pipeline returns the exit code of its last command. A failure on the left side of a pipe is lost, even with `set -e`:

```bash
set -e
false | true
echo "still running"        # printed: the pipeline returned 0 (from true)

set -o pipefail
false | true
echo "not printed"          # the pipeline now returns 1, and set -e stops the script
```

The same thing happens in real scripts. In `mysqldump mydb | gzip > dump.sql.gz`, a failed `mysqldump` still leaves a valid, empty `.gz` file, and `gzip` exits 0. With `pipefail`, the pipeline fails when any command in it fails.

`set -u` stops the script when it reads a variable that is not set. It catches typos:

```bash
set -u
DATABSE_NAME="mydb"          # typo
echo "Backing up $DATABASE_NAME"
# bash: DATABASE_NAME: unbound variable
```

Without `set -u`, the script would print "Backing up " and run the backup with an empty name. Use `${VAR-}` or `${VAR:-default}` for variables that may be unset on purpose.

Together the three options are often called strict mode: `set -euo pipefail`. Two cautions:

- `pipefail` reports a failure when a reader stops early. `yes | head -1` exits with 141, because `head` closes the pipe and `yes` gets `SIGPIPE`. With `set -e`, a `grep ... | head -1` can stop your script the same way.
- `pipefail` is not available in every `sh`. dash 0.5.12, the `/bin/sh` of Debian 12 and Ubuntu 24.04, rejects `set -o pipefail`. Use it in Bash scripts.

### Let One Command Fail on Purpose

Mark a command that is allowed to fail, so the next reader knows it is intended:

```bash
set -euo pipefail

rm -- "$tmp_file" || true            # a missing file is fine

if ! git pull --ff-only origin main; then
    echo "Error: cannot pull main, check the network and the branch" >&2
    exit 1
fi
```

Prefer `if ! cmd; then` when you want to print your own message. Avoid `set +e` ... `set -e` blocks around many lines: it is easy to forget which part of the script runs without checks.

`mkdir -p` needs no `|| true`. It succeeds when the directory already exists and fails only when it cannot create it, and then you want the script to stop.

### Debug With set -x

`set -x` prints each command, after expansion, before it runs. Each line starts with `+`:

```bash
bash -x ./deploy.sh          # trace one run without editing the script
```

Inside a script, put `set -x` before the part you want to trace and `set +x` after it. The trace goes to stderr, so it does not mix with the data the script writes to stdout.

## What Is the Preferred Bash Shebang?

Use `#!/usr/bin/env bash` for scripts that run on different systems, and `#!/bin/bash` when the script runs only on Linux hosts you control. Both are correct.

The **shebang** is the first line of a script. When you run `./script.sh`, the kernel reads the `#!` line and starts that interpreter with the script path as an argument:

| Shebang               | What it does                                | Use it for                                           |
| --------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `#!/usr/bin/env bash` | Runs the first `bash` in `$PATH`            | Tools in a repository, scripts for macOS, BSD, NixOS |
| `#!/bin/bash`         | Runs exactly `/bin/bash`                    | System scripts, scripts that run as root             |
| `#!/bin/sh`           | Runs the system POSIX shell, often not Bash | Scripts that use only POSIX features                 |

The `env` form finds the Bash you installed. That matters on macOS, where `/bin/bash` is the old Bash 3.2 and Homebrew installs Bash 5 as `/opt/homebrew/bin/bash` (Apple silicon) or `/usr/local/bin/bash` (Intel). It also matters on systems such as NixOS and FreeBSD, which have no `/bin/bash`. The fixed path is safer for scripts that run as root, because a writable directory early in `$PATH` cannot replace the interpreter.

A script that uses Bash 4 features can check the version it got:

```bash
#!/usr/bin/env bash
if (( BASH_VERSINFO[0] < 4 )); then
    echo "This script needs Bash 4 or later, found $BASH_VERSION" >&2
    exit 1
fi
```

### Shebang Mistakes That Break Scripts

- **Options after `env`.** Linux passes everything after the interpreter path as one argument, so `#!/usr/bin/env bash -e` fails with `env: 'bash -e': No such file or directory`. Use `#!/usr/bin/env -S bash -e` (GNU coreutils 8.30 or later), or better, put `set -e` on the next line. An option on the shebang line is also lost when someone runs `bash script.sh`.
- **Windows line endings.** A script saved with CRLF fails with `/usr/bin/env: 'bash\r': No such file or directory`. Convert it with `dos2unix script.sh` or `sed -i 's/\r$//' script.sh`.
- **No shebang at all.** Bash and `sh` then run the file with themselves, so the same script can run in Bash from your terminal and in dash from cron. Programs that start the script directly, such as systemd or Python's `subprocess`, fail with `Exec format error`.
- **No execute permission.** `./script.sh` needs `chmod +x script.sh`. [How to make a Bash script executable](/guides/introduction-to-bash/07-script-permissions) covers permissions and the errors you see without them.

To see what your system uses:

```bash
command -v bash      # /usr/bin/bash on most current distributions (/bin is a link to /usr/bin)
ls -l /bin/sh        # /bin/sh -> dash on Debian and Ubuntu, -> bash on Fedora and RHEL
```

## What Is the Difference Between sh and bash?

`sh` is the shell language defined by POSIX. Bash implements that language and adds many features. `/bin/sh` is whatever shell the system uses for POSIX scripts:

| System                 | `/bin/sh` is           |
| ---------------------- | ---------------------- |
| Debian, Ubuntu         | dash                   |
| Fedora, RHEL, Rocky    | Bash in POSIX mode     |
| Alpine, BusyBox images | BusyBox ash            |
| macOS                  | Bash 3.2 in POSIX mode |

So a script that uses Bash features can work on Fedora with `#!/bin/sh` and fail on Ubuntu. Running it as `sh script.sh` ignores the shebang and uses `sh` too.

These features fail or behave differently in dash 0.5.12, the `/bin/sh` of Debian 12 and Ubuntu 24.04. Most of them are Bash extensions. `$'...'` quoting and `set -o pipefail` were added to POSIX in its 2024 edition, but many installed `sh` implementations do not support them yet:

| Feature                       | Alternative for dash and older `sh`                 |
| ----------------------------- | --------------------------------------------------- |
| Arrays: `servers=(web1 web2)` | `set -- web1 web2` and `"$@"`, or a loop over words |
| `[[ $a == b* ]]`              | `case $a in b*) ... ;; esac`                        |
| `${var/old/new}`              | `printf '%s' "$var" \| sed 's/old/new/'`            |
| `{1..5}`                      | `seq 1 5`, or a `while` loop with a counter         |
| `$'\n'` quoting               | `printf '\n'`                                       |
| `&> file`                     | `> file 2>&1`                                       |
| `set -o pipefail`             | Not in dash 0.5.12; check each command instead      |
| `function name { ... }`       | `name() { ... }`                                    |
| `source file`                 | `. file`                                            |

Some features that people call "Bash-only" are POSIX and work in every `sh`: arithmetic with `$((count + 1))`, `${file%.txt}` and `${path##*/}` for removing prefixes and suffixes, `$(command)` substitution and `${var:-default}`. You do not need `expr` or `sed` for these. `local` is not in POSIX, but dash, BusyBox ash and Bash all support it.

To find Bash features in a script that must run under `sh`, use ShellCheck with the `sh` dialect, or `checkbashisms` from the Debian `devscripts` package:

```bash
shellcheck -s sh deploy.sh
checkbashisms deploy.sh
```

Write `sh` when the script must run in minimal images or on systems you do not control. Otherwise use Bash, say so in the shebang, and install Bash where it is missing, for example with `apk add bash` on Alpine.

## How Do I Get the Directory Where a Bash Script Is Located?

Use `BASH_SOURCE` and let `cd` and `pwd` turn it into an absolute path:

```bash
script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

source "$script_dir/lib/common.sh"
config="$script_dir/config.ini"
```

`${BASH_SOURCE[0]}` is the path of the file that Bash is reading, also when another script sources it with `source` or `.`. `$0` is the name the script was started with, and in a sourced file it is the name of the caller, often `bash`. The `cd` runs in a command substitution, which is a subshell, so the working directory of the script does not change. `--` protects against a path that starts with `-`. `CDPATH=` turns off the `CDPATH` variable for that one `cd`: if a user exports `CDPATH`, a relative `cd` can go to another directory and print its name, which then ends up in `script_dir`.

If the script can be started through a symlink, for example from `/usr/local/bin/tool` that points to `/opt/tool/bin/tool.sh`, the line above returns the directory of the link. Resolve the link first:

```bash
script_dir=$(dirname -- "$(realpath -- "${BASH_SOURCE[0]}")")
```

This is the difference in a test where `bin/tool` is a symlink to `real/tool.sh`:

```text
$ bin/tool
cd + pwd on BASH_SOURCE : /home/user/sd/bin
realpath on BASH_SOURCE : /home/user/sd/real
```

`realpath` and `readlink -f` are in GNU coreutils on most Linux distributions and in BusyBox (Alpine), and recent macOS releases include `realpath`. [How to get the full path of a file](/posts/how-to-symlink-files-linux#h2-how-do-i-get-the-full-path-of-a-file-in-linux) compares the two commands. Use the script directory to build paths, as above, instead of `cd "$script_dir"`. A script that changes its working directory surprises users who pass it relative file names.

## Related Resources

- [Bash best practices: strict mode, traps and ShellCheck](/guides/introduction-to-bash/10-bash-best-practices): a full template for new scripts
- [What is Bash?](/guides/introduction-to-bash/01-what-is-bash): shells, startup files and why `sh` is not Bash
- [How to parse command line arguments in Bash](/posts/parse-command-line-arguments-bash): the next part of most scripts
- [What does 2>&1 mean?](/posts/what-does-2-and-1-mean-linux-bash): keep the exit code when you pipe to `tee`
- [Fork bomb simulator](/games/fork-bomb-simulator): see what one line of unchecked shell code can do to a system
