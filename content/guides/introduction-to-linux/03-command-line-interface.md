---
title: 'Linux Command Line Basics: Essential Terminal Commands'
description: 'Learn the Linux terminal: move around with cd and ls, manage files, read logs with less and tail, search with find and grep, and chain commands with pipes.'
order: 3
---

The terminal is where most Linux work happens. Servers usually have no desktop at all, containers have only a shell, and every automation tool you will use later (Bash scripts, Ansible, CI pipelines, Dockerfiles) runs the same commands you type by hand. Once you can move around, find things and chain small tools together, the rest of this guide gets much easier.

This part covers the commands you will use every day: navigation, files and directories, reading files, finding files and text, redirection and pipes, and the shortcuts that save typing.

## Prerequisites

- A Linux shell: a desktop terminal, a WSL window, a virtual machine or an SSH session to a cloud server. [Part 2](/guides/introduction-to-linux/02-getting-started) shows how to get one.
- Nothing else. Every command here is part of a standard Ubuntu, Debian or Fedora install, apart from `tree`, which you can install with `sudo apt install tree` (or `sudo dnf install tree`).

The output in this part comes from real runs on Ubuntu 24.04.5 LTS as a user called `dev` on a machine called `devbox`. Your username, hostname, dates and file sizes will differ. The commands work on a practice directory, `~/lab`, that you create below, so they have something real to work on.

## The Terminal, the Shell and the Prompt

Three pieces work together when you type a command:

- The **terminal** (GNOME Terminal, Windows Terminal, iTerm2, or the SSH client) draws text on the screen and sends your keystrokes.
- The **shell** reads what you type, expands wildcards and variables, and starts programs. Ubuntu, Debian and Fedora use **Bash** by default. macOS uses Zsh, and some people install Fish.
- The **prompt** is the text the shell prints when it waits for input.

A default Ubuntu prompt looks like this:

```text
dev@devbox:~/lab$
```

That reads as user `dev`, on host `devbox`, in the directory `~/lab` (`~` is short for your home directory, `/home/dev`). The final `$` means a regular user. A `#` means you are root, the administrator account, so slow down when you see it.

```terminal
{
  "title": "which shell am I using?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo $SHELL",
      "output": "/bin/bash"
    },
    {
      "cmd": "bash --version | head -n 1",
      "output": "GNU bash, version 5.2.21(1)-release (aarch64-unknown-linux-gnu)"
    }
  ]
}
```

## How a Command Is Built

Most commands follow the same shape:

```text
command [options] [arguments]
```

- **Options** change how the command behaves. Short options use one dash and can be combined (`ls -l -a` is the same as `ls -la`). Long options use two dashes (`ls --all`).
- **Arguments** are what the command works on, usually files or directories.
- A lone `--` ends the options, so `rm -- -strange-name` removes a file whose name starts with a dash.

When you do not know a command, ask the system:

```terminal
{
  "title": "getting help",
  "prompt": "$",
  "steps": [
    {
      "comment": "short usage summary built into most commands",
      "cmd": "ls --help | head -n 3",
      "output": "Usage: ls [OPTION]... [FILE]...\nList information about the FILEs (the current directory by default).\nSort entries alphabetically if none of -cftuvSUX nor --sort is specified."
    },
    {
      "comment": "is it a program, a shell builtin or an alias?",
      "cmd": "type cd tar",
      "output": "cd is a shell builtin\ntar is /usr/bin/tar"
    }
  ]
}
```

- `man ls` opens the full manual page (press `q` to quit, `/word` to search). `man -k keyword` searches all manual page titles. Minimal cloud and container images often leave manual pages out; on Ubuntu, install the `unminimize` package and run `sudo unminimize` to put them back.
- `help cd` explains shell builtins, which have no manual page of their own.
- `type` tells you what will run. On a desktop Ubuntu install, `type ls` prints `ls is aliased to 'ls --color=auto'`, because the default `~/.bashrc` adds that alias.

## Set Up the Practice Directory

The examples in this guide use a small practice directory, `~/lab`: a tiny static website, a web server log with 48 requests and a short notes file. Create it with this script. In your home directory, open an editor with `nano make-lab.sh`, paste the script, save with **Ctrl+O** and **Enter**, and exit with **Ctrl+X**:

```bash
#!/usr/bin/env bash
# make-lab.sh: create ~/lab, the practice directory used in this guide
set -euo pipefail
lab="$HOME/lab"
if [[ -e "$lab" ]]; then
    echo "$lab already exists; rename or delete it first" >&2
    exit 1
fi
mkdir -p "$lab/site/css" "$lab/site/images" "$lab/logs"

cat > "$lab/site/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Lab site</title><link rel="stylesheet" href="css/style.css"></head>
<body><h1>Hello from the Linux lab</h1><p>Served from ~/lab/site.</p></body>
</html>
HTML
cat > "$lab/site/about.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>About</title></head>
<body><h1>About</h1><p>A tiny static site for practice.</p></body></html>
HTML
printf 'body { font-family: sans-serif; max-width: 40rem; margin: 2rem auto; }\n' > "$lab/site/css/style.css"
printf 'Practice notes\n- learn ls, cd and pwd\n- learn grep and find\n- try pipes\n' > "$lab/notes.txt"

# A web server log with 48 requests, generated the same way every time
python3 - "$lab/logs" <<'PY'
import random, sys
random.seed(7)
ips = ['203.0.113.10'] * 9 + ['198.51.100.23'] * 6 + ['192.0.2.44'] * 4 + ['203.0.113.77'] * 2 + ['198.51.100.5']
paths = [('/index.html', 200, 612)] * 10 + [('/about.html', 200, 418)] * 4 + [('/css/style.css', 200, 74)] * 4 + \
        [('/css/style.css', 304, 0)] * 2 + [('/favicon.ico', 404, 162)] * 3 + [('/wp-login.php', 404, 162)] * 2 + \
        [('/admin', 404, 162)] + [('/api/health', 500, 21)] * 2
agents = ['curl/8.5.0', 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15']
lines, t = [], 8 * 3600 + 15 * 60
for i in range(48):
    ip = random.choice(ips)
    path, status, size = random.choice(paths)
    if path == '/wp-login.php':
        ip = '198.51.100.5'
    t += random.randint(5, 140)
    agent = 'python-requests/2.32.3' if ip == '198.51.100.5' else random.choice(agents)
    stamp = f'23/Oct/2026:{t // 3600:02d}:{t % 3600 // 60:02d}:{t % 60:02d} +0000'
    lines.append(f'{ip} - - [{stamp}] "GET {path} HTTP/1.1" {status} {size} "-" "{agent}"')
with open(sys.argv[1] + '/access.log', 'w') as f:
    f.write('\n'.join(lines) + '\n')
with open(sys.argv[1] + '/error.log', 'w') as f:
    for l in lines:
        if '" 500 ' in l:
            f.write('[' + l.split('[')[1].split(']')[0] + '] ERROR health check failed: database connection refused\n')
PY
echo "created $lab"
```

```terminal
{
  "title": "create ~/lab",
  "prompt": "$",
  "steps": [
    {
      "cmd": "bash make-lab.sh",
      "output": "created /home/dev/lab"
    }
  ]
}
```

The script only creates files inside `~/lab` and refuses to run if that directory already exists. Later parts start from a fresh copy: `rm -rf ~/lab && bash ~/make-lab.sh` resets it whenever you want the same starting point as the examples.

## Moving Around the File System

Everything in Linux lives in one tree that starts at `/` (Part 4 explains the layout). Three commands get you around: `pwd` prints where you are, `ls` lists what is there, and `cd` changes directory.

