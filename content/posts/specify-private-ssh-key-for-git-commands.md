---
title: 'How to Specify a Private SSH Key for Git Commands'
excerpt: 'Learn multiple methods to use specific SSH keys with Git operations, from command-line options to SSH config files and environment variables, making it easy to manage multiple keys for different repositories.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-09-28'
publishedAt: '2024-09-28T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - SSH
  - DevOps
  - Security
  - Linux
---

## TLDR

To use a specific SSH key with Git, you can set the `GIT_SSH_COMMAND` environment variable, configure it in your SSH config file (`~/.ssh/config`), or use the `core.sshCommand` Git configuration option. The SSH config method is the most flexible and persistent approach for managing multiple keys across different repositories.

## Why Use Different SSH Keys?

You might need different SSH keys for various reasons:
- Separate keys for work and personal GitHub/GitLab accounts
- Different security requirements for different projects
- Multiple deployment keys for CI/CD systems
- Client-specific keys for consulting work

By default, SSH uses `~/.ssh/id_rsa` or `~/.ssh/id_ed25519`, but when you need a different key, Git and SSH need explicit instructions.

## Using GIT_SSH_COMMAND Environment Variable

The quickest way to specify a key for a single Git command is the `GIT_SSH_COMMAND` environment variable:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/work_id_ed25519" git clone git@github.com:company/project.git
```

This tells Git to use the specified key just for this one command. The `-i` flag to SSH specifies the identity file (private key) to use.

You can also set it for multiple commands in a session:

```bash
export GIT_SSH_COMMAND="ssh -i ~/.ssh/work_id_ed25519"
git fetch origin
git pull origin main
git push origin feature-branch
```

The environment variable persists until you close the terminal or unset it with `unset GIT_SSH_COMMAND`.

For scripts that need a specific key, this approach is straightforward:

```bash
#!/bin/bash

# Deploy script using dedicated deployment key
export GIT_SSH_COMMAND="ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no"

git clone git@github.com:company/production-app.git
cd production-app
git pull origin main

# Run deployment
./deploy.sh
```

The `-o StrictHostKeyChecking=no` option prevents SSH from prompting about unknown hosts, which is useful in automated environments where you've verified the host key separately.

## Configuring SSH Config File

The most elegant solution for permanent setups is configuring `~/.ssh/config`. This file lets you define connection settings per host:

```bash
# ~/.ssh/config

# Personal GitHub account
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/personal_id_ed25519
    IdentitiesOnly yes

# Work GitHub account
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/work_id_ed25519
    IdentitiesOnly yes
```

After configuring this, you clone repositories using the custom host alias:

```bash
# Clone with work key
git clone git@github.com-work:company/project.git

# Clone with personal key
git clone git@github.com-personal:username/my-project.git
```

The `IdentitiesOnly yes` directive is important - it tells SSH to only use the specified key and not try other keys in your `.ssh` directory. Without it, SSH might authenticate with the wrong key if you have multiple keys loaded in your SSH agent.

Here's how the flow works:

```
Git command with custom host
        |
        v
SSH looks up host in ~/.ssh/config
        |
        v
Finds matching Host entry
        |
        v
Uses IdentityFile specified
        |
        v
Connects to actual HostName
```

For existing repositories, update the remote URL to use your custom host:

```bash
cd ~/projects/work-project
git remote set-url origin git@github.com-work:company/project.git
```

Verify the change:

```bash
git remote -v
```

## Using Git Configuration

Git has its own configuration option for the SSH command:

```bash
# Set for a specific repository
cd ~/projects/work-project
git config core.sshCommand "ssh -i ~/.ssh/work_id_ed25519 -F /dev/null"

