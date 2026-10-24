---
title: 'Bash Functions: Arguments, Return Values, Scope and Libraries'
description: 'Bash functions done right: arguments, exit status versus output, namerefs, local and dynamic scope, sourcing libraries, a retry helper and export -f.'
order: 6
---

A function gives a name to a group of commands. In Bash, a function behaves like a small script that runs inside the current shell: it takes arguments in `$1`, `$2` and `"$@"`, reads standard input, writes standard output and ends with an exit status. That model is simple, but it differs from other languages in ways that cause real bugs: functions cannot return a string, variables are global unless you say otherwise, and a function can see the local variables of whoever called it.

This part covers defining and calling functions, the three ways to get results out of them, `local` and Bash's dynamic scope, libraries loaded with `source`, a few helper functions done properly, and `export -f`. Along the way you build `lib/logstat.sh`, a small library that the rest of the guide turns into a command-line tool.

## Prerequisites

- Variables and arrays from [Part 4](/guides/introduction-to-bash/04-bash-variables), and loops from [Part 5](/guides/introduction-to-bash/05-control-structures).
- The practice directory in `~/bash-practice`.

## Define and Call a Function

```terminal
{
  "title": "define, call, and the order that matters",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "greet() { printf 'Hello, %s!\\n' \"${1:-stranger}\"; }"
    },
    {
      "cmd": "greet; greet \"Ada\"",
      "output": "Hello, stranger!\nHello, Ada!"
    },
    {
      "comment": "a function must be defined before the line that calls it runs",
      "cmd": "bash -c 'say_bye; say_bye() { echo \"bye\"; }'",
      "output": "bash: line 1: say_bye: command not found"
    }
  ]
}
```

`name() { ...; }` is the portable form. Bash also accepts `function name { ...; }`, which does the same thing but does not work in `sh`. Pick one style per script; this guide uses the first.

Because Bash runs a script from top to bottom, put function definitions first and the code that calls them at the end, usually in a `main` function called on the last line ([Part 10](/guides/introduction-to-bash/10-bash-best-practices) has a template).

The body is usually in braces, which run in the current shell. A body in parentheses runs in a subshell, so `cd`, `set` options and variables set inside it do not leak out:

```terminal
{
  "title": "a subshell body keeps changes inside",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "in_logs() ( cd logs && \"$@\" )"
    },
    {
      "cmd": "in_logs ls; pwd",
      "output": "access.log\napp.log\n/home/dev/bash-practice"
    }
  ]
}
```

## Arguments

Inside a function, `$1`, `$2`, `$#` and `"$@"` refer to the function's own arguments, not the script's. `$0` is still the script's name; `FUNCNAME[0]` is the function's.

```terminal
{
  "title": "arguments inside a function",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "show_args() { local arg; echo \"${FUNCNAME[0]} got $# argument(s):\"; for arg in \"$@\"; do echo \"  [$arg]\"; done; }"
    },
    {
      "cmd": "show_args web-1 \"db 1\" \"\"",
      "output": "show_args got 3 argument(s):\n  [web-1]\n  [db 1]\n  []"
    },
    {
      "comment": "pass the script's arguments on with \"$@\"",
      "cmd": "set -- --verbose deploy; show_args \"$@\"",
      "output": "show_args got 2 argument(s):\n  [--verbose]\n  [deploy]"
    }
  ]
}
```

Give arguments names at the top of the function with `local`; `$3` in the middle of a long function says nothing about what it holds.

## Getting Results Out of a Function

A Bash function has three ways to hand back a result.

### 1. The exit status: success or failure

`return N` ends the function with status N (0 to 255). Without `return`, the status is that of the last command that ran, which is easy to get wrong:

