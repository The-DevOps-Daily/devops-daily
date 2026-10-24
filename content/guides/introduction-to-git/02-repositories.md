---
title: 'Create a Git Repository: git init, .gitignore, clone'
description: 'Start a Git repository with git init, make your first commit, keep build output and secrets out with .gitignore, and clone with --branch and --depth.'
order: 2
---

A **repository** is a project folder whose history Git manages. You get one in two ways: you turn an existing folder into a repository with `git init`, or you copy an existing repository with `git clone`. This part does both. You create the project that the rest of the guide works on, make the first commit, keep build output and secrets out of it with `.gitignore`, and clone it with the options you will use most.

## Prerequisites

- Git installed and configured as in [Part 1](/guides/introduction-to-git/01-fundamentals): `user.name`, `user.email` and `init.defaultBranch main`.
- A terminal with Bash (on Windows, Git Bash, which comes with Git for Windows).

## The Project for This Guide

Every part of this guide works on the same small project, **status-page**: a status page for a team's services. It has a list of services, a script that checks the list, a script that builds an HTML page from it, and a stylesheet. It is small on purpose, so that the Git commands, not the code, are the interesting part. By Part 6 it has a "server" to push to and a teammate, Sam, who pushes too.

Some later steps change a file with a `sed -i` command, so that you get exactly the same change and the same output. That is GNU `sed`, as on Linux and in Git Bash. On macOS, write `sed -i ''` instead of `sed -i`, or make the same edit in your editor.

## Create a Repository with git init

Create the project folder and turn it into a repository:

```terminal
{
  "title": "git init",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p ~/projects/status-page && cd ~/projects/status-page"
    },
    {
      "cmd": "git init",
      "output": "Initialized empty Git repository in /home/dev/projects/status-page/.git/"
    }
  ]
}
```

`git init` created one thing: a hidden `.git` directory. That directory is the repository. The rest of the folder is the working tree. Nothing in the folder is tracked yet.

Now create the project's files, starting with a `scripts` folder for the two scripts (`mkdir scripts`). `README.md`:

```markdown
# status-page

A small status page for the teams services.

- `services.txt`: one service per line, `<name> <https URL>`
- `scripts/check.sh`: checks the format of services.txt
- `scripts/build.sh`: writes the page to build/index.html
```

`services.txt`, the data:

```text
# name  URL
api     https://api.example.com/health
web     https://www.example.com/
```

`index.html` and `style.css`, the page:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Service status</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1>Service status</h1>
    <ul id="services"></ul>
  </body>
</html>
```

```css
body {
  font-family: system-ui, sans-serif;
  margin: 2rem;
}
h1 {
  font-size: 1.5rem;
}
```

`scripts/check.sh` checks that every line of `services.txt` has a name and an HTTPS URL:

```bash
#!/usr/bin/env bash
# Check services.txt: each line is "<name> <https URL>"; blank lines and # comments are allowed.
set -euo pipefail
cd "$(dirname "$0")/.."

