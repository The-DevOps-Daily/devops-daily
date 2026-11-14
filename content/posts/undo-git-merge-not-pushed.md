---
title: 'Undo or Abort a Git Merge, and Resolve Merge Conflicts'
excerpt: 'Undo a merge with git reset --merge ORIG_HEAD, stop one with git merge --abort, resolve conflicts, and fix "refusing to merge unrelated histories".'
category:
  name: 'Git'
  slug: 'git'
date: '2025-01-15'
publishedAt: '2025-01-15T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Merge
  - Merge Conflicts
  - Reset
  - Revert
  - Version Control
---

A merge can go wrong in three ways. You merge the wrong branch, Git stops with conflicts that you do not want to resolve now, or Git refuses to merge at all. Each case has a short answer, and the right one depends on two things: did the merge finish, and did you push it? This page answers each question in turn: undo a merge, abort a merge, resolve the conflicts, and fix "refusing to merge unrelated histories".

## TLDR

| Question                                | Short answer                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Undo a merge that is not pushed         | `git reset --merge ORIG_HEAD` right after the merge, or `git reset --merge HEAD~1` if the merge commit is the newest commit |
| Undo a merge that is already pushed     | `git revert -m 1 <merge-commit>`, then push the new commit                                                                  |
| Stop a merge that has conflicts         | `git merge --abort`                                                                                                         |
| Resolve a conflict                      | Edit the file, remove the markers, `git add <file>`, then `git commit`                                                      |
| Take one side for a whole file          | `git restore --ours <file>` or `git restore --theirs <file>`. The two swap during a rebase                                  |
| "refusing to merge unrelated histories" | Check the remote URL first. Then add `--allow-unrelated-histories` to the merge, or rebase                                  |

## Prerequisites

- Git 2.23 or later for `git restore` and `git merge --quit`. The output on this page comes from Git 2.39. The [Introduction to Git guide](/guides/introduction-to-git) uses Git 2.56, and the commands are the same.
- A repository where you can practice. To try the commands without risk, make a copy of the repository first, or use the [Git merge conflict simulator](/games/git-merge-conflict-simulator) in your browser.

## How Do I Undo a Git Merge That Has Not Been Pushed?

Run `git reset --merge ORIG_HEAD` right after the merge. A merge sets `ORIG_HEAD` to the commit your branch pointed at before the merge, so this command moves the branch back there:

```bash
git merge feat
git reset --merge ORIG_HEAD
```

A merge that made a merge commit looks like this before and after the reset:

```text
Before the reset:              After the reset:

      F1---F2 feat                   F1---F2 feat
     /       \                      /
A---B---------M main           A---B main
```

Use `--merge`, not `--hard`. Both move the branch back and remove the merged changes. The difference is your uncommitted work. `--merge` keeps unstaged changes in files that the merge did not touch. `--hard` deletes them. Neither keeps changes that you staged after the merge, so commit or stash those first. In this test, `notes.txt` had an unstaged edit when the merge was undone:

```terminal
{
  "title": "undo a merge, keep uncommitted work",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "git merge --no-edit feat", "output": "Merge made by the 'ort' strategy.\n f.txt | 2 ++\n 1 file changed, 2 insertions(+)" },
    { "cmd": "echo dirty >> notes.txt" },
    { "cmd": "git reset --merge ORIG_HEAD && git status --short", "output": " M notes.txt" },
    { "comment": "the same steps with git reset --hard HEAD~1 also delete the edit in notes.txt" }
  ]
}
```

If Git did a fast-forward merge, there is no merge commit. `ORIG_HEAD` still points at the old tip, so the same command works.

### What if I ran other commands after the merge?

`ORIG_HEAD` changes each time you run `reset`, `rebase`, `pull` or another merge. Find the old position in the reflog instead:

```bash
git reflog -5
```

```text
b88d01b HEAD@{0}: merge feat: Merge made by the 'ort' strategy.
614c03d HEAD@{1}: commit: B
```

The line below the merge is your branch before the merge. Reset to it with `git reset --merge HEAD@{1}`, or with its hash. If the merge commit is the newest commit on the branch, `git reset --merge HEAD~1` also works: `HEAD~1` follows the first parent of the merge, which is your branch before the merge.

### How do I remove a merge but keep the commits I made after it?

Replay the later commits onto the first parent of the merge. Here `M` is the hash of the merge commit, and `C` and `D` came after it:

```bash
git log --oneline --graph -6     # find the hash of the merge commit
git rebase --onto M^1 M          # replay the commits after M onto the parent before M
```

```text
Before:  A---B---M---C---D main        After:  A---B---C'---D' main
              \ /
               F1
```

Do not use `git rebase -i` for this. The todo list of an interactive rebase does not show merge commits. It shows the commits of the merged branch instead, and if you save the list without changes, Git copies those commits into a straight line. The merge is gone, but its changes are still there.

### How do I keep the changes but drop the merge commit?