```terminal
{
  "title": "exit status",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "is_error_status() { [[ $1 == [45]?? ]]; }"
    },
    {
      "cmd": "is_error_status 404 && echo \"404 is an error\"; is_error_status 200 || echo \"200 is not\"",
      "output": "404 is an error\n200 is not"
    },
    {
      "comment": "statuses wrap around modulo 256",
      "cmd": "f() { return 256; }; f; echo \"return 256 gives $?\"",
      "output": "return 256 gives 0"
    },
    {
      "comment": "this function's last command is the test, so it fails when debug is off",
      "cmd": "log_debug() { [[ $debug == 1 ]] && echo \"debug: $*\"; }; debug=0; log_debug \"hi\"; echo \"status: $?\"",
      "output": "status: 1"
    }
  ]
}
```

The last case catches people under `set -e`: the script stops because a logging function "failed". End such functions with `return 0`, or use a full `if`.

### 2. The output: capture it with $( )

For data, print it and let the caller capture it with command substitution. Send messages meant for humans to standard error, so they do not end up in the captured value:

```terminal
{
  "title": "print the result, capture it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "last_client() { echo \"reading logs/access.log\" >&2; tail -n 1 logs/access.log | cut -d' ' -f1; }"
    },
    {
      "cmd": "ip=$(last_client); echo \"the last request came from $ip\"",
      "output": "reading logs/access.log\nthe last request came from 198.51.100.5"
    }
  ]
}
```

`$( )` runs the function in a subshell, so anything else it changes is lost, and on a busy loop the extra process costs time:

```terminal
{
  "title": "side effects inside $( ) are lost",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "calls=0; next_id() { calls=$(( calls + 1 )); echo \"id-$calls\"; }"
    },
    {
      "cmd": "id=$(next_id); id=$(next_id); echo \"id=$id, calls=$calls\"",
      "output": "id=id-1, calls=0"
    }
  ]
}
```

Bash 5.3's `${ next_id; }` runs the function in the current shell instead ([Part 1](/guides/introduction-to-bash/01-what-is-bash#h2-new-in-bash-53)); on older versions, use the third method.

### 3. Set a variable in the caller

A function can assign to a variable whose name the caller passes in. `printf -v name` does it for a single value, and a **nameref** (`local -n`, Bash 4.3+) makes a local name an alias for the caller's variable, which also works for arrays:

```terminal
{
  "title": "printf -v and namerefs",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "to_upper() { printf -v \"$1\" '%s' \"${2^^}\"; }; to_upper result \"notes api\"; echo \"$result\"",
      "output": "NOTES API"
    },
    {
      "cmd": "split_csv() { local -n _out=$1; IFS=, read -r -a _out <<< \"$2\"; }"
    },
    {
      "cmd": "split_csv hosts \"web-1,web-2,db 1\"; declare -p hosts",
      "output": "declare -a hosts=([0]=\"web-1\" [1]=\"web-2\" [2]=\"db 1\")"
    }
  ]
}
```

Namerefs have one trap: if the caller's variable has the same name as the nameref, it refers to itself.

```terminal
{
  "title": "a nameref with the caller's name",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "fill() { local -n ref=$1; ref=(a b); }; fill ref; declare -p ref",
      "output": "bash: local: warning: ref: circular name reference\nbash: warning: ref: circular name reference\nbash: warning: ref: circular name reference\ndeclare -a ref=([0]=\"a\" [1]=\"b\")"
    }
  ]
}
```

That is why the example above used `_out`, and why library code usually prefixes nameref names with an underscore and the function name.

## local and Dynamic Scope

Variables in Bash are **global** unless declared with `local` (or `declare`) inside a function. A helper that uses a common name like `i` can break the loop that calls it:

```terminal
{
  "title": "a global i breaks the caller's loop",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "count_dots() { for (( i = 0; i < ${#1}; i++ )); do :; done; }"
    },
    {
      "cmd": "for (( i = 0; i < 3; i++ )); do echo \"outer loop, i=$i\"; count_dots \"a.b.c\"; done",
      "output": "outer loop, i=0"
    },
    {
      "cmd": "count_dots() { local i; for (( i = 0; i < ${#1}; i++ )); do :; done; }"
    },
    {
      "cmd": "for (( i = 0; i < 3; i++ )); do echo \"outer loop, i=$i\"; count_dots \"a.b.c\"; done",
      "output": "outer loop, i=0\nouter loop, i=1\nouter loop, i=2"
    }
  ]
}
```

