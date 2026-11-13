---
title: 'How to Find Files Using Wildcards in Linux, Exclude Directories and Count Files'
excerpt: 'Use find with wildcards to search directory trees by name, skip directories such as node_modules and .git with -prune, count files and lines correctly, and change permissions for folders and files separately.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-11-28'
publishedAt: '2024-11-28T14:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - find
  - wildcards
  - chmod
  - wc
  - Bash
---

`find` walks a directory tree and tests every file against the conditions you give it. With a handful of options it answers many daily questions: where are all the `.conf` files, which logs changed this week, how many files does this backup hold. The same walk also lets you act on the files, for example to give directories and files different permissions.

This post covers wildcard searches, excluding directories, counting files and lines, and recursive permission changes.

## TLDR

| Task                               | Command                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Find files by pattern              | `find . -type f -name '*.py'`                                                                 |
| Ignore case                        | `find . -iname '*.pdf'`                                                                       |
| Several patterns                   | `find . -type f \( -name '*.js' -o -name '*.ts' \)`                                           |
| Skip directories                   | `find . -type d \( -name node_modules -o -name .git \) -prune -o -type f -name '*.js' -print` |
| Count files recursively            | `find . -type f \| wc -l`                                                                     |
| Count lines in a file              | `wc -l < file.txt`                                                                            |
| Count lines in many files          | `find . -type f -name '*.py' -print0 \| wc -l --files0-from=- \| tail -n1`                    |
| 755 for directories, 644 for files | `find dir -type d -exec chmod 755 {} +` and `find dir -type f -exec chmod 644 {} +`           |

## Prerequisites

- A Linux terminal with GNU findutils and coreutils, which most distributions ship. Alpine and other BusyBox-based images have smaller versions of `find` and `wc`; install the `findutils` and `coreutils` packages there for the GNU options.
- On macOS, BSD `find` supports the same basic tests (`-name`, `-iname`, `-path`, `-prune`, `-type`, `-size`). `-printf`, `-regextype` and `wc --files0-from` are GNU only; install them with `brew install findutils coreutils` and run `gfind` and `gwc`.

## How Do I Find Files Using Wildcards in Linux?

Give `find` a starting directory and a `-name` pattern in quotes:

```bash
find . -type f -name '*.py'          # Python files under the current directory
find /etc -name 'nginx*'             # names that start with nginx
find /var/log -name 'log?.txt'       # ? is one character: log1.txt, not log10.txt
find . -iname '*.pdf'                # case-insensitive: .pdf, .PDF, .Pdf
```

Quote the pattern. Without quotes, the shell expands `*.py` against the current directory before `find` runs. If `setup.py` is there, find gets `-name setup.py` and finds only files with that name. If several `.py` files are there, find fails with `paths must precede expression`.

The wildcards are the same as in the shell: `*` matches any text, `?` one character, and `[...]` one character from a set. `-name` matches only the file name. To match the path, use `-path`:

```bash
find . -path '*/assets/*.css'                         # CSS files inside any assets directory
find /var/log -name 'access-2026-1[0-2]-*.log'        # October to December 2026
```

### Combine Conditions

Conditions next to each other must all be true. Use `-o` for "or", `!` (or `-not`) for "not", and escaped parentheses to group:

```bash
find . -type f \( -name '*.js' -o -name '*.ts' \)     # JavaScript or TypeScript
find . -type f ! -name '*.tmp'                        # everything except .tmp files
find . -maxdepth 2 -type f -name '*.json'             # this directory and one level below
```

Without the parentheses, `-type f -name '*.js' -o -name '*.ts'` means "(regular file named *.js) or (anything named *.ts)", because "and" binds more tightly than "or".

### Filter by Size and Age

```bash
find . -type f -name '*.jpg' -size +1M      # larger than 1 MiB
find /var/log -type f -mtime -7             # modified less than 7 days ago
find /tmp -type f -mtime +30                # modified more than 30 days ago
find . -type f -mmin -60                    # modified in the last hour
find . -newermt '2026-11-01' -type f        # modified after a date
```

Two details cause wrong results:

