---
title: 'A Poisoned .git/config Runs Code on git status. We Tested Which Commands and Copies Carry It'
excerpt: 'On October 2 GitLab disclosed ConfigPoisoning: a repo that brings its own .git/config makes an AI coding tool run attacker commands when it shows a diff. We ran the same trick against plain git 2.39 and 2.55. A bare git status ran repo-supplied programs, the usual safe diff flags missed the clean filter, git 2.54 config hooks walked past core.hooksPath=/dev/null, a clone was clean but a cached workspace was not, and GitHub-hosted runners switch off the ownership check that would stop it.'
category:
  name: 'Git'
  slug: 'git'
date: '2026-10-06'
publishedAt: '2026-10-06T09:00:00Z'
updatedAt: '2026-10-06T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Git
  - Security
  - CI/CD
  - AI Agents
  - Supply Chain Security
  - DevSecOps
---

On October 2, GitLab's Threat Research Group published [ConfigPoisoning](https://about.gitlab.com/blog/deepseek-reasonix-vulnerability-discovered/) (CVE-2026-102437), a command execution bug in DeepSeek-Reasonix Studio, a git client built for working next to AI coding assistants. The tool was careful. It neutralized `core.fsmonitor` on every git call and added `--no-ext-diff --no-textconv` to every diff. It still ran attacker code when you opened a diff, because a clean filter named in `.gitattributes` runs anyway. GitLab says "the same pattern is present in several other widely used agent tools, currently under coordinated disclosure."

