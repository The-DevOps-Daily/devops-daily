---
title: 'Bash Script Arguments: $@, shift, getopts and Long Options'
description: 'Handle Bash script arguments: "$@" versus $*, check and validate input (numbers, ports, IP addresses), shift, getopts, long options, stdin and exit codes.'
order: 8
---

Arguments are how people and other programs tell your script what to do. A script with a clear interface (named options, sensible defaults, a `--help` that answers questions, errors that say what was wrong) gets used and automated. One that guesses, or breaks on a file name with a space, gets rewritten.

This part covers the positional parameters, checking and validating arguments, `shift`, `getopts` for short options, a loop for long options, GNU `getopt`, reading from standard input, and building commands safely from arguments. At the end, `logstat` gets a complete command-line interface.

## Prerequisites

- `logstat` and `lib/logstat.sh` from [Part 6](/guides/introduction-to-bash/06-functions), installed in `~/.local/bin` as in [Part 7](/guides/introduction-to-bash/07-script-permissions).
- `case` and `[[ =~ ]]` from [Part 5](/guides/introduction-to-bash/05-control-structures).

## "$@", "$*" and $@

`$1` to `$9` hold the first nine arguments, `${10}` and up need braces, and `$#` is the count. To pass all of them on, there are three forms that look alike and behave differently:

```bash
#!/usr/bin/env bash
# args.sh: show how the three forms expand
printf '"$@" gives %d words:' "$#"
for arg in "$@"; do printf ' [%s]' "$arg"; done
echo
printf '"$*" gives 1 word: [%s]\n' "$*"
printf '$@ unquoted gives:'
# shellcheck disable=SC2068 # unquoted on purpose, to show the problem
for arg in $@; do printf ' [%s]' "$arg"; done
echo
if (($# > 0)); then
    echo "last: ${!#}, all but the first: ${*:2}"
fi
```

```terminal
{
  "title": "only \"$@\" keeps the arguments as they were",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash args.sh deploy \"notes api\" 'logs/*.log'",
      "output": "\"$@\" gives 3 words: [deploy] [notes api] [logs/*.log]\n\"$*\" gives 1 word: [deploy notes api logs/*.log]\n$@ unquoted gives: [deploy] [notes] [api] [logs/access.log] [logs/app.log]\nlast: logs/*.log, all but the first: notes api logs/*.log"
    }
  ]
}
```

`"$@"` is the one you want almost every time: each argument stays one word, spaces included. `"$*"` joins them into one string with the first character of `IFS` (a space by default), which is useful for messages. Unquoted `$@` or `$*` splits on spaces and expands wildcards: `notes api` became two words, and the pattern `logs/*.log` turned into two file names.

`${!#}` is the last argument and `"${@:2}"` all arguments from the second on. `set -- a b c` replaces the positional parameters, which is handy in functions and tests.

## Check That Arguments Were Given

```bash
#!/usr/bin/env bash
# checks.sh: different questions you can ask about the arguments
echo "count: $#"

if (( $# == 0 )); then
    echo "no arguments at all"
fi
if [[ -n ${1-} ]]; then
    echo "the first argument is set and not empty: $1"
else
    echo "the first argument is missing or empty"
fi

for arg in "$@"; do              # is a particular option present anywhere?
    if [[ $arg == --dry-run ]]; then
        echo "dry run requested"
        break
    fi
done
```

```terminal
{
  "title": "count, empty and present",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash checks.sh",
      "output": "count: 0\nno arguments at all\nthe first argument is missing or empty"
    },
    {
      "comment": "an empty string still counts as an argument",
      "cmd": "bash checks.sh \"\"",
      "output": "count: 1\nthe first argument is missing or empty"
    },
    {
      "cmd": "bash checks.sh deploy --dry-run",
      "output": "count: 2\nthe first argument is set and not empty: deploy\ndry run requested"
    }
  ]
}
```

Use `${1-}` rather than `$1` in tests like these so they also work under `set -u`. For a value the script cannot run without, `${1:?usage: deploy.sh TARGET}` checks and exits in one go ([Part 4](/guides/introduction-to-bash/04-bash-variables)). More variations: [check if an input argument exists](/posts/check-existence-of-input-argument-in-bash-shell-script).

