---
title: 'What Does "2>&1" Mean in Linux and Bash?'
excerpt: 'Learn what the 2>&1 redirection operator means, how stdout and stderr work, and how to send all output to a file, to the screen and a file with tee, or only to stderr.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-04-18'
publishedAt: '2024-04-18T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Bash
  - Redirection
  - Streams
  - stderr
  - tee
  - Shell
---

The `2>&1` syntax is one of the most commonly seen but least understood pieces of Linux command line syntax. You'll encounter it frequently in scripts, log redirections, and system administration tasks, but its meaning isn't immediately obvious to newcomers.

This guide explains what `2>&1` means, how it works with Linux streams, and provides practical examples of when and how to use it effectively in your daily work. It also answers the questions that come right after: how to save all output to a file, how to see output and save it at the same time, and how to write your own messages to stderr.

## TLDR

| Task                               | Command                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| Send stdout and stderr to one file | `cmd > out.log 2>&1` (Bash also accepts `cmd &> out.log`)    |
| Append stdout and stderr to a file | `cmd >> out.log 2>&1` (Bash 4.0+ also has `cmd &>> out.log`) |
| Discard all output                 | `cmd > /dev/null 2>&1`                                       |
| Show output and save it to a file  | `cmd 2>&1 \| tee out.log`                                    |
| Print your own message to stderr   | `echo "Error: config not found" >&2`                         |
| Send only stderr through a pipe    | `cmd 2>&1 > /dev/null \| grep -i error`                      |

## Understanding Linux Streams

Before diving into `2>&1`, you need to understand the concept of streams in Linux. Every process has three default streams:

- **Standard Input (stdin)** - File descriptor 0
- **Standard Output (stdout)** - File descriptor 1
- **Standard Error (stderr)** - File descriptor 2

These streams allow programs to receive input and send output or error messages. By default, both stdout and stderr display on your terminal, but they're actually separate streams that can be handled independently.

```bash
# This command will show both output and errors on terminal
ls /existing-directory /non-existent-directory
```

The command above will display the directory listing (stdout) and an error message about the non-existent directory (stderr) both on your screen, but they're using different streams.

## Breaking Down 2>&1

The `2>&1` syntax is a redirection operator that means "redirect file descriptor 2 (stderr) to the same place as file descriptor 1 (stdout)". Let's break this down:

- `2` refers to stderr (standard error)
- `>` is the redirection operator
- `&1` refers to stdout (standard output)

The `&` before the `1` is important - it tells the shell that `1` refers to a file descriptor, not a file named "1".

## Basic Examples

Here's how `2>&1` works in practice:

```bash
# Without 2>&1 - errors go to terminal, output goes to file
ls /existing-directory /non-existent-directory > output.txt

# With 2>&1 - both output and errors go to file
ls /existing-directory /non-existent-directory > output.txt 2>&1
```

In the first example, you'll see the error on your terminal but the successful output goes to the file. In the second example, both the output and error messages are saved to the file.

## Common Use Cases

### Logging Everything to a File

When running scripts or commands where you want to capture all output:

```bash
# Capture both successful output and errors
./my-script.sh > logfile.txt 2>&1
```

This is particularly useful for cron jobs where you want to log everything:

```bash
# In crontab
0 2 * * * /path/to/backup-script.sh > /var/log/backup.log 2>&1
```

### Discarding All Output

Sometimes you want to suppress both output and errors completely:

```bash
# Redirect everything to /dev/null (discard)
noisy-command > /dev/null 2>&1
```

This is commonly used when you only care about the exit status of a command, not its output.

### Piping Both Streams

When you want to pipe both stdout and stderr to another command:

```bash
# Send both output and errors to grep
./my-script.sh 2>&1 | grep "ERROR"
```

Without `2>&1`, the pipe would only receive stdout, and error messages would still appear on your terminal.

## Order Matters

The order of redirections is important. These two commands are different:

```bash
# Correct: stdout goes to file, stderr goes to same place as stdout
command > file.txt 2>&1

# Different: stderr goes to file, stdout goes to same place as stderr
command 2>&1 > file.txt
```

In the second example, stderr is redirected to the terminal (where stdout was originally going), then stdout is redirected to the file. This results in stderr going to the terminal and stdout going to the file.

## Advanced Redirection Examples

### Separating Streams

You can redirect stdout and stderr to different files:

```bash
# stdout to one file, stderr to another
command > output.txt 2> errors.txt
```

### Combining with Other Redirections

You can combine `2>&1` with other redirection operators:

```bash
# Append both stdout and stderr to a file
command >> logfile.txt 2>&1

# Send stdout to a file and stderr to another command
command 2>&1 > output.txt | logger -t mycommand
```

The second example uses the order rule from the previous section. `2>&1` comes first, so stderr goes into the pipe. Then `> output.txt` moves only stdout to the file. If you write `command > output.txt 2>&1 | logger`, both streams go to the file and `logger` gets nothing.

To keep stdout on the screen and send only stderr through the pipe, swap the two streams with a spare descriptor:

```bash
command 3>&1 1>&2 2>&3 3>&- | grep -i error
```

Descriptor 3 keeps a copy of the pipe, stdout moves to the terminal, stderr moves to the pipe, and `3>&-` closes the spare copy.

## Real-World Examples

### Database Backup with Logging

```bash
#!/bin/bash
# Backup script: the dump goes to one file, errors and status to a log
if mysqldump database_name > backup.sql 2>> backup.log; then
    echo "$(date '+%F %T') backup completed" >> backup.log
else
    echo "$(date '+%F %T') backup failed" >> backup.log
fi
```

Do not use `> backup.sql 2>&1` here. It writes any warning or error into the SQL file, and the restore then fails on that line. Keep data on stdout and messages on stderr, and send them to different files.

### System Monitoring Script

```bash
#!/bin/bash
# Monitor system and log all output
{
    echo "=== System Check $(date) ==="
    df -h
    free -m
    ps aux --sort=-%cpu | head -10
} > system-report.txt 2>&1
```

### Application Startup

```bash
# Start application and capture all output for debugging
java -jar myapp.jar > app.log 2>&1 &
```

The `&` at the end runs the command in the background, while `2>&1` ensures all output goes to the log file.

## Using with Process Substitution

You can combine `2>&1` with process substitution for advanced scenarios:

```bash
# Send output to logger while also saving to file
command 2>&1 | tee >(logger -t mycommand) > output.txt
```

This sends both stdout and stderr to `tee`, which then sends the output to both the logger command and the output file.

## Debugging Redirection

To understand what's happening with your redirections, look at the file descriptors in `/proc` on Linux:

```bash
# Where the descriptors of your current shell point
ls -l /proc/$$/fd/

# Where the descriptors of a command point with a given redirection
bash -c 'ls -l /proc/self/fd/' > fd.txt 2>&1
cat fd.txt   # 1 and 2 both point to fd.txt
```

This helps you verify that your redirections are working as expected, without changing the descriptors of your interactive shell.

## How Do I Redirect All Output to a File?

Use `> file 2>&1`. It sends stdout to the file, then sends stderr to the same place:

```bash
./deploy.sh > deploy.log 2>&1      # overwrite the file
./deploy.sh >> deploy.log 2>&1     # append to the file
./deploy.sh > out.log 2> err.log   # one file for each stream
```

Bash has a short form: `&> deploy.log` overwrites and `&>> deploy.log` appends. `&>` exists in every Bash version, and `&>>` needs Bash 4.0 or later. Both are Bash syntax, not POSIX. In a POSIX shell such as dash, which is `/bin/sh` on Debian and Ubuntu, `cmd &>> file` means "run `cmd` in the background", followed by an empty command that only opens `file`. The output goes to the terminal and the log stays empty:

```terminal
{
  "title": "&>> in bash and in sh (dash)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -c 'ls /etc/hostname /nope &>> all.log'; cat all.log",
      "output": "ls: cannot access '/nope': No such file or directory\n/etc/hostname"
    },
    {
      "cmd": "sh -c 'ls /etc/hostname /nope &>> sh.log'; sleep 0.2; wc -c sh.log",
      "output": "ls: cannot access '/nope': No such file or directory\n/etc/hostname\n0 sh.log"
    }
  ]
}
```

That matters most in crontab lines, because cron runs each line with `/bin/sh`. Use the long form there:

```bash
# crontab -e
0 2 * * * /home/user/backup.sh >> /var/log/backup.log 2>&1
```

### Redirect Everything From Inside a Script

To log all output of a script without a redirection on every line, use `exec` once near the top. From that line on, every command writes to the log:

```bash
#!/usr/bin/env bash
exec >> /var/log/nightly-job.log 2>&1

echo "=== started $(date '+%F %T') ==="
rsync -a /srv/data/ /backup/data/
echo "=== finished ==="
```

To redirect only one part of a script, put the commands in a group:

```bash
{
    echo "Disk usage on $(hostname)"
    df -h
    du -sh /var/log
} > report.txt 2>&1
```

## How Do I Send Output to a File and the Screen at the Same Time?

