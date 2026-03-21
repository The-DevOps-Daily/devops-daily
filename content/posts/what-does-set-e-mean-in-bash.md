---
title: "What Does 'set -e' Mean in a Bash Script?"
excerpt: "Learn what 'set -e' does in Bash scripts, why it's useful for error handling, and when you might want to use or avoid it. Includes practical examples and caveats."
category:
  name: 'Bash'
  slug: 'bash'
date: '2025-04-18'
publishedAt: '2025-04-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Error Handling
  - DevOps
---

## TLDR

The `set -e` command in a Bash script tells the shell to exit immediately if any command returns a non-zero (error) status. This helps catch failures early and prevents scripts from continuing after an error, which is especially useful in automation and CI/CD pipelines. However, it can sometimes cause scripts to exit unexpectedly if not used carefully.

## Why Use `set -e`?

By default, Bash scripts keep running even if a command fails. This can lead to subtle bugs or unwanted side effects, especially in deployment or automation scripts. Adding `set -e` at the top of your script makes it safer by stopping execution as soon as something goes wrong.

Here's a simple example:

```bash
#!/bin/bash
set -e

mkdir /tmp/mydir
cd /tmp/mydir
cp /nonexistent/file .
echo "This line will not run if the copy fails."
```

**What happens here?**

- If `cp /nonexistent/file .` fails (because the file doesn't exist), the script exits immediately.
- The `echo` line is never reached.

Without `set -e`, the script would keep running, which could cause problems later on.

## How Does It Work?

When you use `set -e`, Bash checks the exit status of each command. If any command (that isn't part of an `if` or `while` test, or a command in a pipeline that is handled) fails, the script stops right there.

The overall flow looks like this:

```
+-------------------+
|  Script starts    |
+-------------------+
          |
          v
+-------------------+
|  Run command 1    |
+-------------------+
          |
          v
+-------------------+
|  Command fails?   |--Yes--> Exit script
+-------------------+
          |
         No
          v
+-------------------+
|  Run next command |
+-------------------+
```

## Common Pitfalls and Caveats

While `set -e` is helpful, it can sometimes cause confusion:

- **Pipelines:** By default, `set -e` only checks the exit status of the last command in a pipeline. To make the script exit if _any_ command in a pipeline fails, add `set -o pipefail` as well.
- **Commands in `if` or `while`:** If a command fails inside an `if` or `while` test, the script does not exit.
- **Subshells and functions:** Errors in subshells or functions may not always cause the main script to exit, depending on how they're called.

Example with `pipefail`:

```bash
#!/bin/bash
set -e
set -o pipefail

grep "foo" file.txt | sort | tee output.txt
```

If `grep` fails (e.g., file.txt doesn't exist), the script exits immediately, not just if `tee` fails.

## When Not to Use `set -e`

There are cases where you might not want your script to exit on every error:

- When you expect some commands to fail and want to handle those failures manually.
- In scripts that need to clean up resources even after an error (use `trap` for cleanup).

You can temporarily disable `set -e` with `set +e` and re-enable it with `set -e`:

```bash
set +e
some_command_that_might_fail
set -e
```

## Conclusion

Using `set -e` in your Bash scripts is a simple way to make them more robust and catch errors early. Just be aware of its limitations and test your scripts to avoid surprises. For even safer scripts, combine it with `set -o pipefail` and handle expected errors explicitly.
