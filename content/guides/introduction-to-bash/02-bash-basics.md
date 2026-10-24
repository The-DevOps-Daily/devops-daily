---
title: 'Bash Basics: How Bash Reads and Runs a Command Line'
description: 'How Bash turns a line into a command: command types, exit codes, the order of expansions, quoting, pipelines, subshells and redirection.'
order: 2
---

You type `cp *.log "$backup_dir"` and press Enter. Before `cp` starts, Bash has already split the line into words, replaced `$backup_dir` with its value, turned `*.log` into a list of file names and removed the quotes. `cp` never sees the `*` or the `$`. Knowing what Bash does in those steps, and in which order, is the difference between guessing why a command misbehaves and knowing.

This part follows a command line from the moment you press Enter to the moment the command exits: what kinds of commands exist, how exit codes work, the expansion order, quoting, lists and pipelines, subshells and redirection.

## Prerequisites

- The practice directory from [Part 1](/guides/introduction-to-bash/01-what-is-bash). Run the examples from `~/bash-practice`.
- If `cd`, `ls`, `cp` and `mv` are new to you, read [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface) first. This part is about Bash itself, not about individual commands.

## The Shape of a Command Line

A **simple command** is a command name followed by words, which the command receives as **arguments**. Options are just arguments that start with `-` by convention; Bash does not treat them specially.

```text
grep  -c  ' 404 '  logs/access.log  >  count.txt
│     │   │        │                └── redirection: handled by Bash, not passed to grep
│     │   │        └── argument 3
│     │   └── argument 2 (the quotes are removed before grep sees it)
│     └── argument 1 (an option)
└── command name
```

Bash also recognizes **control operators** that join commands: `|` (pipe), `;` and newline (one after another), `&&` and `||` (conditional), and `&` (run in the background). Everything else is built from these pieces.

## Exit Status

Every command ends with an **exit status**, a number from 0 to 255. Zero means success, anything else means failure, and `$?` holds the status of the last command. `if`, `while`, `&&` and `||` all decide based on it.

```terminal
{
  "title": "exit codes",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "grep -q ' 500 ' logs/access.log; echo \"found a 500: exit $?\"",
      "output": "found a 500: exit 0"
    },
    {
      "cmd": "grep -q ' 503 ' logs/access.log; echo \"no 503: exit $?\"",
      "output": "no 503: exit 1"
    },
    {
      "cmd": "grep -q x /no/such/file; echo \"grep error: exit $?\"",
      "output": "grep: /no/such/file: No such file or directory\ngrep error: exit 2"
    },
    {
      "cmd": "deploy-now; echo \"command not found: exit $?\"",
      "output": "bash: deploy-now: command not found\ncommand not found: exit 127"
    },
    {
      "cmd": "./servers.txt; echo \"not executable: exit $?\"",
      "output": "bash: ./servers.txt: Permission denied\nnot executable: exit 126"
    },
    {
      "cmd": "sleep 30 & kill -TERM $!; wait $!; echo \"killed by SIGTERM: exit $?\"",
      "output": "killed by SIGTERM: exit 143"
    }
  ]
}
```

The conventions behind those numbers:

| Exit status | Meaning                                                               |
| ----------- | --------------------------------------------------------------------- |
| 0           | Success                                                               |
| 1           | General failure, or "false" (`grep` found nothing, a test failed)     |
| 2           | Misuse: a bad option or argument (`grep` uses it for real errors too) |
| 126         | The file was found but could not be executed                          |
| 127         | Command not found                                                     |
| 128 + N     | Killed by signal N: 130 for Ctrl+C (SIGINT), 143 for SIGTERM          |

Your own scripts should follow them: exit 0 on success, 1 on failure, 2 for usage errors.

## What Kind of Command Is It?

The first word of a command can be one of five kinds of thing, and Bash looks for them in this order: an **alias**, a **keyword** (`if`, `[[`, `while`), a **function**, a **builtin** (part of Bash itself, such as `cd`, `echo`, `read`) or a **program file** found in `$PATH`. `type` tells you which one you are getting:

```terminal
{
  "title": "type shows what a name really is",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "type cd",
      "output": "cd is a shell builtin"
    },
    {
      "cmd": "type -a echo",
      "output": "echo is a shell builtin\necho is /usr/bin/echo\necho is /bin/echo"
    },
    {
      "cmd": "type -t '[[' if grep",
      "output": "keyword\nkeyword\nfile"
    },
    {
      "cmd": "greet() { echo \"hello\"; }"
    },
    {
      "cmd": "type greet",
      "output": "greet is a function\ngreet ()\n{\n    echo \"hello\"\n}"
    },
    {
      "comment": "which only searches PATH and knows nothing about builtins or functions",
      "cmd": "which cd greet; echo \"which exit code: $?\"",
      "output": "which exit code: 1"
    },
    {
      "cmd": "command -v cd grep greet",
      "output": "cd\n/usr/bin/grep\ngreet"
    }
  ]
}
```

Two practical consequences:

- `echo` is both a builtin and `/usr/bin/echo`, and they can behave differently. A bare `echo` runs the builtin, unless a function with the same name overrides it or the builtin was turned off with `enable -n echo`. The same is true for `printf`, `test`, `kill`, `pwd` and others, so read their documentation with `help echo`, not `man echo`, which describes the external program.
- To check whether a command exists in a script, use `command -v name`, not `which`. `which` is a separate program, its output format differs between systems, and it cannot see builtins, functions or aliases. See [how to check if a program exists](/posts/check-if-program-exists-bash-script).

`cd` has to be a builtin: a separate program would change its own directory and exit, leaving your shell where it was.

## The Order of Expansions

After splitting a line into words, Bash **expands** them in a fixed order. Each step works on the result of the previous one:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "1. Braces", "sub": "file{1..3}.txt", "tone": "slate" },
    { "label": "2. Tilde", "sub": "~ to /home/dev", "tone": "slate" },
    { "label": "3. $ expansions", "sub": "$var, $(cmd), $((1+2))", "tone": "accent" },
    { "label": "4. Word splitting", "sub": "unquoted results only", "tone": "red" },
    { "label": "5. Globbing", "sub": "*.log to file names", "tone": "red" },
    { "label": "6. Quote removal", "sub": "the quotes disappear", "tone": "green" }
  ]
}
```

Step 3 covers parameter expansion (`$name`, `${name}`), command substitution (`$(...)`) and arithmetic (`$((...))`), done left to right. Step 4 splits only the results of step 3 that are **not inside double quotes**. Step 5 expands every unquoted word that contains `*`, `?` or `[`, whether you typed it or it came out of step 3. Together they are why quoting matters so much. Here is each step on its own:

```terminal
{
  "title": "each expansion step",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo report-{jan,feb,mar}.txt backup-{1..3}",
      "output": "report-jan.txt report-feb.txt report-mar.txt backup-1 backup-2 backup-3"
    },
    {
      "cmd": "echo ~ ~/bash-practice",
      "output": "/home/dev /home/dev/bash-practice"
    },
    {
      "cmd": "port=8080; echo \"port $port, next $((port + 1)), log lines $(wc -l < logs/access.log)\"",
      "output": "port 8080, next 8081, log lines 40"
    },
    {
      "cmd": "words=\"one   two three\"; printf '[%s]\\n' $words",
      "output": "[one]\n[two]\n[three]"
    },
    {
      "cmd": "printf '[%s]\\n' \"$words\"",
      "output": "[one   two three]"
    },
    {
      "cmd": "echo logs/*.log",
      "output": "logs/access.log logs/app.log"
    },
    {
      "cmd": "echo 'logs/*.log' \"$HOME\"",
      "output": "logs/*.log /home/dev"
    }
  ]
}
```

`set -x` makes Bash print each command after expansion, prefixed with `+`, so you can see exactly what a program receives:

```terminal
{
  "title": "set -x shows the expanded command",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "set -x; printf '%s\\n' ~/bash-practice/logs/*.log \"$USER\" backup-{a,b}; set +x",
      "output": "+ printf '%s\\n' /home/dev/bash-practice/logs/access.log /home/dev/bash-practice/logs/app.log dev backup-a backup-b\n/home/dev/bash-practice/logs/access.log\n/home/dev/bash-practice/logs/app.log\ndev\nbackup-a\nbackup-b\n+ set +x"
    }
  ]
}
```

The order explains some surprises:

```terminal
{
  "title": "consequences of the order",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "braces expand before variables, so a variable cannot set the range",
      "cmd": "n=3; echo {1..$n}",
      "output": "{1..3}"
    },
    {
      "cmd": "for i in $(seq 1 \"$n\"); do printf '%s ' \"$i\"; done; echo",
      "output": "1 2 3"
    },
    {
      "comment": "operators inside a variable are not operators: | is just an argument here",
      "cmd": "cmd='wc -l logs/access.log | sort'; $cmd",
      "output": "  40 logs/access.log\nwc: '|': No such file or directory\nwc: sort: No such file or directory\n  40 total"
    },
    {
      "comment": "an unquoted variable is split and globbed after it expands",
      "cmd": "pattern='*.txt'; echo $pattern",
      "output": "servers.txt"
    },
    {
      "cmd": "echo \"$pattern\"",
      "output": "*.txt"
    }
  ]
}
```

Because operators are recognized before expansion, a command stored in a string cannot contain `|`, `>`, `&&` or quotes that work. Store commands in a function or an array instead ([Part 4](/guides/introduction-to-bash/04-bash-variables) and [Part 8](/guides/introduction-to-bash/08-command-line-arguments) show both). For ranges with a variable end, use `seq` or a C-style `for (( i = 1; i <= n; i++ ))` loop ([Part 5](/guides/introduction-to-bash/05-control-structures)).

## Quoting

Quoting turns off special meanings. Bash has four kinds:

| Form        | What it does                                                                 | Example              |
| ----------- | ---------------------------------------------------------------------------- | -------------------- |
| `\x`        | The next character is literal                                                | `echo \$HOME`        |
| `'single'`  | Everything is literal; you cannot put a `'` inside                           | `echo '$HOME and *'` |
| `"double"`  | `$`, `` ` `` and `\` still work; no word splitting or globbing of the result | `echo "$HOME and *"` |
| `$'ANSI-C'` | Like single quotes, but `\n`, `\t`, `\e` and `\'` are interpreted            | `echo $'tab:\there'` |