## shift

`shift` drops `$1` and moves the others down; `shift 2` drops two. It fails, without changing anything, when there are fewer arguments than you asked to drop, which stops a script under `set -e`:

```terminal
{
  "title": "shift",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "set -- --by ip access.log; shift; echo \"now: $*\"",
      "output": "now: ip access.log"
    },
    {
      "cmd": "shift 3; echo \"shift 3 status: $?, still: $*\"",
      "output": "shift 3 status: 1, still: ip access.log"
    }
  ]
}
```

A `while (( $# > 0 ))` loop with `shift` processes arguments one at a time; the long-options parser below works that way.

## Validate Arguments

Check every value before you use it, and say exactly what was wrong. Small functions keep the checks readable. Note what each regular expression rules out: an empty string, signs, spaces, leading zeros (which Bash would read as octal, [Part 4](/guides/introduction-to-bash/04-bash-variables)) and absurd lengths:

```bash
# lib/validate.sh: argument checks that return 0 (valid) or 1 (invalid)
# shellcheck shell=bash

# a whole number from 0 to 999999999, without leading zeros
is_uint() { [[ $1 =~ ^(0|[1-9][0-9]{0,8})$ ]]; }

# a TCP or UDP port number
is_port() { is_uint "$1" && (($1 >= 1 && $1 <= 65535)); }

# a dotted IPv4 address: four numbers from 0 to 255, no leading zeros
is_ipv4() {
    local -a octets
    local o
    [[ $1 =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
    IFS=. read -r -a octets <<<"$1"
    for o in "${octets[@]}"; do
        if [[ ! $o =~ ^(0|[1-9][0-9]*)$ ]] || ((o > 255)); then
            return 1
        fi
    done
}

# one of a fixed list of words: is_one_of VALUE WORD...
is_one_of() {
    local value=$1 word
    shift
    for word in "$@"; do
        [[ $value == "$word" ]] && return 0
    done
    return 1
}
```

```terminal
{
  "title": "try the checks",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "source lib/validate.sh"
    },
    {
      "cmd": "for p in 8080 0 65536 080 -1 \"\" 22abc; do is_port \"$p\" && r=valid || r=invalid; printf '%-7s port %s\\n' \"[$p]\" \"$r\"; done",
      "output": "[8080]  port valid\n[0]     port invalid\n[65536] port invalid\n[080]   port invalid\n[-1]    port invalid\n[]      port invalid\n[22abc] port invalid"
    },
    {
      "cmd": "for ip in 192.0.2.44 10.0.0.256 10.0.0 010.0.0.1 1.2.3.4.5 '1.2.3.4 '; do is_ipv4 \"$ip\" && r=valid || r=invalid; printf '%-12s %s\\n' \"[$ip]\" \"$r\"; done",
      "output": "[192.0.2.44] valid\n[10.0.0.256] invalid\n[10.0.0]     invalid\n[010.0.0.1]  invalid\n[1.2.3.4.5]  invalid\n[1.2.3.4 ]   invalid"
    },
    {
      "cmd": "is_one_of staging dev staging production && echo \"staging is allowed\"",
      "output": "staging is allowed"
    }
  ]
}
```

The `&& r=valid || r=invalid` form is safe here because an assignment cannot fail. For files, test with `[[ -r $file ]]` (exists and is readable) or `[[ -d $dir ]]`, as [Part 3](/guides/introduction-to-bash/03-working-with-files) shows.

Checking whether an address is **reachable** is a different question from whether it is valid. `ping -c 1 -W 2 "$ip" > /dev/null` works where ICMP is allowed, but many networks block it; for a service, test the port it should listen on, as `wait-for-port.sh` in [Part 5](/guides/introduction-to-bash/05-control-structures) does with `/dev/tcp`.

## Short Options With getopts

`getopts` is a builtin that parses short options the POSIX way: `-v`, `-n 5`, `-n5`, and combined flags such as `-vn 5`. You give it an **option string** that lists the letters; a letter followed by `:` takes a value.

