---
title: 'Git Fundamentals: How Git Works and First Setup'
description: 'How Git stores your work in snapshots, the working tree, staging area and repository, how to install Git 2.56, and the settings to configure first.'
order: 1
---

**Git** is a distributed version control system: it records the history of a set of files, lets several people change them at the same time, and merges their work back together. Linus Torvalds wrote it in 2005 for the Linux kernel. Today almost every software project uses it, along with infrastructure code, documentation and configuration, and services such as GitHub, GitLab and Bitbucket are built around it.

Most Git problems come from a wrong mental model, not from a forgotten command. This part explains how Git stores your work, so that the commands in the rest of the guide make sense. Then you install a current Git and set it up properly once.

## Prerequisites

- A computer with Linux, macOS or Windows, and permission to install software.
- Basic use of a terminal: `cd`, `ls` and running commands. The [Linux command line part](/guides/introduction-to-linux/03-command-line-interface) of the Linux guide covers it.

## What Git Gives You

Without version control, you copy folders (`site-final`, `site-final-2`), email patches and lose track of who changed what. Git replaces that with a **repository**: a project folder plus a hidden database (`.git`) that holds every saved version.

- **Full history.** Every saved version (a **commit**) records who made it, when and why. You can compare any two versions and go back to any of them.
- **Distributed.** A clone is a complete copy of the repository with its whole history (unless you ask for a shallow or partial clone). You commit, branch and read history offline, and share work when you are ready. Every full clone is also a backup.
- **Cheap branches.** A branch is a 41-byte file, so you can start one for every change, try things and throw them away.
- **Integrity.** Every file, directory and commit is named by a hash of its content. If a byte changes on disk or on the way over the network, Git notices.

## How Git Stores Your Work

### Snapshots, not differences

Many older systems store a list of changes per file. Git stores **snapshots**: each commit records the full state of every file in the project at that moment, plus a pointer to the commit before it (its **parent**).

That would be wasteful if Git copied every file each time, so it does not. Each piece of content is stored once and named by its hash. If a file did not change, the new snapshot points to the same stored content as the previous one. A commit that changes one file in a project of 10,000 files stores one new file version and a few small directory listings.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Commit 1", "sub": "snapshot: README, index.html", "icon": "box", "tone": "slate" },
    { "label": "Commit 2", "sub": "index.html changed, README reused", "icon": "box", "tone": "blue" },
    { "label": "Commit 3", "sub": "services.txt added", "icon": "box", "tone": "violet" },
    { "label": "main", "sub": "a branch: a pointer to the newest commit", "icon": "branch", "tone": "green" }
  ]
}
```

Each commit points back to its parent, so the history is a chain (or, once you merge, a graph). A **branch** is only a name that points to one commit and moves forward when you commit. [Part 4](/guides/introduction-to-git/04-branching) shows this on disk, and [Part 10](/guides/introduction-to-git/10-advanced-techniques) looks at the objects themselves.

Git names objects with SHA-1 hashes today: 40 hexadecimal characters such as `46b8da18e4efd0f6a8d3356b8006254f4ac46b45` (the first commit you make in Part 2), usually shortened to the first 7, `46b8da1`. Git can also create repositories that use SHA-256, which will be the default for new repositories in Git 3.0 (more on that [below](#h2-what-changes-in-git-30)).

### The three areas

When you work with Git, your files live in three places:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Working tree", "sub": "the files you edit", "icon": "gear", "tone": "amber" },
    { "label": "Staging area", "sub": "the next commit, built with git add", "icon": "check", "tone": "blue" },
    { "label": "Repository", "sub": "commits in .git, made with git commit", "icon": "database", "tone": "violet" }
  ]
}
```

- The **working tree** is the normal folder you edit with any editor.
- The **staging area**, also called the **index**, is a draft of the next commit. `git add` copies a file's current content into it.
- The **repository** is the `.git` directory. `git commit` turns the staging area into a new commit there.

The staging area is what lets you commit some changes and keep others for later: you can edit five files and commit two of them, or even part of one file ([Part 3](/guides/introduction-to-git/03-tracking-changes)). Commands such as `git restore` and `git switch` copy content the other way, from the repository back into the staging area and the working tree.

