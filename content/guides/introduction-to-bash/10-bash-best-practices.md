---
title: 'Bash Best Practices: Strict Mode, Traps, ShellCheck and Tests'
description: 'Write reliable Bash: set -euo pipefail and where it fails, traps for cleanup and signals, ShellCheck and shfmt, bats-core tests, CI and macOS portability.'
order: 10
---

A Bash script that works when you run it once is easy to write. One that keeps working when a file is missing, a disk fills up, someone presses Ctrl+C, a colleague runs it on a Mac, or cron starts it at 3 a.m. takes a few habits. None of them are complicated, but several have traps of their own, starting with the famous `set -euo pipefail`.

This part collects those habits: a script template, what strict mode really does and where it fails, traps for cleanup, errors and signals, locking, safe defaults, debugging, ShellCheck and shfmt, tests with bats-core, a CI workflow, portability to macOS and `sh`, and when to stop writing Bash. Along the way, the tests find a real bug in `logstat`.

## Prerequisites

- The rest of this guide, especially functions ([Part 6](/guides/introduction-to-bash/06-functions)) and the finished `logstat` from [Part 8](/guides/introduction-to-bash/08-command-line-arguments).
- The [Linux guide's scripting part](/guides/introduction-to-linux/09-shell-scripting) introduces `set -euo pipefail` and `trap ... EXIT`; this part goes into the details.

Tools used here: ShellCheck 0.11.0, shfmt 3.14.1 and bats-core 1.14.0. `brew install shellcheck shfmt bats-core` installs these versions on macOS and Linux. Ubuntu 24.04's packages are older (`sudo apt install shellcheck shfmt bats` gives ShellCheck 0.9.0, shfmt 3.8.0 and bats 1.10.0); they run everything in this part, but shfmt's formatting can differ slightly between versions, so a project should pin one, as the CI workflow below does.

## A Template for New Scripts

```bash
#!/usr/bin/env bash
# template.sh: one line that says what the script does
# usage: template.sh [-v] INPUT...
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true # Bash 4.4+: $( ) inherits set -e

script_name=${0##*/}
verbose=0
workdir=""

log() { printf '%s: %s\n' "$script_name" "$*" >&2; }
die() {
    log "error: $*"
    exit 1
}
debug() { if ((verbose)); then log "$*"; fi; }

usage() {
    cat <<EOF
usage: $script_name [-v] INPUT...
  -v  print what the script is doing
EOF
}

cleanup() {
    if [[ -n $workdir ]]; then rm -rf -- "$workdir"; fi
}

main() {
    local opt input
    while getopts ":vh" opt; do
        case $opt in
            v) verbose=1 ;;
            h)
                usage
                exit 0
                ;;
            *)
                usage >&2
                exit 2
                ;;
        esac
    done
    shift $((OPTIND - 1))
    if (($# == 0)); then
        usage >&2
        exit 2
    fi

    workdir=$(mktemp -d)
    trap cleanup EXIT

    for input in "$@"; do
        [[ -r $input ]] || die "cannot read $input"
        debug "processing $input"
        # ... the real work goes here, with temporary files in "$workdir" ...
    done
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
```

```terminal
{
  "title": "the template runs, fails and checks cleanly",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash template.sh -v servers.txt inventory.csv",
      "output": "template.sh: processing servers.txt\ntemplate.sh: processing inventory.csv"
    },
    {
      "cmd": "bash template.sh servers.txt missing.txt; echo \"exit code: $?\"",
      "output": "template.sh: error: cannot read missing.txt\nexit code: 1"
    },
    {
      "cmd": "shellcheck template.sh && shfmt -d -i 4 -ci template.sh && echo \"shellcheck and shfmt: clean\"",
      "output": "shellcheck and shfmt: clean"
    }
  ]
}
```

Each piece comes from an earlier part or from this one: strict mode and traps below, logging to standard error and the main guard from [Part 6](/guides/introduction-to-bash/06-functions), and `getopts` from [Part 8](/guides/introduction-to-bash/08-command-line-arguments). Add the `script_dir` line from [Part 7](/guides/introduction-to-bash/07-script-permissions) when the script loads files that sit next to it. You will also see the "unofficial strict mode" line `IFS=$'\n\t'` in many templates; it changes how every unquoted expansion splits, which hides quoting bugs instead of fixing them. Quote your variables and leave `IFS` alone.

## Strict Mode: What set -euo pipefail Does

| Option          | Effect                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| `-e` (errexit)  | Exit when a command fails (with exceptions, below)                             |
| `-u` (nounset)  | Treat reading an unset variable as an error                                    |
| `-o pipefail`   | A pipeline fails when any of its commands fails, not just the last one         |
| `-E` (errtrace) | Let the `ERR` trap fire inside functions too (only matters with an `ERR` trap) |

Strict mode turns many silent failures into loud ones, which is why it belongs at the top of most scripts. But `set -e` is not error handling. It has rules about where it applies that surprise everyone, and knowing them is the difference between a safety net and a false sense of safety.

## Where set -e Does Not Stop the Script

`set -e` is ignored for any command whose status is being tested. This script shows each case; every line that runs proves the script did not stop:

```bash
#!/usr/bin/env bash
# errexit.sh: places where set -e does NOT exit
set -euo pipefail

if false; then :; fi
echo "1. a failing if condition is fine (that is the point of if)"

false || true
false && echo "never printed"
echo "2. failures in && and || lists are ignored, except in the last command"

# shellcheck disable=SC2251 # this case shows the problem ShellCheck warns about
! true
echo "3. a negated command never triggers set -e"

check() {
    false # fails...
    echo "   ...but the function keeps going"
}
if check; then echo "4. inside a function called from a condition, set -e is off entirely"; fi

out=$(false; echo "still ran")
echo "5. \$( ) does not inherit set -e: out=[$out]"

# shellcheck disable=SC2034,SC2155 # this case shows the problem ShellCheck warns about
f() { local value=$(false); }
f
echo "6. local x=\$(cmd) hides cmd's exit status"

echo "7. the next line stops the script, because [[ ]] is the last command of g"
g() { [[ -n ${DEBUG:-} ]] && echo "debug mode"; }
g
echo "never printed"
```

```terminal
{
  "title": "run it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash errexit.sh; echo \"exit code: $?\"",
      "output": "1. a failing if condition is fine (that is the point of if)\n2. failures in && and || lists are ignored, except in the last command\n3. a negated command never triggers set -e\n   ...but the function keeps going\n4. inside a function called from a condition, set -e is off entirely\n5. $( ) does not inherit set -e: out=[still ran]\n6. local x=$(cmd) hides cmd's exit status\n7. the next line stops the script, because [[ ]] is the last command of g\nexit code: 1"
    }
  ]
}
```

Cases 4 and 5 deserve a second look. A function called as an `if` condition, or on the left of `&&` and `||`, runs with `set -e` turned off for **its whole body**, so the `false` inside `check` was ignored. And `$( )` runs in a subshell that does not inherit `-e`, so `still ran` was captured. `shopt -s inherit_errexit` (Bash 4.4+) fixes the second one:

```terminal
{
  "title": "inherit_errexit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -c 'set -e; shopt -s inherit_errexit; out=$(false; echo \"still ran\"); echo \"out=[$out]\"'; echo \"exit code: $?\"",
      "output": "exit code: 1"
    }
  ]
}
```

The other direction matters too: commands that "fail" in normal use stop a strict script.

- `grep` exits 1 when it finds nothing. Write `grep ... || true` when no match is fine, or test it in an `if`.
- `(( count++ ))` returns 1 when the old value was 0 ([Part 4](/guides/introduction-to-bash/04-bash-variables)).
- `read -d ''` returns 1 at the end of its input ([Part 9](/guides/introduction-to-bash/09-bash-tools)).
- A function or script whose last command is `[[ ... ]] && action` returns 1 when the test is false, as case 7 showed. End such functions with an `if`, or `return 0`.

**When not to use `set -e`**: in your interactive shell (the first typo closes the terminal), in libraries meant to be sourced (it changes the caller's shell), and in scripts where most commands are expected to fail sometimes, such as a monitoring check that collects results. There, check each important command explicitly: `cp "$src" "$dst" || die "copy failed"`. Explicit checks are clearer than `set -e` anyway; use both.

[What does set -e mean in a Bash script?](/posts/what-does-set-e-mean-in-bash-script) has more examples.

## set -u and Empty Arrays

`set -u` catches typos in variable names, which is worth a lot. Read optional variables with a default (`${DEBUG:-}`, `${1-}`) and check for set variables with `[[ -v name ]]`. Since Bash 4.4, an empty array expands to nothing under `set -u`. Older versions, including macOS's 3.2, call it unbound:

```terminal
{
  "title": "an empty array under set -u",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -c 'set -u; files=(); echo \"files: [${files[@]}] count: ${#files[@]}\"'",
      "output": "files: [] count: 0"
    },
    {
      "cmd": "/opt/bash-3.2/bin/bash -c 'set -u; files=(); echo \"files: [${files[@]}] count: ${#files[@]}\"'",
      "output": "/opt/bash-3.2/bin/bash: files[@]: unbound variable"
    },
    {
      "comment": "the workaround for old versions",
      "cmd": "/opt/bash-3.2/bin/bash -c 'set -u; files=(); echo \"files: [${files[@]+\"${files[@]}\"}]\"'",
      "output": "files: []"
    }
  ]
}
```

## pipefail and SIGPIPE

Without `pipefail`, `false | true` succeeds. With it, the pipeline fails when any command fails. That catches real errors, such as a `grep` that cannot read its file. It also catches one thing that is not an error: when a reader such as `head` stops early, the writer gets the SIGPIPE signal on its next write and dies with status 141 (128 + 13).

```terminal
{
  "title": "head closes the pipe early",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "seq 100000 | head -n 1; echo \"statuses: ${PIPESTATUS[*]}\"",
      "output": "1\nstatuses: 141 0"
    },
    {
      "cmd": "set -o pipefail; seq 100000 | head -n 1; echo \"pipeline status: $?\"; set +o pipefail",
      "output": "1\npipeline status: 141"
    },
    {
      "comment": "small outputs fit in the pipe buffer, so the writer finishes first",
      "cmd": "set -o pipefail; seq 10 | head -n 1; echo \"pipeline status: $?\"; set +o pipefail",
      "output": "1\npipeline status: 0"
    }
  ]
}
```

The failure appears when the writer writes again after the reader has exited. A small output usually fits in the pipe (a Linux pipe holds 64 KiB by default) and is written before `head` exits, so the problem tends to stay hidden until the output grows; with an unlucky timing, it can hit small outputs too. So a script can pass every test with small inputs and fail in production. `logstat` has exactly this pattern (`count_by ... | head -n "$top"`). Here is how a test finds it.

## Test Your Scripts With bats-core

**bats-core** runs test files written in Bash. Each `@test` block is a test; it passes when every command in it succeeds. `run` executes a command and saves its exit status in `$status`, its output in `$output` and the output lines in the `lines` array, so you can make assertions about failures too. Install it with `sudo apt install bats`, `brew install bats-core` or `npm install -g bats`, or vendor it into your repository with `git submodule add https://github.com/bats-core/bats-core.git test/bats`.

First, turn on strict mode in `logstat`, as every script in this part should have it. Add one line after the comments at the top of `~/bash-practice/logstat`:

```bash
#!/usr/bin/env bash
# logstat: count requests in web server access logs
# usage: logstat [-b FIELD] [-n N] [FILE...]
set -euo pipefail
```

Then create the test directory with `mkdir -p ~/bash-practice/test` and save the tests as `~/bash-practice/test/logstat.bats`:

```bash
#!/usr/bin/env bats
# test/logstat.bats: tests for lib/logstat.sh and the logstat command

bats_require_minimum_version 1.5.0

setup() {
    ROOT="$BATS_TEST_DIRNAME/.."
    LOG="$ROOT/logs/access.log"
    # shellcheck source=lib/logstat.sh
    source "$ROOT/lib/logstat.sh"
}

@test "parse_line splits a combined log line into fields" {
    local -a f
    parse_line '192.0.2.44 - - [23/Oct/2026:08:15:00 +0000] "GET /about.html HTTP/1.1" 200 418 "-" "curl/8.5.0"' f
    [ "${f[0]}" = "192.0.2.44" ]
    [ "${f[2]}" = "GET" ]
    [ "${f[3]}" = "/about.html" ]
    [ "${f[4]}" = "200" ]
}

@test "parse_line rejects a line in another format" {
    run parse_line "2026-10-23T08:15:02Z INFO  server started on port 8080" f
    [ "$status" -eq 1 ]
}

@test "count_by status counts every request" {
    run count_by status "$LOG"
    [ "$status" -eq 0 ]
    [ "${#lines[@]}" -eq 5 ]
    [ "${lines[0]}" = $'20\t200' ]
}

@test "count_by reports skipped lines on standard error only" {
    run --separate-stderr count_by method "$ROOT/logs/app.log"
    [ "$status" -eq 0 ]
    [ "$output" = "" ]
    [[ $stderr == *"skipped 6 line(s)"* ]]
}

@test "logstat exits with 2 on an unknown field" {
    run -2 "$ROOT/logstat" --by browser "$LOG"
    [[ $output == *"--by must be"* ]]
}

@test "logstat exits with 1 when a file cannot be read" {
    run -1 "$ROOT/logstat" "$ROOT/logs"
    [[ $output == *"cannot read"* ]]
}

@test "logstat reads standard input" {
    run bash -c 'grep " 404 " "$1" | "$2" --by path' _ "$LOG" "$ROOT/logstat"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = $'4\t/favicon.ico' ]
}

@test "logstat --top works when the output is bigger than a pipe buffer" {
    local i
    for ((i = 0; i < 8000; i++)); do
        printf '10.0.%d.%d - - [23/Oct/2026:08:15:00 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/8.5.0"\n' \
            $((i / 250)) $((i % 250))
    done >"$BATS_TEST_TMPDIR/big.log"
    run "$ROOT/logstat" --by ip --top 1 "$BATS_TEST_TMPDIR/big.log"
    [ "$status" -eq 0 ]
    [ "${#lines[@]}" -eq 1 ]
}
```

The tests source the library, which is safe because it only defines functions, test single functions, and run the whole `logstat` command as a user would. The last test builds an 8,000-line log with a different IP address on every line, so the report is bigger than the pipe buffer. Run them:

```terminal
{
  "title": "bats finds a bug",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bats --version",
      "output": "Bats 1.14.0"
    },
    {
      "cmd": "bats test/; echo \"exit code: $?\"",
      "output": "1..8\nok 1 parse_line splits a combined log line into fields\nok 2 parse_line rejects a line in another format\nok 3 count_by status counts every request\nok 4 count_by reports skipped lines on standard error only\nok 5 logstat exits with 2 on an unknown field\nok 6 logstat exits with 1 when a file cannot be read\nok 7 logstat reads standard input\nnot ok 8 logstat --top works when the output is bigger than a pipe buffer\n# (in test file test/logstat.bats, line 64)\n#   `[ \"$status\" -eq 0 ]' failed\nexit code: 1"
    }
  ]
}
```

The output is in TAP format, which CI systems understand; in a terminal, bats shows the same results with check marks. The last test failed. Run the same command by hand to see what happened:

```terminal
{
  "title": "the right answer, the wrong exit status",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "big=$(mktemp); for (( i = 0; i < 8000; i++ )); do printf '10.0.%d.%d - - [23/Oct/2026:08:15:00 +0000] \"GET / HTTP/1.1\" 200 612 \"-\" \"curl/8.5.0\"\\n' $(( i / 250 )) $(( i % 250 )); done > \"$big\""
    },
    {
      "cmd": "logstat --by ip --top 1 \"$big\"; echo \"exit code: $?\"; rm -f -- \"$big\"",
      "output": "1\t10.0.0.0\nexit code: 141"
    }
  ]
}
```

`logstat` printed the right line and then exited with status 141: `head` printed one line and exited, `sort` inside `count_by` was killed by SIGPIPE on its next write, `pipefail` made the pipeline fail, and `set -e` ended the script. Any script or CI job that called `logstat --top` on a big log would have stopped.

The fix is to let the reader consume all its input. `awk 'NR <= n'` prints the first `n` lines and keeps reading, so the writer never sees a closed pipe. Change the `--top` branch at the end of `main`:

```bash
    if [[ -v top ]]; then
        # awk reads all of its input, so count_by never writes to a closed pipe
        count_by "$by" "${files[@]}" | awk -v n="$top" 'NR <= n'
    else
        count_by "$by" "${files[@]}"
    fi
