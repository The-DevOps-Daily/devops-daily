---
title: 'How to Check if a File, Directory, Variable or Command Exists in Bash'
excerpt: 'The Bash tests you use in almost every script: check if a directory or file exists, if a variable is set or empty, if a string contains a substring, how to compare text without case, and if a program is installed.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-05-20'
publishedAt: '2024-05-20T14:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Linux
  - Conditionals
  - Variables
  - Strings
---

Most Bash scripts start with a few checks: does the config directory exist, is the file missing, is the variable set, is `jq` installed. Each check is one line, but each one also has a common mistake, such as a test that treats a broken symlink as "no file" or a dependency check that always passes under `sh`.

This post collects these checks in one place, with the direct answer first and the edge cases after it.

## TLDR

| Check                           | Bash                                                   |
| ------------------------------- | ------------------------------------------------------ |
| Directory exists                | `[[ -d "$dir" ]]`                                      |
| File does not exist             | `[[ ! -e "$file" ]]` (`! -f` for "not a regular file") |
| Variable is set (even if empty) | `[[ -v NAME ]]` or `[ -n "${NAME+x}" ]`                |
| Variable is empty or unset      | `[[ -z "${NAME-}" ]]`                                  |
| String contains a substring     | `[[ "$s" == *"$sub"* ]]`                               |
| Lowercase a string              | `"${s,,}"` (Bash 4+) or `tr '[:upper:]' '[:lower:]'`   |
| Program is installed            | `command -v jq >/dev/null 2>&1`                        |

## Prerequisites

- Bash 4.2 or later for `[[ -v ]]` and `${var,,}`. Most Linux distributions ship Bash 5. macOS ships Bash 3.2 as `/bin/bash`; install a newer one with Homebrew if you need these features.
- The `[ ]` and `case` examples also work in POSIX `sh`.

