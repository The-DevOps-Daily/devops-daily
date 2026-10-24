---
title: 'What Is Bash? Versions, Startup Files and Your First Script'
description: 'What Bash is, which version you have and why it matters (5.2, 5.3, macOS 3.2), sh versus Bash, which startup files load when, and your first script.'
order: 1
---

**Bash** (the Bourne Again SHell) is the program that reads what you type in a Linux terminal, works out what you meant, and runs it. It is also a programming language: the same commands, saved in a file, become a **script**. That double role is why Bash is everywhere in DevOps work. It is the login shell on most Linux servers, CI systems run your pipeline steps with it, and container entrypoints, Git hooks, cloud-init files and install scripts are very often Bash.

This part explains what Bash is, which version you have and why the version matters, how `sh` differs from Bash, and which startup files Bash reads when. At the end you set up the practice directory the rest of the guide uses and run your first script.

## Prerequisites

- A Linux, macOS or Windows computer with a terminal. The tabs below show how to get Bash on each.
- Basic terminal use: moving around with `cd` and `ls`, and editing a file. The [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface) part of the Linux guide covers it.
- **ShellCheck**, which this guide runs on every script: `sudo apt install shellcheck` on Debian and Ubuntu, `sudo dnf install ShellCheck` on Fedora, `brew install shellcheck` on macOS. Later parts also use `jq`, `curl` and `nc` (on Debian and Ubuntu: `sudo apt install jq curl netcat-openbsd`), and Part 10 adds shfmt and bats.

The output in this guide comes from **Bash 5.2.21 on Ubuntu 24.04.5 LTS**, run as a normal user called `dev` on a machine called `devbox`. Blocks that use another version say so: Bash 5.3.9 on Ubuntu 26.04.1 LTS for the new 5.3 features, and Bash 3.2.57, the release macOS still ships, for portability checks.

## What a Shell Does

