---
title: 'How to Iterate Over a Range of Numbers in Bash Using Variables'
excerpt: 'Learn different methods to loop through number ranges defined by variables in Bash, from simple for loops to advanced sequence generation techniques.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-03-08'
publishedAt: '2024-03-08T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Scripting
  - Loops
  - Variables
  - Shell
---

Iterating over a range of numbers is a fundamental task in Bash scripting. When the range boundaries are stored in variables rather than hardcoded values, you need specific techniques to make the loop work correctly.

## The Challenge with Variable Ranges

Unlike languages that support dynamic range syntax, Bash requires careful handling when loop boundaries come from variables. The standard brace expansion `{1..10}` doesn't work with variables because Bash expands braces before variable substitution occurs.

```bash
# This won't work as expected
start=5
end=15
for i in {$start..$end}; do
    echo $i
done
# Output: {5..15} (literal string, not expanded)
```

## Method 1: Using seq Command

The `seq` command generates sequences of numbers and works seamlessly with variables:

```bash
start=5
end=15

for i in $(seq $start $end); do
    echo "Processing item $i"
done
```

You can also specify a step value for non-consecutive numbers:

```bash
start=2
end=20
step=3

for i in $(seq $start $step $end); do
    echo "Number: $i"
done
# Output: 2, 5, 8, 11, 14, 17, 20
```

The `seq` command is particularly useful for floating-point sequences:

```bash
for i in $(seq 1.5 0.5 3.5); do
    echo "Value: $i"
done
# Output: 1.5, 2.0, 2.5, 3.0, 3.5
```

## Method 2: C-Style For Loop

Bash supports C-style for loops, which handle variables naturally:

```bash
start=10
end=20

for ((i=start; i<=end; i++)); do
    echo "Current number: $i"
done
```

This method gives you full control over the increment logic:

```bash
start=1
end=100

# Skip even numbers
for ((i=start; i<=end; i+=2)); do
    echo "Odd number: $i"
done
```

You can also decrement through ranges:

```bash
start=10
end=1

for ((i=start; i>=end; i--)); do
    echo "Countdown: $i"
done
```

## Method 3: While Loop with Counter

For more complex iteration logic, use a while loop with a manual counter:

```bash
start=5
end=25
counter=$start

while [ $counter -le $end ]; do
    echo "Processing iteration $counter"

    # Your logic here
    if [ $((counter % 5)) -eq 0 ]; then
        echo "  Milestone reached at $counter"
    fi

    counter=$((counter + 1))
done
```

This approach works well when you need conditional logic within the loop or when dealing with complex stepping patterns.

## Method 4: Using eval with Brace Expansion

You can force brace expansion to work with variables using `eval`, though this method requires caution:

```bash
start=3
end=8

for i in $(eval echo {$start..$end}); do
    echo "Number: $i"
done
```

Be careful with `eval` as it can execute arbitrary code. Only use this method when you control the input variables and understand the security implications.

## Practical Examples

Here's a real-world example that processes log files based on date ranges:

```bash
#!/bin/bash

start_date=20240301
end_date=20240307
current_date=$start_date

while [ $current_date -le $end_date ]; do
    log_file="/var/log/app-$current_date.log"

    if [ -f "$log_file" ]; then
        echo "Processing $log_file"
        grep "ERROR" "$log_file" > "errors-$current_date.txt"
    else
        echo "Log file $log_file not found"
    fi

    # Increment date (simplified for consecutive dates)
    current_date=$((current_date + 1))
done
```

For batch file operations with numbered files:

```bash
start_file=1
end_file=50

for file_num in $(seq $start_file $end_file); do
    input_file="data_${file_num}.txt"
    output_file="processed_${file_num}.txt"

    if [ -f "$input_file" ]; then
        # Process the file
        sed 's/old_pattern/new_pattern/g' "$input_file" > "$output_file"
        echo "Processed $input_file -> $output_file"
    fi
done
```

## Performance Considerations

For large ranges, the C-style loop is generally more efficient than `seq` because it doesn't create a large list in memory:

```bash
# More memory efficient for large ranges
start=1
end=1000000

for ((i=start; i<=end; i++)); do
    # Process without storing all numbers in memory
    echo $i > /dev/null
done
```

Choose the method that best fits your use case. The `seq` command is readable and works well for moderate ranges, while C-style loops offer better performance and flexibility for complex iteration patterns.
