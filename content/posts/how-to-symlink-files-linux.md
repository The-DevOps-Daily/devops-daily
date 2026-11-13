---
title: 'How to Copy, Overwrite and Symlink Files in Linux, and Get Their Full Path'
excerpt: 'Make cp overwrite without asking, copy whole directories with their hidden files, create symlinks with ln -s and get relative targets right, remove a symlink without deleting the target, and get the absolute path of any file.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-20'
publishedAt: '2024-12-20T14:20:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Symlinks
  - ln
  - realpath
  - cp
  - File System
---

A **symbolic link** (symlink) is a small file that contains a path to another file or directory. Programs that open the link get the target instead. Symlinks let a deploy switch `current` from one release to the next, keep dotfiles in a Git repository, or make a tool available under a second name.

Most symlink problems come from three details: relative targets, trailing slashes, and what `ln -sf` does when the link points to a directory. This post covers creating, replacing and removing links, and getting the full path of a file, with or without resolving the links on the way. It also covers the copy side: why `cp` keeps asking before it overwrites a file, and how to copy a whole directory without losing hidden files.

## TLDR

| Task                                  | Command                                               |
| ------------------------------------- | ----------------------------------------------------- |
| Create a symlink                      | `ln -s /path/to/target link_name`                     |
| Create a relative symlink             | `ln -sr configs/app.conf links/app.conf` (GNU)        |
| Point an existing link somewhere else | `ln -sfn /srv/releases/v2 /srv/current`               |
| Show where a link points              | `readlink link_name` or `ls -l link_name`             |
| Remove a symlink to a directory       | `rm link_name` or `unlink link_name`, no trailing `/` |
| Find broken symlinks                  | `find . -xtype l` (GNU)                               |
| Absolute path of a file               | `realpath file` or `readlink -f file`                 |
| Overwrite without the cp question     | `\cp new.conf app.conf` skips the `cp -i` alias       |
| Copy a directory with hidden files    | `cp -a site/. backup/`                                |

## Prerequisites

- A Linux terminal with GNU coreutils. The macOS differences are noted where they matter.
- Write permission in the directory where you create or remove the link.

## How Do I Create a Symbolic Link in Linux?

Use `ln -s`, with the target first and the link name second:

```bash
ln -s /opt/tool/bin/tool /usr/local/bin/tool          # a link to a file
ln -s /home/user/projects/website ~/current-project   # a link to a directory
```

`ls -l` shows the link and its target, and the first character of the mode is `l`:

```text
lrwxrwxrwx 1 user user 18 Nov 13 09:30 /usr/local/bin/tool -> /opt/tool/bin/tool
```

Reading or writing through the link works on the target. Removing or renaming the link does not touch the target. The `lrwxrwxrwx` mode means nothing: Linux checks the permissions of the target.

### Relative or Absolute Targets

A relative target is resolved from the directory that **contains the link**, not from the directory you are in when you run `ln`. This is the most common way to create a broken link:

```bash
cd ~/app
ln -s configs/app.conf links/wrong     # links/wrong -> configs/app.conf, looked up in links/
cat links/wrong                        # No such file or directory

ln -s ../configs/app.conf links/right  # relative to links/
ln -sr configs/app.conf links/right    # GNU ln works out the relative path for you
```

Use an absolute target when the link stays in place and the target has a fixed location, such as `/usr/local/bin/tool`. Use a relative target when you move or copy the link and the target together, for example inside a Git repository or a release directory.

### Hard Links or Symbolic Links?

| Property                  | Symbolic link (`ln -s`) | Hard link (`ln`)                          |
| ------------------------- | ----------------------- | ----------------------------------------- |
| Points to                 | A path                  | The same inode as the original            |
| Works for directories     | Yes                     | No                                        |
| Works across file systems | Yes                     | No                                        |
| Target deleted or moved   | Link breaks             | Data stays until the last link is removed |

Use symlinks unless you have a reason for hard links, such as backup tools that store unchanged files once.

### Point an Existing Link Somewhere Else

Use `ln -sfn`. `-f` replaces the existing link, and `-n` treats a link to a directory as a file:

```bash
ln -sfn /srv/releases/2026-11-13 /srv/current
```

`-n` is not optional for directories. If `/srv/current` points to a directory and you run `ln -sf /srv/releases/2026-11-13 /srv/current` without `-n`, `ln` follows the link and creates a new link **inside** the old release directory, named `2026-11-13`. `/srv/current` still points to the old release, and the command reports no error.

GNU `ln` since coreutils 8.27 replaces the link without a gap: it creates the new link under a temporary name and renames it over the old one. To get the same result with any `ln`, or to make the step explicit in a deploy script, do the rename yourself:

```bash
ln -s /srv/releases/2026-11-13 /srv/current.tmp
mv -T /srv/current.tmp /srv/current       # rename() replaces the link in one step
```

