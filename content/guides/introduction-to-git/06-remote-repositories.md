---
title: 'Git Remotes: Push, Fetch, Pull and Tracking Branches'
description: 'Connect a Git repository to a remote, push and pull, fix rejected pushes, set a pull strategy, track branches, force-push safely and set up SSH keys.'
order: 6
---

So far the project lives in one folder on one computer. A **remote** is another copy of the repository that you exchange commits with, usually on GitHub, GitLab, Bitbucket or a server of your own. This part connects the project to a remote, adds a second developer, Sam, and goes through what happens when you both push: rejected pushes, `git fetch` versus `git pull`, tracking branches, force pushes that do not destroy other people's work, and cleaning up branches. At the end you set up SSH keys and HTTPS logins for a real hosting service.

## Prerequisites

- The `status-page` repository from [Part 5](/guides/introduction-to-git/05-merging), with two tags.
- Merging and rebasing ([Part 5](/guides/introduction-to-git/05-merging)), because pulling is fetching plus one of them.

## How Remotes Work

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Your branches", "sub": "main, feature/x", "icon": "branch", "tone": "blue" },
    { "label": "Remote-tracking branches", "sub": "origin/main: the last state you saw", "icon": "activity", "tone": "slate" },
    { "label": "The remote", "sub": "origin on GitHub, GitLab or a server", "icon": "cloud", "tone": "violet" }
  ]
}
```

- `git push` sends your commits to the remote and moves the branch there.
- `git fetch` downloads new commits from the remote and updates your **remote-tracking branches** (`origin/main`). It never changes your own branches or files.
- `git pull` is `git fetch` followed by a merge or rebase of the remote-tracking branch into your current branch.

`origin/main` is your local, read-only record of where `main` was on `origin` the last time you talked to it. It only moves when you fetch, pull or push. That is why `git status` can say "up to date" while a teammate pushed a minute ago.

## Set Up a Remote

A remote repository is a **bare** repository: only the `.git` contents, with no working tree, because nobody edits files on the server. On GitHub or GitLab you create one in the web interface (or with `gh repo create`) and get its URL. In this guide, a bare repository in `~/server` plays the server, so everything runs on one machine:

```terminal
{
  "title": "a bare repository as the server",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git init --bare ~/server/status-page.git",
      "output": "Initialized empty Git repository in /home/dev/server/status-page.git/"
    },
    {
      "cmd": "ls ~/server/status-page.git",
      "output": "HEAD\nconfig\ndescription\nhooks\ninfo\nobjects\nrefs"
    },
    {
      "cmd": "cd ~/projects/status-page && git remote add origin ~/server/status-page.git"
    },
    {
      "cmd": "git remote -v",
      "output": "origin\t/home/dev/server/status-page.git (fetch)\norigin\t/home/dev/server/status-page.git (push)"
    }
  ]
}
```

On a hosting service, only the URL changes:

```tabs
{
  "title": "Add a remote on a hosting service",
  "tabs": [
    {
      "label": "GitHub (SSH)",
      "lang": "bash",
      "code": "# create an empty repository in the web interface first (no README, no .gitignore)\ngit remote add origin git@github.com:OWNER/status-page.git"
    },
    {
      "label": "GitHub CLI",
      "lang": "bash",
      "code": "# creates the repository on GitHub, adds it as origin and pushes the current branch\ngh repo create status-page --private --source=. --remote=origin --push"
    },
    {
      "label": "GitLab (SSH)",
      "lang": "bash",
      "code": "git remote add origin git@gitlab.com:GROUP/status-page.git"
    },
    {
      "label": "HTTPS (any host)",
      "lang": "bash",
      "code": "git remote add origin https://github.com/OWNER/status-page.git"
    }
  ]
}
```

If you created the repository on the platform with a README, it has a commit your local repository does not have, and your first push is rejected. Create it empty, or fetch and merge that commit first ([unrelated histories](/posts/git-refusing-merge-unrelated-histories)).

## Push

```terminal
{
  "title": "the first push",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git push -u origin main",
      "output": "To /home/dev/server/status-page.git\n * [new branch]      main -> main\nbranch 'main' set up to track 'origin/main'."
    },
    {
      "cmd": "git status",
      "output": "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean"
    },
    {
      "cmd": "git branch -vv",
      "output": "* main 3fe83c6 [origin/main] Add the search, auth and cdn services"
    }
  ]
}
```

`git push origin main` sends `main` to `origin`. `-u` (`--set-upstream`) also records `origin/main` as the **upstream** of your local `main`, so from now on a plain `git push` or `git pull` on `main` knows where to go, and `git status` compares your branch with it. You need `-u` once per branch.

The remote name and the branch name are two separate arguments. Git 2.56 recognizes the common slip of writing them as one:

```terminal
{
  "title": "a typo Git now explains",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git push origin/main",
      "output": "fatal: 'origin/main' is not a valid push target\nhint: Did you mean to use: git push origin main?\nhint: Disable this message with \"git config set advice.pushRepoLooksLikeRef false\""
    }
  ]
}
```

## Push Tags

`git push` does not send tags unless you ask:

```terminal
{
  "title": "push tags",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git push origin --tags",
      "output": "To /home/dev/server/status-page.git\n * [new tag]         v0.1.0 -> v0.1.0\n * [new tag]         v0.2.0 -> v0.2.0"
    }
  ]
}
```

`git push origin v0.2.0` pushes one tag. `git push --follow-tags` pushes the annotated tags that point at the commits you are pushing, and `git config --global push.followTags true` makes that the default. [How to push a tag](/posts/push-git-tag-to-remote) and [how to delete a remote tag](/posts/how-can-i-delete-a-remote-tag) have the details.

## A Teammate Clones and Pushes

Sam clones the repository, sets the identity for this clone, adds a service and pushes:

```terminal
{
  "title": "Sam's clone",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git clone ~/server/status-page.git ~/sam/status-page",
      "output": "Cloning into '/home/dev/sam/status-page'...\ndone."
    },
    {
      "cmd": "cd ~/sam/status-page && git config user.name \"Sam\" && git config user.email \"sam@example.com\""
    },
    {
      "cmd": "echo \"billing https://billing.example.com/\" >> services.txt && git commit -q -am \"Add the billing service\" && git push",
      "output": "To /home/dev/server/status-page.git\n   3fe83c6..2a24e58  main -> main"
    }
  ]
}
```

(Sam's name and email are set in this repository's `.git/config` because both clones share one home directory in this guide. On Sam's own computer, they would be global settings.)

## When Your Push Is Rejected

Meanwhile, you commit a change of your own without knowing about Sam's push:

```terminal
{
  "title": "rejected: the remote has work you do not have",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && echo \"li { margin: 0.25rem 0; }\" >> style.css && git commit -q -am \"Add space between list items\""
    },
    {
      "cmd": "git push",
      "output": "To /home/dev/server/status-page.git\n ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs to '/home/dev/server/status-page.git'\nhint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details."
    }
  ]
}
```

The remote's `main` has a commit (Sam's) that is not in your `main`. If Git accepted your push, Sam's commit would be lost, so the push is refused. This is not an error to work around; it means "integrate first". Fetch, and look at the situation before doing anything:

```terminal
{
  "title": "fetch, then look",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git fetch",
      "output": "From /home/dev/server/status-page\n   3fe83c6..2a24e58  main       -> origin/main"
    },
    {
      "cmd": "git status",
      "output": "On branch main\nYour branch and 'origin/main' have diverged,\nand have 1 and 1 different commits each, respectively.\n  (use \"git pull\" if you want to integrate the remote branch with yours)\n\nnothing to commit, working tree clean"
    },
    {
      "cmd": "git log --oneline --graph main origin/main -3",
      "output": "* 96f7e80 Add space between list items\n| * 2a24e58 Add the billing service\n|/\n* 3fe83c6 Add the search, auth and cdn services"
    }
  ]
}
```

The branches have **diverged**: one commit on each side since the shared one. A pull has to either merge them or rebase your commit on top of Sam's, and Git does not pick for you:

```terminal
{
  "title": "git pull needs to know how",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git pull",
      "output": "hint: You have divergent branches and need to specify how to reconcile them.\nhint: You can do so by running one of the following commands sometime before\nhint: your next pull:\nhint:\nhint:   git config pull.rebase false  # merge\nhint:   git config pull.rebase true   # rebase\nhint:   git config pull.ff only       # fast-forward only\nhint:\nhint: You can replace \"git config\" with \"git config --global\" to set a default\nhint: preference for all repositories. You can also pass --rebase, --no-rebase,\nhint: or --ff-only on the command line to override the configured default per\nhint: invocation.\nfatal: Need to specify how to reconcile divergent branches."
    }
  ]
}
```

Your commit is local and unpublished, so rebasing it is safe and gives a straight history:

```terminal
{
  "title": "pull with rebase, then push",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git pull --rebase",
      "output": "Successfully rebased and updated refs/heads/main."
    },
    {
      "cmd": "git log --oneline --graph -3",
      "output": "* ceae592 Add space between list items\n* 2a24e58 Add the billing service\n* 3fe83c6 Add the search, auth and cdn services"
    },
    {
      "cmd": "git push",
      "output": "To /home/dev/server/status-page.git\n   2a24e58..ceae592  main -> main"
    }
  ]
}
```

## Pull: Merge or Rebase?

Set your preference once, globally, and override it per command when needed:

| Setting                                 | `git pull` does                                                               | Override for one pull   |
| --------------------------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| `git config --global pull.rebase true`  | Rebases your local commits onto the remote branch                             | `--no-rebase`           |
| `git config --global pull.rebase false` | Merges, creating a merge commit when the branches diverged                    | `--rebase`              |
| `git config --global pull.ff only`      | Only fast-forwards; refuses when your branch and the remote one have diverged | `--rebase` or `--no-ff` |

`pull.rebase true` is a good default for day-to-day work: your unpublished commits move on top of what others pushed, and the history stays linear. Add `rebase.autoStash true` so a pull also works with uncommitted changes (Git stashes and re-applies them). `pull.ff only` is the strictest choice: nothing happens without your decision. Whatever you pick, the rules from [Part 5](/guides/introduction-to-git/05-merging#h2-merge-or-rebase) apply: never rebase commits that others have already pulled. [The difference between git pull and git fetch](/posts/difference-between-git-pull-and-git-fetch) goes deeper.

This guide uses `pull.rebase true` and `rebase.autoStash true` from here on:

```terminal
{
  "title": "choose a pull strategy once",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config --global pull.rebase true && git config --global rebase.autoStash true"
    }
  ]
}
```

## Tracking Branches

A feature branch that you push has to get an upstream too. Without one, `git push` does not know where to send it. Start a runbook for the page in `docs/runbook.md`:

```markdown
# Runbook: status page

