---
title: 'How to Count Number of Lines in Files Using Linux Terminal'
excerpt: 'Learn different methods to count lines in text files like CSV, TXT, and other non-binary files using wc, awk, sed, and other Linux command-line tools.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-08'
publishedAt: '2024-12-08T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - wc command
  - file analysis
  - text processing
  - CSV
  - command line
---

Counting lines in text files is a common task when analyzing data files, logs, or any text-based content. Linux provides several efficient methods to count lines in non-binary files like CSV, TXT, or configuration files.

## Prerequisites

You'll need access to a Linux terminal. The commands shown work on most Linux distributions and also on macOS and other Unix-like systems.

## Method 1: Using wc Command (Most Common)

The `wc` (word count) command is the standard tool for counting lines, words, and characters in files:

```bash
wc -l filename.txt
```

This outputs the line count followed by the filename:

```
150 filename.txt
```

To get only the number without the filename:

```bash
wc -l < filename.txt
```

Output:

```
150
```

## Method 2: Counting Lines in Multiple Files

To count lines in multiple files simultaneously:

```bash
wc -l file1.txt file2.csv file3.log
```

Output:

```
   150 file1.txt
   237 file2.csv
    89 file3.log
   476 total
```

Use wildcards to count lines in all files of a specific type:

```bash
wc -l *.csv
wc -l *.txt
wc -l *.log
```

## Method 3: Using cat and wc Together

For single files, you can pipe cat output to wc:

```bash
cat filename.txt | wc -l
```

This is less efficient than `wc -l filename.txt` but useful when combined with other operations:

```bash
cat file1.txt file2.txt | wc -l
```

## Method 4: Using awk Command

The `awk` command can also count lines and is useful for more complex operations:

```bash
awk 'END {print NR}' filename.txt
```

This prints the number of records (lines) processed. The advantage of awk is that you can combine counting with other text processing:

```bash
awk 'NF > 0 {count++} END {print count}' filename.txt
```

This counts only non-empty lines (lines with at least one field).

## Method 5: Using sed Command

The `sed` command can count lines as a side effect:

```bash
sed -n '$=' filename.txt
```

This prints the line number of the last line, effectively giving you the total count.

## Method 6: Using grep Command

Count lines containing specific patterns:

```bash
grep -c ".*" filename.txt
```

The `.*` pattern matches any line (including empty lines). This is equivalent to `wc -l`.

To count only non-empty lines:

```bash
grep -c "." filename.txt
```

The `.` pattern matches lines with at least one character.

## Counting Lines in CSV Files

For CSV files, you might want to count data rows (excluding headers):

```bash
# Count all lines including header
wc -l data.csv

# Count data rows only (excluding header)
tail -n +2 data.csv | wc -l
```

If your CSV has multiple header lines:

```bash
# Skip first 3 lines (headers) and count data rows
tail -n +4 data.csv | wc -l
```

## Counting Lines with Conditions

**Count non-empty lines only:**

```bash
awk 'NF' filename.txt | wc -l
```

**Count lines longer than 80 characters:**

```bash
awk 'length > 80' filename.txt | wc -l
```

**Count lines matching a pattern:**

```bash
grep "error" logfile.txt | wc -l
```

**Count lines NOT matching a pattern:**

```bash
grep -v "debug" logfile.txt | wc -l
```

## Working with Large Files

For very large files, `wc -l` is optimized and usually the fastest option:

```bash
time wc -l very_large_file.txt
```

If you need to monitor progress for extremely large files:

```bash
pv large_file.txt | wc -l
```

This shows a progress bar while counting (requires `pv` to be installed).

## Counting Lines in Compressed Files

For compressed files, decompress and count in one command:

```bash
# For gzip files
zcat file.txt.gz | wc -l
gunzip -c file.txt.gz | wc -l

# For bzip2 files
bzcat file.txt.bz2 | wc -l

# For xz files
xzcat file.txt.xz | wc -l
```

## Creating Reusable Functions

Add this function to your `.bashrc` or `.zshrc`:

```bash
count_lines() {
    if [ $# -eq 0 ]; then
        echo "Usage: count_lines <file1> [file2] [file3] ..."
        return 1
    fi

    for file in "$@"; do
        if [ -f "$file" ]; then
            lines=$(wc -l < "$file")
            echo "$file: $lines lines"
        else
            echo "$file: File not found"
        fi
    done
}
```

Usage:

```bash
count_lines data.csv logs.txt config.conf
```

## Counting Lines in Directory Recursively

Count lines in all text files within a directory:

```bash
find /path/to/directory -name "*.txt" -exec wc -l {} + | tail -1
```

For specific file types:

```bash
# Count lines in all CSV files
find . -name "*.csv" -exec wc -l {} + | tail -1

# Count lines in all log files
find . -name "*.log" -exec wc -l {} + | tail -1
```

## Practical Examples

**Analyze log file growth:**

```bash
# Count lines every hour
while true; do
    echo "$(date): $(wc -l < access.log) lines"
    sleep 3600
done
```

**Compare file sizes:**

```bash
echo "File sizes comparison:"
for file in *.csv; do
    printf "%-20s: %d lines\n" "$file" $(wc -l < "$file")
done
```

**Quick data validation:**

```bash
# Check if CSV has expected number of rows
expected_rows=1000
actual_rows=$(tail -n +2 data.csv | wc -l)
if [ "$actual_rows" -eq "$expected_rows" ]; then
    echo "Data validation passed: $actual_rows rows"
else
    echo "Data validation failed: expected $expected_rows, got $actual_rows"
fi
```

## Performance Comparison

For counting lines in large files, here's the performance order (fastest to slowest):

1. `wc -l filename` - Fastest, optimized for line counting
2. `wc -l < filename` - Nearly as fast, no filename output
3. `awk 'END {print NR}' filename` - Good for complex processing
4. `grep -c ".*" filename` - Slower, but useful for pattern counting
5. `cat filename | wc -l` - Slower due to unnecessary pipe

## Next Steps

Now that you can count lines in files, you might want to learn about:

- Advanced text processing with `awk` and `sed`
- Analyzing CSV files with command-line tools
- Working with log file analysis and monitoring
- Using `cut`, `sort`, and `uniq` for data processing
