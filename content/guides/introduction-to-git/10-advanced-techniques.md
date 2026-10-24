---
title: 'Advanced Git: Worktrees, Sparse Clones, Submodules'
description: 'Advanced Git with real examples: objects and refs, SHA-256 and reftable, worktrees, partial clones and sparse checkout, rerere, submodules, bundles.'
order: 10
---

You can use Git for years with the commands from the earlier parts. This part is for the moments when they are not enough: a repository too big to clone comfortably, two branches you need open at the same time, the same conflict for the fifth time, another project's code inside yours, or a script that has to parse Git's output. It starts with how Git stores data, because the rest builds on it, and covers the SHA-256 and reftable formats that become defaults in Git 3.0.

## Prerequisites

- The `status-page` repository from [Part 9](/guides/introduction-to-git/09-best-practices), with its remote in `~/server`.
- Comfort with branches, merging, rebasing and remotes ([Parts 4 to 6](/guides/introduction-to-git/04-branching)).

## How Git Stores Data

Everything in `.git/objects` is one of four object types, each named by the hash of its content:

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "c", "label": "commit", "sub": "tree, parents, author, message", "icon": "box", "tone": "blue" }],
    [{ "id": "t", "label": "tree", "sub": "a directory listing", "icon": "branch", "tone": "violet" }],
    [{ "id": "b1", "label": "blob", "sub": "README.md content", "icon": "database", "tone": "slate" },
     { "id": "t2", "label": "tree", "sub": "scripts/", "icon": "branch", "tone": "violet" }],
    [{ "id": "b2", "label": "blob", "sub": "check.sh content", "icon": "database", "tone": "slate" }]
  ],
  "edges": [["c", "t"], ["t", "b1"], ["t", "t2"], ["t2", "b2"]]
}
```

- A **blob** is the content of one file, without its name.
- A **tree** lists names, modes and the hashes of blobs and other trees: one directory.
- A **commit** points to the top-level tree, its parent commits, and records the author, committer and message.
- An **annotated tag** points to a commit and records the tagger and message (and a signature).

`git cat-file` reads any object:

```terminal
{
  "title": "a commit, its tree and a blob",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git cat-file -p HEAD~1",
      "output": "tree 9ba5d4d5ab4509bb7d220032ac4ebcf788e5b6e6\nparent c98ebb7c1b8368b067dcf22d65e456c816bab61f\nauthor Dev <dev@example.com> 1792573560 +0000\ncommitter Dev <dev@example.com> 1792573560 +0000\n\nNormalize line endings with .gitattributes"
    },
    {
      "cmd": "git cat-file -p \"HEAD~1^{tree}\"",
      "output": "100644 blob b7bbb2e16789d24d7de15ca7f71ed196b602cb39\t.gitattributes\n100644 blob fbfb1f04f09bf30adb011d73d8ddb1013d816a68\t.gitignore\n100644 blob 6f22bb8fe42db2bc82796863e6a388f91a7e73ad\tREADME.md\n040000 tree 5fa55a1241b866f9a605070828653d562cd10a0e\tdocs\n040000 tree 0e678f8b6735f75c51b2fc635a8ed51db3a25d95\tscripts\n100644 blob f7d8f5a40d5be4045d0d88c55c6d330395e3cc22\tservices.txt\n100644 blob 5081f63ca9194a750e169c6045782053b3f443f4\tstyle.css\n100644 blob c64e42a35d303090a3abda9cb6caeb43edd18c7a\ttemplate.html"
    },
    {
      "cmd": "git cat-file -p HEAD~1:services.txt | head -3",
      "output": "# name  URL\napi     https://api.example.com/health\nweb     https://www.example.com/"
    },
    {
      "comment": "the signed commit carries its signature in a gpgsig header",
      "cmd": "git cat-file -p HEAD | head -6",
      "output": "tree 100a0bf446550728ae761e7c3abf7e8329294518\nparent cf72d19c3361d4f553e6041a26a3d9b831a83204\nauthor Dev <dev@example.com> 1792574100 +0000\ncommitter Dev <dev@example.com> 1792574100 +0000\ngpgsig -----BEGIN SSH SIGNATURE-----\n U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAg32rwlXTHc5W78+dWqWFXVGcjrM"
    }
  ]
}
```

An object's name is the hash of a short header plus its content, which you can reproduce:

```terminal
{
  "title": "how a blob gets its name",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf 'hello\\n' | git hash-object --stdin",
      "output": "ce013625030ba8dba906f756967f9e9ca394464a"
    },
    {
      "cmd": "printf 'blob 6\\0hello\\n' | sha1sum",
      "output": "ce013625030ba8dba906f756967f9e9ca394464a  -"
    }
  ]
}
```

(On macOS, use `shasum -a 1` instead of `sha1sum`.)

Because a commit contains its tree's hash and its parents' hashes, changing anything in the past (one byte of one file) changes every hash after it. That is why rewriting history gives commits new hashes, and why a signed commit or tag protects everything it points to.

**Refs** are names for hashes: branches in `refs/heads/`, remote-tracking branches in `refs/remotes/`, tags in `refs/tags/`. Objects start as individual compressed files ("loose objects") and are packed into **pack files** with delta compression by `git maintenance` ([Part 9](/guides/introduction-to-git/09-best-practices#h2-keep-the-repository-fast)):

```terminal
{
  "title": "refs and packs",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git for-each-ref --format=\"%(objectname:short) %(objecttype) %(refname)\" refs/heads refs/tags",
      "output": "ef8c595 commit refs/heads/main\n298425e commit refs/heads/release/0.2\ncb1c6ab tag refs/tags/v0.1.0\nabc33e4 tag refs/tags/v0.2.0\n27332c4 tag refs/tags/v0.2.1\n20198d6 tag refs/tags/v0.3.0"
    },
    {
      "cmd": "ls .git/objects/pack/",
      "output": "multi-pack-index\npack-01136ef622d37e99de957fd83e23dfc18b779dca.idx\npack-01136ef622d37e99de957fd83e23dfc18b779dca.pack\npack-01136ef622d37e99de957fd83e23dfc18b779dca.rev\npack-0c42f7b549f409b774ca6f3c9c565c88d295f7e5.idx\npack-0c42f7b549f409b774ca6f3c9c565c88d295f7e5.mtimes\npack-0c42f7b549f409b774ca6f3c9c565c88d295f7e5.pack\npack-0c42f7b549f409b774ca6f3c9c565c88d295f7e5.rev"
    }
  ]
}
```

To find what makes a repository big, list the largest blobs in the whole history, with their size in bytes and path (files that were deleted long ago count too):

```terminal
{
  "title": "the largest files in the history",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git rev-list --objects --all | git cat-file --batch-check=\"%(objecttype) %(objectname) %(objectsize) %(rest)\" | awk '$1 == \"blob\" { print $3, substr($2, 1, 7), $4 }' | sort -n -r | head -5",
      "output": "751 834ffce scripts/check.sh\n627 edebc8e scripts/build.sh\n621 d2d9547 scripts/build.sh\n600 16ab8ce scripts/check.sh\n538 c9ae49b services.txt"
    }
  ]
}
```

## SHA-256 and Reftable Repositories

Git has supported repositories that name objects with **SHA-256** since Git 2.29, and dropped the "experimental" label in 2.42. SHA-1 is still the default; Git uses a hardened SHA-1 that detects the known collision attacks, but SHA-256 is the long-term answer, and Git 3.0 makes it the default for new repositories ([Part 1](/guides/introduction-to-git/01-fundamentals#h2-what-changes-in-git-30)). Create one with `--object-format`:

```terminal
{
  "title": "a SHA-256 repository",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git init -q --object-format=sha256 ~/sha256-demo && cd ~/sha256-demo && echo \"hello\" > a.txt && git add a.txt && git commit -q -m \"First commit\" && git log --format=%H",
      "output": "455ff24700b75aee43c4dc12fdd7e34c7b1574143da22fa86233c87d4de84743"
    },
    {
      "cmd": "git repo info object.format",
      "output": "object.format=sha256"
    },
    {
      "comment": "SHA-1 and SHA-256 repositories cannot exchange objects yet",
      "cmd": "git push ~/server/status-page.git main:refs/heads/sha256-test",
      "output": "fatal: the receiving end does not support this repository's hash algorithm\nfatal: the remote end hung up unexpectedly"
    },
    {
      "comment": "back to the project",
      "cmd": "cd ~/projects/status-page && rm -rf ~/sha256-demo"
    }
  ]
}
```

The two formats cannot exchange commits yet: Git's work on converting between them is still in progress, so a SHA-256 repository can only push to and fetch from other SHA-256 repositories. Hosting support is uneven. Forgejo and Codeberg support SHA-256 repositories, GitLab has offered them as an experiment since 2024 ([GitLab's announcement](https://about.gitlab.com/blog/gitlab-now-supports-sha256-repositories/)), and GitHub does not offer them as of October 2026 ([the open community discussion](https://github.com/orgs/community/discussions/12490)). For a project that lives on GitHub, stay with SHA-1 for now.

**Reftable** is a new storage format for refs: a short stack of binary tables (listed in `tables.list`) instead of one file per ref plus `packed-refs`. It is faster with many refs, atomic when several refs change at once, and handles branch names that differ only in case on Windows and macOS. Git 3.0 makes it the default too. You can create a repository with `--ref-format=reftable`, or convert one:

```terminal
{
  "title": "convert a clone to reftable",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git clone -q ~/projects/status-page /tmp/reftable-demo && cd /tmp/reftable-demo"
    },
    {
      "cmd": "git refs migrate --ref-format=reftable && git repo info references.format && ls .git/reftable",
      "output": "references.format=reftable\n0x000000000001-0x000000000003-d5e697c0.ref\ntables.list"
    },
    {
      "cmd": "git log --oneline -1 && git branch -a",
      "output": "ef8c595 Add an example environment file\n* main\n  remotes/origin/HEAD -> origin/main\n  remotes/origin/main\n  remotes/origin/release/0.2"
    },
    {
      "cmd": "cd ~/projects/status-page && rm -rf /tmp/reftable-demo"
    }
  ]
}
```

Everything works as before; only tools that read `.git/refs` files directly (instead of running `git rev-parse` or `git for-each-ref`) notice the difference.

## Worktrees: Several Branches Checked Out at Once

Switching branches changes the files in your one working tree. A **worktree** is a second (or third) working tree attached to the same repository, with a different branch checked out. You can review a colleague's branch, run a long test suite on one branch while you edit another, or let several coding agents work on separate branches of one clone, without stashing or a second clone:

```terminal
{
  "title": "a second worktree for a quick fix",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git worktree add -b docs/readme-runbook ../status-page-docs main",
      "output": "Preparing worktree (new branch 'docs/readme-runbook')\nHEAD is now at ef8c595 Add an example environment file"
    },
    {
      "cmd": "git worktree list",
      "output": "/home/dev/projects/status-page      ef8c595 [main]\n/home/dev/projects/status-page-docs ef8c595 [docs/readme-runbook]"
    },
    {
      "cmd": "cd ../status-page-docs && printf '%s\\n' '- `docs/runbook.md`: what to do when the page is wrong' >> README.md && git commit -q -am \"List the runbook in the README\" && git log --oneline -1",
      "output": "services.txt: OK\nd8c98d9 List the runbook in the README"
    },
    {
      "comment": "a branch can be checked out in only one worktree at a time",
      "cmd": "git switch main",
      "output": "fatal: 'main' is already used by worktree at '/home/dev/projects/status-page'"
    },
    {
      "cmd": "cd ~/projects/status-page && git merge --ff-only docs/readme-runbook && git worktree remove ../status-page-docs && git branch -d docs/readme-runbook && git push -q",
      "output": "Updating ef8c595..d8c98d9\nFast-forward\n README.md | 1 +\n 1 file changed, 1 insertion(+)\nDeleted branch docs/readme-runbook (was d8c98d9)."
    }
  ]
}
```

All worktrees share the objects, branches, stashes and configuration (the `services.txt` hook ran in the second worktree too), so a commit in one is visible in the others at once. Each has its own `HEAD`, index and files. `git worktree remove` deletes the folder; if you delete it by hand, `git worktree prune` cleans up the record.

## Work with Large Repositories

When a repository has years of history or thousands of files, three features cut what you download and check out. Hosting services enable the server side for you; for a plain bare repository, allow filters once:

```terminal
{
  "title": "let the server accept partial clones",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git -C ~/server/status-page.git config set uploadpack.allowFilter true"
    }
  ]
}
```

### Partial clone and sparse checkout

A **partial clone** with `--filter=blob:none` downloads all commits and trees but no file contents; Git fetches each file's content the first time it needs it. **Sparse checkout** limits the working tree to the directories you name. Together they give you a small, fast clone of a big repository:

```terminal
{
  "title": "a partial, sparse clone",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git clone -q --filter=blob:none --sparse \"file://$HOME/server/status-page.git\" /tmp/partial && cd /tmp/partial"
    },
    {
      "cmd": "ls && git sparse-checkout list",
      "output": "README.md\nservices.txt\nstyle.css\ntemplate.html"
    },
    {
      "comment": "file contents not downloaded yet (blobs marked ? are missing)",
      "cmd": "git rev-list --objects --all --missing=print | grep -c \"^?\"",
      "output": "44"
    },
    {
      "cmd": "git sparse-checkout set docs && ls docs",
      "output": "alerts.md\nrunbook.md"
    },
    {
      "cmd": "git rev-list --objects --all --missing=print | grep -c \"^?\"",
      "output": "42"
    },
    {
      "comment": "an old file version is fetched on demand",
      "cmd": "git show v0.1.0:services.txt | head -2",
      "output": "# name  URL\napi     https://api.example.com/health"
    },
    {
      "cmd": "cd ~/projects/status-page && rm -rf /tmp/partial"
    }
  ]
}
```

`--sparse` starts with only the files at the top level (in **cone mode**, the default, you list directories). `git sparse-checkout set docs` added the `docs` directory and fetched just the blobs it needed. History commands still see every commit; only file contents arrive lazily. `git sparse-checkout disable` brings back the full working tree, and Git 2.52's `git sparse-checkout clean` removes files left behind outside the chosen directories (preview with `--dry-run`, then delete with `-f`).

| Clone                      | Downloads                                      | Good for                                         |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `--filter=blob:none`       | All commits and trees; file contents on demand | Daily work in big repositories                   |
| `--filter=tree:0`          | All commits; trees and contents on demand      | CI jobs that build one commit and need `git log` |
| `--depth=1`                | One commit with its files                      | CI jobs that only build; no history              |
| `--sparse` (with a filter) | Only the directories you choose                | Monorepos where you work in a few directories    |

Partial clones need a connection to the remote whenever Git fetches missing content, for example for `git log -p` over old commits. `git backfill` (Git 2.49+, experimental) downloads missing blobs in batches: by default those reachable from `HEAD`, and in a sparse checkout only the ones inside your directories (`--no-sparse` lifts that; since Git 2.54 it also takes a revision range).

For very large repositories, the `scalar` command that ships with Git sets all of this up in one step (`scalar clone <url>`), including background maintenance and a file system monitor. The built-in **fsmonitor** (`git config core.fsmonitor true`) makes `git status` fast in big working trees by asking the operating system which files changed instead of scanning them all; it has existed on macOS and Windows for years and came to Linux in Git 2.55.

## Reuse Conflict Resolutions with rerere

**rerere** ("reuse recorded resolution") remembers how you resolved a conflict and applies the same resolution when the same conflict comes back: when you rebase a long-running branch again, redo a merge, or test-merge branches before the real merge. It is off by default; [Part 9](/guides/introduction-to-git/09-best-practices#h2-settings-and-aliases-worth-having) turned it on with `rerere.enabled true`. Set up a conflict in the page title:

```terminal
{
  "title": "a conflict, resolved once",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -q -c feature/title && sed -i 's|<title>.*</title>|<title>Example Team status</title>|' template.html && git commit -q -am \"Shorten the page title\" && git switch -q main",
      "output": "services.txt: OK"
    },
    {
      "cmd": "sed -i 's|<title>.*</title>|<title>Service status \\| Example Team</title>|' template.html && git commit -q -am \"Use a pipe in the page title\"",
      "output": "services.txt: OK"
    },
    {
      "cmd": "git merge feature/title",
      "output": "Auto-merging template.html\nCONFLICT (content): Merge conflict in template.html\nRecorded preimage for 'template.html'\nAutomatic merge failed; fix conflicts and then commit the result."
    },
    {
      "comment": "resolve it in the editor"
    },
    {
      "cmd": "git add --resolved && git commit -q --no-edit && git log --oneline -1",
      "output": "services.txt: OK\nRecorded resolution for 'template.html'.\n7229418 Merge branch 'feature/title'"
    }
  ]
}
```

"Recorded preimage" means rerere saved the conflict. When you committed, it also saved your resolution. Now undo the merge and do it again, as you would when a rebase or a test merge brings back the same conflict:

```terminal
{
  "title": "the same conflict again",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git reset -q --hard HEAD~1"
    },
    {
      "cmd": "git merge feature/title",
      "output": "Auto-merging template.html\nCONFLICT (content): Merge conflict in template.html\nResolved 'template.html' using previous resolution.\nAutomatic merge failed; fix conflicts and then commit the result."
    },
    {
      "cmd": "grep -n \"<title>\" template.html && git status --short",
      "output": "5:    <title>Example Team service status</title>\nUU template.html"
    },
    {
      "cmd": "git add --resolved && git commit -q --no-edit && git branch -d feature/title && git push -q",
      "output": "services.txt: OK\nDeleted branch feature/title (was f83967c)."
    }
  ]
}
```

Git still stops (you should check its work), but the file already contains your earlier resolution. `rerere.autoUpdate true` also stages it. `git rerere forget <path>` deletes a recorded resolution that was wrong, and `git rerere status` shows what rerere is tracking.

## Submodules and Subtrees

Sometimes a project needs code from another repository: a shared theme, a library you cannot install as a package, configuration shared by several services. Git has two ways to include it.

### Submodules: a pointer to a commit in another repository

A **submodule** is a repository inside your repository. Yours records only its URL (in `.gitmodules`) and the exact commit to use. The team has a separate `brand` repository with shared colors:

```terminal
{
  "title": "the brand repository, with its own bare \"server\" copy",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git init -q ~/brand && cd ~/brand && echo ':root { --brand: #0b6e4f; }' > colors.css && git add colors.css && git commit -q -m \"Add the brand color\""
    },
    {
      "cmd": "git init -q --bare ~/server/brand.git && git push -q ~/server/brand.git main && cd ~/projects/status-page"
    }
  ]
}
```

```terminal
{
  "title": "add a submodule",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git submodule add ~/server/brand.git vendor/brand",
      "output": "Cloning into '/home/dev/projects/status-page/vendor/brand'...\nfatal: transport 'file' not allowed\nfatal: clone of '/home/dev/server/brand.git' into submodule path '/home/dev/projects/status-page/vendor/brand' failed"
    },
    {
      "cmd": "git -c protocol.file.allow=always submodule add ~/server/brand.git vendor/brand",
      "output": "Cloning into '/home/dev/projects/status-page/vendor/brand'...\ndone."
    },
    {
      "cmd": "cat .gitmodules && git status --short",
      "output": "[submodule \"vendor/brand\"]\n\tpath = vendor/brand\n\turl = /home/dev/server/brand.git\nA  .gitmodules\nA  vendor/brand"
    },
    {
      "cmd": "git diff --cached --submodule && git commit -q -m \"Add the brand repository as a submodule\" && git push -q",
      "output": "diff --git a/.gitmodules b/.gitmodules\nnew file mode 100644\nindex 0000000..6cf9960\n--- /dev/null\n+++ b/.gitmodules\n@@ -0,0 +1,3 @@\n+[submodule \"vendor/brand\"]\n+\tpath = vendor/brand\n+\turl = /home/dev/server/brand.git\nSubmodule vendor/brand 0000000...72fc2de (new submodule)\nservices.txt: OK"
    }
  ]
}
```

The first attempt failed on purpose: since Git 2.38.1, submodules may not be cloned from local paths unless you allow it, because a malicious repository could otherwise read files from your disk. With HTTPS or SSH URLs, which is what you use in real projects, the `-c protocol.file.allow=always` is not needed.

A plain `git clone` gives you an empty `vendor/brand` directory. Clone with the submodules, or initialize them afterwards:

```terminal
{
  "title": "clone a repository with submodules",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git -c protocol.file.allow=always clone -q --recurse-submodules ~/server/status-page.git /tmp/with-submodules"
    },
    {
      "cmd": "git -C /tmp/with-submodules submodule status",
      "output": " 72fc2de35cdbc095282334f9ad6388bd4fcfbbca vendor/brand (heads/main)"
    },
    {
      "cmd": "rm -rf /tmp/with-submodules"
    }
  ]
}
```

For a clone that already exists: `git submodule update --init --recursive`. When the brand repository gets a new commit, nothing changes in your project until you move the pointer:

```terminal
{
  "title": "update the submodule to its newest commit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/brand && sed -i 's/#0b6e4f/#0a5c42/' colors.css && git commit -q -am \"Darken the brand color\" && git push -q ~/server/brand.git main && cd ~/projects/status-page"
    },
    {
      "cmd": "git -c protocol.file.allow=always submodule update --remote vendor/brand",
      "output": "From /home/dev/server/brand\n   72fc2de..df97f5f  main       -> origin/main\nSubmodule path 'vendor/brand': checked out 'df97f5f8162d85060410cd6cbef1f01fb2b1a838'"
    },
    {
      "cmd": "git status --short && git diff --submodule",
      "output": " M vendor/brand\nSubmodule vendor/brand 72fc2de..df97f5f:\n  > Darken the brand color"
    },
    {
      "cmd": "git commit -q -am \"Update the brand colors\" && git push -q",
      "output": "services.txt: OK"
    }
  ]
}
```

Submodule rules that save time:

- The submodule is checked out at a commit, in detached HEAD. To change its code, `cd` into it, switch to a branch, commit and push there, then commit the new pointer in the parent.
- `git config set --global submodule.recurse true` makes `pull`, `switch` and `checkout` update submodules automatically.
- Everyone who clones needs access to every submodule URL.
- Removing a submodule takes several steps ([remove a Git submodule](/posts/remove-git-submodule)).

### Subtrees: a copy of the other repository's files

`git subtree` copies another repository's files into a directory of yours, as normal files in normal commits. Nobody who clones needs to know about it. It ships in Git's `contrib` directory and is included in most packages:

```terminal
{
  "title": "the same with git subtree (in a scratch clone)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git clone -q ~/server/status-page.git /tmp/subtree-demo && cd /tmp/subtree-demo"
    },
    {
      "cmd": "git subtree add --prefix=vendor/brand-copy ~/server/brand.git main --squash",
      "output": "git fetch /home/dev/server/brand.git main\nFrom /home/dev/server/brand\n * branch            main       -> FETCH_HEAD\nAdded dir 'vendor/brand-copy'"
    },
    {
      "cmd": "ls vendor/brand-copy && git log --oneline -2",
      "output": "colors.css\nc2da2a1 Merge commit '1f6dc3ff62cb3271d99471204de070e3d15dfa9d' as 'vendor/brand-copy'\n1f6dc3f Squashed 'vendor/brand-copy/' content from commit df97f5f"
    },
    {
      "cmd": "cd ~/projects/status-page && rm -rf /tmp/subtree-demo"
    }
  ]
}
```

`git subtree pull --prefix=vendor/brand-copy <url> main --squash` brings in later changes, and `git subtree push` sends changes made in your copy back.

|                             | Submodule                                                 | Subtree                                               |
| --------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| What your repository stores | A URL and a commit hash                                   | The files themselves                                  |
| Cloning                     | Needs `--recurse-submodules` or an extra command          | Nothing special                                       |
| Pinning a version           | Exact, by commit                                          | By what you last pulled                               |
| Changing the shared code    | In the other repository, then update the pointer          | Directly, then `subtree push` if you want to share it |
| Good for                    | Large or separately released dependencies, strict pinning | Small shared code that you rarely update              |

If the other project publishes packages (npm, PyPI, Go modules, Helm charts, Terraform modules), use the package manager instead of either.

## Useful Attributes: Diff Drivers and Export Rules

Besides line endings ([Part 9](/guides/introduction-to-git/09-best-practices#h2-line-endings-and-gitattributes)), `.gitattributes` controls how Git treats paths:

| Attribute            | Effect                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export-ignore`      | Leave the path out of `git archive` (release tarballs)                                                                                                                             |
| `diff=<driver>`      | Diff the file through a converter that prints text, for example `*.docx diff=docx` with `git config diff.docx.textconv "pandoc --to=plain"`                                        |
| `-diff`              | Show "Binary files differ" instead of a diff (for minified or generated files)                                                                                                     |
| `merge=ours`         | Keep your version when both sides changed the file and Git has to merge its content (needs `git config merge.ours.driver true`); changes made only on the other side still come in |
| `linguist-generated` | GitHub hides the file in pull request diffs and language statistics                                                                                                                |
| `filter=lfs`         | Set by `git lfs track` ([Part 9](/guides/introduction-to-git/09-best-practices#h2-large-files))                                                                                    |

`git check-attr -a <path>` shows the attributes that apply to a file.

## Archives and Bundles

`git archive` writes the files of a commit or tag as a `tar` or `zip` file, without `.git`: the usual way to make a source release. Leave the docs out of release archives first:

```terminal
{
  "title": "a release archive",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '\\n# Leave these out of git archive\\n/docs export-ignore\\n.gitattributes export-ignore\\n' >> .gitattributes && git commit -q -am \"Leave docs out of release archives\"",
      "output": "services.txt: OK"
    },
    {
      "cmd": "git archive --format=tar.gz --prefix=status-page/ -o /tmp/status-page.tar.gz HEAD && tar -tzf /tmp/status-page.tar.gz",
      "output": "status-page/\nstatus-page/.env.example\nstatus-page/.gitignore\nstatus-page/.gitmodules\nstatus-page/README.md\nstatus-page/scripts/\nstatus-page/scripts/build.sh\nstatus-page/scripts/changes.sh\nstatus-page/scripts/check.sh\nstatus-page/services.txt\nstatus-page/style.css\nstatus-page/template.html\nstatus-page/vendor/\nstatus-page/vendor/brand/"
    }
  ]
}
```

The submodule directory is in the archive but empty: `git archive` does not include submodule contents.

A **bundle** is a whole repository (or part of one) in a single file, which you can clone, fetch from or verify like a remote. It moves history where there is no network between the two machines, or makes an offline backup:

```terminal
{
  "title": "a bundle",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git bundle create /tmp/status-page.bundle --all"
    },
    {
      "cmd": "git bundle verify /tmp/status-page.bundle",
      "output": "/tmp/status-page.bundle is okay\nThe bundle contains these 10 refs:\n534dc13a68985de3cc9b0be0a0a2f864b88773b2 refs/heads/main\n298425e7d7d02e32abc8c390a1594b7a3e7107a7 refs/heads/release/0.2\n8d2eebfe3849533554fa6e7169815a8e9a697961 refs/remotes/origin/HEAD\n8d2eebfe3849533554fa6e7169815a8e9a697961 refs/remotes/origin/main\n298425e7d7d02e32abc8c390a1594b7a3e7107a7 refs/remotes/origin/release/0.2\ncb1c6ab47d2cc8be4c9b82ebbb6341c40c9dd3fb refs/tags/v0.1.0\nabc33e4c51eb358f6c65e442319e715f7029bb26 refs/tags/v0.2.0\n27332c4df0da893f3632d12d68e41aef89d9d249 refs/tags/v0.2.1\n20198d6f569c5387606616b2a2c8e04b08468af4 refs/tags/v0.3.0\n534dc13a68985de3cc9b0be0a0a2f864b88773b2 HEAD\nThe bundle records a complete history.\nThe bundle uses this hash algorithm: sha1"
    },
    {
      "cmd": "git clone -q /tmp/status-page.bundle /tmp/from-bundle && git -C /tmp/from-bundle log --oneline -2",
      "output": "534dc13 Leave docs out of release archives\n8d2eebf Update the brand colors"
    },
    {
      "cmd": "rm -rf /tmp/from-bundle /tmp/status-page.bundle /tmp/status-page.tar.gz && git push -q"
    }
  ]
}
```

## Script Git Safely

Commands such as `git status` and `git branch` are meant for people, and their output can change between versions. In scripts and CI, use the **plumbing** commands and machine-readable formats, which Git keeps stable:

```terminal
{
  "title": "stable output for scripts",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git status --porcelain=v2 --branch",
      "output": "# branch.oid 534dc13a68985de3cc9b0be0a0a2f864b88773b2\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +0 -0"
    },
    {
      "cmd": "git rev-parse --show-toplevel && git rev-parse --abbrev-ref HEAD",
      "output": "/home/dev/projects/status-page\nmain"
    },
    {
      "comment": "files changed since a tag, for example to decide which CI jobs to run",
      "cmd": "git diff --name-only v0.2.0...HEAD -- scripts",
      "output": "scripts/changes.sh\nscripts/check.sh"
    },
    {
      "cmd": "git for-each-ref --sort=-creatordate --format=\"%(refname:short) %(creatordate:short)\" refs/tags",
      "output": "v0.3.0 2026-10-21\nv0.2.1 2026-10-19\nv0.2.0 2026-10-15\nv0.1.0 2026-10-13"
    }
  ]
}
```

- `--porcelain` output (`git status`, `git worktree list`) is a stable format. Add `-z` to it, and to `git ls-files` and `git diff --name-only`, to separate entries with NUL bytes, so file names with spaces or newlines cannot break your parsing. `git blame --porcelain` has its own stable, line-based format.
- `git rev-parse`, `git for-each-ref`, `git ls-files`, `git cat-file --batch` and `git merge-base --is-ancestor A B` (exit code 0 if A is an ancestor of B) answer most questions without parsing human output.
- In CI, a shallow checkout (`fetch-depth: 1` in GitHub Actions) has no history: `git describe`, `git diff origin/main...HEAD` and changelog tools fail or give wrong results. Fetch the history you need, or use a partial clone (`--filter=blob:none`), which is fast and complete. The CI/CD guide's section on [faster and cheaper runs](/guides/introduction-to-cicd/08-monitoring-debugging-and-optimization#h2-make-runs-faster-and-cheaper) covers checkout depth in practice.

### Refspecs: how fetch and push map branches

When you clone, Git writes a **refspec** into the remote's configuration. It maps branches on the remote to your remote-tracking branches:

```terminal
{
  "title": "the default fetch refspec",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config get --all remote.origin.fetch",
      "output": "+refs/heads/*:refs/remotes/origin/*"
    }
  ]
}
```

`+refs/heads/*:refs/remotes/origin/*` means "every branch on the remote, stored as `origin/<name>` here; `+` allows non-fast-forward updates". You can add more. For example, GitHub publishes every pull request as `refs/pull/<number>/head`, and this extra line fetches them all as `origin/pr/<number>`:

```bash
git config set --append remote.origin.fetch "+refs/pull/*/head:refs/remotes/origin/pr/*"
git fetch origin
git switch --detach origin/pr/123
```

Push takes refspecs too: `git push origin HEAD:refs/heads/test` pushes your current branch as `test`, and `git push origin :old-branch` (an empty source) deletes `old-branch`.

## Common Mistakes

- **A submodule pointer committed without pushing the submodule commit.** Others then cannot check out the commit your project points to. Push the submodule first (`git push --recurse-submodules=check` refuses otherwise).
- **Deleting a worktree folder by hand.** Use `git worktree remove`, or run `git worktree prune` afterwards.
- **Shallow clones where history matters.** Use a partial clone instead.
- **Parsing `git status` or `git branch` output in scripts.** Use `--porcelain` formats and plumbing commands.
- **SHA-256 for a project that will move to GitHub.** It cannot be pushed there yet.

## Summary

- Git stores blobs, trees, commits and tags, named by the hash of their content; refs are names for hashes.
- SHA-256 and reftable work today and become defaults in Git 3.0, but SHA-256 repositories cannot exchange commits with SHA-1 ones.
- Worktrees give you several branches checked out from one repository.
- Partial clones, sparse checkout and `scalar` make large repositories manageable.
- rerere remembers conflict resolutions; submodules pin another repository's commit, subtrees copy its files.
- `git archive`, bundles, porcelain formats and refspecs cover releases, offline transfer and scripting.

## Where to Go Next

You have used every part of the Git workflow on one project: from `git init` to a team with pull requests, signed releases, hooks and a history you can search. Next steps:

- Put the checks into a pipeline with the [Introduction to CI/CD](/guides/introduction-to-cicd) guide.
- Test yourself with the [Git Command Quiz](/quizzes/git-quiz), the [Git Fundamentals flashcards](/flashcards/git-fundamentals) and the [Git Concepts simulator](/games/git-concepts-simulator).
- Practice for interviews: [Git staging and committing](/interview-questions/junior/git-basics), [rebase vs merge](/interview-questions/junior/git-rebase-vs-merge).
- The free [Introduction to Git and GitHub eBook](https://github.com/bobbyiliev/introduction-to-git-and-github-ebook) covers the basics again from another angle.

## Keep Learning

- [A repo per agent: what Cloudflare Artifacts changes about Git](/posts/cloudflare-artifacts-repo-per-agent)
- [Clone a specific folder of a repository](/posts/clone-git-repo-specific-folder)
- [A poisoned .git/config runs code on git status](/posts/poisoned-git-config-git-status-runs-code)
