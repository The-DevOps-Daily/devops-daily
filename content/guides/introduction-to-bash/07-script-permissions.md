---
title: 'How to Make a Bash Script Executable and Run It (chmod +x)'
description: 'Make a Bash script executable with chmod +x, pick a shebang, run it from anywhere, and fix Permission denied, bad interpreter and command not found.'
order: 7
---

To run a Bash script by its name, it needs two things: the **execute permission** and a **shebang** line that says which interpreter runs it. The short version:

```bash
chmod +x deploy.sh     # once: allow the file to be executed
./deploy.sh            # run it from the directory it is in
bash deploy.sh         # or run it with bash, which needs no execute permission
```

The rest of this part explains what actually happens when you type `./deploy.sh`, which permissions matter and for whom, how to choose a shebang, the different ways to run a script and how they differ, how to make a script a command you can run from anywhere, what changes when cron, systemd or `sudo` runs it, and how to fix the errors you will meet. By the end, the `logstat` tool from [Part 6](/guides/introduction-to-bash/06-functions) runs from any directory.

## Prerequisites

- The `~/bash-practice/logstat` script and `lib/logstat.sh` from [Part 6](/guides/introduction-to-bash/06-functions).
- How Linux permissions work (owner, group and others; `rwx`; octal modes). The [file permissions section of the Linux guide](/guides/introduction-to-linux/04-file-system-hierarchy) explains them; this part covers what is specific to scripts.

## What Happens When You Run ./script

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Bash", "sub": "forks, then exec ./logstat", "icon": "gear", "tone": "accent" },
    { "label": "Kernel", "sub": "needs x; reads #! line", "icon": "server", "tone": "violet" },
    { "label": "/usr/bin/env", "sub": "finds bash in PATH", "icon": "box", "tone": "slate" },
    { "label": "bash ./logstat", "sub": "needs r to read the file", "icon": "cpu", "tone": "green" }
  ]
}
```

1. Your shell starts a new process and asks the kernel to execute `./logstat`.
2. The kernel checks that you have **execute** permission, then looks at the first two bytes. `#!` marks a script, and the rest of the line names the interpreter.
3. The kernel runs that interpreter with the script's path as an argument, here `/usr/bin/env bash ./logstat`, and `env` finds `bash` in your `PATH`.
4. Bash opens the file and reads it, which needs **read** permission.

So a script needs both `r` and `x`, unlike a compiled program, which needs only `x`.

## Permissions a Script Needs

```terminal
{
  "title": "no x, no run",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ls -l logstat",
      "output": "-rw-rw-r-- 1 dev dev 528 Oct 24 06:21 logstat"
    },
    {
      "cmd": "./logstat status logs/access.log; echo \"exit code: $?\"",
      "output": "bash: ./logstat: Permission denied\nexit code: 126"
    },
    {
      "comment": "bash reads the file itself, so it does not need x",
      "cmd": "bash logstat class logs/access.log",
      "output": "24\t2xx\n8\t4xx\n4\t3xx\n4\t5xx"
    },
    {
      "cmd": "chmod u+x logstat && ls -l logstat",
      "output": "-rwxrw-r-- 1 dev dev 528 Oct 24 06:21 logstat"
    },
    {
      "cmd": "./logstat class logs/access.log",
      "output": "24\t2xx\n8\t4xx\n4\t3xx\n4\t5xx"
    }
  ]
}
```

Execute permission without read permission is not enough for a script, as the kernel starts Bash but Bash cannot open the file:

```terminal
{
  "title": "x without r",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "chmod 100 logstat && ls -l logstat",
      "output": "---x------ 1 dev dev 528 Oct 24 06:21 logstat"
    },
    {
      "cmd": "./logstat class logs/access.log; echo \"exit code: $?\"",
      "output": "bash: ./logstat: Permission denied\nexit code: 126"
    },
    {
      "cmd": "chmod 755 logstat"
    }
  ]
}
```

### Which Class of Permissions Applies

The kernel picks **one** set of permission bits: the owner's if you own the file, otherwise the group's if you are in the file's group, otherwise the others'. It does not fall back to a more generous set. If you own a script with mode `070`, you cannot run it, even though its group could:

```terminal
{
  "title": "the owner gets only the owner bits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cp logstat owned-test && chmod 070 owned-test && ls -l owned-test",
      "output": "----rwx--- 1 dev dev 528 Oct 24 06:21 owned-test"
    },
    {
      "cmd": "./owned-test; echo \"exit code: $?\"",
      "output": "bash: ./owned-test: Permission denied\nexit code: 126"
    },
    {
      "cmd": "rm -f owned-test"
    }
  ]
}
```

