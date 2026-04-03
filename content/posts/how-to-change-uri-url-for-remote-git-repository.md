---
title: 'How to Change the URI (URL) for a Remote Git Repository'
excerpt: 'Learn how to update remote repository URLs in Git when repositories are moved, renamed, or migrated. Learn remote management commands for seamless workflow continuation.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-05'
publishedAt: '2024-12-05T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Remote Repositories
  - Configuration
  - GitHub
---

Your Git repository has been moved to a new location, your organization changed its name, or you need to switch from HTTPS to SSH authentication. When remote repository URLs change, you need to update your local Git configuration to continue pushing and pulling changes seamlessly.

In this guide, you'll learn how to update remote repository URLs and manage multiple remotes effectively.

## Prerequisites

You need Git installed on your system and a basic understanding of Git remotes and repository URLs. You should have an existing Git repository with remote connections that need updating.

## Understanding Git Remotes

Git remotes are references to remote repositories that you can push to and pull from. The most common remote is called `origin`, which typically points to the main repository where you cloned your project from.

Each remote has a name and a URL, and you can have multiple remotes pointing to different repositories.

## Viewing Current Remote Configuration

Before changing remote URLs, check your current configuration:

```bash
# List all remotes with their URLs
git remote -v

# Output example:
# origin  https://github.com/oldusername/repository.git (fetch)
# origin  https://github.com/oldusername/repository.git (push)
```

You can also view detailed information about a specific remote:

```bash
# Show detailed information about origin remote
git remote show origin

# List just the remote names
git remote
```

This shows you the current URLs for both fetching and pushing, which might be different in some configurations.

## Changing Remote URLs

### Using git remote set-url

The most straightforward way to change a remote URL:

```bash
# Change the URL for the origin remote
git remote set-url origin https://github.com/newusername/repository.git

# Verify the change
git remote -v
```

This command updates both the fetch and push URLs for the specified remote.

### Changing Only Push or Fetch URLs

If you need different URLs for pushing and fetching:

```bash
# Change only the push URL
git remote set-url --push origin https://github.com/newusername/repository.git

# Change only the fetch URL
git remote set-url origin https://github.com/newusername/repository.git

# Verify both URLs
git remote -v
```

This is useful when you have read access to one repository but write access to a fork.

## Common URL Change Scenarios

### Switching from HTTPS to SSH

Many developers prefer SSH for authentication convenience:

```bash
# Current HTTPS URL
git remote -v
# origin  https://github.com/username/repository.git (fetch)

# Change to SSH
git remote set-url origin git@github.com:username/repository.git

# Verify the change
git remote -v
# origin  git@github.com:username/repository.git (fetch)
```

Make sure you have SSH keys set up with your Git hosting service before making this change.

### Repository Moved to New Organization

When repositories are transferred to different organizations:

```bash
# Old organization URL
# origin  https://github.com/old-org/repository.git

# Update to new organization
git remote set-url origin https://github.com/new-org/repository.git

# Test the connection
git fetch origin
```

### Switching Git Hosting Services

When migrating from one service to another (e.g., GitHub to GitLab):

```bash
# Old GitHub URL
# origin  https://github.com/username/repository.git

# New GitLab URL
git remote set-url origin https://gitlab.com/username/repository.git

# Update any other remotes if needed
git remote set-url upstream https://gitlab.com/upstream/repository.git
```

### Username or Repository Name Changes

When usernames or repository names change:

```bash
# Old URL with previous username
# origin  https://github.com/oldusername/old-repo-name.git

# Update to new username and repository name
git remote set-url origin https://github.com/newusername/new-repo-name.git
```

## Managing Multiple Remotes

### Adding Additional Remotes

You can have multiple remotes for different purposes:

```bash
# Add an upstream remote (common for forks)
git remote add upstream https://github.com/original-author/repository.git

# Add a backup remote
git remote add backup https://gitlab.com/username/repository.git

# List all remotes
git remote -v
```

This is especially useful when working with forked repositories where you need to sync with the original repository.

### Removing Remotes

Remove remotes you no longer need:

```bash
# Remove a specific remote
git remote remove backup

# Or use the shorter form
git remote rm backup

# Verify removal
git remote -v
```

### Renaming Remotes

Change the name of existing remotes:

```bash
# Rename origin to old-origin
git remote rename origin old-origin

# Add new origin with different URL
git remote add origin https://github.com/newlocation/repository.git

# List remotes to verify
git remote -v
```

## Updating Remote URLs in Bulk

### Using Git Configuration Commands

For repositories with multiple remotes, you can update URLs systematically:

```bash
# View current remote configuration
git config --get-regexp remote.*.url

# Update specific remote URLs
git config remote.origin.url https://github.com/newusername/repository.git
git config remote.upstream.url https://github.com/upstream/repository.git
```

### Script for Multiple Repositories

If you have many repositories to update, create a script:

```bash
#!/bin/bash
# update-remotes.sh

# List of repository directories
repos=("repo1" "repo2" "repo3")

# Old and new URL patterns
old_pattern="https://github.com/oldusername"
new_pattern="https://github.com/newusername"

for repo in "${repos[@]}"; do
    if [ -d "$repo" ]; then
        echo "Updating $repo..."
        cd "$repo"

        # Get current origin URL
        current_url=$(git remote get-url origin)

        # Replace old pattern with new pattern
        new_url=${current_url/$old_pattern/$new_pattern}

        # Update the remote URL
        git remote set-url origin "$new_url"

        echo "Updated to: $new_url"
        cd ..
    fi
done
```

## Verifying Remote Changes

### Testing Connectivity

After changing remote URLs, verify they work:

```bash
# Test fetch connectivity
git fetch origin

# Test push connectivity (if you have write access)
git push origin --dry-run

# Check remote repository information
git ls-remote origin
```

### Validating Configuration

Ensure your changes are correct:

```bash
# Show detailed remote information
git remote show origin

# Verify all remotes
git remote -v

# Check Git configuration
git config --list | grep remote
```

## Troubleshooting Common Issues

### Authentication Problems

If you encounter authentication issues after URL changes:

```bash
# For HTTPS URLs, you might need to update credentials
git config --global credential.helper store

# For SSH URLs, verify your SSH keys
ssh -T git@github.com

# Clear credential cache if needed
git credential-manager delete https://github.com
```

### Invalid URL Formats

Ensure you're using the correct URL format:

```bash
# HTTPS format
https://github.com/username/repository.git

# SSH format
git@github.com:username/repository.git

# GitHub CLI format (if using gh CLI)
gh://username/repository
```

### Repository Not Found Errors

If you get "repository not found" errors:

```bash
# Verify the repository exists at the new URL
curl -I https://github.com/username/repository

# Check if you have access permissions
git ls-remote https://github.com/username/repository.git

# Ensure you're using the correct credentials
```

## Best Practices

### Documentation

Keep track of remote changes:

```bash
# Add comments in your Git config
git config --add remote.origin.comment "Main repository after organization transfer"

# Document in your project README
echo "Repository moved from old-org to new-org on $(date)" >> README.md
```

### Team Communication

When changing shared repository URLs:

1. Notify team members before making changes
2. Provide clear instructions for updating their local remotes
3. Consider keeping old remotes accessible during transition periods

### Backup Configuration

Before making changes, backup your Git configuration:

```bash
# Backup current remote configuration
git config --list | grep remote > remote-backup.txt

# Or backup entire Git config
cp .git/config .git/config.backup
```

Now you understand how to manage and update Git remote URLs effectively. Whether you're dealing with repository migrations, organization changes, or authentication method switches, these techniques will help you maintain seamless connectivity to your remote repositories.
