---
title: 'How to Find Files Using Wildcards in Linux, Exclude Directories and Count Files'
excerpt: 'Use find with wildcards to search directory trees, fix "Argument list too long", skip directories such as node_modules in find and tar, count files and lines of code, and change permissions for folders and files separately.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-11-28'
publishedAt: '2024-11-28T14:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '21 min read'
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

This post covers wildcard searches, commands that fail with "Argument list too long", excluding directories in `find` and `tar`, counting files and lines of code, and recursive permission changes.

## TLDR

| Task                               | Command                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Find files by pattern              | `find . -type f -name '*.py'`                                                                 |
| Ignore case                        | `find . -iname '*.pdf'`                                                                       |
| Several patterns                   | `find . -type f \( -name '*.js' -o -name '*.ts' \)`                                           |
| Too many files for `rm *.log`      | `find . -maxdepth 1 -type f -name '*.log' -delete`                                            |
| Skip directories                   | `find . -type d \( -name node_modules -o -name .git \) -prune -o -type f -name '*.js' -print` |
| Count files recursively            | `find . -type f \| wc -l`                                                                     |
| Count lines in a file              | `wc -l < file.txt`                                                                            |
| Count lines in many files          | `find . -type f -name '*.py' -print0 \| wc -l --files0-from=- \| tail -n1`                    |
| Lines of code in a Git repository  | `git ls-files -z -- '*.py' \| wc -l --files0-from=- \| tail -n1`                              |
| tar without some folders           | `tar -czf app.tar.gz --exclude=node_modules --exclude=.git app/` (options before the folder)  |
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

## How Do I Fix "Argument list too long" for rm, cp and mv?

Let `find` hand the file names to the command, or use `-delete`. The error means that the expanded wildcard did not fit into one command line:

```text
$ rm *.log
bash: /usr/bin/rm: Argument list too long
```

The shell replaces `*.log` with one argument for each file before `rm` starts. The kernel limits the total size of the arguments and the environment of a new program. On Linux the limit is usually a quarter of the stack size limit, so 2 MiB with the usual 8 MiB stack, and never less than 128 KiB. `getconf ARG_MAX` prints the value for your shell. A single argument also cannot be longer than 32 memory pages, which is 128 KiB with the common 4 KiB pages. The program does not matter: `cp *.log`, `grep error *.log` and `ls *.log | wc -l`, a common way to check first, fail the same way.

```bash
# delete: find removes the files itself, so no list is passed on
find . -maxdepth 1 -type f -name '*.log' -delete

# copy or move: find passes as many names as fit to each cp or mv
find . -maxdepth 1 -type f -name '*.log' -exec mv -t /archive/ {} +
find . -maxdepth 1 -type f -name '*.log' -exec cp -t /archive/ {} +

# keep the glob: printf is a shell builtin, so the long list never goes through exec
printf '%s\0' *.log | xargs -0 rm --
```

To see it on a test machine without creating thousands of files, lower the stack limit in a test shell first. These are the commands from our run in a scratch directory with 6,000 log files:

```terminal
{
  "title": "Argument list too long, reproduced with a lower limit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "a test shell with a smaller stack limit, so 6,000 files are enough"
    },
    {
      "cmd": "ulimit -s 1024; getconf ARG_MAX",
      "output": "262144"
    },
    {
      "cmd": "ls | wc -l",
      "output": "6000"
    },
    {
      "cmd": "rm *.log",
      "output": "bash: /usr/bin/rm: Argument list too long"
    },
    {
      "cmd": "ls *.log | wc -l",
      "output": "bash: /usr/bin/ls: Argument list too long\n0"
    },
    {
      "cmd": "find . -maxdepth 1 -type f -name '*.log' -exec mv -t ../archive/ {} +; ls ../archive | wc -l",
      "output": "6000"
    }
  ]
}
```

Keep these points in mind:

- **Look before you delete.** Run the `find` command without `-delete` first and read the list. Put `-delete` last: `find . -delete -name '*.log'` deletes every file and directory under `.`, because find runs the tests and actions in the order you write them.
- **`-maxdepth 1` keeps find in the current directory**, like the glob. Without it, find also goes into the subdirectories.
- **`{} +` passes many names to each command, `{} \;` starts one command for each file.** With `+`, the `{}` must come last, which is why the examples use `mv -t` and `cp -t` (GNU coreutils) to name the target first. On macOS, use `-exec sh -c 'mv "$@" /archive/' sh {} +`.
- **Use `-print0` with `xargs -0`.** Plain `xargs` splits names at spaces and newlines and treats quotes as special, so `my file.log` becomes two wrong names.
- **A loop also works**, `for f in *.log; do rm -- "$f"; done`, because the glob is expanded inside the shell and never passed to `exec`. It starts one `rm` for each file, so it is slow with 100,000 files.
- `rm -rf directory/` never has this problem: `rm` reads the directory itself.

A directory with hundreds of thousands of files is slow for other tools too. If an app writes that many, let it write into subdirectories by date or by a hash prefix, and delete old files with a timer, such as `find /var/cache/app -type f -mtime +7 -delete`.

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