errors=0
n=0
while read -r name url extra || [[ -n ${name:-} ]]; do
  n=$((n + 1))
  [[ -z $name || $name == \#* ]] && continue
  if [[ -z $url || -n $extra || $url != https://* ]]; then
    echo "services.txt:$n: want '<name> <https URL>', got '$name $url${extra:+ $extra}'" >&2
    errors=$((errors + 1))
  fi
done < services.txt

if ((errors > 0)); then
  echo "check failed: $errors bad line(s)" >&2
  exit 1
fi
echo "services.txt: OK"
```

`scripts/build.sh` runs the check and writes `build/index.html` with one list item per service:

```bash
#!/usr/bin/env bash
# Write build/index.html: index.html with one list item per service in services.txt.
set -euo pipefail
cd "$(dirname "$0")/.."

scripts/check.sh
mkdir -p build
{
  sed '/<ul id="services">/,$d' index.html
  echo '    <ul id="services">'
  while read -r name url || [[ -n ${name:-} ]]; do
    [[ -z $name || $name == \#* ]] && continue
    printf '      <li><a href="%s">%s</a></li>\n' "$url" "$name"
  done < services.txt
  echo '    </ul>'
  sed '1,/<ul id="services">/d' index.html
} > build/index.html
cp style.css build/
echo "built build/index.html ($(grep -c '<li>' build/index.html) services)"
```

Last, a `.gitattributes` file. It tells Git to store and check out shell scripts with LF line endings on every system, so the scripts still run after someone commits them from Windows ([Part 9](/guides/introduction-to-git/09-best-practices#h2-line-endings-and-gitattributes) explains line endings):

```text
# Shell scripts always use LF line endings, also in Windows checkouts
*.sh text eol=lf
```

Save the scripts with LF line endings (on Windows, check the line ending setting in your editor's status bar; a script saved with CRLF fails with a `bad interpreter` error). Make them executable and ask Git what it sees:

```terminal
{
  "title": "untracked files",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "chmod +x scripts/check.sh scripts/build.sh"
    },
    {
      "cmd": "git status",
      "output": "On branch main\n\nNo commits yet\n\nUntracked files:\n  (use \"git add <file>...\" to include in what will be committed)\n\t.gitattributes\n\tREADME.md\n\tindex.html\n\tscripts/\n\tservices.txt\n\tstyle.css\n\nnothing added to commit but untracked files present (use \"git add\" to track)"
    }
  ]
}
```

All files are **untracked**: they are in the working tree, but not in the repository. Git also tells you it is on branch `main` with "No commits yet".

## Make the First Commit

Committing takes two steps. `git add` puts the current content of files into the staging area, and `git commit` stores the staging area as a commit:

```terminal
{
  "title": "the first commit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git add . && git add --chmod=+x scripts/check.sh scripts/build.sh"
    },
    {
      "cmd": "git status --short",
      "output": "A  .gitattributes\nA  README.md\nA  index.html\nA  scripts/build.sh\nA  scripts/check.sh\nA  services.txt\nA  style.css"
    },
    {
      "cmd": "git commit -m \"Add the first version of the status page\"",
      "output": "[main (root-commit) 46b8da1] Add the first version of the status page\n 7 files changed, 71 insertions(+)\n create mode 100644 .gitattributes\n create mode 100644 README.md\n create mode 100644 index.html\n create mode 100755 scripts/build.sh\n create mode 100755 scripts/check.sh\n create mode 100644 services.txt\n create mode 100644 style.css"
    },
    {
      "cmd": "git log",
      "output": "commit 46b8da18e4efd0f6a8d3356b8006254f4ac46b45\nAuthor: Dev <dev@example.com>\nDate:   Mon Oct 12 09:07:00 2026 +0000\n\n    Add the first version of the status page"
    }
  ]
}
```

`git add .` staged everything under the current directory (`A` means added). The second command records the execute bit of the scripts; on Linux and macOS `chmod` already did that, but Windows file systems have no execute bit, so there it is needed. The commit output shows the branch (`main`), that this is the **root commit** (it has no parent), the commit's short hash and its message, then a summary. `create mode 100755` shows that Git recorded the execute bit of the two scripts: Git tracks file content, the file name and whether the file is executable, but not owners, timestamps or other permissions.

[Part 3](/guides/introduction-to-git/03-tracking-changes) goes deeper into staging, diffs and commit messages.

## What Is Inside .git

You never need to edit `.git` by hand, but knowing what is in it removes a lot of mystery:

```terminal
{
  "title": "the repository is the .git directory",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ls -A .git",
      "output": "COMMIT_EDITMSG\nHEAD\nconfig\ndescription\nhooks\nindex\ninfo\nlogs\nobjects\nrefs"
    },
    {
      "cmd": "cat .git/HEAD",
      "output": "ref: refs/heads/main"
    },
    {
      "cmd": "git repo info object.format references.format",
      "output": "object.format=sha1\nreferences.format=files"
    }
  ]
}
```

- `objects/` is the database: every file version, directory listing and commit, compressed and named by its hash.
- `refs/` holds branches (`refs/heads/`) and tags (`refs/tags/`), each a small file with a commit hash.
- `HEAD` says which branch you are on. Here it points to `refs/heads/main`.
- `index` is the staging area, `config` the repository's own settings, `hooks/` sample scripts ([Part 9](/guides/introduction-to-git/09-best-practices#h2-hooks-checks-before-you-commit-or-push)).
- `git repo info` (Git 2.52+) reports how the repository stores data: SHA-1 object names and the classic `files` format for refs, the defaults until Git 3.0.

Deleting `.git` deletes the whole history and leaves only the current files. Copying the project folder with `.git` copies the history too.

## Keep Files Out with .gitignore

Some files in a project folder must never be committed: build output that can be regenerated, dependencies, logs, editor files, and above all local settings with secrets. Build the page and create a local settings file to see the problem:

```terminal
{
  "title": "generated and local files show up as untracked",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "scripts/build.sh",
      "output": "services.txt: OK\nbuilt build/index.html (2 services)"
    },
    {
      "cmd": "echo \"STATUS_API_TOKEN=change-me\" > .env"
    },
    {
      "cmd": "git status --short",
      "output": "?? .env\n?? build/"
    }
  ]
}
```

`??` marks untracked files. Without help, a `git add .` would commit the build output and the token. A `.gitignore` file in the top folder of the project tells Git which paths to leave alone:

```text
# build output
build/

