---
title: 'How to Squash the Last N Commits and Change Commit Authors in Git'
excerpt: 'Squash the last N commits with git reset --soft or git rebase -i, use fixup commits, and fix commit authors with --amend, rebase --exec or a mailmap.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-20'
publishedAt: '2024-12-20T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Rebase
  - Squash
  - Commit History
  - History Rewriting
  - Version Control
---

Two history fixes come up before almost every pull request. You want ten commits called "fix typo" and "WIP" to become one clear commit, or you see that your last commits carry the wrong name or email because a new laptop had no Git identity. Both fixes rewrite commits, so both follow the same rules: do them on your own branch, check the result, and push with a lease. This page shows how to squash commits and how to change the author of one commit or many.

## TLDR

| Question                             | Short answer                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Squash the last N commits into one   | `git reset --soft HEAD~N` then `git commit`, or `git rebase -i HEAD~N` and mark commits `squash` |
| Squash every commit of a branch      | `git reset --soft $(git merge-base origin/main HEAD)` then `git commit`                          |
| Fold a fix into an older commit      | `git commit --fixup <commit>`, then `git rebase -i --autosquash <base>`                          |
| Push after a squash                  | `git push --force-with-lease`. Never on a branch that other people push to                       |
| Fix the author of the last commit    | `git commit --amend --no-edit --author="Name <email>"` or `--reset-author`                       |
| Fix the author of the last N commits | `git rebase --exec 'git commit --amend --no-edit --reset-author' HEAD~N`                         |
| Fix one email in the whole history   | `git filter-repo --mailmap my-mailmap` on a fresh clone                                          |
| Fix only how names show in `git log` | A `.mailmap` file. No history rewrite                                                            |

## Prerequisites