Run `git reset --soft HEAD~1`. The branch moves back, and the merged result stays staged. Your next `git commit` records it as one normal commit with one parent. If you want this result from the start, use `git merge --squash feat` and then `git commit`. The [Git merge guide](/guides/introduction-to-git/05-merging#h2-squash-merge-one-commit-for-the-whole-branch) compares the merge types.

## How Do I Undo a Merge That Is Already Pushed?

Do not reset a branch that other people have pulled. Make a new commit that reverses the merge, and push it:

```bash
git log --oneline --merges -5      # find the merge commit
git revert -m 1 9f3c2ab            # 9f3c2ab is the merge commit
git push origin main
```

A merge commit has two parents, so Git needs to know which side to keep. `-m 1` keeps the first parent, which is the branch you merged into. The revert removes the changes that came from the other branch.

:::warning
After you revert a merge, Git still considers the commits of that branch as merged. If you fix the branch and merge it again, Git does not bring back the changes that the revert removed. Revert the revert first (`git revert <hash-of-the-revert-commit>`), then merge the new fixes. The Git project describes this case in [How to revert a faulty merge](https://github.com/git/git/blob/master/Documentation/howto/revert-a-faulty-merge.adoc).
:::

The [history chapter of the Git guide](/guides/introduction-to-git/08-history#h2-undo-commits-reset-revert-and-the-reflog) compares `revert` and `reset` with real output.

## How Do I Abort a Merge With Conflicts?

Run `git merge --abort`. Git stops the merge, removes the conflict markers and returns your branch and files to the state before `git merge`. Any conflicts that you already resolved are lost too:

```bash
git merge feature
# CONFLICT (content): Merge conflict in src/app.js
# Automatic merge failed; fix conflicts and then commit the result.

git merge --abort
git status
# On branch main
# nothing to commit, working tree clean
```

`git merge --abort` works only while a merge is in progress. If the merge already finished, undo it with the reset from the first section. Without a merge in progress, Git prints:

```text
fatal: There is no merge to abort (MERGE_HEAD missing).
```

Some details to know:

- **Commit or stash before you merge.** Git refuses to start a merge that would overwrite uncommitted changes. If other files had uncommitted changes, `git merge --abort` tries to keep them, but the [git merge documentation](https://git-scm.com/docs/git-merge) warns that it cannot always rebuild them.
- **A conflicted `git pull` is a merge or a rebase.** After `git pull` stops with conflicts, run `git merge --abort`. If your pull rebases (`pull.rebase true` or `git pull --rebase`), run `git rebase --abort`.
- **Each operation has its own abort.** Use `git rebase --abort`, `git cherry-pick --abort` and `git revert --abort` for those operations.
- **Leave the files as they are.** `git merge --quit` forgets that a merge is in progress but does not change your files. The conflict markers stay, and `git status` still shows the files as unmerged. It is for the rare case where you want to keep the half-merged files.

To check for a merge in progress in a script, test for `MERGE_HEAD`. This also works in worktrees, where `.git` is a file and not a directory:

```bash
if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  echo "A merge is in progress"
fi
```

To see the result of a merge before you commit to it, merge without a commit, look, then abort or commit:

```bash
git merge --no-commit --no-ff feature
git diff --staged      # the changes the merge would bring
git merge --abort      # or: git commit
```

## How Do I Resolve Merge Conflicts in Git?

Open each conflicted file, edit it to the content you want, remove the conflict markers, and stage it. When all files are staged, commit:

```bash
git status                 # lists the files under "Unmerged paths"
# edit src/config.js
git add src/config.js
git commit                 # or: git merge --continue
```

A conflict happens when both branches changed the same lines, or when one branch changed a file that the other deleted. Git marks the lines in the file:

```javascript
const config = {
<<<<<<< HEAD
  apiUrl: 'https://api.example.com',
  timeout: 5000,
=======
  apiUrl: 'https://api.example.com',
  timeout: 3000,
  retries: 3,
>>>>>>> feature
};
```

The part between `<<<<<<< HEAD` and `=======` is your current branch. The part between `=======` and `>>>>>>> feature` is the branch you merge. The resolved file can be one side, the other side, or a combination. Here the team keeps the timeout of `main` and the new `retries` setting:

```javascript
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
};
```

### See the original lines too

With the default markers, you see the two new versions but not the line they both changed. Set the `zdiff3` conflict style (Git 2.35 and later), and Git adds the common ancestor after `|||||||`:

```bash
git config --global merge.conflictStyle zdiff3
```

```text
<<<<<<< HEAD
MAIN
||||||| dc9acde
base
=======
FEAT
>>>>>>> feat
```

Now you can see that the original line was `base`, and that both branches changed it.

### Take one side for a whole file

To keep one version of a file and drop the other, restore that side and stage it:

```bash
git restore --ours -- src/config.js     # the version of your current branch
git restore --theirs -- src/config.js   # the version of the branch you merge
git add src/config.js
```

`git checkout --ours -- <file>` does the same in older Git versions. Use these only when you are sure that the other side has nothing you need. The changes on the other side are lost for that file.

:::warning
During a rebase, `ours` and `theirs` swap. A rebase replays your commits on top of the other branch, so "ours" is the branch you rebase onto, and "theirs" is your own commit. In a test, `git restore --ours` during `git rebase main` gave the version of `main`, not the version of the feature branch.
:::

### Check for leftover markers before you commit

Git does not stop you from committing a file that still has conflict markers. `git diff --check` finds them:

```bash
git diff --cached --check
# src/config.js:1: leftover conflict marker
```

Then run your tests. Two changes can merge without a conflict and still break the build together.

### Use a merge tool

`git mergetool` opens each conflicted file in a merge tool. `git mergetool --tool-help` lists the tools that Git knows on your system, such as `meld`, `kdiff3` and `vimdiff`. To use VS Code, define it as a custom tool, as the VS Code documentation shows:

```bash
git config --global merge.tool code
git config --global mergetool.code.cmd 'code --wait --merge "$REMOTE" "$LOCAL" "$BASE" "$MERGED"'
```

### See how a past conflict was resolved

`git show --remerge-diff <merge>` (Git 2.36 and later) shows the difference between the automatic merge result, with its conflict markers, and the commit that someone made:

```bash
git show --remerge-diff HEAD
```

```diff
@@ -1,5 +1 @@
-<<<<<<< 6ed13fc (main)
-MAIN
-=======
-FEAT
->>>>>>> 3841f85 (feat)
+MAIN and FEAT
```

If you resolve the same conflict again and again, for example on a long rebase, turn on [`rerere`](/guides/introduction-to-git/10-advanced-techniques#h2-reuse-conflict-resolutions-with-rerere). Git then records each resolution and applies it the next time.

### Make conflicts smaller

- Keep branches short, and merge `main` into them (or rebase them on `main`) often.
- Do large refactors on their own branch, and merge them fast.
- Make small commits. A small change conflicts less, and its conflict is easier to read.

To practice, the [Git merge conflict simulator](/games/git-merge-conflict-simulator) gives you conflicts to resolve, with the three index stages, `--ours` and `--theirs`, and a rebase. The [merge chapter of the Git guide](/guides/introduction-to-git/05-merging#h2-resolve-a-merge-conflict) resolves a conflict step by step.

## How Do I Fix "refusing to merge unrelated histories"?

Git says this when the two branches have no commit in common. First check that you pull from the right repository. If you do, allow the merge once, or rebase your commits on top:

```bash
git remote -v                # is this the repository you mean?
git fetch origin
git merge --allow-unrelated-histories origin/main
# or: git pull --no-rebase --allow-unrelated-histories origin main
```

The usual cause is a new project. You run `git init` and commit locally, and you also create the repository on GitHub or GitLab with a README. Each side now has its own first commit, and neither is an ancestor of the other. `git merge-base` finds no common commit:

```bash
git merge-base HEAD origin/main
echo $?     # 1: no common commit
```

On Git 2.39 with no `pull.rebase` setting, a plain `git pull origin main` stops even earlier, with `fatal: Need to specify how to reconcile divergent branches`. Add `--no-rebase` to see the real error, or `--rebase` to rebase.

When both sides have a README, the merge stops with an add/add conflict. Resolve it like any other conflict:

```text
Auto-merging README.md
CONFLICT (add/add): Merge conflict in README.md
Automatic merge failed; fix conflicts and then commit the result.
```

### Rebase instead of a merge

To put your local commits on top of the remote history without a merge commit, rebase. `git rebase` has no `--allow-unrelated-histories` option, and it does not need one. It copies your commits onto the other branch:

```bash
git fetch origin
git rebase origin/main      # resolve any add/add conflict, then: git rebase --continue
git push -u origin main
```

### When not to allow it

Stop and check if you are not sure why the histories differ:

- **Wrong remote URL.** `git remote -v` shows another project. Fix it with `git remote set-url origin <url>` ([more on remote URLs](/posts/specify-private-ssh-key-for-git-commands#h2-how-do-i-change-the-url-of-a-git-remote)).
- **You want the remote and not your local work.** Clone the repository again, or fetch and reset: `git fetch origin` then `git reset --hard origin/main`. This discards your local commits.
- **You want your local history and not the remote one.** If the remote holds only the generated README, overwrite it with `git push --force-with-lease origin main`. Never do this on a repository that other people use.

To avoid the problem, create the remote repository empty (no README, license or `.gitignore`), or clone it first and add your files to the clone.

### Combine two projects into one repository

To bring another project into a subdirectory and keep its history, use `git subtree`. It ships with most Git packages:

```bash
git subtree add --prefix=billing https://github.com/acme/billing.git main
```

This adds the other project under `billing/` with one merge commit. Compare subtrees and submodules in the [advanced Git guide](/guides/introduction-to-git/10-advanced-techniques#h2-submodules-and-subtrees).

## Related Resources

- [Git merge conflict simulator](/games/git-merge-conflict-simulator) and [Git concepts simulator](/games/git-concepts-simulator)
- [Introduction to Git: Merge and Rebase](/guides/introduction-to-git/05-merging)
- [How to undo a git rebase](/posts/undo-git-rebase)
- [Delete or undo a commit: reset, rebase or revert](/posts/delete-commit-from-branch)
- [Git rebase vs merge interview question](/interview-questions/topic/git#git-rebase-vs-merge)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz) and [Git Fundamentals flashcards](/flashcards/git-fundamentals)
