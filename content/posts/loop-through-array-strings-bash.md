---
title: 'How to Loop Through an Array of Strings in Bash'
excerpt: 'Learn various methods to iterate through string arrays in Bash, including indexed arrays, associative arrays, and advanced looping techniques with practical examples.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-03'
publishedAt: '2024-12-03T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Scripting
  - Arrays
  - Loops
  - Strings
---

Arrays are powerful data structures in Bash that allow you to store and process multiple strings efficiently. Whether you're processing file lists, configuration values, or user inputs, knowing how to loop through arrays is essential for effective Bash scripting.

This guide covers various methods for iterating through string arrays, from basic loops to advanced techniques for complex data processing.

## Basic Array Iteration

The most common way to loop through an array uses a for loop with array expansion:

```bash
#!/bin/bash

# Create an array of fruits
fruits=("apple" "banana" "cherry" "date" "elderberry")

# Basic iteration through array elements
echo "Fruits in the basket:"
for fruit in "${fruits[@]}"; do
    echo "  - $fruit"
done
```

The `"${fruits[@]}"` syntax expands to all array elements as separate quoted strings, which properly handles elements containing spaces.

## Accessing Array Indices

Sometimes you need both the index and the value:

```bash
#!/bin/bash

# Array of programming languages
languages=("Python" "JavaScript" "Go" "Rust" "TypeScript")

echo "Programming languages with indices:"
for i in "${!languages[@]}"; do
    echo "  [$i]: ${languages[i]}"
done

# Alternative method using C-style for loop
echo -e "\nUsing C-style loop:"
for ((i=0; i<${#languages[@]}; i++)); do
    echo "  Position $((i+1)): ${languages[i]}"
done
```

The `"${!languages[@]}"` syntax expands to all array indices, allowing you to access both index and value.

## Processing Arrays with Conditions

Add conditional logic while iterating:

```bash
#!/bin/bash

# Array of file extensions
file_extensions=("txt" "pdf" "doc" "jpg" "png" "mp4" "zip")

echo "Categorizing file extensions:"
for ext in "${file_extensions[@]}"; do
    case "$ext" in
        "txt"|"pdf"|"doc")
            echo "  $ext - Document file"
            ;;
        "jpg"|"png")
            echo "  $ext - Image file"
            ;;
        "mp4")
            echo "  $ext - Video file"
            ;;
        "zip")
            echo "  $ext - Archive file"
            ;;
        *)
            echo "  $ext - Unknown file type"
            ;;
    esac
done
```

## Working with Arrays from Command Output

Create arrays from command output and process them:

```bash
#!/bin/bash

# Create array from command output
readarray -t log_files < <(find /var/log -name "*.log" -type f 2>/dev/null)

echo "Found ${#log_files[@]} log files:"

for log_file in "${log_files[@]}"; do
    if [[ -r "$log_file" ]]; then
        file_size=$(du -h "$log_file" | cut -f1)
        echo "  $(basename "$log_file"): $file_size"
    else
        echo "  $(basename "$log_file"): [not readable]"
    fi
done
```

## Associative Arrays (Key-Value Pairs)

Bash 4+ supports associative arrays for key-value data:

```bash
#!/bin/bash

# Declare associative array
declare -A server_configs=(
    ["web"]="nginx:80"
    ["database"]="postgresql:5432"
    ["cache"]="redis:6379"
    ["queue"]="rabbitmq:5672"
)

echo "Server configurations:"
for service in "${!server_configs[@]}"; do
    config="${server_configs[$service]}"
    IFS=':' read -ra parts <<< "$config"
    app="${parts[0]}"
    port="${parts[1]}"

    echo "  $service:"
    echo "    Application: $app"
    echo "    Port: $port"
done
```

## Parallel Processing with Arrays

Process array elements in parallel for better performance:

```bash
#!/bin/bash

# Array of URLs to check
urls=(
    "https://google.com"
    "https://github.com"
    "https://stackoverflow.com"
    "https://reddit.com"
    "https://example.com"
)

check_url() {
    local url="$1"
    local response_code

    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url")

    if [[ "$response_code" == "200" ]]; then
        echo "✓ $url: Online (HTTP $response_code)"
    else
        echo "✗ $url: Offline or error (HTTP $response_code)"
    fi
}

echo "Checking website status (parallel):"

# Process URLs in parallel
for url in "${urls[@]}"; do
    check_url "$url" &
done

# Wait for all background jobs to complete
wait

echo "All checks completed."
```

## Array Manipulation During Iteration

Modify arrays while processing them:

```bash
#!/bin/bash

# Original array
original_files=("document.txt" "image.jpg" "script.sh" "data.csv" "readme.md")

# Arrays to categorize files
text_files=()
image_files=()
script_files=()
other_files=()

echo "Categorizing files:"
for file in "${original_files[@]}"; do
    case "${file##*.}" in
        "txt"|"md"|"csv")
            text_files+=("$file")
            echo "  $file -> text files"
            ;;
        "jpg"|"png"|"gif")
            image_files+=("$file")
            echo "  $file -> image files"
            ;;
        "sh"|"bash"|"py")
            script_files+=("$file")
            echo "  $file -> script files"
            ;;
        *)
            other_files+=("$file")
            echo "  $file -> other files"
            ;;
    esac
done

# Display results
echo -e "\nCategorization results:"
echo "Text files (${#text_files[@]}): ${text_files[*]}"
echo "Image files (${#image_files[@]}): ${image_files[*]}"
echo "Script files (${#script_files[@]}): ${script_files[*]}"
echo "Other files (${#other_files[@]}): ${other_files[*]}"
```

