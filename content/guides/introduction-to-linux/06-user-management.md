---
title: 'Linux User and Group Management: useradd, sudo and SSH Keys'
description: 'Create and manage Linux users and groups with useradd and usermod, read /etc/passwd and /etc/shadow, set up sudo safely, and log in with SSH keys.'
order: 6
---

Linux was built for many people sharing one machine, and the same model protects a server today. Every process runs as some user, and that user's permissions decide what the process can read and change. Give each person their own account, give each service its own account with as little access as possible, and use `sudo` for the moments that need root. Then a mistake or a compromised service stays contained.

This part covers users, groups, the files that store them, `sudo`, SSH keys, and accounts for services.

## Prerequisites

- A Linux machine where you can use `sudo`, ideally a virtual machine or test server, because this part creates and deletes accounts.
- File permissions from [Part 4](/guides/introduction-to-linux/04-file-system-hierarchy).

The output comes from Ubuntu 24.04.5 LTS. The commands are the same on Debian, Fedora and RHEL unless a section says otherwise.

## Users, Groups and IDs

The kernel does not care about names. It identifies users by a number, the **UID**, and groups by a **GID**. The names live in files that tools such as `ls` use to translate.

- **root** is UID 0 and may do anything.
- **System accounts** (UID 1 to 999) run services: `www-data`, `postgres`, `sshd`. They usually cannot log in.
- **Regular users** start at UID 1000.
- Every user has one **primary group** (used for new files) and any number of **supplementary groups** (used for access). On Debian, Ubuntu, Fedora and RHEL, each new user gets a private primary group with the same name.

```terminal
{
  "title": "UID ranges and who is who",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "grep -E '^(UID|GID)_(MIN|MAX)' /etc/login.defs",
      "output": "UID_MIN\t\t\t 1000\nUID_MAX\t\t\t60000\nGID_MIN\t\t\t 1000\nGID_MAX\t\t\t60000"
    },
    {
      "comment": "look up an account by name; id prints the UID, GID and every group",
      "cmd": "id dev",
      "output": "uid=1000(dev) gid=1000(dev) groups=1000(dev),4(adm),27(sudo)"
    },
    {
      "cmd": "groups dev",
      "output": "dev : dev adm sudo"
    }
  ]
}
```

The user `dev` is in the `sudo` group (allowed to use sudo) and in `adm` (allowed to read most logs in `/var/log`). The account the Ubuntu installer creates joins a few more groups, such as `cdrom` and `plugdev` on desktops.

## The Account Files

Three files hold the account database. `getent` reads them the same way the system does, including accounts that come from a directory service such as LDAP.

```terminal
{
  "title": "/etc/passwd, /etc/group and /etc/shadow",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "getent passwd root dev",
      "output": "root:x:0:0:root:/root:/bin/bash\ndev:x:1000:1000:Dev:/home/dev:/bin/bash"
    },
    {
      "cmd": "getent group sudo dev",
      "output": "sudo:x:27:dev\ndev:x:1000:"
    },
    {
      "comment": "only root can read /etc/shadow",
      "cmd": "sudo getent shadow dev",
      "output": "dev:!:20749:0:99999:7:::"
    }
  ]
}
```

`/etc/passwd` is readable by everyone and has seven fields separated by colons:

| Field | Example     | Meaning                                                    |
| ----- | ----------- | ---------------------------------------------------------- |
| 1     | `dev`       | Username                                                   |
| 2     | `x`         | Password placeholder; the hash is in `/etc/shadow`         |
| 3     | `1000`      | UID                                                        |
| 4     | `1000`      | Primary GID                                                |
| 5     | `Dev`       | Comment, usually the full name (GECOS field)               |
| 6     | `/home/dev` | Home directory                                             |
| 7     | `/bin/bash` | Login shell; `/usr/sbin/nologin` blocks interactive logins |

`/etc/shadow` is readable only by root. Its fields are the username, the password hash, the day of the last password change (counted in days since 1 January 1970), the minimum and maximum password age, the warning period, the inactivity period and the expiry date. A hash of `!` or `*` means no password can log in. `/etc/group` lists each group's name, GID and its supplementary members.

:::warning
Never edit these files with a normal editor while users log in. Use the commands below, or `vipw` and `vigr`, which lock the files and check the result.
:::

## Create Users

Two commands create accounts:

- **`useradd`** is the low-level tool on every distribution. On Debian and Ubuntu it does not create a home directory or set a usable shell unless you ask, so always pass `-m` and `-s`.
- **`adduser`** on Debian and Ubuntu is a friendlier wrapper that creates the home directory, copies the default files and asks for a password and full name. On Fedora and RHEL, `adduser` is just another name for `useradd`, which creates the home directory by default.