From Git's point of view, each file in the working tree is in one of these states:

| State      | Meaning                                              | Typical next command       |
| ---------- | ---------------------------------------------------- | -------------------------- |
| Untracked  | Git has never stored this file                       | `git add`, or `.gitignore` |
| Unmodified | Same as in the last commit                           | none                       |
| Modified   | Changed since the last commit, change not staged yet | `git add` or `git restore` |
| Staged     | The change is in the staging area                    | `git commit`               |

## Install Git

The current release is **Git 2.56.0** (28 September 2026). Any version from the last few years runs the commands in this guide; the few newer features are marked with the version that added them. Distributions with long-term support ship older versions with security fixes backported, so an older version number is not a problem by itself.

| Where                      | Git version in October 2026 |
| -------------------------- | --------------------------- |
| Ubuntu 24.04 LTS           | 2.43.0                      |
| Ubuntu 26.04 LTS           | 2.53.0                      |
| Ubuntu, `ppa:git-core/ppa` | 2.56.0                      |
| Debian 13                  | 2.47.3                      |
| Fedora 44                  | 2.56.0                      |
| Homebrew (macOS)           | 2.56.0                      |
| Git for Windows            | 2.56.0 (2.56.0.windows.3)   |

```tabs
{
  "title": "Install Git",
  "tabs": [
    {
      "label": "Ubuntu / Debian",
      "lang": "bash",
      "code": "sudo apt update\nsudo apt install git\n\n# Ubuntu only: the Git maintainers' PPA has the latest release\nsudo add-apt-repository ppa:git-core/ppa\nsudo apt update\nsudo apt install git"
    },
    {
      "label": "Fedora / RHEL",
      "lang": "bash",
      "code": "sudo dnf install git"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# Apple's Command Line Tools include a Git build (often a few releases behind)\nxcode-select --install\n\n# Homebrew has the current release\nbrew install git"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Git for Windows: Git, Git Bash, and Git Credential Manager for HTTPS logins\nwinget install --id Git.Git -e --source winget\n\n# Or download the installer from https://git-scm.com/install/windows"
    }
  ]
}
```

