---
title: 'Git Best Practices: Commits, Hooks and Signing'
description: 'Git habits that pay off: clear commit messages, small commits, .gitattributes, keeping secrets out, hooks, SSH commit signing and useful settings.'
order: 9
---

Git lets you work in many ways, and some of them hurt later: a history nobody can read, a token in a commit, a teammate's work lost to a force push, a repository that slows down every year. This part collects the habits and settings that avoid those problems, each shown on the project: commit messages that explain themselves, `.gitattributes` for line endings, hooks that catch mistakes before they are committed, signed commits, and the configuration worth setting on every machine.

## Prerequisites

- The `status-page` repository from [Part 8](/guides/introduction-to-git/08-history), and the SSH key from [Part 6](/guides/introduction-to-git/06-remote-repositories#h2-authenticate-to-github-gitlab-and-others) loaded in your agent (for signing).
- The everyday commands from [Parts 3 to 6](/guides/introduction-to-git/03-tracking-changes).

## Write Commit Messages People Can Use

The diff shows what changed. The message is the only place for **why**, and it is what you read months later in `git log`, `git blame` and release notes. A message that works:

- A **subject line** of about 50 characters (72 at most), in the imperative ("Add", "Fix", "Remove": it completes "If applied, this commit will..."), capitalized, without a period.
- A **blank line**, then a **body** wrapped at about 72 characters that explains why the change was needed and anything surprising about it. Skip the body when the subject says it all.
- **Trailers** at the end for structured data: `Co-authored-by:`, `Signed-off-by:`, `Fixes: #123`.

Here is a change that needs an explanation. `scripts/check.sh` learns to reject two services with the same name:

```terminal
{
  "title": "a commit with a body and a trailer",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git diff && scripts/check.sh",
      "output": "diff --git a/scripts/check.sh b/scripts/check.sh\nindex 16ab8ce..834ffce 100755\n--- a/scripts/check.sh\n+++ b/scripts/check.sh\n@@ -5,6 +5,7 @@ cd \"$(dirname \"$0\")/..\"\n\n errors=0\n n=0\n+seen=\" \"\n while read -r name url extra || [[ -n ${name:-} ]]; do\n   n=$((n + 1))\n   [[ -z $name || $name == \\#* ]] && continue\n@@ -12,6 +13,11 @@ while read -r name url extra || [[ -n ${name:-} ]]; do\n     echo \"services.txt:$n: want '<name> <https URL>', got '$name $url${extra:+ $extra}'\" >&2\n     errors=$((errors + 1))\n   fi\n+  if [[ $seen == *\" $name \"* ]]; then\n+    echo \"services.txt:$n: duplicate name '$name'\" >&2\n+    errors=$((errors + 1))\n+  fi\n+  seen+=\"$name \"\n done < services.txt\n\n if ((errors > 0)); then\nservices.txt: OK"
    },
    {
      "cmd": "git commit -a -m \"Reject duplicate service names in check.sh\" -m \"Two lines with the same name built a page with two links that looked the\nsame, and nobody could tell which one was current. The check now fails on\nthe second line that uses a name.\" --trailer \"Co-authored-by: Sam <sam@example.com>\"",
      "output": "[main c98ebb7] Reject duplicate service names in check.sh\n 1 file changed, 6 insertions(+)"
    },
    {
      "cmd": "git log -1",
      "output": "commit c98ebb7c1b8368b067dcf22d65e456c816bab61f\nAuthor: Dev <dev@example.com>\nDate:   Wed Oct 21 09:02:00 2026 +0000\n\n    Reject duplicate service names in check.sh\n\n    Two lines with the same name built a page with two links that looked the\n    same, and nobody could tell which one was current. The check now fails on\n    the second line that uses a name.\n\n    Co-authored-by: Sam <sam@example.com>"
    }
  ]
}
```

`--trailer` adds a correctly formatted trailer (GitHub shows both people as authors for `Co-authored-by`). `git commit -s` adds `Signed-off-by: Your Name <email>`, which projects that use the Developer Certificate of Origin (DCO), such as the Linux kernel, require. Words such as `Fixes #123` or `Closes #123` in a message close the issue on GitHub and GitLab when the commit reaches the default branch.

| Instead of                                                                         | Write                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `fix`                                                                              | `Fix the footer contrast in dark mode`                                                                                         |
| `Updated check.sh`                                                                 | `Reject duplicate service names in check.sh`                                                                                   |
| `WIP`, `more changes`                                                              | Squash them before merging ([Part 8](/guides/introduction-to-git/08-history#h2-rewrite-local-history-with-interactive-rebase)) |
| `Fixed bug where page was broken because of http URL in services.txt added by Sam` | `Revert "Add the legacy service"` with the reason in the body                                                                  |

### Conventional Commits, if you automate releases

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) is a format for subject lines: `type(scope): description`, for example `feat(check): reject duplicate service names`, `fix: footer contrast in dark mode`, or `feat!: ...` for a breaking change. Its value comes from tools that read it: release-please, semantic-release and similar tools compute the next version number and write the changelog from the commit types, and commitlint checks the format in CI.

Use it when you have that automation, or when your team already does. Without it, the type prefix is noise, and a clear imperative subject with a good body is enough. Either way, pick one style per repository and enforce it in CI, not by asking people to remember.

## Make Small, Focused Commits

- **One logical change per commit.** "Add the docs service" and "Rename the template" are two commits, even if you made them in the same hour. `git add -p` ([Part 3](/guides/introduction-to-git/03-tracking-changes#h3-stage-part-of-a-file-with-git-add-p)) makes this easy.
- **Each commit should build and pass the tests**, so `git bisect` ([Part 8](/guides/introduction-to-git/08-history#h2-find-the-commit-that-broke-something-with-git-bisect)) and `git revert` work on any of them.
- **Commit often on your branch, clean up before review.** Small local commits are a safety net; fixups and an interactive rebase turn them into a readable series.
- **Do not mix formatting and logic.** A mass reformat goes in its own commit, listed in `.git-blame-ignore-revs`.

## Line Endings and .gitattributes

Windows editors write CRLF line endings, macOS and Linux write LF. If Git stores whatever each person's editor wrote, every line of a file shows as changed when someone on another system saves it, and shell scripts with CRLF fail on Linux. A `.gitattributes` file in the repository fixes this for everyone, whatever their personal settings. The project has had one rule for its scripts since Part 2; extend it to every text file:

```text
# Store text files with LF in the repository; check them out with the platform's default
* text=auto

# Shell scripts always use LF line endings, also in Windows checkouts
*.sh text eol=lf

# Never touch these
*.png binary
*.ico binary
```

```terminal
{
  "title": "add .gitattributes and check what Git sees",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git add .gitattributes && git add --renormalize . && git status --short",
      "output": "M  .gitattributes"
    },
    {
      "cmd": "git ls-files --eol -- services.txt scripts/check.sh template.html",
      "output": "i/lf    w/lf    attr/text eol=lf      \tscripts/check.sh\ni/lf    w/lf    attr/text=auto        \tservices.txt\ni/lf    w/lf    attr/text=auto        \ttemplate.html"
    },
    {
      "cmd": "git commit -q -m \"Normalize line endings with .gitattributes\" && git log --oneline -1",
      "output": "cf72d19 Normalize line endings with .gitattributes"
    }
  ]
}
```

`git ls-files --eol` shows, for each file, the line endings in the index (`i/`) and in the working tree (`w/`), and the attributes that apply. `git add --renormalize .` re-stages files under the new rules; here nothing changed because every file already had LF. Add `.gitattributes` in the first commit of a new repository, as Part 2 did, before the first CRLF sneaks in.

`.gitattributes` also tells Git how to diff and merge special files: `*.lockfile merge=ours`, `*.min.js -diff`, or `diff=` drivers that convert binary files to text before diffing ([Part 10](/guides/introduction-to-git/10-advanced-techniques#h2-useful-attributes-diff-drivers-and-export-rules)).

## Keep Secrets Out

Tokens, passwords and private keys in a repository are the most common serious Git mistake, and the hardest to undo ([Part 8](/guides/introduction-to-git/08-history#h2-remove-a-secret-from-history)). Several layers help:

1. **`.gitignore` for local configuration** (`.env`, `*.pem`), from the first commit ([Part 2](/guides/introduction-to-git/02-repositories#h2-keep-files-out-with-gitignore)). Commit a `.env.example` with placeholder values instead, so people know which settings exist.
2. **A secret scanner before the commit**, such as gitleaks, run by a pre-commit hook (next section). [Pre-commit hooks for security](/posts/pre-commit-hooks-security-guide) sets up gitleaks and detect-secrets.
3. **The same scanner in CI**, because hooks can be skipped.
4. **Push protection on the hosting service** ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-github-push-protection)).
5. **Secrets in a secret manager**, injected at run time, so there is nothing to commit in the first place ([secrets management](/posts/secrets-management-guide)).

## Hooks: Checks Before You Commit or Push

**Hooks** are programs Git runs at certain points: `pre-commit` before a commit is created, `commit-msg` to check the message, `pre-push` before a push, and others. If a `pre-` hook exits with a non-zero status, Git stops the operation.

The classic place for hooks is `.git/hooks/<name>`, an executable file per event. That directory is never cloned or pushed, so each person has to install hooks themselves. Git 2.54 added a second way: hooks defined in the configuration, several per event, each with a name. Add one that runs the services check before every commit:

```terminal
{
  "title": "a pre-commit hook defined in the config (Git 2.54+)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config set hook.check-services.event pre-commit"
    },
    {
      "cmd": "git config set hook.check-services.command \"scripts/check.sh\""
    },
    {
      "cmd": "git hook list pre-commit",
      "output": "check-services"
    },
    {
      "comment": "try to commit a duplicate name",
      "cmd": "echo \"api     https://api-v2.example.com/\" >> services.txt && git commit -am \"Add the new API endpoint\"",
      "output": "services.txt:16: duplicate name 'api'\ncheck failed: 1 bad line(s)"
    },
    {
      "cmd": "git log --oneline -1 && git restore services.txt",
      "output": "cf72d19 Normalize line endings with .gitattributes"
    }
  ]
}
```

The hook printed the error and the commit was not created. A few things to know about hooks:

- **They check what is on disk.** `scripts/check.sh` reads the working tree. With partly staged files, a stricter hook checks the staged version (`git show :services.txt`), or uses a framework that does it for you.
- **They are a convenience, not enforcement.** `git commit --no-verify` skips `pre-commit` and `commit-msg` hooks, and anyone can delete them. Run the same checks in CI and require them with branch rules ([Part 7](/guides/introduction-to-git/07-collaboration#h2-set-up-the-repository-for-a-team)).
- **Sharing them takes one step per clone.** Commit the hook scripts to a directory such as `.githooks/` and have each person run `git config core.hooksPath .githooks` once, or use a framework such as [pre-commit](https://pre-commit.com/), which installs and versions hooks from a `.pre-commit-config.yaml`. Git deliberately never runs hooks that came with a clone.
- **Hooks are code that runs on your machine.** Only enable hooks you have read. A repository that brings its own `.git/config` (for example in a copied directory or a cached workspace) can run programs through hooks and other settings; [this post](/posts/poisoned-git-config-git-status-runs-code) tests which Git commands are affected.

Config-defined hooks can live in your global config too, which is handy for a personal check (such as a secret scanner) in every repository. `git config set hook.<name>.enabled false` turns one off for a single repository.

## Sign Your Commits

The author name and email of a commit are plain text: anyone can make a commit that claims to be from you. A **signature** proves that a commit was made with your key. GitHub and GitLab show signed commits as "Verified", and rulesets can require them on protected branches.

Git can sign with GPG, X.509 (S/MIME) or SSH keys. **SSH signing** (Git 2.34+) is the simplest, because you probably have an SSH key already. Use the key from [Part 6](/guides/introduction-to-git/06-remote-repositories#h3-ssh-keys):

```terminal
{
  "title": "configure SSH commit signing",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config set --global gpg.format ssh"
    },
    {
      "cmd": "git config set --global user.signingKey ~/.ssh/id_ed25519.pub"
    },
    {
      "cmd": "git config set --global commit.gpgSign true && git config set --global tag.gpgSign true"
    }
  ]
}
```

`user.signingKey` points to the public key; `ssh-keygen` finds the matching private key in your SSH agent. Now every commit is signed. Commit the `.env.example` file that [Keep Secrets Out](#h2-keep-secrets-out) recommended, and check the signature (the `services.txt: OK` line comes from the pre-commit hook of the previous section):

```terminal
{
  "title": "a signed commit, and checking it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"STATUS_API_TOKEN=\" > .env.example && git add .env.example && git commit -q -m \"Add an example environment file\" && git log --oneline -1",
      "output": "services.txt: OK\nef8c595 Add an example environment file"
    },
    {
      "cmd": "git log --show-signature -1",
      "output": "error: gpg.ssh.allowedSignersFile needs to be configured and exist for ssh signature verification\ncommit ef8c595ea2be1e0aa063ae73b0b998bb924fd2e6\nNo signature\nAuthor: Dev <dev@example.com>\nDate:   Wed Oct 21 09:15:00 2026 +0000\n\n    Add an example environment file"
    }
  ]
}
```

Git signed the commit, but cannot verify SSH signatures until you tell it which keys belong to whom. That is the **allowed signers** file, one line per person: email, then the public key:

```terminal
{
  "title": "trust your own key, then verify",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"dev@example.com $(cat ~/.ssh/id_ed25519.pub)\" > ~/.ssh/allowed_signers"
    },
    {
      "cmd": "git config set --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers"
    },
    {
      "cmd": "git log --show-signature -1",
      "output": "commit ef8c595ea2be1e0aa063ae73b0b998bb924fd2e6\nGood \"git\" signature for dev@example.com with ED25519 key SHA256:SNXzpHfEKSxkCNJzBDGtFevKQmiFAo/pbCg8dfJEGPE\nAuthor: Dev <dev@example.com>\nDate:   Wed Oct 21 09:15:00 2026 +0000\n\n    Add an example environment file"
    },
    {
      "cmd": "git verify-commit HEAD && git log --format=\"%h %G? %GS %s\" -3",
      "output": "Good \"git\" signature for dev@example.com with ED25519 key SHA256:SNXzpHfEKSxkCNJzBDGtFevKQmiFAo/pbCg8dfJEGPE\nef8c595 G dev@example.com Add an example environment file\ncf72d19 N  Normalize line endings with .gitattributes\nc98ebb7 N  Reject duplicate service names in check.sh"
    }
  ]
}
```

`%G?` prints `G` for a good signature and `N` for none. For a team, keep an allowed signers file with everyone's keys in the repository or in a shared location.

To get "Verified" on GitHub, add the same public key a second time in Settings, SSH and GPG keys, with the key type **Signing Key** (or run `gh ssh-key add ~/.ssh/id_ed25519.pub --type signing --title devbox`). GitHub records the verification when you push, so commits stay verified after you rotate or revoke the key later. Two details:

- **Vigilant mode** (a GitHub setting) marks your unsigned commits as "Unverified", so that a commit someone else made in your name stands out.
- Commits that GitHub creates for you in the browser, including merge and squash commits, are signed with GitHub's own key. Commits that **Rebase and merge** rewrites are not signed by you and show as unverified, which matters if a ruleset requires signatures ([Part 7](/guides/introduction-to-git/07-collaboration#h2-merge-methods-on-a-pull-request)).

## Large Files

Git keeps every version of every file in every clone. A 200 MB video committed once stays in the history forever, and every `git clone` downloads it. Keep build output, dependencies, datasets and binaries out of Git (artifact storage, package registries, object storage). For binary files that do belong to the project, such as design files or game assets, use **Git LFS**, which stores a small pointer in Git and the content on the LFS server:

```bash
git lfs install                # once per computer
git lfs track "*.psd"          # writes a rule to .gitattributes
git add .gitattributes design.psd
git commit -m "Add the page design"
```

Hosting services limit LFS storage and bandwidth by plan, so check the quota before you put a lot in it. Git LFS 3.8.1 is the current release. If large files are already in the history, `git filter-repo --strip-blobs-bigger-than` or `git lfs migrate` can move them out ([Part 8](/guides/introduction-to-git/08-history#h2-remove-a-secret-from-history)).

## Settings and Aliases Worth Having

These settings change defaults that most people would choose differently. Each was explained in the part that introduced it:

```bash
git config set --global init.defaultBranch main          # Part 1
git config set --global pull.rebase true                 # Part 6
git config set --global rebase.autoStash true            # Part 6
git config set --global push.autoSetupRemote true        # Part 6
git config set --global push.followTags true             # Part 6
git config set --global fetch.prune true                 # Part 6
git config set --global merge.conflictStyle zdiff3       # Part 5
git config set --global rebase.autoSquash true           # Part 7
git config set --global rebase.updateRefs true           # Part 7
git config set --global rerere.enabled true              # Part 10
git config set --global diff.algorithm histogram         # clearer diffs for moved code
git config set --global diff.colorMoved default          # moved lines in a different color
git config set --global branch.sort -committerdate       # recent branches first
git config set --global tag.sort version:refname         # v1.10 after v1.9
git config set --global help.autocorrect prompt          # offer to run "status" when you type "stauts"
```

**Aliases** turn long commands into short ones. Keep the list short enough to remember:

```terminal
{
  "title": "a few aliases",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config set --global alias.lg \"log --oneline --graph --decorate\""
    },
    {
      "cmd": "git config set --global alias.st \"status --short --branch\""
    },
    {
      "cmd": "git config set --global alias.pushf \"push --force-with-lease --force-if-includes\""
    },
    {
      "cmd": "git config set --global alias.undo \"reset --soft HEAD~1\""
    },
    {
      "cmd": "git lg -4 && git st",
      "output": "* ef8c595 (HEAD -> main) Add an example environment file\n* cf72d19 Normalize line endings with .gitattributes\n* c98ebb7 Reject duplicate service names in check.sh\n* 807b192 (origin/main, origin/HEAD) Add a contact link to the footer\n## main...origin/main [ahead 3]"
    }
  ]
}
```

An alias that starts with `!` runs a shell command, for example `git config set --global alias.root '!pwd'`. `git config list --global` shows everything you have set, and keeping your `~/.gitconfig` in a dotfiles repository makes a new machine feel like home in a minute.

## Keep the Repository Fast

Git cleans up after itself: commands such as `git commit` and `git fetch` run `git maintenance run --auto`, which repacks objects when enough have piled up. You can run maintenance by hand and see the effect:

```terminal
{
  "title": "maintenance by hand",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git count-objects -vH",
      "output": "count: 233\nsize: 932.00 KiB\nin-pack: 0\npacks: 0\nsize-pack: 0 bytes\nprune-packable: 0\ngarbage: 0\nsize-garbage: 0 bytes"
    },
    {
      "cmd": "git maintenance run"
    },
    {
      "cmd": "git count-objects -vH",
      "output": "count: 0\nsize: 0 bytes\nin-pack: 233\npacks: 2\nsize-pack: 31.24 KiB\nprune-packable: 0\ngarbage: 0\nsize-garbage: 0 bytes"
    }
  ]
}
```

The 233 loose objects (932.00 KiB, one compressed file each) are now in two pack files of 31.24 KiB together, because packs store similar objects as deltas of each other. One pack holds the reachable objects; the other is a "cruft" pack with unreachable ones, such as the old versions of amended and rebased commits, which a later run deletes once they expire. Since Git 2.54, manual maintenance uses this **geometric** strategy, which avoids rewriting everything into one big pack on large repositories.

For repositories you use every day, `git maintenance start` registers the repository and schedules background maintenance with your system's scheduler (systemd timers or cron on Linux, launchd on macOS, Task Scheduler on Windows). It prefetches from remotes hourly and repacks daily, so `git fetch` and `git log` stay fast without you ever waiting for a cleanup. `git maintenance stop` removes the schedule.

## Security Hygiene

- **Keep Git up to date.** Git publishes security releases several times a year, often for problems that a malicious repository triggers during `clone` or with submodules. Distributions backport the fixes; install them.
- **Be careful in repositories you did not create.** Git refuses to work in a repository owned by another user ("detected dubious ownership") unless you list it in `safe.directory`; do not add `*` to make the message go away. Repository settings and hooks can run programs ([the poisoned config post](/posts/poisoned-git-config-git-status-runs-code)).
- **Sign commits and tags** for releases, and protect the default branch (no force pushes, required reviews and checks).
- **Never put credentials in remote URLs**; use a credential helper or SSH ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-authenticate-to-github-gitlab-and-others)).

Tag the release with a signed tag (`-s`; with `tag.gpgSign true` set above, `-a` signs too). With `push.followTags`, a normal push sends it along:

```terminal
{
  "title": "a signed release tag",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git tag -s v0.3.0 -m \"Duplicate check, hooks, signed commits\""
    },
    {
      "cmd": "git tag -v v0.3.0",
      "output": "Good \"git\" signature for dev@example.com with ED25519 key SHA256:SNXzpHfEKSxkCNJzBDGtFevKQmiFAo/pbCg8dfJEGPE\nobject ef8c595ea2be1e0aa063ae73b0b998bb924fd2e6\ntype commit\ntag v0.3.0\ntagger Dev <dev@example.com> 1792575180 +0000\n\nDuplicate check, hooks, signed commits"
    },
    {
      "cmd": "git push -q && git ls-remote --tags origin \"v0.3*\"",
      "output": "20198d6f569c5387606616b2a2c8e04b08468af4\trefs/tags/v0.3.0\nef8c595ea2be1e0aa063ae73b0b998bb924fd2e6\trefs/tags/v0.3.0^{}"
    }
  ]
}
```

## Common Mistakes

- **Committing generated files** (build output, `node_modules`, compiled binaries). Ignore them and build them in CI.
- **Huge pull requests** that nobody can review. Split them, or stack them.
- **Relying on local hooks for policy.** Repeat every check in CI.
- **One enormous `.gitconfig` copied from the internet.** Add settings when you understand what they change.
- **Ignoring Git's hints.** Most of the output in this guide that starts with `hint:` tells you exactly what to do next.

## Summary

- A good commit has a short imperative subject and a body that explains why; trailers carry co-authors and sign-offs. Use Conventional Commits only when tools consume them.
- Small commits that each build make review, `bisect` and `revert` work.
- `.gitattributes` fixes line endings for everyone; `* text=auto` plus `eol=lf` for scripts is a safe start.
- Layer secret protection: `.gitignore`, a pre-commit scanner, CI and push protection.
- Hooks (in `.git/hooks`, `core.hooksPath` or, since Git 2.54, the config) catch mistakes early but do not replace CI.
- SSH signing needs four settings and an allowed signers file; upload the key as a signing key to get "Verified".

Next: [Advanced Git Techniques](/guides/introduction-to-git/10-advanced-techniques): internals, worktrees, large repositories, rerere, submodules and more.

## Keep Learning

- [Git Command Quiz](/quizzes/git-quiz)
- [Git Workflow Strategies interview questions](/interview-questions/junior/git-workflow-strategies)
- [How to make Git ignore file mode changes](/posts/git-ignore-file-mode-changes)
- [Set the editor for commit messages](/posts/set-git-editor-commit-messages)