```terminal
{
  "title": "create a user with useradd",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "-m home directory, -s login shell, -c full name; prints nothing on success",
      "cmd": "sudo useradd -m -s /bin/bash -c \"Alice Smith\" alice"
    },
    {
      "cmd": "getent passwd alice",
      "output": "alice:x:1001:1001:Alice Smith:/home/alice:/bin/bash"
    },
    {
      "comment": "set a password: you type it twice and nothing is shown (example output)",
      "cmd": "sudo passwd alice",
      "output": "New password:\nRetype new password:\npasswd: password updated successfully"
    },
    {
      "comment": "the hash starts with $y$: yescrypt, the default on current Debian, Ubuntu and Fedora",
      "cmd": "sudo getent shadow alice | cut -c 1-24",
      "output": "alice:$y$j9T$QxhbbjZKr80"
    },
    {
      "comment": "P = usable password, L = locked, NP = no password",
      "cmd": "sudo passwd -S alice",
      "output": "alice P 2026-10-23 0 99999 7 -1"
    }
  ]
}
```

`useradd -m` copies everything in `/etc/skel` into the new home directory, which is how every user starts with the same `.bashrc` and `.profile`:

```terminal
{
  "title": "the template for new home directories",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ls -A /etc/skel",
      "output": ".bash_logout\n.bashrc\n.profile"
    }
  ]
}
```

`adduser` does all of this in one interactive step. On Ubuntu 24.04 it prints this (example output from a machine where only the installation user exists, so Bob gets UID 1001):

```bash
sudo adduser bob
```

```text
info: Adding user `bob' ...
info: Selecting UID/GID from range 1000 to 59999 ...
info: Adding new group `bob' (1001) ...
info: Adding new user `bob' (1001) with group `bob (1001)' ...
info: Creating home directory `/home/bob' ...
info: Copying files from `/etc/skel' ...
New password:
Retype new password:
passwd: password updated successfully
Changing the user information for bob
Enter the new value, or press ENTER for the default
	Full Name []: Bob Builder
	Room Number []:
	Work Phone []:
	Home Phone []:
	Other []:
Is the information correct? [Y/n] y
```

## Groups and Group Membership

Groups give several users the same access, for example to a shared directory or to the Docker socket.

```terminal
{
  "title": "create a group and add members",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo groupadd developers"
    },
    {
      "comment": "-aG appends to the supplementary groups",
      "cmd": "sudo usermod -aG developers alice"
    },
    {
      "cmd": "id alice",
      "output": "uid=1001(alice) gid=1001(alice) groups=1001(alice),1002(developers)"
    },
    {
      "cmd": "getent group developers",
      "output": "developers:x:1002:alice"
    },
    {
      "comment": "gpasswd -d removes one user from one group",
      "cmd": "sudo gpasswd -d alice developers",
      "output": "Removing user alice from group developers"
    },
    {
      "cmd": "id alice",
      "output": "uid=1001(alice) gid=1001(alice) groups=1001(alice)"
    }
  ]
}
```

:::warning
`usermod -G developers alice` without `-a` **replaces** all of Alice's supplementary groups with `developers`. Run it on your own account without `-a` and you can drop yourself out of the `sudo` group. Always use `-aG`.
:::

Group changes apply to **new** logins. A user who is already logged in must log out and back in (or start a new SSH session) before `id` shows the new group. `newgrp developers` starts a shell with the new group in the meantime.

Other group commands: `sudo groupmod -n new-name old-name` renames a group, `sudo groupdel developers` deletes it, and `sudo gpasswd -a alice developers` is another way to add a member.

## Change, Lock and Delete Accounts

`usermod` changes any field of an existing account: `-s` the shell, `-c` the comment, `-d -m` the home directory (and moves its contents), `-l` the login name. `chage` manages password and account ageing:

```terminal
{
  "title": "account ageing and locking",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo chage -l alice",
      "output": "Last password change\t\t\t\t\t: Oct 23, 2026\nPassword expires\t\t\t\t\t: never\nPassword inactive\t\t\t\t\t: never\nAccount expires\t\t\t\t\t\t: never\nMinimum number of days between password change\t\t: 0\nMaximum number of days between password change\t\t: 99999\nNumber of days of warning before password expires\t: 7"
    },
    {
      "comment": "lock the password AND expire the account, so SSH keys stop working too",
      "cmd": "sudo usermod --lock --expiredate 1 alice"
    },
    {
      "cmd": "sudo passwd -S alice",
      "output": "alice L 2026-10-23 0 99999 7 -1"
    },
    {
      "cmd": "sudo chage -l alice | head -n 4",
      "output": "Last password change\t\t\t\t\t: Oct 23, 2026\nPassword expires\t\t\t\t\t: never\nPassword inactive\t\t\t\t\t: never\nAccount expires\t\t\t\t\t\t: Jan 02, 1970"
    },
    {
      "comment": "undo: unlock and remove the expiry date",
      "cmd": "sudo usermod --unlock --expiredate '' alice"
    }
  ]
}
```

`passwd -l` and `usermod --lock` only disable the **password**. A user with an SSH key in `~/.ssh/authorized_keys` can still log in. To shut an account off completely, also expire it (`--expiredate 1`). Setting the shell to `/usr/sbin/nologin` is not enough on its own: it blocks interactive shells, but an SSH client can still log in without a shell (`ssh -N`) and use port forwarding.

Forcing everyone to change their password every 90 days is no longer recommended: current guidance (NIST SP 800-63B) asks for long passwords and a change only when one may have leaked. `sudo chage -d 0 alice` forces a change at the next login, which is useful after you set a temporary password.

To delete an account:

```bash
sudo userdel -r bob                # -r also deletes /home/bob and the mail spool
sudo find / -xdev -nouser -ls      # files elsewhere that no account owns any more
```

Many teams lock and expire a departed user's account first and delete it later, after they have checked what the account owned.

## sudo: Admin Rights Without Logging in as Root

`sudo` runs one command as root (or as another user) after checking your own password. Every use is logged, and you only hold root for that one command. On Ubuntu, the root account has no password at all, so `sudo` is the only way in:

```terminal
{
  "title": "root on Ubuntu has no usable password",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo passwd -S root",
      "output": "root L 2026-09-08 0 99999 7 -1"
    }
  ]
}
```

Useful forms:

```bash
sudo apt update                 # one command as root
sudo -u postgres psql           # one command as another user
sudo -i                         # a root login shell (type exit to leave)
sudo -l                         # what am I allowed to run?
sudoedit /etc/ssh/sshd_config   # edit a file as root, with your own editor and settings
```

Who may use `sudo` is defined in `/etc/sudoers` and in files under `/etc/sudoers.d/`. The Ubuntu default (comments removed):

```terminal
{
  "title": "the default sudoers file on Ubuntu",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo grep -v '^#' /etc/sudoers | grep .",
      "output": "Defaults\tenv_reset\nDefaults\tmail_badpass\nDefaults\tsecure_path=\"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin\"\nDefaults\tuse_pty\nroot\tALL=(ALL:ALL) ALL\n%admin ALL=(ALL) ALL\n%sudo\tALL=(ALL:ALL) ALL\n@includedir /etc/sudoers.d"
    }
  ]
}
```

`%sudo ALL=(ALL:ALL) ALL` reads: members of the group `sudo` (the `%` marks a group), on all hosts, may run commands as any user and any group, and may run all commands. On Fedora and RHEL the group is called **wheel**, so you grant admin rights with `sudo usermod -aG wheel alice`.

### Give Limited Rights With a Drop-In File

Do not edit `/etc/sudoers` itself. Put each rule in its own file under `/etc/sudoers.d/` and check it with `visudo`, because a syntax error in a sudoers file can lock everyone out of `sudo`. This rule lets the members of `developers` restart one service, and nothing else:

```terminal
{
  "title": "a drop-in sudoers rule",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "the rule (written with: sudo visudo -f /etc/sudoers.d/90-deploy)",
      "cmd": "sudo cat /etc/sudoers.d/90-deploy",
      "output": "# Developers may restart the web app, and nothing else\n%developers ALL=(root) /usr/bin/systemctl restart notes-site.service"
    },
    {
      "comment": "sudoers files must not be writable by anyone but root",
      "cmd": "sudo chmod 0440 /etc/sudoers.d/90-deploy"
    },
    {
      "comment": "check the syntax of every sudoers file",
      "cmd": "sudo visudo -c",
      "output": "/etc/sudoers: parsed OK\n/etc/sudoers.d/90-deploy: parsed OK\n/etc/sudoers.d/README: parsed OK"
    }
  ]
}
```

And this is what a mistake looks like. `visudo` catches it before it can do damage:

```terminal
{
  "title": "visudo catches a syntax error",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo visudo -cf /etc/sudoers.d/91-broken",
      "output": "/etc/sudoers.d/91-broken:1:70: syntax error\n%developers ALL=(root) /usr/bin/systemctl restart notes-site.service,,\n                                                                     ^"
    }
  ]
}
```

Rules of thumb for sudo:

- Use full paths to commands in rules, and avoid rules that allow editors, shells, pagers such as `less`, `find` or `tar` as root: each of them can start a root shell. To let people read a service's logs, add them to the `systemd-journal` group instead of giving them `sudo journalctl`.
- Avoid `NOPASSWD:` for people. It is acceptable for a narrowly scoped automation account, such as a deploy user allowed to restart one service.
- Keep a root shell open in a second terminal while you change sudo rules on a remote server, so you can fix a mistake.

:::note
Ubuntu 25.10 and 26.04 LTS use **sudo-rs**, a rewrite of sudo in Rust, as `sudo`. The commands and the common sudoers syntax work the same; a few rarely used options are not supported. The original sudo is still installed as `sudo.ws`, and `sudo update-alternatives --config sudo` switches between them.
:::

## SSH Keys

SSH keys replace passwords for remote logins. You keep the **private key** on your own machine and copy the **public key** to every server you want to reach. Keys cannot be guessed the way passwords can, and you can turn password logins off completely once keys work (Part 10).

For a key that you use yourself, run `ssh-keygen -t ed25519` and type a passphrase when it asks; `ssh-agent` remembers the passphrase for your session. An automated job cannot type a passphrase, so its key is created with an empty one (`-N ''`), and you protect it with file permissions and by limiting what it can do on the server:

```terminal
{
  "title": "create an SSH key pair",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ssh-keygen -t ed25519 -C \"deploy@devbox\" -f ~/.ssh/id_ed25519 -N ''",
      "output": "Created directory '/home/dev/.ssh'.\nGenerating public/private ed25519 key pair.\nYour identification has been saved in /home/dev/.ssh/id_ed25519\nYour public key has been saved in /home/dev/.ssh/id_ed25519.pub\nThe key fingerprint is:\nSHA256:fcdr9NiTlNJF/ZyteHqJyVEr61k1YlgTJpSpDp7IWks deploy@devbox\nThe key's randomart image is:\n+--[ED25519 256]--+\n|          .ooo  o|\n|           oo ...|\n|          .  o .=|\n|       . o  o.+.*|\n|    . o S ...*+B.|\n|     E o . .=oB*o|\n|    + .    . O=+o|\n|   . .      *+o .|\n|           .o.   |\n+----[SHA256]-----+"
    },
    {
      "cmd": "ls -l ~/.ssh",
      "output": "total 8\n-rw------- 1 dev dev 399 Oct 23 20:22 id_ed25519\n-rw-r--r-- 1 dev dev  95 Oct 23 20:22 id_ed25519.pub"
    },
    {
      "cmd": "stat -c '%A %n' ~/.ssh",
      "output": "drwx------ /home/dev/.ssh"
    }
  ]
}
```

`ssh-keygen` creates `~/.ssh` with mode `700` and the private key with `600`. SSH refuses to use a private key that others can read. Use **Ed25519** keys; use RSA (at least 3072 bits) only for old systems that do not support Ed25519. OpenSSH 10 no longer supports DSA keys at all. With a FIDO2 security key, `ssh-keygen -t ed25519-sk` keeps the private key on the hardware.

Copy the public key to a server:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub alice@203.0.113.10
```

