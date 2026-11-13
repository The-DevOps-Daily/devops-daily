---
title: 'How to Change the Output Color of Echo and Fix Newlines in Bash'
excerpt: 'Print colored text in a Linux terminal with ANSI escape codes or tput, turn colors off when output is not a terminal, and fix echo when it prints a literal \n instead of a new line.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-08-14'
publishedAt: '2024-08-14T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Bash
  - Terminal
  - Colors
  - echo
  - printf
---

Colors make the important lines of a script easy to see: red for an error, green for a passed check, yellow for a warning. A terminal changes the color when it receives an **ANSI escape sequence**, a short control code that starts with the escape character. The same escape rules explain the second common problem with `echo`: it prints `\n` as two characters instead of a new line.

This post shows how to print colors with `echo`, `printf` and `tput`, how to keep color codes out of log files, and how to print newlines that work the same in every shell.

## TLDR

| Task                                  | Command                                      |
| ------------------------------------- | -------------------------------------------- |
| Print red text                        | `printf '\e[31m%s\e[0m\n' "Error"`           |
| Same with echo (Bash)                 | `echo -e "\e[31mError\e[0m"`                 |
| Portable colors from terminfo         | `echo "$(tput setaf 2)OK$(tput sgr0)"`       |
| Colors only when output is a terminal | `[ -t 1 ] && RED=$'\e[31m' RESET=$'\e[0m'`   |
| Print a newline inside a string       | `printf 'line one\nline two\n'`              |
| Store real newlines in a variable     | `msg=$'line one\nline two'` (Bash, zsh, ksh) |

## Prerequisites

- A terminal on Linux, macOS or WSL. Almost every modern terminal emulator supports ANSI colors.
- Bash for the `$'...'` and `echo -e` examples. The `printf` examples also work in `sh`.

## How Do I Change the Output Color of echo?

Put an escape sequence before the text and a reset sequence after it. The sequence is the escape character, `[`, one or more numbers separated by `;`, and `m`:

```bash
echo -e "\e[31mThis text is red\e[0m"
echo -e "\e[1;32mThis text is bold and green\e[0m"
printf '\033[41;37m%s\033[0m\n' "White text on a red background"
```

`\e` and `\033` both mean the escape character. `\033` (octal 33) works in more `printf` implementations, so use it in scripts that must run outside Bash. `-e` tells the Bash `echo` builtin to interpret backslash sequences. Always end with `\e[0m`. Without the reset, the color stays on for the rest of the terminal output, including your prompt.

The numbers are standard SGR codes:

| Code         | Effect                                                            |
| ------------ | ----------------------------------------------------------------- |
| `0`          | Reset all attributes                                              |
| `1`          | Bold (many terminals also make the color brighter)                |
| `2`          | Dim                                                               |
| `4`          | Underline                                                         |
| `7`          | Reverse foreground and background                                 |
| `30`-`37`    | Foreground: black, red, green, yellow, blue, magenta, cyan, white |
| `40`-`47`    | Background in the same color order                                |
| `90`-`97`    | Bright foreground colors                                          |
| `100`-`107`  | Bright background colors                                          |
| `38;5;N`     | Foreground from the 256-color palette, `N` from 0 to 255          |
| `38;2;R;G;B` | 24-bit "true color" foreground, if the terminal supports it       |

The 8 base colors depend on the terminal theme, so "red" can look different in two terminals. The 256-color codes select an entry in the terminal's palette, which the theme can also change for the first 16 entries. The 24-bit codes give the exact RGB value:

```bash
printf '\e[38;5;208m%s\e[0m\n' "orange from the 256-color palette"
printf '\e[38;2;255;100;0m%s\e[0m\n' "orange as 24-bit RGB"
```

### Store Colors in Variables

Define the colors once with `$'...'` quoting. Bash then stores the real escape character in the variable, not the text `\e`, so the variable works with plain `echo`, with `printf '%s'` and in here documents:

```bash
RED=$'\e[31m'
GREEN=$'\e[32m'
YELLOW=$'\e[33m'
BOLD=$'\e[1m'
RESET=$'\e[0m'

echo "${GREEN}OK${RESET} database is reachable"
echo "${YELLOW}WARN${RESET} disk is 85% full"
printf '%s\n' "${BOLD}${RED}FAIL${RESET} backup did not finish"
```

If you define the variables as `RED='\e[31m'` instead, they contain a backslash and an `e`. They then only work with `echo -e` or inside the `printf` format string, which is a common source of output like `\e[31mFAIL`.