## The page shows an old list

1. Run `scripts/build.sh` and check its output.
2. Deploy the new `build/` folder.
```

```terminal
{
  "title": "a new branch has no upstream yet",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -c docs/runbook && git add docs/runbook.md && git commit -q -m \"Add a runbook for the status page\"",
      "output": "Switched to a new branch 'docs/runbook'"
    },
    {
      "cmd": "git push",
      "output": "fatal: The current branch docs/runbook has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin docs/runbook\n\nTo have this happen automatically for branches without a tracking\nupstream, see 'push.autoSetupRemote' in 'git help config'."
    },
    {
      "cmd": "git push -u origin docs/runbook",
      "output": "To /home/dev/server/status-page.git\n * [new branch]      docs/runbook -> docs/runbook\nbranch 'docs/runbook' set up to track 'origin/docs/runbook'."
    }
  ]
}
```

GitHub and GitLab also print a link to open a pull request for the new branch at this point. To skip the `-u` dance for new branches, let Git set the upstream on the first push, as the hint says:

```bash
git config --global push.autoSetupRemote true
```

Sam fetches and starts working on the same branch. `git switch` with the name of a branch that exists only on the remote creates a local branch that tracks it:

```terminal
{
  "title": "Sam picks up the branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/sam/status-page && git fetch",
      "output": "From /home/dev/server/status-page\n   2a24e58..ceae592  main         -> origin/main\n * [new branch]      docs/runbook -> origin/docs/runbook"
    },
    {
      "cmd": "git switch docs/runbook",
      "output": "Switched to a new branch 'docs/runbook'\nbranch 'docs/runbook' set up to track 'origin/docs/runbook'."
    },
    {
      "comment": "Sam adds a section at the end of the runbook",
      "cmd": "printf '\\n## Roll back a bad build\\n\\n1. Find the last good commit with `git log --oneline`.\\n2. Run `git revert <commit>` for the bad one, then build and deploy again.\\n' >> docs/runbook.md"
    },
    {
      "cmd": "git commit -q -am \"Runbook: how to roll back a bad build\" && git push",
      "output": "To /home/dev/server/status-page.git\n   30ce073..3c14138  docs/runbook -> docs/runbook"
    },
    {
      "cmd": "git branch -vv",
      "output": "* docs/runbook 3c14138 [origin/docs/runbook] Runbook: how to roll back a bad build\n  main         2a24e58 [origin/main: behind 1] Add the billing service"
    }
  ]
}
```

`git branch -vv` shows each branch's upstream in brackets, plus `ahead N` and `behind N` counts when they differ (as of the last fetch). [Fetch a remote branch and check it out](/posts/git-fetch-remote-branch), [check out a remote branch](/posts/how-to-checkout-remote-git-branch) and [make an existing branch track a remote branch](/posts/make-git-branch-track-remote) cover the variations, such as `git branch -u origin/main` to set an upstream later.

## Force Push Safely

You, on your copy of `docs/runbook`, add a line about who is on call below the title, and push:

```markdown
# Runbook: status page

