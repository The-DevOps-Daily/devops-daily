---
title: 'Bash Shell Scripting Basics for Beginners'
description: 'Bash shell scripting basics with tested examples: variables, quoting, if and case, loops, functions, arguments, exit codes, error handling and ShellCheck.'
order: 9
---

A shell script is a text file full of the commands you would otherwise type by hand. Scripts turn a ten-step procedure into one command, run the same way every time, and work at 3 a.m. from a timer without you. They glue the rest of a Linux system together: deployment steps, backups, health checks, container entrypoints, CI jobs.

This part teaches Bash scripting from the first line to a complete backup script that [Part 10](/guides/introduction-to-linux/10-system-administration) runs on a schedule. Every script here was run as shown, and the finished backup script passes ShellCheck without warnings.

## Prerequisites

- The command line from [Part 3](/guides/introduction-to-linux/03-command-line-interface) and permissions from [Part 4](/guides/introduction-to-linux/04-file-system-hierarchy).
- A text editor (`nano` is fine) and Bash 4 or newer. Ubuntu 24.04 has Bash 5.2, Debian 13 has 5.2, Fedora 44 has 5.3; macOS still ships Bash 3.2, so install a newer one with Homebrew there.
- A fresh `~/lab` from [Part 3](/guides/introduction-to-linux/03-command-line-interface#h2-set-up-the-practice-directory), which some scripts read.

The output comes from Ubuntu 24.04.5 LTS (Bash 5.2.21). Create a directory for the scripts with `mkdir -p ~/scripts`, and save each one there under the name in its first comment line, for example with `nano ~/scripts/hello.sh`.

## Your First Script

```bash
#!/usr/bin/env bash
# hello.sh: print a greeting and some facts about this machine

echo "Hello, $USER!"
echo "Today is $(date +%A), and this is $(hostname)."
echo "You are in $PWD."
```

```terminal
{
  "title": "make it executable and run it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p ~/scripts && cd ~/scripts"
    },
    {
      "cmd": "./hello.sh",
      "output": "bash: ./hello.sh: Permission denied"
    },
    {
      "cmd": "chmod +x hello.sh"
    },
    {
      "cmd": "./hello.sh",
      "output": "Hello, dev!\nToday is Friday, and this is devbox.\nYou are in /home/dev/scripts."
    }
  ]
}
```

The first line is the **shebang**. It tells the kernel which interpreter runs the file. `#!/usr/bin/env bash` finds `bash` on the `PATH`, which also works on systems where Bash is not in `/bin`; `#!/bin/bash` is just as common on Linux. Lines that start with `#` are comments.

A script needs the execute bit (`chmod +x`) to run as `./hello.sh`. You can also run any script with `bash hello.sh`, which ignores the execute bit and the shebang.

:::warning
`sh` is not Bash. On Debian and Ubuntu, `/bin/sh` is **dash**, a small POSIX shell without arrays, `[[ ]]` or `{1..5}`. Running a Bash script with `sh script.sh` fails in confusing ways. Use a `#!/usr/bin/env bash` shebang and run the script directly. See [the difference between sh and Bash](/posts/difference-between-sh-and-bash).
:::

## Variables and Quoting

Assign with `name=value`, with **no spaces** around `=`, and read with `$name` or `${name}`:

```bash
#!/usr/bin/env bash
app="notes site"
port=8080
release=$(date +%Y%m%d)          # command substitution: the output of a command
next_port=$((port + 1))          # arithmetic

echo "Deploying ${app} release ${release} on port ${port}"
echo "The next free port is ${next_port}"
echo "Unset variables are empty: [${missing}]"
echo "Or use a default: ${LOG_LEVEL:-info}"
```

```terminal
{
  "title": "variables",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash vars.sh | sed \"s/release [0-9]*/release YYYYMMDD/\"",
      "output": "Deploying notes site release YYYYMMDD on port 8080\nThe next free port is 8081\nUnset variables are empty: []\nOr use a default: info"
    },
    {
      "comment": "spaces around = turn the line into a command called 'name'",
      "cmd": "name = \"dev\"",
      "output": "bash: name: command not found"
    }
  ]
}
```

The `sed` just hides today's date. ShellCheck flags the `${missing}` line (SC2154, a variable that is used but never assigned), which is exactly the typo this example shows. `${LOG_LEVEL:-info}` uses `info` when `LOG_LEVEL` is unset or empty; `${VAR:?message}` stops the script with an error instead, which is the safe choice for values a script cannot work without.

### Always Quote Your Variables

When a variable is not in double quotes, the shell splits its value on spaces and expands wildcards in it. That is the most common bug in shell scripts:

```terminal
{
  "title": "unquoted variables split on spaces",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/scripts"
    },
    {
      "cmd": "file=\"monthly report.txt\""
    },
    {
      "cmd": "touch $file"
    },
    {
      "cmd": "ls",
      "output": "hello.sh\nmonthly\nreport.txt\nvars.sh"
    },
    {
      "cmd": "touch \"$file\""
    },
    {
      "cmd": "ls",
      "output": "hello.sh\nmonthly\nmonthly report.txt\nreport.txt\nvars.sh"
    },
    {
      "cmd": "rm monthly report.txt \"monthly report.txt\""
    }
  ]
}
```

Without quotes, `touch` received two arguments and created two files. Write `"$var"` every time, unless you know you need the splitting. Single quotes keep everything literal: `'$HOME'` prints `$HOME`.

### Environment Variables and export

A plain variable exists only in the current shell. `export` makes it part of the **environment**, which child processes (including scripts you start) inherit:

```terminal
{
  "title": "export passes a variable to child processes",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "greeting=\"hi\""
    },
    {
      "cmd": "bash -c 'echo \"child sees: [$greeting]\"'",
      "output": "child sees: []"
    },
    {
      "cmd": "export greeting"
    },
    {
      "cmd": "bash -c 'echo \"child sees: [$greeting]\"'",
      "output": "child sees: [hi]"
    },
    {
      "comment": "set a variable for one command only",
      "cmd": "LOG_LEVEL=debug bash -c 'echo \"LOG_LEVEL=$LOG_LEVEL\"'",
      "output": "LOG_LEVEL=debug"
    }
  ]
}
```

## Arguments

A script receives its command-line arguments in `$1`, `$2` and so on:

| Variable               | Contains                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `$0`                   | The name the script was called with                                                       |
| `$1` ... `$9`, `${10}` | The positional arguments                                                                  |
| `$#`                   | How many arguments there are                                                              |
| `"$@"`                 | All arguments, each one kept as a separate word (use this)                                |
| `"$*"`                 | All arguments joined into one string, separated by the first character of `IFS` (a space) |
| `$?`                   | Exit code of the last command                                                             |
| `$$`                   | PID of the script                                                                         |

```bash
#!/usr/bin/env bash
echo "script: $0, argument count: $#"
echo "first: $1, second: $2"
for arg in "$@"; do
    echo "  arg: [$arg]"
done
shift                      # drop $1, move the rest down
echo "after shift, first is: $1"
```

```terminal
{
  "title": "arguments",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "chmod +x args.sh"
    },
    {
      "cmd": "./args.sh deploy \"notes site\" --verbose",
      "output": "script: ./args.sh, argument count: 3\nfirst: deploy, second: notes site\n  arg: [deploy]\n  arg: [notes site]\n  arg: [--verbose]\nafter shift, first is: notes site"
    }
  ]
}
```

`"$@"` kept `notes site` together as one argument. `$@` without quotes, or `$*`, would have split it.

## Conditions: if, test and case

`if` runs a command and checks its exit code: 0 is true, anything else is false. `[[ ... ]]` is Bash's test command:

```bash
#!/usr/bin/env bash
# check.sh: describe a path given as the first argument
path="${1:?usage: check.sh PATH}"

if [[ -d "$path" ]]; then
    if [[ ! -r "$path" || ! -x "$path" ]]; then
        echo "$path is a directory, but you may not list it" >&2
        exit 1
    fi
    entries=$(find -H "$path" -mindepth 1 -maxdepth 1 -printf . | wc -c)   # one dot per entry; -H follows a symlinked path
    echo "$path is a directory with $entries entries"
elif [[ -f "$path" ]]; then
    if [[ ! -r "$path" ]]; then
        echo "$path is a regular file, but you may not read it" >&2
        exit 1
    fi
    size=$(stat -L -c %s -- "$path")                 # -L: the file a symlink points to
    if (( size > 1024 )); then
        echo "$path is a readable file, larger than 1 KiB ($size bytes)"
    else
        echo "$path is a readable file of $size bytes"
    fi
elif [[ -e "$path" ]]; then
    echo "$path exists but is not a regular file or directory"
else
    echo "$path does not exist" >&2
    exit 1
fi
```

```terminal
{
  "title": "if, elif, else",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "chmod +x check.sh"
    },
    {
      "cmd": "./check.sh ~/lab/site",
      "output": "/home/dev/lab/site is a directory with 4 entries"
    },
    {
      "cmd": "./check.sh ~/lab/logs/access.log",
      "output": "/home/dev/lab/logs/access.log is a readable file, larger than 1 KiB (7179 bytes)"
    },
    {
      "cmd": "./check.sh /nope; echo \"exit code: $?\"",
      "output": "/nope does not exist\nexit code: 1"
    },
    {
      "cmd": "./check.sh",
      "output": "./check.sh: line 3: 1: usage: check.sh PATH"
    }
  ]
}
```

The tests you will use most:

| Test                                     | True when                                                     |
| ---------------------------------------- | ------------------------------------------------------------- |
| `-e path`                                | the path exists                                               |
| `-f path` / `-d path`                    | it is a regular file / a directory                            |
| `-r`, `-w`, `-x path`                    | you may read / write / execute it                             |
| `-s path`                                | the file exists and is not empty                              |
| `-z "$s"` / `-n "$s"`                    | the string is empty / not empty                               |
| `"$a" == "$b"`, `!=`                     | strings are equal / different                                 |
| `"$s" == deploy-*`                       | the string matches a glob pattern (inside `[[ ]]` only)       |
| `"$s" =~ ^[0-9]+$`                       | the string matches a regular expression (inside `[[ ]]` only) |
| `-eq`, `-ne`, `-lt`, `-le`, `-gt`, `-ge` | integer comparisons, or use `(( a > b ))`                     |
| `a && b`, `a \|\| b`, `! a`              | and, or, not                                                  |

`[ ... ]` (the older `test` command) also works and is POSIX, but it needs more quoting and has no pattern matching. In Bash scripts, prefer `[[ ]]` for strings and files and `(( ))` for numbers.

`case` compares one value against several patterns, which reads better than a long `elif` chain:

```bash
#!/usr/bin/env bash
case "${1:-}" in
    start|up)     echo "starting" ;;
    stop|down)    echo "stopping" ;;
    restart)      echo "restarting" ;;
    status)       echo "running" ;;
    *)            echo "usage: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
```

```terminal
{
  "title": "case",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "chmod +x service.sh && ./service.sh up",
      "output": "starting"
    },
    {
      "cmd": "./service.sh reload; echo \"exit code: $?\"",
      "output": "usage: ./service.sh {start|stop|restart|status}\nexit code: 2"
    }
  ]
}
```

## Loops

```bash
#!/usr/bin/env bash
# over a list of words
for env in dev staging prod; do
    echo "deploying to $env"
done

# over files: the glob keeps names with spaces intact
for page in ~/lab/site/*.html; do
    echo "page: $(basename "$page") ($(wc -c < "$page") bytes)"
done

# over a range, and C-style
for i in {1..3}; do echo -n "$i "; done; echo
for (( i = 10; i > 0; i -= 4 )); do echo -n "$i "; done; echo

# until: retry until something succeeds, with a limit
attempt=1
until [[ -f /tmp/ready ]] || (( attempt > 3 )); do
    echo "waiting for /tmp/ready (attempt $attempt)"
    (( attempt == 2 )) && touch /tmp/ready
    (( attempt++ ))
done

# read a file line by line
while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue    # skip blanks and comments
    echo "server: $line"
done <<'EOF'
# web servers
web-1.example.com

web-2.example.com
EOF
```

```terminal
{
  "title": "for, until and while",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash loops.sh",
      "output": "deploying to dev\ndeploying to staging\ndeploying to prod\npage: about.html (162 bytes)\npage: index.html (221 bytes)\n1 2 3\n10 6 2\nwaiting for /tmp/ready (attempt 1)\nwaiting for /tmp/ready (attempt 2)\nserver: web-1.example.com\nserver: web-2.example.com"
    }
  ]
}
```

Two habits prevent most loop bugs:

- **Loop over globs, not over `ls`.** `for f in *.log` handles every file name; `for f in $(ls *.log)` splits names with spaces.
- **Read lines with `while IFS= read -r line`.** `IFS=` keeps leading spaces and `-r` keeps backslashes. `for line in $(cat file)` loops over words, not lines.

`break` leaves a loop and `continue` jumps to the next round. If a glob matches nothing, Bash passes the pattern itself (`*.log`) to the loop; add `shopt -s nullglob` at the top of the script to get no iterations instead.

## Functions

A function groups commands under a name. It takes arguments like a script (`$1`, `"$@"`) and returns an exit code; to return data, print it and capture the output with `$(...)`.

```bash
#!/usr/bin/env bash

log() {
    # write timestamped messages to standard error, so stdout stays clean
    printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2
}

is_port() {
    local value="$1"                       # local: only visible inside the function
    # digits only and no leading zero: Bash reads 080 as a (broken) octal number
    [[ "$value" =~ ^[1-9][0-9]{0,4}$ ]] && (( value <= 65535 ))
}

file_age_days() {
    local now modified
    now=$(date +%s)
    modified=$(stat -c %Y -- "$1") || return 1
    echo $(( (now - modified) / 86400 ))
}

for p in 8080 70000 080 abc; do
    if is_port "$p"; then log "$p is a valid port"; else log "$p is NOT a valid port"; fi
done
echo "access.log is $(file_age_days ~/lab/logs/access.log) days old"
```

```terminal
{
  "title": "functions",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash functions.sh 2>&1 | sed -E 's/^[0-9:]{8}/HH:MM:SS/'",
      "output": "HH:MM:SS 8080 is a valid port\nHH:MM:SS 70000 is NOT a valid port\nHH:MM:SS 080 is NOT a valid port\nHH:MM:SS abc is NOT a valid port\naccess.log is 0 days old"
    }
  ]
}
```

Declare variables inside functions with `local`; otherwise they change the global variable of the same name. Keep messages for humans on standard error (`>&2`), so a caller can capture the real output with `$(...)` without the noise.

## Arrays and String Operations

```bash
#!/usr/bin/env bash
servers=("web-1" "web-2" "db-1")
servers+=("cache-1")
echo "count: ${#servers[@]}, first: ${servers[0]}, all: ${servers[*]}"

declare -A port=([web]=80 [db]=5432 [cache]=6379)     # associative array (Bash 4+)
for name in web db cache; do echo "$name listens on ${port[$name]}"; done

path="/var/backups/site/site-20261023-0900.tar.gz"
echo "file:      ${path##*/}"        # strip everything up to the last /
echo "directory: ${path%/*}"         # strip from the last / to the end
echo "no suffix: ${path%%.*}"        # strip from the first . to the end
echo "replace:   ${path/site-/www-}"
name="Notes Site"
echo "lower: ${name,,}  upper: ${name^^}  length: ${#name}  slice: ${name:0:5}"
```

```terminal
{
  "title": "arrays and parameter expansion",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash strings.sh",
      "output": "count: 4, first: web-1, all: web-1 web-2 db-1 cache-1\nweb listens on 80\ndb listens on 5432\ncache listens on 6379\nfile:      site-20261023-0900.tar.gz\ndirectory: /var/backups/site\nno suffix: /var/backups/site/site-20261023-0900\nreplace:   /var/backups/site/www-20261023-0900.tar.gz\nlower: notes site  upper: NOTES SITE  length: 10  slice: Notes"
    }
  ]
}
```

These **parameter expansions** run inside Bash, so they are much faster than calling `basename`, `dirname`, `sed` or `tr` in a loop.

## Exit Codes and Error Handling

By default, Bash keeps going after a command fails. For most scripts, that is the wrong default. Start them with **strict mode**:

```bash
set -euo pipefail
```

- `-e`: exit as soon as a command fails (with exceptions: inside `if`, `while`, `&&` and `||` conditions).
- `-u`: treat an unset variable as an error instead of an empty string.
- `-o pipefail`: a pipeline fails if **any** command in it fails, not only the last one.

```bash
#!/usr/bin/env bash
echo "without pipefail:"
grep "pattern" /no/such/file | sort
echo "  pipeline exit code: $?"

set -o pipefail
echo "with pipefail:"
grep "pattern" /no/such/file | sort
echo "  pipeline exit code: $?"

set -eu
echo "with -u, a typo in a variable name stops the script:"
echo "deploying to $DEPLOY_TARGT"
echo "this line never runs"
```

```terminal
{
  "title": "what strict mode changes",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash strict.sh; echo \"script exit code: $?\"",
      "output": "without pipefail:\ngrep: /no/such/file: No such file or directory\n  pipeline exit code: 0\nwith pipefail:\ngrep: /no/such/file: No such file or directory\n  pipeline exit code: 2\nwith -u, a typo in a variable name stops the script:\nstrict.sh: line 13: DEPLOY_TARGT: unbound variable\nscript exit code: 1"
    }
  ]
}
```

`set -e` has surprising corners: a failure inside a function called from an `if` is ignored, and `local var=$(cmd)` hides the exit code of `cmd`. Treat strict mode as a safety net, and still check the commands that matter explicitly. See [what set -e means in a Bash script](/posts/what-does-set-e-mean-in-bash-script) for the details.

To clean up temporary files however a script ends, use `trap` with a temporary directory from `mktemp`:

```bash
#!/usr/bin/env bash
set -euo pipefail

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"; echo "cleaned up $workdir" >&2' EXIT   # runs on any exit

echo "working in $workdir"
cp ~/lab/logs/access.log "$workdir/"
grep -c '" 404 ' "$workdir/access.log"
false                                 # a failing command: set -e exits here
echo "not reached"
```

```terminal
{
  "title": "trap EXIT cleans up even after a failure",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash tmpwork.sh; echo \"exit code: $?\"",
      "output": "working in /tmp/tmp.JPT1BW2j1p\n9\ncleaned up /tmp/tmp.JPT1BW2j1p\nexit code: 1"
    }
  ]
}
```

The `EXIT` trap ran after `false` stopped the script. Use the same pattern to release locks, stop helper processes or print a "failed at step X" message.

## Options With getopts

`getopts` parses short options such as `-v` and `-n 5`, so your script behaves like other Linux commands:

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() { echo "usage: $0 [-v] [-n COUNT] NAME" >&2; exit 2; }

verbose=false
count=1
while getopts ":vn:h" opt; do
    case "$opt" in
        v) verbose=true ;;
        n) count="$OPTARG" ;;
        h) usage ;;
        :) echo "option -$OPTARG needs a value" >&2; usage ;;
        *) echo "unknown option -$OPTARG" >&2; usage ;;
    esac