```

```terminal
{
  "title": "all tests pass",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bats test/",
      "output": "1..8\nok 1 parse_line splits a combined log line into fields\nok 2 parse_line rejects a line in another format\nok 3 count_by status counts every request\nok 4 count_by reports skipped lines on standard error only\nok 5 logstat exits with 2 on an unknown field\nok 6 logstat exits with 1 when a file cannot be read\nok 7 logstat reads standard input\nok 8 logstat --top works when the output is bigger than a pipe buffer"
    }
  ]
}
```

Other fixes would work too: `|| true` after the pipeline (but that also hides real errors), or limiting the output inside `count_by`. Whatever you choose, the test now guards against the bug coming back.

A few bats features worth knowing:

- `run -2 command` expects exit status 2, and `run --separate-stderr` puts standard error in `$stderr` (both need bats 1.5+, hence `bats_require_minimum_version`).
- `setup` and `teardown` run before and after each test; `$BATS_TEST_TMPDIR` is a temporary directory per test that bats cleans up.
- The [bats-assert](https://github.com/bats-core/bats-assert) and [bats-support](https://github.com/bats-core/bats-support) libraries add helpers such as `assert_output --partial "text"`.

## Traps: Cleanup, Errors and Signals

`trap 'commands' EVENT` runs commands when something happens. The events that matter in scripts:

| Event  | When it fires                                                                           |
| ------ | --------------------------------------------------------------------------------------- |
| `EXIT` | The script ends for any reason: end of file, `exit`, `set -e`, a signal that has a trap |
| `ERR`  | A command fails, under the same rules as `set -e`                                       |
| `INT`  | SIGINT, usually Ctrl+C                                                                  |
| `TERM` | SIGTERM, which `kill`, systemd and `timeout` send by default                            |
| `HUP`  | The terminal or SSH session closed                                                      |

```bash
#!/usr/bin/env bash
# traps.sh: clean up on every exit, report errors, stop cleanly on signals
set -Eeuo pipefail