On call: the person listed in the team calendar.
```

Sam's commit is on the remote branch, so the push is rejected, the same way as on `main`:

```terminal
{
  "title": "a rejected push on a feature branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git commit -q -am \"Runbook: say who is on call\" && git push",
      "output": "To /home/dev/server/status-page.git\n ! [rejected]        docs/runbook -> docs/runbook (fetch first)\nerror: failed to push some refs to '/home/dev/server/status-page.git'\nhint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details."
    }
  ]
}
```

It is tempting to "fix" this with `git push --force`. That would replace the remote branch with yours and delete Sam's commit from it. A **force push** is sometimes right, for example after you rebased your own branch, but it should only overwrite what you expect. `--force-with-lease` does that check: it only overwrites the remote branch if it still points where your `origin/docs/runbook` says it does:

```terminal
{
  "title": "--force-with-lease refuses",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git push --force-with-lease",
      "output": "To /home/dev/server/status-page.git\n ! [rejected]        docs/runbook -> docs/runbook (stale info)\nerror: failed to push some refs to '/home/dev/server/status-page.git'"
    }
  ]
}
```

"stale info": the remote branch moved since your last fetch, so the lease does not match. Now the trap: many editors fetch in the background. After a fetch, your `origin/docs/runbook` includes Sam's commit, the lease matches, and `--force-with-lease` alone would delete it. `--force-if-includes` adds a second check: the remote commit you are about to overwrite must be one your branch has actually included at some point:

```terminal
{
  "title": "after a background fetch, --force-if-includes still protects",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git fetch",
      "output": "From /home/dev/server/status-page\n   30ce073..3c14138  docs/runbook -> origin/docs/runbook"
    },
    {
      "cmd": "git push --force-with-lease --force-if-includes",
      "output": "To /home/dev/server/status-page.git\n ! [rejected]        docs/runbook -> docs/runbook (remote ref updated since checkout)\nerror: failed to push some refs to '/home/dev/server/status-page.git'\nhint: Updates were rejected because the tip of the remote-tracking branch has\nhint: been updated since the last checkout. If you want to integrate the\nhint: remote changes, use 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details."
    }
  ]
}
```

The right move here is to integrate Sam's commit, not to force:

```terminal
{
  "title": "integrate, then a normal push",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git pull",
      "output": "Successfully rebased and updated refs/heads/docs/runbook."
    },
    {
      "cmd": "git log --oneline -3 && git push",
      "output": "327dc74 Runbook: say who is on call\n3c14138 Runbook: how to roll back a bad build\n30ce073 Add a runbook for the status page\nTo /home/dev/server/status-page.git\n   3c14138..327dc74  docs/runbook -> docs/runbook"
    }
  ]
}
```

When you do need to force-push (after rebasing your own pull request branch onto `main`, for example), use `git push --force-with-lease --force-if-includes`, or make it an alias. Never force-push to `main` or other shared branches; most teams block it there with branch protection ([Part 7](/guides/introduction-to-git/07-collaboration#h2-set-up-the-repository-for-a-team)).

## Delete Remote Branches

The runbook is finished. You merge it into `main` (on a hosting service, this is the pull request's merge button) and delete the branch on the remote:

```terminal
{
  "title": "merge, then delete the branch everywhere",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch main && git pull && git merge --no-ff --no-edit docs/runbook && git push",
      "output": "Switched to branch 'main'\nYour branch is up to date with 'origin/main'.\nAlready up to date.\nMerge made by the 'ort' strategy.\n docs/runbook.md | 13 +++++++++++++\n 1 file changed, 13 insertions(+)\n create mode 100644 docs/runbook.md\nTo /home/dev/server/status-page.git\n   ceae592..7c58821  main -> main"
    },
    {
      "cmd": "git push origin --delete docs/runbook",
      "output": "To /home/dev/server/status-page.git\n - [deleted]         docs/runbook"
    },
    {
      "cmd": "git branch -d docs/runbook",
      "output": "Deleted branch docs/runbook (was 327dc74)."
    }
  ]
}
```

Sam still has `origin/docs/runbook` and a local `docs/runbook`. A normal fetch does not remove remote-tracking branches that are gone on the remote; `--prune` does:

```terminal
{
  "title": "prune deleted branches",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/sam/status-page && git fetch --prune",
      "output": "From /home/dev/server/status-page\n - [deleted]         (none)     -> origin/docs/runbook\n   ceae592..7c58821  main       -> origin/main"
    },
    {
      "cmd": "git branch -vv",
      "output": "* docs/runbook 3c14138 [origin/docs/runbook: gone] Runbook: how to roll back a bad build\n  main         2a24e58 [origin/main: behind 5] Add the billing service"
    },
    {
      "cmd": "git switch main && git pull && git branch -d docs/runbook",
      "output": "Switched to branch 'main'\nYour branch is behind 'origin/main' by 5 commits, and can be fast-forwarded.\n  (use \"git pull\" to update your local branch)\nUpdating 2a24e58..7c58821\nFast-forward\n docs/runbook.md | 13 +++++++++++++\n style.css       |  1 +\n 2 files changed, 14 insertions(+)\n create mode 100644 docs/runbook.md\nDeleted branch docs/runbook (was 3c14138)."
    }
  ]
}
```

`[origin/docs/runbook: gone]` marks a branch whose upstream was deleted, usually because its pull request was merged. Set `git config --global fetch.prune true` to prune on every fetch. [Delete a branch locally and remotely](/posts/how-to-delete-git-branch-locally-and-remotely) has more examples. (Git 2.56 also added `git branch --delete-merged <upstream>`, which deletes local branches whose upstream is, for example, `origin/main` and whose work is already in it. It is meant for setups where topic branches track the main branch; with the usual one-upstream-per-branch setup above, look for `: gone]` instead.)

## Inspect and Change Remotes

```terminal
{
  "title": "git remote show",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git remote show origin",
      "output": "* remote origin\n  Fetch URL: /home/dev/server/status-page.git\n  Push  URL: /home/dev/server/status-page.git\n  HEAD branch: main\n  Remote branch:\n    main tracked\n  Local branch configured for 'git pull':\n    main merges with remote main\n  Local ref configured for 'git push':\n    main pushes to main (up to date)"
    }
  ]
}
```

| Command                               | Does                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `git remote -v`                       | List remotes with their URLs                                                                                 |
| `git remote add <name> <url>`         | Add another remote, for example `upstream` for a fork                                                        |
| `git remote set-url origin <new-url>` | Change a URL, for example from HTTPS to SSH ([more](/posts/how-to-change-uri-url-for-remote-git-repository)) |
| `git remote rename <old> <new>`       | Rename a remote and its remote-tracking branches                                                             |
| `git remote remove <name>`            | Remove a remote and its remote-tracking branches                                                             |
| `git ls-remote origin`                | List the branches and tags on the remote without fetching                                                    |

## A Read-Only Server with git daemon

For sharing a repository on a trusted local network, Git includes a small server for the `git://` protocol. It has no authentication and no encryption, so it is read-only by default and not something to expose to the internet. (`--detach` does not work in Git for Windows: there, run the same `git daemon` command without `--detach` and `--pid-file` in a second terminal, run the clone and push below in the first, then stop the daemon with Ctrl+C and skip the `kill` step.)