A **terminal** (GNOME Terminal, Windows Terminal, iTerm2, the VS Code panel) is the window: it draws text and sends your keystrokes on. The **shell** is the program running inside it. Bash reads a line, expands variables, wildcards and other special syntax, finds the program you named, starts it, waits for it to finish and shows the next prompt.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Terminal", "sub": "window and keyboard", "icon": "cpu", "tone": "slate" },
    { "label": "Bash", "sub": "reads and expands the line", "icon": "gear", "tone": "accent" },
    { "label": "Program", "sub": "ls, git, curl, a script", "icon": "box", "tone": "blue" },
    { "label": "Kernel", "sub": "fork, exec, files", "icon": "server", "tone": "violet" }
  ]
}
```

Most of what makes Bash tricky happens in the second box. Before a command runs, Bash splits the line into words, replaces `$name` with values, turns `*.log` into file names and removes quotes. [Part 2](/guides/introduction-to-bash/02-bash-basics) walks through that process step by step, because almost every Bash bug is a surprise in it.

## A Short History, and Why the Version Matters

The original Unix shell for scripts was the **Bourne shell** (`sh`), written by Stephen Bourne at Bell Labs and released with Version 7 Unix in 1979. Brian Fox wrote Bash for the GNU Project as a free replacement and released it in 1989. Chet Ramey has maintained it since the early 1990s. Bash runs almost every Bourne shell script and adds arrays, `[[ ]]`, brace expansion, better interactive editing and much more.

New Bash versions add features that scripts come to depend on, so the version on the machine that runs your script matters:

| Version | Released       | Features this guide uses                                                                         |
| ------- | -------------- | ------------------------------------------------------------------------------------------------ |
| 3.2     | October 2006   | The last GPLv2 release, and still `/bin/bash` on macOS                                           |
| 4.0     | February 2009  | Associative arrays, `mapfile`, `**` with `globstar`, `${var,,}` and `${var^^}`, `;&` in `case`   |
| 4.2     | February 2011  | `[[ -v name ]]`, `printf '%(...)T'` for dates, `lastpipe`, `${a[-1]}` for the last array element |
| 4.3     | February 2014  | Namerefs (`declare -n`), `wait -n`                                                               |
| 4.4     | September 2016 | `${var@Q}` transformations, `local -`, `inherit_errexit`, empty arrays allowed under `set -u`    |
| 5.0     | January 2019   | `$EPOCHSECONDS` and `$EPOCHREALTIME`                                                             |
| 5.1     | December 2020  | `$SRANDOM`, `${var@U}` and `${var@L}`                                                            |
| 5.2     | September 2022 | `&` in `${var/pattern/replacement}` inserts the match (`patsub_replacement`), `globskipdots`     |
| 5.3     | July 2025      | `${ command; }` command substitution without a subshell, `GLOBSORT`, `source -p`                 |

Upstream Bash is at **5.3 with patch 20** (5.3.20, September 2026). What you get depends on your system:

| System                          | Bash version (October 2026)                     |
| ------------------------------- | ----------------------------------------------- |
| Ubuntu 24.04 LTS                | 5.2.21                                          |
| Ubuntu 26.04 LTS                | 5.3.9                                           |
| Debian 13 (trixie)              | 5.2.37                                          |
| Fedora 44                       | 5.3.9                                           |
| RHEL 10, AlmaLinux 10, Rocky 10 | 5.2.26                                          |
| RHEL 9 and its rebuilds         | 5.1.8                                           |
| Alpine Linux 3.24               | 5.3.9, but only after `apk add bash`            |
| macOS                           | 3.2.57 as `/bin/bash`; zsh is the default shell |
| Homebrew (macOS and Linux)      | 5.3.20                                          |

The practical rule: **target Bash 4.4 or newer**, test on the oldest version you deploy to, and treat macOS's 3.2 as a different language unless you install a newer Bash there. [Part 10](/guides/introduction-to-bash/10-bash-best-practices) shows what breaks under 3.2.

## Which Bash Do You Have?

```terminal
{
  "title": "check the version",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash --version | head -n 1",
      "output": "GNU bash, version 5.2.21(1)-release (aarch64-unknown-linux-gnu)"
    },
    {
      "cmd": "echo \"$BASH_VERSION\"",
      "output": "5.2.21(1)-release"
    },
    {
      "comment": "the major and minor version as numbers, handy in scripts",
      "cmd": "echo \"${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}\"",
      "output": "5.2"
    },
    {
      "comment": "$SHELL is your login shell, not necessarily the shell you are in",
      "cmd": "echo \"$SHELL\"",
      "output": "/bin/bash"
    },
    {
      "comment": "the program running as this shell's process ID",
      "cmd": "ps -p $$ -o comm=",
      "output": "bash"
    }
  ]
}
```

Two checks trip people up. `$SHELL` is set at login from your account's entry in `/etc/passwd`; it does not change when you start another shell, so it cannot tell you what you are running now. `$BASH_VERSION` is set only by Bash, so an empty value means you are in another shell.

```tabs
{
  "title": "Get a current Bash",
  "tabs": [
    {
      "label": "Linux",
      "lang": "bash",
      "code": "# Bash is preinstalled on Ubuntu, Debian, Fedora and RHEL. Keep it updated\n# with the rest of the system:\nsudo apt update && sudo apt install --only-upgrade bash   # Debian, Ubuntu\nsudo dnf upgrade bash                                      # Fedora, RHEL\n\n# Alpine and other minimal container images do not include Bash:\napk add bash"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# /bin/bash is 3.2.57 and stays that way. Install a current Bash with\n# Homebrew (https://brew.sh); it goes to /opt/homebrew/bin on Apple silicon\n# and /usr/local/bin on Intel Macs, and brew --prefix knows which:\nbrew install bash\nbash_path=\"$(brew --prefix)/bin/bash\"\n\"$bash_path\" --version | head -n 1\n\n# Scripts that start with #!/usr/bin/env bash now run with it, as long as\n# Homebrew's directory comes before /bin in your PATH.\n# To make it your login shell as well:\necho \"$bash_path\" | sudo tee -a /etc/shells\nchsh -s \"$bash_path\""
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Use WSL 2, which runs a real Linux distribution (Ubuntu by default).\n# In an administrator PowerShell window:\nwsl --install\n# Restart, open \"Ubuntu\" from the Start menu, and Bash is your shell.\n\n# Git Bash, which comes with Git for Windows, also runs Bash, but many\n# Linux tools are missing or behave differently. Use WSL for this guide."
    }
  ]
}
```

If you would rather practise on a fresh Linux server than on your own machine, any small cloud server with Ubuntu 24.04 LTS works. On DigitalOcean, you can [create a Droplet](https://m.do.co/c/2a9bba940f39) with the smallest size and connect with `ssh`. That is a referral link: new accounts that sign up through it get DigitalOcean's standard [signup credit](https://docs.digitalocean.com/platform/billing/signup-credit/) ($5, valid for 90 days, checked in October 2026) and must add a payment method before creating a Droplet, and if you later spend $25 there, DevOps Daily gets $25 in credit ([referral program](https://docs.digitalocean.com/platform/teams/refer-others/)). Delete the Droplet when you are done, so it stops costing money.

## sh Is Not Bash

Many tools run commands with `/bin/sh`, not Bash, and on Debian and Ubuntu `/bin/sh` is **dash**, a small and fast POSIX shell. Bash features such as `[[ ]]`, arrays and `{1..5}` do not exist there:

```terminal
{
  "title": "the same line in sh and in bash",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "readlink -f /bin/sh",
      "output": "/usr/bin/dash"
    },
    {
      "cmd": "sh -c 'if [[ \"abc\" == a* ]]; then echo \"starts with a\"; fi'",
      "output": "sh: 1: [[: not found"
    },
    {
      "cmd": "bash -c 'if [[ \"abc\" == a* ]]; then echo \"starts with a\"; fi'",
      "output": "starts with a"
    },
    {
      "cmd": "sh -c 'echo \"BASH_VERSION is [$BASH_VERSION]\"'",
      "output": "BASH_VERSION is []"
    }
  ]
}
```

On Fedora and RHEL, `/bin/sh` is Bash running in POSIX mode, which hides the problem until the script runs on Debian, Ubuntu or Alpine (BusyBox `ash`). This matters in places you might not think of as "running a script":

- **cron** runs each crontab line with `/bin/sh`.
- **Dockerfile** `RUN` lines use `/bin/sh -c` unless you add a `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` instruction.
- **Makefile** recipes use `/bin/sh` unless you set `SHELL := /bin/bash`.
- **GitHub Actions** runs a `run:` step on Linux with `bash -e {0}` by default, and with `bash --noprofile --norc -eo pipefail {0}` when you write `shell: bash`. The second one also catches failures in the middle of a pipeline.

The fix is simple: start every Bash script with a Bash shebang (`#!/usr/bin/env bash` or `#!/bin/bash`) and run it directly or with `bash script.sh`, never with `sh script.sh`. [Part 7](/guides/introduction-to-bash/07-script-permissions) covers shebangs in depth, and [the difference between sh and Bash](/posts/difference-between-sh-and-bash) lists more differences.