```terminal
{
  "title": "navigate the lab directory",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "pwd",
      "output": "/home/dev"
    },
    {
      "cmd": "ls",
      "output": "lab\nmake-lab.sh"
    },
    {
      "cmd": "cd lab"
    },
    {
      "cmd": "ls -l",
      "output": "total 12\ndrwxrwxr-x 2 dev dev 4096 Oct 23 21:20 logs\n-rw-rw-r-- 1 dev dev   72 Oct 23 21:20 notes.txt\ndrwxrwxr-x 4 dev dev 4096 Oct 23 21:20 site"
    },
    {
      "comment": "-a shows hidden entries, -h prints human-readable sizes",
      "cmd": "ls -lah site",
      "output": "total 24K\ndrwxrwxr-x 4 dev dev 4.0K Oct 23 21:20 .\ndrwxrwxr-x 4 dev dev 4.0K Oct 23 21:20 ..\n-rw-rw-r-- 1 dev dev  162 Oct 23 21:20 about.html\ndrwxrwxr-x 2 dev dev 4.0K Oct 23 21:20 css\ndrwxrwxr-x 2 dev dev 4.0K Oct 23 21:20 images\n-rw-rw-r-- 1 dev dev  221 Oct 23 21:20 index.html"
    },
    {
      "cmd": "cd site/css && pwd",
      "output": "/home/dev/lab/site/css"
    },
    {
      "comment": "go back to the previous directory",
      "cmd": "cd -",
      "output": "/home/dev/lab"
    },
    {
      "cmd": "tree ~/lab",
      "output": "/home/dev/lab\n├── logs\n│   ├── access.log\n│   └── error.log\n├── notes.txt\n└── site\n    ├── about.html\n    ├── css\n    │   └── style.css\n    ├── images\n    └── index.html\n\n5 directories, 6 files"
    }
  ]
}
```

A few things to notice:

- In `ls -l`, the first column shows the file type and permissions (`d` is a directory), followed by the link count, owner, group, size, modification time and name. Part 4 explains each field.
- Entries that start with a dot (`.bashrc`, `.ssh`) are hidden. `ls -a` shows them, along with `.` (this directory) and `..` (the parent).
- `cd` without arguments takes you home, `cd ..` goes up one level, and `cd -` returns to where you were before.

Paths that start with `/` are **absolute** (`/home/dev/lab/site`). All other paths are **relative** to the current directory (`site/css`). `~` expands to your home directory, and `~/lab` works from anywhere.

Press **Tab** while you type a path or command name. The shell completes it, or lists the options when the start is ambiguous. Tab completion saves typing and catches typos before you press Enter.

## Creating, Copying, Moving and Deleting

```terminal
{
  "title": "manage files and directories",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "comment": "-p creates missing parent directories and does not fail if they exist",
      "cmd": "mkdir -p drafts/2026/october"
    },
    {
      "comment": "touch creates empty files (or updates the time of existing ones)",
      "cmd": "touch drafts/todo.txt drafts/ideas.txt"
    },
    {
      "cmd": "cp notes.txt drafts/"
    },
    {
      "comment": "-r copies a directory and everything in it",
      "cmd": "cp -r site site-backup"
    },
    {
      "comment": "mv moves and renames",
      "cmd": "mv drafts/ideas.txt drafts/2026/october/ideas.txt"
    },
    {
      "cmd": "ls -R drafts",
      "output": "drafts:\n2026\nnotes.txt\ntodo.txt\n\ndrafts/2026:\noctober\n\ndrafts/2026/october:\nideas.txt"
    },
    {
      "comment": "rmdir removes only empty directories",
      "cmd": "rmdir drafts/2026",
      "output": "rmdir: failed to remove 'drafts/2026': Directory not empty"
    },
    {
      "cmd": "rm -r site-backup drafts"
    },
    {
      "cmd": "ls",
      "output": "logs\nnotes.txt\nsite"
    }
  ]
}
```

The `rmdir` error is expected: `drafts/2026` still contains a directory, and `rmdir` refuses to delete anything that is not empty. `rm -r` deletes a directory with everything inside it.

:::warning
`rm` does not use a trash can. Deleted files are gone, and `rm -rf` deletes without asking. Before you run `rm -rf` with a variable or a wildcard, run `ls` with the same argument first and read what it matches. Use `rm -i` to confirm each file, or `rm -I` to confirm once before deleting more than three files.
:::

`cp` and `mv` overwrite the destination without asking. Add `-i` to be asked first, or `-n` to never overwrite. Brace expansion creates several names at once: `mkdir -p app/{src,tests,docs}` makes three directories.

## Reading Files