```terminal
{
  "title": "serve and clone over git://",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git daemon --detach --pid-file=/tmp/git-daemon.pid --base-path=\"$HOME/server\" --export-all --reuseaddr --listen=127.0.0.1"
    },
    {
      "cmd": "git clone git://127.0.0.1/status-page.git /tmp/status-page-ro && cd /tmp/status-page-ro && git log --oneline -1",
      "output": "Cloning into '/tmp/status-page-ro'...\n7c58821 Merge branch 'docs/runbook'"
    },
    {
      "cmd": "git push origin HEAD:refs/heads/try",
      "output": "fatal: remote error: access denied or repository not exported: /status-page.git"
    },
    {
      "cmd": "kill \"$(cat /tmp/git-daemon.pid)\""
    },
    {
      "cmd": "cd ~/projects/status-page && rm -rf /tmp/status-page-ro"
    }
  ]
}
```

The push fails because `git daemon` only serves fetches unless you start it with `--enable=receive-pack`; the error message does not say so. `--base-path` maps `git://host/status-page.git` to `~/server/status-page.git`, and `--export-all` serves every repository under it (without it, a repository is served only if it contains a file called `git-daemon-export-ok`). For anything beyond a LAN, use SSH or HTTPS.

## Authenticate to GitHub, GitLab and Others