- Git 2.23 or later. The output on this page comes from Git 2.39. The [history chapter of the Git guide](/guides/introduction-to-git/08-history#h2-rewrite-local-history-with-interactive-rebase) shows the same commands on Git 2.56.
- A branch that only you push to. Rewritten commits get new hashes, and anyone who has the old commits must repair their clone.
- A safety net: `git branch backup-before-rewrite` before you start. The reflog also keeps the old commits, as [undo a git rebase](/posts/undo-git-rebase) shows.

## How Do I Squash My Last N Commits Together?

The fastest way is a soft reset. It moves the branch back N commits and keeps all their changes staged, so one `git commit` records them as a single commit:

```bash
git status                                    # start with nothing staged
git log --oneline -4
git reset --soft HEAD~3                       # the last 3 commits become staged changes
git commit -m "Add login with email validation"
```

Start with a clean index: changes that were already staged go into the new commit too.

`HEAD~3` is the commit three steps before `HEAD`, so `HEAD~3` keeps it and everything older. The new commit gets the message you type, and the old messages are gone.

To keep some messages, or to squash only some of the commits, use an interactive rebase:

```bash
git rebase -i HEAD~3
```

Git opens the list of the three commits, oldest first:

```text
pick 3d0f1ca Add login form
pick b5ca0b9 Fix typo in login form
pick e0ea0d4 Validate the email field
```

Change `pick` to `squash` (or `s`) on each commit that you want to join into the commit above it:

```text
pick 3d0f1ca Add login form
squash b5ca0b9 Fix typo in login form
squash e0ea0d4 Validate the email field
```

Save and close the editor. Git opens a second editor with all three messages. Write one message, save, and the rebase finishes. `fixup` (or `f`) works like `squash` but drops the message of that commit, which is what you want for "fix typo".

### Squash every commit of a branch

Reset to the common ancestor of your branch and `origin/main`, which `git merge-base` finds. That is where your branch started, or the last `main` commit that you merged into it:

```bash
git fetch origin
git reset --soft "$(git merge-base origin/main HEAD)"
git commit -m "Add the billing export"
```

You do not always need to squash yourself. GitHub, GitLab and Bitbucket can squash a pull request when they merge it, and `git merge --squash feature` followed by `git commit` does the same locally. The [collaboration chapter of the Git guide](/guides/introduction-to-git/07-collaboration#h2-merge-methods-on-a-pull-request) compares the merge methods.

### Mark fixes as you go with fixup commits

When you fix something in an older commit of your branch, say so in the commit:

```bash
git commit --fixup 3d0f1ca          # creates "fixup! Add login form"
git rebase -i --autosquash origin/main
```

`--autosquash` moves each `fixup!` commit below its target and marks it `fixup` in the todo list, so you only save the list. In a test, two `fixup!` commits went into their two target commits, and only those two commits were left on the branch. Since Git 2.44, `git rebase --autosquash` also works without `-i`. Set `git config --global rebase.autoSquash true` to make it the default for interactive rebases.

### Resolve conflicts, or stop

Squashing commits in their original order on the same base does not conflict. A conflict comes when you also change the order of commits, drop a commit, or rebase onto a newer base at the same time:

```text
CONFLICT (content): Merge conflict in src/auth.js
error: could not apply e0ea0d4... Validate the email field
```

Fix the file, then `git add src/auth.js` and `git rebase --continue`. To give up and get your branch back as it was, run `git rebase --abort`. If the rebase already finished and the result is wrong, reset to your backup branch, or to the entry before the rebase in `git reflog`. Right after the rebase, `git reset --hard ORIG_HEAD` also works. Each of these discards uncommitted changes, so save them first.

### Push a squashed branch

The remote branch still has the old commits, so a normal push is rejected. Replace it with a lease:

```bash
git push --force-with-lease --force-if-includes
```

`--force-with-lease` refuses the push if the remote branch has commits that your last fetch did not see, so you do not delete a push from someone else. `--force-if-includes` (Git 2.30 and later) also catches the case where an editor or tool fetched in the background, and your local branch never included those new commits. The [force push section of the Git guide](/guides/introduction-to-git/06-remote-repositories#h2-force-push-safely) shows both with real output.

## How Do I Change the Author of the Last Commit?

For one commit, you do not need a rebase. Amend it with the right identity:

```bash
git commit --amend --no-edit --author="Jane Developer <jane@example.com>"
```

`--amend` also adds everything that is staged. If you have staged changes that do not belong in this commit, add `--only`: then Git changes only the author and leaves the staged changes for the next commit.

If you have fixed `user.name` and `user.email` in your config already, `--reset-author` takes the identity from there. The two flags differ in one detail: `--author` keeps the original author date, while `--reset-author` sets it to now. Here a commit was made on a laptop whose Git config still had a placeholder identity:

```terminal
{
  "title": "fix the author of the last commit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --format=fuller -1",
      "output": "commit fb1e539b7ddbdbde5be18cab0f249994b156dc05\nAuthor:     jane <jane@old-laptop.local>\nAuthorDate: Tue Nov 3 09:15:00 2026 +0000\nCommit:     jane <jane@old-laptop.local>\nCommitDate: Tue Nov 3 09:15:00 2026 +0000\n\n    Add the health check"
    },
    {
      "cmd": "git commit --amend --no-edit --author=\"Jane Developer <jane@example.com>\"",
      "output": "[main 49d7d2c] Add the health check\n Date: Tue Nov 3 09:15:00 2026 +0000\n 1 file changed, 1 insertion(+)\n create mode 100644 a.txt"
    },
    {
      "cmd": "git log --format=fuller -1",
      "output": "commit 49d7d2c877b1418ce444098926d13597f3bd1bf6\nAuthor:     Jane Developer <jane@example.com>\nAuthorDate: Tue Nov 3 09:15:00 2026 +0000\nCommit:     Jane Developer <jane@example.com>\nCommitDate: Thu Nov 5 18:19:47 2026 +0200\n\n    Add the health check"
    },
    {
      "cmd": "git commit --amend --no-edit --reset-author && git log --format=fuller -1 | sed -n 2,5p",
      "output": "[main 29844a4] Add the health check\n 1 file changed, 1 insertion(+)\n create mode 100644 a.txt\nAuthor:     Jane Developer <jane@example.com>\nAuthorDate: Thu Nov 5 18:19:47 2026 +0200\nCommit:     Jane Developer <jane@example.com>\nCommitDate: Thu Nov 5 18:19:47 2026 +0200"
    }
  ]
}
```

You never set the committer: `--amend` always writes a new commit, and the committer of a new commit is whoever runs it, with the current time. That is why both fields are correct after the amend, as long as your config is.

## How Do I Change the Author of Many Commits?

Let a rebase amend each commit for you. Without `-i`, Git does not open the todo list:

```bash
# Every commit after HEAD~20 gets the identity from your current config
git rebase --exec 'git commit --amend --no-edit --reset-author' HEAD~20

# Or set the author explicitly
git rebase --exec 'git commit --amend --no-edit --author="Jane Developer <jane@example.com>"' HEAD~20
```

With two wrong commits on top of a correct one:

```terminal
{
  "title": "rebase --exec over the last two commits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --format=\"%h %an <%ae>\" -3",
      "output": "8f68c04 jane <jane@old-laptop.local>\n306aedf jane <jane@old-laptop.local>\n29844a4 Jane Developer <jane@example.com>"
    },
    {
      "cmd": "git rebase --exec 'git commit --amend --no-edit --reset-author' HEAD~2",
      "output": "Executing: git commit --amend --no-edit --reset-author\n[detached HEAD 5599f3c] Change 1\n 1 file changed, 1 insertion(+)\n create mode 100644 f1\nExecuting: git commit --amend --no-edit --reset-author\n[detached HEAD 2fab4ea] Change 2\n 1 file changed, 1 insertion(+)\n create mode 100644 f2\nSuccessfully rebased and updated refs/heads/main."
    },
    {
      "cmd": "git log --format=\"%h %an <%ae>\" -3",
      "output": "2fab4ea Jane Developer <jane@example.com>\n5599f3c Jane Developer <jane@example.com>\n29844a4 Jane Developer <jane@example.com>"
    }
  ]
}
```

This changes every commit in the range, also the ones that were already right. Some details:

- **All commits of the branch:** use `--root` instead of `HEAD~20`: `git rebase --root --exec 'git commit --amend --no-edit --reset-author'`.
- **Merges:** a plain rebase drops merge commits and puts the commits in a line. Add `--rebase-merges` to keep the merges.
- **Dates:** `--reset-author` sets the author date to now. `--author` keeps the original date. The committer date is always now, because each amend writes a new commit.

### Change only the commits of one wrong email

When a whole repository has commits with an old email mixed with correct ones, rewrite only those with [git filter-repo](https://github.com/newren/git-filter-repo). The Git project recommends it over `git filter-branch`, whose own manual warns about its problems. It is not part of Git, so install it first (for example `pip install git-filter-repo`, or the `git-filter-repo` package of your distribution).

Write a mailmap file. Each line maps an old identity to the correct one:

```text
Jane Developer <jane@example.com> <jane@old-laptop.local>
Jane Developer <jane@example.com> Jane D <jane@old-company.example>
```

Then run it in a fresh clone:

```bash
git clone git@github.com:acme/api.git api-rewrite
cd api-rewrite
git filter-repo --mailmap ../my-mailmap
git log --format='%an <%ae>' | sort -u      # check the result
```

Know three things before you run it:

- **It refuses to run in a repository that is not a fresh clone**, unless you add `--force`. This protects your only copy.
- **It removes the `origin` remote** when it finishes, so that you do not push the rewrite by accident. Add the remote again with `git remote add origin <url>` when you are ready, and run `git fetch origin` before a lease push (see below).
- **It rewrites every branch and tag.** Every commit hash after the first changed commit changes, also signed commits and tags, which lose their signatures.

### Fix only how names show, without a rewrite

If the commits can stay as they are, add a `.mailmap` file to the repository. `git log`, `git shortlog` and `git blame` then show the correct name, and no hash changes:

```bash
echo 'Jane Developer <jane@example.com> <jane@old-laptop.local>' >> .mailmap
git add .mailmap
git commit -m "Map old author emails"
```

In a test, `git log --format='%an <%ae>'` still printed `jane <jane@old-laptop.local>`, and `%aN <%aE>`, which applies the mailmap, printed `Jane Developer <jane@example.com>`. `git shortlog -sne HEAD` counted both commits under the new name. Add `HEAD`: without a revision and without a terminal, `git shortlog` waits for input on stdin.

### Push the rewrite and repair the other clones

Push with a lease, as for a squash. To rewrite more than one branch, push each one, or run `git push --force-with-lease origin --all`. Push the tags with `git push --force origin --tags`: a lease cannot check tags, because Git keeps no remote-tracking copy of them, and in a test it rejected a moved tag with `stale info`.

Ask the team to stop pushing until you are done. After `git filter-repo`, the re-added `origin` has no remote-tracking branches, and a lease push fails with `stale info` (tested). Run `git fetch origin` first. The lease then protects against pushes after that fetch. To catch pushes during the rewrite too, save `git ls-remote origin` before you start, and compare it with the output just before you push.

A teammate without local work runs `git fetch` and `git reset --hard origin/main`. A teammate with local commits moves only those commits onto the new history. `origin/main@{1}` is where `origin/main` pointed before the fetch:

```bash
git fetch origin
git rebase --onto origin/main origin/main@{1}
```

In a test, the teammate's one commit moved onto the rewritten history, and the old commits did not come back.

### Stop it from happening again

Tell Git not to guess an identity. With `user.useConfigOnly`, Git refuses to commit until `user.email` is set, instead of making one up from your user and host name:

```bash
git config --global user.useConfigOnly true
```

If you use one machine for work and personal projects, let the directory pick the identity with a conditional include in `~/.gitconfig`:

```ini
[user]
    name = Jane Developer
    email = jane@personal.example
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work
```

`~/.gitconfig-work` holds only `[user] email = jane@company.example`. The trailing slash in `gitdir:~/work/` matters: it matches every repository below `~/work`:

```text
$ cd ~/work/api && git config user.email
jane@company.example
$ cd ~/oss/tool && git config user.email
jane@personal.example
```

`git config --show-origin user.email` also prints the file that set the value. The same include can also [choose the SSH key](/posts/specify-private-ssh-key-for-git-commands#h3-use-a-key-for-all-repositories-in-a-folder) for work repositories.

## Related Resources

- [Introduction to Git: History, Reflog and Interactive Rebase](/guides/introduction-to-git/08-history)
- [How to undo a git rebase](/posts/undo-git-rebase)
- [Delete or undo a commit: reset, rebase or revert](/posts/delete-commit-from-branch)
- [Git concepts simulator](/games/git-concepts-simulator): watch a rebase move commits
- [Git rebase vs merge interview question](/interview-questions/topic/git#git-rebase-vs-merge)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