```terminal
{
  "title": "read files and logs",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "cat notes.txt",
      "output": "Practice notes\n- learn ls, cd and pwd\n- learn grep and find\n- try pipes"
    },
    {
      "comment": "count lines, words and bytes",
      "cmd": "wc -l logs/access.log",
      "output": "48 logs/access.log"
    },
    {
      "comment": "first and last lines of a file",
      "cmd": "head -n 3 logs/access.log",
      "output": "198.51.100.23 - - [23/Oct/2026:08:16:46 +0000] \"GET /index.html HTTP/1.1\" 200 612 \"-\" \"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15\"\n203.0.113.10 - - [23/Oct/2026:08:17:15 +0000] \"GET /index.html HTTP/1.1\" 200 612 \"-\" \"Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0\"\n192.0.2.44 - - [23/Oct/2026:08:19:29 +0000] \"GET /index.html HTTP/1.1\" 200 612 \"-\" \"curl/8.5.0\""
    },
    {
      "cmd": "tail -n 2 logs/access.log",
      "output": "203.0.113.10 - - [23/Oct/2026:09:11:19 +0000] \"GET /index.html HTTP/1.1\" 200 612 \"-\" \"Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0\"\n203.0.113.10 - - [23/Oct/2026:09:12:51 +0000] \"GET /index.html HTTP/1.1\" 200 612 \"-\" \"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15\""
    }
  ]
}
```

- `cat` prints a whole file. It is for short files; for anything longer, use a pager.
- `less file` opens a file one screen at a time. Use the arrow keys or **Space** to move, `/text` to search forward, `n` for the next match, `G` to jump to the end, and `q` to quit. `less +F file` follows a growing file and **Ctrl+C** stops following.
- `head` and `tail` print the first or last 10 lines (`-n` changes the count).
- `tail -f logs/access.log` keeps the file open and prints new lines as they are written, which is how you watch a log while you test something. On systemd machines, many services log to the journal instead, and `journalctl -f` does the same job (Part 10).

## Wildcards and Quoting

The shell expands wildcards **before** the command runs, so `ls *.html` receives a list of file names, not the `*`.

| Pattern | Matches                                             |
| ------- | --------------------------------------------------- |
| `*`     | any characters, including none                      |
| `?`     | exactly one character                               |
| `[abc]` | one character from the set                          |
| `{a,b}` | brace expansion: generates both words, no match     |
| `**/`   | any depth of directories, after `shopt -s globstar` |

Spaces separate arguments, so a file name with a space needs quotes:

```terminal
{
  "title": "wildcards and quotes",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "ls site/*.html",
      "output": "site/about.html\nsite/index.html"
    },
    {
      "cmd": "touch \"meeting notes.txt\""
    },
    {
      "comment": "without quotes, the shell passes two arguments: meeting and notes.txt",
      "cmd": "ls -l meeting notes.txt",
      "output": "ls: cannot access 'meeting': No such file or directory\n-rw-rw-r-- 1 dev dev 72 Oct 23 21:20 notes.txt"
    },
    {
      "cmd": "ls -l \"meeting notes.txt\"",
      "output": "-rw-rw-r-- 1 dev dev 0 Oct 23 21:20 meeting notes.txt"
    },
    {
      "cmd": "rm \"meeting notes.txt\""
    }
  ]
}
```

Double quotes keep the text together but still expand variables (`"$HOME"`). Single quotes keep everything literal (`'$HOME'` stays `$HOME`). When in doubt, quote. Unquoted variables that contain spaces are a common source of broken scripts (Part 9).

## Finding Files

`find` walks a directory tree and tests every entry. It is slower than an index, but it is always accurate and it can act on what it finds.

```terminal
{
  "title": "find files",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "comment": "by name (quote the pattern so the shell does not expand it)",
      "cmd": "find . -name \"*.html\"",
      "output": "./site/about.html\n./site/index.html"
    },
    {
      "comment": "only directories",
      "cmd": "find . -type d",
      "output": ".\n./logs\n./site\n./site/css\n./site/images"
    },
    {
      "comment": "files modified in the last 24 hours that are bigger than 1 KiB",
      "cmd": "find . -type f -mtime -1 -size +1k",
      "output": "./logs/access.log"
    },
    {
      "comment": "run a command on each match",
      "cmd": "find site -name \"*.css\" -exec wc -c {} +",
      "output": "71 site/css/style.css"
    }
  ]
}
```