Hosting services accept two kinds of Git URLs, and each needs its own setup once per computer.

### HTTPS with a credential helper

GitHub stopped accepting account passwords for Git over HTTPS in 2021, and GitLab and Bitbucket also expect a token instead of your password. A **credential helper** handles the login (usually through the browser) and stores the token safely, so you never type it:

```tabs
{
  "title": "Set up HTTPS logins",
  "tabs": [
    {
      "label": "GitHub CLI (any OS)",
      "lang": "bash",
      "code": "gh auth login          # choose GitHub.com, HTTPS, and log in with the browser\ngh auth setup-git      # make Git use gh for github.com credentials"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Git for Windows installs Git Credential Manager and sets it up; the first push opens a browser login.\ngit config get credential.helper    # prints: manager"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# Apple's Git and Homebrew's Git store credentials in the login keychain:\ngit config --global credential.helper osxkeychain\n# or install Git Credential Manager for browser logins to GitHub, GitLab, Bitbucket and Azure DevOps:\nbrew install --cask git-credential-manager"
    },
    {
      "label": "Linux",
      "lang": "bash",
      "code": "# Git Credential Manager (download the .deb or tarball from its GitHub releases), then:\ngit-credential-manager configure\ngit config --global credential.credentialStore secretservice\n# or keep credentials in memory for an hour only:\ngit config --global credential.helper 'cache --timeout=3600'"
    }
  ]
}
```