For the common question "who needs which permission to run a script":

| Who runs it                         | Bits that must include `r` and `x` | Typical mode |
| ----------------------------------- | ---------------------------------- | ------------ |
| Only you (the owner)                | owner                              | `700`        |
| You and members of the file's group | owner and group                    | `750`        |
| Everyone on the machine             | owner, group and others            | `755`        |

A script that root runs must not be writable by anyone else: owned by root, mode `755` or stricter, in a directory only root can write to. Otherwise anyone who can edit it runs code as root. A script that contains secrets must not be readable by others either (`700` or `750`); better, keep the secrets in a separate file with mode `600`.

### chmod +x and the umask

`chmod u+x` adds execute for the owner only. `chmod +x`, with no `u`, `g` or `o`, adds it for everyone **except** the bits your umask masks:

```terminal
{
  "title": "chmod +x respects the umask",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "umask",
      "output": "0002"
    },
    {
      "cmd": "touch a.sh && chmod +x a.sh && ls -l a.sh",
      "output": "-rwxrwxr-x 1 dev dev 0 Oct 24 06:21 a.sh"
    },
    {
      "cmd": "umask 077; touch b.sh && chmod 600 b.sh && chmod +x b.sh && ls -l b.sh; umask 0002",
      "output": "-rwx------ 1 dev dev 0 Oct 24 06:21 b.sh"
    },
    {
      "cmd": "rm a.sh b.sh"
    }
  ]
}
```

Use an explicit mode such as `chmod 755` or `chmod u+x,go-rwx` when the result matters, for example in an install script.

## Choose a Shebang

The shebang must be the first line, must start with `#!` and must name the interpreter by **absolute path**:

| Shebang               | When to use it                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#!/usr/bin/env bash` | Portable: uses the first `bash` in `PATH`, such as Homebrew's 5.3 on macOS. The usual choice.                                                                        |
| `#!/bin/bash`         | Always the system Bash. Safer for root-run scripts, where `PATH` should not decide the interpreter. Fails on systems without `/bin/bash`, such as FreeBSD and NixOS. |
| `#!/bin/sh`           | Only for scripts that use nothing but POSIX shell features. On Debian and Ubuntu, that is dash.                                                                      |

On Linux, everything after the interpreter is passed as **one** argument, so `env` cannot take extra options the usual way. `env -S` (GNU coreutils 8.30+ and macOS) splits them:

```terminal
{
  "title": "options on the shebang line",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '#!/usr/bin/env bash -e\\necho \"running\"\\n' > opts.sh && chmod +x opts.sh && ./opts.sh",
      "output": "/usr/bin/env: ‘bash -e’: No such file or directory\n/usr/bin/env: use -[v]S to pass options in shebang lines"
    },
    {
      "cmd": "printf '#!/usr/bin/env -S bash -e\\necho \"running\"\\n' > opts.sh && ./opts.sh",
      "output": "running"
    },
    {
      "cmd": "rm opts.sh"
    }
  ]
}
```

Even when it works, an option on the shebang line is ignored when someone runs `bash script.sh`. Put `set -euo pipefail` inside the script instead ([Part 10](/guides/introduction-to-bash/10-bash-best-practices)). [Which shebang should a Bash script use?](/posts/preferred-bash-shebang) compares the options in more detail.

### A Script Without a Shebang

