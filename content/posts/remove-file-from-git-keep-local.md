---
title: 'Remove a File from Git Without Deleting It, or Undo git add'
excerpt: 'Stop tracking a file with git rm --cached and keep it on disk, unstage a file with git restore --staged, and commit only part of a file with git add -p.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-09-15'
publishedAt: '2024-09-15T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - File Management
  - Gitignore
  - Staging
  - Repository
---

You committed a configuration file or an `.env` file that should not be in Git, and you want Git to forget it but keep the file on your machine. Or you have not committed yet: you staged the wrong file, or you staged a whole file when only half of it belongs in the commit. All three fixes work on the **index** (the staging area), the list of file versions that your next commit will contain. This page shows each one.

## TLDR

| Question                                         | Short answer                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| Stop tracking a file but keep it on disk         | `git rm --cached <file>`, add it to `.gitignore`, and commit              |
| Stop tracking files that `.gitignore` now covers | `git ls-files -ci --exclude-standard -z \| xargs -0 git rm --cached`      |
| Undo `git add` before a commit                   | `git restore --staged <file>` (or `git reset <file>`)                     |
| Undo `git add` before the first commit           | `git rm --cached <file>`                                                  |
| Commit only part of a file                       | `git add -p <file>`, answer `y` or `n` for each change, then `git commit` |
| Remove a secret from the history                 | Rotate the secret first. Then rewrite the history with `git filter-repo`  |

## Prerequisites

- Git 2.23 or later for `git restore`. The output on this page comes from Git 2.39.
- A repository where you can try the commands. The [Git concepts simulator](/games/git-concepts-simulator) shows the working directory, the index and the commits side by side in your browser.

## Understanding Git's File Tracking

Git tracks files in three main areas:

```text
Working Directory  →  Staging Area  →  Repository
(your files)          (git add)        (git commit)
```

When you remove a file with `git rm`, it deletes it from both the staging area and your working directory. To keep it locally, you need the `--cached` flag, which only removes it from Git's tracking.

## How Do I Remove a File from Git Without Deleting It?

To stop tracking a specific file while keeping it locally:

```bash
# Remove from Git but keep local copy
git rm --cached config.json

# Check the status
git status
```

Git now shows the file as deleted from the repository:

```text
Changes to be committed:
  deleted:    config.json

Untracked files:
  config.json
```

The file is marked as deleted in the staging area but still exists in your working directory. Commit this change:

```bash
# Commit the removal
git commit -m "Stop tracking config.json"

# Push to remote
git push origin main
```

After this, the file remains on your local machine but is no longer tracked by Git.

## Preventing Future Tracking

To make sure you do not accidentally add the file back to Git, add it to `.gitignore`:

```bash
# Add to gitignore
echo "config.json" >> .gitignore

# Commit the gitignore change
git add .gitignore
git commit -m "Add config.json to gitignore"
```

Now Git will ignore this file in future commits, even if you run `git add .`.

## Removing Multiple Files

To remove several files at once:

```bash
# Remove multiple specific files
git rm --cached secrets.env database.config api-keys.json

# Or use a pattern. Quote it, so that Git matches it in every directory
git rm --cached '*.log'

# Commit the changes
git commit -m "Stop tracking configuration and log files"
```

This is useful when you have multiple environment files or logs that should not be in version control.

## Removing an Entire Directory

To stop tracking a directory while keeping it locally:

```bash
# Remove directory from Git
git rm --cached -r node_modules/

# Add to gitignore
echo "node_modules/" >> .gitignore

# Commit the changes
git add .gitignore
git commit -m "Stop tracking node_modules directory"
```

The `-r` flag makes the removal recursive, handling all files and subdirectories within the directory.

## Common Use Cases

**Environment Files**

Environment files contain sensitive data like API keys and database passwords:

```bash
# Stop tracking env file
git rm --cached .env

# Add to gitignore
echo ".env" >> .gitignore

# Create a template for others: the variable names, no values
cat > .env.example <<'EOF'
DATABASE_URL=
API_KEY=
EOF
cat .env.example                     # check that it holds no secret
git add .gitignore .env.example

# Commit changes
git commit -m "Stop tracking .env, add .env.example template"
```