```terminal
{
  "title": "the four kinds of quoting",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \\$HOME '$HOME' \"$HOME\"",
      "output": "$HOME $HOME /home/dev"
    },
    {
      "cmd": "echo 'it'\\''s' \"it's\" $'it\\'s'",
      "output": "it's it's it's"
    },
    {
      "cmd": "printf '%s\\n' $'col1\\tcol2' 'col1\\tcol2'",
      "output": "col1\tcol2\ncol1\\tcol2"
    },
    {
      "cmd": "echo \"Price: \\$5, user: $USER, files: $(ls files | wc -l)\"",
      "output": "Price: $5, user: dev, files: 4"
    }
  ]
}
```

The rule that prevents most bugs: **put double quotes around every expansion** (`"$var"`, `"$(cmd)"`, `"${array[@]}"`) unless you want word splitting and globbing, and use single quotes for literal text. Quotes also join words: `"monthly report.txt"` is one argument, with the space inside it.

## Lists, Pipelines and Grouping

```terminal
{
  "title": "lists and pipelines",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p tmp && cd tmp && pwd",
      "output": "/home/dev/bash-practice/tmp"
    },
    {
      "cmd": "cd ..; rmdir tmp"
    },
    {
      "comment": "the status of a pipeline is the status of its last command",
      "cmd": "grep ' 404 ' logs/access.log | wc -l; echo \"exit: $?\"",
      "output": "8\nexit: 0"
    },
    {
      "cmd": "grep ' 404 ' /no/such/file | wc -l; echo \"exit: $?, each command: ${PIPESTATUS[*]}\"",
      "output": "grep: /no/such/file: No such file or directory\n0\nexit: 0, each command: 2 0"
    },
    {
      "comment": "! inverts an exit status",
      "cmd": "! grep -q ' 503 ' logs/access.log && echo \"no 503 responses\"",
      "output": "no 503 responses"
    }
  ]
}
```