- `-size` rounds the file size up to the unit before it compares. `-size -1M` matches only empty files, because a 1-byte file already counts as 1M. `-size -10M` misses a 9.5 MiB file, which rounds up to 10. Use a smaller unit for limits: `-size -10240k`.
- `-mtime` counts whole 24-hour periods and drops the fraction. `-mtime +30` means "at least 31 days ago".

### Use Regular Expressions

`-regex` matches the whole path, not only the name. In GNU find, choose the extended syntax so `|` and `( )` work without backslashes:

```bash
find . -regextype posix-extended -iregex '.*\.(jpg|png|gif)'
```

For one directory, a shell glob is often enough: `ls -d -- *.log`. For fast searches that skip ignored files, [fd](https://github.com/sharkdp/fd) is a simpler alternative with the same idea.

## How Do I Exclude Directories When Using find?

Use `-prune`. It tells find not to enter a directory, so nothing under it is read:

```bash
find . -type d -name node_modules -prune -o -type f -name '*.js' -print
```

Read it as: "if this is a directory named `node_modules`, prune it, **or** else, if it is a `.js` file, print it". The `-print` at the end is required. Without it, find prints the pruned directories too.

To skip several directories, group the names after one `-type d`:

```bash
find . -type d \( -name node_modules -o -name .git -o -name build \) -prune -o -type f -name '*.py' -print
```

To skip one specific directory instead of every directory with that name, prune by path. The path must start like the starting point:

```bash
find . -path ./build -prune -o -type f -name '*.c' -print     # skips ./build, keeps ./src/build
```

A filter with `-not -path` gives the same output for small trees, but find still reads every file in the excluded directories and then drops them. In a project with a large `node_modules`, that is much slower:

```bash
find . -type f -name '*.js' -not -path '*/node_modules/*' -not -path '*/.git/*'   # works, but reads all of node_modules
```

### Skip Hidden Directories

This command looks correct, but it prints nothing:

```bash
find . -type d -name '.*' -prune -o -name '*.conf' -print      # wrong
```

The starting point `.` is itself a directory whose name matches `.*`, so find prunes the whole search. Require at least one character after the dot, or skip the starting point with `-mindepth 1`:

```bash
find . -type d -name '.?*' -prune -o -type f -name '*.conf' -print
```

### Search the Whole File System

For a search from `/`, skip the virtual file systems by path, and send permission errors to `/dev/null`:

```bash
find / \( -path /proc -o -path /sys -o -path /dev -o -path /run \) -prune -o -type f -name '*.conf' -print 2>/dev/null
find / -xdev -type f -size +500M 2>/dev/null       # -xdev: stay on the root file system
```

Do not exclude them with `-name proc`. That also skips every other directory called `proc`, `sys` or `dev` anywhere on the system, for example in kernel sources.

## How Do I Recursively Count Files in a Linux Directory?

Let `find` list the files and `wc -l` count the lines:

```bash
find /srv/backups -type f | wc -l
```

`-type f` counts only regular files. Use `-type d` for directories, `-type l` for symlinks, or no `-type` for everything. A file name that contains a newline counts twice with `wc -l`. GNU find can print one character for each file instead, which is exact:

```bash
find /srv/backups -type f -printf '.' | wc -c
```

Add the usual tests to count a subset:

```bash
find . -type f -name '*.js' | wc -l                     # only JavaScript files
find . -type f -not -path '*/.*' | wc -l                # skip hidden files and directories
find . -maxdepth 1 -type f | wc -l                      # only the top level
find /var/log -type f -mtime -1 | wc -l                 # changed in the last 24 hours
```

To see where the files are, count them for each directory:

```bash
# files in each top-level subdirectory, largest first
for dir in */; do
    printf '%7d %s\n' "$(find "$dir" -type f | wc -l)" "$dir"
done | sort -rn

# files directly in each directory, at any depth (GNU find)
find . -type f -printf '%h\n' | sort | uniq -c | sort -rn | head
```

When a file system runs out of inodes, `df -i` shows the usage for each file system, and `du --inodes -s /path` (GNU coreutils) shows how many inodes a directory tree uses.

## How Do I Count the Number of Lines in a File?

Use `wc -l`. With `<`, it prints only the number:

```bash
wc -l access.log       # 1520 access.log
wc -l < access.log     # 1520
wc -l *.csv            # one line per file and a total
```

`wc -l` counts newline characters. A file whose last line has no newline at the end gets a count that is one too low. `grep -c ''` counts that last line too:

```bash
printf 'a\nb\nc' > three.txt
wc -l < three.txt      # 2
grep -c '' three.txt   # 3
```

Other counts you often need:

```bash
grep -c . file.txt              # lines that are not empty
grep -c 'ERROR' app.log         # lines that match
tail -n +2 data.csv | wc -l     # rows of a CSV file without the header line
zcat app.log.1.gz | wc -l       # a compressed file (bzcat, xzcat, zstdcat for other formats)
```

### Count Lines in Many Files

For a directory tree, give `wc` the file names from `find`:

```bash
find . -type f -name '*.py' -print0 | wc -l --files0-from=- | tail -n1
```

Do not use `find ... -exec wc -l {} + | tail -1` for the total. When there are many files, find starts `wc` several times, each `wc` prints its own `total` line, and `tail` shows only the last one. In a test with 3,000 files, it printed `765 total`. `wc -l --files0-from=-` runs one `wc` for all files, and `find ... -exec cat {} + | wc -l` also gives the right total when every file ends with a newline.

To count lines of code by language and without blank lines and comments, use a tool such as `cloc` or `tokei`.

## How Do I Change Permissions for a Folder, Its Subfolders and Files?

Set the directories and the files separately:

```bash
find /var/www/site -type d -exec chmod 755 {} +
find /var/www/site -type f -exec chmod 644 {} +
```

Directories need the execute bit to be entered, and most files must not have it. That is why a single numeric mode with `-R` is wrong in both directions:

- `chmod -R 755 dir` makes every file executable.
- `chmod -R 644 dir` removes the execute bit from the directories. No regular user, the owner included, can then enter them or open the files inside, and `chmod` itself fails on the subdirectories with `Permission denied`.

Symbolic modes with a capital `X` do the same job in one command:

```bash
chmod -R u=rwX,go=rX /var/www/site     # directories 755, files 644 (or 755 if already executable)
chmod -R go-w /srv/shared              # remove write permission for group and others
chmod -R g+rwX /srv/team               # give the group read and write, and entry to directories
```

`X` adds execute permission only to directories and to files that already have execute permission for someone. Scripts stay executable, and documents do not become executable.

`-exec chmod 644 {} +` passes many files to each `chmod`. The older `-exec ... {} \;` form starts one `chmod` for every file, which is much slower on a large tree.

### Ownership, Checks and Mistakes

Change the owner with `chown`, then set the modes:

```bash
sudo chown -R www-data:www-data /var/www/site
```

Before and after a change, find the files that do not match what you expect:

```bash
find /var/www/site -type f -perm /111              # files with any execute bit
find /var/www/site -type d ! -perm 755             # directories that are not 755
```

Keep these points in mind:

- `chmod --changes` (`-c`) and `--verbose` (`-v`) print what chmod changes. They do not preview: the change happens. Use the `find -perm` commands above to preview.
- `--preserve-root` makes chmod refuse to work recursively on `/`. GNU chmod does not use it by default, unlike `rm`.
- `chmod -R` changes the targets of symlinks that you name on the command line, but it does not follow symlinks it finds inside the tree.
- Never use `chmod -R 777` to fix a permission error. Find out which user needs access and give it to that user or its group.
- SSH refuses keys with loose permissions: `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/id_ed25519 ~/.ssh/authorized_keys`.

For finer control than owner, group and others, use ACLs: `setfacl -R -m u:deploy:rwX /srv/app` gives one more user access, and `getfacl` shows the result.

## Related Resources

- [Linux file system hierarchy and permissions](/guides/introduction-to-linux/04-file-system-hierarchy): permission bits, `umask`, special bits and finding files by owner and age
- [How to recursively grep all directories](/posts/recursively-grep-directories-subdirectories): search file contents instead of names
- [How to loop through files in Bash](/posts/bash-loop-through-file-content#h3-loop-over-file-names-safely): process the files that find returns
- [Learn Linux interactive tutorial](/games/linux-terminal): practice `ls`, `chmod` and pipes in a browser terminal
- [Linux command line quiz](/quizzes/linux-quiz) and [Linux fundamentals flashcards](/flashcards/linux-fundamentals)