done
shift $((OPTIND - 1))          # what is left are the positional arguments
(( $# == 1 )) || usage

[[ "$count" =~ ^(0|[1-9][0-9]{0,3})$ ]] || { echo "COUNT must be a whole number from 0 to 9999" >&2; exit 2; }
$verbose && echo "greeting $1, $count time(s)" >&2
for (( i = 1; i <= count; i++ )); do
    echo "Hello, $1"
done
```

```terminal
{
  "title": "parse options",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "chmod +x greet.sh"
    },
    {
      "cmd": "./greet.sh -v -n 2 Alice",
      "output": "greeting Alice, 2 time(s)\nHello, Alice\nHello, Alice"
    },
    {
      "cmd": "./greet.sh -x Alice; echo \"exit code: $?\"",
      "output": "unknown option -x\nusage: ./greet.sh [-v] [-n COUNT] NAME\nexit code: 2"
    },
    {
      "cmd": "./greet.sh -n; echo \"exit code: $?\"",
      "output": "option -n needs a value\nusage: ./greet.sh [-v] [-n COUNT] NAME\nexit code: 2"
    }
  ]
}
```

`getopts` handles only single-letter options. For long options (`--count 5`), loop over `"$@"` with a `case` statement, as the backup script below does. See [parsing command-line arguments in Bash](/posts/parse-command-line-arguments-bash) for more patterns.

## Debugging and Linting

Three tools catch most problems before they bite:

- `bash -n script.sh` checks the syntax without running anything.
- `bash -x script.sh` (or `set -x` inside the script) prints each command, with variables expanded, before it runs.
- **ShellCheck** reads a script and explains likely bugs, from missing quotes to commands that cannot work. Install it with `sudo apt install shellcheck` (Ubuntu 24.04 ships version 0.9.0; the run below uses 0.11.0) or `sudo dnf install ShellCheck`.

```terminal
{
  "title": "trace a script with bash -x",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -x ./greet.sh -n 2 Bob",
      "output": "+ set -euo pipefail\n+ verbose=false\n+ count=1\n+ getopts :vn:h opt\n+ case \"$opt\" in\n+ count=2\n+ getopts :vn:h opt\n+ shift 2\n+ ((  1 == 1  ))\n+ [[ 2 =~ ^(0|[1-9][0-9]{0,3})$ ]]\n+ false\n+ (( i = 1 ))\n+ (( i <= count ))\n+ echo 'Hello, Bob'\nHello, Bob\n+ (( i++  ))\n+ (( i <= count ))\n+ echo 'Hello, Bob'\nHello, Bob\n+ (( i++  ))\n+ (( i <= count ))"
    }
  ]
}
```

Here is a short script with typical mistakes:

```bash
#!/bin/bash
# cleanup.sh: delete old .log files in a directory (buggy on purpose)
dir=$1
cd $dir
for f in $(ls *.log); do
    if [ $f == "keep.log" ]; then continue; fi
    rm $f