A pipeline reports only its last command's status, so a failure on the left side goes unnoticed: above, `grep` failed with status 2, but the pipeline returned 0. `${PIPESTATUS[@]}` holds every status of the last pipeline, and `set -o pipefail` makes a pipeline fail when any part fails ([Part 10](/guides/introduction-to-bash/10-bash-best-practices) covers it and its traps).

`a && b || c` is **not** an if-then-else. `c` also runs when `b` fails:

```terminal
{
  "title": "&& || is not if/else",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "true && { echo \"deploying\"; false; } || echo \"rolled back (but the deploy step ran too)\"",
      "output": "deploying\nrolled back (but the deploy step ran too)"
    }
  ]
}
```

Use a real `if` when the middle command can fail.

**Grouping** runs several commands as one unit. Braces run them in the current shell; parentheses start a **subshell**, a copy of the shell whose changes vanish when it ends:

```terminal
{
  "title": "{ } versus ( )",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "{ status=checked; cd logs; }; echo \"status=$status, now in $PWD\"",
      "output": "status=checked, now in /home/dev/bash-practice/logs"
    },
    {
      "cmd": "cd ~/bash-practice"
    },
    {
      "cmd": "( status=changed; cd logs ); echo \"status=$status, still in $PWD\"",
      "output": "status=checked, still in /home/dev/bash-practice"
    },
    {
      "comment": "a whole group can share one redirection",
      "cmd": "{ echo \"requests: $(wc -l < logs/access.log)\"; echo \"errors: $(grep -c ERROR logs/app.log)\"; } > summary.txt"
    },
    {
      "cmd": "cat summary.txt",
      "output": "requests: 40\nerrors: 2"
    }
  ]
}
```

Note the syntax of braces: a space after `{` and a `;` or newline before `}`. Subshells are also created for every part of a pipeline, for `$(...)` and for `&`. That is why a variable set inside `cmd | while read ...` is gone after the loop, a trap [Part 5](/guides/introduction-to-bash/05-control-structures) shows how to avoid.

## Redirection

Every process starts with three open **file descriptors**: 0 is standard input, 1 is standard output and 2 is standard error. Redirections, processed from left to right, point them somewhere else before the command runs:

| Syntax          | Effect                                                          |
| --------------- | --------------------------------------------------------------- |
| `> file`        | Standard output to `file`, truncating it first                  |
| `>> file`       | Standard output appended to `file`                              |
| `< file`        | Standard input from `file`                                      |
| `2> file`       | Standard error to `file`                                        |
| `2>&1`          | Standard error to wherever standard output points **right now** |
| `&> file`       | Both to `file` (Bash only; the same as `> file 2>&1`)           |
| `&>> file`      | Both appended to `file`                                         |
| `cmd1 \|& cmd2` | Both into the pipe (Bash only; the same as `2>&1 \|`)           |
| `> /dev/null`   | Discard the output                                              |
| `>\| file`      | Overwrite even when `set -o noclobber` is on                    |

The order of `2>&1` matters, because it copies where standard output points at that moment:

```terminal
{
  "title": "the order of redirections",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ls logs /no/such/dir > out.txt 2>&1; echo \"--- out.txt:\"; cat out.txt",
      "output": "--- out.txt:\nls: cannot access '/no/such/dir': No such file or directory\nlogs:\naccess.log\napp.log"
    },
    {
      "cmd": "ls logs /no/such/dir 2>&1 > out.txt; echo \"--- out.txt:\"; cat out.txt",
      "output": "ls: cannot access '/no/such/dir': No such file or directory\n--- out.txt:\nlogs:\naccess.log\napp.log"
    },
    {
      "comment": "noclobber protects files from an accidental >",
      "cmd": "set -o noclobber; echo \"new\" > out.txt; set +o noclobber",
      "output": "bash: out.txt: cannot overwrite existing file"
    },
    {
      "cmd": "rm out.txt summary.txt"
    }
  ]
}
```

