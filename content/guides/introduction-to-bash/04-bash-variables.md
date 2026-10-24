---
title: 'Bash Variables: Parameter Expansion, Arithmetic and Arrays'
description: 'Bash variables in depth: unset versus empty, default values, parameter expansion, arithmetic traps, special variables, arrays and associative arrays.'
order: 4
---

Bash has one data type: the string. A variable holds text, Bash's arithmetic reads that text as an integer when you ask it to, and arrays are lists or maps of strings. That simplicity makes variables easy to start with and easy to misuse: an empty value and a missing one look the same, `08` is not a valid number, and an unquoted variable can turn into several arguments.

This part goes through variables in depth: assignment and scope, the difference between unset and empty, default values, the parameter expansions that replace `sed` and `basename` for most string work, arithmetic, special variables, indexed and associative arrays, and reading input with `read`.

## Prerequisites

- [Part 2](/guides/introduction-to-bash/02-bash-basics), especially quoting and the expansion order.
- The practice directory in `~/bash-practice`.

The [Linux guide's scripting part](/guides/introduction-to-linux/09-shell-scripting) introduces variables, quoting and `export` briefly; this part assumes you have seen a variable before.

## Assign, Inspect and Scope

Assignment is `name=value` with no spaces around `=`. Names use letters, digits and underscores and cannot start with a digit. By convention, environment variables and constants are `UPPER_CASE`; use `lower_case` for your own variables so you do not overwrite something like `PATH` or `HOME` by accident.

```terminal
{
  "title": "assign and inspect",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "app=\"notes api\"; port=8080; empty=\"\""
    },
    {
      "comment": "declare -p shows a variable exactly, quotes and attributes included",
      "cmd": "declare -p app port empty",
      "output": "declare -- app=\"notes api\"\ndeclare -- port=\"8080\"\ndeclare -- empty=\"\""
    },
    {
      "cmd": "readonly release=\"2026.10\"; release=\"2026.11\"",
      "output": "bash: release: readonly variable"
    },
    {
      "cmd": "unset port; declare -p port",
      "output": "bash: declare: port: not found"
    }
  ]
}
```

Variables are local to the current shell until you **export** them. Child processes get a copy of the exported ones, and nothing a child does can change the parent's variables:

```terminal
{
  "title": "export and scope",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "region=\"eu-west\"; bash -c 'echo \"child sees region=[$region]\"'",
      "output": "child sees region=[]"
    },
    {
      "cmd": "export region; bash -c 'echo \"child sees region=[$region]\"; region=changed'; echo \"parent still has region=$region\"",
      "output": "child sees region=[eu-west]\nparent still has region=eu-west"
    },
    {
      "comment": "a prefix assignment exports a variable to one command only",
      "cmd": "LOG_LEVEL=debug bash -c 'echo \"child sees LOG_LEVEL=$LOG_LEVEL\"'; echo \"this shell: [${LOG_LEVEL-unset}]\"",
      "output": "child sees LOG_LEVEL=debug\nthis shell: [unset]"
    }
  ]
}
```

Note that a script cannot set variables in the shell that started it. To load settings into your current shell, `source` a file instead of running it ([Part 7](/guides/introduction-to-bash/07-script-permissions)).

## Unset, Empty and Default Values

A variable can be **unset** (it does not exist), **empty** (it exists and holds no text), or **set** to a value. Plain `$name` shows nothing in both of the first two cases. The default-value expansions tell them apart, and the colon decides whether "empty" counts as missing:

```terminal
{
  "title": "the same four expansions with v unset, empty and set",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "unset v; echo \"unset:  [${v-def}] [${v:-def}] [${v+alt}] [${v:+alt}]\"",
      "output": "unset:  [def] [def] [] []"
    },
    {
      "cmd": "v=\"\";    echo \"empty:  [${v-def}] [${v:-def}] [${v+alt}] [${v:+alt}]\"",
      "output": "empty:  [] [def] [alt] []"
    },
    {
      "cmd": "v=value; echo \"set:    [${v-def}] [${v:-def}] [${v+alt}] [${v:+alt}]\"",
      "output": "set:    [value] [value] [alt] [alt]"
    }
  ]
}
```

| Expansion       | Result                                                  |
| --------------- | ------------------------------------------------------- |
| `${v:-default}` | `default` if `v` is unset or empty, else `$v`           |
| `${v-default}`  | `default` only if `v` is unset                          |
| `${v:=default}` | Like `:-`, and also assigns `default` to `v`            |
| `${v:?message}` | Exit the script with `message` if `v` is unset or empty |
| `${v:+alt}`     | `alt` if `v` is set and not empty, else nothing         |

`${v:?}` is the right tool for values a script cannot work without, and `${v:+...}` builds optional arguments:

```bash
#!/usr/bin/env bash
# deploy.sh: refuse to run without a target
target="${TARGET:?set TARGET to staging or production}"
echo "deploying to $target"
```

```terminal
{
  "title": "required values and optional arguments",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash deploy.sh; echo \"exit code: $?\"",
      "output": "deploy.sh: line 3: TARGET: set TARGET to staging or production\nexit code: 1"
    },
    {
      "cmd": "TARGET=staging bash deploy.sh",
      "output": "deploying to staging"
    },
    {
      "cmd": "verbose=1; echo curl ${verbose:+--verbose} https://example.com",
      "output": "curl --verbose https://example.com"
    },
    {
      "cmd": "verbose=\"\"; echo curl ${verbose:+--verbose} https://example.com",
      "output": "curl https://example.com"
    }
  ]
}
```

The second example leaves `${verbose:+--verbose}` unquoted on purpose: when it is empty, it should disappear instead of becoming an empty argument.

To test whether a variable is set at all, use `[[ -v name ]]` (Bash 4.2+). It works under `set -u`, where reading an unset variable is an error:

```terminal
{
  "title": "is it set?",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "unset token; if [[ -v token ]]; then echo \"set\"; else echo \"token is not set\"; fi",
      "output": "token is not set"
    },
    {
      "cmd": "token=\"\"; [[ -v token ]] && echo \"token is set (but empty)\"",
      "output": "token is set (but empty)"
    },
    {
      "cmd": "[[ -n \"${token:-}\" ]] || echo \"token is empty or unset\"",
      "output": "token is empty or unset"
    }
  ]
}
```

More patterns are in [check if a variable is set in Bash](/posts/check-if-variable-set-bash).

## Parameter Expansion for Strings

Parameter expansion does most string work inside Bash, without starting `sed`, `cut`, `basename` or `tr`. That is shorter and, in a loop, many times faster ([Part 9](/guides/introduction-to-bash/09-bash-tools) measures it).

```terminal
{
  "title": "length, substrings and trimming",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "path=\"/var/log/nginx/access.log.2.gz\""
    },
    {
      "cmd": "echo \"length: ${#path}, first 8: ${path:0:8}, last 5: ${path: -5}\"",
      "output": "length: 30, first 8: /var/log, last 5: .2.gz"
    },
    {
      "comment": "# and ## remove from the front, % and %% from the back; double = longest match",
      "cmd": "echo \"file: ${path##*/}\"; echo \"dir: ${path%/*}\"",
      "output": "file: access.log.2.gz\ndir: /var/log/nginx"
    },
    {
      "cmd": "echo \"first extension: ${path#*.}\"; echo \"last extension: ${path##*.}\"",
      "output": "first extension: log.2.gz\nlast extension: gz"
    },
    {
      "cmd": "echo \"without .gz: ${path%.gz}\"; echo \"without all extensions: ${path%%.*}\"",
      "output": "without .gz: /var/log/nginx/access.log.2\nwithout all extensions: /var/log/nginx/access"
    }
  ]
}
```

The memory aid: `#` is to the left of `$` on a US keyboard and removes from the left, `%` is to the right and removes from the right. A space is needed in `${path: -5}`; `${path:-5}` would be the default-value expansion.

Replacement and case conversion:

```terminal
{
  "title": "replace and change case",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "s=\"web-1,web-2,db-1\""
    },
    {
      "cmd": "echo \"${s/,/ }\"; echo \"${s//,/ }\"",
      "output": "web-1 web-2,db-1\nweb-1 web-2 db-1"
    },
    {
      "comment": "/# anchors at the start, /% at the end",
      "cmd": "echo \"${s/#web/srv}\"; echo \"${s/%1/one}\"",
      "output": "srv-1,web-2,db-1\nweb-1,web-2,db-one"
    },
    {
      "cmd": "name=\"Notes API\"; echo \"${name,,} ${name^^} ${name,}\"",
      "output": "notes api NOTES API notes API"
    },
    {
      "comment": "the @ transformations (Bash 4.4+; U, u and L need 5.1+)",
      "cmd": "echo \"${name@U} ${name@L}\"; msg=$'two\\nlines'; echo \"${msg@Q}\"",
      "output": "NOTES API notes api\n$'two\\nlines'"
    }
  ]
}
```

`${var@Q}` quotes a value so it can be read back by Bash, which is useful for log messages that must show hidden characters. See [convert a string to lowercase](/posts/convert-string-to-lowercase-in-bash), [check if a string contains a substring](/posts/check-string-contains-substring-bash) and [concatenate strings](/posts/concatenate-string-variables-bash) for more.

### The & Change in Bash 5.2

Bash 5.2 turned on a new option, `patsub_replacement`: a `&` in the replacement text of `${var/pattern/replacement}` now stands for the matched text, as in `sed`. Scripts written for older versions that put a literal `&` in a replacement changed behaviour:

```terminal
{
  "title": "the same line in Bash 5.2 and 3.2",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "s=\"tom and jerry\"; echo \"${s/ and / & }\"",
      "output": "tom  and  jerry"
    },
    {
      "cmd": "/opt/bash-3.2/bin/bash -c 's=\"tom and jerry\"; echo \"${s/ and / & }\"'",
      "output": "tom & jerry"
    },
    {
      "comment": "turn the option off to get the old behaviour",
      "cmd": "shopt -u patsub_replacement; echo \"${s/ and / & }\"",
      "output": "tom & jerry"
    },
    {
      "cmd": "shopt -s patsub_replacement"
    }
  ]
}
```

Bash 5.2 replaced the match (the word `and` with its spaces) with a space, the match itself and another space, so the `&` vanished and the word stayed. A backslash fixes it in 5.2 (`"${s/ and / \& }"`), but inside double quotes older versions print the backslash too. For a script that must behave the same on every version, put `shopt -u patsub_replacement 2>/dev/null || true` near the top; older Bash versions do not know the option, hence the `2>/dev/null || true`.

### Indirect References

`${!name}` expands the variable whose name is stored in `name`, and `${!prefix@}` lists variable names that start with `prefix`:

```terminal
{
  "title": "indirection",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "APP_NAME=\"notes\"; APP_PORT=8080; key=APP_PORT; echo \"$key=${!key}\"",
      "output": "APP_PORT=8080"
    },
    {
      "cmd": "for v in \"${!APP_@}\"; do echo \"$v=${!v}\"; done",
      "output": "APP_NAME=notes\nAPP_PORT=8080"
    }
  ]
}
```

For anything more than reading a value, namerefs (`declare -n`, in [Part 6](/guides/introduction-to-bash/06-functions)) are clearer.

## Variable Attributes With declare

`declare` (and `local` inside functions) can attach attributes to a variable:

| Option      | Effect                                                         |
| ----------- | -------------------------------------------------------------- |
| `-r`        | Read-only (the same as `readonly`)                             |
| `-x`        | Exported (the same as `export`)                                |
| `-i`        | Integer: every assignment is evaluated as arithmetic           |
| `-l` / `-u` | Convert the value to lowercase / uppercase on every assignment |
| `-a` / `-A` | Indexed array / associative array                              |
| `-n`        | Nameref: the variable is another name for a different variable |
| `-g`        | Inside a function: create a global variable                    |

```terminal
{
  "title": "attributes change assignments",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "declare -i total=10; total+=5; total=\"total * 2\"; echo \"$total\"",
      "output": "30"
    },
    {
      "comment": "a typo in an integer variable silently becomes 0",
      "cmd": "total=abc; echo \"$total\"",
      "output": "0"
    },
    {
      "cmd": "declare -l env=\"PRODUCTION\"; echo \"$env\"",
      "output": "production"
    }
  ]
}
```

`declare -i` looks convenient but hides errors: `abc` is read as the name of an unset variable, which is 0. Prefer plain variables with explicit `$(( ))` arithmetic and validate input instead ([Part 8](/guides/introduction-to-bash/08-command-line-arguments)).

## Arithmetic

Bash does **64-bit integer** arithmetic in `$(( ))`, which expands to the result, and `(( ))`, a command whose exit status is 0 when the result is non-zero. Inside both, you can use variable names without `$`.

```terminal
{
  "title": "integer arithmetic",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "a=17; b=5; echo \"$(( a + b )) $(( a - b )) $(( a * b )) $(( a / b )) $(( a % b )) $(( a ** 2 ))\"",
      "output": "22 12 85 3 2 289"
    },
    {
      "cmd": "(( a > b )) && echo \"$a is greater than $b\"",
      "output": "17 is greater than 5"
    },
    {
      "comment": "bases: 16#, 8#, 2#, and the ternary operator",
      "cmd": "echo \"$(( 16#ff )) $(( 2#1010 )) $(( a > 10 ? 1 : 0 ))\"",
      "output": "255 10 1"
    },
    {
      "comment": "no fractions, and big numbers wrap around silently",
      "cmd": "echo \"$(( 7 / 2 )) $(( 2 ** 63 ))\"",
      "output": "3 -9223372036854775808"
    },
    {
      "comment": "use awk for floating point",
      "cmd": "awk -v a=7 -v b=2 'BEGIN { printf \"%.2f\\n\", a / b }'",
      "output": "3.50"
    }
  ]
}
```

Two traps catch everyone eventually.

**Leading zeros mean octal.** Values taken from dates, times or file names often have them:

```terminal
{
  "title": "08 is not a number",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "month=\"08\"; echo $(( month + 1 ))",
      "output": "bash: 08: value too great for base (error token is \"08\")"
    },
    {
      "comment": "10# forces base 10",
      "cmd": "echo $(( 10#$month + 1 ))",
      "output": "9"
    }
  ]
}
```

**`(( ))` returns failure when the result is 0.** `(( count++ ))` evaluates to the old value of `count`, so the first increment from 0 "fails", and a script with `set -e` stops there:

```terminal
{
  "title": "(( count++ )) under set -e",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -ec 'count=0; (( count++ )); echo \"reached with count=$count\"'; echo \"exit code: $?\"",
      "output": "exit code: 1"
    },
    {
      "cmd": "bash -ec 'count=0; count=$(( count + 1 )); echo \"reached with count=$count\"'",
      "output": "reached with count=1"
    }
  ]
}
```

Write `count=$(( count + 1 ))` instead. `(( ++count ))` happens to work when counting up from 0, but any `(( ))` whose result is 0 fails the same way, for example `(( remaining -= 1 ))` reaching zero. The assignment form never fails. [Part 10](/guides/introduction-to-bash/10-bash-best-practices) collects the other `set -e` surprises.

`let "x = 1 + 2"` and `expr 1 + 2` are older ways to do arithmetic, and `$[ 1 + 2 ]` is a deprecated form that still works. Use `$(( ))` and `(( ))` in new scripts.

## Special Variables

| Variable                          | Contains                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `$?`                              | Exit status of the last command                                                              |
| `$$`                              | Process ID of the shell (in a subshell, still the parent's PID)                              |
| `$BASHPID`                        | Process ID of the current Bash process, subshells included                                   |
| `$!`                              | Process ID of the last background job                                                        |
| `$0`, `$1` ... `$#`, `$@`         | Script name and arguments ([Part 8](/guides/introduction-to-bash/08-command-line-arguments)) |
| `$RANDOM`                         | A number from 0 to 32767; not for passwords or tokens                                        |
| `$SRANDOM`                        | A 32-bit number from the system's random generator (Bash 5.1+)                               |
| `$SECONDS`                        | Seconds since the shell started; assign 0 to start a timer                                   |
| `$EPOCHSECONDS`, `$EPOCHREALTIME` | Unix time, in seconds and with microseconds (Bash 5.0+)                                      |
| `$LINENO`                         | The current line number in the script                                                        |
| `$PIPESTATUS`                     | An array with the exit status of each command in the last pipeline                           |
| `$HOSTNAME`, `$PWD`, `$OLDPWD`    | The host name, the current and the previous directory                                        |

```terminal
{
  "title": "a few special variables",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "[[ $$ == \"$BASHPID\" ]] && echo \"main shell: \\$\\$ and BASHPID are equal\"",
      "output": "main shell: $$ and BASHPID are equal"
    },
    {
      "cmd": "( [[ $$ != \"$BASHPID\" ]] && echo \"subshell: \\$\\$ is still the parent's PID, BASHPID is the subshell's\" )",
      "output": "subshell: $$ is still the parent's PID, BASHPID is the subshell's"
    },
    {
      "cmd": "SECONDS=0; sleep 2; echo \"that took $SECONDS seconds\"",
      "output": "that took 2 seconds"
    },
    {
      "cmd": "printf 'epoch: %s, as a date: %(%Y-%m-%d)T\\n' \"$EPOCHSECONDS\" \"$EPOCHSECONDS\"",
      "output": "epoch: 1792822230, as a date: 2026-10-24"
    }
  ]
}
```

`printf '%(...)T'` formats a time with `strftime` codes inside Bash, so you do not need to call `date` in a loop. See [get the current time in seconds since the epoch](/posts/get-current-time-seconds-since-epoch-bash) and [format a date as YYYY-MM-DD](/posts/format-date-yyyy-mm-dd-in-shell-script).

## Indexed Arrays

An array holds a list of strings, indexed from 0. Arrays are the right way to keep file names, command arguments or any list whose items may contain spaces.

```terminal
{
  "title": "indexed arrays",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "servers=(web-1 web-2 \"db 1\"); servers+=(cache-1)"
    },
    {
      "cmd": "echo \"count: ${#servers[@]}, first: ${servers[0]}, last: ${servers[-1]}\"",
      "output": "count: 4, first: web-1, last: cache-1"
    },
    {
      "cmd": "printf '[%s]\\n' \"${servers[@]}\"",
      "output": "[web-1]\n[web-2]\n[db 1]\n[cache-1]"
    },
    {
      "comment": "a slice: 2 elements starting at index 1",
      "cmd": "echo \"${servers[@]:1:2}\"",
      "output": "web-2 db 1"
    },
    {
      "comment": "* joins the elements with the first character of IFS",
      "cmd": "(IFS=,; echo \"${servers[*]}\")",
      "output": "web-1,web-2,db 1,cache-1"
    },
    {
      "cmd": "declare -p servers",
      "output": "declare -a servers=([0]=\"web-1\" [1]=\"web-2\" [2]=\"db 1\" [3]=\"cache-1\")"
    }
  ]
}
```

Always write `"${servers[@]}"` with the quotes: it expands to one word per element, so `"db 1"` stays one item. `"${servers[*]}"` joins everything into one string, which is only useful for display.

Removing an element with `unset` leaves a gap; the other indices do not move:

```terminal
{
  "title": "arrays can be sparse",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "unset 'servers[1]'; declare -p servers",
      "output": "declare -a servers=([0]=\"web-1\" [2]=\"db 1\" [3]=\"cache-1\")"
    },
    {
      "cmd": "echo \"count: ${#servers[@]}, indices: ${!servers[*]}\"",
      "output": "count: 3, indices: 0 2 3"
    },
    {
      "comment": "loop over the indices when you need them",
      "cmd": "for i in \"${!servers[@]}\"; do echo \"$i: ${servers[i]}\"; done",
      "output": "0: web-1\n2: db 1\n3: cache-1"
    },
    {
      "comment": "re-pack the array to close the gaps",
      "cmd": "servers=(\"${servers[@]}\"); declare -p servers",
      "output": "declare -a servers=([0]=\"web-1\" [1]=\"db 1\" [2]=\"cache-1\")"
    }
  ]
}
```

Quote the argument to `unset` (`'servers[1]'`): unquoted, `servers[1]` is a glob that matches a file called `servers1` if one exists. Two more classic slips: `$servers` is only the first element, and `$servers[1]` is the first element followed by the text `[1]`. Always use braces with arrays.

## Associative Arrays

An **associative array** maps string keys to values (Bash 4.0+). It must be declared with `declare -A`. Without that, Bash creates an indexed array and quietly turns every key into index 0:

```terminal
{
  "title": "declare -A is required",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "port[web]=80; port[db]=5432; declare -p port",
      "output": "declare -a port=([0]=\"5432\")"
    },
    {
      "cmd": "unset port; declare -A port=([web]=80 [db]=5432 [cache]=6379)"
    },
    {
      "cmd": "echo \"db listens on ${port[db]}, ${#port[@]} services\"",
      "output": "db listens on 5432, 3 services"
    },
    {
      "cmd": "[[ -v port[db] ]] && echo \"db has a port\"; [[ -v port[queue] ]] || echo \"queue has no port\"",
      "output": "db has a port\nqueue has no port"
    },
    {
      "comment": "keys come back in no particular order; sort them when order matters",
      "cmd": "for name in \"${!port[@]}\"; do echo \"$name\"; done | sort",
      "output": "cache\ndb\nweb"
    }
  ]
}
```

The first command stored only `5432`, at index 0: both `web` and `db` were evaluated as arithmetic, where an unset name is 0.

A common use is counting. This reads the access log and counts requests per status code, entirely in Bash:

```bash
#!/usr/bin/env bash
# status-count.sh: count requests per HTTP status in an access log
declare -A count=()

# fields: ip - - [date zone] "method path proto" status size ...
while read -r _ _ _ _ _ _ _ _ status _ || [[ -n $status ]]; do
    [[ $status =~ ^[0-9]{3}$ ]] || continue          # skip lines in another format
    count[$status]=$(( ${count[$status]:-0} + 1 ))
done < "${1:-logs/access.log}"

for status in "${!count[@]}"; do
    printf '%s %3d\n' "$status" "${count[$status]}"
done | sort
```

```terminal
{
  "title": "count by status",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash status-count.sh",
      "output": "200  20\n201   4\n302   4\n404   8\n500   4"
    }
  ]
}
```

`read` splits each line on spaces; `_` is a throwaway name for the fields the script does not need. The status code is the ninth field. As in [Part 3](/guides/introduction-to-bash/03-working-with-files), `|| [[ -n $status ]]` keeps a last line that has no newline; at the real end of the file, `read` empties its variables, so the loop stops. [Part 9](/guides/introduction-to-bash/09-bash-tools) does the same job with `awk` and compares the speed.

## Split a String Into an Array

To split a string on a delimiter, use `read -a` with `IFS` set for that one command, or `mapfile` for lines. Do not write `arr=($string)`: it splits on every space and also expands wildcards:

```terminal
{
  "title": "split safely",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "csv=\"web-1,db 1,*.txt\""
    },
    {
      "cmd": "IFS=, read -r -a parts <<< \"$csv\"; declare -p parts",
      "output": "declare -a parts=([0]=\"web-1\" [1]=\"db 1\" [2]=\"*.txt\")"
    },
    {
      "comment": "the unsafe way: the * matched servers.txt",
      "cmd": "IFS=,; bad=($csv); unset IFS; declare -p bad",
      "output": "declare -a bad=([0]=\"web-1\" [1]=\"db 1\" [2]=\"servers.txt\")"
    },
    {
      "cmd": "mapfile -t lines <<< $'first line\\nsecond line'; echo \"${#lines[@]} lines, second: ${lines[1]}\"",
      "output": "2 lines, second: second line"
    }
  ]
}
```

`<<<` is a **here string**: it feeds the text, plus a newline, to the command's standard input. [Split a string by a delimiter](/posts/split-string-delimiter-bash) shows more variations.

## Read Input With read

`read` reads one line from standard input into variables. The options you will use:

| Option    | Effect                                                            |
| --------- | ----------------------------------------------------------------- |
| `-r`      | Keep backslashes as they are (always use it)                      |
| `-p text` | Show a prompt, but only when the input is a terminal              |
| `-s`      | Do not echo the input (for passwords)                             |
| `-t sec`  | Give up after a timeout; the exit status is then greater than 128 |
| `-n N`    | Return after N characters instead of a whole line                 |
| `-a name` | Split the line into an array                                      |
| `-d char` | Read up to `char` instead of a newline (`-d ''` for null bytes)   |

```terminal
{
  "title": "read from a pipe, with a timeout and a default",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf 'Ada Lovelace\\n' | { read -r first last; echo \"first=$first last=$last\"; }",
      "output": "first=Ada last=Lovelace"
    },
    {
      "cmd": "read -r -t 1 answer < <(sleep 3); echo \"exit status after the timeout: $?\"",
      "output": "exit status after the timeout: 142"
    },
    {
      "cmd": "read -r -p \"Environment [staging]: \" env < /dev/null; env=${env:-staging}; echo \"using $env\"",
      "output": "using staging"
    }
  ]
}
```

The prompt did not appear in the last example because the input was not a terminal; in an interactive terminal you would see `Environment [staging]:` and could type an answer. Scripts that ask questions should still work when nobody is there to answer: give every question a default, and offer a command-line option so automation never has to answer prompts. [Prompt for yes, no or cancel](/posts/prompt-for-yes-no-cancel-input-in-linux-shell-script) has a complete example.

## Common Mistakes

- **Spaces around `=`.** `name = value` runs a command called `name`.
- **Unquoted expansions.** Use `"$var"` and `"${array[@]}"`.
- **Treating empty and unset as the same** when it matters. Use `${v-...}` versus `${v:-...}`, or `[[ -v v ]]`.
- **`${s/x/&}` written for Bash 5.1 or older.** In 5.2+, `&` inserts the match; escape it.
- **Numbers with leading zeros** in arithmetic. Use `10#$n`.
- **`(( count++ ))` under `set -e`.** Use `count=$(( count + 1 ))`.
- **Forgetting `declare -A`.** The keys silently become index 0.
- **`arr=($string)` to split.** Use `read -r -a` or `mapfile -t`.

## Summary

- Variables are strings; `declare -p` shows exactly what one holds.
- `${v:-default}`, `${v:?message}` and `${v:+alt}` handle missing values; `[[ -v name ]]` tests whether a variable is set.
- `#`, `##`, `%`, `%%`, `/`, `//`, `^^` and `,,` cover most string work without external commands.
- Arithmetic is 64-bit integer only; watch for octal and for `(( ))` returning failure on 0.
- Use indexed arrays for lists and `declare -A` for maps, always expanded as `"${name[@]}"`.

Next: [Control Structures](/guides/introduction-to-bash/05-control-structures), where `[[ ]]` and `[ ]` part ways and loops meet subshells.

## Keep Learning

- [Set a variable to the output of a command](/posts/set-variable-command-output-bash)
- [Iterate over a range of numbers](/posts/bash-iterate-number-range-variables)
- [Extract a file name's extension](/posts/extract-filename-extension-bash)
- Interview questions: [Bash scripting basics](/interview-questions/junior/bash-scripting-basics)