The first version set the global `i` to 5, so the outer loop ran once. Declare every variable a function uses with `local`.

`local` gives Bash **dynamic scope**: a function sees the local variables of the function that called it, and of that function's caller, and so on. Most languages use lexical scope instead, so this surprises people:

```terminal
{
  "title": "callees see their caller's locals",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "inner() { echo \"inner sees region=$region\"; region=\"changed by inner\"; }"
    },
    {
      "cmd": "outer() { local region=\"eu-west\"; inner; echo \"outer now has region=$region\"; }"
    },
    {
      "cmd": "region=\"global\"; outer; echo \"global region is still: $region\"",
      "output": "inner sees region=eu-west\nouter now has region=changed by inner\nglobal region is still: global"
    }
  ]
}
```

`inner` read and changed `outer`'s local `region`, while the global one stayed untouched. Do not rely on this; pass values as arguments.

### local Hides Exit Codes

`local name=$(command)` always succeeds, because the status you get is the status of `local` itself, not of the command:

```terminal
{
  "title": "declare first, assign second",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "f() { local out=$(grep -c ' 503 ' logs/access.log); echo \"status: $?, out=$out\"; }; f",
      "output": "status: 0, out=0"
    },
    {
      "cmd": "g() { local out; out=$(grep -c ' 503 ' logs/access.log); echo \"status: $?, out=$out\"; }; g",
      "output": "status: 1, out=0"
    }
  ]
}
```

`grep -c` found nothing and exited with 1, but only the second form shows it. ShellCheck warns about the first form (SC2155). The same applies to `export`, `declare` and `readonly`.

### Scoped Shell Options With local -

`local -` (Bash 4.4+) saves the shell options and restores them when the function returns, so a function can turn on `set -x` or `noglob` without affecting the rest of the script:

```bash
trace() {
    local -          # restore set options when the function returns
    set -x
    "$@"
}
```

## Libraries and source

Functions used by several scripts belong in a library file that the scripts `source`. `source file` (or `. file`) runs the file in the current shell, so its functions and variables become available. Here is the library for the log tool. Create the directory with `mkdir -p ~/bash-practice/lib` and save this as `~/bash-practice/lib/logstat.sh`:

```bash
# lib/logstat.sh: functions that summarize web server access logs.
# Source this file: it defines one variable and two functions and runs nothing.
# shellcheck shell=bash

# The nginx and Apache "combined" format:
# ip ident user [time] "method path protocol" status bytes "referer" "user agent"
LOGSTAT_RE='^([^ ]+) [^ ]+ [^ ]+ \[([^]]+)\] "([A-Z]+) ([^ ]+) [^"]*" ([0-9]{3}) ([0-9]+|-)'

# parse_line LINE ARRAY_NAME
# Split one log line into the named array: ip, time, method, path, status, bytes.
# Returns 1 when the line is not in the combined format.
parse_line() {
    local -n _pl_fields=$2
    [[ $1 =~ $LOGSTAT_RE ]] || return 1
    _pl_fields=("${BASH_REMATCH[@]:1}")
}

# count_by FIELD [FILE...]
# Print "count<TAB>value" for each value of FIELD (ip, method, path, status or
# class), most frequent first. Reads standard input when no file is given or
# when a file is -. Returns 1 when a file cannot be read.
count_by() {
    local field=$1 file line key skipped=0
    shift
    local -A counts=()
    local -a f=() files=("$@")

    case $field in
        ip | method | path | status | class) ;;
        *)
            printf 'count_by: unknown field: %s\n' "$field" >&2
            return 2
            ;;
    esac
    if ((${#files[@]} == 0)); then files=(-); fi

    for file in "${files[@]}"; do
        # - is standard input; cat reads it from where the caller left it
        if [[ $file != - && (-d $file || ! -r $file) ]]; then
            printf 'count_by: cannot read %s\n' "$file" >&2
            return 1
        fi
        while IFS= read -r line || [[ -n $line ]]; do
            if ! parse_line "$line" f; then
                skipped=$((skipped + 1))
                continue
            fi
            case $field in
                ip) key=${f[0]} ;;
                method) key=${f[2]} ;;
                path) key=${f[3]} ;;
                status) key=${f[4]} ;;
                class) key=${f[4]:0:1}xx ;;
            esac
            counts[$key]=$((${counts[$key]:-0} + 1))
        done < <(cat -- "$file")
        # a read error would look like the end of the file: check cat's status
        if ! wait "$!"; then
            printf 'count_by: error reading %s\n' "$file" >&2
            return 1
        fi
    done

    for key in "${!counts[@]}"; do
        printf '%s\t%s\n' "${counts[$key]}" "$key"
    done | sort -t $'\t' -k1,1nr -k2,2 || return # pass on a failed write
    if ((skipped > 0)); then
        printf 'count_by: skipped %d line(s) not in the combined format\n' "$skipped" >&2
    fi
}
```