`ssh-copy-id` appends the key to `~/.ssh/authorized_keys` on the server and fixes the permissions. Without it, append the contents of the `.pub` file to that file yourself and make sure `~/.ssh` is `700` and `authorized_keys` is `600`, both owned by the user. Then log in with `ssh alice@203.0.113.10`. The [SSH basics interview questions](/interview-questions/junior/ssh-basics) go through the most common problems.

## Accounts for Services

A service should never run as root or as a person's account. Give it a **system account** with no password, no login shell and access only to its own files:

```terminal
{
  "title": "a system account for a service",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo useradd --system --no-create-home --shell /usr/sbin/nologin notes-site"
    },
    {
      "cmd": "getent passwd notes-site",
      "output": "notes-site:x:999:999::/home/notes-site:/usr/sbin/nologin"
    }
  ]
}
```

System accounts get UIDs below 1000, counted down from 999. In the systemd unit, `User=notes-site` runs the service as that account (Part 10). For services that need no files of their own, systemd can create a temporary user each time the service starts with `DynamicUser=yes`, so you do not have to manage the account at all.

## Login Files and the User Environment

When you log in, the shell reads several files in order. Knowing which one runs when saves a lot of "my variable is not set" confusion:

| File                                     | When it is read                                                                               | Use it for                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/etc/environment`                       | Every login (by PAM, not by the shell)                                                        | Simple `KEY=value` lines for all users, such as `PATH` |
| `/etc/profile` and `/etc/profile.d/*.sh` | Login shells, all users                                                                       | System-wide shell settings                             |
| `~/.profile` (or `~/.bash_profile`)      | Your login shells (SSH login, console login)                                                  | `PATH` changes, environment variables                  |
| `~/.bashrc`                              | Interactive non-login shells, such as a new terminal tab; Ubuntu's `~/.profile` also reads it | Aliases, prompt, shell options                         |

Two rules cover most cases: put environment variables in `~/.profile`, and aliases and prompt settings in `~/.bashrc`. Services started by systemd read none of these files; set their environment in the unit file with `Environment=` or `EnvironmentFile=`.

Per-user resource limits for login sessions (open files, processes) live in `/etc/security/limits.conf` and `/etc/security/limits.d/`, and `ulimit -a` shows the current values. For services, set limits in the unit file instead (`LimitNOFILE=65536`), because systemd does not apply `limits.conf` to services.

Password policies come from **PAM**, the Pluggable Authentication Modules configured in `/etc/pam.d/`. To require longer passwords, install `libpam-pwquality` on Debian and Ubuntu (RHEL and Fedora ship it) and set, for example, `minlen = 14` in `/etc/security/pwquality.conf`.

## First Admin User on a New Cloud Server

Many cloud images let you log in as `root` (DigitalOcean) or as a default user such as `ubuntu`, `admin` or `ec2-user` (AWS). On a fresh server, create your own admin account and check that it works before you turn off root logins:

No server yet? Any cloud provider works. For DigitalOcean, you can create a Droplet through [this referral link](https://m.do.co/c/2a9bba940f39); new accounts get DigitalOcean's standard [sign-up credit](https://docs.digitalocean.com/platform/billing/signup-credit/).

```bash
# as root on the new server
adduser alice                          # Fedora/RHEL: useradd -m alice && passwd alice
usermod -aG sudo alice                 # Fedora/RHEL: usermod -aG wheel alice
rsync --archive --chown=alice:alice ~/.ssh /home/alice   # reuse root's authorized_keys

# from your own machine, in a NEW terminal, keep the root session open
ssh alice@203.0.113.10
sudo -v                                # asks for alice's password, proves sudo works
```

Only when that works, disable root and password logins in the SSH server configuration ([Part 10](/guides/introduction-to-linux/10-system-administration)).

## Common Mistakes

- **`usermod -G` without `-a`.** It removes the user from every other group.
- **Expecting group changes to apply immediately.** Log out and back in.
- **Locking only the password** of someone who has SSH keys. Expire the account too.
- **Editing `/etc/sudoers` directly** and saving a syntax error. Use `visudo` and drop-in files.
- **Wrong permissions on `~/.ssh`**: SSH silently ignores `authorized_keys` if the home directory, `~/.ssh` or the file is writable by others. On the server, `journalctl -u ssh` (Debian, Ubuntu) or `journalctl -u sshd` (Fedora, RHEL) shows why a key login failed; Ubuntu also writes it to `/var/log/auth.log`.
- **Running services as root** or as your own user. Create a system account.
- **Shared accounts.** If several people use one login, nobody can tell from the logs who did what.

## Summary

- Users and groups are numbers (UID, GID) with names in `/etc/passwd` and `/etc/group`; password hashes live in `/etc/shadow`.
- `useradd -m -s /bin/bash` or `adduser` create accounts; `usermod -aG` adds groups; `passwd`, `chage` and `usermod --lock --expiredate 1` manage passwords and access.
- `sudo` grants root for one command; manage rules with `visudo` in `/etc/sudoers.d/`. The admin group is `sudo` on Debian and Ubuntu, `wheel` on Fedora and RHEL.
- Use Ed25519 SSH keys with a passphrase, `ssh-copy-id`, and strict permissions on `~/.ssh`.
- Run each service under its own system account with no login shell.

Next: [Process Management](/guides/introduction-to-linux/07-process-management), where you see what those users and services are running and how to control it.

## Keep Learning

- Interview questions: [SSH basics and key authentication](/interview-questions/junior/ssh-basics)
- [SSH Hardening Checklist](/checklists/ssh-hardening)
- Exercise: [Securing your Linux server: essential first steps](/exercises/linux-server-security)
- [OpenSSH 10.6: domain usernames and compression](/posts/openssh-10-6-domain-usernames-and-compression)
