---
title: 'How to Set Git Editor for Commit Messages'
excerpt: 'Want to use your preferred editor for Git commit messages? Learn how to configure Git to use VS Code, Vim, Nano, Emacs, or any editor of your choice.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-05-22'
publishedAt: '2025-05-22T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Configuration
  - Editor
  - Commit Messages
  - Development Environment
---

Git opens a text editor when you run `git commit` without the `-m` flag or when you need to edit messages during rebase or merge. By default, Git uses whatever editor is configured in your shell, which might not be the one you prefer.

**TLDR:** To set your Git editor, use `git config --global core.editor "editor-command"`. For VS Code: `git config --global core.editor "code --wait"`. For Nano: `git config --global core.editor "nano"`. For Vim: `git config --global core.editor "vim"`. The `--wait` flag is crucial for GUI editors to make Git wait for you to close the file.

In this guide, you'll learn how to configure Git to use any editor for commit messages.

## Prerequisites

You'll need Git installed on your system and your preferred editor installed. Basic familiarity with the command line will help you follow along.

## Checking Your Current Editor

To see which editor Git is currently using:

```bash
# Check configured editor
git config --global core.editor

# If not set, Git uses the default (usually vi/vim)
# To see what Git will actually use:
git var GIT_EDITOR
```

## Setting VS Code as Git Editor

Visual Studio Code is a popular choice:

```bash
# Set VS Code as editor
git config --global core.editor "code --wait"

# Test it
git commit
# VS Code opens for your commit message
```

The `--wait` flag is critical - it tells VS Code to block until you close the file, so Git knows when you're done editing.

For VS Code Insiders:

```bash
git config --global core.editor "code-insiders --wait"
```

## Setting Vim as Git Editor

Vim is the traditional Unix editor:

```bash
# Set Vim
git config --global core.editor "vim"

# Or explicitly use vi
git config --global core.editor "vi"

# For nvim (Neovim)
git config --global core.editor "nvim"
```

Vim is usually the default on Unix systems, so you might not need to set this.

## Setting Nano as Git Editor

Nano is beginner-friendly with on-screen help:

```bash
# Set Nano
git config --global core.editor "nano"

# Test it
git commit
# Nano opens with helpful shortcuts at bottom
```

Nano is easier for users who are not comfortable with Vim.

## Setting Emacs as Git Editor

For Emacs users:

```bash
# Set Emacs
git config --global core.editor "emacs"

# Or for terminal mode
git config --global core.editor "emacs -nw"

# For GUI Emacs that waits
git config --global core.editor "emacsclient -c"
```

## Setting Sublime Text

For Sublime Text:

```bash
# macOS
git config --global core.editor "subl -n -w"

# Windows
git config --global core.editor "'C:/Program Files/Sublime Text/sublime_text.exe' -w"

# Linux
git config --global core.editor "subl -n -w"
```

The `-w` flag makes Sublime wait, similar to `--wait` in VS Code.

## Setting Atom

For Atom editor:

```bash
# Set Atom
git config --global core.editor "atom --wait"
```

## Setting Notepad++ (Windows)

For Notepad++ on Windows:

```bash
# Set Notepad++ (adjust path if needed)
git config --global core.editor "'C:/Program Files/Notepad++/notepad++.exe' -multiInst -notabbar -nosession -noPlugin"
```

## Setting TextEdit (macOS)

For macOS TextEdit:

```bash
# Set TextEdit
git config --global core.editor "open -e -W"
```

The `-W` flag makes the command wait until TextEdit closes.

## Setting Nano with Line Numbers

Configure Nano to show line numbers:

```bash
# Set Nano with line numbers
git config --global core.editor "nano -l"

# Or with multiple options
git config --global core.editor "nano -l -i"
```

Flags:
- `-l` shows line numbers
- `-i` enables auto-indent

## Using Environment Variables

Git respects shell environment variables:

```bash
# Set editor in your shell profile (~/.bashrc, ~/.zshrc, etc.)
export EDITOR=vim
export GIT_EDITOR=code --wait

# Git will use these if core.editor is not set
```

The priority order is:
1. `GIT_EDITOR` environment variable
2. `core.editor` Git config
3. `VISUAL` environment variable
4. `EDITOR` environment variable
5. Default (usually vi)

## Setting Editor for Specific Repository

To set an editor for only one repository:

```bash
# Navigate to repository
cd /path/to/repo

# Set editor for this repo only (no --global)
git config core.editor "nano"

# Check it was set
git config core.editor
```

## Setting Editor for Different Operations