It uses only things from earlier parts and this one: the regex and `BASH_REMATCH` from [Part 5](/guides/introduction-to-bash/05-control-structures), an associative array, a `while read` loop fed by process substitution, and a nameref so `parse_line` can fill an array chosen by its caller. `$!` holds the PID of the last process substitution (Bash 4.4+), so `wait "$!"` returns `cat`'s exit status: without that check, a read error would look like the end of the file and the function would report partial counts as a success. Try it in your shell:

```terminal
{
  "title": "load the library and use it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "source lib/logstat.sh"
    },
    {
      "cmd": "parse_line \"$(head -n 1 logs/access.log)\" req && declare -p req",
      "output": "declare -a req=([0]=\"203.0.113.10\" [1]=\"23/Oct/2026:08:15:00 +0000\" [2]=\"GET\" [3]=\"/\" [4]=\"200\" [5]=\"612\")"
    },
    {
      "cmd": "count_by class logs/access.log",
      "output": "24\t2xx\n8\t4xx\n4\t3xx\n4\t5xx"
    },
    {
      "cmd": "count_by ip < logs/access.log",
      "output": "12\t198.51.100.23\n9\t203.0.113.77\n8\t198.51.100.5\n8\t203.0.113.10\n3\t192.0.2.44"
    },
    {
      "cmd": "{ head -n 3 logs/access.log; echo \"not a log line\"; } | count_by method",
      "output": "3\tGET\ncount_by: skipped 1 line(s) not in the combined format"
    }
  ]
}
```

A script that uses the library has to find it. A relative path such as `source lib/logstat.sh` only works when you run the script from `~/bash-practice`; `${BASH_SOURCE[0]}` holds the path of the file that is running, so its directory is a reliable starting point. Save this as `~/bash-practice/logstat`, the first version of the command-line tool:

```bash
#!/usr/bin/env bash
# logstat: count access log requests by ip, method, path, status or class
# usage: logstat FIELD [FILE...]

# shellcheck source=lib/logstat.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/logstat.sh"

main() {
    if (($# < 1)); then
        echo "usage: logstat FIELD [FILE...]   (FIELD: ip, method, path, status or class)" >&2
        return 2
    fi
    count_by "$@"
}

# run main only when the file is executed, not when it is sourced (for tests)
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
```

