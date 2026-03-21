---
title: 'Understanding the Difference Between sh and Bash'
excerpt: 'Discover the key differences between sh and Bash shells, including feature compatibility, portability considerations, and when to use each one in your shell scripts and system administration tasks.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-10-03'
publishedAt: '2024-10-03T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell
  - Linux
  - Unix
  - DevOps
---

## TLDR

`sh` is a POSIX-compliant shell that runs on virtually all Unix-like systems with a minimal, standardized feature set. `bash` (Bourne Again Shell) is a more feature-rich shell with additional programming capabilities like arrays, better string manipulation, and extended test operators. While `bash` is backward compatible with `sh`, not all `bash` features work in `sh`. Use `sh` for maximum portability and `bash` when you need advanced features.

## What is sh?

The `sh` shell, originally the Bourne shell, is the original Unix shell developed in the 1970s. On modern systems, `/bin/sh` is typically a link to a POSIX-compliant shell. Depending on your system, this might be `dash`, `bash` in POSIX mode, or another lightweight shell.

You can check what `/bin/sh` points to on your system:

```bash
ls -l /bin/sh
```

On Ubuntu and Debian systems, you'll typically see:

```
lrwxrwxrwx 1 root root 4 Mar 23  2024 /bin/sh -> dash
```

On Red Hat-based systems like CentOS or Fedora:

```
lrwxrwxrwx 1 root root 4 Mar 23  2024 /bin/sh -> bash
```

The key characteristic of `sh` is its adherence to the POSIX standard, which defines a minimum set of features that all compliant shells must support. This makes scripts written for `sh` highly portable across different Unix and Linux distributions.

## What is Bash?

Bash (Bourne Again Shell) is a superset of the Bourne shell created as part of the GNU Project. It includes all the features of `sh` plus many enhancements designed to make shell scripting more convenient and scripting more powerful.

Bash is the default interactive shell on most Linux distributions and macOS (though macOS switched to zsh as the default in newer versions, bash is still available).

## Key Differences in Features

Here's where bash and sh diverge in functionality:

**Arrays** - Bash supports indexed and associative arrays, while sh does not:

```bash
#!/bin/bash
# This works in bash but not in sh
servers=("web1" "web2" "db1")
echo "${servers[0]}"  # Outputs: web1
```

In sh, you'd need to use workarounds with space-separated strings or multiple variables.

**String Manipulation** - Bash provides built-in string operations that don't exist in sh:

```bash
#!/bin/bash
filename="report.txt"
echo "${filename%.txt}"  # Outputs: report (removes extension)
echo "${filename/report/summary}"  # Outputs: summary.txt
```

In sh, you'd need to use external tools like `sed` or `cut` for these operations.

**Extended Test Operators** - Bash supports `[[` for testing, which provides more features than the standard `[` operator:

```bash
#!/bin/bash
if [[ "$filename" == *.txt ]]; then
    echo "This is a text file"
fi
```

The `[[` operator supports pattern matching, regular expressions, and doesn't require quoting variables. In sh, you're limited to the basic `[` operator.

**Arithmetic** - Bash has the `$(( ))` syntax for arithmetic, while sh requires the `expr` command:

```bash
#!/bin/bash
# Bash way
count=$((count + 1))

#!/bin/sh
# sh way
count=$(expr $count + 1)
```

Bash's arithmetic syntax is cleaner and doesn't spawn a separate process.

**Functions** - Both support functions, but bash allows the `function` keyword and local variables:

```bash
#!/bin/bash
function deploy() {
    local environment=$1
    echo "Deploying to $environment"
}
```

In sh, you'd write:

```sh
#!/bin/sh
deploy() {
    environment=$1
    echo "Deploying to $environment"
}
```

The difference here is subtle, but bash's `local` keyword prevents variable pollution in the global scope.

## How Execution Differs

When you execute a script, the shebang line (the first line starting with `#!`) determines which interpreter runs it:

```
Script with #!/bin/sh
        |
        v
    Runs with sh
        |
        v
    POSIX mode, limited features
        |
        v
    Maximum portability


Script with #!/bin/bash
        |
        v
    Runs with bash
        |
        v
    Extended features available
        |
        v
    Requires bash installation
```

If you run a script explicitly with a specific shell, the shebang is ignored:

```bash
sh myscript.sh      # Runs with sh regardless of shebang
bash myscript.sh    # Runs with bash regardless of shebang
```

## Portability Considerations

If you're writing scripts for system administration or distribution across different Unix-like systems, portability matters. Here's when to choose each:

**Use sh when:**
- You need the script to run on various Unix systems (BSD, Solaris, AIX)
- You're writing system initialization scripts
- You want minimal dependencies
- Performance is critical (dash is faster than bash)

**Use bash when:**
- You're targeting Linux systems specifically
- You need arrays or associative arrays
- Complex string manipulation is required
- You want cleaner arithmetic syntax
- The script is for your own team's standardized environment

## Practical Example: Portable vs Bash-Specific

Here's a script that checks disk usage written two ways.

**Portable sh version:**

```sh
#!/bin/sh

threshold=90

df -h | tail -n +2 | while read filesystem size used avail capacity mounted; do
    # Remove the % sign from capacity
    usage=$(echo "$capacity" | sed 's/%//')

    if [ "$usage" -gt "$threshold" ]; then
        echo "Warning: $mounted is at $capacity"
    fi
done
```

**Bash version with more features:**

```bash
#!/bin/bash

threshold=90
declare -A warnings

while read line; do
    if [[ "$line" =~ ^/dev ]]; then
        fields=($line)
        usage=${fields[4]%\%}
        mount=${fields[5]}

        if (( usage > threshold )); then
            warnings[$mount]=$usage
        fi
    fi
done < <(df -h)

if [ ${#warnings[@]} -gt 0 ]; then
    echo "Disk usage warnings:"
    for mount in "${!warnings[@]}"; do
        echo "  $mount: ${warnings[$mount]}%"
    done
else
    echo "All filesystems below threshold"
fi
```

The bash version uses arrays, process substitution (`< <()`), and built-in arithmetic. It's more readable if you're familiar with bash, but won't work on systems without it.

## Testing Your Scripts

You can test how your script behaves in different shells:

```bash
# Test with sh
sh -n myscript.sh   # Check syntax without running

# Test with bash
bash -n myscript.sh

# Run with explicit shell
sh myscript.sh
bash myscript.sh
```

For strict POSIX compliance checking, use `shellcheck`:

```bash
shellcheck -s sh myscript.sh
```

This tool catches bash-specific features in scripts intended for sh.

## Compatibility in the Real World

Most Linux distributions have bash installed by default, but lightweight containers and embedded systems often use dash or another minimal shell for `/bin/sh`. If you're building Docker images based on Alpine Linux, for example, `/bin/sh` is busybox ash, not bash.

This causes problems when developers write scripts with a `#!/bin/sh` shebang but use bash features:

```bash
#!/bin/sh
# This fails on Alpine Linux if sh is ash
if [[ "$ENV" == "production" ]]; then
    echo "Deploying to production"
fi
```

The `[[` operator isn't available in basic sh implementations. Change the shebang to `#!/bin/bash` or rewrite using POSIX syntax:

```sh
#!/bin/sh
if [ "$ENV" = "production" ]; then
    echo "Deploying to production"
fi
```

When writing scripts for containers or system automation, being mindful of these differences saves debugging time. Check your shebangs match the features you're using, and test on the target environment when possible. If you need bash features, don't try to force them into an sh script - just use the right tool for the job and make sure bash is available where the script will run.