```bash
#!/usr/bin/env bash
# greet.sh: getopts example. usage: greet.sh [-v] [-n COUNT] [-g GREETING] NAME...
verbose=0 count=1 greeting=Hello

while getopts ":vn:g:" opt; do
    case $opt in
        v) verbose=1 ;;
        n) count=$OPTARG ;;
        g) greeting=$OPTARG ;;
        :) echo "greet.sh: option -$OPTARG needs a value" >&2; exit 2 ;;
        ?) echo "greet.sh: unknown option -$OPTARG" >&2; exit 2 ;;
    esac
done
shift $(( OPTIND - 1 ))        # remove the options; the names are left

(( $# > 0 )) || { echo "usage: greet.sh [-v] [-n COUNT] [-g GREETING] NAME..." >&2; exit 2; }
[[ $count =~ ^[1-9][0-9]?$ ]] || { echo "greet.sh: COUNT must be 1 to 99" >&2; exit 2; }

(( verbose )) && echo "greeting $# name(s) $count time(s)" >&2
for name in "$@"; do
    for (( i = 0; i < count; i++ )); do
        echo "$greeting, $name!"
    done
done
```

```terminal
{
  "title": "getopts at work",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash greet.sh -v -n 2 Ada",
      "output": "greeting 1 name(s) 2 time(s)\nHello, Ada!\nHello, Ada!"
    },
    {
      "comment": "combined flags and an attached value",
      "cmd": "bash greet.sh -vn1 -gHi Ada \"Grace Hopper\"",
      "output": "greeting 2 name(s) 1 time(s)\nHi, Ada!\nHi, Grace Hopper!"
    },
    {
      "comment": "-- ends the options, so a name may start with a dash",
      "cmd": "bash greet.sh -- -x",
      "output": "Hello, -x!"
    },
    {
      "cmd": "bash greet.sh -x Ada; echo \"exit code: $?\"",
      "output": "greet.sh: unknown option -x\nexit code: 2"
    },
    {
      "cmd": "bash greet.sh Ada -n 3",
      "output": "Hello, Ada!\nHello, -n!\nHello, 3!"
    }
  ]
}
```

How it works:

- The leading `:` in `":vn:g:"` selects **silent mode**: instead of printing its own messages, `getopts` sets `opt` to `?` for an unknown option and to `:` for a missing value, with the letter in `OPTARG`, so your script writes the error.
- `OPTIND` is the index of the next argument to process. `shift $(( OPTIND - 1 ))` removes everything `getopts` consumed.
- `getopts` stops at the first argument that is not an option. In the last example, `-n 3` came after `Ada`, so it was treated as two more names. That is POSIX behaviour (GNU tools reorder arguments, `getopts` does not).
- `getopts` only knows single-letter options. `--count` needs one of the approaches below.

If you call `getopts` inside a function more than once, declare `local OPTIND` in the function. `OPTIND` is global, so the second call would otherwise start where the first one stopped and parse nothing.

## Long Options With a while Loop

For `--by ip` and `--by=ip` style options, which most modern tools accept, loop over the arguments with `case`. This is the version `logstat` uses; it accepts both forms, `--` and `-` for standard input:

```bash
while (($# > 0)); do
    case $1 in
        -b | --by)
            (($# >= 2)) || usage_error "option $1 needs a value"
            by=$2
            shift 2
            ;;
        --by=*)
            by=${1#*=} # everything after the first =
            shift
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        --)
            shift
            files+=("$@") # everything after -- is a file name
            break
            ;;
        -?*) usage_error "unknown option: $1" ;;
        *)
            # a file name, or - for standard input
            files+=("$1")
            shift
            ;;
    esac
done
```

The loop collects file names in an array wherever they appear, so options may come before or after them. The price is that it does not split combined short flags such as `-vn5`; add `getopts`-style handling only if your users expect it.

### GNU getopt

On Linux, the `getopt` **program** from util-linux (not the `getopts` builtin) can do the parsing and reordering, including long options, abbreviations and `--opt=value`:

```terminal
{
  "title": "util-linux getopt normalizes the arguments",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "getopt --version",
      "output": "getopt from util-linux 2.39.3"
    },
    {
      "cmd": "getopt -o b:n:h --long by:,top:,help -n logstat -- logs/access.log --top=3 -b ip",
      "output": " --top '3' -b 'ip' -- 'logs/access.log'"
    },
    {
      "cmd": "getopt -o b:n:h --long by:,top:,help -n logstat -- --bogus logs/access.log; echo \"exit code: $?\"",
      "output": "logstat: unrecognized option '--bogus'\n -- 'logs/access.log'\nexit code: 1"
    }
  ]
}
```

A script uses it as `parsed=$(getopt ...) || exit 2` followed by `eval set -- "$parsed"`; `getopt` quotes its output so the `eval` is safe. It is not portable: macOS ships a BSD `getopt` without long options, and Alpine's BusyBox version differs again. Use it in scripts that only run on GNU/Linux, and the `while` loop everywhere else.

## Standard Input and the - Convention

Tools that read data should accept file names and, when there are none, read standard input, so they work in pipelines. A lone `-` conventionally means "standard input" too. One check makes the tool friendlier: if there are no files and standard input is a terminal, the user probably forgot an argument, so say so instead of waiting for typed input. `[[ -t 0 ]]` is true when standard input is a terminal.

## Build Commands Safely From Arguments

Scripts often assemble a command from options and arguments. Build it in an **array**, and run it with `"${array[@]}"`. Each element stays one argument, whatever characters it contains:

```terminal
{
  "title": "a command in an array versus eval",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p \"client's files\" && echo \"invoice\" > \"client's files/jan.txt\""
    },
    {
      "cmd": "dirs=(logs \"client's files\"); excludes=('*.env' 'tmp*')"
    },
    {
      "cmd": "args=(--create --gzip --file backup.tar.gz); for p in \"${excludes[@]}\"; do args+=(\"--exclude=$p\"); done"
    },
    {
      "cmd": "tar \"${args[@]}\" -- \"${dirs[@]}\" && tar -tzf backup.tar.gz",
      "output": "logs/\nlogs/access.log\nlogs/app.log\nclient's files/\nclient's files/jan.txt"
    }
  ]
}
```

The same job done the way many old scripts do it, by building a string and running it with `eval`, breaks on the first file name that contains a single quote. A name with a quote followed by `$(...)` would even run as code, because the quote ends the quoting around it:

```bash
#!/usr/bin/env bash
# eval-tar.sh: the fragile way (do not copy this)
dirs=(logs "client's files")
cmd="tar -czf backup2.tar.gz"
for d in "${dirs[@]}"; do cmd="$cmd '$d'"; done
eval "$cmd"
```

```terminal
{
  "title": "eval breaks on a quote in a name",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash eval-tar.sh; echo \"exit code: $?\"",
      "output": "eval-tar.sh: eval: line 6: unexpected EOF while looking for matching `''\nexit code: 2"
    }
  ]
}
```

If you need to print or log the command, `printf '%q ' "${args[@]}"` shows it quoted the way Bash would need to read it back.

## The Complete logstat Interface

Replace `~/bash-practice/logstat` with this version. It keeps the library and the main guard from [Part 6](/guides/introduction-to-bash/06-functions) and the symlink fix from [Part 7](/guides/introduction-to-bash/07-script-permissions), and adds options, validation, help, standard input and documented exit codes:

```bash
#!/usr/bin/env bash
# logstat: count requests in web server access logs
# usage: logstat [-b FIELD] [-n N] [FILE...]

script_dir=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
# shellcheck source=lib/logstat.sh
source "$script_dir/lib/logstat.sh"

readonly VERSION=1.0.0

usage() {
    cat <<'EOF_USAGE'
usage: logstat [-b FIELD] [-n N] [FILE...]
Count requests in access logs (nginx or Apache combined format).

  -b, --by FIELD   ip, method, path, status or class (default: status)
  -n, --top N      show only the N most frequent values
  -h, --help       show this help and exit
  -V, --version    show the version and exit

With no FILE, or when FILE is -, read standard input.
EOF_USAGE
}

