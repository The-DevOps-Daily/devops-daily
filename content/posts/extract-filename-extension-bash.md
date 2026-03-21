---
title: 'How to Extract Filename and Extension in Bash'
excerpt: 'Learn multiple methods to extract filenames, extensions, and directory paths from file paths in Bash using parameter expansion and basename commands.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-07-08'
publishedAt: '2024-07-08T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Scripting
  - Files
  - Strings
  - Linux
---

Working with file paths is a common task in Bash scripting, whether you're processing files, creating backups, or organizing data. Extracting components like filenames, extensions, and directory paths from full file paths is essential for many automation tasks.

This guide covers multiple methods to extract filename and extension information from file paths, using both built-in Bash features and external commands.

## Using Parameter Expansion (Recommended)

Bash parameter expansion provides the most efficient way to extract filename components without external commands:

```bash
filepath="/home/user/documents/report.pdf"

# Extract filename with extension
filename="${filepath##*/}"
echo "Filename: $filename"  # Output: report.pdf

# Extract filename without extension
name="${filename%.*}"
echo "Name: $name"  # Output: report

# Extract extension
extension="${filename##*.}"
echo "Extension: $extension"  # Output: pdf

# Extract directory path
directory="${filepath%/*}"
echo "Directory: $directory"  # Output: /home/user/documents
```

Here's how these patterns work:

- `${filepath##*/}` - removes everything up to and including the last `/`
- `${filename%.*}` - removes the shortest match of `.` and everything after from the end
- `${filename##*.}` - removes everything up to and including the last `.`
- `${filepath%/*}` - removes the shortest match of `/` and everything after from the end

## Creating Reusable Functions

Here's a comprehensive function that extracts all components:

```bash
parse_filepath() {
    local filepath="$1"
    local -n result="$2"  # Name reference for associative array

    # Initialize result array
    result["full_path"]="$filepath"
    result["filename"]="${filepath##*/}"
    result["directory"]="${filepath%/*}"
    result["name"]="${result["filename"]%.*}"
    result["extension"]="${result["filename"]##*.}"

    # Handle edge cases
    if [[ "${result["filename"]}" == "${result["extension"]}" ]]; then
        result["extension"]=""  # No extension found
    fi

    if [[ "${result["directory"]}" == "$filepath" ]]; then
        result["directory"]="."  # No directory in path
    fi
}

# Usage
declare -A file_info
parse_filepath "/var/log/system.log" file_info

echo "Full path: ${file_info[full_path]}"
echo "Directory: ${file_info[directory]}"
echo "Filename: ${file_info[filename]}"
echo "Name: ${file_info[name]}"
echo "Extension: ${file_info[extension]}"
```

## Using basename and dirname Commands

The `basename` and `dirname` commands provide an alternative approach:

```bash
filepath="/home/user/documents/report.pdf"

# Extract filename
filename=$(basename "$filepath")
echo "Filename: $filename"  # Output: report.pdf

# Extract filename without extension
name=$(basename "$filepath" .pdf)
echo "Name: $name"  # Output: report

# Extract directory
directory=$(dirname "$filepath")
echo "Directory: $directory"  # Output: /home/user/documents
```

For extension extraction with basename:

```bash
# Generic extension extraction with basename
filename=$(basename "$filepath")
extension="${filename##*.}"
name=$(basename "$filepath" ".$extension")

echo "Name: $name"
echo "Extension: $extension"
```

## Handling Multiple Extensions

For files with multiple extensions like `archive.tar.gz`:

```bash
extract_extensions() {
    local filepath="$1"
    local filename="${filepath##*/}"
    local name extension full_extension

    # Get the first part (before any dots)
    name="${filename%%.*}"

    # Get everything after the first dot
    full_extension="${filename#*.}"

    # Get just the last extension
    extension="${filename##*.}"

    echo "Original: $filepath"
    echo "Name: $name"
    echo "Last extension: $extension"
    echo "Full extension: $full_extension"
}

# Examples
extract_extensions "archive.tar.gz"
# Name: archive
# Last extension: gz
# Full extension: tar.gz

extract_extensions "backup.sql.bz2"
# Name: backup
# Last extension: bz2
# Full extension: sql.bz2
```

## Processing Multiple Files

Here's how to process multiple files and extract their components:

```bash
process_files() {
    local files=("$@")

    printf "%-20s %-15s %-10s %-30s\n" "NAME" "EXTENSION" "SIZE" "DIRECTORY"
    printf "%s\n" "$(printf '=%.0s' {1..75})"

    for filepath in "${files[@]}"; do
        if [[ -f "$filepath" ]]; then
            local filename="${filepath##*/}"
            local name="${filename%.*}"
            local extension="${filename##*.}"
            local directory="${filepath%/*}"
            local size=$(stat -c%s "$filepath" 2>/dev/null || echo "N/A")

            # Handle files without extensions
            if [[ "$filename" == "$extension" ]]; then
                extension="(none)"
            fi

            printf "%-20s %-15s %-10s %-30s\n" \
                "${name:0:19}" "${extension:0:14}" "$size" "${directory:0:29}"
        fi
    done
}

# Usage
process_files /home/user/*.txt /var/log/*.log
```

## Batch File Renaming

A practical example using filename extraction for batch renaming:

```bash
batch_rename() {
    local pattern="$1"
    local replacement="$2"
    local directory="${3:-.}"

    for filepath in "$directory"/*; do
        if [[ -f "$filepath" ]]; then
            local filename="${filepath##*/}"
            local name="${filename%.*}"
            local extension="${filename##*.}"
            local new_name="${name//$pattern/$replacement}"

            # Handle files without extensions
            if [[ "$filename" == "$extension" ]]; then
                local new_filename="$new_name"
            else
                local new_filename="$new_name.$extension"
            fi

            if [[ "$filename" != "$new_filename" ]]; then
                echo "Renaming: $filename -> $new_filename"
                mv "$filepath" "${filepath%/*}/$new_filename"
            fi
        fi
    done
}

# Usage: replace "old" with "new" in all filenames
batch_rename "old" "new" "/path/to/files"
```

## Creating Backup Files

Extract components to create backup files with timestamps:

```bash
create_backup() {
    local original_file="$1"
    local timestamp=$(date +"%Y%m%d_%H%M%S")

    local filename="${original_file##*/}"
    local name="${filename%.*}"
    local extension="${filename##*.}"
    local directory="${original_file%/*}"

    # Handle files without extensions
    if [[ "$filename" == "$extension" ]]; then
        local backup_file="${directory}/${name}_${timestamp}"
    else
        local backup_file="${directory}/${name}_${timestamp}.${extension}"
    fi

    if cp "$original_file" "$backup_file"; then
        echo "Backup created: $backup_file"
    else
        echo "Failed to create backup for: $original_file"
        return 1
    fi
}

# Usage
create_backup "/etc/nginx/nginx.conf"
# Output: Backup created: /etc/nginx/nginx_20240708_143022.conf
```

## Working with URLs

The same techniques work for extracting components from URLs:

```bash
parse_url_path() {
    local url="$1"

    # Extract path from URL (everything after domain)
    local path="${url#*://*/}"
    path="/$path"

    # Extract filename from path
    local filename="${path##*/}"
    local name="${filename%.*}"
    local extension="${filename##*.}"
    local directory="${path%/*}"

    echo "URL: $url"
    echo "Path: $path"
    echo "Directory: $directory"
    echo "Filename: $filename"
    echo "Name: $name"
    echo "Extension: $extension"
}

# Usage
parse_url_path "https://example.com/downloads/files/document.pdf"
```

## Advanced Pattern Matching

For more complex filename patterns:

```bash
extract_version_info() {
    local filename="$1"

    # Extract base name without version and extension
    # Handles patterns like: app-1.2.3.tar.gz, tool_v2.1.exe
    local base_name="${filename%%-*}"  # Remove from first dash
    base_name="${base_name%%_*}"       # Remove from first underscore

    # Extract version pattern (digits and dots)
    local version=""
    if [[ "$filename" =~ ([0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9]+)?) ]]; then
        version="${BASH_REMATCH[1]}"
    fi

    echo "Base name: $base_name"
    echo "Version: $version"
}

# Examples
extract_version_info "nginx-1.18.0.tar.gz"
# Base name: nginx
# Version: 1.18.0

extract_version_info "app_v2.1-beta.zip"
# Base name: app
# Version: 2.1-beta
```

## Best Practices

1. **Use parameter expansion** for better performance and fewer external dependencies
2. **Handle edge cases** like files without extensions or complex paths
3. **Test with various path formats** including relative paths and URLs
4. **Validate inputs** before processing to avoid unexpected behavior
5. **Use quotes** around variables to handle paths with spaces
6. **Consider special files** like hidden files starting with dots

Extracting filename and extension information is fundamental to file processing in Bash. These techniques provide robust methods for parsing file paths, whether you're building file processors, backup systems, or general automation scripts.
