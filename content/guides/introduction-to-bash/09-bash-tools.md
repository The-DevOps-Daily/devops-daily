---
title: 'Common Bash Tools'
description: 'Explore essential command-line tools and utilities that work alongside Bash to enhance your scripting capabilities'
order: 9
---

Bash becomes truly powerful when combined with the many command-line tools available on Unix-like systems. In this section, we'll explore common tools that you'll frequently use in your Bash scripts for text processing, system monitoring, and more.

## Text Processing Tools

### grep - Search for Patterns

`grep` searches for patterns in text, making it invaluable for finding specific content:

```bash
# Basic pattern search
grep "error" logfile.txt

# Case-insensitive search
grep -i "error" logfile.txt

# Show line numbers
grep -n "error" logfile.txt

# Show only matching filenames
grep -l "error" *.log

# Recursive search in directories
grep -r "function" /path/to/code

# Invert match (show lines that don't match)
grep -v "debug" logfile.txt

# Use regular expressions
grep -E "error|warning" logfile.txt

# Count matching lines
grep -c "error" logfile.txt
```

### sed - Stream Editor

`sed` is a powerful tool for text transformations:

```bash
# Replace text (first occurrence in each line)
sed 's/old/new/' file.txt

# Replace all occurrences
sed 's/old/new/g' file.txt

# Replace on specific lines
sed '3s/old/new/' file.txt  # Replace on line 3

# Delete lines
sed '5d' file.txt  # Delete line 5
sed '/pattern/d' file.txt  # Delete lines matching pattern

# Insert text
sed '2i\New line' file.txt  # Insert before line 2
sed '2a\New line' file.txt  # Append after line 2

# Edit files in-place (change the original file)
sed -i 's/old/new/g' file.txt

# Multiple commands
sed -e 's/old/new/g' -e '/pattern/d' file.txt
```

### awk - Pattern Scanning and Processing

`awk` is particularly good for column-based text processing:

```bash
# Print specific columns (fields)
awk '{print $1, $3}' file.txt  # Print 1st and 3rd fields

# Use custom field separator
awk -F: '{print $1, $3}' /etc/passwd  # Colon-separated fields

# Filtering with patterns
awk '$3 > 100 {print $1, $3}' data.txt  # Print if 3rd field > 100

# Calculate sum
awk '{sum += $1} END {print "Sum:", sum}' numbers.txt

# Calculate average
awk '{sum += $1; count++} END {print "Average:", sum/count}' numbers.txt

# Built-in variables
# NF: Number of fields, NR: Record number
awk '{print NR, $1, $NF}' file.txt  # Print line number, first field, last field
```

### cut - Extract Sections from Lines

`cut` is simpler than `awk` but excellent for simple column extraction:

```bash
# Extract by character position
cut -c 1-5 file.txt  # Characters 1 to 5

# Extract by delimiter and field
cut -d "," -f 1,3 data.csv  # Fields 1 and 3 from CSV
cut -d ":" -f 1 /etc/passwd  # First field from passwd file
```

### sort - Sort Lines

`sort` arranges lines in specific orders:

```bash
# Basic sorting
sort file.txt

# Numeric sort
sort -n numbers.txt

# Reverse sort
sort -r file.txt

# Sort by specific field
sort -k 2 file.txt  # Sort by second field
sort -t "," -k 3 data.csv  # Sort CSV by third field

# Remove duplicates (after sorting)
sort -u file.txt
```

### uniq - Report or Filter Repeated Lines

`uniq` works on sorted input to manage repeated lines:

```bash
# Remove duplicate consecutive lines
sort file.txt | uniq

# Count occurrences
sort file.txt | uniq -c

# Show only duplicated lines
sort file.txt | uniq -d

# Show only unique lines (appearing exactly once)
sort file.txt | uniq -u
```

### tr - Translate Characters

`tr` is used to translate or delete characters:

```bash
# Replace characters
echo "Hello" | tr 'a-z' 'A-Z'  # Convert to uppercase

# Delete characters
echo "Hello 123" | tr -d '0-9'  # Remove digits

# Squeeze repeated characters
echo "Hello   world" | tr -s ' '  # Reduce multiple spaces to single
```

### wc - Count Lines, Words, and Characters

`wc` is useful for counting:

```bash
# Count lines, words, and characters
wc file.txt

# Count only lines
wc -l file.txt

# Count only words
wc -w file.txt

# Count only characters
wc -c file.txt
```

