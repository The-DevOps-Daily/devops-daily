---
title: 'Bash if, case and Loops: [[ ]] vs [ ], Tests and Loop Pitfalls'
description: 'Bash conditions and loops: if, [ ] versus [[ ]], regex and glob matching, case, for, while, until, select, and the subshell and stdin traps.'
order: 5
---

In most languages, `if` tests a true-or-false value. In Bash, `if` runs a **command** and looks at its exit status: 0 means true, anything else means false. `[`, `[[` and `((` are just commands (or keywords) that happen to exist for testing, and `grep -q`, `command -v` or your own function work just as well as a condition.

This part covers conditions and loops with that model in mind: `if` with any command, the real differences between `[ ]` and `[[ ]]`, glob and regex matching, `case`, every kind of loop, and the two loop traps that cause the most confusing bugs: variables lost in a subshell and commands that swallow the loop's input.

## Prerequisites

- Exit status and pipelines from [Part 2](/guides/introduction-to-bash/02-bash-basics), and variables from [Part 4](/guides/introduction-to-bash/04-bash-variables).
- The practice directory in `~/bash-practice`.

## if Runs a Command

```terminal
{
  "title": "any command can be a condition",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "if grep -q ' 500 ' logs/access.log; then echo \"the log has server errors\"; fi",
      "output": "the log has server errors"
    },
    {
      "cmd": "if ! command -v terraform > /dev/null; then echo \"terraform is not installed\"; fi",
      "output": "terraform is not installed"
    },
    {
      "cmd": "if mkdir -p reports && [[ -w reports ]]; then echo \"reports/ is ready\"; else echo \"cannot use reports/\"; fi",
      "output": "reports/ is ready"
    }
  ]
}
```

Test the command directly instead of checking `$?` afterwards. `cmd; if [ $? -ne 0 ]; then` works, but it is longer, and anything you add between the two lines (a log message, say) silently changes `$?`. ShellCheck flags the indirect form as SC2181.

The full form, with `elif` and `else`:

```bash
if [[ -f "$config" ]]; then
    echo "using $config"
elif [[ -f /etc/notes-api.conf ]]; then
    config=/etc/notes-api.conf
else
    echo "no configuration found" >&2
    exit 1
fi
```

## [ ] Versus [[ ]]

`[` is an ordinary command (a builtin, and also `/usr/bin/[`), so its arguments go through word splitting and globbing like any other command's. `[[` is a **keyword**: Bash parses what is inside it specially, without splitting or globbing variables. That one difference explains every row in this table:

| Behaviour                             | `[ ... ]` (POSIX `test`)                  | `[[ ... ]]` (Bash)                                    |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Unquoted empty or multi-word variable | Syntax error or wrong result              | Works                                                 |
| `<` and `>`                           | Redirections (create files!)              | String comparison                                     |
| Glob pattern match                    | Not available                             | `[[ $s == *.log ]]`                                   |
| Regular expressions                   | Not available                             | `[[ $s =~ ^[0-9]+$ ]]`                                |
| And, or, grouping                     | `[ a ] && [ b ]`; `-a`, `-o` are obsolete | `&&`, `\|\|`, `( )` inside                            |
| Works in POSIX `sh`                   | Yes                                       | No (not in dash; BusyBox `ash` has it in most builds) |

```terminal
{
  "title": "where [ ] goes wrong",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "answer=\"\"; [ $answer = yes ] && echo \"confirmed\"",
      "output": "bash: [: =: unary operator expected"
    },
    {
      "cmd": "file=\"files/monthly report.txt\"; [ -f $file ] && echo \"found\"",
      "output": "bash: [: files/monthly: binary operator expected"
    },
    {
      "comment": "> is a redirection: this creates a file named 9 and returns true",
      "cmd": "[ 10 > 9 ] && echo \"looks true\"; ls -l 9",
      "output": "looks true\n-rw-rw-r-- 1 dev dev 0 Oct 24 06:10 9"
    },
    {
      "cmd": "rm 9"
    },
    {
      "comment": "the same tests with [[ ]]",
      "cmd": "[[ $answer = yes ]] || echo \"not confirmed\"; [[ -f $file ]] && echo \"found\"",
      "output": "not confirmed\nfound"
    }
  ]
}
```

