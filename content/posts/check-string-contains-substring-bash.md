---
title: 'How to Check if a String Contains a Substring in Bash'
excerpt: 'Learn multiple methods to check for substring presence in Bash, including pattern matching, case-insensitive searches, and practical examples for string validation.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-11-05'
publishedAt: '2024-11-05T16:20:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - shell scripting
  - string manipulation
  - Linux
  - text processing
---

String substring checking is a fundamental operation in Bash scripting. Whether you're validating input, parsing log files, or filtering data, knowing how to efficiently check if one string contains another is essential. Bash provides several methods for substring detection, each with different capabilities and performance characteristics.

## Prerequisites

You should have basic knowledge of Bash scripting and familiarity with variables and conditional statements. A Unix-like system (Linux, macOS, or WSL) is needed to test the examples.

## Using Pattern Matching with Double Brackets

The most common and readable method uses Bash's built-in pattern matching with double brackets:

```bash
#!/bin/bash

check_substring() {
    local main_string="$1"
    local substring="$2"

    if [[ "$main_string" == *"$substring"* ]]; then
        echo "✓ '$substring' found in '$main_string'"
        return 0
    else
        echo "✗ '$substring' not found in '$main_string'"
        return 1
    fi
}

# Test examples
text="The quick brown fox jumps over the lazy dog"
check_substring "$text" "quick"     # Found
check_substring "$text" "fox"       # Found
check_substring "$text" "cat"       # Not found
check_substring "$text" "QUICK"     # Not found (case sensitive)
```

The pattern `*"$substring"*` uses wildcards where `*` matches any characters, making this a simple and efficient substring check.

## Case-Insensitive Substring Detection

For case-insensitive matching, convert both strings to lowercase or use specific bash options:

```bash
#!/bin/bash

case_insensitive_check() {
    local main_string="$1"
    local substring="$2"

    # Method 1: Convert to lowercase
    local main_lower="${main_string,,}"
    local sub_lower="${substring,,}"

    if [[ "$main_lower" == *"$sub_lower"* ]]; then
        echo "✓ '$substring' found in '$main_string' (case-insensitive)"
        return 0
    else
        echo "✗ '$substring' not found in '$main_string' (case-insensitive)"
        return 1
    fi
}

# Method 2: Using shopt nocasematch
case_insensitive_shopt() {
    local main_string="$1"
    local substring="$2"

    # Enable case-insensitive matching
    shopt -s nocasematch

    if [[ "$main_string" == *"$substring"* ]]; then
        echo "✓ '$substring' found in '$main_string' (nocasematch)"
        result=0
    else
        echo "✗ '$substring' not found in '$main_string' (nocasematch)"
        result=1
    fi

    # Restore original setting
    shopt -u nocasematch
    return $result
}

# Test case-insensitive matching
text="The Quick Brown Fox"
case_insensitive_check "$text" "QUICK"
case_insensitive_shopt "$text" "brown"
```

Both methods achieve case-insensitive matching, with the `shopt` approach being useful when you need temporary case-insensitive behavior.

## Using grep for Substring Detection

The `grep` command provides powerful pattern matching capabilities for substring detection:

```bash
#!/bin/bash

grep_substring_check() {
    local main_string="$1"
    local substring="$2"

    if echo "$main_string" | grep -q "$substring"; then
        echo "✓ '$substring' found using grep"
        return 0
    else
        echo "✗ '$substring' not found using grep"
        return 1
    fi
}

# Case-insensitive grep
grep_case_insensitive() {
    local main_string="$1"
    local substring="$2"

    if echo "$main_string" | grep -qi "$substring"; then
        echo "✓ '$substring' found using grep -i"
        return 0
    else
        echo "✗ '$substring' not found using grep -i"
        return 1
    fi
}

# Using grep with regex patterns
grep_pattern_check() {
    local main_string="$1"
    local pattern="$2"

    if echo "$main_string" | grep -qE "$pattern"; then
        echo "✓ Pattern '$pattern' matched using grep -E"
        return 0
    else
        echo "✗ Pattern '$pattern' not matched using grep -E"
        return 1
    fi
}

# Examples
log_entry="2024-01-15 ERROR: Database connection failed"
grep_substring_check "$log_entry" "ERROR"
grep_case_insensitive "$log_entry" "error"
grep_pattern_check "$log_entry" "[0-9]{4}-[0-9]{2}-[0-9]{2}"  # Date pattern
```

Grep is particularly useful when you need regular expression matching or when processing external input.

## Practical Log File Processing

Here's a real-world example of substring checking for log analysis:

```bash
#!/bin/bash

analyze_log_file() {
    local log_file="$1"
    local error_count=0
    local warning_count=0
    local info_count=0

    if [[ ! -f "$log_file" ]]; then
        echo "Error: Log file not found: $log_file"
        return 1
    fi

    echo "Analyzing log file: $log_file"
    echo "================================"

    while IFS= read -r line; do
        # Check for different log levels
        if [[ "$line" == *"ERROR"* ]]; then
            ((error_count++))
            echo "ERROR: $line"
        elif [[ "$line" == *"WARNING"* ]] || [[ "$line" == *"WARN"* ]]; then
            ((warning_count++))
            echo "WARNING: $line"
        elif [[ "$line" == *"INFO"* ]]; then
            ((info_count++))
        fi

        # Check for specific issues
        if [[ "$line" == *"connection"* ]] && [[ "$line" == *"failed"* ]]; then
            echo "⚠️  Connection issue detected: $line"
        fi

        if [[ "$line" == *"timeout"* ]]; then
            echo "⏱️  Timeout detected: $line"
        fi

    done < "$log_file"

    echo
    echo "Summary:"
    echo "Errors: $error_count"
    echo "Warnings: $warning_count"
    echo "Info messages: $info_count"
}

# Create sample log file for testing
cat > /tmp/sample.log << 'EOF'
2024-01-15 10:30:15 INFO: Application started
2024-01-15 10:30:20 INFO: Database connection established
2024-01-15 10:35:45 WARNING: High memory usage detected
2024-01-15 10:40:12 ERROR: Database connection failed
2024-01-15 10:40:15 INFO: Retrying connection
2024-01-15 10:40:30 ERROR: Connection timeout occurred
2024-01-15 10:45:00 INFO: Connection restored
EOF

analyze_log_file "/tmp/sample.log"
```

This example shows how substring checking helps categorize and filter log entries for analysis.

## URL and Email Validation

Use substring checks for basic input validation:

```bash
#!/bin/bash

validate_email() {
    local email="$1"

    # Basic email validation using substring checks
    if [[ "$email" == *"@"* ]] && [[ "$email" == *"."* ]]; then
        # Check for valid format
        if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            echo "✓ Valid email format: $email"
            return 0
        else
            echo "✗ Invalid email format: $email"
            return 1
        fi
    else
        echo "✗ Email missing @ or . symbols: $email"
        return 1
    fi
}

validate_url() {
    local url="$1"

    # Check for common URL patterns
    if [[ "$url" == *"http://"* ]] || [[ "$url" == *"https://"* ]]; then
        if [[ "$url" == *"."* ]]; then
            echo "✓ Valid URL format: $url"
            return 0
        else
            echo "✗ URL missing domain extension: $url"
            return 1
        fi
    else
        echo "✗ URL missing http/https protocol: $url"
        return 1
    fi
}

check_domain_type() {
    local url="$1"

    if [[ "$url" == *".com"* ]]; then
        echo "Commercial domain detected"
    elif [[ "$url" == *".org"* ]]; then
        echo "Organization domain detected"
    elif [[ "$url" == *".edu"* ]]; then
        echo "Educational domain detected"
    elif [[ "$url" == *".gov"* ]]; then
        echo "Government domain detected"
    else
        echo "Other domain type"
    fi
}

# Test validation functions
test_emails=(
    "user@example.com"
    "invalid.email"
    "test@domain"
    "user@domain.co.uk"
)

test_urls=(
    "https://www.example.com"
    "http://test.org"
    "ftp://files.example.com"
    "www.example.com"
)

echo "Email validation:"
for email in "${test_emails[@]}"; do
    validate_email "$email"
done

echo
echo "URL validation:"
for url in "${test_urls[@]}"; do
    validate_url "$url"
    check_domain_type "$url"
    echo "---"
done
```

This demonstrates practical substring checking for common validation tasks.

## Performance Comparison of Methods

Different substring checking methods have varying performance characteristics:

```bash
#!/bin/bash

performance_test() {
    local test_string="This is a very long string that we will use to test the performance of different substring checking methods in Bash scripting"
    local substring="performance"
    local iterations=10000

    echo "Performance test with $iterations iterations"
    echo "============================================"

    # Method 1: Pattern matching
    echo "Testing pattern matching..."
    time {
        for ((i=1; i<=iterations; i++)); do
            [[ "$test_string" == *"$substring"* ]] >/dev/null
        done
    }

    # Method 2: grep
    echo "Testing grep..."
    time {
        for ((i=1; i<=iterations; i++)); do
            echo "$test_string" | grep -q "$substring" >/dev/null
        done
    }

    # Method 3: case statement (for specific strings)
    echo "Testing case statement..."
    time {
        for ((i=1; i<=iterations; i++)); do
            case "$test_string" in
                *"$substring"*) true ;;
                *) false ;;
            esac >/dev/null
        done
    }
}

# Run performance test
performance_test
```

Pattern matching with double brackets is typically the fastest for simple substring checks, while grep excels at complex pattern matching.

## Advanced String Matching Functions

Create a comprehensive string matching utility:

```bash
#!/bin/bash

# Advanced string matching functions
string_utils() {
    local operation="$1"
    local main_string="$2"
    local pattern="$3"
    local flags="$4"

    case "$operation" in
        "contains")
            if [[ "$flags" == *"i"* ]]; then
                # Case-insensitive
                local main_lower="${main_string,,}"
                local pattern_lower="${pattern,,}"
                [[ "$main_lower" == *"$pattern_lower"* ]]
            else
                [[ "$main_string" == *"$pattern"* ]]
            fi
            ;;
        "starts_with")
            if [[ "$flags" == *"i"* ]]; then
                local main_lower="${main_string,,}"
                local pattern_lower="${pattern,,}"
                [[ "$main_lower" == "$pattern_lower"* ]]
            else
                [[ "$main_string" == "$pattern"* ]]
            fi
            ;;
        "ends_with")
            if [[ "$flags" == *"i"* ]]; then
                local main_lower="${main_string,,}"
                local pattern_lower="${pattern,,}"
                [[ "$main_lower" == *"$pattern_lower" ]]
            else
                [[ "$main_string" == *"$pattern" ]]
            fi
            ;;
        "regex")
            if [[ "$flags" == *"i"* ]]; then
                shopt -s nocasematch
                [[ "$main_string" =~ $pattern ]]
                local result=$?
                shopt -u nocasematch
                return $result
            else
                [[ "$main_string" =~ $pattern ]]
            fi
            ;;
        "count")
            # Count occurrences of substring
            local temp="${main_string//[^$pattern]}"
            echo "${#temp}"
            ;;
        *)
            echo "Invalid operation: $operation" >&2
            return 1
            ;;
    esac
}

# Wrapper functions for easier use
contains() { string_utils "contains" "$1" "$2" "$3"; }
starts_with() { string_utils "starts_with" "$1" "$2" "$3"; }
ends_with() { string_utils "ends_with" "$1" "$2" "$3"; }
matches_regex() { string_utils "regex" "$1" "$2" "$3"; }
count_occurrences() { string_utils "count" "$1" "$2"; }

# Test the utility functions
test_string="Hello World! This is a TEST string."

echo "String: '$test_string'"
echo "Contains 'test' (case-sensitive): $(contains "$test_string" "test" && echo "YES" || echo "NO")"
echo "Contains 'test' (case-insensitive): $(contains "$test_string" "test" "i" && echo "YES" || echo "NO")"
echo "Starts with 'hello' (case-insensitive): $(starts_with "$test_string" "hello" "i" && echo "YES" || echo "NO")"
echo "Ends with 'string.' (case-sensitive): $(ends_with "$test_string" "string." && echo "YES" || echo "NO")"
echo "Matches email pattern: $(matches_regex "$test_string" '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' && echo "YES" || echo "NO")"
```

This utility library provides a comprehensive set of string matching functions for various use cases.

## Configuration File Processing

Use substring checking to parse configuration files:

```bash
#!/bin/bash

parse_config_file() {
    local config_file="$1"
    declare -A config_values

    if [[ ! -f "$config_file" ]]; then
        echo "Configuration file not found: $config_file"
        return 1
    fi

    echo "Parsing configuration file: $config_file"

    while IFS= read -r line; do
        # Skip comments and empty lines
        if [[ "$line" == \#* ]] || [[ -z "$line" ]]; then
            continue
        fi

        # Check for key=value format
        if [[ "$line" == *"="* ]]; then
            key="${line%%=*}"
            value="${line#*=}"

            # Remove leading/trailing whitespace
            key="${key// /}"
            value="${value# }"
            value="${value% }"

            config_values["$key"]="$value"
            echo "Found setting: $key = $value"
        fi

        # Check for specific configuration sections
        if [[ "$line" == *"[database]"* ]]; then
            echo "📊 Database configuration section found"
        elif [[ "$line" == *"[server]"* ]]; then
            echo "🖥️  Server configuration section found"
        elif [[ "$line" == *"[logging]"* ]]; then
            echo "📝 Logging configuration section found"
        fi

    done < "$config_file"

    # Print summary
    echo
    echo "Configuration summary:"
    for key in "${!config_values[@]}"; do
        echo "  $key: ${config_values[$key]}"
    done
}

# Create sample configuration file
cat > /tmp/app.conf << 'EOF'
# Application Configuration
[server]
port=8080
host=localhost
debug=true

[database]
host=db.example.com
port=5432
name=myapp_db
user=dbuser

[logging]
level=INFO
file=/var/log/myapp.log
rotate=daily
EOF

parse_config_file "/tmp/app.conf"
```

This example shows how substring checking helps parse structured configuration files.

## Next Steps

You now understand multiple methods for checking substrings in Bash, from simple pattern matching to advanced string processing. Consider exploring more sophisticated text processing with `awk` and `sed`, implementing fuzzy string matching, or building command-line tools that parse complex input formats. You might also want to investigate using these techniques for data validation, log analysis, or configuration management systems.

Good luck with your string processing and text manipulation tasks!