workdir=$(mktemp -d)

cleanup() {
    local status=$? pids
    mapfile -t pids < <(jobs -pr) # background jobs that are still running
    if ((${#pids[@]} > 0)); then kill "${pids[@]}" 2>/dev/null || true; fi
    rm -rf -- "$workdir"
    echo "cleanup: removed the work directory, exit status $status" >&2
}
trap cleanup EXIT
trap 'echo "error: \"$BASH_COMMAND\" failed with status $? on line $LINENO" >&2' ERR
trap 'echo "stopped by SIGTERM" >&2; exit 143' TERM
trap 'echo "interrupted" >&2; exit 130' INT

count_errors() {
    grep -c ' 503 ' "$1" # no 503 lines in the log, so grep exits with 1
}

case ${1:-ok} in
    ok) echo "requests: $(wc -l <logs/access.log)" ;;
    fail)
        errors=$(count_errors logs/access.log)
        echo "503 errors: $errors"
        ;;
    wait)
        sleep 30 &
        wait "$!"
        ;;
esac
echo "finished"
```

```terminal
{
  "title": "the traps in action",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash traps.sh ok; echo \"exit code: $?\"",
      "output": "requests: 40\nfinished\ncleanup: removed the work directory, exit status 0\nexit code: 0"
    },
    {
      "cmd": "bash traps.sh fail; echo \"exit code: $?\"",
      "output": "error: \"grep -c ' 503 ' \"$1\"\" failed with status 1 on line 20\nerror: \"grep -c ' 503 ' \"$1\"\" failed with status 1 on line 26\nerror: \"errors=$(count_errors logs/access.log)\" failed with status 1 on line 26\ncleanup: removed the work directory, exit status 1\nexit code: 1"
    },
    {
      "comment": "timeout sends SIGTERM after 1 second; --preserve-status passes on the script's exit code",
      "cmd": "timeout --preserve-status 1 bash traps.sh wait; echo \"exit code: $?\"",
      "output": "stopped by SIGTERM\ncleanup: removed the work directory, exit status 143\nexit code: 143"
    },
    {
      "cmd": "timeout --preserve-status -s INT 1 bash traps.sh wait; echo \"exit code: $?\"",
      "output": "interrupted\ncleanup: removed the work directory, exit status 130\nexit code: 130"
    }
  ]
}
```

What to take from it:

- **The `EXIT` trap ran every time**, after success, after an error and after both signals, and `$?` at its start held the exit status. Put all cleanup in one function and register it once; a second `trap ... EXIT` replaces the first instead of adding to it.
- **The `ERR` trap fired three times for one failure**: in the function (inside the `$( )` subshell), for the function call, and for the assignment in the main script. With `set -E`, it fires at every level the failure passes through. Use it for diagnostics, not for actions that must happen once.
- **Signal traps should exit** with 128 plus the signal number (130 for INT, 143 for TERM), so whoever started the script can tell what happened.
- **Bash runs a trap only after the current foreground command finishes.** With a plain `sleep 30`, the TERM trap would have waited up to 30 seconds. Running long commands in the background and waiting with `wait` lets the trap run at once, and the cleanup function stops the background job.

`trap -p` lists the current traps and `trap - EXIT` removes one. Bash 5.3 adds `trap -P EXIT` to print just the command of one trap.

## Run One Copy at a Time

Scripts started by cron or a timer can overlap when one run is slow. `flock` holds a lock on a file for as long as a file descriptor for it stays open. The kernel releases the lock when the last such descriptor closes, so a crashed script cannot leave it behind; note that child processes inherit the descriptor, so a background job the script started keeps the lock until it exits too:

```bash
#!/usr/bin/env bash
# locked.sh: refuse to run twice at the same time
set -euo pipefail