## Login, Interactive and Non-Interactive Shells

Bash reads different startup files depending on how it starts. This explains two classic puzzles: "my alias works in the terminal but not in my script" and "the command works when I type it but not from cron".

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "login", "label": "Login shell", "sub": "SSH, console, bash -l", "icon": "lock", "tone": "violet" },
      { "id": "inter", "label": "Interactive shell", "sub": "new terminal tab, bash", "icon": "cpu", "tone": "blue" },
      { "id": "script", "label": "Non-interactive", "sub": "scripts, bash -c, cron", "icon": "gear", "tone": "slate" }
    ],
    [
      { "id": "profile", "label": "/etc/profile, then the first of", "sub": "~/.bash_profile, ~/.bash_login, ~/.profile", "icon": "box", "tone": "violet" },
      { "id": "bashrc", "label": "~/.bashrc", "sub": "after /etc/bash.bashrc on Debian and Ubuntu", "icon": "box", "tone": "blue" },
      { "id": "none", "label": "No startup file", "sub": "only the file named in $BASH_ENV", "icon": "box", "tone": "slate" }
    ]
  ],
  "edges": [
    ["login", "profile"],
    ["profile", "bashrc", "Ubuntu's ~/.profile sources it"],
    ["inter", "bashrc"],
    ["script", "none"]
  ]
}
```

You can watch this happen. Add a line that prints a message to the end of `~/.profile` and `~/.bashrc`, then start each kind of shell:

```terminal
{
  "title": "which startup files run",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo 'echo \"  ~/.profile ran\" # startup-test' >> ~/.profile"
    },
    {
      "cmd": "echo 'echo \"  ~/.bashrc ran\" # startup-test' >> ~/.bashrc"
    },
    {
      "comment": "an interactive shell, like a new terminal tab",
      "cmd": "bash -i -c 'echo \"interactive shell\"'",
      "output": "  ~/.bashrc ran\ninteractive shell"
    },
    {
      "comment": "a login shell, as an SSH login or a console login starts (here running one command)",
      "cmd": "bash -l -c 'echo \"login shell\"'",
      "output": "  ~/.profile ran\nlogin shell"
    },
    {
      "comment": "a script: no startup files at all",
      "cmd": "bash -c 'echo \"non-interactive shell\"'",
      "output": "non-interactive shell"
    }
  ]
}
```

The login shell ran `~/.profile`, which on Ubuntu sources `~/.bashrc`, but the default Ubuntu `~/.bashrc` starts with a check that stops it early in a non-interactive shell, so its last line never ran. The script read neither file. Two rules follow:

- Put **environment variables** such as `PATH` changes in `~/.profile` (or `~/.bash_profile`), and **interactive settings** such as aliases, prompt and completion in `~/.bashrc`.
- Do not rely on aliases or functions from `~/.bashrc` inside scripts. A script should set up everything it needs itself, including `PATH` when it runs from cron or systemd.

One exception: Debian and Ubuntu build Bash so that when `sshd` runs a command for you (`ssh devbox 'uptime'`), it reads `~/.bashrc` even though the shell is not interactive. That is one reason the default `~/.bashrc` returns early for non-interactive shells, and why anything that prints text belongs below that check: output from `~/.bashrc` breaks tools such as `scp` and `rsync` that talk over the same connection.

Be careful with `~/.bash_profile`: if it exists, Bash reads it **instead of** `~/.profile`. If you create one, add `[[ -f ~/.profile ]] && . ~/.profile` to it, or the settings in `~/.profile` stop loading. After editing `~/.bashrc`, apply the changes to your current terminal with `source ~/.bashrc` (see [how to reload .bashrc](/posts/reload-bashrc-without-logout)).

Remove the two test lines when you are done. The `# startup-test` comment marks them, so `sed` deletes exactly those lines and nothing else:

```terminal
{
  "title": "undo the experiment",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -i '/# startup-test$/d' ~/.profile ~/.bashrc"
    },
    {
      "cmd": "grep -c 'startup-test' ~/.profile ~/.bashrc",
      "output": "/home/dev/.profile:0\n/home/dev/.bashrc:0"
    }
  ]
}
```

## Set Up the Practice Directory

The examples in this guide work with a small set of files in `~/bash-practice`: a web server log with 40 requests, an application log, a config file, a server list, a CSV inventory and a directory of files with awkward names. Create them with this script. Open an editor in your home directory with `nano setup-practice.sh`, paste the script, save with **Ctrl+O** and **Enter**, and exit with **Ctrl+X**:

```bash
#!/usr/bin/env bash
# setup-practice.sh: create ~/bash-practice, the files this guide works with
set -euo pipefail

dir="$HOME/bash-practice"
if [[ -e "$dir" ]]; then
    echo "$dir already exists; remove it first to start fresh" >&2
    exit 1
fi
mkdir -p "$dir/logs" "$dir/config" "$dir/files"
cd "$dir"

# 40 web server requests in nginx's "combined" format, the same on every run
ips=(203.0.113.10 198.51.100.23 192.0.2.44 203.0.113.77 198.51.100.5)
requests=("GET /" "GET /about.html" "POST /api/orders" "GET /api/orders/1042"
          "GET /api/users" "POST /login" "GET /favicon.ico" "GET /wp-login.php"
          "GET /api/health" "GET /index.html")
statuses=(200 200 201 200 200 302 404 404 500 200)
sizes=(612 418 88 1290 734 0 162 162 21 612)
for (( i = 0; i < 40; i++ )); do
    ip=${ips[(i * i + i / 3) % 5]}
    r=$(( (i * 7 + i / 4) % 10 ))
    t=$(( 8 * 3600 + 15 * 60 + i * 97 ))
    printf '%s - - [23/Oct/2026:%02d:%02d:%02d +0000] "%s HTTP/1.1" %s %s "-" "curl/8.5.0"\n' \
        "$ip" $(( t / 3600 )) $(( t % 3600 / 60 )) $(( t % 60 )) \
        "${requests[r]}" "${statuses[r]}" "${sizes[r]}"
done > logs/access.log

cat > logs/app.log <<'LOG'
2026-10-23T08:15:02Z INFO  server started on port 8080
2026-10-23T08:16:40Z WARN  slow query took 1250 ms
2026-10-23T08:17:03Z ERROR payment provider timeout order=1042
2026-10-23T08:21:19Z INFO  order created order=1043
2026-10-23T08:24:55Z ERROR database connection refused
2026-10-23T08:25:00Z INFO  database connection restored
LOG

cat > config/app.env <<'ENV'
# settings for the notes API
APP_NAME="notes api"
APP_PORT=8080
LOG_LEVEL=info
ENV

printf '%s\n' "# web tier" web-1.example.com web-2.example.com "" "# database" db-1.example.com > servers.txt
printf '%s\n' name,role,port web-1,web,80 web-2,web,80 db-1,db,5432 cache-1,cache,6379 > inventory.csv
printf 'quarterly numbers\n' > "files/monthly report.txt"
printf 'buy milk\n' > files/notes.txt
printf 'id,total\n1,9.50\n' > files/data.csv
printf 'not a real photo\n' > files/photo.JPG
printf 'API_TOKEN=change-me\n' > files/.env

echo "created $dir"
```