done
echo "Deleted logs in $dir"
```

```terminal
{
  "title": "shellcheck finds the bugs",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "shellcheck cleanup.sh",
      "output": "In cleanup.sh line 4:\ncd $dir\n^-----^ SC2164 (warning): Use 'cd ... || exit' or 'cd ... || return' in case cd fails.\n   ^--^ SC2086 (info): Double quote to prevent globbing and word splitting.\n\nDid you mean:\ncd \"$dir\" || exit\n\n\nIn cleanup.sh line 5:\nfor f in $(ls *.log); do\n         ^---------^ SC2045 (error): Iterating over ls output is fragile. Use globs.\n              ^-- SC2035 (info): Use ./*glob* or -- *glob* so names with dashes won't become options.\n\n\nIn cleanup.sh line 6:\n    if [ $f == \"keep.log\" ]; then continue; fi\n         ^-- SC2086 (info): Double quote to prevent globbing and word splitting.\n\nDid you mean:\n    if [ \"$f\" == \"keep.log\" ]; then continue; fi\n\n\nIn cleanup.sh line 7:\n    rm $f\n       ^-- SC2086 (info): Double quote to prevent globbing and word splitting.\n\nDid you mean:\n    rm \"$f\"\n\nFor more information:\n  https://www.shellcheck.net/wiki/SC2045 -- Iterating over ls output is fragi...\n  https://www.shellcheck.net/wiki/SC2164 -- Use 'cd ... || exit' or 'cd ... |...\n  https://www.shellcheck.net/wiki/SC2035 -- Use ./*glob* or -- *glob* so name..."
    }
  ]
}
```

Each warning has a code; `https://www.shellcheck.net/wiki/SC2164` explains SC2164, and so on. The `cd` warning is the dangerous one: if `cd` fails, the loop deletes `.log` files in whatever directory the script happens to be in. Run ShellCheck in your editor and in CI, so every script gets checked before it ships.