If you use a personal access token, prefer fine-grained tokens limited to the repositories you need, and never put a token in the remote URL: it ends up in plain text in `.git/config` and in your shell history.

### SSH keys

SSH uses a key pair: the private key stays on your computer, the public key goes to your account on the hosting service. Create an Ed25519 key, and give it a passphrase when asked:

```terminal
{
  "title": "create an SSH key (Enter for the default file, then a passphrase twice)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ssh-keygen -t ed25519 -C \"dev@example.com\"",
      "output": "Generating public/private ed25519 key pair.\nEnter file in which to save the key (/home/dev/.ssh/id_ed25519):\nCreated directory '/home/dev/.ssh'.\nEnter passphrase (empty for no passphrase):\nEnter same passphrase again:\nYour identification has been saved in /home/dev/.ssh/id_ed25519\nYour public key has been saved in /home/dev/.ssh/id_ed25519.pub\nThe key fingerprint is:\nSHA256:SNXzpHfEKSxkCNJzBDGtFevKQmiFAo/pbCg8dfJEGPE dev@example.com\nThe key's randomart image is:\n+--[ED25519 256]--+\n|.  o=o=*+=o. . . |\n|.+ oo.oo=o+ + +  |\n|+ oo.E.=.  * o   |\n|=..o=..o  . o .  |\n|o*o ... S  . .   |\n|o... . .         |\n|    . o          |\n|     .           |\n|                 |\n+----[SHA256]-----+"
    }
  ]
}
```