Useful tests: `-name` and `-iname` (case-insensitive), `-type f` or `-type d`, `-mtime -7` (changed in the last 7 days), `-size +100M`, `-user`, and `-perm`. Add `-maxdepth 2` to limit how deep it goes, and `2>/dev/null` to hide "Permission denied" messages when you search system directories.

To find files by name across the whole disk, `locate name` searches a prebuilt index and answers instantly. On Ubuntu and Debian, install the `plocate` package; a daily systemd timer keeps its index up to date, and `sudo updatedb` refreshes it now.

## Searching Inside Files With grep

`grep` prints the lines that match a pattern.

```terminal
{
  "title": "search text with grep",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "comment": "lines containing a fixed string",
      "cmd": "grep \"wp-login\" logs/access.log",
      "output": "198.51.100.5 - - [23/Oct/2026:08:39:15 +0000] \"GET /wp-login.php HTTP/1.1\" 404 162 \"-\" \"python-requests/2.32.3\""
    },
    {
      "comment": "-c counts matching lines",
      "cmd": "grep -c '\" 404 ' logs/access.log",
      "output": "9"
    },
    {
      "comment": "-r searches a directory, -n adds line numbers, -i ignores case",
      "cmd": "grep -rni \"hello\" site",
      "output": "site/index.html:4:<body><h1>Hello from the Linux lab</h1><p>Served from ~/lab/site.</p></body>"
    },
    {
      "comment": "-l prints only the names of matching files",
      "cmd": "grep -rl \"stylesheet\" site",
      "output": "site/index.html"
    },
    {
      "comment": "-E enables extended regular expressions, -v inverts the match",
      "cmd": "grep -E '\" (404|500) ' logs/access.log | grep -v \"favicon\" | head -n 3",
      "output": "198.51.100.5 - - [23/Oct/2026:08:39:15 +0000] \"GET /wp-login.php HTTP/1.1\" 404 162 \"-\" \"python-requests/2.32.3\"\n198.51.100.23 - - [23/Oct/2026:08:53:16 +0000] \"GET /api/health HTTP/1.1\" 500 21 \"-\" \"curl/8.5.0\"\n192.0.2.44 - - [23/Oct/2026:09:02:38 +0000] \"GET /api/health HTTP/1.1\" 500 21 \"-\" \"Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0\""
    }
  ]
}
```

Other flags you will use often: `-w` matches whole words only, `-o` prints only the matching part, `-A 3` and `-B 3` show lines after and before each match, and `--exclude-dir=node_modules` skips a directory when you search recursively.

## Redirection and Pipes

Every program has three standard streams: **standard input** (0), **standard output** (1) and **standard error** (2). The shell can point them at files or at other programs.

| Syntax            | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `cmd > file`      | write standard output to a file, replacing its contents |
| `cmd >> file`     | append standard output to a file                        |
| `cmd 2> file`     | write standard error to a file                          |
| `cmd > file 2>&1` | write both streams to the same file (order matters)     |
| `cmd &> file`     | Bash shorthand for the line above                       |
| `cmd < file`      | read standard input from a file                         |
| `cmd1 \| cmd2`    | send the output of `cmd1` to the input of `cmd2`        |
| `cmd \| tee file` | show the output and save a copy                         |

A **pipe** connects small tools into a bigger one. Each tool does one job: `cut` takes a column, `sort` sorts, `uniq -c` counts repeated lines, and `head` keeps the top.