exec 9<"${BASH_SOURCE[0]}" # lock the script file itself: no lock file to create
if ! flock -n 9; then
    echo "another copy is already running" >&2
    exit 1
fi

echo "got the lock, working for 2 seconds"
sleep 2
echo "done"
```

```terminal
{
  "title": "two runs, one lock",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash locked.sh & sleep 0.5; bash locked.sh; echo \"second run: exit code $?\"; wait \"$!\"",
      "output": "got the lock, working for 2 seconds\nanother copy is already running\nsecond run: exit code 1\ndone"
    }
  ]
}
```

`flock -n` fails immediately when another process holds the lock; `flock -w 10` waits up to 10 seconds instead. Locking the script file itself avoids creating a lock file at all; when you need a separate one, keep it in a directory only you can write to, not in a shared `/tmp`. Either way this is more reliable than a PID file, which a crashed run leaves behind.

## Safe Defaults

The habits from the earlier parts, collected:

- **Quote every expansion**: `"$var"`, `"$(cmd)"`, `"${array[@]}"`.
- **Put `--` before file names** that come from variables or globs, or prefix globs with `./`.
- **Guard dangerous paths**: `rm -rf -- "${build_dir:?}/"*` stops the script if `build_dir` is empty, instead of running `rm -rf /*`. ShellCheck warns about the unguarded form (SC2115).
- **Check `cd`**: `cd "$dir" || exit 1`. ShellCheck warns without it (SC2164).
- **No `eval` on data**, and no building commands in strings. Use arrays ([Part 8](/guides/introduction-to-bash/08-command-line-arguments)).
- **Validate input before arithmetic** ([Part 5](/guides/introduction-to-bash/05-control-structures)).
- **Create files privately when they hold secrets**: set `umask 077` before writing them, and create temporary files with `mktemp`.
- **Keep secrets off the command line.** Every user on the machine can read the arguments of every process:

```terminal
{
  "title": "arguments are visible to everyone",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -c 'sleep 3; true' fetch-report --password=hunter2 & sleep 0.5; ps -o args= -p \"$!\"; wait \"$!\"",
      "output": "bash -c sleep 3; true fetch-report --password=hunter2"
    }
  ]
}
```

Pass secrets in an environment variable, a file with mode `600` or standard input instead. For `curl`, for example, put the header in a file and use `-H @file`, or use a `--netrc-file`.

## Debugging

`bash -x script` (or `set -x` in the script) prints each command after expansion. Set `PS4` to add the file, line and function to every trace line, which makes long traces readable:

```bash
#!/usr/bin/env bash
# trace-demo.sh: a small script to trace
total=0
add() {
    total=$((total + $1))
}
for n in 3 4; do
    add "$n"
done
echo "total: $total"
```

```terminal
{
  "title": "a trace with file, line and function",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "PS4='+ ${BASH_SOURCE[0]##*/}:${LINENO}:${FUNCNAME[0]:-main}: ' bash -x trace-demo.sh",
      "output": "+ trace-demo.sh:3:main: total=0\n+ trace-demo.sh:7:main: for n in 3 4\n+ trace-demo.sh:8:main: add 3\n+ trace-demo.sh:5:add: total=3\n+ trace-demo.sh:7:main: for n in 3 4\n+ trace-demo.sh:8:main: add 4\n+ trace-demo.sh:5:add: total=7\n+ trace-demo.sh:10:main: echo 'total: 7'\ntotal: 7"
    }
  ]
}
```

Three more tools:

- `bash -n script` checks the syntax without running anything.
- `BASH_XTRACEFD=9` (with `exec 9>trace.log`) sends the trace to a file, so it does not mix with the script's own error output.
- `local -` plus `set -x` inside one function traces just that function ([Part 6](/guides/introduction-to-bash/06-functions)).

## Lint With ShellCheck, Format With shfmt

**ShellCheck** finds bugs that Bash itself does not report. [The Linux guide](/guides/introduction-to-linux/09-shell-scripting) shows its most common warnings (missing quotes, an unchecked `cd`, looping over `ls`). This script has some subtler ones:

```bash
#!/usr/bin/env bash
# report.sh: summarize errors in the logs (buggy on purpose)
set -euo pipefail