```terminal
{
  "title": "the script finds its library from any directory",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd /tmp && bash ~/bash-practice/logstat status ~/bash-practice/logs/access.log",
      "output": "20\t200\n8\t404\n4\t201\n4\t302\n4\t500"
    },
    {
      "cmd": "bash ~/bash-practice/logstat; echo \"exit code: $?\"",
      "output": "usage: logstat FIELD [FILE...]   (FIELD: ip, method, path, status or class)\nexit code: 2"
    },
    {
      "cmd": "cd ~/bash-practice && shellcheck -x logstat lib/logstat.sh && echo \"shellcheck: no warnings\"",
      "output": "shellcheck: no warnings"
    }
  ]
}
```

Three details are worth copying:

- **The `# shellcheck source=` directive** tells ShellCheck which file the computed path refers to, and `shellcheck -x` follows it, so the library's functions are checked together with the script.
- **The main guard** at the end compares `${BASH_SOURCE[0]}` (this file) with `$0` (the script being run). They are equal when you run `logstat`, and different when another script or a test framework sources it, so the file's functions can be loaded without running anything. The library itself needs no guard, because it only defines functions; [Part 10](/guides/introduction-to-bash/10-bash-best-practices) sources it in bats tests.
- **`dirname "${BASH_SOURCE[0]}"`** breaks when the script is started through a symbolic link, a problem [Part 7](/guides/introduction-to-bash/07-script-permissions) runs into and fixes. [Get the directory of a Bash script](/posts/get-directory-bash-script-location) covers more cases.

A library meant to be sourced should not change the caller's shell options (no `set -e` at the top), print anything, or exit; `return` from a sourced file ends only the sourcing.

## Helper Functions Done Right

These three helpers show up in almost every serious script. Each fixes a common weakness of the usual quick version.

```bash
# lib/helpers.sh: logging, retries and confirmation prompts (source this file)
# shellcheck shell=bash

# log LEVEL MESSAGE...: timestamped message on standard error
log() {
    local level=$1
    shift
    printf '%(%Y-%m-%dT%H:%M:%S)T %-5s %s\n' -1 "$level" "$*" >&2
}

die() {
    log ERROR "$*"
    exit 1
}

# retry ATTEMPTS DELAY COMMAND [ARG...]: run COMMAND until it succeeds,
# doubling DELAY after every failure. Returns the last exit status.
retry() {
    local attempts=$1 delay=$2 n=1 status
    shift 2
    while true; do
        "$@" && return 0
        status=$?
        if ((n >= attempts)); then
            log ERROR "failed after $n attempts (exit $status): ${*@Q}"
            return "$status"
        fi
        log WARN "attempt $n of $attempts failed (exit $status), retrying in ${delay}s"
        sleep "$delay"
        n=$((n + 1))
        delay=$((delay * 2))
    done
}

# confirm QUESTION: ask a yes or no question. Without a terminal, say no.
confirm() {
    local answer
    if [[ ! -t 0 ]]; then
        log WARN "no terminal to ask '$1', assuming no"
        return 1
    fi
    read -r -p "$1 [y/N] " answer
    [[ $answer == [yY]* ]]
}
```

```terminal
{
  "title": "try the helpers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "source lib/helpers.sh"
    },
    {
      "comment": "a command that fails twice, then works",
      "cmd": "flaky() { tries=$(( ${tries:-0} + 1 )); (( tries >= 3 )); }"
    },
    {
      "cmd": "retry 4 1 flaky && echo \"flaky succeeded on try $tries\"",
      "output": "2026-10-24T06:21:29 WARN  attempt 1 of 4 failed (exit 1), retrying in 1s\n2026-10-24T06:21:30 WARN  attempt 2 of 4 failed (exit 1), retrying in 2s\nflaky succeeded on try 3"
    },
    {
      "cmd": "retry 2 1 grep -q ' 503 ' logs/access.log; echo \"exit status: $?\"",
      "output": "2026-10-24T06:21:32 WARN  attempt 1 of 2 failed (exit 1), retrying in 1s\n2026-10-24T06:21:33 ERROR failed after 2 attempts (exit 1): 'grep' '-q' ' 503 ' 'logs/access.log'\nexit status: 1"
    },
    {
      "cmd": "confirm \"Delete old reports?\" < /dev/null || echo \"nothing deleted\"",
      "output": "2026-10-24T06:21:33 WARN  no terminal to ask 'Delete old reports?', assuming no\nnothing deleted"
    }
  ]
}
```

