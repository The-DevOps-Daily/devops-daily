---
title: 'User and Group Management'
description: 'Learn how to create and manage users and groups, control access with permissions, and configure user environments on Linux systems.'
order: 6
---

Linux is a multi-user operating system, designed from the ground up to allow multiple users to work simultaneously. Understanding how to manage users and groups is essential for system administration, security, and effective collaboration.

In this part, we'll explore how to create and manage users, work with groups, configure authentication, and set up user environments.

## Users and Groups Fundamentals

### Users

A user account represents an entity (a person or service) that can access the system. Each user has:

- A unique username
- A numeric user ID (UID)
- A primary group
- An optional set of secondary groups
- A home directory
- A login shell

### Groups

Groups organize users with similar needs. Each group has:

- A unique group name
- A numeric group ID (GID)
- A list of member users

Groups simplify permission management by allowing you to assign permissions to multiple users at once.

## Key User-Related Files

Before diving into commands, let's understand the important files that store user and group information:

### /etc/passwd

This file contains basic information about each user:

```bash
cat /etc/passwd | head -5
```

Each line follows this format:

```
username:x:UID:GID:comment:home_directory:shell
```

For example:

```
alice:x:1000:1000:Alice Smith:/home/alice:/bin/bash
```

The `x` indicates that the password is stored in `/etc/shadow`.

### /etc/shadow

This file contains encrypted password information and is only readable by root:

```bash
sudo cat /etc/shadow | head -5
```

Each line follows this format:

```
username:encrypted_password:last_change:min_age:max_age:warn_period:inactive_period:expiration_date:reserved
```

The encrypted password field might be `!` or `*` if the account is locked.

### /etc/group

This file defines the groups on the system:

```bash
cat /etc/group | head -5
```

Each line follows this format:

```
group_name:x:GID:user_list
```

For example:

```
developers:x:1001:alice,bob,charlie
```

### /etc/gshadow

This file contains encrypted group passwords (if any) and is only readable by root:

```bash
sudo cat /etc/gshadow | head -5
```

## User Management Commands

### Viewing User Information

Get information about the current user:

```bash
id
```

Get information about a specific user:

```bash
id username
```

Show who is currently logged in:

```bash
who
```

Show detailed login information:

```bash
w
```

Display last login times for users:

```bash
last
```

### Creating Users

Create a new user:

```bash
sudo useradd username
```

This creates a basic user with minimal settings. Typically, you'll want more options:

```bash
sudo useradd -m -d /home/username -s /bin/bash -c "Full Name" username
```

Options:

- `-m`: Create the home directory
- `-d`: Specify the home directory path
- `-s`: Specify the login shell
- `-c`: Add a comment (usually the user's full name)
- `-G`: Add to supplementary groups

A more user-friendly command is `adduser` (on Debian-based systems), which is interactive:

```bash
sudo adduser username
```

Set or change a user's password:

```bash
sudo passwd username
```

### Modifying Users

Modify an existing user:

```bash
sudo usermod [options] username
```

Common options:

- `-c`: Change the comment field
- `-d`: Change the home directory
- `-g`: Change the primary group
- `-G`: Set supplementary groups
- `-s`: Change the login shell
- `-L`: Lock the account
- `-U`: Unlock the account

Examples:

```bash
# Change a user's shell
sudo usermod -s /bin/bash username

# Add a user to supplementary groups
sudo usermod -aG sudo,docker username
```

The `-a` option with `-G` adds to existing groups rather than replacing them.

### Deleting Users

Delete a user:

```bash
sudo userdel username
```

Delete a user and their home directory:

```bash
sudo userdel -r username
```

### User Account Expiration

Set account expiration:

```bash
sudo usermod -e YYYY-MM-DD username
```

Force password change on next login:

```bash
sudo chage -d 0 username
```

View account aging information:

```bash
sudo chage -l username
```

## Group Management Commands

### Creating Groups

Create a new group:

```bash
sudo groupadd groupname
```

With a specific GID:

```bash
sudo groupadd -g 1005 groupname
```

### Modifying Groups

Modify a group:

```bash
sudo groupmod [options] groupname
```

Common options:

- `-g`: Change the GID
- `-n`: Change the group name

Example:

```bash
# Rename a group
sudo groupmod -n new_name old_name
```

### Deleting Groups

Delete a group:

```bash
sudo groupdel groupname
```

### Managing Group Membership

Add a user to a group:

```bash
sudo usermod -aG groupname username
```

Remove a user from a group:

```bash
sudo gpasswd -d username groupname
```

List groups a user belongs to:

```bash
groups username
```

Change a user's primary group:

```bash
sudo usermod -g groupname username
```

## The sudo Command

The `sudo` command allows regular users to execute commands with elevated privileges.

### Understanding sudo

When a user uses `sudo`, they're temporarily granted the permissions of another user (typically root) to execute a specific command. This provides an audit trail and limits the time spent with elevated privileges.

Basic usage:

```bash
sudo command_to_run
```

Run a command as a specific user:

```bash
sudo -u username command_to_run
```

Open a root shell:

```bash
sudo -i
```

### Configuring sudo Access

The sudo configuration is in `/etc/sudoers` and files in `/etc/sudoers.d/`. Always edit these files with `visudo` to prevent syntax errors:

```bash
sudo visudo
```

A basic sudo entry:

```
username ALL=(ALL:ALL) ALL
```

This allows `username` to run any command as any user on any host.

To grant access without requiring a password:

```
username ALL=(ALL:ALL) NOPASSWD: ALL
```

To limit to specific commands:

```
username ALL=(ALL:ALL) /usr/bin/apt, /usr/bin/systemctl restart apache2
```

Grant sudo access to all members of a group:

```
%sudo ALL=(ALL:ALL) ALL
```

### Understanding Sudoers Syntax

The syntax is:

```
user_list host_list=(user_list:group_list) command_list
```

- `user_list`: Users or groups (with % prefix) to whom the rule applies
- `host_list`: Hosts where the rule applies
- `user_list:group_list`: Users/groups the command can be run as
- `command_list`: Commands that can be executed

## User Limits and Resource Control

Linux provides ways to limit user resources:

### /etc/security/limits.conf

This file controls resource limits for users and groups:

```bash
cat /etc/security/limits.conf
```

Example entries:

```
# Limit number of processes
username hard nproc 100

# Limit file size
@developers soft fsize 1000000
```

Types of limits:

- `soft`: User-adjustable up to the hard limit
- `hard`: Maximum value, only adjustable by root

Resources that can be limited:

- `nproc`: Number of processes
- `nofile`: Number of open files
- `fsize`: Maximum file size
- `cpu`: CPU time
- `as`: Address space (memory)

### Process Accounting

To track user activity, install process accounting:

```bash
# On Debian/Ubuntu
sudo apt install acct

# On Fedora/RHEL/CentOS
sudo dnf install psacct
```

Start the service:

```bash
sudo systemctl enable --now acct
```

View command usage summary:

```bash
sudo sa
```

View user activity:

```bash
sudo lastcomm username
```

## Authentication System

Linux uses Pluggable Authentication Modules (PAM) for flexible authentication:

### PAM Configuration

PAM configuration files are in `/etc/pam.d/`:

```bash
ls -l /etc/pam.d/
```

Each file configures authentication for a different service.

### Password Policies

Set password policies in `/etc/security/pwquality.conf` or `/etc/pam.d/common-password`:

```bash
# View password quality configuration
cat /etc/security/pwquality.conf
```

Common settings:

- `minlen`: Minimum password length
- `minclass`: Minimum character classes (lowercase, uppercase, digits, special)
- `maxrepeat`: Maximum repeated characters
- `reject_username`: Reject passwords containing the username
- `enforce_for_root`: Apply policies to root user

### Login Access Control

Configure login restrictions in `/etc/security/access.conf`:

```bash
sudo nano /etc/security/access.conf
```

Example rules:

```
- : ALL EXCEPT root : cron
+ : admins : ALL
- : ALL : ALL
```

This denies cron access to all except root, allows the admins group from anywhere, and denies all other access.

## SSH Key Authentication

SSH keys provide secure authentication without passwords:

### Generating SSH Keys

Generate a key pair:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Or with RSA:

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

### Adding Keys to Servers

Copy your public key to a remote server:

```bash
ssh-copy-id username@remote_host
```

Or manually:

```bash
cat ~/.ssh/id_ed25519.pub | ssh username@remote_host "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### SSH Server Configuration

Configure SSH settings in `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Common security settings:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

After changes, restart the SSH service:

```bash
sudo systemctl restart sshd
```

## User Environment Configuration

### System-Wide Environment

System-wide environment variables are set in several files:

- `/etc/environment`: Simple KEY=VALUE pairs
- `/etc/profile`: Executed for login shells
- `/etc/profile.d/*.sh`: Scripts executed by profile
- `/etc/bash.bashrc`: Executed for interactive non-login bash shells

### User Environment

User-specific environment configuration:

- `~/.profile`: Executed for login shells
- `~/.bashrc`: Executed for interactive non-login bash shells
- `~/.bash_profile` or `~/.bash_login`: Alternative to `.profile` for bash

Add personal environment variables in `~/.bashrc`:

```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Default User Settings

The `/etc/skel/` directory contains files copied to new users' home directories:

```bash
ls -la /etc/skel/
```

Customize these files to provide default configurations for new users.

### User Account Defaults

The `/etc/login.defs` file controls defaults for user accounts:

```bash
cat /etc/login.defs
```

Important settings:

- `PASS_MAX_DAYS`: Maximum password age
- `PASS_MIN_DAYS`: Minimum password age
- `PASS_WARN_AGE`: Password expiration warning days
- `UID_MIN`, `UID_MAX`: Range for regular user IDs
- `GID_MIN`, `GID_MAX`: Range for regular group IDs
- `CREATE_HOME`: Whether to create home directories
- `UMASK`: Default file creation permissions

Default settings for `useradd` are in `/etc/default/useradd`:

```bash
cat /etc/default/useradd
```

## Practical Examples

Let's walk through some real-world user management scenarios:

### Setting Up a Development Team

Create a development team with shared access to a project directory:

```bash
# Create a developers group
sudo groupadd developers

# Create the project directory
sudo mkdir -p /opt/projects/web-app

# Set ownership and permissions
sudo chown root:developers /opt/projects/web-app
sudo chmod 2775 /opt/projects/web-app

# Create a user and add to the group
sudo useradd -m -s /bin/bash -c "Sarah Developer" sarah
sudo usermod -aG developers sarah

# Set password for the new user
sudo passwd sarah
```

The directory will have the following permissions:

- group ownership by `developers`
- group write access
- setgid bit (2) to ensure new files in the directory inherit the `developers` group

### Setting Up a Restricted User

Create a user with limited access:

```bash
# Create restricted shell directory
sudo mkdir /home/restricted
sudo cp /bin/bash /home/restricted/rbash
sudo chmod 755 /home/restricted/rbash

# Create a user with restricted shell
sudo useradd -m -d /home/guest -s /home/restricted/rbash guest

# Create a bin directory with allowed commands
sudo mkdir /home/guest/bin
sudo ln -s /bin/ls /home/guest/bin/
sudo ln -s /bin/cat /home/guest/bin/

# Set ownership
sudo chown -R guest:guest /home/guest/bin

# Add to .bashrc to restrict PATH
echo 'PATH=$HOME/bin' | sudo tee -a /home/guest/.bashrc
echo 'export PATH' | sudo tee -a /home/guest/.bashrc
sudo chown guest:guest /home/guest/.bashrc
```

This creates a restricted user who can only run the `ls` and `cat` commands.

### Setting Up a Service User

Create a non-login user for running a service:

```bash
# Create user without home directory or login shell
sudo useradd --system --no-create-home --shell /usr/sbin/nologin appservice

# Create application directory
sudo mkdir -p /var/www/app
sudo chown appservice:appservice /var/www/app

# Create systemd service file
sudo tee /etc/systemd/system/app.service > /dev/null << 'EOF'
[Unit]
Description=My Application Service
After=network.target

[Service]
User=appservice
Group=appservice
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/python3 /var/www/app/app.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
```

This creates a system user that can run a service but cannot log in interactively.

### Setting Up Disk Quotas

Limit how much disk space users can use:

```bash
# Install quota tools
sudo apt install quota

# Enable quotas in /etc/fstab for the user partition
# Add usrquota to the mount options, e.g.:
# UUID=xxxx / ext4 defaults,usrquota 0 1

# Remount the file system
sudo mount -o remount /

# Create quota files and turn on quotas
sudo quotacheck -cum /
sudo quotaon /

# Set quota for a user (soft limit: 500MB, hard limit: 550MB)
sudo setquota -u username 500000 550000 0 0 /
```

Check quota usage:

```bash
sudo quota -u username
```

## Cloud Environment User Management

When working with cloud servers, you'll often need to set up users. Here's how to do it on a DigitalOcean Droplet:

1. Create a new Droplet (use [this link](https://www.jdoqocy.com/click-101674709-15836238) for $200 in credits)
2. Connect as root
3. Create a non-root user with sudo privileges:

```bash
# Create user
adduser newuser

# Add to sudo group on Ubuntu
usermod -aG sudo newuser

# Add to wheel group on CentOS/RHEL
# usermod -aG wheel newuser

# Create SSH directory and set permissions
mkdir -p /home/newuser/.ssh
chmod 700 /home/newuser/.ssh

# Add your public key
echo "your_public_key_here" > /home/newuser/.ssh/authorized_keys
chmod 600 /home/newuser/.ssh/authorized_keys
chown -R newuser:newuser /home/newuser/.ssh

# Test that you can log in as the new user
# ssh newuser@your_server_ip
```

This process creates a secure, non-root user that can execute administrative commands using sudo.

## Moving Forward

You now understand how to create and manage users and groups, control access with permissions, configure authentication, and set up user environments. These skills are essential for maintaining secure and well-organized Linux systems.

In the next part, we'll explore process management, learning how to monitor, control, and optimize processes running on your Linux system.

User and group management is fundamental to Linux's multi-user design. Whether you're administering a personal system or an enterprise server, these concepts and commands will help you maintain security, organization, and efficiency.