With `[ ]`, quote every variable (`[ "$answer" = yes ]`) and write `-gt` for numbers. In Bash scripts, use `[[ ]]` for strings and files and `(( ))` for numbers, and keep `[ ]` for scripts that must run under `sh`.

One trap remains in `[[ ]]`: `<` and `>` compare strings in dictionary order, not numbers:

```terminal
{
  "title": "strings versus numbers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "[[ 10 < 9 ]] && echo \"as strings, 10 sorts before 9\"",
      "output": "as strings, 10 sorts before 9"
    },
    {
      "cmd": "[[ 10 -lt 9 ]] || echo \"as numbers, 10 is not less than 9\"; (( 10 < 9 )) || echo \"and (( )) agrees\"",
      "output": "as numbers, 10 is not less than 9\nand (( )) agrees"
    }
  ]
}
```

## Glob and Regex Matching

Inside `[[ ]]`, `==` (or `=`) with an **unquoted** right-hand side is a glob pattern match. Quote the right side when you want a literal comparison:

```terminal
{
  "title": "pattern match with ==",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "f=\"access.log.2.gz\"; [[ $f == *.gz ]] && echo \"compressed\"",
      "output": "compressed"
    },
    {
      "cmd": "pat=\"*.gz\"; [[ $f == $pat ]] && echo \"unquoted variable: pattern\"; [[ $f == \"$pat\" ]] || echo \"quoted variable: literal text\"",
      "output": "unquoted variable: pattern\nquoted variable: literal text"
    },
    {
      "cmd": "[[ $f == access.log.[0-9]* ]] && echo \"a rotated access log\"",
      "output": "a rotated access log"
    }
  ]
}
```

`=~` matches an **extended regular expression**. Store the regex in a variable: quoting it inside `[[ ]]` would make it literal, and special characters in an inline regex are hard to get right. Capture groups end up in the `BASH_REMATCH` array:

```bash
#!/usr/bin/env bash
# parse-line.sh: pull fields out of access log lines with a regex
re='^([0-9.]+) [^"]*"([A-Z]+) ([^ ]+) [^"]*" ([0-9]{3}) ([0-9]+)'

while IFS= read -r line; do
    if [[ $line =~ $re ]]; then
        printf 'ip=%-14s method=%-4s path=%-18s status=%s bytes=%s\n' \
            "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" \
            "${BASH_REMATCH[4]}" "${BASH_REMATCH[5]}"
    else
        echo "no match: $line" >&2
    fi
done < <(head -n 4 logs/access.log; echo "garbage line")
```

```terminal
{
  "title": "BASH_REMATCH holds the groups",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash parse-line.sh",
      "output": "ip=203.0.113.10   method=GET  path=/                  status=200 bytes=612\nip=198.51.100.23  method=GET  path=/wp-login.php      status=404 bytes=162\nip=198.51.100.5   method=GET  path=/api/users         status=200 bytes=734\nip=203.0.113.10   method=GET  path=/about.html        status=200 bytes=418\nno match: garbage line"
    }
  ]
}
```

`BASH_REMATCH[0]` is the whole match and `[1]` onwards are the groups. Bash uses the system's POSIX regex library, so there is no `\d`, no lazy `*?` and no lookahead; write `[0-9]` and `[^"]*` instead. An invalid regex makes the test return status 2. Bash 5.2 fails silently, which is easy to mistake for "no match"; Bash 5.3 also prints an error:

```terminal
{
  "title": "a broken regex in Bash 5.2.21",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "re='(unclosed'; [[ \"text\" =~ $re ]]; echo \"exit status: $?\"",
      "output": "exit status: 2"
    }
  ]
}
```

