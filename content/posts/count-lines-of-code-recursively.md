---
title: 'How to Count Lines of Code in a Directory Recursively'
excerpt: 'Discover multiple methods to count source code lines across entire directory trees, including filtering by file types and excluding specific directories.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-04-12'
publishedAt: '2024-04-12T16:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Code Analysis
  - File Management
  - Terminal
  - Development Tools
---

Counting lines of code is essential for project analysis, code reviews, and understanding codebase complexity. Whether you're tracking development progress or preparing project documentation, knowing how to accurately count code lines across directory structures is a valuable skill.

## Basic Line Counting with find and wc

The simplest approach uses `find` to locate files and `wc` to count lines:

```bash
find . -type f -name "*.py" | xargs wc -l
```

This command finds all Python files in the current directory and subdirectories, then counts lines in each file. The output shows individual file counts plus a total at the bottom.

For a cleaner total-only output:

```bash
find . -type f -name "*.py" -exec cat {} + | wc -l
```

This concatenates all matching files and provides a single line count for the entire codebase.

## Counting Multiple File Types

Most projects contain various source file types. You can count them together using multiple patterns:

```bash
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -exec cat {} + | wc -l
```

For a more readable approach with variables:

```bash
# Define file extensions for your project
extensions=("*.py" "*.js" "*.ts" "*.html" "*.css" "*.sql")

total_lines=0
for ext in "${extensions[@]}"; do
    count=$(find . -type f -name "$ext" -exec cat {} + 2>/dev/null | wc -l)
    echo "$ext: $count lines"
    total_lines=$((total_lines + count))
done

echo "Total: $total_lines lines"
```

## Excluding Directories and Files

Real projects often contain generated code, dependencies, or build artifacts that shouldn't be counted. Use `-not -path` to exclude these:

```bash
find . -type f -name "*.py" \
    -not -path "./venv/*" \
    -not -path "./.git/*" \
    -not -path "./build/*" \
    -not -path "./__pycache__/*" \
    -exec cat {} + | wc -l
```

For Node.js projects, exclude common directories:

```bash
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
    -not -path "./node_modules/*" \
    -not -path "./dist/*" \
    -not -path "./build/*" \
    -not -path "./.next/*" \
    -exec cat {} + | wc -l
```

## Advanced Filtering with Detailed Output

Create a script that provides comprehensive statistics:

```bash
#!/bin/bash

# Function to count lines for specific file types
count_lines() {
    local pattern="$1"
    local description="$2"

    local files=$(find . -type f -name "$pattern" \
        -not -path "./node_modules/*" \
        -not -path "./venv/*" \
        -not -path "./.git/*" \
        -not -path "./dist/*" \
        -not -path "./build/*" \
        2>/dev/null)

    if [[ -n "$files" ]]; then
        local count=$(echo "$files" | xargs cat 2>/dev/null | wc -l)
        local file_count=$(echo "$files" | wc -l)
        printf "%-20s %8d lines in %3d files\n" "$description" "$count" "$file_count"
        return $count
    else
        printf "%-20s %8d lines in %3d files\n" "$description" "0" "0"
        return 0
    fi
}

echo "Code Line Count Analysis"
echo "========================"

total=0

# Count different file types
count_lines "*.py" "Python"; total=$((total + $?))
count_lines "*.js" "JavaScript"; total=$((total + $?))
count_lines "*.ts" "TypeScript"; total=$((total + $?))
count_lines "*.jsx" "React JSX"; total=$((total + $?))
count_lines "*.tsx" "React TSX"; total=$((total + $?))
count_lines "*.html" "HTML"; total=$((total + $?))
count_lines "*.css" "CSS"; total=$((total + $?))
count_lines "*.scss" "SCSS"; total=$((total + $?))
count_lines "*.java" "Java"; total=$((total + $?))
count_lines "*.cpp" "C++"; total=$((total + $?))
count_lines "*.c" "C"; total=$((total + $?))
count_lines "*.go" "Go"; total=$((total + $?))
count_lines "*.rs" "Rust"; total=$((total + $?))
count_lines "*.php" "PHP"; total=$((total + $?))

echo "========================"
printf "%-20s %8d lines total\n" "TOTAL" "$total"
```

## Excluding Comments and Blank Lines

For more accurate code analysis, you might want to exclude comments and empty lines:

```bash
# Count only non-empty, non-comment lines in Python files
find . -type f -name "*.py" \
    -not -path "./venv/*" \
    -not -path "./.git/*" \
    -exec grep -v '^\s*#' {} + | \
    grep -v '^\s*$' | \
    wc -l
```

For multiple comment styles:

```bash
#!/bin/bash

count_code_lines() {
    local file="$1"
    local ext="${file##*.}"

    case "$ext" in
        py)
            # Remove Python comments and empty lines
            grep -v '^\s*#' "$file" | grep -v '^\s*$' | wc -l
            ;;
        js|ts|jsx|tsx|java|cpp|c|go|rs)
            # Remove // comments, /* */ comments, and empty lines
            sed 's|//.*||g' "$file" | \
            sed 's|/\*.*\*/||g' | \
            grep -v '^\s*$' | \
            wc -l
            ;;
        html|xml)
            # Remove HTML comments and empty lines
            sed 's|<!--.*-->||g' "$file" | \
            grep -v '^\s*$' | \
            wc -l
            ;;
        *)
            # Default: just remove empty lines
            grep -v '^\s*$' "$file" | wc -l
            ;;
    esac
}

export -f count_code_lines

# Find all source files and count meaningful lines
find . -type f \( \
    -name "*.py" -o -name "*.js" -o -name "*.ts" -o \
    -name "*.jsx" -o -name "*.tsx" -o -name "*.java" -o \
    -name "*.cpp" -o -name "*.c" -o -name "*.go" -o \
    -name "*.rs" -o -name "*.html" -o -name "*.xml" \
\) \
    -not -path "./node_modules/*" \
    -not -path "./venv/*" \
    -not -path "./.git/*" \
    -exec bash -c 'count_code_lines "$0"' {} \; | \
    awk '{sum += $1} END {print sum " lines of actual code"}'
```

## Using External Tools

For professional code analysis, consider specialized tools:

```bash
# Install cloc (Count Lines of Code)
# On macOS: brew install cloc
# On Ubuntu: sudo apt install cloc

# Basic usage
cloc .

# Exclude specific directories
cloc . --exclude-dir=node_modules,venv,.git,dist,build

# Output to different formats
cloc . --json > code_stats.json
cloc . --csv > code_stats.csv
```

The `cloc` tool automatically recognizes file types, excludes comments and blank lines, and provides detailed statistics including complexity metrics.

## Project-Specific Analysis

Create a project analysis script that adapts to your specific needs:

```bash
#!/bin/bash

PROJECT_DIR="${1:-.}"
EXCLUDE_DIRS=("node_modules" "venv" ".git" "dist" "build" "__pycache__" ".next" "vendor")

echo "Analyzing project: $PROJECT_DIR"
echo "================================"

# Build exclude pattern for find command
exclude_pattern=""
for dir in "${EXCLUDE_DIRS[@]}"; do
    exclude_pattern="$exclude_pattern -not -path \"./$dir/*\""
done

# Count total files
total_files=$(eval "find '$PROJECT_DIR' -type f $exclude_pattern" | wc -l)
echo "Total files: $total_files"

# Count source code files
source_files=$(eval "find '$PROJECT_DIR' -type f \( -name \"*.py\" -o -name \"*.js\" -o -name \"*.ts\" -o -name \"*.jsx\" -o -name \"*.tsx\" -o -name \"*.html\" -o -name \"*.css\" -o -name \"*.java\" -o -name \"*.cpp\" -o -name \"*.c\" -o -name \"*.go\" -o -name \"*.rs\" -o -name \"*.php\" \) $exclude_pattern" | wc -l)
echo "Source code files: $source_files"

# Count total lines in source files
total_lines=$(eval "find '$PROJECT_DIR' -type f \( -name \"*.py\" -o -name \"*.js\" -o -name \"*.ts\" -o -name \"*.jsx\" -o -name \"*.tsx\" -o -name \"*.html\" -o -name \"*.css\" -o -name \"*.java\" -o -name \"*.cpp\" -o -name \"*.c\" -o -name \"*.go\" -o -name \"*.rs\" -o -name \"*.php\" \) $exclude_pattern -exec cat {} +" | wc -l)
echo "Total lines of code: $total_lines"

# Calculate average lines per file
if [ $source_files -gt 0 ]; then
    avg_lines=$((total_lines / source_files))
    echo "Average lines per file: $avg_lines"
fi
```

These methods give you flexibility to count lines of code according to your specific project requirements, whether you need simple totals or detailed analysis with exclusions and filtering.
