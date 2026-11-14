---
title: 'How to Parse and Check Command Line Arguments in Bash'
excerpt: 'Read positional arguments with $1 and "$@", check that the user passed the arguments a script needs, parse short options with getopts and long options such as --env=prod with a while loop.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-09-05'
publishedAt: '2024-09-05T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Scripting
  - Arguments
  - getopts
  - CLI
---

A script that takes arguments needs two things: a way to read them, and a check that stops it early when an argument is missing. Without the check, a backup script called with no directory can run `tar` on nothing, or a deploy script can deploy the wrong branch.

This post covers positional arguments, checks for missing or invalid arguments, short options with `getopts`, and long options such as `--env=prod`.

## TLDR

| Task                                | Bash                                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| First, second, tenth argument       | `$1`, `$2`, `${10}`                                              |
| Number of arguments                 | `$#`                                                             |
| All arguments, each one kept intact | `"$@"`                                                           |
| Stop when no argument was given     | `(( $# > 0 )) \|\| { echo "usage: $0 DIR" >&2; exit 2; }`        |
| Default for an optional argument    | `level=${2:-9}`                                                  |
| Short options `-v -o file`          | `while getopts ':vo:' opt; do ... done; shift $((OPTIND - 1))`   |
| Long options `--env prod`           | `while (( $# )); do case $1 in --env) ... shift 2 ;; esac; done` |

## Prerequisites

- Bash 4 or later. `getopts` and the positional parameters also work in POSIX `sh`.
- A script file you can run, for example `./deploy.sh`. [How to make a Bash script executable](/guides/introduction-to-bash/07-script-permissions) shows how.

## How Do I Access Command Line Arguments in Bash?

The shell puts the arguments in **positional parameters**:

| Parameter    | Contains                                                |
| ------------ | ------------------------------------------------------- |
| `$0`         | The name the script was started with                    |
| `$1` .. `$9` | The first nine arguments                                |
| `${10}`      | The tenth argument. `$10` is `$1` followed by a `0`     |
| `$#`         | The number of arguments                                 |
| `"$@"`       | All arguments, each one as a separate word, spaces kept |
| `"$*"`       | All arguments joined into one word with a space         |

Always quote `"$@"` when you pass the arguments on. This test calls a script with three arguments, and the second one contains a space:

```bash
set -- a "b c" d     # set the positional parameters, as if the script got: a "b c" d

printf '[%s]' "$@"   # [a][b c][d]   three arguments, as given
printf '[%s]' "$*"   # [a b c d]     one argument
printf '[%s]' $@     # [a][b][c][d]  four arguments: unquoted, "b c" is split
```

`shift` removes `$1` and moves the other arguments down by one. `shift 2` removes two. The option parsers below use it to step through the arguments.

## How Do I Check if an Argument Was Passed to a Bash Script?

Check the count with `$#` and print a usage message to stderr when it is too small:

```bash
#!/usr/bin/env bash
set -euo pipefail

if (( $# < 1 )); then
    echo "Usage: ${0##*/} SOURCE_DIR [ARCHIVE]" >&2
    exit 2
fi

source_dir=$1
archive=${2:-backup.tar.gz}     # optional, with a default

tar -czf "$archive" -C "$source_dir" .
```

`$#` and `-z` answer different questions. `./backup.sh ""` passes one argument that is empty: `$#` is 1, and `[[ -z $1 ]]` is true. Check both when an empty value is not allowed. Under `set -u`, write `${1-}` instead of `$1` in tests, so a missing argument gives an empty string and not an "unbound variable" error.

For a required argument, `${1:?message}` checks and exits in one step:

```bash
target=${1:?usage: deploy.sh TARGET}
```

Exit with code 2 for a usage error. Many tools use 2 for "wrong arguments" and 1 for "the work failed", which helps the caller tell the two cases apart.

### Validate the Value, Not Only That It Exists

Check the type and range before you use a value:

```bash
port=${1-}

if ! [[ $port =~ ^[1-9][0-9]{0,4}$ ]] || (( port > 65535 )); then
    echo "Error: port must be a number between 1 and 65535, got '$port'" >&2
    exit 2
fi
```

Test the regular expression first, and do not allow a leading zero. `(( ))` evaluates its contents as arithmetic: a non-numeric value is read as the name of a variable, `010` is octal 8, and `08` is an arithmetic error. An error inside `if` counts as "false", so the check would let the value through. The regex also limits the length to five digits, so a huge number cannot overflow.

## How Do I Parse Options With getopts?

`getopts` is the shell builtin for short options such as `-v` and `-o file`. It also handles grouped options such as `-vo file`:

```bash
#!/usr/bin/env bash
verbose=0
output=

while getopts ':vo:' opt; do
    case $opt in
        v) verbose=1 ;;
        o) output=$OPTARG ;;
        :) echo "option -$OPTARG needs a value" >&2; exit 2 ;;
        \?) echo "unknown option -$OPTARG" >&2; exit 2 ;;
    esac
done
shift $((OPTIND - 1))     # remove the options, keep the other arguments

echo "verbose=$verbose output=$output rest=$*"
```