You can set different editors for different Git operations:

```bash
# Editor for commit messages
git config --global core.editor "code --wait"

# Editor for diffs
git config --global diff.tool "meld"

# Editor for merge conflicts
git config --global merge.tool "kdiff3"
```

## Temporarily Using a Different Editor

Override the configured editor for one command:

```bash
# Use nano for this commit only
GIT_EDITOR=nano git commit

# Use vim for this commit
GIT_EDITOR=vim git commit
```

## Common Issues and Solutions

**Issue: Editor opens but Git says "Aborting commit"**

```bash
# Problem: Editor is not waiting
git config --global core.editor "code --wait"
#                                       ^^^^^^
# The --wait flag is crucial
```

**Issue: "error: cannot run code: No such file or directory"**

```bash
# Problem: Editor is not in PATH
# Solution 1: Add full path
git config --global core.editor "/usr/local/bin/code --wait"

# Solution 2: Add editor to PATH
export PATH="$PATH:/path/to/editor"
```

**Issue: Windows path problems**

```bash
# Use forward slashes and quotes for spaces
git config --global core.editor "'C:/Program Files/Editor/editor.exe' --wait"
```

## Testing Your Editor Configuration

Test the editor works correctly:

```bash
# Make a change
echo "test" >> test.txt
git add test.txt

# Commit without -m (opens editor)
git commit

# If editor opens correctly, write message and save
# Git should complete the commit when you close the editor
```

## Setting Up GUI Editors Properly

For GUI editors, you must include the wait flag:

```bash
# Good: Editor waits
git config --global core.editor "code --wait"
git config --global core.editor "subl -w"
git config --global core.editor "atom --wait"

# Bad: Git does not wait, commits abort
git config --global core.editor "code"
git config --global core.editor "subl"
```

## Multiple Git Accounts with Different Editors

Using conditional includes, you can set different editors per project:

```bash
# ~/.gitconfig
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work
[includeIf "gitdir:~/personal/"]
    path = ~/.gitconfig-personal
```

In `~/.gitconfig-work`:

```bash
[core]
    editor = code --wait
```

In `~/.gitconfig-personal`:

```bash
[core]
    editor = nano
```

## Resetting to Default Editor

To remove your custom editor configuration:

```bash
# Remove global editor setting
git config --global --unset core.editor

# Check what Git will use now
git var GIT_EDITOR
```

Git falls back to environment variables or system defaults.

## IDE-Specific Configurations

**IntelliJ IDEA / WebStorm:**

```bash
# macOS
git config --global core.editor "idea --wait"

# Windows
git config --global core.editor "'C:/Program Files/JetBrains/IntelliJ IDEA/bin/idea64.exe' --wait"
```

**Eclipse:**

```bash
# Use built-in Git integration
# Or set external editor
git config --global core.editor "eclipse -w"
```

## Vim Configuration for Git

Customize Vim for Git commit messages:

```bash
# In ~/.vimrc
" Git commit message settings
autocmd FileType gitcommit setlocal spell
autocmd FileType gitcommit setlocal textwidth=72
autocmd FileType gitcommit setlocal colorcolumn=51,73
```

This enables spell check, wraps at 72 characters, and highlights the 50-character subject line limit.

## Nano Configuration for Git

Customize Nano for Git:

```bash
# In ~/.nanorc
# Git commit message settings
set speller "aspell -x -c"
set tabsize 4
set smooth
```

## Best Practices

Choose an editor you're comfortable with:

```bash
# If you're new to command line
git config --global core.editor "nano"

# If you know Vim
git config --global core.editor "vim"

# If you prefer GUI
git config --global core.editor "code --wait"
```

Make sure the wait flag is set:

```bash
# Always include wait for GUI editors
code --wait    # VS Code
subl -w        # Sublime
atom --wait    # Atom
```

Test before committing:

```bash
# Test editor opens correctly
git commit --amend
# Should open editor with last commit message
# Close without changes to abort
```

Use shell aliases for quick editor switching:

```bash
# In ~/.bashrc or ~/.zshrc
alias git-vim='GIT_EDITOR=vim git'
alias git-nano='GIT_EDITOR=nano git'

# Use it
git-nano commit  # Opens Nano for this commit
git-vim rebase -i HEAD~3  # Opens Vim for rebase
```

Now you know how to set your preferred editor for Git commit messages. The key is using `git config --global core.editor "your-editor"` with the appropriate wait flag for GUI editors. Choose an editor you're comfortable with to make writing commit messages easier and more efficient.
