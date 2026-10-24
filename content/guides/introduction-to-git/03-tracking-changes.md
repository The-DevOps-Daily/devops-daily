---
title: 'Git Add, Commit and Diff: Track and Undo Changes'
description: 'The everyday Git loop: git status, git diff, git add (and add -p), git commit, git log, renaming files, undoing changes with restore and amend, and tags.'
order: 3
---

Most of your time with Git is one short loop: change files, look at what changed, stage the changes that belong together, commit them with a clear message, repeat. This part covers that loop in detail, plus the commands that fix the usual slips: a file staged by mistake, an edit you want to throw away, a commit message with a typo. At the end you tag the first release of the project.

## Prerequisites

- The `status-page` repository from [Part 2](/guides/introduction-to-git/02-repositories), with two commits. Any repository of your own works too; the commands are the same.

## Check the State with git status

`git status` is the command you will run most. Run it before and after anything you are not sure about:

```terminal
{
  "title": "a clean working tree",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git status",
      "output": "On branch main\nnothing to commit, working tree clean"
    }
  ]
}
```

Now make three changes. Add a `docs` service at the end of `services.txt`:

```text
docs    https://docs.example.com/
```

In `index.html`, add the team name to the `<title>`, and add a footer below the list:

```text
    <title>Service status - Example Team</title>
    ...
    <ul id="services"></ul>
    <footer>Built by scripts/build.sh</footer>
```

```terminal
{
  "title": "modified files",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git status",
      "output": "On branch main\nChanges not staged for commit:\n  (use \"git add <file>...\" to update what will be committed)\n  (use \"git restore <file>...\" to discard changes in working directory)\n\tmodified:   index.html\n\tmodified:   services.txt\n\nno changes added to commit (use \"git add\" and/or \"git commit -a\")"
    },
    {
      "comment": "the short form: one line per file",
      "cmd": "git status --short --branch",
      "output": "## main\n M index.html\n M services.txt"
    }
  ]
}
```

In the short form, the two columns are the staging area and the working tree. ` M` means modified in the working tree, not staged yet. `M ` means staged, `MM` means staged and then changed again, `A ` added, `D ` deleted, `R ` renamed and `??` untracked.

## See What Changed with git diff

`git diff` shows the changes in the working tree that are not staged yet, line by line:

```terminal
{
  "title": "unstaged changes",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git diff",
      "output": "diff --git a/index.html b/index.html\nindex 7df7dcb..115d7ba 100644\n--- a/index.html\n+++ b/index.html\n@@ -2,11 +2,12 @@\n <html lang=\"en\">\n   <head>\n     <meta charset=\"utf-8\" />\n-    <title>Service status</title>\n+    <title>Service status - Example Team</title>\n     <link rel=\"stylesheet\" href=\"style.css\" />\n   </head>\n   <body>\n     <h1>Service status</h1>\n     <ul id=\"services\"></ul>\n+    <footer>Built by scripts/build.sh</footer>\n   </body>\n </html>\ndiff --git a/services.txt b/services.txt\nindex e4f2d79..c322b71 100644\n--- a/services.txt\n+++ b/services.txt\n@@ -1,3 +1,4 @@\n # name  URL\n api     https://api.example.com/health\n web     https://www.example.com/\n+docs    https://docs.example.com/"
    },
    {
      "cmd": "git diff --stat",
      "output": " index.html   | 3 ++-\n services.txt | 1 +\n 2 files changed, 3 insertions(+), 1 deletion(-)"
    }
  ]
}
```

Lines starting with `-` were removed and lines starting with `+` were added. Each `@@ -2,11 +2,12 @@` header is a **hunk**: here, 11 lines starting at line 2 in the old version became 12 lines starting at line 2 in the new one. The other lines are unchanged context.

There are three diffs you will use all the time:

| Command             | Compares                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `git diff`          | Working tree with the staging area (unstaged changes)             |
| `git diff --staged` | Staging area with the last commit (what `git commit` would store) |
| `git diff HEAD`     | Working tree with the last commit (everything)                    |

## Stage Changes with git add

The `services.txt` change and the `index.html` changes are unrelated, so they should be separate commits. Stage only `services.txt`:

```terminal
{
  "title": "stage one file",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git add services.txt"
    },
    {
      "cmd": "git status --short",
      "output": " M index.html\nM  services.txt"
    },
    {
      "cmd": "git diff --staged",
      "output": "diff --git a/services.txt b/services.txt\nindex e4f2d79..c322b71 100644\n--- a/services.txt\n+++ b/services.txt\n@@ -1,3 +1,4 @@\n # name  URL\n api     https://api.example.com/health\n web     https://www.example.com/\n+docs    https://docs.example.com/"
    }
  ]
}
```

`git add` copies the file's content at that moment. If you edit the file again after `git add`, the new edits are not staged until you add it again (`git status` then shows `MM`).

| Command          | Stages                                                           |
| ---------------- | ---------------------------------------------------------------- |
| `git add <file>` | That file (or every file in a directory)                         |
| `git add .`      | All changes, new files and deletions under the current directory |
| `git add -A`     | All changes in the whole repository, from any directory          |
| `git add -u`     | Changes and deletions of tracked files only, no new files        |
| `git add -p`     | Chosen parts of files, interactively                             |

The difference between `.` and `-A` only shows when you run them from a subdirectory ([the details](/posts/git-add-a-vs-git-add-dot)).

### Stage part of a file with git add -p

`index.html` has two changes, the title and the footer, and only the title belongs in the next commit. `git add -p` (patch mode) shows each hunk and asks what to do with it. Git put both changes in one hunk because they are close together; `s` splits it, `y` stages a hunk and `n` skips it:

```terminal
{
  "title": "git add -p: answer s, y, n",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git add -p index.html",
      "output": "diff --git a/index.html b/index.html\nindex 7df7dcb..115d7ba 100644\n--- a/index.html\n+++ b/index.html\n@@ -2,11 +2,12 @@\n <html lang=\"en\">\n   <head>\n     <meta charset=\"utf-8\" />\n-    <title>Service status</title>\n+    <title>Service status - Example Team</title>\n     <link rel=\"stylesheet\" href=\"style.css\" />\n   </head>\n   <body>\n     <h1>Service status</h1>\n     <ul id=\"services\"></ul>\n+    <footer>Built by scripts/build.sh</footer>\n   </body>\n </html>\n(1/1) Stage this hunk [y,n,q,a,d,s,e,p,P,?]? s\nSplit into 2 hunks.\n@@ -2,9 +2,9 @@\n <html lang=\"en\">\n   <head>\n     <meta charset=\"utf-8\" />\n-    <title>Service status</title>\n+    <title>Service status - Example Team</title>\n     <link rel=\"stylesheet\" href=\"style.css\" />\n   </head>\n   <body>\n     <h1>Service status</h1>\n     <ul id=\"services\"></ul>\n(1/2) Stage this hunk [y,n,q,a,d,k,K,j,J,g,/,e,p,P,?]? y\n@@ -6,7 +6,8 @@\n     <link rel=\"stylesheet\" href=\"style.css\" />\n   </head>\n   <body>\n     <h1>Service status</h1>\n     <ul id=\"services\"></ul>\n+    <footer>Built by scripts/build.sh</footer>\n   </body>\n </html>\n(2/2) Stage this hunk [y,n,q,a,d,K,J,g,/,e,p,P,?]? n"
    },
    {
      "comment": "the staged part, and the part still waiting",
      "cmd": "git diff --staged --stat && git diff --stat",
      "output": " index.html   | 2 +-\n services.txt | 1 +\n 2 files changed, 2 insertions(+), 1 deletion(-)\n index.html | 1 +\n 1 file changed, 1 insertion(+)"
    }
  ]
}
```

The most useful answers at the prompt are `y` (stage), `n` (skip), `s` (split into smaller hunks), `e` (edit the hunk by hand), `q` (quit) and `?` (help). Patch mode is how you keep commits small even when you made several changes at once. [How to commit only part of a file](/posts/commit-part-of-file-git) has more examples.

## Make Commits

The staging area now holds `services.txt` and the title change. Commit them as two commits. With a path, `git commit` commits only that path (its current content) and leaves everything else staged for the next commit:

```terminal
{
  "title": "two focused commits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git commit -m \"Add the docs service\" services.txt",
      "output": "[main f96dea5] Add the docs service\n 1 file changed, 1 insertion(+)"
    },
    {
      "cmd": "git commit -m \"Add the team name to the page title\"",
      "output": "[main 3c83098] Add the team name to the page title\n 1 file changed, 1 insertion(+), 1 deletion(-)"
    },
    {
      "cmd": "git status --short",
      "output": " M index.html"
    }
  ]
}
```