Without a shebang, the result depends on who starts the script. Bash runs the file itself, in a child Bash. Most other programs, including `find -exec`, `xargs`, `env` and many process managers, fall back to `/bin/sh` (glibc's `execvp` does that), so a Bash script may suddenly run in dash:

```terminal
{
  "title": "the same file, two interpreters",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf 'if [[ -n \"$BASH_VERSION\" ]]; then echo \"run by bash $BASH_VERSION\"; fi\\n' > noshebang.sh && chmod +x noshebang.sh"
    },
    {
      "cmd": "./noshebang.sh",
      "output": "run by bash 5.2.21(1)-release"
    },
    {
      "cmd": "find . -maxdepth 1 -name noshebang.sh -exec {} \\;",
      "output": "./noshebang.sh: 1: [[: not found"
    },
    {
      "cmd": "rm noshebang.sh"
    }
  ]
}
```

Always write the shebang.

## Ways to Run a Script

| Command                       | New process?           | Needs `x`? | Shebang used? | Variables and `cd` survive? |
| ----------------------------- | ---------------------- | ---------- | ------------- | --------------------------- |
| `./script`                    | yes                    | yes        | yes           | no                          |
| `script` (in `PATH`)          | yes                    | yes        | yes           | no                          |
| `bash script`                 | yes                    | no         | no            | no                          |
| `source script` or `. script` | no, runs in your shell | no         | no            | yes                         |
| `exec ./script`               | replaces your shell    | yes        | yes           | your shell is gone          |

Running a script starts a new process, so nothing it does to variables or the current directory reaches your shell. Sourcing runs the commands in your shell, which is what you want for files of settings and functions, and dangerous for scripts that call `exit`:

```bash
# env-setup.sh: settings to load into the current shell with source
export APP_ENV=staging
cd "$HOME/bash-practice/logs" || return
echo "APP_ENV=$APP_ENV, now in $PWD"
```

```terminal
{
  "title": "run versus source",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash env-setup.sh; echo \"after running: APP_ENV=[${APP_ENV-}], PWD=$PWD\"",
      "output": "APP_ENV=staging, now in /home/dev/bash-practice/logs\nafter running: APP_ENV=[], PWD=/home/dev/bash-practice"
    },
    {
      "cmd": "source env-setup.sh; echo \"after sourcing: APP_ENV=[${APP_ENV-}], PWD=$PWD\"",
      "output": "APP_ENV=staging, now in /home/dev/bash-practice/logs\nafter sourcing: APP_ENV=[staging], PWD=/home/dev/bash-practice/logs"
    },
    {
      "cmd": "cd ~/bash-practice"
    },
    {
      "comment": "exit in a sourced file ends the shell that sourced it",
      "cmd": "printf 'echo \"sourced\"\\nexit 0\\n' > bye.sh; bash -c 'source ./bye.sh; echo \"this line never runs\"'",
      "output": "sourced"
    },
    {
      "cmd": "rm bye.sh"
    }
  ]
}
```

A file meant to be sourced should use `return`, not `exit`, as `env-setup.sh` does after a failed `cd`. In an interactive terminal, sourcing `bye.sh` would close the terminal window.

## Run Your Scripts From Anywhere

A command name without a slash is looked up in the directories listed in `PATH`. The current directory is not one of them, which is why `logstat` alone does not work:

```terminal
{
  "title": "the current directory is not in PATH",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "logstat class logs/access.log",
      "output": "bash: logstat: command not found"
    },
    {
      "cmd": "echo \"$PATH\" | tr ':' '\\n' | head -n 5",
      "output": "/usr/local/sbin\n/usr/local/bin\n/usr/sbin\n/usr/bin\n/sbin"
    }
  ]
}
```

The standard place for your own commands is `~/.local/bin`. On Ubuntu and Debian, `~/.profile` adds it to `PATH` at login when the directory exists; on other systems, add `export PATH="$HOME/.local/bin:$PATH"` to `~/.profile` yourself. Instead of copying the script there, link it, so edits in `~/bash-practice` take effect at once:

```terminal
{
  "title": "install logstat with a symlink",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p ~/.local/bin && ln -sf ~/bash-practice/logstat ~/.local/bin/logstat"
    },
    {
      "comment": "reload ~/.profile instead of logging out and in again",
      "cmd": "source ~/.profile && command -v logstat",
      "output": "/home/dev/.local/bin/logstat"
    },
    {
      "cmd": "cd /tmp && logstat class ~/bash-practice/logs/access.log",
      "output": "/home/dev/.local/bin/logstat: line 6: /home/dev/.local/bin/lib/logstat.sh: No such file or directory\n/home/dev/.local/bin/logstat: line 13: count_by: command not found"
    }
  ]
}
```

The script started, but it looked for its library next to the **link**: `${BASH_SOURCE[0]}` is `/home/dev/.local/bin/logstat`. Resolve the link first. In `~/bash-practice/logstat`, replace the two lines `# shellcheck source=lib/logstat.sh` and `source "$(dirname "${BASH_SOURCE[0]}")/lib/logstat.sh"` with:

```bash
# resolve symlinks, so the library is found next to the real file
script_dir=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
# shellcheck source=lib/logstat.sh
source "$script_dir/lib/logstat.sh"
```

```terminal
{
  "title": "now it works from anywhere",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -n '5,8p' ~/bash-practice/logstat",
      "output": "# resolve symlinks, so the library is found next to the real file\nscript_dir=$(dirname \"$(readlink -f \"${BASH_SOURCE[0]}\")\")\n# shellcheck source=lib/logstat.sh\nsource \"$script_dir/lib/logstat.sh\""
    },
    {
      "cmd": "cd /tmp && logstat class ~/bash-practice/logs/access.log",
      "output": "24\t2xx\n8\t4xx\n4\t3xx\n4\t5xx"
    },
    {
      "cmd": "cd ~/bash-practice && shellcheck -x logstat && echo \"shellcheck: no warnings\"",
      "output": "shellcheck: no warnings"
    }
  ]
}
```

`readlink -f` follows every symlink to the real path (GNU coreutils; `realpath` does the same). Two more habits for commands in `PATH`:

- **Do not shadow existing commands.** A script called `test` never runs when you type `test`, because the builtin wins (`type test` shows it). Check a name with `type -a name` before using it.
- **Leave off the `.sh` extension** for commands you type, as other tools do: `logstat`, not `logstat.sh`. You can then rewrite it in another language without renaming it.

If you move a command to another directory in `PATH` and Bash keeps running the old path, run `hash -r`; Bash caches where it found each command.

## Run Scripts From cron, systemd and sudo

A script that works in your terminal can fail when something else starts it, because the environment is different. cron, for example, runs jobs with `SHELL=/bin/sh`, a minimal `PATH` of `/usr/bin:/bin`, your home directory as the working directory and no terminal. You can imitate that with `env -i`:

```terminal
{
  "title": "what a cron job sees",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "env -i HOME=\"$HOME\" PATH=/usr/bin:/bin /bin/sh -c 'logstat class bash-practice/logs/access.log'",
      "output": "/bin/sh: 1: logstat: not found"
    },
    {
      "cmd": "env -i HOME=\"$HOME\" PATH=/usr/bin:/bin /bin/sh -c '\"$HOME/.local/bin/logstat\" class \"$HOME/bash-practice/logs/access.log\" | head -n 2'",
      "output": "24\t2xx\n8\t4xx"
    }
  ]
}
```

The rules for scripts that run unattended:

- **Use absolute paths** for the script and its files, or set `PATH` at the top of the script.
- **Do not depend on `~/.bashrc`, aliases or the current directory.** `cd` to where the script needs to be, and check that it worked.
- **Send output somewhere.** cron mails it or drops it; a line like `0 2 * * * /home/dev/.local/bin/nightly-report >> /var/tmp/nightly-report.log 2>&1` keeps it.
- **Prevent overlapping runs** with `flock -n "$HOME/.nightly-report.lock" /home/dev/.local/bin/nightly-report`, which skips a run while the previous one still holds the lock.

systemd services and timers are the modern alternative to cron, with logging to the journal, dependencies and retries built in. The [Linux system administration part](/guides/introduction-to-linux/10-system-administration) shows a script running every night as a systemd timer.

Two things to know about root:

- **`sudo` uses a different `PATH`.** On Ubuntu, `sudo` replaces `PATH` with the `secure_path` from `/etc/sudoers`, which does not include `~/.local/bin`, so `sudo logstat` fails with "command not found". Use the full path, or install system-wide tools in `/usr/local/bin`.
- **The setuid bit does nothing on scripts.** Linux ignores it for files that start with `#!`, because a script running with raised privileges is too easy to hijack. To let users run one script as root, give them a specific `sudo` rule for it instead.

## Troubleshooting: Common Errors and Fixes

**`Permission denied`**: the file lacks execute permission (`chmod +x`), or it is on a file system mounted with `noexec` (common for `/tmp` and `/dev/shm` on hardened servers, and for some network and USB mounts). Check with `findmnt -T script.sh -o TARGET,OPTIONS`; on a `noexec` mount, run it as `bash script.sh` or move it.

**`cannot execute: required file not found`** or **`bad interpreter: No such file or directory`**: the interpreter named in the shebang does not exist. Either the path is wrong, or the file has Windows line endings, so the interpreter's name ends in an invisible carriage return. Which message you get depends on the Bash version. Bash 5.2, the version in Ubuntu 24.04, Debian 13 and RHEL 10, prints a generic one:

```terminal
{
  "title": "Bash 5.2.21: two causes, one message",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '#!/usr/local/bin/bash\\necho hi\\n' > wrong.sh && chmod +x wrong.sh && ./wrong.sh",
      "output": "bash: ./wrong.sh: cannot execute: required file not found"
    },
    {
      "cmd": "printf '#!/bin/bash\\r\\necho hi\\r\\n' > crlf.sh && chmod +x crlf.sh && ./crlf.sh",
      "output": "bash: ./crlf.sh: cannot execute: required file not found"
    },
    {
      "cmd": "sed -i 's/\\r$//' crlf.sh && ./crlf.sh",
      "output": "hi"
    },
    {
      "comment": "with #!/usr/bin/env, env reports the carriage return itself",
      "cmd": "printf '#!/usr/bin/env bash\\r\\necho hi\\r\\n' > crlf2.sh && chmod +x crlf2.sh && ./crlf2.sh",
      "output": "/usr/bin/env: ‘bash\\r’: No such file or directory\n/usr/bin/env: use -[v]S to pass options in shebang lines"
    },
    {
      "cmd": "rm wrong.sh crlf.sh crlf2.sh"
    }
  ]
}
```

Bash 5.3 (and the 3.2 on macOS) names the interpreter it could not find, which makes the carriage return visible as `^M`:

```terminal
{
  "title": "Bash 5.3.9 on Ubuntu 26.04.1",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '#!/usr/local/bin/bash\\necho hi\\n' > wrong.sh && chmod +x wrong.sh && ./wrong.sh",
      "output": "bash: ./wrong.sh: /usr/local/bin/bash: bad interpreter: No such file or directory"
    },
    {
      "cmd": "printf '#!/bin/bash\\r\\necho hi\\r\\n' > crlf.sh && chmod +x crlf.sh && ./crlf.sh",
      "output": "bash: ./crlf.sh: /bin/bash^M: bad interpreter: No such file or directory"
    }
  ]
}
```

Fix line endings with `sed -i 's/\r$//' script.sh` or `dos2unix`, and set your editor or Git (`git config core.autocrlf input`) to save scripts with Unix line endings. For a wrong path, check where the interpreter really is with `command -v bash`, or use `#!/usr/bin/env bash`.

**`command not found`** for your own script: the directory is not in `PATH`. Use `./script`, the full path, or install it in `~/.local/bin`.

**Strange errors** such as `Bad substitution`, `source: not found` or `[[: not found`, with a line number after the script name: the script is running in `sh` (dash), not Bash. Look for `sh script.sh` in whatever starts it, or for a missing shebang:

```terminal
{
  "title": "a Bash script run with sh",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sh logstat class logs/access.log",
      "output": "logstat: 6: Bad substitution\nlogstat: 8: source: not found\nlogstat: 19: Bad substitution"
    }
  ]
}
```

**`cannot execute binary file`**: you ran a compiled program with `bash program`; run it directly instead. With `: Exec format error` at the end, the program was built for another CPU architecture, such as an x86-64 binary on an ARM server.

## Common Mistakes

- **Forgetting `chmod +x`**, or adding only `x` without `r` for the people who run the script.
- **Expecting group permissions to apply to the owner.** Only one class of bits is checked.
- **A shebang that is not on line 1**, has a relative path, or passes options through `env` without `-S`.
- **Leaving out the shebang.** Other programs run the file with `/bin/sh`.
- **Sourcing a script that calls `exit`.** It closes your shell.
- **Resolving files relative to `${BASH_SOURCE[0]}` without following symlinks.**
- **Testing only in your terminal.** cron, systemd and `sudo` run scripts with a different `PATH` and no `~/.bashrc`.
- **Saving scripts with Windows line endings.**

## Summary

- A script needs read and execute permission, and the kernel uses only the owner, group or others bits that match you.
- `#!/usr/bin/env bash` is the usual shebang; use `#!/bin/bash` for root-run scripts.
- `./script` and `bash script` start a new process; `source` runs the file in your shell.
- Put your commands in `~/.local/bin`, resolve symlinks with `readlink -f`, and avoid names of existing commands.
- Unattended scripts need absolute paths, their own `PATH` and somewhere to send output.

Next: [Command Line Arguments](/guides/introduction-to-bash/08-command-line-arguments), where `logstat` gets real options.

## Keep Learning

- [Which shebang should a Bash script use?](/posts/preferred-bash-shebang)
- [Get the directory of a Bash script](/posts/get-directory-bash-script-location)
- [What is the difference between sh and Bash?](/posts/difference-between-sh-and-bash)
- Interview questions: [Linux file permissions](/interview-questions/junior/linux-file-permissions)
- Quiz: [Linux command line quiz](/quizzes/linux-quiz)