Pipe the output to `tee`. It writes its input to the screen and to every file you give it:

```bash
make build 2>&1 | tee build.log          # overwrite build.log
make build 2>&1 | tee -a build.log       # append to build.log
make build |& tee build.log              # Bash 4.0+ short form of 2>&1 |
make build 2>&1 | tee build.log ~/builds/latest.log
```

Without `2>&1`, only stdout goes through `tee`. Error messages still reach the screen, but they are not in the file.

### Keep the Exit Code When You Pipe to tee

A pipeline returns the exit code of its last command, and that is `tee`, which almost always succeeds. A failed command looks like a success:

```bash
ls /nope 2>&1 | tee out.log; echo "exit: $?"
# ls: cannot access '/nope': No such file or directory
# exit: 0
```

That breaks `if cmd | tee log`, `set -e` and CI steps. Turn on `pipefail`, so the pipeline fails when any command in it fails, or read the code of one command from `PIPESTATUS`:

```bash
set -o pipefail
ls /nope 2>&1 | tee out.log; echo "exit: $?"
# exit: 2

ls /nope 2>&1 | tee out.log; echo "ls exit: ${PIPESTATUS[0]}, tee exit: ${PIPESTATUS[1]}"
# ls exit: 2, tee exit: 0
```

[What set -e and pipefail do](/posts/what-does-set-e-mean-in-bash-script) explains these options in detail.

### Write to a Protected File With sudo tee

`sudo echo "x" > /etc/app.conf` fails with `Permission denied`, because your own shell opens `/etc/app.conf` before `sudo` runs. Let `tee` open the file as root instead, and send its copy of the output to `/dev/null`:

```bash
echo "max_connections = 200" | sudo tee /etc/app.conf > /dev/null
echo "log_level = info" | sudo tee -a /etc/app.conf > /dev/null   # append
```

### Send a Whole Script Through tee

To see and log everything a script prints, combine `exec` with process substitution:

```bash
#!/usr/bin/env bash
exec > >(tee -a run.log) 2>&1   # from here on, stdout and stderr go to the screen and run.log
echo "starting"
ls /nope
echo "done"
```

All three lines, including the error from `ls`, appear on the screen and in `run.log`. `tee` runs as a separate process, so the last lines can reach the file a moment after the script exits.

## How Do I Echo to stderr in Bash?

Add `>&2` to the command. It sends that command's stdout to file descriptor 2:

```bash
echo "Error: config file not found" >&2
printf 'Error: cannot read %s\n' "$file" >&2
```

`>&2` is short for `1>&2`, and it works in every POSIX shell. Use stderr for errors, warnings and progress messages, and keep stdout for the data your script produces. Then a caller can capture or pipe the data, and still see the messages:

```bash
result=$(./export-users.sh)        # $result gets only stdout
./export-users.sh > users.csv      # messages still appear on the terminal
./export-users.sh 2> /dev/null     # hide the messages, keep the data
```

For a script with many messages, define small functions once:

```bash
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -r "$config" ]] || die "cannot read $config"
warn "running without a cache"
```

Return a non-zero exit code together with the message, as `die` does. The message tells a person what went wrong, and the exit code tells the calling script or CI job.

To color error messages only when a person reads them, test whether stderr is a terminal with `[ -t 2 ]`. [How to print colors and newlines with echo and printf](/posts/change-echo-output-color-linux) shows the pattern.

## Common Mistakes

### Forgetting the &

```bash
# Wrong - creates a file named "1"
command 2>1

# Correct - redirects to file descriptor 1
command 2>&1
```

### Wrong Order

```bash
# Only stdout goes to the file, stderr stays on the terminal
command 2>&1 > file.txt

# Both streams go to the file
command > file.txt 2>&1
```

The `2>&1` redirection is essential for proper output handling in Linux systems. Whether you're writing scripts, setting up cron jobs, or debugging applications, understanding how to combine stdout and stderr gives you precise control over where your command output goes. Practice with these examples to become comfortable with this powerful redirection technique.

## Related Resources

- [Introduction to Bash: Bash Basics](/guides/introduction-to-bash/02-bash-basics): redirection, pipelines and exit status in one chapter
- [How cat << EOF works in Bash](/posts/how-cat-eof-works-in-bash): here documents, which feed text to stdin
- [Learn Linux interactive tutorial](/games/linux-terminal): practice pipes and redirection in a browser terminal
- [Linux command line quiz](/quizzes/linux-quiz) and [Linux fundamentals flashcards](/flashcards/linux-fundamentals)