```terminal
{
  "title": "analyse a web log with a pipeline",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "comment": "which client IP addresses sent the most requests?",
      "cmd": "cut -d ' ' -f 1 logs/access.log | sort | uniq -c | sort -rn | head -n 3",
      "output": "     16 203.0.113.10\n     15 198.51.100.23\n     10 192.0.2.44"
    },
    {
      "comment": "how many responses per HTTP status code?",
      "cmd": "awk '{print $9}' logs/access.log | sort | uniq -c",
      "output": "     33 200\n      4 304\n      9 404\n      2 500"
    },
    {
      "comment": "save the 404s to a file and count them",
      "cmd": "grep '\" 404 ' logs/access.log > not-found.log"
    },
    {
      "cmd": "wc -l < not-found.log",
      "output": "9"
    },
    {
      "comment": "errors go to standard error, so > does not catch them",
      "cmd": "ls site missing-dir > listing.txt",
      "output": "ls: cannot access 'missing-dir': No such file or directory"
    },
    {
      "cmd": "ls site missing-dir > listing.txt 2> errors.txt"
    },
    {
      "cmd": "cat errors.txt",
      "output": "ls: cannot access 'missing-dir': No such file or directory"
    },
    {
      "comment": "throw away output you do not need",
      "cmd": "ls missing-dir 2> /dev/null || echo \"not there\"",
      "output": "not there"
    },
    {
      "cmd": "rm not-found.log listing.txt errors.txt"
    }
  ]
}
```

`awk '{print $9}'` prints the ninth space-separated field of each line, which in this log format is the status code. `uniq` only collapses lines that are next to each other, which is why `sort` comes first.

`xargs` turns lines of input into arguments for another command. `find . -name "*.log" -print0 | xargs -0 wc -l` counts lines in every log file and copes with spaces in names.

## Chaining Commands and Exit Codes

Every command ends with an **exit code**: 0 means success, anything else means failure. The shell stores the last one in `$?`, and the chaining operators use it.

```terminal
{
  "title": "exit codes and chaining",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ls ~/lab/notes.txt",
      "output": "/home/dev/lab/notes.txt"
    },
    {
      "cmd": "echo $?",
      "output": "0"
    },
    {
      "cmd": "ls ~/lab/nope.txt",
      "output": "ls: cannot access '/home/dev/lab/nope.txt': No such file or directory"
    },
    {
      "cmd": "echo $?",
      "output": "2"
    },
    {
      "comment": "&& runs the next command only on success, || only on failure",
      "cmd": "mkdir -p ~/lab/tmp && cd ~/lab/tmp && pwd",
      "output": "/home/dev/lab/tmp"
    },
    {
      "cmd": "grep -q \"TODO\" ~/lab/notes.txt || echo \"no TODOs left\"",
      "output": "no TODOs left"
    }
  ]
}
```

- `cmd1 ; cmd2` runs both, one after the other.
- `cmd1 && cmd2` runs `cmd2` only if `cmd1` succeeded. Use it for steps that depend on each other.
- `cmd1 || cmd2` runs `cmd2` only if `cmd1` failed.
- `cmd &` runs a command in the background and gives you the prompt back (Part 7 covers jobs).

## History and Keyboard Shortcuts

Bash keeps your command history in `~/.bash_history`. `history` lists it, and these shortcuts save the most time:

| Keys / syntax           | What it does                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| **Ctrl+R**              | search history backwards; press again for older matches               |
| **↑** / **↓**           | previous / next command                                               |
| `!!`                    | the previous command, for example `sudo !!` after "Permission denied" |
| `!$` or **Alt+.**       | the last argument of the previous command                             |
| **Ctrl+C**              | stop the running command                                              |
| **Ctrl+D**              | end of input; at an empty prompt it closes the shell                  |
| **Ctrl+A** / **Ctrl+E** | jump to the start / end of the line                                   |
| **Ctrl+U** / **Ctrl+K** | delete to the start / end of the line                                 |
| **Ctrl+W**              | delete the word before the cursor                                     |
| **Ctrl+L**              | clear the screen                                                      |