`mv -T` treats `/srv/current` as a file even though it points to a directory. macOS has no `mv -T`; use `mv -h` there. macOS `ln -sfn` also works, but it removes the old link before it creates the new one, so there is a short moment without a link.

### Find Broken Symlinks

A symlink whose target was moved or deleted stays in place and points to nothing:

```bash
find . -xtype l                                   # GNU find: links whose target does not exist
find . -type l ! -exec test -e {} \; -print        # the same with any find
```

Check the list, then remove the links with `find . -xtype l -delete`. `-delete` removes only the links, never their targets.

## How Do I Remove a Symlink to a Directory in Linux?

Use `rm` or `unlink` with the link name, without a trailing slash:

```bash
rm /srv/current
unlink /srv/current      # removes exactly one name and takes no options
```

Both remove only the link. The directory it points to and the files in it stay. The trailing slash is the dangerous part, because `current/` means "the directory that `current` points to":

```text
$ rm current/
rm: cannot remove 'current/': Is a directory
$ rmdir current
rmdir: failed to remove 'current': Not a directory
$ rm -r current/
rm: cannot remove 'current/': Not a directory
$ ls target/
$
```

The last command deleted every file in the **target** directory, and then failed to remove the link. `rm -rf current/` does the same without a message and exits 0. Check for the slash before you press Enter, also after tab completion. `rmdir` does not work for a symlink at all.

In a script, check that the path is a link before you remove it. `-L` is true for a symlink, also when its target is missing:

```bash
if [[ -L /srv/current ]]; then
    rm -- /srv/current
fi
```

To remove all symlinks in a tree, use `find /srv/www -type l -delete`. Run it without `-delete` first to see the list.

## How Do I Get the Full Path of a File in Linux?

Use `realpath`. It prints the absolute path with `.` and `..` removed and all symlinks resolved:

```bash
realpath config.json              # /home/user/projects/app/config.json
realpath ../shared/db.conf        # works for any relative path
realpath -- *.json                # one absolute path per file
readlink -f config.json           # the same result
```

Options for the cases where "full path" means something else:

```bash
realpath -s links/app.conf             # absolute path, but do not resolve symlinks
realpath -e path/that/must/exist       # fail if any part of the path is missing
realpath -m path/that/does/not/exist   # no part needs to exist
realpath --relative-to=/srv/app /srv/app/config/db.yml   # config/db.yml
dirname -- "$(realpath -- config.json)"   # the absolute directory of the file
```

By default, `realpath` and `readlink -f` accept a path whose last part does not exist yet, but fail when a directory in the middle is missing.

`readlink` without `-f` does something different: it prints the target exactly as it is stored in the link, and that can be a relative path:

```bash
readlink links/app.conf       # ../configs/app.conf
realpath links/app.conf       # /home/user/app/configs/app.conf
```

Building the path yourself with `"$PWD/config.json"` gives an absolute path, but it keeps `..` parts and symlinks as they are. `find` prints absolute paths only when you start it from an absolute path: `find "$PWD" -name '*.json'`.