# Set globally for all repositories
git config --global core.sshCommand "ssh -i ~/.ssh/default_key_ed25519"
```

The `-F /dev/null` option tells SSH to ignore the config file, which can be useful if you want the command to be fully self-contained.

To check the current setting:

```bash
git config --get core.sshCommand
```

To remove it:

```bash
git config --unset core.sshCommand
```

This approach works well when you want repository-specific key settings without modifying your SSH config.

## Multiple Keys for Different Services

A common setup involves different keys for GitHub, GitLab, and Bitbucket:

```bash
# ~/.ssh/config

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_ed25519
    IdentitiesOnly yes

Host gitlab.com
    HostName gitlab.com
    User git
    IdentityFile ~/.ssh/gitlab_ed25519
    IdentitiesOnly yes

Host bitbucket.org
    HostName bitbucket.org
    User git
    IdentityFile ~/.ssh/bitbucket_ed25519
    IdentitiesOnly yes
```

With this configuration, you don't need to change anything - Git automatically uses the right key based on the repository URL:

```bash
git clone git@github.com:user/repo.git        # Uses github_ed25519
git clone git@gitlab.com:user/repo.git        # Uses gitlab_ed25519
git clone git@bitbucket.org:user/repo.git     # Uses bitbucket_ed25519
```

## Testing Your SSH Key Setup

Before cloning or pushing, verify that SSH is using the correct key:

```bash
# Test GitHub connection with specific key
ssh -i ~/.ssh/work_id_ed25519 -T git@github.com
```

You should see a message like:

```
Hi username! You've successfully authenticated, but GitHub does not provide shell access.
```

If you're using SSH config aliases:

```bash
ssh -T git@github.com-work
```

For verbose output to debug connection issues:

```bash
ssh -vT git@github.com-work
```

The verbose mode shows which keys SSH is trying and can help identify authentication problems.

## Practical Example: CI/CD Pipeline

Here's a complete example for a deployment script that needs a dedicated key:

```bash
#!/bin/bash

set -e

DEPLOY_KEY="$HOME/.ssh/deploy_production_ed25519"
REPO_URL="git@github.com:company/production-app.git"
DEPLOY_DIR="/var/www/production"

# Verify the deploy key exists
if [ ! -f "$DEPLOY_KEY" ]; then
    echo "Error: Deploy key not found at $DEPLOY_KEY"
    exit 1
fi

# Set permissions (SSH is strict about key permissions)
chmod 600 "$DEPLOY_KEY"

# Configure Git to use the deployment key
export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=no"

# Clone or update the repository
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo "Updating existing repository..."
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

# Show current commit
echo "Deployed commit: $(git rev-parse --short HEAD)"

# Run application-specific deployment steps
npm install --production
npm run build
sudo systemctl restart app

echo "Deployment complete"
```

This script handles both initial deployment and updates, verifies the key exists, sets proper permissions, and uses environment variables to specify the key.

## Managing Key Permissions

SSH is particular about key file permissions. If your key has incorrect permissions, SSH will reject it:

```bash
# Set correct permissions on private key
chmod 600 ~/.ssh/work_id_ed25519

# Set correct permissions on public key
chmod 644 ~/.ssh/work_id_ed25519.pub

# Set correct permissions on SSH directory
chmod 700 ~/.ssh
```

If you see "WARNING: UNPROTECTED PRIVATE KEY FILE!" or "Permissions 0644 are too open", these permission commands will fix it.

## SSH Agent and Multiple Keys

If you use `ssh-agent` to manage keys, you can add specific keys:

```bash
# Start the agent
eval "$(ssh-agent -s)"

# Add specific keys
ssh-add ~/.ssh/work_id_ed25519
ssh-add ~/.ssh/personal_id_ed25519

# List loaded keys
ssh-add -l
```

When using the agent, SSH automatically tries all loaded keys. While convenient, this can cause issues if you hit authentication attempt limits. The SSH config approach with `IdentitiesOnly yes` prevents this by only trying the specified key.

Each method has its place: environment variables for one-off commands, SSH config for permanent multi-key setups, Git config for repository-specific settings, and SSH agent for interactive sessions. Choose based on whether you need temporary flexibility or persistent configuration. For most development workflows, the SSH config approach offers the best balance of convenience and control.