```terminal
{
  "title": "the same line in Bash 5.3.9",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "re='(unclosed'; [[ \"text\" =~ $re ]]; echo \"exit status: $?\"",
      "output": "bash: [[: invalid regular expression `(unclosed': Unmatched ( or \\(\nexit status: 2"
    }
  ]
}
```

## Arithmetic Conditions

`(( ))` is the clearest way to compare numbers, and it accepts C-style operators (`==`, `!=`, `<`, `>=`, `&&`, `||`, `%`):

```bash
if (( attempts >= max_attempts )); then echo "giving up" >&2; exit 1; fi
(( port % 2 == 0 )) && echo "even port"
```

Only use it on values you have validated as numbers. Arithmetic evaluates names and array subscripts recursively, so a string from outside the script can run commands:

```terminal
{
  "title": "never do arithmetic on unvalidated input",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "input='x[$(echo \"this ran a command\" >&2)]'; (( input > 5 )) && echo \"big\"",
      "output": "this ran a command"
    },
    {
      "cmd": "if [[ $input =~ ^[0-9]+$ ]] && (( input > 5 )); then echo \"big\"; else echo \"rejected: not a number\"; fi",
      "output": "rejected: not a number"
    }
  ]
}
```

The same applies to `[[ $input -gt 5 ]]`, `$(( input ))` and `declare -i`. [Part 8](/guides/introduction-to-bash/08-command-line-arguments) has validation functions for numbers, ports and IP addresses.

## case

`case` compares one value against glob patterns, top to bottom, and runs the first match. It is clearer than a chain of `elif` and works on every shell:

```bash
#!/usr/bin/env bash
# classify.sh: describe HTTP status codes given as arguments
for code in "$@"; do
    case "$code" in
        *[!0-9]* | "") echo "$code: not a number" ;;      # checked first, so ? below means a digit
        2??)        echo "$code: success" ;;
        301 | 302)  echo "$code: redirect" ;;
        3??)        echo "$code: other redirection" ;;
        404)        echo "$code: not found" ;&       # ;& falls through into the next block
        4??)        echo "$code: client error" ;;
        5??)        echo "$code: server error" ;;
        *)          echo "$code: unknown" ;;
    esac