## Error Handling in Array Loops

Implement robust error handling:

```bash
#!/bin/bash

# Array of directories to process
directories=("/home/user/docs" "/var/log" "/tmp" "/nonexistent")

process_directory() {
    local dir="$1"

    if [[ ! -d "$dir" ]]; then
        echo "  ✗ Error: Directory '$dir' does not exist"
        return 1
    fi

    if [[ ! -r "$dir" ]]; then
        echo "  ✗ Error: Directory '$dir' is not readable"
        return 1
    fi

    local file_count=$(find "$dir" -type f 2>/dev/null | wc -l)
    local dir_size=$(du -sh "$dir" 2>/dev/null | cut -f1)

    echo "  ✓ $dir: $file_count files, $dir_size total"
    return 0
}

echo "Processing directories:"
failed_count=0
total_count=${#directories[@]}

for dir in "${directories[@]}"; do
    if ! process_directory "$dir"; then
        ((failed_count++))
    fi
done

echo -e "\nSummary: $((total_count - failed_count))/$total_count directories processed successfully"

if [[ $failed_count -gt 0 ]]; then
    echo "Warning: $failed_count directories failed to process"
    exit 1
fi
```

## Advanced Array Processing Functions

Create reusable functions for common array operations:

```bash
#!/bin/bash

# Function to filter array elements
filter_array() {
    local -n input_array="$1"
    local -n output_array="$2"
    local pattern="$3"

    output_array=()

    for element in "${input_array[@]}"; do
        if [[ "$element" =~ $pattern ]]; then
            output_array+=("$element")
        fi
    done
}

# Function to map array elements
map_array() {
    local -n input_array="$1"
    local -n output_array="$2"
    local transform_function="$3"

    output_array=()

    for element in "${input_array[@]}"; do
        local transformed_element
        transformed_element=$($transform_function "$element")
        output_array+=("$transformed_element")
    done
}

# Transform function example
to_uppercase() {
    echo "$1" | tr '[:lower:]' '[:upper:]'
}

# Example usage
original_names=("alice" "bob" "charlie" "diana" "eve")
filtered_names=()
uppercase_names=()

# Filter names starting with vowels
filter_array original_names filtered_names "^[aeiou]"
echo "Names starting with vowels: ${filtered_names[*]}"

# Convert all names to uppercase
map_array original_names uppercase_names "to_uppercase"
echo "Uppercase names: ${uppercase_names[*]}"
```

## Performance Optimization

Optimize array processing for large datasets:

```bash
#!/bin/bash

# Large array simulation
generate_large_array() {
    local size="$1"
    local array_name="$2"
    local -n array_ref="$array_name"

    array_ref=()
    for ((i=1; i<=size; i++)); do
        array_ref+=("item_$i")
    done
}

# Efficient processing with minimal operations
process_large_array() {
    local -n array_ref="$1"
    local batch_size="$2"
    local current_batch=0

    echo "Processing ${#array_ref[@]} items in batches of $batch_size"

    for ((i=0; i<${#array_ref[@]}; i++)); do
        # Process item
        local item="${array_ref[i]}"

        # Batch progress reporting
        if (( (i + 1) % batch_size == 0 )); then
            ((current_batch++))
            echo "  Completed batch $current_batch ($(( (i + 1) * 100 / ${#array_ref[@]} ))%)"
        fi
    done

    echo "Processing complete!"
}

# Example with large array
large_array=()
generate_large_array 10000 large_array
process_large_array large_array 1000
```

## Multi-dimensional Array Simulation

Handle complex data structures:

```bash
#!/bin/bash

# Simulate multi-dimensional array using associative arrays
declare -A employee_data

# Store employee information
employees=("john" "alice" "bob")

employee_data["john,name"]="John Doe"
employee_data["john,department"]="Engineering"
employee_data["john,salary"]="75000"

employee_data["alice,name"]="Alice Smith"
employee_data["alice,department"]="Marketing"
employee_data["alice,salary"]="65000"

employee_data["bob,name"]="Bob Johnson"
employee_data["bob,department"]="Sales"
employee_data["bob,salary"]="60000"

# Display employee information
echo "Employee Database:"
echo "=================="

for employee in "${employees[@]}"; do
    echo "Employee: ${employee_data["$employee,name"]}"
    echo "  Department: ${employee_data["$employee,department"]}"
    echo "  Salary: \$${employee_data["$employee,salary"]}"
    echo
done
```

## Best Practices

1. **Always quote array expansions** - Use `"${array[@]}"` not `${array[@]}`
2. **Use meaningful variable names** for better code readability
3. **Handle empty arrays gracefully** - Check array length before processing
4. **Consider performance** for large arrays - use batch processing when needed
5. **Implement error handling** for robust scripts
6. **Use associative arrays** for key-value data structures
7. **Prefer readarray/mapfile** for creating arrays from command output
8. **Test with various data types** including strings with spaces and special characters

Array iteration is fundamental to Bash scripting. These techniques provide the foundation for processing collections of data efficiently and reliably in your shell scripts.