# local settings and secrets, but keep the example file
.env
.env.*
!.env.example

# logs and editor or OS files
*.log
*.swp
.DS_Store
.idea/
.vscode/
```

```terminal
{
  "title": "ignored files disappear from git status",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git status --short",
      "output": "?? .gitignore"
    },
    {
      "comment": "which rule ignores a path? -v shows the file, line and pattern",
      "cmd": "git check-ignore -v build/index.html .env",
      "output": ".gitignore:2:build/\tbuild/index.html\n.gitignore:5:.env\t.env"
    },
    {
      "cmd": "git status --short --ignored",
      "output": "?? .gitignore\n!! .env\n!! build/"
    },
    {
      "cmd": "git add .gitignore && git commit -m \"Ignore build output and local settings\"",
      "output": "[main b8e0203] Ignore build output and local settings\n 1 file changed, 14 insertions(+)\n create mode 100644 .gitignore"
    }
  ]
}
```

`git check-ignore -v` is the command to reach for when a file is ignored and you do not know why, or is not ignored and you expected it to be. `--ignored` lists ignored files, marked `!!`.

The patterns follow a few rules:

| Pattern         | Matches                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `*.log`         | Any file ending in `.log`, in any directory                                                               |
| `build/`        | A directory called `build` anywhere, and everything in it (a trailing `/` matches only directories)       |
| `/build/`       | Only the `build` directory at the top of the repository                                                   |
| `docs/*.pdf`    | PDF files directly in `docs/` (a `/` in the middle anchors the pattern to the `.gitignore` file's folder) |
| `**/cache/`     | A `cache` directory at any depth                                                                          |
| `!.env.example` | Exception: track this file even though `.env.*` matches it                                                |
| `# text`        | A comment                                                                                                 |

Three more places hold ignore rules:

- A `.gitignore` in a subfolder applies to that folder.
- `.git/info/exclude` works like `.gitignore` but is never committed: use it for files only you have.
- A global file for every repository on your computer, for editor and OS files, so each project does not need to list them. Git reads `~/.config/git/ignore` by default; `core.excludesFile` points it elsewhere.

