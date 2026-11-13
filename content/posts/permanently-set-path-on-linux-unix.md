---
title: 'How to Permanently Set $PATH on Linux and Unix'
excerpt: 'Learn how to permanently modify your PATH environment variable on Linux and Unix systems so your custom directories persist across shell sessions and reboots, then reload .bashrc, export or delete variables, and write aliases that take parameters.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-10-30'
publishedAt: '2024-10-30T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Environment Variables
  - Bash
  - Shell
  - Configuration
  - export
  - Aliases
---

You install a program to a custom directory like `/opt/myapp/bin`, add it to your PATH for the current session, and everything works. Then you log out, log back in, and the path is gone. How do you make it stick?

## TL;DR

To permanently set PATH, add an export statement to your shell's configuration file. For Bash, add `export PATH="$PATH:/your/custom/path"` to `~/.bashrc` (Linux) or `~/.bash_profile` (macOS). For system-wide changes affecting all users, edit `/etc/environment` or `/etc/profile`. After editing, run `source ~/.bashrc` or log out and back in for changes to take effect.

The PATH variable tells your shell where to find executable programs. When you type a command, the shell searches each directory in PATH until it finds a matching executable.

Let's see what your current PATH looks like:

```bash
echo $PATH
```

You'll see output like:

```
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

These directories are separated by colons. When you run `ls`, the shell searches these directories in order until it finds `/bin/ls`.

## Understanding User vs System PATH

There are two levels of PATH configuration: user-specific and system-wide.

User-specific paths affect only your account and are stored in files in your home directory:

```
User Level (affects only you)
├── ~/.bashrc           # Bash on most Linux distros
├── ~/.bash_profile     # Bash on macOS, login shells on Linux
├── ~/.profile          # Generic shell configuration
└── ~/.zshrc           # Zsh shell
```

System-wide paths affect all users and are in system configuration files:

```
System Level (affects everyone)
├── /etc/environment    # System-wide environment variables
├── /etc/profile        # System-wide shell configuration
└── /etc/profile.d/     # Drop-in directory for custom scripts
```

For personal use, stick with user-level configuration. Only modify system-level files when you need a program available to all users.

## Adding to PATH for Bash (Most Linux Distributions)

On most Linux distributions, Bash reads `~/.bashrc` for interactive non-login shells. This is the file you'll edit most often.

Open the file in your editor:

```bash
nano ~/.bashrc
```

Add this line at the end:

```bash
# Add custom program directory to PATH
export PATH="$PATH:/opt/myapp/bin"
```

The `$PATH` at the beginning preserves existing directories, and `:/opt/myapp/bin` adds your new directory to the end.

Save the file and apply the changes without logging out:

```bash
source ~/.bashrc
```

Now verify the change:

```bash
echo $PATH
```

You should see your new directory at the end.

## Adding to PATH for Bash on macOS

macOS uses `~/.bash_profile` for login shells (Terminal app opens login shells by default). If you're using the default Bash on macOS:

```bash
nano ~/.bash_profile
```

Add the export line:

```bash
export PATH="$PATH:/usr/local/myapp/bin"
```

Apply the changes:

```bash
source ~/.bash_profile
```

If you have both `~/.bash_profile` and `~/.bashrc`, you might want `~/.bash_profile` to source `~/.bashrc`:

```bash
# In ~/.bash_profile
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi
```

This way, you can keep all your PATH modifications in `~/.bashrc`.

## Adding to PATH for Zsh

If you use Zsh (the default shell on newer macOS versions), edit `~/.zshrc`:

```bash
nano ~/.zshrc
```

Add your PATH modification:

```bash
export PATH="$PATH:/usr/local/myapp/bin"
```

Apply the changes:

```bash
source ~/.zshrc
```

## Adding Multiple Directories at Once

You can add several directories in one statement:

```bash
export PATH="$PATH:/opt/myapp/bin:/home/user/scripts:/home/user/.local/bin"
```

Or make it more readable by adding them separately:

```bash
# Custom application binaries
export PATH="$PATH:/opt/myapp/bin"