summarize() {
    local errors=$(grep -c ERROR "$1")
    echo "$1: $errors errors"
}

logs=($(find logs -name '*.log'))
for log in ${logs[@]}; do
    summarize "$log"
done
if [ $? -ne 0 ]; then echo "failed" >&2; fi
rm -rf "$OUTPUT_DIR/"*
```

```terminal
{
  "title": "ShellCheck 0.11.0",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "shellcheck --version | sed -n 2p",
      "output": "version: 0.11.0"
    },
    {
      "cmd": "shellcheck report.sh",
      "output": "In report.sh line 6:\n    local errors=$(grep -c ERROR \"$1\")\n          ^----^ SC2155 (warning): Declare and assign separately to avoid masking return values.\n\n\nIn report.sh line 10:\nlogs=($(find logs -name '*.log'))\n      ^------------------------^ SC2207 (warning): Prefer mapfile or read -a to split command output (or quote to avoid splitting).\n\n\nIn report.sh line 11:\nfor log in ${logs[@]}; do\n           ^--------^ SC2068 (error): Double quote array expansions to avoid re-splitting elements.\n\n\nIn report.sh line 14:\nif [ $? -ne 0 ]; then echo \"failed\" >&2; fi\n     ^-- SC2181 (style): Check exit code directly with e.g. 'if ! mycmd;', not indirectly with $?.\n\n\nIn report.sh line 15:\nrm -rf \"$OUTPUT_DIR/\"*\n       ^-------------^ SC2115 (warning): Use \"${var:?}\" to ensure this never expands to /* .\n\nFor more information:\n  https://www.shellcheck.net/wiki/SC2068 -- Double quote array expansions to ...\n  https://www.shellcheck.net/wiki/SC2115 -- Use \"${var:?}\" to ensure this nev...\n  https://www.shellcheck.net/wiki/SC2155 -- Declare and assign separately to ..."
    }
  ]
}
```

Each code links to a wiki page that explains the problem and the fix, for example `https://www.shellcheck.net/wiki/SC2155`. Useful options and conventions:

- `shellcheck -x` follows `source` lines (with a `# shellcheck source=path` directive when the path is computed).
- `shellcheck -s sh` checks a script against POSIX `sh`, which is how you find Bash-only features in a `#!/bin/sh` script (see below).
- `-S warning` hides the `info` and `style` levels when you start on an old code base.
- To accept a warning, disable it on the line before, with a reason: `# shellcheck disable=SC2034 # read by the sourcing script`. Project-wide settings go in a `.shellcheckrc` file.

**shfmt** formats shell scripts consistently, which ends style discussions in code review. `-d` shows what it would change and fails if anything would, which is what CI needs; `-w` rewrites the files:

```terminal
{
  "title": "shfmt",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "shfmt --version",
      "output": "v3.14.1"
    },
    {
      "cmd": "printf 'if [ -f \"$1\" ]\\nthen\\n  for i in 1 2; do echo  \"$i\" ; done\\nfi\\n' > messy.sh && shfmt -d -i 4 -ci messy.sh",
      "output": "diff messy.sh.orig messy.sh\n--- messy.sh.orig\n+++ messy.sh\n@@ -1,4 +1,3 @@\n-if [ -f \"$1\" ]\n-then\n-  for i in 1 2; do echo  \"$i\" ; done\n+if [ -f \"$1\" ]; then\n+    for i in 1 2; do echo \"$i\"; done\n fi"
    },
    {
      "cmd": "shfmt -d -i 4 -ci logstat lib/*.sh test/*.bats && echo \"shfmt: already formatted\"",
      "output": "shfmt: already formatted"
    },
    {
      "cmd": "shellcheck -x logstat lib/*.sh test/*.bats && echo \"shellcheck: no warnings\"",
      "output": "shellcheck: no warnings"
    }
  ]
}
```

`-i 4` indents with four spaces and `-ci` indents `case` branches. Put the flags in an `.editorconfig` file so editors and shfmt agree. The `logstat` files in this guide were formatted with exactly these flags.

## Run the Checks in CI

The same three checks belong in CI, so no change merges without them. Save this as `.github/workflows/shell.yml` in a repository that contains `logstat` with its `lib/` and `test/` directories, the layout of `~/bash-practice`:

```yaml
name: shell

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: ShellCheck
        run: shellcheck -x logstat lib/*.sh test/*.bats

      - name: shfmt
        run: |
          curl -fsSL -o "$RUNNER_TEMP/shfmt" \
            https://github.com/mvdan/sh/releases/download/v3.14.1/shfmt_v3.14.1_linux_amd64
          echo "76e77641faa025814b77f153b29796b8e6fa2fca03e0c76a691608b86c7ea7bf  $RUNNER_TEMP/shfmt" | sha256sum -c -
          chmod +x "$RUNNER_TEMP/shfmt"
          "$RUNNER_TEMP/shfmt" -d -i 4 -ci logstat lib/*.sh test/*.bats

      - name: bats
        run: |
          git clone --depth 1 --branch v1.14.0 https://github.com/bats-core/bats-core.git "$RUNNER_TEMP/bats"
          test "$(git -C "$RUNNER_TEMP/bats" rev-parse HEAD)" = eb7f42f8d608ac693d7a4b67474f6714ea68cfc5
          "$RUNNER_TEMP/bats/bin/bats" test/
```