## A Complete Script: Back Up the Lab Site

This script puts the pieces together. It archives a directory into a timestamped `.tar.gz`, keeps only the newest N archives, logs what it does, and fails loudly. Part 10 runs it every night with a systemd timer.

```bash
#!/usr/bin/env bash
# backup-site: archive a directory and keep the newest N archives.
# usage: backup-site [--keep N] SOURCE_DIR BACKUP_DIR
set -euo pipefail

keep=7

log() { printf '%s backup-site: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
usage() { echo "usage: ${0##*/} [--keep N] SOURCE_DIR BACKUP_DIR" >&2; exit 2; }

while (( $# > 0 )); do
    case "$1" in
        --keep)
            [[ "${2:-}" =~ ^[1-9][0-9]{0,3}$ ]] || die "--keep needs a number from 1 to 9999"
            keep="$2"; shift 2 ;;
        -h|--help) usage ;;
        -*) die "unknown option: $1" ;;
        *) break ;;
    esac
done
(( $# == 2 )) || usage

# remove trailing slashes, so "site/" and "site//" are treated like "site"
strip_slashes() {
    local path="$1"
    while [[ "$path" == */ && "$path" != / ]]; do path="${path%/}"; done
    printf '%s' "$path"
}
source_dir="$(strip_slashes "$1")"
backup_dir="$(strip_slashes "$2")"
if [[ -L "$source_dir" ]]; then
    die "source is a symlink; give the real directory: $source_dir"
fi
[[ -d "$source_dir" ]] || die "source directory not found: $source_dir"
# a backup directory inside the source would end up in every new archive
source_real="$(realpath -- "$source_dir")"
backup_real="$(realpath -m -- "$backup_dir")"
case "$backup_real/" in
    "$source_real"/*) die "the backup directory must not be inside the source: $backup_dir" ;;
esac
mkdir -p "$backup_dir"

# one run at a time per backup directory
exec 9> "$backup_dir/.backup-site.lock"
flock -n 9 || die "another backup is running in $backup_dir"

name="$(basename "$source_dir")"
archive="$backup_dir/$name-$(date -u +%Y%m%d-%H%M%S).tar.gz"
if [[ -e "$archive" ]]; then
    die "archive already exists, try again in a second: $archive"
fi
partial="$(mktemp "$backup_dir/.$name-XXXXXX.partial")"
trap 'rm -f "$partial"' EXIT          # never leave a half-written archive behind

log "archiving $source_dir to $archive"
tar -czf "$partial" -C "$(dirname "$source_dir")" -- "$name"
mv "$partial" "$archive"
log "created $(du -h "$archive" | cut -f1) archive"

# only archives this script made (NAME-YYYYMMDD-HHMMSS.tar.gz); glob results come oldest first
archives=("$backup_dir/$name"-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9].tar.gz)
excess=$(( ${#archives[@]} - keep ))
for (( i = 0; i < excess; i++ )); do
    rm -f -- "${archives[i]}"
    log "removed old archive ${archives[i]##*/}"
done
log "done, $(( excess > 0 ? keep : ${#archives[@]} )) archive(s) kept"
```

