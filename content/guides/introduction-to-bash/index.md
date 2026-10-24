---
title: 'Introduction to Bash'
seoTitle: 'Bash Scripting Tutorial: From First Script to Tested Tools'
description: 'Learn Bash scripting step by step with real output: expansions, quoting, arrays, functions, arguments, strict mode, traps, ShellCheck and bats tests.'
category:
  name: 'Bash'
  slug: 'bash'
publishedAt: '2024-07-03T10:00:00Z'
updatedAt: '2026-10-24T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Command Line
  - Automation
  - ShellCheck
  - DevOps
---

**Bash** is the shell you type commands into on most Linux servers, and the language of countless deployment scripts, CI steps, container entrypoints and cron jobs. It is easy to start with and full of sharp edges: unquoted variables that split into several arguments, `set -e` that does not stop where you expect, loops that lose their variables in a subshell.

This guide goes deep on Bash itself. Each part explains what Bash really does, shows it with real output, and points out the mistakes that cause bugs in production. Along the way you build **logstat**, a small command-line tool that summarizes web server logs: a function library in Part 6, a command you can run from anywhere in Part 7, options and validation in Part 8, and tests and CI in Part 10.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Parts 1 to 3", "sub": "how Bash reads a line, files", "icon": "cpu", "tone": "slate" },
    { "label": "Parts 4 and 5", "sub": "variables, arrays, conditions, loops", "icon": "gear", "tone": "blue" },
    { "label": "Parts 6 to 8", "sub": "functions, running scripts, arguments", "icon": "box", "tone": "violet" },
    { "label": "Parts 9 and 10", "sub": "text tools, strict mode, tests, CI", "icon": "check", "tone": "green" }
  ]
}
```

## What You'll Learn

1. **[What Is Bash? Versions, Startup Files and Your First Script](/guides/introduction-to-bash/01-what-is-bash)**: which Bash you have and why it matters, `sh` versus Bash, login and interactive shells, the practice files, and what is new in Bash 5.3.
2. **[Bash Basics: How Bash Reads and Runs a Command Line](/guides/introduction-to-bash/02-bash-basics)**: command types, exit codes, the order of expansions, quoting, pipelines, subshells and redirection.
3. **[Working With Files in Bash](/guides/introduction-to-bash/03-working-with-files)**: glob patterns and `shopt` options, file names with spaces and dashes, safe loops with `find -print0`, reading files and temporary files.
4. **[Bash Variables](/guides/introduction-to-bash/04-bash-variables)**: unset versus empty, parameter expansion, the Bash 5.2 `&` change, arithmetic traps, indexed and associative arrays, `read`.
5. **[Bash if, case and Loops](/guides/introduction-to-bash/05-control-structures)**: `[ ]` versus `[[ ]]`, regex matching with `BASH_REMATCH`, `case`, loops, and the subshell and stdin traps.
6. **[Bash Functions](/guides/introduction-to-bash/06-functions)**: return values, namerefs, `local` and dynamic scope, libraries with `source`, and helpers for logging and retries.
7. **[How to Make a Bash Script Executable and Run It](/guides/introduction-to-bash/07-script-permissions)**: `chmod +x`, which permissions apply, shebangs, `source` versus running, `PATH`, cron and the errors you will meet.
8. **[Bash Script Arguments](/guides/introduction-to-bash/08-command-line-arguments)**: `"$@"`, validation of numbers, ports and IP addresses, `getopts`, long options, standard input and exit codes.
9. **[Bash Text Processing](/guides/introduction-to-bash/09-bash-tools)**: `printf`, here documents, process substitution, `awk`, `sed` and `jq`, measured speed differences, parallel jobs and `curl`.
10. **[Bash Best Practices](/guides/introduction-to-bash/10-bash-best-practices)**: where `set -euo pipefail` fails, traps, `flock`, ShellCheck, shfmt, bats-core tests, a CI workflow and macOS portability.

## Bash Best Practices at a Glance

- **Quote every expansion**: `"$var"`, `"$(cmd)"`, `"${array[@]}"` ([Part 2](/guides/introduction-to-bash/02-bash-basics), [Part 4](/guides/introduction-to-bash/04-bash-variables)).
- **Never loop over `ls` or `$(cat file)`**; use globs and `while IFS= read -r` ([Part 3](/guides/introduction-to-bash/03-working-with-files)).
- **Use `[[ ]]` and `(( ))` in Bash scripts**, and validate input before arithmetic ([Part 5](/guides/introduction-to-bash/05-control-structures)).
- **Declare variables `local` in functions**, and return data by printing it ([Part 6](/guides/introduction-to-bash/06-functions)).
- **Give every script a Bash shebang** and never run it with `sh` ([Part 1](/guides/introduction-to-bash/01-what-is-bash), [Part 7](/guides/introduction-to-bash/07-script-permissions)).
- **Build commands in arrays**, never in strings for `eval` ([Part 8](/guides/introduction-to-bash/08-command-line-arguments)).
- **Use `printf`, `jq` and one `awk` call** instead of `echo -e`, `grep` on JSON and per-line loops ([Part 9](/guides/introduction-to-bash/09-bash-tools)).
- **Use strict mode, one cleanup trap, ShellCheck and tests** ([Part 10](/guides/introduction-to-bash/10-bash-best-practices)).

## Which Versions This Guide Uses

The guide was updated on 24 October 2026. The terminal output comes from real runs as a normal user (`dev`) on a machine called `devbox`:

- **Bash 5.2.21 on Ubuntu 24.04.5 LTS** for almost everything; Debian 13 (5.2.37) behaves the same.
- **Bash 5.3.9 on Ubuntu 26.04.1 LTS** for the Bash 5.3 features and messages. Upstream Bash is at 5.3 patch 20.
- **Bash 3.2.57**, built from the GNU source, for what breaks on macOS, which still ships that version as `/bin/bash`.
- **ShellCheck 0.11.0, shfmt 3.14.1, bats-core 1.14.0 and actionlint 1.7.12**, plus Ubuntu 24.04's own `jq`, `curl`, `mawk` and coreutils.

What is not a real run: the macOS commands in the tabs (BSD `sed` and `date`), the `ssh`, `psql`, cron and `sudo` lines, which need other machines or root, and the GitHub Actions workflow, which was checked with actionlint but not run on GitHub. Each of those is shown as code without output.

If you learned Bash from an older tutorial, these are the changes that matter most:

| Old habit                                           | Now                                                          | Why                                           |
| --------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `` `command` ``                                     | `$(command)`                                                 | Nests without backslashes                     |
| `[ "$a" = x -a "$b" = y ]`                          | `[[ $a == x && $b == y ]]`                                   | `-a` and `-o` are obsolete and ambiguous      |
| `$[ 1 + 2 ]`, `expr 1 + 2`                          | `$(( 1 + 2 ))`                                               | `$[ ]` is deprecated; `expr` starts a process |
| `which cmd`                                         | `command -v cmd`                                             | A builtin that knows functions and aliases    |
| `echo -e "a\tb"`                                    | `printf 'a\tb\n'`                                            | `echo` differs between shells                 |
| `eval "$cmd_string"`                                | `"${cmd[@]}"` with an array                                  | Safe with any argument                        |
| `cat file \| while read line`                       | `while IFS= read -r line; do ...; done < file`               | Keeps variables, spaces and backslashes       |
| `"${s/x/&}"` for a literal `&`                      | `"${s/x/\&}"`, or `shopt -u patsub_replacement`              | `&` inserts the match since Bash 5.2          |
| `$RANDOM` for anything that should be unpredictable | `$SRANDOM` (Bash 5.1+), or better `openssl rand` for secrets | `$RANDOM` is 15 bits from a simple generator  |

## Prerequisites

- A computer with Linux, macOS or Windows (WSL). [Part 1](/guides/introduction-to-bash/01-what-is-bash) shows how to get a current Bash on each.
- Basic terminal use. If `cd`, `ls`, `cp` and pipes are new to you, start with [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface) in the Linux guide, whose [shell scripting part](/guides/introduction-to-linux/09-shell-scripting) is also a gentler first introduction to scripts.

## Practice Hands-On

[Part 1](/guides/introduction-to-bash/01-what-is-bash) creates `~/bash-practice`, a small set of log, config and data files that every later part works with, so you can run each example yourself and get the same output. For quick experiments without installing anything, use the [Linux Terminal simulator](/games/linux-terminal) in your browser.

## Keep Learning

- [What does set -e mean in a Bash script?](/posts/what-does-set-e-mean-in-bash-script)
- [How cat <<EOF works in Bash](/posts/how-cat-eof-works-in-bash)
- [Check if a variable is set in Bash](/posts/check-if-variable-set-bash)
- Interview questions: [Bash scripting basics](/interview-questions/junior/bash-scripting-basics) and [shell scripting fundamentals](/interview-questions/junior/shell-scripting-fundamentals)
- The free [Introduction to Bash Scripting eBook](https://github.com/bobbyiliev/introduction-to-bash-scripting) on GitHub, for another walk through the same topics
- Next guide: [Introduction to Git](/guides/introduction-to-git)

Start with [Part 1: What Is Bash?](/guides/introduction-to-bash/01-what-is-bash), or jump to [making a script executable](/guides/introduction-to-bash/07-script-permissions) if you need that answer now.
