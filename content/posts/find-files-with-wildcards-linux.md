---
title: 'How to Find Files Using Wildcards in Linux'
excerpt: 'Learn how to use wildcard patterns with find command to recursively search for files in directories and subdirectories based on name patterns.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-11-28'
publishedAt: '2024-11-28T14:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - find
  - wildcards
  - file search
  - bash
---

When managing files across multiple directories, you often need to locate files based on name patterns rather than exact names. Linux provides robust wildcard matching capabilities through the `find` command, allowing you to search recursively through directory structures using flexible pattern matching.

## Prerequisites

You'll need access to a Linux terminal. The examples work on all major Linux distributions and macOS.

## Basic Wildcard Patterns

The `find` command uses several wildcard characters for pattern matching. The asterisk (\*) matches any number of characters, while the question mark (?) matches exactly one character.

This command finds all Python files in the current directory and its subdirectories:

```bash
find . -name "*.py"
```

The dot represents the current directory, and the pattern `*.py` matches any filename ending with `.py`. The quotes prevent the shell from expanding the wildcard before passing it to find.

## Finding Files with Multiple Extensions

You can search for files with different extensions using the `-o` (OR) operator. This command locates both JavaScript and TypeScript files:

```bash
find . \( -name "*.js" -o -name "*.ts" \)
```

The parentheses group the conditions, ensuring the OR logic applies correctly. This approach is useful when working with projects that use multiple related file types.

## Case-Insensitive Wildcard Matching

Sometimes you're unsure about the case of file extensions or names. The `-iname` option performs case-insensitive matching:

```bash
find /home/user/documents -iname "*.PDF"
```

This command finds PDF files regardless of whether the extension is `.pdf`, `.PDF`, or `.Pdf`, which is helpful when dealing with files from different operating systems.

## Using Question Mark for Single Character Matching

The question mark wildcard matches exactly one character. This command finds files like `log1.txt`, `log2.txt`, but not `log10.txt`:

```bash
find /var/log -name "log?.txt"
```

This pattern is particularly useful when searching for numbered files with predictable naming conventions.

## Finding Files Starting with Specific Patterns

You can search for files that begin with certain text. This command finds all configuration files that start with "nginx":

```bash
find /etc -name "nginx*"
```

This matches files like `nginx.conf`, `nginx.conf.backup`, or `nginx-site-available`, making it easy to locate related configuration files.

## Combining Wildcards with Directory Paths

Wildcards work within directory paths as well. This command searches for CSS files within any `assets` directory:

```bash
find . -path "*/assets/*.css"
```

The `-path` option matches against the entire file path, not just the filename. This approach helps you locate files in specific directory structures within larger projects.

## Finding Files with Specific Character Sets

You can use bracket notation to match specific character sets. This command finds log files for specific months:

```bash
find /var/log -name "access-2024-[01][0-9]-*.log"
```

This pattern matches log files from January through December 2024, with any day and additional text after the date. The bracket notation `[01]` matches either 0 or 1, while `[0-9]` matches any digit.

## Excluding Certain Patterns

Sometimes you need to find files that don't match a pattern. This command finds all files except those ending in `.tmp`:

```bash
find . -type f ! -name "*.tmp"
```

The exclamation mark negates the condition, and `-type f` ensures you only match regular files, not directories.

## Finding Files by Size and Pattern

You can combine wildcard patterns with other find criteria. This command locates large image files:

```bash
find . -name "*.jpg" -size +1M
```

This finds JPEG files larger than 1 megabyte, which is useful for identifying files that might need compression or optimization.

## Using Find with Maximum Depth

When you want to limit how deep the search goes into subdirectories, use the `-maxdepth` option:

```bash
find . -maxdepth 2 -name "*.json"
```

This command only searches the current directory and one level of subdirectories for JSON files, preventing unnecessarily deep searches in large directory structures.

## Advanced Pattern Matching with Regular Expressions

For more complex patterns, you can use regular expressions with the `-regex` option:

```bash
find . -regex ".*\.\(jpg\|png\|gif\)$"
```

This finds files ending with any of the three image extensions. Regular expressions provide more flexibility than basic wildcards for complex matching requirements.

## Performance Considerations

When searching large directory trees, consider using the `-type f` option to only match files:

```bash
find /home -type f -name "*.log"
```

This prevents the command from trying to match directories against your pattern, improving performance and reducing irrelevant matches.

## Next Steps

You can now efficiently locate files using pattern matching across your filesystem. Consider combining these techniques with other find options like `-mtime` for date-based searches or `-exec` to perform actions on found files. You might also explore `locate` and `updatedb` for faster searching of frequently accessed files.

Good luck with your file searches!