### Use tput Instead of Raw Codes

`tput` reads the terminal's capabilities from the terminfo database and prints the right sequence for the current `$TERM`:

```bash
red=$(tput setaf 1)
green=$(tput setaf 2)
bold=$(tput bold)
reset=$(tput sgr0)

echo "${bold}${red}Error:${reset} file not found"
echo "Colors this terminal supports: $(tput colors)"
```

`setaf N` sets the foreground (`setab N` the background), with the same color order as the table above: 0 black, 1 red, 2 green, 3 yellow, 4 blue, 5 magenta, 6 cyan, 7 white. `sgr0` resets everything. `tput` fails with an error when `$TERM` is not set, which happens in some cron jobs and CI runners, so guard the calls if the script runs there.

### Turn Colors Off When Output Is Not a Terminal

Escape codes are noise in a log file, in `grep` output or in a CI log that does not render them. Use colors only when the output goes to a terminal, and respect the `NO_COLOR` convention, which tells programs to print no colors when that variable is set:

```bash
if [[ -t 1 && -z ${NO_COLOR-} ]]; then
    RED=$'\e[31m' GREEN=$'\e[32m' RESET=$'\e[0m'
else
    RED='' GREEN='' RESET=''
fi

echo "${GREEN}OK${RESET} all checks passed"
```

`[ -t 1 ]` is true when file descriptor 1 (stdout) is a terminal. For messages that you write to stderr, test `[ -t 2 ]` instead ([how to echo to stderr](/posts/what-does-2-and-1-mean-linux-bash#h2-how-do-i-echo-to-stderr-in-bash)). Do not rely on color alone to carry meaning: keep a word such as `OK`, `WARN` or `FAIL` in the text, for people who read the log without colors or cannot tell the colors apart.

## Why Does echo Print a Literal \n Instead of a New Line?

Because the Bash `echo` builtin does not interpret backslash sequences unless you pass `-e`:

```bash
echo "first line\nsecond line"
# first line\nsecond line

echo -e "first line\nsecond line"
# first line
# second line
```

The behavior of `echo` is not the same in every shell. Bash needs `-e` (or `shopt -s xpg_echo`). The `echo` in dash, which is `/bin/sh` on Debian and Ubuntu, always interprets `\n` and does not know `-e`, so it prints the `-e` as text:

```bash
sh -c 'echo -e "a\nb"'
# -e a
# b
```

A script that uses `echo -e` therefore prints different output under `bash` and under `sh`. That is the reason to stop using `echo` for anything with backslashes or options.

### Use printf for Newlines

`printf` interprets `\n` in its format string in every shell, so its output does not depend on the shell:

```bash
printf 'first line\nsecond line\n'
printf '%s\n' "line one" "line two" "line three"    # the format repeats for each argument
printf 'Name: %s\nAge: %d\n' "Alice" 30
printf '%-10s %5s\n' "service" "port" "nginx" 443 "postgres" 5432
```

Two rules keep `printf` safe:

- Put the text that comes from variables in the arguments, not in the format string: `printf '%s\n' "$msg"`, not `printf "$msg\n"`. A `%` in the value breaks the second form.
- `printf` does not add a newline at the end. Put `\n` in the format.

If a variable contains backslash sequences that you want interpreted, use `%b` for that argument: `printf '%b\n' "$text"`.

### Store Real Newlines With $'...'

In Bash, zsh and ksh, `$'...'` quoting turns `\n`, `\t` and `\e` into the real characters when the string is created:

```bash
message=$'Deploy failed:\n- check the logs\n- roll back'
echo "$message"
```

The variable then contains real newlines, so plain `echo "$message"` prints three lines. dash does not support `$'...'` in the version that Debian 12 and Ubuntu 24.04 ship, so keep this syntax in Bash scripts.

### Use a Here Document for Blocks of Text

For a usage message or a config template, a here document is easier to read than a string full of `\n`:

```bash
cat <<EOF
Usage: $(basename "$0") [-v] FILE
  -v   verbose output
EOF
```

[How cat << EOF works in Bash](/posts/how-cat-eof-works-in-bash) covers quoting, indentation and writing here documents to files.

## Related Resources

- [What does 2>&1 mean?](/posts/what-does-2-and-1-mean-linux-bash): send messages to stderr and output to files
- [Introduction to Bash: Bash Tools](/guides/introduction-to-bash/09-bash-tools): `printf`, `read` and other builtins
- [Learn Linux interactive tutorial](/games/linux-terminal): practice basic commands in a browser terminal