# Personal scripts
export PATH="$PATH:$HOME/scripts"

# Python user binaries
export PATH="$PATH:$HOME/.local/bin"
```

Using `$HOME` instead of hardcoding `/home/username` makes your configuration more portable.

## Prepending vs Appending to PATH

When you add a directory to PATH, the order matters. The shell searches directories from left to right and uses the first match it finds.

Appending (adding to the end):

```bash
export PATH="$PATH:/new/directory"
```

Prepending (adding to the beginning):

```bash
export PATH="/new/directory:$PATH"
```

If you want your custom programs to take precedence over system programs, prepend:

```bash
# Custom node takes precedence over system node
export PATH="/home/user/node/bin:$PATH"
```

This is useful when you have a newer version of a tool installed in a custom location.

## System-Wide PATH for All Users

If you're an administrator and want to add a directory for all users, edit `/etc/environment`:

```bash
sudo nano /etc/environment
```

This file uses a different format - no `export` keyword:

```bash
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/company-tools/bin"
```

Changes take effect at the next login for all users.

Alternatively, create a file in `/etc/profile.d/`:

```bash
sudo nano /etc/profile.d/custom-path.sh
```

Add your export statement:

```bash
export PATH="$PATH:/opt/company-tools/bin"
```

The file needs the `.sh` extension and must be readable. It does not need execute permission, because login shells read it with `.` (source) and do not run it as a program.

This approach is cleaner because it keeps your customization separate from system files.

## Checking Which Configuration File is Active

If you're not sure which file your shell is reading, add a test line to the file you're editing:

```bash
echo "Loading custom PATH from ~/.bashrc"
```

Then open a new terminal. If you see the message, that's the right file.

To see which files are being sourced, temporarily add this to the top of your shell config:

```bash
set -x  # Enable debug mode
```

And this at the end:

```bash
set +x  # Disable debug mode
```

Open a new terminal, and you'll see each command being executed, including which files are sourced.

## Removing a Directory from PATH

If you need to remove a directory from PATH, you can't just delete the export line and source the file - you need to start a new shell session, or manually reconstruct PATH.

The safe approach:

1. Edit the configuration file and remove the line
2. Log out and log back in, or open a new terminal

For an immediate fix in the current session:

```bash
# This is tedious - you need to reconstruct PATH manually
export PATH="/usr/local/bin:/usr/bin:/bin"
```

## Troubleshooting PATH Issues

If your PATH isn't working after editing a configuration file:

Check for syntax errors in your shell config:

```bash
bash -n ~/.bashrc
```

This checks for syntax errors without executing the file. No output means no errors.

Make sure you're editing the right file. Check which shell you're using:

```bash
echo $SHELL
```

If it says `/bin/bash`, you're using Bash. If it says `/bin/zsh`, you're using Zsh.

Verify the file was sourced:

```bash
# For Bash
source ~/.bashrc

# For Zsh
source ~/.zshrc
```

Check if something is overwriting your PATH later in the configuration file:

```bash
grep -n "PATH" ~/.bashrc
```

This shows all lines containing PATH with line numbers.

## Per-Project PATH with Direnv

For development work where different projects need different tools, consider using `direnv` instead of modifying your global PATH.

Install direnv:

```bash
# Ubuntu/Debian
sudo apt install direnv

# macOS
brew install direnv
```

Add the hook to your shell config:

```bash
# For Bash, add to ~/.bashrc
eval "$(direnv hook bash)"