`.gitignore` only affects untracked files. If a file is already committed, adding it to `.gitignore` changes nothing; you have to remove it from the index first with `git rm --cached` ([Part 3](/guides/introduction-to-git/03-tracking-changes#h2-remove-and-rename-files), and [this post](/posts/how-to-make-git-forget-tracked-file-in-gitignore) for the details). Git also does not track empty directories; the usual workaround is a `.gitkeep` file ([why, and the alternatives](/posts/how-do-i-add-an-empty-directory-to-a-git-repository)).

[GitHub's gitignore repository](https://github.com/github/gitignore) has starting templates for most languages and frameworks.

## Clone a Repository

`git clone` copies a repository with its full history and sets it up for you: it creates the folder, downloads all objects, creates a remote called `origin` that points back to where you cloned from, and checks out the default branch.

```bash
git clone https://github.com/OWNER/REPO.git          # into ./REPO
git clone https://github.com/OWNER/REPO.git my-dir   # into ./my-dir
git clone git@github.com:OWNER/REPO.git              # over SSH (Part 6 sets up keys)
```

The URL can also be a path on your own disk, which is how this guide clones without a hosting service. Clone the project into a second folder:

```terminal
{
  "title": "clone a repository",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~ && git clone ~/projects/status-page ~/clones/status-page",
      "output": "Cloning into '/home/dev/clones/status-page'...\ndone."
    },
    {
      "cmd": "cd ~/clones/status-page && git log --oneline",
      "output": "b8e0203 Ignore build output and local settings\n46b8da1 Add the first version of the status page"
    },
    {
      "cmd": "git remote -v",
      "output": "origin\t/home/dev/projects/status-page (fetch)\norigin\t/home/dev/projects/status-page (push)"
    },
    {
      "cmd": "git branch -vv",
      "output": "* main b8e0203 [origin/main] Ignore build output and local settings"
    }
  ]
}
```

The clone has the same two commits with the same hashes, a remote `origin` pointing at the original folder, and a local `main` that tracks `origin/main` ([Part 6](/guides/introduction-to-git/06-remote-repositories) explains remotes and tracking). Note that `.gitignore`d files (`.env`, `build/`) did not come along: only committed content travels.

### Clone options you will use

| Option                  | What it does                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--branch <name>`, `-b` | Check out this branch or tag instead of the default branch                                                                                                                           |
| `--single-branch`       | Download only that one branch's history ([how to clone a specific branch](/posts/clone-specific-git-branch))                                                                         |
| `--depth 1`             | A **shallow clone**: only the newest commit. Common in CI                                                                                                                            |
| `--filter=blob:none`    | A **partial clone**: full history, but file contents are downloaded only when needed ([Part 10](/guides/introduction-to-git/10-advanced-techniques#h2-work-with-large-repositories)) |
| `--recurse-submodules`  | Also clone the submodules ([Part 10](/guides/introduction-to-git/10-advanced-techniques#h2-submodules-and-subtrees))                                                                 |
| `--origin <name>`       | Name the remote something other than `origin`                                                                                                                                        |
| `--bare`                | Only the repository, with no working tree: the format servers use ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-set-up-a-remote))                                  |

For a local path, Git copies (or hard-links) the object files directly, and some options are ignored. A `file://` URL makes Git use the same transfer process it uses over a network:

```terminal
{
  "title": "--depth needs a real transfer",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~ && git clone --depth 1 ~/projects/status-page ~/clones/not-shallow",
      "output": "Cloning into '/home/dev/clones/not-shallow'...\nwarning: --depth is ignored in local clones; use file:// instead.\ndone."
    },
    {
      "cmd": "git clone --depth 1 \"file://$HOME/projects/status-page\" ~/clones/shallow",
      "output": "Cloning into '/home/dev/clones/shallow'..."
    },
    {
      "cmd": "git -C ~/clones/shallow log --oneline",
      "output": "b8e0203 Ignore build output and local settings"
    }
  ]
}
```

The shallow clone has only the newest commit. That is enough to build or test the code, but commands that need older history (`git log` beyond that commit, `git blame`, `git merge-base`) see a truncated history. `git fetch --unshallow` downloads the rest.

### URL forms

| Form                    | Example                                | Notes                                                                    |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| HTTPS                   | `https://github.com/OWNER/REPO.git`    | Works through most firewalls; needs a token or credential helper to push |
| SSH, short form         | `git@github.com:OWNER/REPO.git`        | Uses your SSH key; the usual choice for daily work                       |
| SSH, URL form           | `ssh://git@host:2222/srv/git/repo.git` | Needed for a port other than 22                                          |
| Git protocol            | `git://host/repo.git`                  | Read-only and unencrypted; GitHub stopped serving it in 2022             |
| Local path or `file://` | `/srv/git/repo.git`                    | Another folder or a network share                                        |

To find out where an existing clone came from, run `git remote get-url origin` ([more ways](/posts/how-to-determine-the-url-that-a-local-git-repository-was-originally-cloned-from)).

## Common Mistakes

- **Running `git init` in your home directory.** Every file under it is now "untracked", and other repositories below it look nested. If it happened by mistake, delete only the new `~/.git` directory (check with `ls -A ~` first).
- **Creating a repository inside another one.** `git add` then warns about an "embedded git repository" and records only a pointer. Use a submodule on purpose ([Part 10](/guides/introduction-to-git/10-advanced-techniques#h2-submodules-and-subtrees)) or keep the projects apart.
- **Adding `.gitignore` after committing the files.** The rules do not apply to tracked files. Run `git rm --cached` on them.
- **Committing secrets "for now".** Anything committed stays in the history, also after you delete the file. Ignore `.env` files from the first commit, and see [Part 8](/guides/introduction-to-git/08-history#h2-remove-a-secret-from-history) if it already happened.
- **Expecting `--depth` to work with a local path.** Use `file://`, as above.

## Summary

- `git init` turns a folder into a repository by creating `.git`; `git clone` copies a repository with its history and sets up `origin`.
- The first commit is `git add` plus `git commit`; Git records content, names and the execute bit.
- `.gitignore` keeps build output, dependencies and secrets out; `git check-ignore -v` explains any rule.
- `--branch`, `--single-branch`, `--depth` and `--filter` make clones faster and smaller when you do not need everything.

Next: [Tracking Changes](/guides/introduction-to-git/03-tracking-changes), where you stage, inspect and commit changes, and undo the ones you did not mean.

## Keep Learning

- [Clone a repository into a specific folder](/posts/clone-git-repo-specific-folder)
- [Clone all remote branches](/posts/clone-all-remote-branches-git)
- [Remove a file from Git without deleting it locally](/posts/remove-file-from-git-keep-local)
