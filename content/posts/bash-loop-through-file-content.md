---
title: 'How to Loop Through File Lines, Arrays and Number Ranges in Bash'
excerpt: 'Read a file line by line without losing spaces or backslashes, keep variables set inside the loop, loop safely over file names, iterate over arrays, and loop over a number range stored in variables.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-01-22'
publishedAt: '2024-01-22T11:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Loops
  - Arrays
  - File Processing
  - Scripting
  - Linux
---

Loops are where many Bash scripts go wrong in quiet ways. A loop over a file drops leading spaces, a counter set inside the loop is 0 afterwards, `ssh` in the loop body reads the rest of the file, or `{1..$n}` prints `{1..10}` instead of numbers. Each problem has a short fix once you know where it comes from.

This post covers the three loops you write most: over the lines of a file, over the elements of an array, and over a range of numbers.

## TLDR

| Task                         | Bash                                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| Read a file line by line     | `while IFS= read -r line; do ...; done < file.txt`                     |
| Split each line into fields  | `while IFS=, read -r name age city; do ...; done < users.csv`          |
| Loop over file names safely  | `while IFS= read -r -d '' f; do ...; done < <(find . -type f -print0)` |
| Loop over an array           | `for item in "${arr[@]}"; do ...; done`                                |
| Loop over indices and values | `for i in "${!arr[@]}"; do echo "$i ${arr[i]}"; done`                  |
| Loop from `$start` to `$end` | `for ((i = start; i <= end; i++)); do ...; done`                       |

## Prerequisites

- Bash 4 or later for `mapfile` and associative arrays. Bash 5 is the default on current Linux distributions.
- A text file to test with, for example `/etc/passwd` or a CSV file.

## How Do I Loop Through a File Line by Line in Bash?

Use a `while` loop with `read`, and redirect the file into the loop:

```bash
while IFS= read -r line; do
    printf 'Processing: %s\n' "$line"
done < data.txt
```

Each part has a job:

- `IFS=` stops `read` from removing spaces and tabs at the start and end of the line.
- `-r` keeps backslashes as they are. Without it, `read` treats `\` as an escape character and removes it.
- `< data.txt` at the end feeds the file to the whole loop.

A file whose last line has no newline at the end loses that line, because `read` returns non-zero for it. Add a second test to process it too:

```bash
while IFS= read -r line || [[ -n $line ]]; do
    printf '[%s]\n' "$line"
done < data.txt
```

To split each line into fields, set `IFS` to the separator and give `read` one variable for each field. The last variable gets the rest of the line:

```bash
# CSV without quoted fields
while IFS=, read -r name age city; do
    echo "$name is $age and lives in $city"
done < users.csv

# /etc/passwd: print regular users and their home directories
while IFS=: read -r user _ uid _ _ home _; do
    (( uid >= 1000 && uid < 65534 )) && echo "$user $home"
done < /etc/passwd
```

`_` is a normal variable name used for fields you skip. For CSV files with quoted fields that contain commas, use a real CSV tool such as `mlr` or Python's `csv` module instead of `read`.

Do not use `for line in $(cat file)`. The shell splits the output on every space, tab and newline, and also expands `*` and `?` as file name patterns, so you loop over words, not lines.

To load all lines into an array at once, use `mapfile` (also called `readarray`):

```bash
mapfile -t lines < data.txt      # -t removes the newline from each element
echo "read ${#lines[@]} lines"
```

### Keep Variables Set Inside the Loop

A loop at the end of a pipe runs in a subshell, so the variables it sets disappear when the pipe ends:

```bash
count=0
cat data.txt | while IFS= read -r line; do count=$((count + 1)); done
echo "$count"     # 0

count=0
while IFS= read -r line; do count=$((count + 1)); done < data.txt
echo "$count"     # the real number of lines
```

Redirect the file into the loop, as in the second example. For the output of a command, use process substitution, which also keeps the loop in the current shell:

```bash
while IFS= read -r user; do
    active_users+=("$user")
done < <(who | awk '{print $1}' | sort -u)
```

Another option in a script is `shopt -s lastpipe`, which runs the last command of a pipeline in the current shell when job control is off.

### Stop Commands in the Loop From Reading Its Input

Every command in the loop body inherits the loop's stdin, which is the file. A command that reads stdin, such as `ssh`, `ffmpeg` or `read` with a prompt, then eats the remaining lines, and the loop ends after the first one:

```bash
# Runs on the first host only: ssh reads the other host names
while IFS= read -r host; do
    ssh "$host" uptime
