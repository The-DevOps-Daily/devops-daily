---
title: 'Specify a Private SSH Key for Git, and Show or Change the Remote URL'
excerpt: 'Choose the SSH key Git uses with core.sshCommand, GIT_SSH_COMMAND or an ~/.ssh/config alias with IdentitiesOnly, and show or change the remote URL.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-09-28'
publishedAt: '2024-09-28T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - SSH
  - Remotes
  - Security
  - DevOps
---

Git does not choose an SSH key itself. It runs `ssh`, and `ssh` picks the key. So when you need a work key for one repository and a personal key for another, you tell `ssh` which key to use: for one command, for one repository, or for one host name. The host name is part of the remote URL, so the key and the URL are often one problem. This page covers both: how to choose the key, and how to show and change the URL a repository uses.

## TLDR

| Question                                   | Short answer                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Use a key for one command                  | `GIT_SSH_COMMAND='ssh -i ~/.ssh/work_ed25519 -o IdentitiesOnly=yes' git fetch`              |
| Use a key for one repository               | `git config core.sshCommand 'ssh -i ~/.ssh/work_ed25519 -o IdentitiesOnly=yes'`             |
| Use a key for a host or an account         | A `Host` alias in `~/.ssh/config` with `IdentityFile` and `IdentitiesOnly yes`              |
| Why `IdentitiesOnly`?                      | Without it, `ssh` can offer a key from the agent first, and you log in as the wrong account |
| Which URL was this repository cloned from? | `git remote get-url origin`, or `git remote -v` for all remotes                             |
| Change the remote URL                      | `git remote set-url origin <new-url>`                                                       |

## Prerequisites