It is the second disclosure of this kind in five weeks. On September 1, Manifold Security published [GitSpawn](https://www.manifold.security/blog/ai-coding-agents-git-hijack): eight findings across seven coding agents (Claude Code, Codex, Cursor, goose, Qwen Code, Grok Build and Hermes Agent) where repository-controlled git settings ran commands outside the agent's sandbox. Most of the detailed cases used a `core.fsmonitor` line in the repo's own `.git/config`; in Claude Code's case, the start-up `git status` ran it while the workspace-trust prompt was still waiting for an answer.

Both reports are about agents, but the mechanism is plain git, and git also runs in your CI jobs, bots and editor plugins. So we tested git itself: which everyday commands run programs that a repo's `.git/config` or hooks point at, whether the usual hardening flags stop them, and which ways of moving a repo between machines carry that config along.

## TLDR

- A bare `git status` ran repo-supplied programs: `core.fsmonitor`, a `post-index-change` hook from `.git/hooks` or `core.hooksPath`, and on git 2.55 a hook defined in config.
- `git diff --no-ext-diff --no-textconv` still ran the clean filter (and a `filter.<name>.process` helper). Overrides only stopped a filter when we named its driver.
- On git 2.55, `-c core.hooksPath=/dev/null` did not stop a hook defined in config (`hook.<name>.command`, new in git 2.54). Adding `-c hook.<event>.enabled=false` did, in our fixture.
- `git clone` and cloning from a bundle never brought the config or hooks. A `tar` of the working copy, which is what a workspace cache or artifact is, always did.
- git's ownership check (`safe.directory`) refused a copy owned by another user on our Raspberry Pi. On GitHub-hosted runners it never fired, because the images set `safe.directory = *`.
- The scripts, the recorded results and a read-only audit are in the repo below.

## Prerequisites

- git and bash, to run the scripts
- A machine where you can create throwaway repos: every "payload" in the tests only appends a line to a log file

## Why a repo can make git run programs at all

Some git settings are commands, not values. `core.fsmonitor` names a helper that tells git which files changed, so big repos do not stat every file. A filter driver (`filter.<name>.clean`, `smudge` or the long-running `process`) rewrites file content on the way into and out of the index; that is how Git LFS works. `diff.external` and `diff.<name>.textconv` replace or preprocess diffs. Hooks are executables in `.git/hooks` or in the directory `core.hooksPath` points to, and since [git 2.54](https://github.com/git/git/blob/master/Documentation/RelNotes/2.54.0.adoc) a hook can also be a command defined in config (`hook.<name>.command` plus `hook.<name>.event`, see [git-hook](https://git-scm.com/docs/git-hook)).

Git reads all of these from the repository's own `.git/config` and hooks directory. That is documented, intended behaviour for a repo you created. The trouble starts when `.git` came from someone else.

A normal clone protects you: git does not transfer `.git/config` or hooks over a fetch. `.gitattributes` does travel, because it is a tracked file, but a filter named there does nothing unless config defines it. So the question for a DevOps team is not "can a repo do this", it is "where do we copy a `.git` directory instead of cloning it". GitLab's report lists the answers: "an archive, a synced folder, a CI cache, or a devcontainer build", plus a compromised agent that writes the config into a repo you cloned normally.

## The test

The repo builds small throwaway repositories. Each has one committed file and the same file with a line appended, so there is always a change to show, and a `.git/config` (or hooks directory) that points one setting at a script whose only job is to log that it ran and pass content through:

```github
https://github.com/The-DevOps-Daily/git-config-exec-check
```

We tested eleven settings: `core.fsmonitor`; clean, smudge and process filters; a `textconv` driver; `diff.external`; hooks in `.git/hooks`; hooks via `core.hooksPath`; a hook defined in config; `core.sshCommand`; and `core.pager`. For each one, `scripts/matrix.sh` copies the repo fresh, runs 15 commands that tools and people run all the time, and records the exit code and what ran.

We ran it on a Raspberry Pi with git 2.39.5, and on GitHub-hosted `ubuntu-latest` and `macos-latest` runners with git 2.55.0. Ubuntu and macOS were identical. Git 2.39.5 ran the same programs except for the config-hook column, which it does not support. This is the git 2.55.0 table:

| Command                                | fsmonitor | clean | process | smudge | textconv | diff.external | hooks dir                                                         | config hook | sshCommand |
| -------------------------------------- | --------- | ----- | ------- | ------ | -------- | ------------- | ----------------------------------------------------------------- | ----------- | ---------- |
| `git status`                           | runs      |       |         |        |          |               | post-index-change                                                 | runs        |            |
| `git status --porcelain`               | runs      |       |         |        |          |               | post-index-change                                                 | runs        |            |
| `git diff`                             | runs      | runs  | runs    |        | runs     | runs          |                                                                   |             |            |
| `git diff --no-ext-diff --no-textconv` | runs      | runs  | runs    |        |          |               |                                                                   |             |            |
| `git log -p -1`                        |           |       |         |        | runs     |               |                                                                   |             |            |
| `git log --oneline -1`                 |           |       |         |        |          |               |                                                                   |             |            |
| `git show HEAD`                        |           |       |         |        | runs     |               |                                                                   |             |            |
| `git blame notes.txt`                  | runs      | runs  | runs    |        | runs     |               |                                                                   |             |            |
| `git ls-files`                         | runs      |       |         |        |          |               |                                                                   |             |            |
| `git rev-parse HEAD`                   |           |       |         |        |          |               |                                                                   |             |            |
| `git add -A`                           | runs      | runs  | runs    |        |          |               | post-index-change                                                 | runs        |            |
| `git commit -qam wip`                  | runs      | runs  | runs    |        |          |               | post-commit, post-index-change, pre-commit, reference-transaction | runs        |            |
| `git stash`                            | runs      | runs  | runs    | runs   |          |               | post-index-change, reference-transaction                          | runs        |            |
| `git checkout -- notes.txt`            | runs      |       | runs    | runs   |          |               | post-checkout, post-index-change                                  | runs        |            |
| `git fetch origin (fails)`             | runs      |       |         |        |          |               |                                                                   |             | runs       |

How to read it:

- A blank cell means "not observed with this fixture", not "can never run". Because our modified file is longer than the committed one, git can see the change from the file size without filtering it. With a same-size edit or a touched file, `git status` may need to compare content, and then filters can run too.
- `hooks dir` was identical for `.git/hooks` and `core.hooksPath`, so they share a column. `core.pager` never ran, because none of the commands had a terminal; agents and CI jobs usually do not either.
- Our `process` helper does not speak git's filter protocol. Git started it either way; git 2.39.5 then exited with 128, and git 2.55.0 carried on and exited 0.
- Only the `sshCommand` fixture has a remote, and its fetch fails on purpose. A successful fetch can fire more hooks than this row shows.

Three rows deserve a second look.

**`git status` is not read-only.** It refreshes the index, and refreshing the index is when git asks the fsmonitor helper what changed. When the refresh writes the index back, git fires the `post-index-change` hook, from the hooks directory and from config. All of that happened on a repo with one modified file.

**`git fetch` ran fsmonitor before it contacted the remote.** In the fsmonitor fixture there is no remote at all. `scripts/trace-fetch.sh` shows git starting the helper twice (asking for protocol version 2, then falling back to version 1 after our helper exited non-zero) and only then failing to find `origin`:

```text
git 2.39.5 on Linux aarch64
run-command.c:655       trace: run_command: cd <tmp>/r; '<tmp>/hook.sh fsmonitor' 2 1791269076974045040
run-command.c:655       trace: run_command: cd <tmp>/r; '<tmp>/hook.sh fsmonitor' 1 1791269076974045040
run-command.c:655       trace: run_command: unset GIT_PREFIX; GIT_PROTOCOL=version=2 'git-upload-pack '\''origin'\'''
fatal: 'origin' does not appear to be a git repository
fatal: Could not read from remote repository.
```

**The diff flags that hardened tools add are aimed at the wrong half.** `--no-ext-diff` and `--no-textconv` stop the programs that render a diff. The clean filter runs earlier, when git turns the working-tree file into a blob to compare. That is the GitLab finding, and plain git 2.55 behaves the same way. Diffs between two commits (`git log -p`, `git show`) never ran a filter, because no working-tree file is involved.

## Do the usual flags help?

`scripts/overrides.sh` builds one repo with fsmonitor, a hook in `.git/hooks`, a hook defined in config, `diff.external`, a `textconv` driver and a clean filter. Each row starts from a fresh copy, runs `git status` and `git diff`, and adds more protection. On git 2.55.0:

```text
git 2.55.0 on Linux x86_64
plain                                                    exit 0/0  ran: diff-external,filter-clean,fsmonitor,hook:config,hook:dir
diff --no-ext-diff --no-textconv                         exit 0/0  ran: filter-clean,fsmonitor,hook:config,hook:dir
+ -c core.fsmonitor=false -c core.hooksPath=/dev/null    exit 0/0  ran: filter-clean,hook:config
+ -c filter.lab.clean= (needs the driver name)           exit 0/0  ran: hook:config
+ -c hook.post-index-change.enabled=false (per event)    exit 0/0  ran:
```

Read it row by row:

1. With no protection, five programs ran: fsmonitor, the hooks-directory hook, the config hook, the clean filter and `diff.external`. The `textconv` driver did not, because `diff.external` replaces the whole diff; the matrix above is where `textconv` shows up, and where `--no-textconv` stops it.
2. The diff flags stopped `diff.external`, and nothing else.
3. `core.fsmonitor=false` and `core.hooksPath=/dev/null` are what a careful wrapper adds. They stopped fsmonitor and the hooks-directory hook, but not the hook defined in config, which is not looked up in a hooks directory. The clean filter also still ran.
4. Clearing the clean filter worked only because we knew the driver was called `lab`. An attacker picks the name, and `.gitattributes` can name a different driver for each file pattern. The same goes for `smudge` and `process`, which a wrapper has to clear too.
5. `hook.<event>.enabled=false`, which the git 2.55 [git-hook documentation](https://git-scm.com/docs/git-hook) describes as a switch for every hook of one event, stopped the config hook in this fixture without knowing its name. We only tested it together with `core.hooksPath=/dev/null`, so keep both. It is also per event, so a wrapper has to list every event its commands can fire.

On git 2.39.5 the same script gave the same first four rows, minus the config hook, which that version does not know about.

## Which copies bring the config along

`scripts/delivery.sh` builds one repo with `core.fsmonitor`, a clean filter and a `post-index-change` hook. All three call a helper stored inside `.git` by relative path, so the payload travels with any copy that includes `.git`. It copies the repo four ways, records anything that ran during the copy, and then runs `git status` and `git diff` in each copy. On the Pi:

```text
git 2.39.5 on Linux aarch64
safe.directory already set on this machine: no
original repo                          copy ran: -        then ran: filter-clean,fsmonitor,hook:post-index-change  exit 0/0
git clone                              copy ran: nothing  then ran: nothing                                        exit 0/0
git clone from a bundle                copy ran: nothing  then ran: nothing                                        exit 0/0
tar of the working copy                copy ran: nothing  then ran: filter-clean,fsmonitor,hook:post-index-change  exit 0/0
same tar, owned by another user        copy ran: -        then ran: nothing                                        exit 128/129 fatal: detected dubious ownership in repository at '/tmp/tmp.S42grY0m9P/other-owner'
  ...with no system or global config   copy ran: -        then ran: nothing                                        exit 128/129 fatal: detected dubious ownership in repository at '/tmp/tmp.S42grY0m9P/other-owner'
  ...with -c safe.directory=*          copy ran: -        then ran: filter-clean,fsmonitor,hook:post-index-change  exit 0/0
```

The clone and the bundle were clean, both during the copy and afterwards. The tar was not, and a tar of the working copy is what most "cache the workspace" setups produce: an `actions/cache` or GitLab `cache:` entry that includes `.git`, a build artifact someone zipped from the job directory, a devcontainer volume, a folder synced between machines. Once that copy lands, the next tool to run `git status` in it runs the repo's programs.

Here is that as a terminal session, from `scripts/demo-restored-workspace.sh`: a workspace restored from a tarball, two git commands, and our audit script at the end. The helper sits inside `.git`, so it arrived with the tarball, and the script empties `ran.log` before each git command.

```terminal
{
  "title": "restored workspace, git 2.39.5",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "a workspace restored from a cache tarball, not cloned"
    },
    {
      "cmd": "git status --short",
      "output": " M notes.txt"
    },
    {
      "cmd": "cat ../ran.log",
      "output": "ran: fsmonitor\nran: fsmonitor"
    },
    {
      "cmd": "git diff --no-ext-diff --no-textconv --stat",
      "output": " notes.txt | 1 +\n 1 file changed, 1 insertion(+)"
    },
    {
      "cmd": "cat ../ran.log",
      "output": "ran: fsmonitor\nran: fsmonitor\nran: filter-clean\nran: filter-clean"
    },
    {
      "cmd": "audit.sh .; echo \"exit $?\"",
      "output": "Repo config in . can run programs:\nfile:.git/config  core.fsmonitor    .git/lab-hook.sh fsmonitor\nfile:.git/config  filter.lab.clean  .git/lab-hook.sh filter-clean\nexit 1"
    }
  ]
}
```

## The ownership check, and the runners that turn it off

Since git 2.35.2 (the fix for [CVE-2022-24765](https://github.blog/open-source/git/git-security-vulnerability-announced/)), git refuses to work in a repository owned by another user unless that path is allowed by `safe.directory`. On the Pi, that check stopped the poisoned tar as soon as another user owned it.

On GitHub-hosted runners, the same step ran everything. The script prints where `safe.directory` comes from, and on the Ubuntu runner (image ubuntu24 20260927.320.1) it said:

```text
git 2.55.0 on Linux x86_64
safe.directory already set on this machine: system file:/etc/gitconfig *
original repo                          copy ran: -        then ran: filter-clean,fsmonitor,hook:post-index-change  exit 0/0
git clone                              copy ran: nothing  then ran: nothing                                        exit 0/0
git clone from a bundle                copy ran: nothing  then ran: nothing                                        exit 0/0
tar of the working copy                copy ran: nothing  then ran: filter-clean,fsmonitor,hook:post-index-change  exit 0/0
same tar, owned by another user        copy ran: -        then ran: filter-clean,fsmonitor,hook:post-index-change  exit 0/0
  ...with no system or global config   copy ran: -        then ran: nothing                                        exit 128/129 fatal: detected dubious ownership in repository at '/tmp/tmp.Y1kIjtRPwM/other-owner'
  ...with -c safe.directory=*          copy ran: -        then ran: filter-clean,fsmonitor,hook:post-index-change  exit 0/0
```

The Ubuntu image writes `directory = *` into `/etc/gitconfig`, and the macOS image (macos26 20260907.0351.1 in our run) adds it to the global config; you can see both in the [Ubuntu](https://github.com/actions/runner-images/blob/main/images/ubuntu/scripts/build/install-git.sh) and [macOS](https://github.com/actions/runner-images/blob/main/images/macos/scripts/build/install-git.sh) image scripts. The Ubuntu script's comment says why: git 2.35.2 "introduces security fix that breaks action\checkout". With system and global config switched off, git 2.55 refused the copy exactly like git 2.39 on the Pi, so the behaviour is git's and the wildcard is the image's.

Two caveats keep this in proportion. The ownership check only helps when the files belong to a different user; a cache that the job restores as itself passes the check with or without a wildcard. And a refusal stops git, it does not make the repository safe. Still, on those runners the ownership check is not part of your defence, so it comes down to whether you restore `.git` at all.

To see what your own runners and build containers do, print every entry with its scope and file. Git only honours `safe.directory` from system, global and command-line config, so a repo cannot allow itself. A `*` in any of those means the check is off for all paths, unless a later empty entry resets the list, and removing a global `*` does nothing if the system config still has one:

```bash
git --no-pager config --show-scope --show-origin --get-all safe.directory
```

## What to do

### Do not restore .git from a cache or artifact

Cache what is expensive to rebuild, not the repository. `.git` rarely needs caching: actions/checkout fetches a single commit by default, and a fetch never carries config or hooks. If you need full history for speed, cache a bundle (`git bundle create`) and clone from it; in our test, a bundle clone ran nothing.

This closes one route, not cache poisoning in general. A restored `node_modules` or provider directory can also contain code that runs, and GitHub's own [cache security guidance](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching) says to treat restored caches as untrusted input. Keep caches separated by trust level, so a pull request job cannot write what the main branch job restores.

Treat artifacts the same way. If a later job downloads an artifact that contains a `.git` directory and runs any git command inside it, that job trusts whoever produced the artifact.

### Audit before the first git command

When you cannot avoid a copied `.git` (a synced folder, a devcontainer volume, a repo an agent has had write access to), read its config before you run git in it. `git --no-pager config --list` reads config files without running any of the programs above; keep `--no-pager`, because a configured pager can run when the output goes to a terminal.

Our `scripts/audit.sh` wraps that. It lists repo-level keys whose value is a command, a hooks directory or an include (including `hook.<name>.command`, process filters, shell aliases and `pager.<cmd>`), plus executable hooks in the repo's hooks directory, and exits 0 (none), 1 (found) or 2 (it could not inspect the repo, for example because git refused it). `scripts/audit-selftest.sh` checks it against every fixture plus odd layouts, such as a driver name containing `=`, a symlinked hook, a linked worktree and an include outside `.git`, and confirms that auditing ran nothing. It is a detector for the settings it knows, not a safety certificate.

Run a copy you trust, kept outside the directory you are checking; a poisoned workspace can replace any script inside it. In CI, that means fetching the audit at a pinned commit before you restore anything:

```bash
# before restoring the cache: fetch the audit from a pinned commit, outside the workspace
curl -fsSL -o "$RUNNER_TEMP/audit.sh" \
  "https://raw.githubusercontent.com/The-DevOps-Daily/git-config-exec-check/<commit-sha>/scripts/audit.sh" || exit 1
# after restoring it
bash "$RUNNER_TEMP/audit.sh" "$GITHUB_WORKSPACE" || { echo "restored repo can run programs"; exit 1; }
```

Expect some findings on developer machines. `git lfs install --local` writes a filter driver into the repo config, and many teams use hooks on purpose. That is fine: the point is to see them before git runs them, in a place where you did not put them yourself.

### If you write tools that shell out to git

GitLab's advice is to override every relevant key on every call, or avoid git's filter and textconv machinery. From our results, for the commands a tool runs to read state (`status`, `diff`, `blame`, `log`), that means:

- Pass `-c core.fsmonitor=false -c core.hooksPath=/dev/null` on every call, including `git status`.
- On git 2.55, also pass `-c hook.<event>.enabled=false` for each event your commands can fire. Our table saw `pre-commit`, `post-commit`, `post-checkout`, `post-index-change` and `reference-transaction`.
- Add `--no-ext-diff --no-textconv` to diffs, and `--no-pager` to anything that might reach a terminal.
- For filters, read the config first and clear `clean`, `smudge` and `process` for every driver it defines, or use commit-to-commit diffs when they are enough.
- For `fetch` and `push`, the remote URL and `core.sshCommand` both come from the copied config. Set the transport yourself (for example `-c core.sshCommand=ssh` and an explicit URL) or do not let the tool talk to remotes from that copy.
- When the repo came from outside, run git as a user that does not own it, with no `safe.directory` wildcard in system or global config.

These cover what we tested. They are not a complete list of every setting git can turn into a command, which is why the audit and the "do not copy `.git`" advice come first.

If you use one of the agents named in the two reports, update it. The DeepSeek-Reasonix fix is Studio 2.21.0 and npm 1.39.3. Manifold's post has a table of fixed versions; four of its eight findings were still unpatched when it was published.

## What we did not test

- **Windows**, credential helpers and editors. Each of those needs a different trigger.
- **A fetch that succeeds**, and a process filter that speaks the protocol. Both can run more than our rows show.
- **Any specific agent.** These scripts test git. How a given agent calls git decides which rows of the table apply to it, and the two reports above are the place to look for that.
- **Every command and every state.** We picked 15 common commands and one kind of change. `git rev-parse` and `git log --oneline` ran nothing here; that is not a promise about other commands or other repo states, so run `matrix.sh` with the commands your tools use.

If you have read our posts on [pre-commit hook security](/posts/pre-commit-hooks-security-guide) or the [MCP design flaw](/posts/mcp-design-flaw-rce-supply-chain-risk), this is the same lesson from another side. The dangerous input is not always code you run on purpose. Sometimes it is the configuration of the tool you run, read from the directory you are standing in.