Start a command with a space and Bash leaves it out of the history (Ubuntu's default `HISTCONTROL=ignoreboth`). Use that when you must type a secret, but prefer reading secrets from a file or a prompt.

## Aliases, ~/.bashrc and PATH

An **alias** is a shortcut for a longer command. Aliases you type disappear when the shell exits, so put the ones you want to keep in `~/.bashrc`, which Bash reads every time it starts an interactive shell:

```bash
# ~/.bashrc
alias ll='ls -alF'
alias gs='git status'
alias ports='ss -tulpn'
```

Run `source ~/.bashrc` (or open a new terminal) to load the changes. Ubuntu's default `~/.bashrc` already defines `ll`, `la` and `l`.

When you type a command name, the shell looks for it in each directory of the `PATH` variable, from left to right, and runs the first match. A fresh Ubuntu login gets its `PATH` from `/etc/environment`:

```terminal
{
  "title": "where commands come from",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo \"$PATH\" | tr ':' '\\n' | head -n 6",
      "output": "/usr/local/sbin\n/usr/local/bin\n/usr/sbin\n/usr/bin\n/sbin\n/bin"
    },
    {
      "cmd": "command -v grep",
      "output": "/usr/bin/grep"
    }
  ]
}
```

To run your own scripts by name, put them in `~/.local/bin`. Ubuntu's `~/.profile` adds that directory to `PATH` at login if it exists, so create it and log in again. On other systems, add `export PATH="$HOME/.local/bin:$PATH"` to `~/.bashrc`.

## Editing Files in the Terminal

You need a terminal editor for configuration files on servers.

- **nano** is the easiest. The shortcuts are listed at the bottom of the screen: **Ctrl+O** saves, **Ctrl+X** exits, **Ctrl+W** searches, and `^` means Ctrl.
- **vim** (or `vi`) is installed almost everywhere. It starts in normal mode: press `i` to type, **Esc** to stop typing, then `:wq` and Enter to save and quit, or `:q!` to quit without saving. Run `vimtutor` for a 30-minute introduction.

Set the editor that other tools open (for example `crontab -e`, `git commit` and `visudo`) with `export EDITOR=nano` in `~/.bashrc`, or on Debian and Ubuntu with `sudo update-alternatives --config editor`.

:::note
Ubuntu 25.10 and 26.04 LTS replaced most GNU coreutils (`ls`, `sort`, `cut`, `date` and many more) with the Rust rewrite from the uutils project; `cp`, `mv` and `rm` followed in Ubuntu 26.10. The commands and options in this part work the same way there; a few edge cases and error messages differ. See [what changes with Rust coreutils](/posts/ubuntu-26-10-rust-coreutils-what-changes) if you maintain scripts.
:::

## Common Mistakes

- **Unquoted names with spaces.** `rm my file.txt` tries to delete two files, `my` and `file.txt`. Quote it, or press Tab and let the shell escape it.
- **Overwriting with `>`.** `sort data.txt > data.txt` empties the file before `sort` reads it. Write to a new file, then move it. `set -o noclobber` makes `>` refuse to overwrite existing files.
- **`sudo` with a redirection.** In `sudo echo "x" > /etc/file`, the redirection runs in your own shell, without root, and fails. Use `echo "x" | sudo tee /etc/file` (or `tee -a` to append). See [how to redirect output to a privileged file](/posts/sudo-redirect-output-to-privileged-location).
- **`rm -rf $DIR/` with an empty variable.** If `DIR` is empty, that becomes `rm -rf /`. Quote variables and use `${DIR:?}` in scripts so an empty value stops the command.
- **Copying commands from the web without reading them.** Check what a command does before you paste it, especially when it starts with `sudo` or pipes a download into `bash`.

## Summary

- The prompt shows user, host and directory; `$` is a regular user, `#` is root.
- `pwd`, `ls` and `cd` move you around; Tab completes names; `~` is your home directory.
- `mkdir -p`, `cp -r`, `mv` and `rm -r` manage files. `rm` has no undo.
- `less`, `head`, `tail` and `tail -f` read files and logs.
- `find` locates files by name, type, age and size; `grep` finds text inside them.
- `>`, `>>`, `2>` and `|` connect commands, and exit codes drive `&&` and `||`.

Next: [Linux File System Hierarchy](/guides/introduction-to-linux/04-file-system-hierarchy), where you learn what lives in `/etc`, `/var` and `/usr`, and how file permissions work.

## Keep Learning

- Practice in the browser: [Linux Terminal simulator](/games/linux-terminal)
- [Linux Command Line Quiz](/quizzes/linux-quiz)
- [What does 2>&1 mean?](/posts/what-does-2-and-1-mean-linux-bash)
- [Find files containing specific text](/posts/find-files-containing-specific-text-linux)
- Interview questions: [using grep for text search](/interview-questions/junior/linux-grep-text-search)