# For Zsh, add to ~/.zshrc
eval "$(direnv hook zsh)"
```

Create a `.envrc` file in your project directory:

```bash
cd ~/projects/myapp
nano .envrc
```

Add your PATH modification:

```bash
export PATH="$PWD/bin:$PATH"
```

Allow direnv to load this file:

```bash
direnv allow
```

Now, whenever you `cd` into this directory, the PATH is automatically modified, and it's restored when you leave.

## Setting PATH for Cron Jobs

Cron jobs run with a minimal PATH, which often causes scripts to fail because they can't find commands.

Set PATH at the top of your crontab:

```bash
crontab -e
```

Add a PATH line:

```bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/user/scripts

# Your cron jobs
0 2 * * * /home/user/scripts/backup.sh
```

Or set PATH inside the script itself:

```bash
#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin"

# Rest of your script
```

## How Do I Reload .bashrc Without Logging Out?

Run `source ~/.bashrc`, or the short POSIX form `. ~/.bashrc`. The shell reads the file again in the current session, so new aliases, functions and PATH entries are available at once:

```bash
source ~/.bashrc
```

Only the terminal where you run it changes. Other open terminals keep their old settings until you reload them too or open new ones.

Sourcing runs the file again. It does not undo anything, so keep three effects in mind:

- An alias, function or variable that you deleted from the file still exists in the session. Remove it with `unalias name`, `unset -f name` or `unset NAME`.
- A line such as `export PATH="$PATH:$HOME/bin"` adds the directory again each time you source the file. Guard the line so it adds the directory only once:

  ```bash
  case ":$PATH:" in
      *":$HOME/bin:"*) ;;                       # already in PATH
      *) export PATH="$PATH:$HOME/bin" ;;
  esac
  ```

- Settings in `~/.profile` or `~/.bash_profile` do not change, because `source ~/.bashrc` reads only that one file.

For a clean start, replace the shell with a new one:

```bash
exec bash       # a new interactive shell that reads ~/.bashrc
exec bash -l    # a login shell that also reads ~/.bash_profile or ~/.profile
```

`exec` writes the command history of the session to `~/.bash_history` first, so you keep it. You lose the variables you did not export, the functions and the aliases you defined by hand in the old shell.

If sourcing prints an error, check the file without running it:

```bash
bash -n ~/.bashrc     # no output means no syntax errors
```

## What Is the Difference Between a Variable With and Without export?

A variable without `export` is a **shell variable**: only the current shell can read it. `export` marks it as an **environment variable**, and the shell then passes a copy to every program it starts:

```bash
LOCAL_VAR="only here"
export SHARED_VAR="also in child processes"