# usage_error MESSAGE: explain a usage mistake and exit with status 2
usage_error() {
    printf 'logstat: %s\n' "$1" >&2
    printf "Try 'logstat --help' for more information.\n" >&2
    exit 2
}

main() {
    local by=status top f # top stays unset unless --top is given
    local -a files=()

    while (($# > 0)); do
        case $1 in
            -b | --by)
                (($# >= 2)) || usage_error "option $1 needs a value"
                by=$2
                shift 2
                ;;
            --by=*)
                by=${1#*=}
                shift
                ;;
            -n | --top)
                (($# >= 2)) || usage_error "option $1 needs a value"
                top=$2
                shift 2
                ;;
            --top=*)
                top=${1#*=}
                shift
                ;;
            -h | --help)
                usage
                exit 0
                ;;
            -V | --version)
                echo "logstat $VERSION"
                exit 0
                ;;
            --)
                shift
                files+=("$@")
                break
                ;;
            -?*) usage_error "unknown option: $1" ;;
            *)
                # a file name, or - for standard input
                files+=("$1")
                shift
                ;;
        esac
    done

    case $by in
        ip | method | path | status | class) ;;
        *) usage_error "--by must be ip, method, path, status or class, not '$by'" ;;
    esac
    if [[ -v top && ! $top =~ ^[1-9][0-9]{0,5}$ ]]; then
        usage_error "--top needs a whole number from 1 to 999999, not '$top'"
    fi
    for f in "${files[@]}"; do
        if [[ $f != - && (-d $f || ! -r $f) ]]; then
            printf 'logstat: cannot read %s\n' "$f" >&2
            exit 1
        fi
    done
    if ((${#files[@]} == 0)) && [[ -t 0 ]]; then
        usage_error "no input: give a FILE, or pipe a log into logstat"
    fi

    if [[ -v top ]]; then
        count_by "$by" "${files[@]}" | head -n "$top"
    else
        count_by "$by" "${files[@]}"
    fi
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
```

```terminal
{
  "title": "logstat with options",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "shellcheck -x ~/bash-practice/logstat && echo \"shellcheck: no warnings\"",
      "output": "shellcheck: no warnings"
    },
    {
      "cmd": "logstat --help",
      "output": "usage: logstat [-b FIELD] [-n N] [FILE...]\nCount requests in access logs (nginx or Apache combined format).\n\n  -b, --by FIELD   ip, method, path, status or class (default: status)\n  -n, --top N      show only the N most frequent values\n  -h, --help       show this help and exit\n  -V, --version    show the version and exit\n\nWith no FILE, or when FILE is -, read standard input."
    },
    {
      "cmd": "logstat logs/access.log",
      "output": "20\t200\n8\t404\n4\t201\n4\t302\n4\t500"
    },
    {
      "cmd": "logstat -b ip -n 2 logs/access.log",
      "output": "12\t198.51.100.23\n9\t203.0.113.77"
    },
    {
      "cmd": "logstat logs/access.log --by=path --top 3",
      "output": "4\t/\n4\t/about.html\n4\t/api/health"
    },
    {
      "comment": "standard input, alone or as - among files",
      "cmd": "grep ' 404 ' logs/access.log | logstat --by path",
      "output": "4\t/favicon.ico\n4\t/wp-login.php"
    },
    {
      "cmd": "grep POST logs/access.log | logstat -b method - logs/app.log",
      "output": "8\tPOST\ncount_by: skipped 6 line(s) not in the combined format"
    }
  ]
}
```

The last command mixed a pipe (`-`) with `logs/app.log`, whose lines are not in the access log format; `count_by` skipped them and said so on standard error. The errors:

```terminal
{
  "title": "every mistake gets a clear message and exit code",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "logstat --by browser logs/access.log; echo \"exit code: $?\"",
      "output": "logstat: --by must be ip, method, path, status or class, not 'browser'\nTry 'logstat --help' for more information.\nexit code: 2"
    },
    {
      "cmd": "logstat -n 0 logs/access.log; echo \"exit code: $?\"",
      "output": "logstat: --top needs a whole number from 1 to 999999, not '0'\nTry 'logstat --help' for more information.\nexit code: 2"
    },
    {
      "cmd": "logstat --top; echo \"exit code: $?\"",
      "output": "logstat: option --top needs a value\nTry 'logstat --help' for more information.\nexit code: 2"
    },
    {
      "cmd": "logstat --verbose logs/access.log; echo \"exit code: $?\"",
      "output": "logstat: unknown option: --verbose\nTry 'logstat --help' for more information.\nexit code: 2"
    },
    {
      "cmd": "logstat --top= logs/access.log; echo \"exit code: $?\"",
      "output": "logstat: --top needs a whole number from 1 to 999999, not ''\nTry 'logstat --help' for more information.\nexit code: 2"
    },
    {
      "cmd": "logstat logs/nope.log; echo \"exit code: $?\"",
      "output": "logstat: cannot read logs/nope.log\nexit code: 1"
    },
    {
      "cmd": "logstat logs; echo \"exit code: $?\"",
      "output": "logstat: cannot read logs\nexit code: 1"
    },
    {
      "comment": "a file whose name starts with a dash needs -- or ./",
      "cmd": "cp logs/access.log ./-weird.log && logstat -n 1 -- -weird.log && rm ./-weird.log",
      "output": "20\t200"
    }
  ]
}
```

The design choices, which you can reuse in your own tools:

- **Exit codes**: 0 for success, 1 when the work failed (an unreadable file), 2 for a usage error. CI systems and other scripts can tell them apart.
- **Messages go to standard error** and start with the program's name, so they make sense in a log that mixes several tools. Data goes to standard output.
- **`--help` prints to standard output and exits 0**, so `logstat --help | less` works. Errors print a one-line hint instead of the whole help text.
- **Validation happens before any work**, including checking that every file is readable and not a directory, so the tool never prints half a report and then fails. `top` starts unset (`local top`), so `--top=` with an empty value is an error instead of being mistaken for "no `--top`" ([Part 4](/guides/introduction-to-bash/04-bash-variables) explains unset versus empty).

[Part 10](/guides/introduction-to-bash/10-bash-best-practices) adds strict mode and tests for this script, and finds one more bug in the `head` pipeline.

## Common Mistakes

- **`$@` or `$*` without quotes.** Use `"$@"`.
- **`$1` under `set -u` when it may be missing.** Use `${1-}` or check `$#` first.
- **Forgetting `shift $(( OPTIND - 1 ))`** after `getopts`, or `local OPTIND` when `getopts` runs in a function.
- **Expecting `getopts` to find options after the first file name.** It stops there.
- **Using GNU `getopt` in scripts that must run on macOS.**
- **Validating numbers with `-gt` or `(( ))` alone.** Check the format with a regex first.
- **Building commands in strings and running them with `eval`.** Use an array.
- **Waiting silently for input** when no file is given and standard input is a terminal.

## Summary

- `"$@"` passes arguments on unchanged; `$#` counts them; `${1-}` reads one safely.
- Validate every argument with a format check (regex) before range checks or arithmetic.
- `getopts` handles POSIX short options; a `while`/`case` loop handles long options and `--opt=value`; GNU `getopt` is a Linux-only shortcut.
- Read standard input when no files are given, and treat `-` as standard input.
- Build commands in arrays and run them with `"${cmd[@]}"`.
- Exit 0, 1 or 2, send messages to standard error and make `--help` useful.

Next: [Bash Text Processing](/guides/introduction-to-bash/09-bash-tools), where `printf`, here documents, process substitution, `awk` and `jq` come in.

## Keep Learning

- [Check if an input argument exists](/posts/check-existence-of-input-argument-in-bash-shell-script)
- [Prompt for yes, no or cancel](/posts/prompt-for-yes-no-cancel-input-in-linux-shell-script)
- [Create an alias that takes parameters](/posts/create-bash-alias-that-takes-parameters)
- Interview questions: [Shell scripting fundamentals](/interview-questions/junior/shell-scripting-fundamentals)