If you already have a key at `~/.ssh/id_ed25519`, `ssh-keygen` asks before overwriting it: answer `n` and use the key you have. The passphrase encrypts the private key on disk. To avoid typing it on every push, load the key into the **SSH agent** once per login (desktop systems usually start an agent for you, so `ssh-add` alone is enough there):

```terminal
{
  "title": "load the key into the agent",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "eval \"$(ssh-agent -s)\"",
      "output": "Agent pid 838"
    },
    {
      "cmd": "ssh-add ~/.ssh/id_ed25519",
      "output": "Enter passphrase for /home/dev/.ssh/id_ed25519:\nIdentity added: /home/dev/.ssh/id_ed25519 (dev@example.com)"
    },
    {
      "cmd": "cat ~/.ssh/id_ed25519.pub",
      "output": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN9q8JV0x3OVu/PnVqlhV1RnI6zKnYAOgn6FIde4pBTa dev@example.com"
    }
  ]
}
```

On macOS, `ssh-add --apple-use-keychain ~/.ssh/id_ed25519` stores the passphrase in the keychain. In Git Bash on Windows, use the same commands as above: Git for Windows brings its own OpenSSH. (Windows also has a built-in "OpenSSH Authentication Agent" service, but only Windows' own `ssh.exe` talks to it; to use it from Git, set `git config --global core.sshCommand C:/Windows/System32/OpenSSH/ssh.exe`.)

Copy the whole `ssh-ed25519 ...` line into your account's SSH key settings (GitHub: Settings, SSH and GPG keys; or `gh ssh-key add ~/.ssh/id_ed25519.pub --title devbox`). Then test the connection:

```bash
ssh -T git@github.com
```

The first time, SSH asks you to confirm the server's host key. Compare the fingerprint with the one the service publishes; GitHub's Ed25519 key is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` ([GitHub's list](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)). After that, GitHub answers with a greeting like this (example output, from a run against github.com):

```text
Hi OWNER! You've successfully authenticated, but GitHub does not provide shell access.
```

To use different keys for different accounts or hosts, add entries to `~/.ssh/config` ([how to choose the SSH key Git uses](/posts/specify-private-ssh-key-for-git-commands)):

```text
Host github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

If you still use an old RSA key, read [GitHub is removing ssh-rsa signatures](/posts/github-ssh-algorithm-removal) before it breaks.

## Host a Repository on Your Own Server

Any Linux server with SSH can host Git repositories; there is nothing to install beyond Git. On the server, create a bare repository in a directory your SSH user owns; on your computer, add it as a remote:

```bash
# on the server, as the user you log in with over SSH
git init --bare /srv/git/status-page.git

# on your computer
git remote add server deploy@SERVER:/srv/git/status-page.git
git push -u server main
git clone deploy@SERVER:/srv/git/status-page.git
```

For a shared server, create a dedicated `git` user whose login shell is `git-shell` (it only allows Git commands) and put each developer's public key in its `~/.ssh/authorized_keys`. If you need a server for this, any small cloud VM works; on DigitalOcean, you can [create a Droplet](https://m.do.co/c/2a9bba940f39) with Ubuntu 24.04 and the smallest size. That is a referral link: new accounts that sign up through it get DigitalOcean's standard [signup credit](https://docs.digitalocean.com/platform/billing/signup-credit/) ($5, valid for 90 days, checked in October 2026) and must add a payment method before creating a Droplet, and if you later spend $25 there, DevOps Daily gets $25 in credit ([referral program](https://docs.digitalocean.com/platform/teams/refer-others/)). A bare repository has no web interface, pull requests or access control per branch; for a team, a hosting service or a self-hosted Gitea, Forgejo or GitLab is usually the better choice.

## Forks: origin and upstream

For open source, you usually cannot push to the project's repository. You **fork** it (your own copy on the platform), clone your fork as `origin`, and add the original as `upstream` to stay in sync:

```bash
git clone git@github.com:YOU/project.git && cd project
git remote add upstream https://github.com/ORIGINAL-OWNER/project.git

# later: bring your fork's main up to date with the original
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
```

Your changes go on branches in your fork, and you open a pull request from there. `gh repo sync` does the update in one command. [How to sync a forked repository](/posts/sync-forked-repository-github) covers the web button and conflicts.

## GitHub Push Protection

GitHub scans pushes for known secret formats (cloud keys, tokens, private keys) and can reject them before they reach the repository. **Push protection for users** is on by default for every account and blocks secrets in your pushes to public repositories. Repository administrators can turn on push protection for a repository, so that it applies to everyone who pushes; that is free for public repositories, and private repositories need GitHub Secret Protection. GitHub runs secret scanning on public repositories automatically ([GitHub's documentation](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection)).

A blocked push fails with `GH013: Repository rule violations found` and `Push cannot contain secrets`, followed by the type of secret, the commit and the file and line. Deleting the secret in a new commit does not help, because the earlier commit still contains it: remove it from the commit that introduced it (`git commit --amend` for the last commit, an interactive rebase for older ones, [Part 8](/guides/introduction-to-git/08-history#h2-rewrite-local-history-with-interactive-rebase)), then push again. Only use the bypass for a real false positive, and if the secret was real, revoke it anyway: it has left your machine in at least one commit. [Part 9](/guides/introduction-to-git/09-best-practices#h2-keep-secrets-out) adds checks that catch secrets before you commit.

## Common Mistakes

- **Expecting `git fetch` to change your files.** It only updates `origin/*`. Merge, rebase or pull to bring the changes in.
- **`git push --force` on a shared branch.** Use `--force-with-lease --force-if-includes`, and only on branches you own.
- **Pulling with local commits and no strategy set.** Git stops with "Need to specify how to reconcile divergent branches". Set `pull.rebase` once.
- **Forgetting to push tags.** Use `--follow-tags`, or push the tag by name.
- **Tokens in remote URLs.** Use a credential helper or SSH.
- **Stale branches.** Turn on `fetch.prune` and delete branches marked `gone`.

## Summary

- A remote is another copy of the repository; `origin/main` is your last view of its `main`.
- `git push -u` sends a branch and sets its upstream; `push.autoSetupRemote` does it automatically.
- A rejected push means "integrate first": `git fetch`, look, then `git pull --rebase` (or merge) and push again.
- `--force-with-lease --force-if-includes` is the recommended way to force-push your own branch.
- `git push origin --delete` and `git fetch --prune` clean up merged branches.
- Use a credential helper for HTTPS or an Ed25519 key with an agent for SSH.

Next: [Collaboration Workflows](/guides/introduction-to-git/07-collaboration), where pull requests, review and team rules come in.

## Keep Learning

- [Push a new local branch and track it](/posts/how-to-push-new-local-branch-to-remote-and-track)
- [Reset a local branch to match the remote](/posts/how-to-reset-local-branch-to-match-remote-head)
- [Force git pull to overwrite local files](/posts/how-to-force-git-pull-overwrite-local-files)
- [Fix "src refspec master does not match any"](/posts/fix-src-refspec-master-does-not-match-any)
- Compare hosting services: [GitHub vs GitLab](/comparisons/github-vs-gitlab), [Bitbucket vs GitHub](/comparisons/bitbucket-vs-github)