done < hosts.txt
```

Give that command its own stdin, or read the file from another file descriptor:

```bash
while IFS= read -r host; do
    ssh -n "$host" uptime          # -n: read stdin from /dev/null
done < hosts.txt

while IFS= read -r host <&3; do    # the file is on descriptor 3, stdin stays free
    ssh "$host" uptime
done 3< hosts.txt
```

### Loop Over File Names Safely

File names can contain spaces and even newlines. Have `find` separate the names with a null byte, and tell `read` to split on it:

```bash
while IFS= read -r -d '' file; do
    printf 'found: %s\n' "$file"
done < <(find /var/log -type f -name '*.log' -print0)
```

For files in one directory, a glob is simpler and also safe: `for f in /var/log/*.log; do [[ -e $f ]] || continue; ...; done`. The `-e` test skips the loop when nothing matches and the pattern stays as text.

## How Do I Loop Through an Array of Strings in Bash?

Expand the array with `"${array[@]}"`, in double quotes:

```bash
servers=("web-1" "web-2" "db primary")

for server in "${servers[@]}"; do
    echo "checking $server"
done
```

The quotes keep each element as one word, so `"db primary"` stays one item. Without them, Bash splits it into two. `"${servers[*]}"` joins all elements into one string, which is useful for a message but not for a loop.

When you need the index too, loop over `"${!servers[@]}"`, which expands to the indices:

```bash
for i in "${!servers[@]}"; do
    echo "$i: ${servers[i]}"
done
```

Associative arrays (Bash 4+) work the same way. `"${!ports[@]}"` gives the keys, in no fixed order:

```bash
declare -A ports=([web]=80 [db]=5432 [cache]=6379)

for service in "${!ports[@]}"; do
    echo "$service listens on ${ports[$service]}"
done
```

Useful array operations inside loops:

```bash
results=()                       # start empty
results+=("web-1: ok")           # append one element
echo "${#results[@]} results"    # number of elements
mapfile -d '' -t logs < <(find /var/log -type f -name '*.log' -print0)   # file names, safe with any name (Bash 4.4+)
```

An empty array in `"${arr[@]}"` gives no words, so the loop body does not run. Bash before 4.4 reported an "unbound variable" error for this under `set -u`. The [Bash variables guide](/guides/introduction-to-bash/04-bash-variables#h2-indexed-arrays) covers arrays in more detail.

## How Do I Loop Over a Range of Numbers Stored in Variables?

Use a C-style `for` loop. It reads variables normally:

```bash
start=5
end=15

for ((i = start; i <= end; i++)); do
    echo "item $i"
done
```

Brace expansion does not work here. Bash expands braces before it expands variables, so `{$start..$end}` is not a valid range when the braces are expanded, and the text stays as it is:

```bash
for i in {$start..$end}; do echo "$i"; done
# {5..15}
```

`{1..10}` works only with literal numbers. Other ways to loop over a range from variables:

```bash
for ((i = start; i <= end; i += 3)); do echo "$i"; done    # a step of 3
for ((i = end; i >= start; i--)); do echo "$i"; done        # count down

for i in $(seq "$start" "$end"); do echo "$i"; done         # seq also works in sh
for i in $(seq -w 1 10); do echo "file_$i.txt"; done        # zero padded: 01 .. 10
printf 'node-%02d\n' $(seq "$start" "$end")                 # format each number
```

The C-style loop starts no extra process and does not build the whole list first, so prefer it for large ranges. `seq` also prints decimal steps, such as `seq 1.5 0.5 3.5`, which Bash arithmetic cannot do because it only handles integers. Do not use `eval echo {$start..$end}` to force brace expansion: `eval` runs any code that ends up in the variables.

In a POSIX `sh` script, which has no C-style loop, count with `while`:

```sh
i=$start
while [ "$i" -le "$end" ]; do
    echo "item $i"
    i=$((i + 1))
done
```

## Related Resources

- [Introduction to Bash: if, case and Loops](/guides/introduction-to-bash/05-control-structures): `for`, `while`, `until` and the lost-variable problem
- [Introduction to Linux: Shell Scripting](/guides/introduction-to-linux/09-shell-scripting): loops in complete scripts
- [How to check if a file, directory or variable exists in Bash](/posts/check-directory-exists-bash-script): tests to use inside loops
- [How to find files in Linux](/posts/find-files-with-wildcards-linux): build the list of files a loop works on
- [Linux command line quiz](/quizzes/linux-quiz)