## File and Directory Tools

### find - Search for Files

`find` is incredibly versatile for locating files:

```bash
# Find by name
find /path -name "*.txt"

# Case-insensitive name search
find /path -iname "*.txt"

# Find by type
find /path -type f  # Files only
find /path -type d  # Directories only

# Find by size
find /path -size +10M  # Larger than 10MB
find /path -size -10k  # Smaller than 10KB

# Find by modification time
find /path -mtime -7  # Modified in the last 7 days
find /path -mmin -60  # Modified in the last 60 minutes

# Execute commands on found files
find /path -name "*.log" -exec ls -l {} \;
find /path -name "*.log" -exec rm {} \;

# Find and delete with confirmation
find /path -name "*.tmp" -exec rm -i {} \;
```

### xargs - Build and Execute Commands

`xargs` takes input from one command and passes it as arguments to another:

```bash
# Find and delete files
find /path -name "*.tmp" | xargs rm

# Parallel processing (GNU xargs)
find /path -name "*.jpg" | xargs -P 4 -I {} convert {} {}.png

# Handle filenames with spaces
find /path -name "*.txt" -print0 | xargs -0 grep "pattern"
```

### rsync - Efficient File Transfer

`rsync` is excellent for backups and file synchronization:

```bash
# Sync directories
rsync -av source_dir/ destination_dir/

# Remote sync over SSH
rsync -av -e ssh source_dir/ user@remote:destination_dir/

# Dry run (show what would be done)
rsync -av --dry-run source_dir/ destination_dir/

# Exclude patterns
rsync -av --exclude="*.tmp" source_dir/ destination_dir/

# Delete files at destination that don't exist in source
rsync -av --delete source_dir/ destination_dir/
```

## System Information Tools

### ps - Process Status

`ps` shows running processes:

```bash
# Basic process listing
ps

# Detailed process listing
ps -ef

# BSD-style full listing
ps aux

# Filter by process name
ps aux | grep firefox

# Show process hierarchy
ps -ejH
ps axjf  # BSD-style tree
```

### top/htop - Interactive Process Viewer

`top` and `htop` provide real-time system monitoring:

```bash
# Basic monitoring
top

# Sort by memory usage (in top)
top -o %MEM

# Batch mode (non-interactive)
top -b -n 1
```

Install and use `htop` for a more user-friendly interface:

```bash
# Install htop (Debian/Ubuntu)
apt install htop

# Install htop (Red Hat/CentOS)
yum install htop

# Run htop
htop
```

### df - Disk Free Space

`df` reports file system disk space usage:

```bash
# Show all filesystems
df

# Human-readable sizes
df -h

# Show specific filesystem
df -h /home
```

### du - Disk Usage

`du` estimates file space usage:

```bash
# Summary of a directory
du -sh /path/to/dir

# List all subdirectories with sizes
du -h --max-depth=1 /path/to/dir

# Sort directories by size
du -h --max-depth=1 /path/to/dir | sort -hr
```

### free - Memory Usage

`free` displays amount of free and used memory:

```bash
# Show memory usage
free

# Human-readable format
free -h

# Show in megabytes
free -m
```

### dmesg - System Messages

`dmesg` displays kernel-related messages:

```bash
# View recent kernel messages
dmesg

# Follow new messages
dmesg -w

# Show human-readable timestamps
dmesg -T
```

## Network Tools

### curl - Transfer Data from URLs

`curl` is a powerful tool for making HTTP requests:

```bash
# Simple GET request
curl https://example.com

# Save output to a file
curl -o output.html https://example.com

# Follow redirects
curl -L https://example.com

# HTTP POST
curl -X POST -d "param1=value1&param2=value2" https://example.com/form

# JSON POST
curl -X POST -H "Content-Type: application/json" -d '{"key":"value"}' https://api.example.com

# Authentication
curl -u username:password https://example.com

# Download with progress bar
curl -# -O https://example.com/file.zip
```

### wget - Network Downloader

`wget` is excellent for downloading files:

```bash
# Download a file
wget https://example.com/file.zip

# Continue interrupted download
wget -c https://example.com/file.zip

# Recursive download
wget -r -np -k https://example.com/

# Download with a different filename
wget -O output.zip https://example.com/file.zip

# Download in background
wget -b https://example.com/file.zip
```

### ping - Test Network Connectivity

