---
title: 'How to Concatenate String Variables in Bash'
excerpt: 'Learn multiple ways to combine string variables in Bash scripts, from simple concatenation to complex string operations with practical examples.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-10-22'
publishedAt: '2024-10-22T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Scripting
  - Strings
  - Linux
  - Shell
---

String concatenation is one of the most common operations in Bash scripting. Whether you're building file paths, creating log messages, or constructing command arguments, you'll frequently need to combine multiple string variables into a single string.

Bash provides several methods for concatenating strings, each with its own advantages and use cases. This guide covers the most effective approaches with practical examples you can use in your scripts.

## Basic String Concatenation

The simplest way to concatenate strings in Bash is by placing variables next to each other without any operators:

```bash
first_name="John"
last_name="Doe"
full_name="$first_name$last_name"
echo "$full_name"
# Output: JohnDoe
```

This method works by expanding the variables and combining their values. However, you'll often want to add spaces or other separators between the strings:

```bash
first_name="John"
last_name="Doe"
full_name="$first_name $last_name"
echo "$full_name"
# Output: John Doe
```

## Using Curly Braces for Clarity

When concatenating variables with other text, use curly braces to clearly define variable boundaries:

```bash
filename="report"
extension="txt"
date="2024-10-22"
full_filename="${filename}_${date}.${extension}"
echo "$full_filename"
# Output: report_2024-10-22.txt
```

This approach prevents ambiguity when the variable name might be confused with surrounding text. Without curly braces, Bash might misinterpret where the variable name ends.

## Concatenating with the += Operator

The `+=` operator appends text to an existing variable, which is useful for building strings incrementally:

```bash
log_message="[INFO]"
log_message+=" Process started"
log_message+=" at $(date)"
echo "$log_message"
# Output: [INFO] Process started at Tue Oct 22 10:00:00 UTC 2024
```

This method is particularly useful in loops or when building strings conditionally:

```bash
config_flags=""
if [[ "$debug_mode" == "true" ]]; then
    config_flags+="--debug "
fi
if [[ "$verbose" == "true" ]]; then
    config_flags+="--verbose "
fi
echo "Final flags: $config_flags"
```

## Using printf for Formatted Concatenation

The `printf` command offers more control over string formatting and concatenation:

```bash
user="alice"
host="server01"
port="22"
ssh_command=$(printf "ssh %s@%s -p %d" "$user" "$host" "$port")
echo "$ssh_command"
# Output: ssh alice@server01 -p 22
```

This approach is especially useful when you need specific formatting or when dealing with numbers and special characters.

## Concatenating Arrays of Strings

When working with multiple strings stored in an array, you can concatenate them using parameter expansion:

```bash
words=("Hello" "from" "the" "server")
sentence=$(IFS=' '; echo "${words[*]}")
echo "$sentence"
# Output: Hello from the server
```

The `IFS` (Internal Field Separator) variable controls what character is used to join the array elements. You can use different separators:

```bash
paths=("/usr/bin" "/usr/local/bin" "/opt/bin")
path_string=$(IFS=':'; echo "${paths[*]}")
echo "$path_string"
# Output: /usr/bin:/usr/local/bin:/opt/bin
```

## Building File Paths Safely

When concatenating strings to build file paths, be careful about trailing slashes:

```bash
base_dir="/var/log"
service_name="nginx"
log_file="access.log"

# Remove trailing slash if present
base_dir="${base_dir%/}"
full_path="$base_dir/$service_name/$log_file"
echo "$full_path"
# Output: /var/log/nginx/access.log
```

The `${base_dir%/}` syntax removes a trailing slash if it exists, preventing double slashes in your paths.

## Concatenating with Command Substitution

You can concatenate the output of commands with other strings:

```bash
hostname=$(hostname)
timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
backup_name="backup_${hostname}_${timestamp}.tar.gz"
echo "$backup_name"
# Output: backup_webserver01_2024-10-22_10-30-45.tar.gz
```

This technique is useful for creating unique filenames or incorporating system information into your strings.

## Handling Special Characters

When concatenating strings that might contain special characters, use proper quoting:

```bash
user_input="file with spaces & special chars"
safe_filename="${user_input// /_}"  # Replace spaces with underscores
safe_filename="${safe_filename//&/_and_}"  # Replace & with _and_
final_name="processed_${safe_filename}.txt"
echo "$final_name"
# Output: processed_file_with_spaces__and__special_chars.txt
```

## Performance Considerations

For simple concatenations, direct variable expansion is fastest. For complex string building or many concatenations, consider using arrays and joining them at the end:

```bash
# Efficient for many concatenations
parts=()
parts+=("Error occurred")
parts+=("in function")
parts+=("process_data")
parts+=("at line 42")

error_message=$(IFS=' '; echo "${parts[*]}")
echo "$error_message"
# Output: Error occurred in function process_data at line 42
```

## Practical Example: Building SQL Queries

Here's a real-world example of string concatenation for building database queries:

```bash
#!/bin/bash

table="users"
columns="id, username, email"
condition_field="created_date"
condition_value="2024-01-01"

query="SELECT ${columns} FROM ${table}"
query+=" WHERE ${condition_field} >= '${condition_value}'"
query+=" ORDER BY ${condition_field} DESC"
query+=" LIMIT 100;"

echo "Generated query:"
echo "$query"
```

This approach makes your SQL construction more readable and maintainable than trying to build the entire query in one line.

String concatenation in Bash is straightforward once you understand the different methods available. Choose the approach that best fits your specific use case, considering factors like readability, performance, and the complexity of your string operations.