In the option string `':vo:'`:

- `v` is a flag without a value.
- `o:` takes a value, because a colon follows it. `getopts` puts the value in `$OPTARG`.
- The leading `:` turns on silent mode. `getopts` then prints no messages of its own. It sets `opt` to `:` for a missing value and to `?` for an unknown option, and puts the option letter in `$OPTARG`, so you print the message.

This is how the script behaves:

```text
$ ./opts.sh -v -o out.txt a b
verbose=1 output=out.txt rest=a b
$ ./opts.sh -vo out.txt c
verbose=1 output=out.txt rest=c
$ ./opts.sh -o
option -o needs a value
$ ./opts.sh -x
unknown option -x
$ ./opts.sh -- -v
verbose=0 output= rest=-v
```

`getopts` stops at the first argument that is not an option, and at `--`. Users can then pass a file name that starts with `-`.

## How Do I Parse Long Options Like --verbose in Bash?

`getopts` has no long options. Use a `while` loop with `case`, and `shift` after each option:

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
    echo "Usage: ${0##*/} [-v] -e ENV [-b BRANCH] [--] FILE..." >&2
    exit 2
}

# fail when an option has no value after it
need_value() { [[ $# -ge 2 && -n $2 && $2 != -* ]] || { echo "option $1 needs a value" >&2; usage; }; }

verbose=0 env='' branch=main
files=()

while (( $# > 0 )); do
    case $1 in
        -v|--verbose) verbose=1; shift ;;
        -e|--env)     need_value "$@"; env=$2; shift 2 ;;
        --env=*)      env=${1#*=}; shift ;;
        -b|--branch)  need_value "$@"; branch=$2; shift 2 ;;
        --branch=*)   branch=${1#*=}; shift ;;
        -h|--help)    usage ;;
        --)           shift; files+=("$@"); break ;;
        -*)           echo "unknown option: $1" >&2; usage ;;
        *)            files+=("$1"); shift ;;
    esac
done

[[ -n $env ]] || { echo "--env is required" >&2; usage; }
(( ${#files[@]} > 0 )) || usage

echo "verbose=$verbose env=$env branch=$branch files=${files[*]}"
```

```text
$ ./deploy.sh -v --env=prod a.txt b.txt
verbose=1 env=prod branch=main files=a.txt b.txt
$ ./deploy.sh -e staging --branch dev -- -odd.txt
verbose=0 env=staging branch=dev files=-odd.txt
$ ./deploy.sh --env
option --env needs a value
Usage: deploy.sh [-v] -e ENV [-b BRANCH] [--] FILE...
```

The `need_value` check matters. Without it, `--env` as the last argument makes `shift 2` fail, and `--env --verbose` takes `--verbose` as the environment name. The loop accepts both `--env prod` and `--env=prod`, stops option parsing at `--`, and collects the other arguments in an array.

The loop does not split grouped short options such as `-vb dev`. If you need that and long options together, the `getopt` command from util-linux (installed on almost every Linux system) rewrites the arguments into a form the loop can read. Check its exit status before you use the result, or an unknown option is reported and then ignored:

```bash
parsed=$(getopt -o ve:b: -l verbose,env:,branch: -- "$@") || exit 2
eval set -- "$parsed"
```

The `getopt` in macOS and BSD does not support long options, so scripts that must run there keep the plain loop.

### Mix Options With Environment Variables

A common pattern lets an environment variable set the default and an option override it:

```bash
host=${MYAPP_HOST:-localhost}
port=${MYAPP_PORT:-8080}

while (( $# > 0 )); do
    case $1 in
        --host) need_value "$@"; host=$2; shift 2 ;;
        --port) need_value "$@"; port=$2; shift 2 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done
```

The order of precedence is then: command line option, environment variable, default in the script.

### Handle Subcommands

For a tool with subcommands like `git`, read the first argument, shift it away and pass the rest to a function:

```bash
cmd=${1-}
shift || true

case $cmd in
    start)  start_service "$@" ;;
    stop)   stop_service "$@" ;;
    status) show_status "$@" ;;
    ''|-h|--help) echo "Usage: ${0##*/} {start|stop|status} [options]" ;;
    *) echo "unknown command: $cmd" >&2; exit 2 ;;
esac
```

Each function can then parse its own options with the same `while` loop.

## Related Resources

- [Introduction to Bash: Script Arguments](/guides/introduction-to-bash/08-command-line-arguments): `shift`, `getopts`, long options and standard input
- [How to check if a file, directory, variable or command exists in Bash](/posts/check-directory-exists-bash-script): tests to validate argument values
- [What does set -e mean?](/posts/what-does-set-e-mean-in-bash-script): strict mode and how `set -u` treats missing arguments
- [How to prompt for yes/no input in a shell script](/posts/prompt-for-yes-no-cancel-input-in-linux-shell-script)