- Git and OpenSSH. The commands work on Linux, macOS and Git for Windows. The tests on this page used Git 2.39 and OpenSSH 9.2.
- An SSH key that the hosting service knows. If you need a new one, see [create and test the key](#h2-how-do-i-create-and-test-an-ssh-key-for-git) below.

## How Do I Specify a Private SSH Key for Git?

Choose by scope:

- **One command:** set `GIT_SSH_COMMAND` in the environment.
- **One repository:** set `core.sshCommand` in the repository config.
- **One host or account:** add a `Host` entry to `~/.ssh/config`, and use that host name in the remote URL.

In all three, add `IdentitiesOnly`. The [section below](#h3-why-do-i-need-identitiesonly) explains why.

### Use a key for one command with GIT_SSH_COMMAND

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/work_ed25519 -o IdentitiesOnly=yes' \
  git clone git@github.com:acme/api.git
```

Git runs this command instead of plain `ssh`. The variable applies only to that one command. `export` it to use it for the rest of the shell session, and `unset GIT_SSH_COMMAND` to stop.

`GIT_SSH_COMMAND` wins over `core.sshCommand`. In a test with both set, Git ran the command from the environment variable.

### Use a key for one repository with core.sshCommand

```bash
cd ~/work/api
git config core.sshCommand 'ssh -i ~/.ssh/work_ed25519 -o IdentitiesOnly=yes'
```

Every fetch, pull and push over SSH in this repository now uses that key. HTTPS remotes do not use SSH, so the setting does not apply to them. To set it at clone time, pass it with `-c`. Git writes it into the config of the new repository before the first fetch:

```bash
git clone -c core.sshCommand='ssh -i ~/.ssh/work_ed25519 -o IdentitiesOnly=yes' \
  git@github.com:acme/api.git
```

Check or remove the setting with `git config --get core.sshCommand` and `git config --unset core.sshCommand`.

### Use a key for all repositories in a folder

Put the setting in a separate file, and include it only for repositories below `~/work/`:

```ini
# ~/.gitconfig
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work

# ~/.gitconfig-work
[core]
    sshCommand = ssh -i ~/.ssh/work_ed25519 -o IdentitiesOnly=yes
[user]
    email = jane@acme.example
```

Git 2.36 and later can also match on the remote URL instead of the folder. This rule applies to every repository with a remote in the `acme` organization, wherever you cloned it:

```ini
[includeIf "hasconfig:remote.*.url:git@github.com:acme/**"]
    path = ~/.gitconfig-work
```

In a test, a repository with the remote `git@github.com:acme/app.git` got the work `core.sshCommand`, and a repository with `git@github.com:me/dotfiles.git` did not. `git config --show-origin core.sshCommand` shows which file set the value.

### Use a key for a host with ~/.ssh/config

This is the best choice when you have two accounts on the same service. Give each account its own host alias:

```text
# ~/.ssh/config
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/work_ed25519
    IdentitiesOnly yes

Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/personal_ed25519
    IdentitiesOnly yes
```

Then use the alias in place of `github.com` in the URL:

```bash
git clone git@github.com-work:acme/api.git
git remote set-url origin git@github.com-work:acme/api.git   # for an existing clone
```

`ssh -G` prints the settings that `ssh` will use for a host, without a connection. Use it to check your config:

```bash
ssh -G github.com-work | grep -E '^(hostname|user|identityfile|identitiesonly) '
```

```text
user git
hostname github.com
identitiesonly yes
identityfile ~/.ssh/work_ed25519
```

If you have only one key for each service, you do not need aliases. Use the real host names in the `Host` lines (`Host github.com`, `Host gitlab.com`), and the normal URLs keep working.

### Why do I need IdentitiesOnly?

Because `ssh` can offer other keys before the one you named. When an SSH agent is running, OpenSSH tries keys in this order:

1. Keys in the agent that are also named in your config or on the command line.
2. All other keys in the agent.
3. Key files from your config or the command line that are not in the agent.

`IdentitiesOnly yes` (or `-o IdentitiesOnly=yes`) removes the second group. It does not remove keys that your `~/.ssh/config` names for the same host, for example in a `Host *` block. `ssh -G <host> | grep identityfile` lists every key file that `ssh` will try.

This matters on GitHub and GitLab, because the server accepts the first key that belongs to any account. If your personal key is in the agent and your work key is not, `ssh -i ~/.ssh/work_ed25519` can log you in as your personal account. The push then fails with an error that looks like a URL problem:

```text
ERROR: Repository not found.
fatal: Could not read from remote repository.
```

`ssh -vT git@github.com-work` shows each key that `ssh` offers, in order.

## How Do I Create and Test an SSH Key for Git?

Create an Ed25519 key, add the public key to your account, and test the connection:

```bash
ssh-keygen -t ed25519 -C "jane@acme.example" -f ~/.ssh/work_ed25519
cat ~/.ssh/work_ed25519.pub          # paste this into the SSH keys page of your account
ssh -T git@github.com-work
```

```text
Hi jane-acme! You've successfully authenticated, but GitHub does not provide shell access.
```

The name in the greeting is the account that the key belongs to. If it is the wrong account, check `IdentitiesOnly`.

- Use Ed25519 for new keys. GitHub is removing SHA-1 `ssh-rsa` signatures, and new RSA keys need at least 3072 bits. [GitHub Is Removing ssh-rsa Signatures](/posts/github-ssh-algorithm-removal) shows how to test an existing key.
- `ssh` refuses a private key that other users can read (`Permissions 0644 ... are too open`). Fix it with `chmod 600 ~/.ssh/work_ed25519` and `chmod 700 ~/.ssh`.
- Give the key a passphrase, and load it once a session with `ssh-add ~/.ssh/work_ed25519`. `ssh-add -l` lists the keys in the agent.

The [remotes chapter of the Git guide](/guides/introduction-to-git/06-remote-repositories#h3-ssh-keys) covers SSH and HTTPS authentication, and the [SSH hardening checklist](/checklists/ssh-hardening) covers the server side.

## How Do I Use a Deploy Key in a Script or CI?

Use a key that can read only that one repository (a deploy key), and check the host key of the server. Do not turn off host key checks with `StrictHostKeyChecking=no`: then anyone who can intercept the connection can pretend to be the server.

```bash
#!/usr/bin/env bash
set -euo pipefail

DEPLOY_KEY="$HOME/.ssh/deploy_api_ed25519"
KNOWN_HOSTS="$HOME/.ssh/known_hosts_github"   # created once, see below

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o UserKnownHostsFile=$KNOWN_HOSTS -o StrictHostKeyChecking=yes"

if [ -d /srv/api/.git ]; then
  git -C /srv/api fetch origin
  git -C /srv/api reset --hard origin/main   # the deploy copy holds no local work: this discards any change in it
else
  git clone git@github.com:acme/api.git /srv/api
fi
echo "Deployed $(git -C /srv/api rev-parse --short HEAD)"
```

Create the known hosts file once, and compare the fingerprints with the ones the service publishes, such as [GitHub's SSH key fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints):

```bash
ssh-keyscan -t ed25519 github.com > ~/.ssh/known_hosts_github
ssh-keygen -lf ~/.ssh/known_hosts_github     # compare with the published fingerprint
```

`-o StrictHostKeyChecking=accept-new` is a middle way: `ssh` saves the key of an unknown host on the first connection and refuses a changed key later. The first connection is still not checked.

:::note
`core.sshCommand` is a command that Git runs. A config file you did not write, for example in a repository that someone sent you, can use it to run code. [A Poisoned .git/config Runs Code on git status](/posts/poisoned-git-config-git-status-runs-code) tests which commands and copies carry it.
:::

## How Do I See Which URL a Repository Was Cloned From?

Run `git remote get-url origin`. `origin` is the name `git clone` gives to the remote you cloned from. `git remote -v` lists every remote with its fetch and push URL:

```bash
git remote get-url origin
# git@github.com:jane/api.git

git remote -v
# origin    git@github.com:jane/api.git (fetch)
# origin    git@github.com:jane/api.git (push)
# upstream  git@github.com:acme/api.git (fetch)
# upstream  git@github.com:acme/api.git (push)
```

In a fork, `origin` is usually your fork and `upstream` the original project. [How to sync a forked repository](/posts/sync-forked-repository-github) shows that setup.

Some details:

- **`git config --get remote.origin.url` prints the raw value.** `git remote get-url` and `git remote -v` print the URL that Git really uses, after `url.<base>.insteadOf` rules (see below). In a test with an `insteadOf` rule, the config showed `https://github.com/acme/app.git`, and `git remote get-url` showed `git@github.com:acme/app.git`.
- **Git does not keep a history of the URL.** If someone ran `git remote set-url` after the clone, the first URL is gone.
- **`git remote show origin`** also lists the remote branches and what `git pull` and `git push` do. It connects to the remote, so it fails when you are offline. Run `git remote show -n origin` to skip the connection.
- **A repository made with `git init` has no remote** until you add one with `git remote add origin <url>`.

In a script, the repository name is the last part of the URL:

```bash
url=$(git remote get-url origin)
name=$(basename -s .git "$url")
echo "$name"    # api
```

## How Do I Change the URL of a Git Remote?

Run `git remote set-url`, then check it:

```bash
git remote set-url origin git@github.com:acme/api.git
git remote -v
git ls-remote origin HEAD     # proves that the new URL and your credentials work
```

The common reasons:

- **HTTPS to SSH** (or back): `git remote set-url origin git@github.com:acme/api.git`, or `https://github.com/acme/api.git`.
- **The repository moved** to a new owner, name or host. GitHub redirects the old URL after a rename or transfer, but update your remotes anyway: the redirect stops working if someone creates a new repository with the old name.
- **A second account** on the same host: use the host alias from `~/.ssh/config` in the URL.

### Use one URL to fetch and another to push

`--push` changes only the push URL:

```bash
git remote set-url --push origin git@github.com:acme/api.git
git remote -v
```

```text
origin	https://github.com/acme/api.git (fetch)
origin	git@github.com:acme/api.git (push)
```

### Change many URLs at once

Rewrite a URL prefix for every repository with `url.<base>.insteadOf`. This rule sends every `https://github.com/` URL over SSH, and the remotes themselves do not change:

```bash
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

To change the stored URLs in many clones, loop over them. This loop moves SSH remotes from the `old-org` organization to `new-org`:

```bash
for repo in ~/work/*/; do
  old=$(git -C "$repo" remote get-url origin) || continue
  new=${old/github.com:old-org\//github.com:new-org/}
  [ "$old" != "$new" ] && git -C "$repo" remote set-url origin "$new" && echo "$repo -> $new"
done
```

### Add, rename and remove remotes

```bash
git remote add upstream https://github.com/acme/api.git   # a second remote
git remote rename origin old-origin                        # rename
git remote remove old-origin                               # delete the remote and its remote-tracking branches
```

### Fix credential errors after the change

An SSH URL needs an SSH key on your account (see above). An HTTPS URL on GitHub needs a personal access token or a credential manager, not your password. Use a credential helper that stores the token safely: Git Credential Manager, `osxkeychain` on macOS, or `cache` on Linux. Do not use `credential.helper store`: it writes the token in plain text to `~/.git-credentials`.

To make Git forget a saved HTTPS credential, so that it asks again:

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential reject
```

## Related Resources

- [Introduction to Git: Remotes, Push, Fetch and Pull](/guides/introduction-to-git/06-remote-repositories#h2-inspect-and-change-remotes)
- [GitHub Is Removing ssh-rsa Signatures](/posts/github-ssh-algorithm-removal)
- [How to push a new branch and set the upstream](/posts/how-to-push-new-local-branch-to-remote-and-track)
- [SSH hardening checklist](/checklists/ssh-hardening)
- [Sign Git commits with an SSH key](/guides/cryptography-essentials/04-pki#h3-signed-git-commits-with-an-ssh-key), from the Cryptography Essentials guide
- [Git concepts simulator](/games/git-concepts-simulator): see how remotes and remote-tracking branches relate
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