```terminal
{
  "title": "create ~/bash-practice",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash setup-practice.sh",
      "output": "created /home/dev/bash-practice"
    },
    {
      "cmd": "cd ~/bash-practice && find . -type f | sort",
      "output": "./config/app.env\n./files/.env\n./files/data.csv\n./files/monthly report.txt\n./files/notes.txt\n./files/photo.JPG\n./inventory.csv\n./logs/access.log\n./logs/app.log\n./servers.txt"
    },
    {
      "cmd": "head -n 3 logs/access.log",
      "output": "203.0.113.10 - - [23/Oct/2026:08:15:00 +0000] \"GET / HTTP/1.1\" 200 612 \"-\" \"curl/8.5.0\"\n198.51.100.23 - - [23/Oct/2026:08:16:37 +0000] \"GET /wp-login.php HTTP/1.1\" 404 162 \"-\" \"curl/8.5.0\"\n198.51.100.5 - - [23/Oct/2026:08:18:14 +0000] \"GET /api/users HTTP/1.1\" 200 734 \"-\" \"curl/8.5.0\""
    }
  ]
}
```

Do not worry if parts of the script look unfamiliar. By [Part 6](/guides/introduction-to-bash/06-functions) you will have seen every line of it explained. The script refuses to overwrite an existing directory. To get back to the starting state, run `rm -rf ~/bash-practice && bash ~/setup-practice.sh`, but note that this deletes everything in `~/bash-practice`, including the scripts, libraries and tests you write in later parts. To keep them, rename the directory instead (`mv ~/bash-practice ~/bash-practice.old`) before running the setup script again.

## Your First Script

Save this as `~/bash-practice/hello.sh`:

```bash
#!/usr/bin/env bash
# hello.sh: say hello and show a few facts about this shell

name="${1:-world}"                     # the first argument, or "world"
log_lines=$(wc -l < logs/access.log)   # command substitution: capture output

printf 'Hello, %s!\n' "$name"
printf 'This is Bash %s on %s.\n' "$BASH_VERSION" "$HOSTNAME"
printf 'The practice log has %d requests.\n' "$log_lines"
```

```terminal
{
  "title": "check it, then run it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -n hello.sh && echo \"syntax OK\"",
      "output": "syntax OK"
    },
    {
      "cmd": "shellcheck hello.sh && echo \"shellcheck: no warnings\"",
      "output": "shellcheck: no warnings"
    },
    {
      "cmd": "bash hello.sh",
      "output": "Hello, world!\nThis is Bash 5.2.21(1)-release on devbox.\nThe practice log has 40 requests."
    },
    {
      "cmd": "chmod +x hello.sh"
    },
    {
      "cmd": "./hello.sh \"Bash learner\"",
      "output": "Hello, Bash learner!\nThis is Bash 5.2.21(1)-release on devbox.\nThe practice log has 40 requests."
    }
  ]
}
```

Line by line:

- `#!/usr/bin/env bash` is the **shebang**. When you run `./hello.sh`, the kernel reads it and starts `bash` to run the file. It must be the very first line.
- `#` starts a comment, both on its own line and after a command.
- `name="${1:-world}"` stores the first argument, or `world` when there is none. There are no spaces around `=`; with spaces, Bash would try to run a command called `name`.
- `$(...)` runs a command and captures its output. `wc -l < logs/access.log` counts lines read from standard input, so the output is just the number. Because the script uses a relative path, run it from `~/bash-practice`.
- `printf` prints formatted text. It is more predictable than `echo`, as [Part 9](/guides/introduction-to-bash/09-bash-tools) shows.