On macOS, `realpath` is included in current releases. On older ones, install GNU coreutils (`brew install coreutils`) and use `grealpath` or `greadlink -f`. In a Bash script, [get the directory of the script itself](/posts/what-does-set-e-mean-in-bash-script#h2-how-do-i-get-the-directory-where-a-bash-script-is-located) with `BASH_SOURCE`.

### Check Where a Symlink Leads Before You Use It

A script that reads files from a directory that other people can write to must not follow links blindly. Resolve the path, then check that it is still inside the directory you allow:

```bash
target=$(realpath -e -- "$upload") || exit 1
case $target in
    /srv/uploads/*) cat -- "$target" ;;
    *) echo "refusing to read $upload: it points to $target" >&2; exit 1 ;;
esac
```

This check catches links that were already there. It does not stop a user who replaces the file or a parent directory between the `realpath` check and the `cat`. When other users can change the tree while your script runs, a shell check is not enough: the program must open the file relative to a trusted directory with restricted path resolution, such as `openat2()` with `RESOLVE_BENEATH` on Linux.

## How Do I Force cp to Overwrite Files Without Asking?

Skip the alias that adds `-i`. When `cp` asks `cp: overwrite 'app.conf'?` although you did not type `-i`, your shell runs `cp -i` for you:

```text
$ type cp
cp is aliased to `cp -i'
$ cp -f new.conf app.conf
cp: overwrite 'app.conf'? n
$ \cp new.conf app.conf      # the backslash skips the alias: no question
```

`-f` does not help. In GNU `cp`, `-i` wins over `-f` in any order: we tested `cp -i -f` and `cp -f -i` with coreutils 9.1, and both asked. `-f` means something else: if the target exists but cannot be opened for writing, `cp` removes it and tries again. On macOS and BSD, the last of `-i`, `-f` and `-n` wins, so there `cp -f` does override an earlier `-i`.

Ways to get past the alias:

```bash
\cp new.conf /etc/app/app.conf          # this command only
command cp new.conf /etc/app/app.conf   # this command only; also skips a shell function named cp
unalias cp                              # the rest of this shell session
```

The alias usually comes from root's `~/.bashrc` on RHEL, Rocky, AlmaLinux, CentOS and Fedora, which define `cp -i`, `mv -i` and `rm -i` there. Debian and Ubuntu do not set it by default. To find it, run `grep -rn "alias cp" ~/.bashrc ~/.bash_aliases ~/.bash_profile /etc/bashrc /etc/bash.bashrc /etc/profile.d/ 2>/dev/null`, then delete or comment out the line and open a new shell. The alias is a guard against typos in an interactive shell, so many people keep it and type `\cp` when they mean it.

Scripts are not affected. Bash does not expand aliases in a non-interactive shell, so a script that runs `cp new.conf app.conf` overwrites without a question even when your interactive `cp` is an alias. You do not need `/bin/cp` in scripts for this reason. A script that hangs on the question has `-i` written in it, or it was started with `bash -i`.

The opposite case, never overwrite, needs care with versions:

- `cp -n` (`--no-clobber`) skips files that exist. Its exit status changed: in GNU coreutils 9.2 to 9.4, a skipped file made `cp -n` fail. 9.5 went back to skipping silently, and its documentation advises against `-n` because it differs between platforms.
- `cp --update=none` (coreutils 9.3 and later) always skips existing files with exit status 0, and `--update=none-fail` fails instead (for `cp`, in coreutils 9.6 and later, or a distribution build with that fix). `cp -u` copies only when the source is newer than the target.
- The same change hit `mv -n`, which [scripts on newer Ubuntu releases notice](/posts/ubuntu-26-10-rust-coreutils-what-changes#h2-a-change-that-is-not-about-rust-mv-n).

Before you overwrite configuration files on a server, keep the old version: `cp --backup=numbered new.conf /etc/app/app.conf` renames the existing file to `app.conf.~1~` first (GNU). For whole trees, `rsync -a --backup --backup-dir=../app-backup-$(date +%F) src/ dest/` moves every file that it replaces into a directory next to `dest`, because a relative `--backup-dir` starts from the destination.

## How Do I Copy a Whole Directory With cp?

Use `cp -a`. It copies recursively and keeps permissions, timestamps and symbolic links, which `cp -r` alone does not promise:

```bash
cp -a site backup
```

Whether `backup` exists already changes the result. If it does not exist, `cp` creates it as a copy of `site`. If it exists, `cp` puts the copy **inside** it, as `backup/site`. Running the same command twice therefore gives you a nested copy the second time:

```text
$ cp -a site backup        # backup did not exist
$ find backup | sort
backup
backup/css
backup/css/main.css
backup/.env
backup/home.html
backup/index.html

$ cp -a site backup        # backup exists now
$ ls -A backup
css .env home.html index.html site
```

To copy what is **in** a directory into a directory that already exists, copy `site/.`, not `site/*`. The glob skips hidden files such as `.env`; the `.` entry includes them:

```text
$ cp -r site/* backup/ && ls -A backup     # backup is empty before each command
css home.html index.html

$ cp -a site/. backup/ && ls -A backup
css .env home.html index.html
```

GNU `cp` also has `-T` (`--no-target-directory`): `cp -aT site backup` always copies the contents of `site` into `backup`, whether `backup` exists or not. macOS and BSD `cp` do not have `-T`, so use `site/.` in scripts that must run on both. `rsync -a site/ backup/` follows the same idea: with the trailing slash on the source it copies the contents, without it, the directory itself. To check afterwards that the copy matches, see [how to compare two directory trees](/guides/introduction-to-linux/10-system-administration#h3-compare-two-directory-trees).

## Related Resources

- [Linux file system hierarchy and permissions](/guides/introduction-to-linux/04-file-system-hierarchy#h2-file-types-links-and-inodes): file types, links and inodes
- [How to find files in Linux](/posts/find-files-with-wildcards-linux): exclude directories and count files, and fix ["Argument list too long" for cp and mv](/posts/find-files-with-wildcards-linux#h2-how-do-i-fix-argument-list-too-long-for-rm-cp-and-mv)
- [How to permanently set $PATH](/posts/permanently-set-path-on-linux-unix): where `~/.bashrc`, aliases and functions are loaded
- [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface): creating, copying, moving and deleting files in the Linux guide
- [What does set -e mean?](/posts/what-does-set-e-mean-in-bash-script): stop a deploy script when a step such as `ln` fails
- [Learn Linux interactive tutorial](/games/linux-terminal)