done
```

```terminal
{
  "title": "case with patterns and fall-through",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash classify.sh 200 302 404 418 503 abc 99",
      "output": "200: success\n302: redirect\n404: not found\n404: client error\n418: client error\n503: server error\nabc: not a number\n99: unknown"
    }
  ]
}
```

Each block ends with `;;`. Bash also has `;&`, which runs the next block without testing its pattern (used above for 404), and `;;&`, which goes on testing the remaining patterns. Both need Bash 4.0+. `shopt -s nocasematch` makes `case` and `[[ == ]]` ignore case.

## for Loops

```terminal
{
  "title": "the forms of for",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "for env in dev staging prod; do printf '%s ' \"deploy-$env\"; done; echo",
      "output": "deploy-dev deploy-staging deploy-prod"
    },
    {
      "cmd": "for f in logs/*.log; do printf '%s has %s lines\\n' \"$f\" \"$(wc -l < \"$f\")\"; done",
      "output": "logs/access.log has 40 lines\nlogs/app.log has 6 lines"
    },
    {
      "cmd": "for i in {1..5}; do printf '%s ' \"$i\"; done; for i in {10..0..5}; do printf '%s ' \"$i\"; done; echo",
      "output": "1 2 3 4 5 10 5 0"
    },
    {
      "cmd": "n=4; for (( i = 1; i <= n; i++ )); do printf '%s ' \"$(( i * i ))\"; done; echo",
      "output": "1 4 9 16"
    }
  ]
}
```

`for name; do` without `in` loops over the script's arguments, the same as `for name in "$@"`. Ranges with variables need the C-style form or `seq`, because brace expansion happens before variables are expanded ([Part 2](/guides/introduction-to-bash/02-bash-basics)).

Do not loop over `$(cat file)`: that loops over words, not lines.

```terminal
{
  "title": "words are not lines",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "for line in $(cat servers.txt); do echo \"[$line]\"; done",
      "output": "[#]\n[web]\n[tier]\n[web-1.example.com]\n[web-2.example.com]\n[#]\n[database]\n[db-1.example.com]"
    },
    {
      "cmd": "while IFS= read -r line; do [[ -z $line || $line == \\#* ]] && continue; echo \"[$line]\"; done < servers.txt",
      "output": "[web-1.example.com]\n[web-2.example.com]\n[db-1.example.com]"
    }
  ]
}
```

## while and until

`while` repeats as long as its condition command succeeds, and `until` as long as it fails. A typical use in deployment scripts is waiting for something to become ready, with a time limit:

```bash
#!/usr/bin/env bash
# wait-for-port.sh HOST PORT [SECONDS]: wait until a TCP port accepts connections
if (($# < 2)) || [[ ! $2 =~ ^[1-9][0-9]{0,4}$ || ! ${3:-10} =~ ^[1-9][0-9]{0,3}$ ]] || (($2 > 65535)); then
    echo "usage: wait-for-port.sh HOST PORT [SECONDS]" >&2
    exit 2
fi
host=$1 port=$2 limit=${3:-10}

SECONDS=0
# Bash opens a TCP connection when you redirect to /dev/tcp/HOST/PORT.
# timeout stops an attempt that hangs, for example behind a firewall that drops packets.
# shellcheck disable=SC2016 # $1 and $2 belong to the inner bash, so single quotes are right
until timeout 1 bash -c 'exec 3<>"/dev/tcp/$1/$2"' _ "$host" "$port" 2>/dev/null; do
    if ((SECONDS >= limit)); then
        echo "$host:$port is still closed after ${limit}s" >&2
        exit 1
    fi
    sleep 0.5
done
echo "$host:$port is open after ${SECONDS}s"
```

The demo below starts a listener with `nc`, which the `netcat-openbsd` package provides on Debian and Ubuntu:

```terminal
{
  "title": "wait for a service to start",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash wait-for-port.sh 127.0.0.1 8080 2; echo \"exit code: $?\"",
      "output": "127.0.0.1:8080 is still closed after 2s\nexit code: 1"
    },
    {
      "comment": "start a listener in 3 seconds, in the background",
      "cmd": "( sleep 3; nc -l 127.0.0.1 8080 > /dev/null ) & bash wait-for-port.sh 127.0.0.1 8080 10",
      "output": "127.0.0.1:8080 is open after 3s"
    },
    {
      "cmd": "wait $!"
    }
  ]
}
```

`/dev/tcp/HOST/PORT` is not a real file: Bash itself opens a TCP connection when you redirect to such a path (it can be disabled at compile time, and BusyBox `ash` and dash do not have it). The script validates its arguments before using them in arithmetic, and runs each attempt under `timeout 1`, because a connection to a host that silently drops packets can hang for minutes. The host and port reach the inner `bash -c` as arguments, not pasted into the command string. Container entrypoints often use this pattern to wait for a database before starting an application; where they exist, dedicated checks such as `pg_isready` or `curl --fail` give clearer errors.

`while true; do ... done` (or `while :`) loops until a `break`. `break 2` and `continue 2` act on the second enclosing loop when loops are nested.

## select Menus

`select` prints a numbered menu on standard error, reads a choice from standard input, and puts the chosen word in a variable. It loops until you `break`:

```bash
#!/usr/bin/env bash
# menu.sh: pick an environment from a numbered list
PS3="Deploy to which environment? "
select env in staging production quit; do
    case "$env" in
        staging | production) echo "deploying to $env"; break ;;
        quit) echo "cancelled"; break ;;
        *) echo "invalid choice: $REPLY" ;;
    esac
