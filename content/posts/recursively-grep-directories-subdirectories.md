---
title: 'How to Recursively Grep All Directories and Subdirectories'
excerpt: 'Learn how to use grep with recursive options to search through entire directory trees efficiently, exclude directories, list only matching file names, and filter live log streams without buffering delays.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-11-30'
publishedAt: '2024-11-30T09:15:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - grep
  - recursive search
  - text search
  - command line
  - logs
---

Searching for text patterns across entire directory structures is a fundamental task in system administration and development. The grep command's recursive capabilities allow you to efficiently search through thousands of files in multiple subdirectories, making it easy to find configuration settings, debug issues, or audit code across large projects.

## Prerequisites

You'll need access to a Linux terminal with basic grep knowledge. These examples work on all major Linux distributions and macOS.

## Basic Recursive Search

The `-r` flag tells grep to search recursively through all subdirectories. This command searches for "database" in all files within the current directory and its subdirectories:

```bash
grep -r "database" .
```

The dot represents the current directory as the starting point. Grep will examine every file it can read, descending through all subdirectories and showing matches with their file paths and line content.

## Recursive Search with Line Numbers

Adding line numbers helps you locate matches quickly within files. The `-n` flag includes line numbers in the output:

```bash
grep -rn "error" /var/log/
```

This searches log files for error messages and shows exactly which line contains each match. When debugging applications or analyzing logs, line numbers provide precise locations for further investigation.

## Case-Insensitive Recursive Search

The `-i` flag makes grep ignore case differences, which is essential when searching for terms that might appear with varying capitalization:

```bash
grep -ri "warning" /home/user/projects/
```

This finds "warning", "Warning", "WARNING", or any other case variation. This approach is particularly useful when searching through code or configuration files where naming conventions might vary.

## Showing Only Matching Filenames

Sometimes you only need to know which files contain matches, not the actual content. The `-l` flag lists only the filenames:

```bash
grep -rl "api_key" /etc/
```