`ping` sends ICMP ECHO_REQUEST packets to network hosts:

```bash
# Basic ping
ping google.com

# Limit number of packets
ping -c 5 google.com

# Specify timeout
ping -W 2 google.com
```

### netstat - Network Statistics

`netstat` shows network connections and routing tables:

```bash
# List all TCP connections
netstat -at

# List all listening ports
netstat -ltun

# Show process ID for each connection
netstat -tupl

# Routing table
netstat -r
```

On some systems, `ss` is the modern replacement for `netstat`:

```bash
# List all TCP connections
ss -ta

# List all listening ports
ss -ltn
```

### nslookup/dig - DNS Lookup

These tools query DNS servers:

```bash
# Simple DNS lookup with nslookup
nslookup example.com

# Detailed DNS lookup with dig
dig example.com

# Query specific record types
dig MX example.com  # Mail servers
dig NS example.com  # Name servers
```

## Archive and Compression Tools

### tar - Archive Files

`tar` creates and extracts archives:

```bash
# Create tar archive
tar -cf archive.tar file1 file2 dir1

# Create gzipped tar archive
tar -czf archive.tar.gz file1 file2 dir1

# Create bzip2 compressed archive
tar -cjf archive.tar.bz2 file1 file2 dir1

# Extract tar archive
tar -xf archive.tar

# Extract gzipped archive
tar -xzf archive.tar.gz

# Extract to specific directory
tar -xzf archive.tar.gz -C /target/directory

# List contents without extracting
tar -tf archive.tar
```

### gzip/gunzip - Compress/Decompress Files

`gzip` compresses files in the gzip format:

```bash
# Compress file
gzip file.txt  # Creates file.txt.gz and removes original

# Decompress file
gunzip file.txt.gz

# Keep original file when compressing
gzip -c file.txt > file.txt.gz

# Specify compression level (1-9, 9 is best compression)
gzip -9 file.txt
```

### zip/unzip - Create/Extract ZIP Archives

The `zip` format is widely compatible across platforms:

```bash
# Create zip archive
zip archive.zip file1 file2 dir1

# Recursively include directories
zip -r archive.zip dir1 dir2

# Add password protection
zip -e archive.zip file1 file2

# Extract zip archive
unzip archive.zip

# Extract to specific directory
unzip archive.zip -d /target/directory

# List contents without extracting
unzip -l archive.zip
```

## Date and Time Tools

### date - Display or Set Date and Time

`date` is useful for timestamps and date calculations:

```bash
# Current date and time
date

# Format date
date "+%Y-%m-%d %H:%M:%S"  # 2024-05-17 14:30:45

# Format components
date "+Year: %Y, Month: %m, Day: %d"

# Unix timestamp (seconds since epoch)
date +%s

# Convert timestamp to date
date -d @1621234567

# Date arithmetic (GNU date)
date -d "next day"
date -d "last week"
date -d "3 days ago"
date -d "2 months ago"
```

### cal - Display Calendar

`cal` shows a simple calendar:

```bash
# Current month
cal

# Specific month and year
cal 9 2024  # September 2024

# Entire year
cal 2024
```

## Comparing Files

### diff - Compare Files Line by Line

`diff` shows the differences between files:

```bash
# Basic comparison
diff file1.txt file2.txt

# Side-by-side comparison
diff -y file1.txt file2.txt

# Ignore whitespace
diff -w file1.txt file2.txt

# Create a patch file
diff -u file1.txt file2.txt > changes.patch
```

### cmp - Compare Files Byte by Byte

`cmp` is useful for binary files or when you just want to know if files differ:

```bash
# Check if files are identical
cmp file1.bin file2.bin

# Show all differences
cmp -l file1.bin file2.bin
```

### md5sum/sha256sum - Calculate Checksums

Checksums verify file integrity:

```bash
# Calculate MD5 checksum
md5sum file.iso

# Calculate SHA-256 checksum
sha256sum file.iso

# Verify against a checksum file
sha256sum -c checksums.txt
```

## Monitoring and Job Control

### watch - Run Commands Periodically

`watch` repeats a command at regular intervals:

```bash
# Run 'ls' every 2 seconds (default)
watch ls -l

# Custom interval (0.5 seconds)
watch -n 0.5 'ls -l'

# Highlight differences between updates
watch -d 'ls -l'
```

### nohup - Run Command Immune to Hangups

`nohup` runs a command that keeps running after you log out:

```bash
# Run a command in the background, immune to hangups
nohup long_running_command &

# Redirect output
nohup long_running_command > output.log 2>&1 &
```

### screen/tmux - Terminal Multiplexers

These tools let you run and detach from terminal sessions:

```bash
# Start a new screen session
screen

# Detach from current session (Ctrl+A, then D)

# List sessions
screen -ls

# Reattach to a session
screen -r [session_id]
```

For `tmux`:

```bash
# Start a new tmux session
tmux

# Detach from current session (Ctrl+B, then D)

# List sessions
tmux ls

# Reattach to a session
tmux attach -t [session_id]
```

> **Need a server to practice these Bash tools?** If you want a dedicated environment to experiment with these tools, consider setting up a DigitalOcean Droplet. Their basic plans start at just $4/month, and you can get $200 in credits using this link: [https://www.jdoqocy.com/click-101674709-15836238](https://www.jdoqocy.com/click-101674709-15836238)

## Putting Tools Together: Practical Examples

The real power of Bash comes from combining these tools. Here are some practical examples:

### Find and Replace Across Multiple Files

```bash
# Find all PHP files and replace a string
find . -name "*.php" -type f -exec sed -i 's/old_function/new_function/g' {} \;

# Alternative using grep and xargs
grep -l "old_function" $(find . -name "*.php") | xargs sed -i 's/old_function/new_function/g'
```

### Monitor System Resource Usage

```bash
# Watch system resources
watch -n 2 'ps aux | sort -rk 3 | head -10'  # Top 10 CPU users
watch -n 2 'ps aux | sort -rk 4 | head -10'  # Top 10 memory users
watch -n 5 'df -h'  # Disk usage updates

# Log resource usage over time
while true; do
    date >> resource_log.txt
    echo "==== CPU USAGE ====" >> resource_log.txt
    top -b -n 1 | head -20 >> resource_log.txt
    echo "==== MEMORY USAGE ====" >> resource_log.txt
    free -m >> resource_log.txt
    echo "==== DISK USAGE ====" >> resource_log.txt
    df -h >> resource_log.txt
    echo -e "\n\n" >> resource_log.txt
    sleep 300  # Every 5 minutes
done
```

### Process Log Files

```bash
# Extract IP addresses from logs and count occurrences
grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' access.log | sort | uniq -c | sort -nr | head -10

# Find all 404 errors
grep ' 404 ' access.log | awk '{print $7}' | sort | uniq -c | sort -nr

# Extract all URLs requested by a specific IP
grep '192\.168\.1\.1' access.log | awk '{print $7}' | sort | uniq -c | sort -nr
```

### Backup Script with Rotation

```bash
#!/bin/bash

# Backup directories
backup_dirs=("/home/user/documents" "/var/www" "/etc")
backup_dest="/mnt/backups"
date_format=$(date +"%Y%m%d")
max_backups=5

# Create backup name
backup_file="backup_${date_format}.tar.gz"

# Create backup
echo "Creating backup: $backup_file"
tar -czf "${backup_dest}/${backup_file}" "${backup_dirs[@]}"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully"
else
    echo "Backup failed"
    exit 1
fi

# Rotate old backups (keep only the most recent max_backups)
echo "Rotating old backups..."
ls -t "${backup_dest}"/backup_*.tar.gz | tail -n +$((max_backups + 1)) | xargs -r rm -f

echo "Backup rotation completed"
```

### Monitoring Website Availability

```bash
#!/bin/bash

# Website to check
website="https://example.com"
check_interval=300  # seconds
log_file="website_monitoring.log"

while true; do
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")

    # Check if the website is responding
    http_status=$(curl -s -o /dev/null -w "%{http_code}" "$website")

    if [ "$http_status" -eq 200 ]; then
        status="UP"
    else
        status="DOWN (HTTP Status: $http_status)"
        # Send alert (example: email)
        echo "Website $website is DOWN at $timestamp" | mail -s "Website Alert" admin@example.com
    fi

    # Log the status
    echo "$timestamp - $website - $status" >> "$log_file"

    # Wait for next check
    sleep "$check_interval"
done
```

The tools and techniques covered in this section will significantly enhance your Bash scripting capabilities. By combining these tools creatively, you can solve complex problems and automate a wide variety of tasks. In the next section, we'll explore Bash scripting best practices to help you write more robust and maintainable scripts.