`bash -n` checks the syntax without running anything, and [ShellCheck](https://www.shellcheck.net/) finds common bugs. Use both on every script you write; this guide does. [Part 7](/guides/introduction-to-bash/07-script-permissions) explains `chmod +x` and the different ways to run a script.

## New in Bash 5.3

Bash 5.3 (July 2025) is the default on Ubuntu 26.04 LTS, Fedora 43 and later, Alpine 3.23 and later, and Homebrew. Its biggest addition is a form of command substitution that runs in the current shell instead of a subshell, so it is faster and can change variables:

```terminal
{
  "title": "Bash 5.3.9 on Ubuntu 26.04.1",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"$BASH_VERSION\"",
      "output": "5.3.9(1)-release"
    },
    {
      "comment": "the classic form runs in a subshell: the counter change is lost",
      "cmd": "count=0; out=$( (( count++ )); echo \"inside: $count\" ); echo \"$out, after: $count\"",
      "output": "inside: 1, after: 0"
    },
    {
      "comment": "the new form runs in the current shell (note the space and the semicolon)",
      "cmd": "count=0; out=${ (( count++ )); echo \"inside: $count\"; }; echo \"$out, after: $count\"",
      "output": "inside: 1, after: 1"
    },
    {
      "comment": "the ${| ...; } form returns whatever the commands put in REPLY",
      "cmd": "out=${| REPLY=$(( 6 * 7 )); }; echo \"$out\"",
      "output": "42"
    }
  ]
}
```

On Bash 5.2 the same line is a syntax error:

```terminal
{
  "title": "Bash 5.2.21 on Ubuntu 24.04.5",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "count=0; out=${ (( count++ )); echo \"inside: $count\"; }; echo \"$out, after: $count\"",
      "output": "bash: ${ (( count++ )); echo \"inside: $count\"; }: bad substitution"
    }
  ]
}
```

Other 5.3 additions include `GLOBSORT` to sort wildcard results by size or modification time, `source -p` to search a custom path, and `BASH_MONOSECONDS` for timing. Debian 13, Ubuntu 24.04 and RHEL 10 stay on 5.2, so use 5.3 features only in scripts that will never run there. This guide marks every feature that needs a newer Bash.

## Common Mistakes

- **Checking `$SHELL` to see which shell you are in.** It shows your login shell. Use `echo "$BASH_VERSION"` or `ps -p $$`.
- **Running Bash scripts with `sh script.sh`.** On Debian and Ubuntu, that is dash. Run them as `./script.sh` or `bash script.sh`.
- **Expecting a script to see your aliases and `~/.bashrc` settings.** Non-interactive shells do not read it.
- **Creating `~/.bash_profile` and wondering why `~/.profile` stopped working.** Bash reads only the first of the two it finds.
- **Writing for your laptop's Bash.** A script that uses 5.3 syntax fails on a server with 5.2, and one that uses associative arrays fails on macOS's 3.2.

## Summary

- Bash is both an interactive shell and a scripting language, and it is the default shell on most Linux systems.
- Check the version with `$BASH_VERSION` or `$BASH_VERSINFO`. Ubuntu 24.04 and Debian 13 ship 5.2, Ubuntu 26.04 and Fedora ship 5.3, and macOS ships 3.2.
- `/bin/sh` is often not Bash. Give Bash scripts a Bash shebang.
- Login shells read `~/.profile` or `~/.bash_profile`, interactive shells read `~/.bashrc`, and scripts read neither.
- `bash -n` and `shellcheck` catch mistakes before a script runs.

Next: [Bash Basics](/guides/introduction-to-bash/02-bash-basics), where you follow a command line through every step Bash takes before it runs it.

## Keep Learning

- [What is the difference between sh and Bash?](/posts/difference-between-sh-and-bash)
- [Which shebang should a Bash script use?](/posts/preferred-bash-shebang)
- [Reload .bashrc without logging out](/posts/reload-bashrc-without-logout)
- Practise commands in the browser with the [Linux Terminal simulator](/games/linux-terminal)