The footer change is still in the working tree, unstaged. `git commit -a` stages every change to a **tracked** file and commits it in one step. It never adds untracked files:

```terminal
{
  "title": "git commit -a",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git commit -a -m \"Add a footer to the page\"",
      "output": "[main 5c559e6] Add a footer to the page\n 1 file changed, 1 insertion(+)"
    }
  ]
}
```

### Write a message that helps the next reader

`-m` is fine for a one-line message. For anything that needs an explanation, run `git commit` without `-m`: Git opens your editor, and you write a short subject line, a blank line, and a body that says why the change was made. You can also pass several `-m` options; each one becomes a paragraph:

```bash
git commit -m "Check that service URLs use HTTPS" \
  -m "The page links to every service. A plain http:// URL would send
readers to an unencrypted page, so the check now rejects it."
```

[Part 9](/guides/introduction-to-git/09-best-practices#h2-write-commit-messages-people-can-use) covers message conventions, including Conventional Commits and trailers.

## View the History with git log

```terminal
{
  "title": "the history so far",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --oneline",
      "output": "5c559e6 Add a footer to the page\n3c83098 Add the team name to the page title\nf96dea5 Add the docs service\nb8e0203 Ignore build output and local settings\n46b8da1 Add the first version of the status page"
    },
    {
      "cmd": "git log --stat -2",
      "output": "commit 5c559e68691666ac49208741fe2c19f505750342\nAuthor: Dev <dev@example.com>\nDate:   Tue Oct 13 09:16:00 2026 +0000\n\n    Add a footer to the page\n\n index.html | 1 +\n 1 file changed, 1 insertion(+)\n\ncommit 3c83098e4af320de31235a61680399fbc2bf43ff\nAuthor: Dev <dev@example.com>\nDate:   Tue Oct 13 09:14:00 2026 +0000\n\n    Add the team name to the page title\n\n index.html | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)"
    },
    {
      "cmd": "git show HEAD",
      "output": "commit 5c559e68691666ac49208741fe2c19f505750342\nAuthor: Dev <dev@example.com>\nDate:   Tue Oct 13 09:16:00 2026 +0000\n\n    Add a footer to the page\n\ndiff --git a/index.html b/index.html\nindex 767bf7a..115d7ba 100644\n--- a/index.html\n+++ b/index.html\n@@ -8,5 +8,6 @@\n   <body>\n     <h1>Service status</h1>\n     <ul id=\"services\"></ul>\n+    <footer>Built by scripts/build.sh</footer>\n   </body>\n </html>"
    }
  ]
}
```

- `git log --oneline` shows one line per commit, newest first.
- `--stat` adds the files each commit changed; `-2` limits the output to two commits; `-p` shows the full diff.
- `git show <commit>` shows one commit: its metadata and its diff.

You can name a commit in several ways:

| Name               | Means                                                            |
| ------------------ | ---------------------------------------------------------------- |
| `46b8da1`          | A hash, or any unique prefix of at least 4 characters            |
| `HEAD`             | The commit you have checked out                                  |
| `HEAD~1`, `HEAD~2` | One or two commits before `HEAD` (following the first parent)    |
| `HEAD^`            | The first parent of `HEAD` (`HEAD^2` is a merge's second parent) |
| `main`, `v0.1.0`   | The commit a branch or tag points to                             |

When the output is longer than your screen, Git shows it in a pager (`less`): scroll with the arrow keys or space, and quit with `q`. [Part 8](/guides/introduction-to-git/08-history) shows how to search the history by message, author, date, file or content.

## Remove and Rename Files

`index.html` is really a template: `scripts/build.sh` turns it into `build/index.html`. A clearer name is `template.html`. `git mv` renames the file and stages the rename in one step; the build script needs the new name too:

```terminal
{
  "title": "rename a file with git mv",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git mv index.html template.html"
    },
    {
      "comment": "update the two lines in build.sh that read index.html",
      "cmd": "sed -i 's/ index.html$/ template.html/' scripts/build.sh && git diff scripts/build.sh",
      "output": "diff --git a/scripts/build.sh b/scripts/build.sh\nindex d2d9547..edebc8e 100755\n--- a/scripts/build.sh\n+++ b/scripts/build.sh\n@@ -6,14 +6,14 @@ cd \"$(dirname \"$0\")/..\"\n scripts/check.sh\n mkdir -p build\n {\n-  sed '/<ul id=\"services\">/,$d' index.html\n+  sed '/<ul id=\"services\">/,$d' template.html\n   echo '    <ul id=\"services\">'\n   while read -r name url || [[ -n ${name:-} ]]; do\n     [[ -z $name || $name == \\#* ]] && continue\n     printf '      <li><a href=\"%s\">%s</a></li>\\n' \"$url\" \"$name\"\n   done < services.txt\n   echo '    </ul>'\n-  sed '1,/<ul id=\"services\">/d' index.html\n+  sed '1,/<ul id=\"services\">/d' template.html\n } > build/index.html\n cp style.css build/\n echo \"built build/index.html ($(grep -c '<li>' build/index.html) services)\""
    },
    {
      "cmd": "git add scripts/build.sh && git status --short",
      "output": "M  scripts/build.sh\nR  index.html -> template.html"
    },
    {
      "cmd": "git commit -m \"Rename index.html to template.html\" && scripts/build.sh",
      "output": "[main b764ae4] Rename index.html to template.html\n 2 files changed, 2 insertions(+), 2 deletions(-)\n rename index.html => template.html (100%)\nservices.txt: OK\nbuilt build/index.html (3 services)"
    }
  ]
}
```

Git does not store renames. It stores the new snapshot, and when it shows history it notices that a deleted file and an added file have the same (or very similar) content, and reports a rename. `git mv old new` is the same as `mv old new` followed by `git add` of both paths. To see a renamed file's history across the rename, use `git log --follow -- template.html`.

To delete a file, use `git rm`: it deletes the file and stages the deletion. To **stop tracking** a file but keep it on disk, use `git rm --cached`. Suppose you kept personal notes in the project folder and a `git add .` committed them:

```terminal
{
  "title": "stop tracking a file but keep it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"ask Sam about the docs URL\" > notes.txt && git add . && git commit -q -m \"Add notes\" && git log --oneline -1",
      "output": "059af95 Add notes"
    },
    {
      "cmd": "git rm --cached notes.txt",
      "output": "rm 'notes.txt'"
    },
    {
      "cmd": "echo \"notes.txt\" >> .git/info/exclude && git commit -m \"Stop tracking notes.txt\"",
      "output": "[main db2cdcd] Stop tracking notes.txt\n 1 file changed, 1 deletion(-)\n delete mode 100644 notes.txt"
    },
    {
      "cmd": "ls notes.txt && git status --short",
      "output": "notes.txt"
    }
  ]
}
```

The file is still on disk, no longer tracked, and ignored through `.git/info/exclude` (personal, so not in the shared `.gitignore`). It is still in the history, in the "Add notes" commit. That is harmless for notes and serious for secrets: a committed password stays in every clone until you rewrite the history ([Part 8](/guides/introduction-to-git/08-history#h2-remove-a-secret-from-history)), and you must change the password anyway.

## Undo Things

Most mistakes before a push are easy to undo. Pick the row that matches what you want:

| You want to                                   | Run                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Throw away unstaged changes to a file         | `git restore <file>`                                                                                                 |
| Unstage a file, but keep the changes          | `git restore --staged <file>`                                                                                        |
| Change the last commit's message              | `git commit --amend -m "new message"`                                                                                |
| Add a forgotten change to the last commit     | `git add <file>`, then `git commit --amend --no-edit`                                                                |
| Undo the last commit, keep its changes staged | `git reset --soft HEAD~1`                                                                                            |
| Undo a commit that is already pushed          | `git revert <commit>` ([Part 8](/guides/introduction-to-git/08-history#h2-undo-commits-reset-revert-and-the-reflog)) |

```terminal
{
  "title": "restore, restore --staged and --amend",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"h1 { color: red; }\" >> style.css && git restore style.css && git status --short"
    },
    {
      "comment": "stage something by mistake, then unstage it",
      "cmd": "echo \"# TODO\" >> services.txt && git add services.txt && git restore --staged services.txt && git status --short",
      "output": " M services.txt"
    },
    {
      "cmd": "git restore services.txt"
    },
    {
      "comment": "a typo in the last message",
      "cmd": "echo \"h1 { margin-bottom: 0.5rem; }\" >> style.css && git commit -q -am \"Add spaceing below the heading\" && git log --oneline -1",
      "output": "96fceeb Add spaceing below the heading"
    },
    {
      "cmd": "git commit --amend -m \"Add spacing below the heading\"",
      "output": "[main 1e24459] Add spacing below the heading\n Date: Tue Oct 13 09:31:00 2026 +0000\n 1 file changed, 1 insertion(+)"
    },
    {
      "cmd": "git log --oneline -3",
      "output": "1e24459 Add spacing below the heading\ndb2cdcd Stop tracking notes.txt\n059af95 Add notes"
    }
  ]
}
```

`--amend` does not edit the old commit. It makes a new commit with a new hash and moves the branch to it; the old one is no longer on any branch. That is why you should only amend commits you have not pushed yet: anyone who already has the old commit now has a different history from yours.

:::warning
`git restore <file>` (like the older `git checkout -- <file>`) overwrites your unstaged changes to that file. Changes you never staged or committed were never stored by Git, so Git cannot bring them back. Your editor's local history is the only rescue.
:::

You will see older equivalents in many answers online. They still work:

| Newer command (Git 2.23+)     | Older equivalent         |
| ----------------------------- | ------------------------ |
| `git restore <file>`          | `git checkout -- <file>` |
| `git restore --staged <file>` | `git reset HEAD <file>`  |
| `git switch <branch>`         | `git checkout <branch>`  |

`git switch` and `git restore` were marked experimental when they arrived; Git 2.51 removed that label. This guide uses them because each does one job.

## Tag a Release

A **tag** is a fixed name for a commit, usually a release. Unlike a branch, it does not move. Git has two kinds:

- An **annotated tag** is an object of its own with a tagger, a date and a message, and it can be signed. Use it for releases.
- A **lightweight tag** is only a name for a commit, like a branch that never moves. Use it for private bookmarks.

```terminal
{
  "title": "tag the first release",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git tag -a v0.1.0 -m \"First release: three services, build and check scripts\""
    },
    {
      "cmd": "git tag -n",
      "output": "v0.1.0          First release: three services, build and check scripts"
    },
    {
      "cmd": "git show v0.1.0 --no-patch",
      "output": "tag v0.1.0\nTagger: Dev <dev@example.com>\nDate:   Tue Oct 13 09:34:00 2026 +0000\n\nFirst release: three services, build and check scripts\n\ncommit 1e2445947df34424a52bc873803317aa23feb9e3\nAuthor: Dev <dev@example.com>\nDate:   Tue Oct 13 09:31:00 2026 +0000\n\n    Add spacing below the heading"
    },
    {
      "comment": "describe names a commit relative to the nearest annotated tag it contains",
      "cmd": "echo \"web-2   https://www2.example.com/\" >> services.txt && git commit -q -am \"Add the web-2 service\" && git describe",
      "output": "v0.1.0-1-g1451c97"
    }
  ]
}
```

`git describe` prints the nearest annotated tag that the current commit contains, the number of commits since that tag, and `g` plus the short hash of the current commit (on the tagged commit itself, it prints only the tag name). Build scripts often use it as a version string. Tags are not pushed by default; [Part 6](/guides/introduction-to-git/06-remote-repositories#h2-push-tags) shows how.

## Common Mistakes

- **`git add .` without looking.** Run `git status` first, or use `git add -p`. It is the main way secrets and junk files get committed.
- **One commit for unrelated changes.** It makes review, `git revert` and `git bisect` harder. Stage by file or by hunk.
- **Amending a pushed commit.** It rewrites history that others have. Make a new commit instead.
- **Expecting `git commit -a` to add new files.** It only stages files Git already tracks.
- **`git rm` when you meant `git rm --cached`.** Plain `git rm` deletes the file from disk too (it refuses if the file has uncommitted changes).

## Summary

- `git status` and `git diff` show what changed; `git diff --staged` shows what the next commit contains.
- `git add` stages content, `git add -p` stages parts of files, and `git commit` stores the staging area.
- `git log`, `git show` and names such as `HEAD~1` let you read the history.
- `git mv`, `git rm` and `git rm --cached` rename, delete and untrack files.
- `git restore`, `git restore --staged` and `git commit --amend` undo the usual mistakes before you push.
- Annotated tags (`git tag -a`) mark releases.

Next: [Branching](/guides/introduction-to-git/04-branching), where you work on a change without touching `main`.

## Keep Learning

- [Undo git add before a commit](/posts/how-to-undo-git-add-before-commit)
- [Discard unstaged changes](/posts/how-to-discard-unstaged-changes-in-git)
- [Change an unpushed commit message](/posts/how-to-modify-existing-unpushed-commit-messages)
- [List all files in a commit](/posts/list-files-in-commit-git)
- [Git Command Quiz](/quizzes/git-quiz)