```terminal
{
  "title": "check the workflow with actionlint",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "actionlint .github/workflows/shell.yml && echo \"actionlint: no problems found\"",
      "output": "actionlint: no problems found"
    }
  ]
}
```

The GitHub-hosted `ubuntu-24.04` runner has Bash 5.2.21 and ShellCheck 0.9.0 preinstalled. The workflow pins the checkout action and bats to commits and the shfmt download to a checksum, so a moved tag or a changed download fails the build instead of running in it. actionlint also runs ShellCheck on the `run:` blocks when ShellCheck is installed. On a pull request, a failing step blocks the merge if you make the job a required check.

## Portability: macOS and POSIX sh

### Bash 3.2 on macOS

A script with `#!/usr/bin/env bash` runs with Bash 3.2 on any Mac without Homebrew's Bash, and with 3.2, a lot of this guide does not exist. These runs use Bash 3.2.57 built from the GNU source code and installed as `/opt/bash-3.2/bin/bash`; on a Mac, `/bin/bash` prints the same messages with its own path:

```terminal
{
  "title": "Bash 3.2.57, the version macOS ships",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "/opt/bash-3.2/bin/bash -c 'declare -A port=([web]=80); echo \"web: ${port[web]}\"'",
      "output": "/opt/bash-3.2/bin/bash: line 0: declare: -A: invalid option\ndeclare: usage: declare [-afFirtx] [-p] [name[=value] ...]\nweb: 80"
    },
    {
      "cmd": "/opt/bash-3.2/bin/bash -c 'name=\"Notes API\"; echo \"${name,,}\"'",
      "output": "/opt/bash-3.2/bin/bash: ${name,,}: bad substitution"
    },
    {
      "cmd": "/opt/bash-3.2/bin/bash -c 'mapfile -t lines < servers.txt; echo \"${#lines[@]} lines\"'",
      "output": "/opt/bash-3.2/bin/bash: mapfile: command not found\n0 lines"
    },
    {
      "cmd": "/opt/bash-3.2/bin/bash -c 'printf \"%(%F)T\\n\" -1'",
      "output": "/opt/bash-3.2/bin/bash: line 0: printf: `(': invalid format character"
    },
    {
      "cmd": "/opt/bash-3.2/bin/bash -c 'x=1; [[ -v x ]] && echo \"x is set\"'",
      "output": "/opt/bash-3.2/bin/bash: -c: line 0: conditional binary operator expected\n/opt/bash-3.2/bin/bash: -c: line 0: syntax error near `x'\n/opt/bash-3.2/bin/bash: -c: line 0: `x=1; [[ -v x ]] && echo \"x is set\"'"
    }
  ]
}
```

The first command did not fail loudly: `declare -A` printed a usage error, and the assignment went on as an indexed array, where `web` evaluated to index 0. When a script needs a newer Bash, check the version at the top and stop with a clear message:

```bash
#!/usr/bin/env bash
# needs-44.sh: stop early on Bash versions older than 4.4
if ((BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 4))); then
    echo "this script needs Bash 4.4 or newer, not $BASH_VERSION" >&2
    echo "on macOS: brew install bash" >&2
    exit 1
fi
echo "Bash $BASH_VERSION is new enough"
```

```terminal
{
  "title": "a version check",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash needs-44.sh",
      "output": "Bash 5.2.21(1)-release is new enough"
    },
    {
      "cmd": "/opt/bash-3.2/bin/bash needs-44.sh; echo \"exit code: $?\"",
      "output": "this script needs Bash 4.4 or newer, not 3.2.57(2)-release\non macOS: brew install bash\nexit code: 1"
    }
  ]
}
```

The other source of trouble on macOS is the tools, not Bash: macOS has BSD versions of `sed`, `date`, `grep`, `find`, `stat` and `xargs`.

| Task                      | GNU (Linux)         | BSD (macOS)                                      | Portable choice                                |
| ------------------------- | ------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Edit a file in place      | `sed -i 's/a/b/' f` | `sed -i '' 's/a/b/' f`                           | `sed ... f > f.new && mv f.new f`              |
| Date arithmetic           | `date -d '+3 days'` | `date -v+3d`                                     | Epoch seconds and `$(( ))`                     |
| File size                 | `stat -c %s f`      | `stat -f %z f`                                   | `wc -c < f`                                    |
| Perl-style regex          | `grep -P`           | not available                                    | `grep -E`                                      |
| Skip empty input in xargs | `xargs -r`          | the default                                      | check for input first                          |
| Absolute path of a file   | `readlink -f f`     | `realpath f`, or `readlink -f f` on recent macOS | `"$(cd "$(dirname "$f")" && pwd -P)/${f##*/}"` |

The portable path version resolves symlinks in the directory part only, not in the file name itself. Homebrew's `coreutils`, `gnu-sed` and `findutils` packages install the GNU versions with a `g` prefix (`gsed`, `gdate`) on macOS.

### POSIX sh

When a script must run where Bash may be missing (Alpine and BusyBox images, minimal containers, some embedded systems), write it for POSIX `sh` with a `#!/bin/sh` shebang, and let ShellCheck find the Bash-only features:

```bash
#!/bin/sh
# posix.sh: meant for sh, but written with Bash habits
name="${1:-world}"
if [[ $name == w* ]]; then
    echo "${name^^}"
fi
servers=(web-1 web-2)
echo "${servers[0]}"
```

```terminal
{
  "title": "shellcheck knows the target shell from the shebang",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "shellcheck posix.sh",
      "output": "In posix.sh line 4:\nif [[ $name == w* ]]; then\n   ^---------------^ SC3010 (warning): In POSIX sh, [[ ]] is undefined.\n            ^-- SC3014 (warning): In POSIX sh, == in place of = is undefined.\n\n\nIn posix.sh line 5:\n    echo \"${name^^}\"\n          ^-------^ SC3059 (warning): In POSIX sh, case modification is undefined.\n\n\nIn posix.sh line 7:\nservers=(web-1 web-2)\n        ^-----------^ SC3030 (warning): In POSIX sh, arrays are undefined.\n\n\nIn posix.sh line 8:\necho \"${servers[0]}\"\n      ^-----------^ SC3054 (warning): In POSIX sh, array references are undefined.\n\nFor more information:\n  https://www.shellcheck.net/wiki/SC3010 -- In POSIX sh, [[ ]] is undefined.\n  https://www.shellcheck.net/wiki/SC3014 -- In POSIX sh, == in place of = is ...\n  https://www.shellcheck.net/wiki/SC3030 -- In POSIX sh, arrays are undefined."
    },
    {
      "cmd": "sh posix.sh; echo \"exit code: $?\"",
      "output": "posix.sh: 4: [[: not found\nposix.sh: 7: Syntax error: \"(\" unexpected\nexit code: 2"
    }
  ]
}
```

The POSIX replacements: `[ ]` with quoted variables or `case` for patterns, `tr '[:lower:]' '[:upper:]'` for case changes, `set --` for a single list (there are no arrays), `$(( ))` arithmetic but no `(( ))` command, and no `local` (most `sh` implementations have it, but POSIX does not require it).

## When to Stop Writing Bash

Bash is the right tool for starting programs, connecting them with pipes and files, and automating what you would otherwise type. Switch to a language such as Python or Go when the script:

- needs data structures beyond flat lists and maps, or parses JSON, YAML or HTML beyond what `jq` does in one line;
- talks to HTTP APIs with authentication, pagination and retries;
- grows past a few hundred lines, or many of its functions need unit tests;
- must run on Windows without WSL;
- processes large amounts of data line by line ([Part 9](/guides/introduction-to-bash/09-bash-tools) measured the cost).

For running the same steps on many servers, a configuration tool such as [Ansible](/guides/introduction-to-ansible) is a better fit than SSH loops, and the [Python guide](/guides/introduction-to-python) covers the next language most DevOps engineers learn.

## Common Mistakes

- **Treating `set -e` as error handling.** It is silent inside conditions, functions called from conditions and `$( )`.
- **`pipefail` with `head`, `grep -q` or other early readers** on large outputs. Expect status 141, or let the reader consume everything.
- **Registering several `EXIT` traps.** Each replaces the last; use one cleanup function.
- **Signal traps that do not exit**, or exit with 0.
- **Secrets in command-line arguments.**
- **Ignoring ShellCheck warnings** instead of fixing them or disabling them with a reason.
- **No tests.** A five-minute bats file catches regressions that manual runs miss.
- **Assuming macOS has the same Bash and tools as Linux.**

## Summary

- Start from a template with `set -euo pipefail`, a main guard and one cleanup trap.
- Know where `set -e` is ignored, and use `inherit_errexit`; check important commands explicitly.
- `pipefail` turns SIGPIPE from an early reader into a failure; test with outputs bigger than the pipe buffer.
- Trap `EXIT` for cleanup, `ERR` for diagnostics, and `INT` and `TERM` with exit codes 130 and 143.
- Use `flock` against overlapping runs, keep secrets out of arguments, and quote everything.
- Run ShellCheck, shfmt and bats locally and in CI.
- Check `BASH_VERSINFO` when you need a newer Bash, and lint `#!/bin/sh` scripts with ShellCheck.

That completes the guide. You can now read any Bash script and see what each line does, write scripts that handle file names, arguments, errors and signals properly, and prove they work with tests.

## Where to Go From Here

- [Introduction to Linux](/guides/introduction-to-linux): the system your scripts run on, including systemd timers for scheduling them.
- [Introduction to Git](/guides/introduction-to-git): keep your scripts and their tests under version control.
- [Introduction to CI/CD](/guides/introduction-to-cicd): run checks like the workflow above on every change.
- Practise in the browser with the [Linux Terminal simulator](/games/linux-terminal), and test yourself with the [Linux command line quiz](/quizzes/linux-quiz) and the [Linux fundamentals flashcards](/flashcards/linux-fundamentals).
- Interview preparation: [Bash scripting basics](/interview-questions/junior/bash-scripting-basics) and [shell scripting fundamentals](/interview-questions/junior/shell-scripting-fundamentals).
- [What does set -e mean in a Bash script?](/posts/what-does-set-e-mean-in-bash-script)