```terminal
{
  "title": "run the backup script",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "shellcheck backup-site && echo \"shellcheck: no warnings\"",
      "output": "shellcheck: no warnings"
    },
    {
      "cmd": "chmod +x backup-site"
    },
    {
      "cmd": "./backup-site ~/lab/site ~/backups",
      "output": "2026-10-23T21:38:15Z backup-site: archiving /home/dev/lab/site to /home/dev/backups/site-20261023-213815.tar.gz\n2026-10-23T21:38:15Z backup-site: created 4.0K archive\n2026-10-23T21:38:15Z backup-site: done, 1 archive(s) kept"
    },
    {
      "cmd": "./backup-site --keep 2 ~/lab/site ~/backups",
      "output": "2026-10-23T21:38:16Z backup-site: archiving /home/dev/lab/site to /home/dev/backups/site-20261023-213816.tar.gz\n2026-10-23T21:38:16Z backup-site: created 4.0K archive\n2026-10-23T21:38:16Z backup-site: done, 2 archive(s) kept"
    },
    {
      "cmd": "./backup-site --keep 2 ~/lab/site ~/backups",
      "output": "2026-10-23T21:38:17Z backup-site: archiving /home/dev/lab/site to /home/dev/backups/site-20261023-213817.tar.gz\n2026-10-23T21:38:17Z backup-site: created 4.0K archive\n2026-10-23T21:38:17Z backup-site: removed old archive site-20261023-213815.tar.gz\n2026-10-23T21:38:17Z backup-site: done, 2 archive(s) kept"
    },
    {
      "cmd": "ls -1 ~/backups",
      "output": "site-20261023-213816.tar.gz\nsite-20261023-213817.tar.gz"
    },
    {
      "comment": "check what is inside the newest archive",
      "cmd": "tar -tzf \"$(ls -1t ~/backups/*.tar.gz | head -n 1)\"",
      "output": "site/\nsite/about.html\nsite/css/\nsite/css/style.css\nsite/images/\nsite/index.html"
    },
    {
      "comment": "errors exit with a non-zero code",
      "cmd": "./backup-site ~/lab/nope ~/backups; echo \"exit code: $?\"",
      "output": "2026-10-23T21:38:17Z backup-site: ERROR: source directory not found: /home/dev/lab/nope\nexit code: 1"
    },
    {
      "cmd": "./backup-site --keep 0 ~/lab/site ~/backups; echo \"exit code: $?\"",
      "output": "2026-10-23T21:38:18Z backup-site: ERROR: --keep needs a number from 1 to 9999\nexit code: 1"
    }
  ]
}
```