done
```

```terminal
{
  "title": "select reads choices from standard input",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '7\\n1\\n' | bash menu.sh",
      "output": "1) staging\n2) production\n3) quit\nDeploy to which environment? invalid choice: 7\nDeploy to which environment? deploying to staging"
    }
  ]
}
```

The input `7` was not on the menu, so `env` was empty and `$REPLY` held the raw answer; `1` then picked `staging`. Menus are fine for scripts that people run by hand. Anything that also runs in CI should take the choice as an argument ([Part 8](/guides/introduction-to-bash/08-command-line-arguments)).

## Loops and Subshells: The Lost Variable

Each command in a pipeline runs in its own subshell. When a loop is on the right side of a pipe, its variables vanish when the pipeline ends:

```terminal
{
  "title": "a counter that stays at 0",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "errors=0; grep ' 404 ' logs/access.log | while IFS= read -r line; do errors=$(( errors + 1 )); done; echo \"404 lines: $errors\"",
      "output": "404 lines: 0"
    },
    {
      "comment": "fix 1: feed the loop with process substitution, so it runs in this shell",
      "cmd": "errors=0; while IFS= read -r line; do errors=$(( errors + 1 )); done < <(grep ' 404 ' logs/access.log); echo \"404 lines: $errors\"",
      "output": "404 lines: 8"
    },
    {
      "comment": "fix 2: lastpipe runs the last command of a pipeline in this shell (scripts only)",
      "cmd": "bash -c 'shopt -s lastpipe; errors=0; grep \" 404 \" logs/access.log | while IFS= read -r l; do errors=$(( errors + 1 )); done; echo \"404 lines: $errors\"'",
      "output": "404 lines: 8"
    }
  ]
}
```

Process substitution (`< <(command)`) is the usual fix. `lastpipe` needs Bash 4.2+ and only works when job control is off, which is the default in scripts but not in an interactive terminal. And for a plain count, `grep -c ' 404 ' logs/access.log` needs no loop at all.

## Commands That Swallow the Loop's Input

In `while read ... done < file`, every command inside the loop shares the loop's standard input. A command that reads standard input takes the rest of the file, and the loop ends early. `ssh` is the classic culprit: `while read host; do ssh "$host" uptime; done < hosts` connects to the first host only. Here `cat > /dev/null` stands in for `ssh`:

```terminal
{
  "title": "the loop stops after one line",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "grep -v -e '^#' -e '^$' servers.txt > hosts.txt"
    },
    {
      "cmd": "while IFS= read -r host; do echo \"checking $host\"; cat > /dev/null; done < hosts.txt",
      "output": "checking web-1.example.com"
    },
    {
      "comment": "fix: read the list from file descriptor 3, leaving stdin alone",
      "cmd": "while IFS= read -r -u 3 host; do echo \"checking $host\"; cat > /dev/null; done 3< hosts.txt < /dev/null",
      "output": "checking web-1.example.com\nchecking web-2.example.com\nchecking db-1.example.com"
    }
  ]
}
```

Reading the list from another file descriptor (`read -u 3 ... 3< file`) keeps standard input free. For `ssh` specifically, `ssh -n` (or `< /dev/null` on the command) also works.

## Common Mistakes

- **`if [ $? -eq 0 ]` after a command.** Put the command in the `if`.
- **Unquoted variables in `[ ]`**, and `<` or `>` in `[ ]`. Use `[[ ]]`, or quote everything and use `-lt` and `-gt`.
- **Comparing numbers with `<` in `[[ ]]`.** It compares strings; use `(( ))` or `-lt`.
- **A quoted regex after `=~`.** It becomes a literal string. Put the regex in a variable.
- **Arithmetic on input you have not validated.** It can run commands.
- **`for line in $(cat file)`.** Use `while IFS= read -r line`.
- **A loop at the end of a pipe that sets variables.** Use `done < <(command)`.
- **`ssh` or other stdin readers inside a `while read` loop.** Use `read -u 3` or `ssh -n`.

## Summary

- `if`, `while` and `until` run commands and test the exit status.
- In Bash, prefer `[[ ]]` for strings, files, patterns and regexes, and `(( ))` for numbers; keep `[ ]` for `sh` scripts.
- `=~` puts capture groups in `BASH_REMATCH`; keep the regex in a variable.
- `case` matches glob patterns; `;&` and `;;&` change what happens after a match.
- Loop over globs, `while IFS= read -r` lines and C-style ranges, never over `$(cat)` or `$(ls)`.
- Pipelines run loops in subshells, and loop bodies share the loop's standard input: plan for both.

Next: [Functions](/guides/introduction-to-bash/06-functions), where scope, return values and libraries come in.

## Keep Learning

- [Check if a string contains a substring](/posts/check-string-contains-substring-bash)
- [Loop over a range of numbers stored in variables](/posts/bash-iterate-number-range-variables)
- [Read a file line by line](/posts/bash-loop-through-file-content)
- Interview questions: [Shell scripting fundamentals](/interview-questions/junior/shell-scripting-fundamentals)