This produces a clean list of files containing "api_key", making it easy to identify configuration files that might need updates or security reviews. [How do I show only file names with grep](#h2-how-do-i-show-only-the-names-of-matching-files-with-grep) below covers `-L`, counts and file names with spaces.

## Excluding Specific File Types

When searching through development projects, you often want to exclude certain file types. This command searches for "TODO" while excluding common binary and build files:

```bash
grep -r --exclude="*.log" --exclude="*.tmp" "TODO" .
```

You can exclude multiple patterns to focus your search on relevant files and avoid cluttering results with temporary or generated content.

## Excluding Entire Directories

Large projects often contain directories you want to skip entirely. This command excludes common build and dependency directories:

```bash
grep -r --exclude-dir={node_modules,.git,build,dist} "function" .
```

This approach significantly improves performance when searching through large codebases by skipping directories that rarely contain the content you're looking for. The braces are Bash syntax, and `--exclude-dir` matches directory names, not paths; [how to exclude directories from grep](#h2-how-do-i-exclude-directories-from-grep-r) below explains both.

## Including Only Specific File Types

Instead of excluding files, you can specify exactly which types to search. This command searches only Python files:

```bash
grep -r --include="*.py" "import" /home/user/code/
```

This focus approach is efficient when you know exactly which file types contain the information you need, such as searching for import statements in Python projects.

## Searching for Multiple Patterns

The `-E` flag enables extended regular expressions, allowing you to search for multiple patterns simultaneously:

```bash
grep -rE "(password|secret|token)" /etc/
```

This single command finds any of the three security-related terms, which is more efficient than running separate searches and helps ensure you don't miss any variations.

## Controlling Search Depth

The `find` command combined with grep gives you precise control over search depth. This searches only two levels deep:

```bash
find . -maxdepth 2 -type f -exec grep -l "config" {} \;
```

This approach prevents grep from descending too deeply into directory structures, which is useful when you know your target files are in specific locations.

## Displaying Context Around Matches

Adding context lines helps you understand matches better. The `-B` and `-A` flags show lines before and after matches:

```bash
grep -rn -B 2 -A 2 "exception" /var/log/
```

This shows two lines before and after each match, providing context that helps you understand what triggered errors or exceptions in log files.

## Searching Binary Files

By default, GNU grep searches binary files too, but it does not print the matching lines. It prints a message such as `grep: /usr/bin/ls: binary file matches` instead. To print the matches as text, use the `-a` flag:

```bash
grep -ra "version" /usr/bin/
```

Be cautious with this approach as binary files might produce unexpected output. This technique is occasionally useful for finding version strings in compiled executables. To skip binary files completely, use `-I`: `grep -rI "TODO" .`

## Using Grep with Different File Encodings

When searching files with different character encodings, you might need to specify the locale:

```bash
LC_ALL=C grep -r "pattern" .
```

The C locale treats files as raw bytes, which can help when dealing with files that contain mixed encodings or when the default locale causes issues.

## Performance Optimization for Large Searches

For very large directory structures, consider using parallel processing with GNU parallel or limiting the search scope:

```bash
find . -name "*.txt" | parallel grep -l "pattern"
```

This approach distributes the search across multiple CPU cores, significantly reducing search time for large datasets.

## Combining with Other Tools

You can pipe grep results to other commands for further processing. This command counts how many files contain a specific pattern:

```bash
grep -rl "database" . | wc -l
```

This combination provides summary statistics about your search results, which is useful for auditing or reporting purposes.

## Handling Special Characters

When searching for patterns that contain special characters, use the `-F` flag for literal string matching:

```bash
grep -rF "user@domain.com" /etc/
```

The `-F` flag treats the pattern as a fixed string rather than a regular expression, preventing special characters from being interpreted as regex operators.

## Creating Search Aliases

For frequently used search patterns, create aliases to save time:

```bash
alias findcode='grep -r --include="*.py" --include="*.js" --exclude-dir={.git,node_modules}'
alias finderrors='grep -ri --include="*.log" "error\|exception\|fail"'
```

These aliases encapsulate complex grep commands into simple, memorable names that you can use across different projects.

## How Do I Exclude Directories From grep -r?

Use `--exclude-dir` once for each directory. grep then does not enter those directories at all, which is what makes the search fast in a project with `node_modules` or `.git`:

```bash
grep -rn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist "useState" .

# the same in Bash and zsh: the shell expands the braces into three options
grep -rn --exclude-dir={node_modules,.git,dist} "useState" .
```

Three rules explain most "it still searches that directory" problems:

- `--exclude-dir` compares the pattern with the **name** of each directory, at any depth. `--exclude-dir=vendor` skips `src/vendor` and `lib/vendor`. A path such as `--exclude-dir=src/vendor` does not match during the recursive search.
- The pattern can be a glob: `--exclude-dir='*.cache'` or `--exclude-dir='tmp-*'`. Quote it so the shell does not expand it first.
- The brace form `{a,b,c}` is expanded by Bash and zsh, not by grep. In a `sh` script, write one `--exclude-dir` for each directory.

The same applies to `--include` and `--exclude`, which filter files by name. grep's own patterns have no braces, so this common line matches nothing:

```bash
grep -rl --include="*.{js,ts}" "useState" .      # wrong: grep looks for files named literally *.{js,ts}
grep -rl --include='*.js' --include='*.ts' "useState" .   # right
grep -rl --include=*.{js,ts} "useState" .        # also right in Bash: unquoted, the shell expands the braces
```

In a Git repository, `git grep` is often the better tool. It searches only tracked files, so it skips untracked directories such as `node_modules` and build output. A file that is tracked is searched even if it matches a `.gitignore` pattern:

```bash
git grep -n "useState"
git grep -n "useState" -- '*.tsx'
```

[ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`) applies the same filters to files on disk. Inside a Git repository it reads `.gitignore`, it skips hidden files and binary files by default, and it searches in parallel. Outside a repository, add `--no-require-git` to apply `.gitignore`, or put the patterns in a `.ignore` file. `rg --no-ignore --hidden` searches ignored and hidden files too, and `--text` (`-a`) also searches binary files as text.

## How Do I Show Only the Names of Matching Files With grep?

Use `-l` (lowercase L). grep prints each matching file once and stops reading that file at the first match:

```bash
grep -rl "database_host" /etc/
grep -rli --include='*.conf' "listen" /etc/nginx/     # case-insensitive, only .conf files
```

Related options:

| Option | Prints                                                       |
| ------ | ------------------------------------------------------------ |
| `-l`   | Names of files with at least one match                       |
| `-L`   | Names of files without a match                               |
| `-c`   | Every file with its number of matching lines, including `:0` |
| `-Z`   | A null byte after each name, for `xargs -0`                  |
| `-I`   | Nothing for binary files (they are skipped)                  |

`-l` also lists binary files that match. Add `-I` when you want text files only, for example before you edit the files.

To pass the names to another command, use `-Z` and `xargs -0`, so names with spaces or newlines stay intact:

```bash
# files that contain both "database" and "password"
grep -rlZ "database" /etc/myapp | xargs -0 grep -l "password"

# back up every file that contains a setting
grep -rlZ "database_host" /etc/myapp | xargs -0 -I{} cp -- {} {}.bak
```

To count the matching files, count the lines of `-l`: `grep -rl "TODO" src | wc -l`. A file name with a newline counts twice; `grep -rlZ "TODO" src | tr -cd '\0' | wc -c` counts the names exactly. Do not use `grep -c` for this: it prints a line for every file it reads, also for files with `:0` matches.

## How Do I grep a Continuous Stream or a Live Log?

Pipe `tail -F` into `grep --line-buffered`:

```bash
tail -F /var/log/nginx/error.log | grep --line-buffered "upstream timed out"
```

`--line-buffered` matters only when grep's output goes into another pipe or a file. When grep writes to a terminal, it prints each line at once. When it writes to a pipe, it collects several kilobytes before it writes, so the next command can see nothing for minutes on a quiet log:

```bash
# the output reaches the terminal at once: --line-buffered is not needed
tail -F app.log | grep ERROR

# grep writes to a pipe: without --line-buffered, the next command gets the lines in late batches
tail -F app.log | grep --line-buffered ERROR | cut -d' ' -f1,2
```

`tail -F` is short for `--follow=name --retry`. It keeps following the file name when log rotation replaces the file, which `tail -f` does not. With several files, `tail -F` prints a `==> file <==` header before each block; add `-q` to leave the headers out.

Every command in the middle of a pipeline needs the same treatment:

| Command                                   | Flush each line             |
| ----------------------------------------- | --------------------------- |
| GNU `grep`                                | `--line-buffered`           |
| GNU `sed`                                 | `-u` (`--unbuffered`)       |
| `cut`, `tr` and other C programs          | `stdbuf -oL cut ...`        |
| mawk (default `awk` on Debian and Ubuntu) | `mawk -W interactive '...'` |
| gawk                                      | `fflush()` after `print`    |

`stdbuf` does not help mawk, which buffers its input as well as its output. `sort` needs all of its input before it prints anything, so it never prints on an endless stream. `uniq -c` prints a count only when a different line arrives, and only adjacent lines are counted together. Collect a fixed window instead, for example with `timeout 60 tail -F access.log | awk '{print $1}' | sort | uniq -c`.

Other sources work the same way, as long as the error output goes into the pipe:

```bash
journalctl -u nginx -f | grep --line-buffered -i error
journalctl -u nginx -f -g 'timed out'               # journalctl filters by itself (needs PCRE2 support, which most builds have)
docker logs -f web 2>&1 | grep --line-buffered WARN
kubectl logs -f deploy/api | grep --line-buffered -E 'ERROR|FATAL'
```

To act on each match, read the stream in a loop:

```bash
tail -F /var/log/app.log | grep --line-buffered "CRITICAL" | while IFS= read -r line; do
    printf '%s %s\n' "$(date '+%F %T')" "$line" >> /var/log/critical-alerts.log
done
```

To send one stream to several filters, use `tee` with process substitution. Two readers on the same named pipe do not each get a copy: they compete for the data, and a line can even be split between them.

```bash
tail -F app.log | tee >(grep --line-buffered WARN >> warnings.log) | grep --line-buffered ERROR
```

## Next Steps

You can now efficiently search through complex directory structures using grep's recursive capabilities. Consider exploring more advanced tools like `ripgrep` or `ag` (the silver searcher) for even faster searches, or learn about using grep with version control systems to search through specific commits or branches.

Good luck with your recursive searches!

## Related Resources

- [How to find files containing specific text on Linux](/posts/find-files-containing-specific-text-linux): grep combined with find
- [How to find files using wildcards in Linux](/posts/find-files-with-wildcards-linux): search by name, exclude directories in find
- [How to check if a string contains a substring in Bash](/posts/check-directory-exists-bash-script#h2-how-do-i-check-if-a-string-contains-a-substring-in-bash)
- [Log aggregation pipeline simulator](/games/log-aggregation-pipeline-simulator): what replaces `tail | grep` when you have many servers
- [Learn Linux interactive tutorial](/games/linux-terminal): practice `grep` and pipes in a browser terminal