This approach lets you provide a template (`.env.example`) while keeping actual credentials private.

**IDE Configuration**

IDE-specific files like VS Code or JetBrains settings:

```bash
# Remove IDE files
git rm --cached -r .vscode/
git rm --cached -r .idea/

# Add to gitignore
cat >> .gitignore << EOF
.vscode/
.idea/
*.swp
*.swo
EOF

# Commit
git add .gitignore
git commit -m "Stop tracking IDE configuration files"
```

**Build Artifacts**

Compiled code and build outputs that can be regenerated:

```bash
# Remove build directories
git rm --cached -r dist/
git rm --cached -r build/
git rm --cached -r target/

# Add to gitignore
cat >> .gitignore << EOF
dist/
build/
target/
EOF

git add .gitignore
git commit -m "Stop tracking build artifacts"
```

## Verifying the File is No Longer Tracked

After removing a file, verify it is no longer in the repository:

```bash
# Check repository status
git status

# Verify file exists locally
ls -la config.json

# Confirm file is not in Git
git ls-files | grep config.json
```

If `git ls-files` returns no results, the file is successfully removed from Git's tracking.

## What Happens to Other Team Members

When others pull your changes:

```bash
# On another machine after pulling
git pull origin main
```

Git will remove the file from their working directory. They'll need to recreate it:

```bash
# File is now deleted locally
# They need to recreate it from the example
cp .env.example .env

# Then edit it with their own values
nano .env
```

This is why providing an example file (like `.env.example`) is important - it shows others what configuration they need.

## Removing Files That Were Already in History

`git rm --cached` only changes the next commit. Every older commit still contains the file, and anyone with a clone can read it with `git show <commit>:config.json`. If the file holds a secret, the order of the steps matters:

1. **Rotate the secret first.** Revoke the key or change the password now. Bots scan public repositories for keys within minutes, so assume that a pushed secret is known. The rotation alone is often enough, and it is the only step that protects copies you cannot reach: forks, clones, CI caches.
2. **Then rewrite the history, if you still need to.** Use [git filter-repo](https://github.com/newren/git-filter-repo) in a fresh clone. It is not part of Git, so install it first. The Git project recommends it over `git filter-branch`.

Ask everyone to stop pushing while you work, because a forced push replaces whatever is on the remote:

```bash
git clone git@github.com:acme/api.git api-clean
cd api-clean
git ls-remote origin > ../before.txt                # the remote state before the rewrite
git filter-repo --path config.json --invert-paths   # remove the file from every commit
git remote add origin git@github.com:acme/api.git   # filter-repo removes origin on purpose
git ls-remote origin | diff ../before.txt -         # no output: nobody pushed in the meantime
git fetch origin                                    # gives the lease below something to check
git push --force-with-lease origin --all
git push --force origin --tags                      # a lease cannot check tags
```

The `git fetch` matters: without remote-tracking branches, `--force-with-lease` rejects every push with `stale info`. The lease then protects against a push that lands after the fetch, and the `diff` covers the time before it. Tags have no remote-tracking copy, so a lease rejects them too; the `diff` is the check for tags.

Every commit hash after the first change is new. Everyone must clone again or reset their branches, and open pull requests may still show the old commits. On GitHub, cached views of old commits can stay visible until GitHub Support removes them. The [history chapter of the Git guide](/guides/introduction-to-git/08-history#h2-remove-a-secret-from-history) walks through the full process, and [pre-commit hooks for security](/posts/pre-commit-hooks-security-guide) stop the next secret before the commit.

## Make Git Forget a File That Is Now in .gitignore

Adding a path to `.gitignore` does not untrack it: ignore rules only apply to files Git does not track yet. List the tracked files your rules now match, remove them from the index, and commit:

```bash
git ls-files -ci --exclude-standard                                # tracked files that .gitignore matches
git ls-files -ci --exclude-standard -z | xargs -0 git rm --cached   # untrack them, keep the files
git add .gitignore
git commit -m "Stop tracking ignored files"
```

Here the repository tracks `.env`, `config/database.yml` and `logs/app.log`, and a new `.gitignore` covers all three:

```terminal
{
  "title": "untrack what .gitignore now covers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git status --short",
      "output": " M config/database.yml\n?? .gitignore"
    },
    {
      "cmd": "git ls-files -ci --exclude-standard",
      "output": ".env\nconfig/database.yml\nlogs/app.log"
    },
    {
      "cmd": "git ls-files -ci --exclude-standard -z | xargs -0 git rm --cached",
      "output": "rm '.env'\nrm 'config/database.yml'\nrm 'logs/app.log'"
    },
    {
      "cmd": "git add .gitignore && git status --short",
      "output": "D  .env\nA  .gitignore\nD  config/database.yml\nD  logs/app.log"
    }
  ]
}
```

The files stay on disk. `-c` lists cached (tracked) files, `-i` keeps only the ignored ones, and `--exclude-standard` reads `.gitignore`, `.git/info/exclude` and your global excludes file.

`git check-ignore` tells you which rule matches a path, but it skips tracked files. Before you untrack the file, it prints nothing and exits with 1, which looks like "not ignored". Add `--no-index` to see the rule:

```terminal
{
  "title": "check-ignore on a tracked file",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git check-ignore -v config/database.yml; echo \"exit $?\"",
      "output": "exit 1"
    },
    {
      "cmd": "git check-ignore -v --no-index config/database.yml",
      "output": ".gitignore:2:config/database.yml\tconfig/database.yml"
    }
  ]
}
```

## Bulk Removal of Ignored Files

The older recipe untracks everything and adds it back:

```bash
git rm -r --cached .
git add .
git status
git commit -m "Stop tracking files now in gitignore"
```

It works, but the commit can pick up unrelated changes. In a test, it staged an edit we had not meant to commit and a CRLF file that `* text=auto` in `.gitattributes` now converts to LF. The `git ls-files -ci` version above touches only the ignored files.

## Alternative: Using git update-index

Some answers suggest `--assume-unchanged` for local changes you do not want to commit. It is not a reliable way to ignore a tracked file, as the warning below explains. For local settings, use a tracked template and an ignored real file, as in the `.env` example above. If you still want to see how the flag works:

```bash
# Tell Git to ignore changes to this file
git update-index --assume-unchanged config.json

# Make local changes without Git tracking them
nano config.json

# Git will not show the file as modified
git status
```

To start tracking changes again:

```bash
# Resume tracking changes
git update-index --no-assume-unchanged config.json
```

This is different from `git rm --cached` because the file remains in the repository. It is useful for files that need to exist in the repo but have local modifications you do not want to commit.

Be careful with this flag and with its sibling `--skip-worktree`. The `git update-index` documentation says that neither one reliably ignores changes to tracked files. Git still compares the file during some operations. For example, a `git switch` to a branch that changes the file stops with "Your local changes would be overwritten", even though `git status` shows nothing. To find files you flagged and forgot, run `git ls-files -v | grep '^[hS]'` (`h` is assume-unchanged, `S` is skip-worktree). For local settings, a tracked example file plus an ignored real file is the better pattern.

## How Do I Undo git add Before a Commit?

Run `git restore --staged <file>`. The staged changes leave the index, and your changes stay in the file:

```bash
git add config.json app.js
git restore --staged config.json     # unstage one file
git restore --staged .               # unstage everything below the current directory
```

`git reset <file>` does the same, and works in Git versions older than 2.23. `git reset` without a file name unstages everything. Neither command changes the files on disk.

`git status` shows which command fits, because it prints the hint for the current state:

```text
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        modified:   src/auth.js
        new file:   src/utils.js
```

What unstaging does depends on the file:

- **A changed file** gets its index entry back from the last commit, so it is "modified but not staged" again.
- **A new file** leaves the index and becomes untracked again, as if you never ran `git add`.
- **A deleted file** (`rm old.js` then `git add old.js`): the deletion is no longer staged, but the file stays deleted on disk. Run `git restore old.js` to get the file back.

### Before the first commit

In a repository with no commits yet, there is no `HEAD` to restore from. On Git 2.39, `git restore --staged` stops with `fatal: could not resolve HEAD`. Use `git rm --cached`, which is also the hint that `git status` prints in a new repository:

```text
No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
        new file:   new.js
```

`git rm --cached new.js` removes the file from the index and leaves it on disk.

### Unstage only some changes in a file

`git restore --staged -p <file>` (or `git reset -p <file>`) shows each staged change and asks whether to unstage it. It is the reverse of `git add -p` below.

## How Do I Commit Only Part of a File?

Stage the changes you want with `git add -p`, then commit. Git shows each **hunk** (a group of changed lines) and asks what to do with it:

```bash
git add -p app.js
git diff --staged      # what the commit will contain
git diff               # what stays out of it
git commit -m "Add the auth middleware"
```

```text
@@ -10,6 +10,9 @@ const app = express();

 app.use(express.json());

+// Authentication middleware
+app.use(authenticateUser);
+
 app.listen(3000);
(1/2) Stage this hunk [y,n,q,a,d,j,J,g,/,e,?]?
```

The answers you need most:

- `y` stages the hunk, and `n` skips it.
- `s` splits the hunk into smaller hunks. Git offers `s` only when there are unchanged lines between the changes.
- `e` opens the hunk in your editor. Delete the `+` lines you do not want, and change `-` lines you want to keep to lines that start with a space.
- `q` stops, and `?` prints help for every letter.

The list of letters changes with the hunk and the Git version. In a test with one hunk that contained two separate changes, Git first offered `[y,n,q,a,d,s,e,?]`, and after `s` it offered the two smaller hunks.

`git commit -p` stages with the same questions and then commits in one step. To split a file into several commits, run `git add -p` and `git commit` again for each group of changes.

### Partly stage a new file

`git add -p` ignores untracked files and prints `No changes.`. Mark the file first with `git add -N` (intent to add), so that Git sees its content as a change:

```bash
git add -N new.js
git add -p new.js      # Stage addition [y,n,q,a,d,e,?]?
```

A new file is one hunk that Git cannot split, so use `e` to choose lines.

### Test the staged version only

To check that the staged part works without the rest, put the unstaged changes and the untracked files aside, run the tests, then bring them back:

```bash
git stash push --keep-index --include-untracked   # keeps only the staged changes in the files
npm test
git stash pop
```

Ignored files, such as `node_modules/` or a local `.env`, stay in place, so the tests can still see them. For a clean check, test in CI or in a fresh clone.

`git stash push --staged` (Git 2.35 and later) does the opposite: it stashes only the staged changes. To save the unstaged changes of one file for later, see [how to stash only one file](/posts/stash-single-file-git). To throw away unstaged hunks instead, `git restore -p <file>` asks for each one. The discarded changes are lost.

The [tracking chapter of the Git guide](/guides/introduction-to-git/03-tracking-changes#h3-stage-part-of-a-file-with-git-add-p) shows a full `git add -p` session with real output.

## Best Practices

- **Add a file to `.gitignore` in the same commit that untracks it**, so nobody adds it back by accident.
- **Track a template, ignore the real file.** Commit `.env.example` or `database.config.example` with empty or placeholder values, and list the real files in `.gitignore`. Say in the README which files to copy, for example `cp .env.example .env`.
- **Read `git diff --staged` before each commit.** It shows exactly what the commit will contain.
- **Stage by name, not with `git add .`**, when the working directory has changes that belong to different commits.

## Related Resources

- [Introduction to Git: git add, commit and diff](/guides/introduction-to-git/03-tracking-changes)
- [How to stash only one file](/posts/stash-single-file-git)
- [Find and restore a deleted file, or a file from an old commit](/posts/find-restore-deleted-file-git)
- [Git concepts simulator](/games/git-concepts-simulator): see the working directory, the index and the commits
- [Git basics interview question](/interview-questions/topic/git#git-basics)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz) and [Git Fundamentals flashcards](/flashcards/git-fundamentals)