bash -c 'echo "LOCAL_VAR=[$LOCAL_VAR] SHARED_VAR=[$SHARED_VAR]"'
# LOCAL_VAR=[] SHARED_VAR=[also in child processes]
```

Export what other programs must read, such as `PATH`, `EDITOR`, `DATABASE_URL` or `AWS_PROFILE`. Keep loop counters and temporary values unexported. Rules that help with exports:

- `VAR=value command` sets the variable only for that one command, without changing the shell: `TZ=UTC date`.
- `declare -p VAR` shows `declare -x VAR=...` for an exported variable and `declare -- VAR=...` for a shell variable. `printenv VAR` prints only exported variables.
- A child process gets a copy. It can change or export variables, but the change never reaches the parent shell. That is why `./set-env.sh` has no effect on your terminal, and `source ./set-env.sh` does.
- Bash cannot export arrays. `export servers` on an array sets the attribute, but child processes do not get the array. Pass a delimited string instead.
- `export -f myfunc` exports a function to child Bash processes.

To load a `.env` file and export every variable in it, turn on `allexport` while you source it:

```bash
set -a          # export every variable that is assigned from now on
source .env
set +a
```

This runs the file as shell code, so use it only for files you trust.

## How Do I Delete an Exported Environment Variable?

Use `unset`. It removes the variable from the shell, and programs started after that do not get it:

```bash
export API_KEY="abc123"
unset API_KEY
printenv API_KEY || echo "API_KEY is gone"
```

`unset` takes several names at once (`unset API_KEY DB_URL TOKEN`), and it succeeds even when the variable does not exist, so you do not need to check first. Other cases:

```bash
export -n API_KEY                # keep the value as a shell variable, stop exporting it
env -u API_KEY ./run-tests.sh    # run one command without the variable
(unset API_KEY; ./run-tests.sh)  # the same, in a subshell
env -i bash --norc               # a shell that starts with an empty environment
```

With `env -i`, Bash gets no variables at all. It sets a built-in default `PATH`, which can include `.` (the current directory), so use this only for tests.

`unset` changes only the current shell and the programs it starts later. Programs that already run keep their copy. If the variable comes back in each new terminal, a startup file sets it: find the line with `grep -n API_KEY ~/.bashrc ~/.profile ~/.bash_profile /etc/environment /etc/profile.d/*.sh`, remove it, and open a new terminal.

Variable names can contain only letters, digits and underscores, and cannot start with a digit. `export "MY-API-KEY=value"` fails with `not a valid identifier`, and `unset` cannot remove such a name either. A program can still start Bash with an environment entry that has a hyphen, and Bash passes it on to child processes. Use `env -u MY-API-KEY command` to leave it out.

## How Do I Create a Bash Alias That Takes Parameters?

You cannot: an alias is text replacement, and Bash adds the arguments at the end of the replaced text. Write a function instead. It takes parameters as `$1`, `$2` and `"$@"`:

```bash
# in ~/.bashrc
mkcd() {
    mkdir -p -- "$1" && cd -- "$1"
}

search() {
    grep -rn --exclude-dir=.git -- "$1" "${2:-.}"
}
```

Then `mkcd ~/projects/new-app` creates the directory and changes into it, and `search TODO src` searches `src` for `TODO`.

An alias with `$1` in it does not do what it seems to do. Bash expands `$1` when you use the alias, to the first positional parameter of your shell, which is usually empty. Your argument still goes at the end:

```bash
alias search='grep -r $1 .'
search pattern
# runs: grep -r  . pattern    ($1 is empty, "pattern" is added at the end)
```

That is also why an alias still works for arguments at the end, such as `alias ll='ls -lh'` and `ll /var/log`. Use a function as soon as the argument has to go anywhere else.

If an alias and a function have the same name, the alias wins and the function definition fails with `syntax error near unexpected token '('`. Run `unalias name` before you define the function, or rename one of them. `type name` shows what a name is.

Put aliases and functions in `~/.bashrc`. On Debian and Ubuntu, the default `~/.bashrc` also loads `~/.bash_aliases` if it exists, which keeps them in a separate file. Reload with `source ~/.bashrc` after you change them, as described above.

## Best Practices

Keep these guidelines in mind when modifying PATH:

- Always include `$PATH` in your export to preserve existing directories
- Use `$HOME` instead of hardcoded paths for portability
- Add comments explaining what each PATH addition is for
- Test changes in a new terminal before assuming they work
- For system-wide changes, use `/etc/profile.d/` scripts instead of editing `/etc/profile`
- Keep your PATH short - too many directories slow down command lookups
- Put frequently-used directories earlier in the PATH for faster lookups

Permanently setting PATH is straightforward once you know which file to edit for your shell and system. Whether you're adding personal script directories, custom application binaries, or system-wide tools, the key is understanding the difference between user-level and system-level configuration, and knowing how to test your changes.

## Related Resources

- [What is Bash?](/guides/introduction-to-bash/01-what-is-bash): which startup files Bash reads for login and non-login shells
- [Introduction to Linux: User Management](/guides/introduction-to-linux/06-user-management#h2-login-files-and-the-user-environment): login files and the user environment
- [How to get the current date and time in Linux](/posts/get-current-date-time-and-custom-commands): aliases and functions for date formats
- [Learn Linux interactive tutorial](/games/linux-terminal) and [Linux fundamentals flashcards](/flashcards/linux-fundamentals)
