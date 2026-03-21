---
title: 'How to Change File and Folder Permissions Recursively in Linux'
excerpt: 'Learn how to use chmod command to change permissions for directories and all their subdirectories and files efficiently and safely.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-10'
publishedAt: '2024-12-10T12:15:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - chmod
  - permissions
  - file management
  - security
---

Managing file and directory permissions across entire directory structures is essential for system security and proper application deployment. Linux provides the chmod command with recursive options that allow you to efficiently set permissions for directories and all their contents in a single operation.

## Prerequisites

You'll need access to a Linux terminal with appropriate permissions to modify the files and directories you want to change. Basic understanding of Linux permission concepts (read, write, execute) is helpful.

## Basic Recursive Permission Change

The `-R` flag makes chmod apply changes recursively to all files and subdirectories. This command grants read, write, and execute permissions to the owner for everything in the `project` directory:

```bash
chmod -R 755 project/
```

The `755` permissions give the owner full access (7), while group and others get read and execute access (5). This is a common pattern for directories that need to be accessible but not writable by others.

## Understanding Permission Numbers

Linux permissions use a three-digit octal system where each digit represents owner, group, and other permissions:

```bash
# 755: Owner rwx (7), Group rx (5), Others rx (5)
chmod -R 755 /var/www/html/

# 644: Owner rw (6), Group r (4), Others r (4)
chmod -R 644 /home/user/documents/

# 600: Owner rw (6), Group none (0), Others none (0)
chmod -R 600 /home/user/private/
```

The numbers 4 (read), 2 (write), and 1 (execute) combine to create the permission values. Understanding this system helps you set precise permissions for different use cases.

## Setting Different Permissions for Files vs Directories

Often you want different permissions for files and directories. Use the `find` command to apply permissions selectively:

```bash
# Set 755 for directories (need execute to enter)
find /var/www/html -type d -exec chmod 755 {} \;

# Set 644 for files (don't need execute)
find /var/www/html -type f -exec chmod 644 {} \;
```

This approach ensures directories remain accessible while preventing files from having unnecessary execute permissions, which is important for security.

## Using Symbolic Notation

Symbolic notation provides more readable permission changes. This command adds execute permission for the owner recursively:

```bash
chmod -R u+x scripts/
```

Symbolic notation uses `u` (user/owner), `g` (group), `o` (others), and `a` (all). The operations are `+` (add), `-` (remove), and `=` (set exactly).

## Removing Permissions Safely

When removing permissions, be careful not to lock yourself out. This command removes write permission from group and others:

```bash
chmod -R go-w /home/user/readonly/
```

Always test permission changes on a small directory first, especially when removing permissions that might affect your ability to modify files later.

## Setting Web Server Permissions

Web applications often require specific permission patterns. This sequence sets up typical web server permissions:

```bash
# Make directories accessible
find /var/www/html -type d -exec chmod 755 {} \;

# Make files readable but not executable
find /var/www/html -type f -exec chmod 644 {} \;

# Make specific scripts executable
chmod 755 /var/www/html/cgi-bin/*.cgi
```

This pattern ensures web servers can read content files and execute only designated scripts.

## Preserving Existing Execute Permissions

Sometimes you want to add read permissions without changing existing execute permissions. Use the `X` (capital X) permission:

```bash
chmod -R a+rX /shared/files/
```

The capital `X` adds execute permission only to files that already have execute permission for someone, and always adds it to directories. This preserves the executable nature of scripts while making everything readable.

## Batch Permission Changes with Ownership

Combine permission and ownership changes for deployment scenarios:

```bash
# Change ownership and permissions together
chown -R www-data:www-data /var/www/html/
chmod -R 755 /var/www/html/
find /var/www/html -type f -exec chmod 644 {} \;
```

This sequence is common when deploying web applications, ensuring the web server user owns and can access all necessary files.

## Using ACLs for Complex Permissions

For more complex permission requirements, Access Control Lists (ACLs) provide finer control:

```bash
# Install ACL tools if needed
sudo apt install acl

# Set ACL permissions recursively
setfacl -R -m u:developer:rwx /project/
setfacl -R -m g:team:rx /project/
```

ACLs allow you to grant specific permissions to multiple users and groups beyond the basic owner/group/other model.

## Safe Permission Testing

Before applying changes to important directories, test on a copy or use the `--changes` flag to see what chmod would do:

```bash
# Show what would change
chmod -R --changes 755 test_directory/

# Or create a test copy first
cp -r important_directory test_copy/
chmod -R 755 test_copy/
```

This approach prevents accidental permission changes that might break applications or system functionality.

## Handling Special Cases

Some files require special handling during recursive permission changes:

```bash
# Preserve special permissions (setuid, setgid, sticky bit)
chmod -R --preserve-root 755 /system/directory/

# Skip symbolic links to avoid following them
find directory/ -type f -exec chmod 644 {} \;
find directory/ -type d -exec chmod 755 {} \;
```

The `--preserve-root` option prevents accidentally changing permissions on the root filesystem, while explicit file type selection avoids issues with symbolic links.

## Automation and Scripting

Create reusable scripts for common permission patterns:

```bash
#!/bin/bash
set_web_permissions() {
    local directory="$1"

    if [[ ! -d "$directory" ]]; then
        echo "Error: Directory $directory does not exist"
        return 1
    fi

    echo "Setting permissions for $directory"

    # Set directory permissions
    find "$directory" -type d -exec chmod 755 {} \;

    # Set file permissions
    find "$directory" -type f -exec chmod 644 {} \;

    # Make shell scripts executable
    find "$directory" -name "*.sh" -exec chmod 755 {} \;

    echo "Permissions updated successfully"
}

# Usage
set_web_permissions "/var/www/html"
```

This script encapsulates common permission-setting logic and can be reused across different deployments.

## Monitoring Permission Changes

For security auditing, monitor recursive permission changes:

```bash
# Log permission changes
chmod -R --changes 755 /important/directory/ | tee permission_changes.log

# Find files with unusual permissions
find /var/www/html -type f -perm /111 -ls
```

Logging changes helps with troubleshooting and security audits, while finding files with execute permissions can identify potential security issues.

## Recovery from Permission Mistakes

If you accidentally set wrong permissions, common recovery patterns include:

```bash
# Restore typical home directory permissions
chmod 755 /home/user/
chmod -R 644 /home/user/*
chmod -R 755 /home/user/bin/ /home/user/.ssh/
chmod 600 /home/user/.ssh/id_rsa
```

Keep backup scripts or documented permission patterns for critical directories to enable quick recovery from permission mistakes.

## Performance Considerations

For very large directory trees, optimize recursive operations:

```bash
# Use parallel processing for large directories
find /huge/directory -type f -print0 | xargs -0 -P 4 chmod 644
find /huge/directory -type d -print0 | xargs -0 -P 4 chmod 755
```

The `-P 4` option runs up to 4 parallel processes, significantly speeding up permission changes on directories with millions of files.

## Next Steps

You can now efficiently manage permissions across complex directory structures. Consider learning about SELinux contexts for additional security layers, exploring umask settings to control default permissions, or investigating tools like Ansible for managing permissions across multiple systems.

Good luck securing your file systems!