In the second command, `2>&1` pointed standard error at the terminal (where standard output still pointed), and only then did `> out.txt` move standard output. The error went to the screen.

To send everything a script prints to a log file from a given line on, redirect the shell itself with `exec`:

```bash
#!/usr/bin/env bash
exec >> /var/tmp/nightly.log 2>&1   # every later command writes here
echo "started at $(date -u +%FT%TZ)"
```

[Redirect all output to a file](/posts/redirect-all-output-to-file-bash), [send output to a file and the screen with tee](/posts/redirect-output-to-file-and-stdout) and [what 2>&1 means](/posts/what-does-2-and-1-mean-linux-bash) go further. Here documents (`<<EOF`) and here strings (`<<<`), which feed text to standard input, are in [Part 9](/guides/introduction-to-bash/09-bash-tools).

## History Expansion and Line Editing

In an interactive shell, Bash keeps a history and lets you reuse it. These are the shortcuts worth learning first:

| Type this               | Bash does                                                       |
| ----------------------- | --------------------------------------------------------------- |
| **Ctrl+R**              | Search backwards through history; press again for older matches |
| `!!`                    | The previous command, for example `sudo !!`                     |
| `!$`                    | The last argument of the previous command (or press **Alt+.**)  |
| `^old^new`              | Rerun the previous command with `old` replaced by `new`         |
| **Ctrl+A** / **Ctrl+E** | Jump to the start / end of the line                             |
| **Ctrl+W**              | Delete the word before the cursor                               |
| `fc`                    | Open the previous command in your editor, run it when you save  |

Two settings in `~/.bashrc` make history more useful: `HISTCONTROL=ignoreboth` skips duplicates and commands that start with a space (handy for commands that contain a secret), and `HISTTIMEFORMAT='%F %T '` adds a timestamp to `history` output. History expansion with `!` only happens in interactive shells, so `!` in a script is an ordinary character. If it gets in your way interactively, for example in `echo "Hello!"`, use single quotes or turn it off with `set +H`.

## Getting Help

- `help` lists the builtins; `help read` shows the options of one. Bash builtins are not documented in their own man pages.
- `man bash` is the complete reference, more than 6,000 lines long. Search it with `/` followed by a word, for example `/Parameter Expansion`.
- `type name` shows what a name is; `man name` is for program files.

## Common Mistakes

- **Expecting a variable to set a brace range** (`{1..$n}`). Braces expand first; use `seq` or a C-style loop.
- **Storing a command with pipes or quotes in a string** and running `$cmd`. Use a function or an array.
- **Unquoted expansions**. `$var` and `$(cmd)` without double quotes are split on whitespace and globbed.
- **Writing `2>&1 > file`** when you meant `> file 2>&1`.
- **Using `a && b || c` as if/else.** `c` runs when `b` fails.
- **Reading `man echo` for the builtin.** Use `help echo`.

## Summary

- A command line is split into words and operators, then expanded in order: braces, tilde, `$` expansions, word splitting, globbing, quote removal.
- Word splitting applies to unquoted expansion results, and globbing to every unquoted pattern, including ones that came from a variable. Double-quote your expansions.
- `type` shows whether a name is an alias, keyword, function, builtin or file; use `command -v` in scripts.
- Exit status 0 is success. Pipelines report the last command's status unless `pipefail` is on.
- Braces group commands in the current shell, parentheses in a subshell whose changes are lost.
- Redirections are processed left to right, so `> file 2>&1` sends both streams to the file.

Next: [Working with Files](/guides/introduction-to-bash/03-working-with-files), where globbing, safe file names and temporary files get the attention they need.

## Keep Learning

- [What does 2>&1 mean?](/posts/what-does-2-and-1-mean-linux-bash)
- [Redirect all output of a script to a file](/posts/redirect-all-output-to-file-bash)
- [Echo to standard error](/posts/echo-to-stderr-in-bash)
- [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface) in the Linux guide