## How Do I Tar a Directory and Exclude Files and Folders?

Add `--exclude` options **before** the directory:

```bash
tar -czf project.tar.gz --exclude=node_modules --exclude=.git --exclude='*.log' project/
```

GNU tar applies `--exclude` only to the names that come after it. An `--exclude` at the end of the command does nothing, and tar 1.34 says so and exits with an error:

```text
$ tar -czf project.tar.gz project/ --exclude=node_modules
tar: The following options were used after any non-optional arguments in archive create or update mode.  These options are positional and affect only arguments that follow them.  Please, rearrange them properly.
tar: --exclude ‘node_modules’ has no effect
tar: Exiting with failure status due to previous errors
```

How the patterns match, tested with GNU tar 1.34:

- **A pattern without a slash matches a name at any depth.** `--exclude=node_modules` skips every `node_modules` directory, also nested ones such as `packages/web/node_modules`.
- **A pattern with a slash matches the end of a path.** `--exclude=config/secrets.json` skips both `project/config/secrets.json` and `project/src/config/secrets.json`. To skip one file only, write its path as it appears in the archive: `--exclude=project/config/secrets.json`.
- **With `-C`, the names start with `./`**: `tar -czf app.tar.gz -C project --exclude=./node_modules .` archives the contents of `project` without its top-level `node_modules`.
- **There is no negation.** `--exclude='!logs/latest.log'` does not bring a file back. To archive only some files, give tar a list instead: `find project -name '*.conf' -print0 | tar -czf conf.tar.gz --null -T -`.
- **Quote patterns with `*`**, so the shell does not expand them before tar sees them.

For many patterns, put them in a file, one for each line, and pass it with `-X` (`--exclude-from`). Every line is a pattern; a line that starts with `#` is not a comment. Three options cover common cases without a list: `--exclude-vcs` skips `.git`, `.svn`, `.hg` and the other version control directories, `--exclude-caches` skips the contents of directories that hold a `CACHEDIR.TAG` file, and `--exclude-vcs-ignores` reads `.gitignore`. That last one understands only simple patterns: in our test it ignored `node_modules/` (trailing slash) and `!latest.log` (negation).

For a Git repository, `git archive` is usually the better tool. It archives exactly the files that Git tracks, so untracked files, such as an ignored `node_modules`, stay out:

```bash
git archive --prefix=project/ -o project.tar.gz HEAD   # the format follows the file name
```

It archives the commit, not your working directory: changes that you have not committed are not in the archive. A file that was committed is in it even if `.gitignore` names it now. To leave tracked files out, mark them with `export-ignore` in `.gitattributes`.

Check the result before you copy it anywhere. `tar -tzf project.tar.gz | less` lists the contents, and `tar -cvf /dev/null --exclude=node_modules project/` prints what tar would archive without writing an archive.

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

### How Do I Count Lines of Code in a Directory Recursively?

In a Git repository, let Git choose the files. `git ls-files` lists only the files that Git tracks, so `node_modules`, virtual environments and build output stay out, as long as nobody committed them:

```bash
git ls-files -z -- '*.py' '*.ts' | wc -l --files0-from=- | tail -n1
```

Without `tail`, you get one line for each file and the total. In a small test repository, with a file name that contains a space:

```text
3 src/app.py
1 src/index.ts
1 src/my file.py
4 src/util.py
9 total
```

Outside Git, prune the directories you do not want, then count:

```bash
find . -type d \( -name node_modules -o -name .git -o -name .venv -o -name dist \) -prune \
    -o -type f \( -name '*.py' -o -name '*.ts' \) -print0 \
  | wc -l --files0-from=- | tail -n1
```

`git ls-files | sed -n 's/.*\.//p' | sort | uniq -c | sort -rn` shows how many files of each extension there are, which helps you pick the patterns.

These counts include blank lines and comments. Do not strip comments with `grep -v` or `sed`: a `//` inside a string or a comment that spans several lines gives wrong numbers. Use a counter that knows the languages. [cloc](https://github.com/AlDanial/cloc) (`cloc --vcs=git`), [tokei](https://github.com/XAMPPRocky/tokei) and [scc](https://github.com/boyter/scc) report code, comment and blank lines for each language, and tokei and scc skip what `.gitignore` excludes. In scripts, print the count and read it with `$(...)`. Do not return it with `return`: an exit status is a number from 0 to 255, so a function that returns 300 lines reports 44.

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
- [Working with files in the Bash guide](/guides/introduction-to-bash/03-working-with-files): globs, `find -exec` and loops over file names
- [Back up, and test the restore](/guides/introduction-to-linux/10-system-administration#h2-back-up-and-test-the-restore): archives with tar and rsync in the Linux guide
- [How to loop through files in Bash](/posts/bash-loop-through-file-content#h3-loop-over-file-names-safely): process the files that find returns
- [Learn Linux interactive tutorial](/games/linux-terminal): practice `ls`, `chmod` and pipes in a browser terminal
- [Linux command line quiz](/quizzes/linux-quiz) and [Linux fundamentals flashcards](/flashcards/linux-fundamentals)