Install it for your user so it can be run from anywhere: `mkdir -p ~/.local/bin && cp backup-site ~/.local/bin/`. For a system-wide tool that a service runs, `sudo install -m 0755 backup-site /usr/local/bin/` is the usual place.

A few details are worth copying into your own scripts:

- The archive is written to a uniquely named `.partial` file from `mktemp` and renamed only when `tar` succeeded, so a half-written file never looks like a good backup. The `EXIT` trap removes the partial file on failure.
- `flock` on a lock file lets only one run work in a backup directory at a time, and the script refuses to overwrite an archive with the same name, or to write backups inside the directory it archives.
- A symlink as the source is refused: `tar` would archive the link, not the files behind it. Trailing slashes are removed first, so `site//` cannot slip past that check.
- `--` before the directory name tells `tar` that no options follow, so a directory called `--help` is archived instead of being read as an option. `--keep` is limited to four digits, because Bash arithmetic silently wraps around on huge numbers.
- All messages go to standard error with a UTC timestamp, which reads well in the systemd journal.
- The pruning pattern matches only names this script creates, so another site's `site-assets-...` archives in the same directory are left alone. Better still, give each source its own backup directory. The UTC timestamp in the name sorts in time order, and Bash sorts glob results, so the array is oldest first and needs no `ls` parsing.
- Bad input exits with code 2 (usage) or 1 (error), which systemd and CI tools report as a failure.