`[ ]` is the POSIX `test` command, and `[[ ]]` is Bash syntax. Inside `[[ ]]` the shell does not split words or expand globs in variables, so an unquoted `$dir` with a space still works. Quote the variables anyway: the habit protects you in `[ ]`, in `sh` scripts and in every other command. [Introduction to Bash: [ ] versus [[ ]]](/guides/introduction-to-bash/05-control-structures#h2-versus) explains the differences in detail.

## How Do I Check if a Directory Exists in Bash?

Use the `-d` test. It is true when the path exists and is a directory, or a symlink to a directory:

```bash
dir="/var/backups/app"

if [[ -d "$dir" ]]; then
    echo "found $dir"
else
    echo "missing $dir" >&2
fi
```

If you only want the directory to exist, you do not need the test. `mkdir -p` creates it and its parents, and does nothing when it already exists:

```bash
mkdir -p "$dir"
```

To check that the script can also use the directory, combine `-d` with `-w` (writable) or `-r` (readable). For a directory, `-x` means you can enter it:

```bash
[[ -d "$dir" && -w "$dir" ]] || { echo "cannot write to $dir" >&2; exit 1; }
```

To check if a directory is empty, including hidden files, ask `find`. It prints the directory only when it is empty:

```bash
if [[ -n "$(find "$dir" -maxdepth 0 -empty)" ]]; then
    echo "$dir is empty"
fi
```

## How Do I Check if a File Does Not Exist in Bash?

Negate a test with `!`. Pick the test that matches what "does not exist" means for you:

```bash
[[ ! -e "$path" ]]   # nothing exists at this path
[[ ! -f "$path" ]]   # no regular file here (it can be missing, a directory, a device, ...)
```

The tests follow symlinks, and that matters for "does not exist". A broken symlink fails `-e` and `-f`, because its target is missing, but the link itself still exists. A script that runs `[[ ! -e "$file" ]] && echo data > "$file"` then writes through the link to wherever it points. Add `-L` when links are possible:

```bash
if [[ ! -e "$path" && ! -L "$path" ]]; then
    echo "nothing at $path"
fi
```

This is how the common tests behave for each kind of path:

| Path                   | `-e` | `-f` | `-d` | `-L` |
| ---------------------- | ---- | ---- | ---- | ---- |
| Regular file           | yes  | yes  | no   | no   |
| Directory              | yes  | no   | yes  | no   |
| Symlink to a file      | yes  | yes  | no   | yes  |
| Symlink to a directory | yes  | no   | yes  | yes  |
| Broken symlink         | no   | no   | no   | yes  |
| Nothing                | no   | no   | no   | no   |

Other useful tests: `-s` (exists and is not empty), `-r`, `-w`, `-x` (readable, writable, executable for you) and `file1 -nt file2` (newer than).

### Create a File Only if It Does Not Exist

A check followed by a write leaves a short gap in which another process can create the file. When two copies of a script can run at the same time, let the shell do the check and the create in one step with `noclobber`:

```bash
set -o noclobber
if { echo "$$" > /tmp/report.lock; } 2>/dev/null; then
    echo "lock taken"
else
    echo "another run holds the lock" >&2
    exit 1
fi
```

With `noclobber` on, `>` fails when a regular file with that name exists, and the exit status tells you which case happened. `>|` still overwrites on purpose. `noclobber` does not protect devices or named pipes, so `> /dev/null` still succeeds. `mkdir /tmp/report.lock` is another atomic lock: it fails when the directory exists, and you remove the directory when the script ends.

## How Do I Check if a Variable Is Set in Bash?

First decide which question you mean: "is it set at all" or "does it have a value".

```bash
[[ -v DB_HOST ]]          # set, even if empty (Bash 4.2+; no $ before the name)
[ -n "${DB_HOST+x}" ]     # the same check in POSIX sh
[[ -n "${DB_HOST-}" ]]    # set and not empty
[[ -z "${DB_HOST-}" ]]    # empty or unset
```

`${DB_HOST+x}` expands to `x` when the variable is set and to nothing when it is unset. The `-` in `${DB_HOST-}` gives an empty default, so the test also works under `set -u`, which otherwise stops the script on any unset variable.

For a required setting, parameter expansion can check and fail in one step, or fill in a default:

```bash
: "${API_TOKEN:?API_TOKEN must be set}"   # exits with this message if unset or empty
db_host=${DB_HOST:-localhost}             # use localhost if unset or empty
: "${LOG_LEVEL:=info}"                    # also assign the default to LOG_LEVEL
```

Quote these expansions. `: ${LOG_LEVEL:=info}` without quotes still works, but the shell then splits and glob-expands the value.

To check a list of variables by name, use indirect expansion, `${!name}`:

```bash
missing=()
for name in DATABASE_URL API_TOKEN SECRET_KEY; do
    [[ -n "${!name-}" ]] || missing+=("$name")
done
if (( ${#missing[@]} )); then
    echo "missing variables: ${missing[*]}" >&2
    exit 1
fi
```

For an array, check the number of elements: `(( ${#servers[@]} > 0 ))`. [Unset, empty and default values](/guides/introduction-to-bash/04-bash-variables#h2-unset-empty-and-default-values) in the Bash guide has more examples.

## How Do I Check if a String Contains a Substring in Bash?

Compare the string with a pattern that has `*` on both sides, inside `[[ ]]`:

```bash
log_line="2026-11-13 ERROR database connection failed"

if [[ "$log_line" == *"ERROR"* ]]; then
    echo "error line"
fi
```

Quote the substring. The quoted part matches literally, and the unquoted `*` around it matches any text. If the substring comes from a variable that contains `*`, `?` or `[`, quoting keeps those characters literal. Without quotes, `[[ "$name" == *$sub* ]]` treats them as a pattern.

Other ways to test, depending on the case:

```bash
# POSIX sh: case has the same pattern matching
case "$log_line" in
    *ERROR*) echo "error line" ;;
esac

# a regular expression with =~ (do not quote the regex)
if [[ "$log_line" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ ERROR ]]; then
    echo "dated error line"
fi

# text in a file or a stream: grep, with -F for a fixed string
grep -qF -- "$needle" app.log && echo "found in the file"
```

`grep -q` exits on the first match and prints nothing. `-F` stops grep from treating `.` or `*` in `$needle` as regex, and `--` protects against a value that starts with `-`. Do not pipe a variable into `grep` just to test a substring: `[[ ]]` does the same work without starting a new process, which matters inside a loop.

## How Do I Compare Strings Without Case or Convert Them to Lowercase?

In Bash 4 and later, `${var,,}` converts a value to lowercase and `${var^^}` to uppercase:

```bash
env_name="Production"
echo "${env_name,,}"    # production
echo "${env_name^^}"    # PRODUCTION
echo "${env_name,}"     # production (only the first character is lowercased)

case "${env_name,,}" in
    prod|production) echo "deploying to production" ;;
    staging)         echo "deploying to staging" ;;
    *)               echo "unknown environment: $env_name" >&2; exit 1 ;;
esac
```

For `sh` scripts, or for whole files, use `tr` or `awk`:

```bash
lower=$(printf '%s' "$env_name" | tr '[:upper:]' '[:lower:]')
tr '[:upper:]' '[:lower:]' < input.txt > output.txt
awk -F, -v OFS=, '{ $2 = tolower($2); print }' users.csv   # lowercase one CSV column
```

`[:upper:]` and `[:lower:]` follow the current locale. GNU `tr` converts only single-byte characters, so it leaves letters such as `Ä` or `İ` in a UTF-8 text unchanged. `${var,,}` handles them in a UTF-8 locale. `sed 's/.*/\L&/'` also works, but `\L` is a GNU sed extension that BSD and macOS `sed` do not have.

To compare without case and keep the original value, turn on `nocasematch` for the test only:

```bash
shopt -s nocasematch
[[ "$answer" == y* ]] && echo "yes"
shopt -u nocasematch
```

## How Do I Check if a Program Exists From a Bash Script?

Use `command -v`. It is a POSIX shell builtin, it does not run the program, and it fails when nothing with that name exists:

```bash
if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required: install it with 'sudo apt install jq' or 'brew install jq'" >&2
    exit 1
fi
```

Write the redirection as `>/dev/null 2>&1`, not `&> /dev/null`. `&>` is Bash syntax. In a script that runs under `sh` (dash), `command -v jq &> /dev/null` puts the check in the background, the `if` sees a success every time, and the script reports every program as installed.

To check several programs and report all missing ones at once:

```bash
missing=()
for cmd in git curl jq rsync; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
done
(( ${#missing[@]} == 0 )) || { echo "missing: ${missing[*]}" >&2; exit 1; }
```

`command -v` prints the path of an executable, the name of a builtin or function, or the definition of an alias, so it also finds a function called `jq`. When you need an executable file on disk, use the Bash builtin `type -P jq`, which prints only a path from `$PATH`. Avoid `which` in scripts: it is a separate program that is not installed everywhere, its output and exit codes differ between systems, and it does not know about builtins or functions.

When you need a minimum version, compare versions with `sort -V` (GNU coreutils):

```bash
required=2.30.0
current=$(git --version | awk '{print $3}')
if [[ "$(printf '%s\n' "$required" "$current" | sort -V | head -n1)" != "$required" ]]; then
    echo "git $current is older than $required" >&2
    exit 1
fi
```

## Related Resources

- [Introduction to Bash: if, case and loops](/guides/introduction-to-bash/05-control-structures): every test operator, glob and regex matching
- [How to parse command line arguments in Bash](/posts/parse-command-line-arguments-bash): check that the user passed the arguments a script needs
- [What set -e means](/posts/what-does-set-e-mean-in-bash-script): how failed tests interact with `set -e`
- [How to prompt for yes/no input in a shell script](/posts/prompt-for-yes-no-cancel-input-in-linux-shell-script)
- [Linux command line quiz](/quizzes/linux-quiz)