On Windows, the installer asks several questions. The defaults are fine. Two worth reading: the default editor (pick one you know, such as VS Code or Notepad++) and line endings ("Checkout Windows-style, commit Unix-style" is the usual choice; the project in this guide adds a `.gitattributes` file in Part 2 that keeps its shell scripts on LF line endings anyway, and [Part 9](/guides/introduction-to-git/09-best-practices#h2-line-endings-and-gitattributes) explains how that makes line endings independent of each person's settings).

Check that it works:

```terminal
{
  "title": "check the installed version",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git --version",
      "output": "git version 2.56.0"
    }
  ]
}
```

The examples in this guide come from Git 2.56.0 on Linux, run as a user called `dev` on a machine called `devbox`. Your hashes and dates will differ; everything else should match.

## First-Time Setup

Git stores settings with `git config`. You set a few of them once per computer, with `--global`, and they apply to every repository you use.

### Your name and email

Every commit records an author name and email. Set them before your first commit:

```bash
git config --global user.name "Dev"
git config --global user.email "dev@example.com"
```

Use the email address of your GitHub, GitLab or Bitbucket account, so that the platform links your commits to your profile. To keep your address private, GitHub gives every account a `noreply` address (`ID+username@users.noreply.github.com`) under Settings, Emails.

### The default branch name

New repositories still start with a branch called `master`, and Git prints a hint about it. This is what `git init` says if you have not set anything:

```terminal
{
  "title": "git init before setting a default branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git init ~/scratch",
      "output": "hint: Using 'master' as the name for the initial branch. This default branch name\nhint: will change to \"main\" in Git 3.0. To configure the initial branch name\nhint: to use in all of your new repositories, which will suppress this warning,\nhint: call:\nhint:\nhint: \tgit config --global init.defaultBranch <name>\nhint:\nhint: Names commonly chosen instead of 'master' are 'main', 'trunk' and\nhint: 'development'. The just-created branch can be renamed via this command:\nhint:\nhint: \tgit branch -m <name>\nhint:\nhint: Disable this message with \"git config set advice.defaultBranchName false\"\nInitialized empty Git repository in /home/dev/scratch/.git/"
    }
  ]
}
```

GitHub, GitLab and Bitbucket all name the first branch `main`, and Git 3.0 will do the same. Set it now, so that local and hosted repositories match:

```terminal
{
  "title": "use main for new repositories",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config --global init.defaultBranch main"
    },
    {
      "cmd": "rm -rf ~/scratch && git init ~/scratch && git -C ~/scratch status",
      "output": "Initialized empty Git repository in /home/dev/scratch/.git/\nOn branch main\n\nNo commits yet\n\nnothing to commit (create/copy files and use \"git add\" to track)"
    }
  ]
}
```

### Your editor

Git opens an editor when it needs a longer text from you: a commit message without `-m`, a merge commit message, an interactive rebase. Without a setting, Git uses `$VISUAL` or `$EDITOR`, and falls back to `vi` (Debian and Ubuntu builds fall back to the system's `editor` command, usually `nano`). Pick an editor you know:

```tabs
{
  "title": "Set the editor Git opens",
  "tabs": [
    {
      "label": "nano",
      "lang": "bash",
      "code": "git config --global core.editor \"nano\""
    },
    {
      "label": "VS Code",
      "lang": "bash",
      "code": "# --wait makes Git wait until you close the tab\ngit config --global core.editor \"code --wait\""
    },
    {
      "label": "Vim",
      "lang": "bash",
      "code": "git config --global core.editor \"vim\""
    }
  ]
}
```

[How to set the Git editor for commit messages](/posts/set-git-editor-commit-messages) covers more editors and the `GIT_EDITOR` variable.

### See what is set, and where

`git config list` shows every setting that applies, and the two options below show where each one comes from:

```terminal
{
  "title": "list settings with their scope and file",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config list --show-scope --show-origin",
      "output": "global\tfile:/home/dev/.gitconfig\tuser.name=Dev\nglobal\tfile:/home/dev/.gitconfig\tuser.email=dev@example.com\nglobal\tfile:/home/dev/.gitconfig\tinit.defaultbranch=main\nglobal\tfile:/home/dev/.gitconfig\tcore.editor=nano"
    }
  ]
}
```

Git reads settings from several files. A later level overrides an earlier one:

| Scope    | File                                              | Option       | Applies to                                                                                                     |
| -------- | ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| system   | `/etc/gitconfig`                                  | `--system`   | every user on the computer                                                                                     |
| global   | `~/.gitconfig` or `~/.config/git/config`          | `--global`   | all your repositories                                                                                          |
| local    | `.git/config` in the repository                   | `--local`    | one repository (the default)                                                                                   |
| worktree | `config.worktree` in the worktree's Git directory | `--worktree` | one worktree of a repository (only with `extensions.worktreeConfig` enabled; otherwise it acts like `--local`) |

You can also pass a setting for a single command with `git -c name=value <command>`.

Git 2.46 added subcommands for `git config` that read more clearly. The older forms still work, and you will see both in documentation:

| Task           | Newer form (Git 2.46+)                  | Older form                                |
| -------------- | --------------------------------------- | ----------------------------------------- |
| Set a value    | `git config set --global user.name Dev` | `git config --global user.name Dev`       |
| Read a value   | `git config get user.name`              | `git config user.name`                    |
| List all       | `git config list`                       | `git config --list`                       |
| Remove a value | `git config unset --global core.editor` | `git config --global --unset core.editor` |

### A different email for work repositories

If you use one computer for personal and work projects, a **conditional include** picks the right identity by folder. Put your work settings in a separate file, `~/.gitconfig-work`:

```ini
[user]
	email = dev@work.example.com
```

Then tell your global config to include it for every repository under `~/work/` (the trailing slash matters):

```terminal
{
  "title": "conditional include by folder",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config --global includeIf.\"gitdir:~/work/\".path ~/.gitconfig-work"
    },
    {
      "cmd": "git init -q ~/work/billing && cd ~/work/billing && git config get user.email",
      "output": "dev@work.example.com"
    },
    {
      "cmd": "cd ~ && git config get user.email",
      "output": "dev@example.com"
    }
  ]
}
```

`git config get --show-origin user.email` tells you which file a value came from when you are not sure.

## Getting Help

Every command has a manual page and a short summary of its options:

```bash
git help commit      # the full manual page (git commit --help does the same)
git commit -h        # a short list of options in the terminal
git help -g          # guides, such as "git help everyday" and "git help workflows"
```

## What Changes in Git 3.0

Git 3.0 is the first release since Git 2.0 (2014) that is allowed to break backward compatibility. The Git project keeps the list in its [BreakingChanges document](https://git-scm.com/docs/BreakingChanges). The plan agreed at the Git Contributor Summit (part of Git Merge 2026) is to skip from 2.56 to **2.98 in December 2026**, then release **2.99 as a long-term support version together with 3.0 in spring 2027** ([GitLab's Git 2.56 article](https://about.gitlab.com/blog/whats-new-in-git-2-56-0/), [LWN](https://lwn.net/Articles/1094575/)). Until it ships, treat the dates as a plan.

| Change in Git 3.0                                                      | What it means for you                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New repositories use `main`                                            | Nothing, if you set `init.defaultBranch` as above                                                                                                                                                                       |
| New repositories use SHA-256 object names                              | Existing SHA-1 repositories keep working; SHA-1 is not being removed. Hosting support for SHA-256 is still limited ([Part 10](/guides/introduction-to-git/10-advanced-techniques#h2-sha-256-and-reftable-repositories)) |
| New repositories store refs in the reftable format                     | Invisible to Git users; tools that read `.git/refs` files directly may need updates                                                                                                                                     |
| Rust is required to build Git                                          | Matters if you build Git yourself or use a platform without a Rust compiler                                                                                                                                             |
| `safe.bareRepository` defaults to `explicit`                           | Git stops using bare repositories it finds by walking up from your current directory, which closes a hook-based attack                                                                                                  |
| Old commands removed (`git whatchanged`, `git pack-redundant`, grafts) | Use `git log --raw` instead of `git whatchanged`                                                                                                                                                                        |

`git checkout` is not going away: the project decided to keep it next to `git switch` and `git restore`, which this guide uses.

## Common Mistakes

- **Committing before setting your name and email.** Git stops with "Author identity unknown" when it cannot work out an email address. On a machine whose host name includes a domain, it builds one from your user and host name instead and only prints a warning, and those commits are not linked to your account. Set the identity and, if the commits are not shared yet, see [how to change the author of a commit](/posts/change-commit-author-single).
- **An editor that returns at once.** Graphical editors need a "wait" flag (`code --wait`); otherwise Git sees an empty message and aborts the commit.
- **Using `sudo git`.** Files created as root in your project lead to permission errors later. Git never needs root for your own repositories.
- **Assuming the history is in the cloud.** Commits live in your `.git` until you push them ([Part 6](/guides/introduction-to-git/06-remote-repositories)).

## Summary

- Git stores snapshots of your whole project; unchanged content is stored once and named by its hash.
- Your files move between the working tree, the staging area (`git add`) and the repository (`git commit`).
- Install a current Git from your package manager, Homebrew or Git for Windows; 2.56.0 is the current release.
- Set `user.name`, `user.email`, `init.defaultBranch main` and `core.editor` once with `--global`.
- Git 3.0 (planned for spring 2027) changes defaults for new repositories; existing repositories keep working.

Next: [Creating and Managing Repositories](/guides/introduction-to-git/02-repositories), where you start the project that the rest of the guide builds on.

## Keep Learning

- [Git Concepts simulator](/games/git-concepts-simulator): see commits, branches and merges as a graph in your browser.
- [Git Fundamentals flashcards](/flashcards/git-fundamentals)
- Interview questions: [Git staging and committing](/interview-questions/junior/git-basics)