## Other Shells

- **Zsh** is the default interactive shell on macOS and popular on Linux with frameworks such as Oh My Zsh. It runs most Bash syntax, with differences: arrays start at index 1 (Bash starts at 0) and unquoted variables are not split on spaces. Scripts still run with whatever their shebang says, so a `#!/usr/bin/env bash` script works the same from Zsh.
- **Fish** has friendly autosuggestions and its own syntax (`set name value`, `end` instead of `done` and `fi`). It is not POSIX-compatible, so keep scripts in Bash even if you use Fish interactively.
- **POSIX sh** (`dash` on Debian and Ubuntu, `ash` in Alpine and BusyBox images) is the lowest common denominator. Write `#!/bin/sh` scripts only when they must run where Bash is missing, for example in minimal container images, and check them with `shellcheck -s sh`.

## When Not to Use a Shell Script

Bash is excellent for gluing commands together. Once a script needs data structures, JSON or HTTP APIs, real error handling or more than a couple of hundred lines, a language such as Python or Go is easier to test and maintain. For configuring many servers the same way, use a configuration tool such as [Ansible](/guides/introduction-to-ansible) instead of SSH loops.

## Common Mistakes

- **Unquoted variables** (`rm $file`). Quote everything: `"$file"`.
- **Spaces around `=`** in assignments.
- **Parsing `ls` output** in loops instead of using globs.
- **`cd` without a check** in a script that deletes files. Use `cd "$dir" || exit 1`, or `set -e`.
- **Running a Bash script with `sh`.**
- **Windows line endings.** A script saved with CRLF fails with `/usr/bin/env: 'bash\r': No such file or directory`. Convert it with `sed -i 's/\r$//' script.sh` or `dos2unix`.
- **Secrets in scripts.** Read them from the environment or a file with restricted permissions, never hard-code them in a file that goes into Git.

## Summary

- Start scripts with `#!/usr/bin/env bash`, make them executable, and add `set -euo pipefail`.
- Quote every variable, use `"$@"` for arguments, and `local` inside functions.
- Use `[[ ]]` for tests, `(( ))` for arithmetic, `case` for many choices, globs for files, and `while IFS= read -r` for lines.
- Return status with exit codes, data with output, and send messages to standard error.
- Clean up with `trap ... EXIT`, debug with `bash -x`, and lint with ShellCheck.

Next: [Linux System Administration Basics](/guides/introduction-to-linux/10-system-administration), where the backup script runs every night as a systemd timer.

## Keep Learning

- [Introduction to Bash guide](/guides/introduction-to-bash), which goes deeper into each topic
- [Check if a variable is set in Bash](/posts/check-if-variable-set-bash)
- [Loop through an array of strings in Bash](/posts/loop-through-array-strings-bash)
- Interview questions: [Bash scripting basics](/interview-questions/junior/bash-scripting-basics) and [shell scripting fundamentals](/interview-questions/junior/shell-scripting-fundamentals)