What makes them better than the common versions:

- `log` writes to standard error, so it never pollutes output that a caller captures, and it uses Bash's built-in `printf '%(...)T'` (`-1` means "now") instead of starting `date` for every message.
- `retry` takes the command as separate arguments and runs `"$@"`; `${*@Q}` shows them quoted in the error message, so you can see exactly what ran. The usual `retry "ping -c 1 host"` form, which runs an unquoted string, breaks on any argument that contains a space or a quote. It also passes on the command's own exit status and backs off exponentially.
- `confirm` defaults to "no" and does not hang in CI or cron, where there is no terminal to answer: `[[ -t 0 ]]` is true only when standard input is a terminal.

## Inspect, Remove and Export Functions

```terminal
{
  "title": "functions are part of the shell's state",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "declare -F | head -n 4",
      "output": "declare -f confirm\ndeclare -f count_by\ndeclare -f count_dots\ndeclare -f die"
    },
    {
      "cmd": "declare -f die",
      "output": "die ()\n{\n    log ERROR \"$*\";\n    exit 1\n}"
    },
    {
      "cmd": "unset -f die; type die",
      "output": "bash: type: die: not found"
    }
  ]
}
```

Functions are not inherited by child processes. When a child Bash must run one, for example in `xargs` or `find -exec`, export it with `export -f`:

```terminal
{
  "title": "export -f for child shells",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "line_count() { printf '%5d %s\\n' \"$(wc -l < \"$1\")\" \"$1\"; }"
    },
    {
      "cmd": "find logs -name '*.log' -exec bash -c 'line_count \"$1\"' _ {} \\;",
      "output": "_: line 1: line_count: command not found\n_: line 1: line_count: command not found"
    },
    {
      "cmd": "export -f line_count; find logs -name '*.log' -exec bash -c 'line_count \"$1\"' _ {} \\;",
      "output": "   40 logs/access.log\n    6 logs/app.log"
    }
  ]
}
```

Note how the file name is passed: as an argument (`"$1"`, with `_` filling `$0`), never pasted into the command string, where a name containing a quote or `$(...)` would break or run as code.

## Common Mistakes

- **Returning data with `return`.** It only carries a status from 0 to 255. Print the data or use `printf -v` or a nameref.
- **Mixing log messages into a function's output.** Send them to standard error.
- **Forgetting `local`.** Variables leak into, and out of, every function.
- **`local var=$(cmd)`.** It hides the command's exit status. Declare first, assign second.
- **Ending a function with `[[ ... ]] && action`.** The function then fails whenever the test is false.
- **Passing commands as strings** (`retry "cmd arg"`). Pass them as separate arguments and run `"$@"`.
- **A library that runs code or sets `set -e`** when sourced.

## Summary

- Define functions before they are called; `name() { ...; }` works everywhere.
- Functions return an exit status; return data by printing it, with `printf -v`, or through a nameref.
- Declare every variable with `local`, and remember that callees see their callers' locals.
- Put shared functions in a library, load it relative to `${BASH_SOURCE[0]}`, and guard `main` so the file can be sourced by tests.
- Use `export -f` when a child Bash needs a function, and pass data to it as arguments.

Next: [Script Permissions and Execution](/guides/introduction-to-bash/07-script-permissions), where `logstat` becomes a command you can run from anywhere.

## Keep Learning

- [Get the directory of a Bash script](/posts/get-directory-bash-script-location)
- [Create an alias that takes parameters](/posts/create-bash-alias-that-takes-parameters) (spoiler: use a function)
- [Echo to standard error](/posts/echo-to-stderr-in-bash)
- Interview questions: [Bash scripting basics](/interview-questions/junior/bash-scripting-basics)
