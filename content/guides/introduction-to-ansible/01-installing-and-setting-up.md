---
title: 'Install Ansible and Run Your First Commands'
description: 'Install ansible-core 2.21 with pipx, set up SSH access to two Ubuntu servers, write an inventory and ansible.cfg, and run your first ad-hoc commands.'
order: 1
---

Ansible runs from one machine, the **control node**, and configures the machines you point it at, the **managed nodes**. Nothing runs on the managed nodes between runs: Ansible connects over SSH, copies a small Python program for each task, runs it and removes it again. That is why you can start managing an existing server in minutes, without installing an agent first.

In this part you install Ansible on your control node, give it SSH access to two servers, create a project directory with an inventory and a configuration file, and run your first commands on both servers at once.

## Prerequisites

- A Linux or macOS computer to use as the control node. On Windows, use [WSL 2](https://learn.microsoft.com/windows/wsl/install) with Ubuntu: Windows itself cannot be a control node, but WSL can.
- One or two Linux servers you can reach over SSH. Any recent distribution works; this guide uses Ubuntu 24.04 LTS. The next section shows how to get some if you have none.
- Basic comfort with a shell and SSH. The [Introduction to Linux](/guides/introduction-to-linux) guide covers both.

## How Ansible Connects to Your Servers

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "ansible / ansible-playbook", "icon": "gear", "tone": "accent" },
    { "label": "SSH :22", "icon": "lock", "tone": "slate" },
    { "label": "Python module", "sub": "runs, prints JSON, is removed", "icon": "box", "tone": "blue" }
  ],
  "groups": [
    {
      "label": "control node",
      "sub": "Ubuntu 24.04, ansible-core 2.21",
      "icon": "cpu",
      "tone": "violet",
      "nodes": [
        { "label": "inventory", "sub": "which hosts", "icon": "database", "tone": "slate" },
        { "label": "playbooks", "sub": "what to do", "icon": "gear", "tone": "slate" }
      ]
    },
    {
      "label": "managed nodes",
      "sub": "SSH server + Python 3",
      "icon": "server",
      "tone": "green",
      "nodes": [
        { "label": "web1", "sub": "192.168.56.11", "icon": "server", "tone": "green" },
        { "label": "web2", "sub": "192.168.56.12", "icon": "server", "tone": "green" }
      ]
    }
  ]
}
```

The requirements are small, but they differ between the two sides:

|                  | Control node                       | Managed node                                                      |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------- |
| Operating system | Linux, macOS, or WSL on Windows    | Any Unix-like system; Windows through WinRM or SSH                |
| Python           | 3.12 to 3.14 for ansible-core 2.21 | 3.9 to 3.14 (needed by most modules)                              |
| Other software   | an SSH client                      | an SSH server                                                     |
| Access           | your SSH key                       | a user that accepts the key, with `sudo` for tasks that need root |

## Install Ansible on the Control Node

### ansible-core or ansible?

Two Python packages carry the name, and you install one of them:

- **ansible-core** is the engine: the command line tools (`ansible`, `ansible-playbook`, `ansible-galaxy` and more) and the `ansible.builtin` collection of about 70 modules for packages, files, services, users and commands.
- **ansible** is ansible-core plus a curated set of 92 community collections, for cloud providers, network devices, databases and more. Version 14.5.0 depends on ansible-core 2.21, and its wheel is a 51 MB download.

This guide installs ansible-core and adds the two collections it needs in [Part 8](/guides/introduction-to-ansible/08-roles-and-organization). You get a small install and a list of collections that you choose and pin.

### Install ansible-core with pipx

Use **pipx**, the first method in the Ansible installation guide. It installs Python command line tools into their own virtual environment and puts the commands on your `PATH`, which keeps Ansible's Python libraries away from the ones your system packages use. Current distributions such as Ubuntu 24.04 refuse a plain `pip install` outside a virtual environment anyway (the system Python is marked as externally managed), so pipx or a venv are the practical choices.

On Ubuntu or Debian, install pipx from the distribution:

```terminal
{
  "title": "install pipx (Ubuntu 24.04)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo apt update"
    },
    {
      "cmd": "sudo apt install -y pipx"
    },
    {
      "cmd": "pipx --version",
      "output": "1.4.3"
    }
  ]
}
```

Then install ansible-core as your normal user, without `sudo`. Pin the version so that every machine and every CI run gets the same one:

```terminal
{
  "title": "install ansible-core 2.21",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "pipx install ansible-core==2.21.5",
      "output": "  installed package ansible-core 2.21.5, installed using Python 3.12.3\n  These apps are now globally available\n    - ansible\n    - ansible-config\n    - ansible-console\n    - ansible-doc\n    - ansible-galaxy\n    - ansible-inventory\n    - ansible-playbook\n    - ansible-pull\n    - ansible-test\n    - ansible-vault"
    },
    {
      "cmd": "pipx ensurepath"
    }
  ]
}
```

`pipx ensurepath` adds `~/.local/bin` to your `PATH` in your shell's startup file. Open a new terminal (or run `source ~/.bashrc`), then check the installation:

```bash
ansible --version
```

```text
ansible [core 2.21.5]
  config file = None
  configured module search path = ['/home/dev/.ansible/plugins/modules', '/usr/share/ansible/plugins/modules']
  ansible python module location = /home/dev/.local/share/pipx/venvs/ansible-core/lib/python3.12/site-packages/ansible
  ansible collection location = /home/dev/.ansible/collections:/usr/share/ansible/collections
  executable location = /home/dev/.local/bin/ansible
  python version = 3.12.3 (main, Aug 31 2026, 10:18:26) [GCC 13.3.0] (/home/dev/.local/share/pipx/venvs/ansible-core/bin/python)
  jinja version = 3.1.6
  pyyaml version = 6.0.3 (with libyaml v0.2.5)
```

Read it from the top:

- **core 2.21.5** is the ansible-core version.
- **config file = None**: Ansible found no `ansible.cfg` yet. You create one later in this part.
- **ansible collection location**: where `ansible-galaxy` installs collections by default.
- **python version** is the Python inside the pipx environment, which Ansible uses on the control node. On the managed nodes, Ansible finds Python separately.

Other ways to install Ansible:

```tabs
{
  "title": "Other ways to install Ansible",
  "tabs": [
    {
      "label": "pip in a venv",
      "lang": "bash",
      "code": "python3 -m venv ~/.venvs/ansible\n~/.venvs/ansible/bin/pip install ansible-core==2.21.5\n# put ~/.venvs/ansible/bin on your PATH, or activate the venv:\nsource ~/.venvs/ansible/bin/activate"
    },
    {
      "label": "uv",
      "lang": "bash",
      "code": "uv tool install ansible-core==2.21.5"
    },
    {
      "label": "macOS (Homebrew)",
      "lang": "bash",
      "code": "# installs the full \"ansible\" package (14.5.0 in October 2026)\nbrew install ansible"
    },
    {
      "label": "Fedora",
      "lang": "bash",
      "code": "# Fedora 44 packages ansible-core 2.20\nsudo dnf install ansible-core"
    },
    {
      "label": "Ubuntu PPA",
      "lang": "bash",
      "code": "# the Ansible team's PPA has the full \"ansible\" package (14.5.0 for 24.04 and 26.04)\nsudo add-apt-repository --yes --update ppa:ansible/ansible\nsudo apt install ansible"
    }
  ]
}
```

:::warning
Do not install Ansible with plain `sudo apt install ansible` on Ubuntu 24.04. The distribution froze an old release:

```bash
apt-cache policy ansible ansible-core | grep -E '^[a-z]|Candidate'
```

```text
ansible:
  Candidate: 9.2.0+dfsg-0ubuntu5
ansible-core:
  Candidate: 2.16.3-0ubuntu2
```

ansible-core 2.16 reached its end of life in May 2025, so many current modules, collections and examples do not work with it.
:::

ansible-core 2.21 runs on Python 3.12 to 3.14 and is supported until November 2027, with only critical fixes from November 2026 and only security fixes from May 2027. **ansible-core 2.22**, due on 2 November 2026, needs Python 3.13 or newer on the control node. Ubuntu 24.04 ships Python 3.12, so pipx keeps installing 2.21 there. To move to 2.22, install a newer Python first and move the pipx environment to it, for example with `uv python install 3.13` and `pipx reinstall ansible-core --python "$(uv python find 3.13)"`; then install the new version with `pipx install --force ansible-core==2.22.0` once it is released. Or use Ubuntu 26.04. `pipx upgrade ansible-core` moves to the newest release that your Python supports, ignoring the pin: on Python 3.12 that stays within 2.21, on 3.13 it jumps to 2.22 once it is out. To stay on a chosen version, install it explicitly instead, for example `pipx install --force ansible-core==2.21.5`.

## Get Servers to Manage

You need at least one server; two make the examples more interesting, because Ansible runs every task on all hosts in parallel. Some options:

- **Cloud servers.** Create two small Ubuntu 24.04 servers and add your SSH public key when you create them. On DigitalOcean, these are [Droplets](https://m.do.co/c/2a9bba940f39); the smallest size is enough for this guide. This is a referral link: if you later spend $25 on DigitalOcean, this site gets $25 in credit. New accounts that sign up through it get DigitalOcean's standard signup credit, which its [documentation](https://docs.digitalocean.com/platform/billing/signup-credit/) lists as $5, valid for 90 days (checked in October 2026), and you need a valid payment method before you can create a Droplet. Droplets log you in as `root`; create a user with `sudo` rights, or use `root` as the remote user while you learn.
- **Local VMs.** [Multipass](https://canonical.com/multipass) starts Ubuntu VMs on Linux, macOS and Windows. Pass your public key with cloud-init so that you can log in as `ubuntu`:

```bash
cat > lab.yaml <<EOF
#cloud-config
ssh_authorized_keys:
  - $(cat ~/.ssh/id_ed25519.pub)
EOF
multipass launch 24.04 --name web1 --cloud-init lab.yaml
multipass launch 24.04 --name web2 --cloud-init lab.yaml
multipass list   # shows the IP address of each VM
```

Create the SSH key first (next section) if you do not have one.

This guide uses two Ubuntu 24.04.5 servers built from Ubuntu's cloud image, so they behave like servers from a cloud provider:

| Host   | Address         | Login user                         |
| ------ | --------------- | ---------------------------------- |
| `web1` | `192.168.56.11` | `ubuntu`, with passwordless `sudo` |
| `web2` | `192.168.56.12` | `ubuntu`, with passwordless `sudo` |

Replace the addresses and user with yours in every example.

## Set Up SSH Access

Ansible uses your normal SSH client and its configuration, so anything that works with `ssh` works with Ansible. Get plain `ssh` working first.

### Create a key pair

If you do not have a key yet, create an Ed25519 key. A passphrase protects the key if someone copies it; if you set one, load the key into `ssh-agent` with `ssh-add` before you run Ansible, so that you are not asked for it on every connection. Run `ssh-keygen -t ed25519` without options to be asked for a file name and a passphrase. For this lab key, the options give the file name and an empty passphrase:

```terminal
{
  "title": "create an SSH key",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ssh-keygen -t ed25519 -C \"dev@control\" -f ~/.ssh/id_ed25519 -N \"\"",
      "output": "Generating public/private ed25519 key pair.\nYour identification has been saved in /home/dev/.ssh/id_ed25519\nYour public key has been saved in /home/dev/.ssh/id_ed25519.pub\nThe key fingerprint is:\nSHA256:bqBtgn7GmN8S0hQs0w1Lji7ChSIIAXcjFdxwHNkjOHM dev@control\nThe key's randomart image is:\n+--[ED25519 256]--+\n|=.o=OOo+         |\n|o.+*O+E o        |\n|+..+o= . .       |\n|+.. .            |\n|o..o  . S        |\n|....oo o         |\n|  .=o.o o        |\n| .o =+ .         |\n|  .+...          |\n+----[SHA256]-----+"
    }
  ]
}
```

### Copy the public key to the servers

Cloud providers and Multipass put the key on the server when they create it. For a server that still accepts password logins, copy it with `ssh-copy-id ubuntu@192.168.56.11`, enter the password once, and from then on the key works.

### Trust the servers' host keys

The first time you connect, SSH asks you to confirm the server's **host key**. Ansible cannot answer that question for you in the middle of a run, so collect the keys once with `ssh-keyscan` and add them to `~/.ssh/known_hosts`:

```terminal
{
  "title": "add the host keys to known_hosts",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ssh-keyscan -t ed25519 192.168.56.11 192.168.56.12 >> ~/.ssh/known_hosts",
      "output": "# 192.168.56.11:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.20\n# 192.168.56.12:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.20"
    },
    {
      "comment": "compare these fingerprints with the ones your provider or the server console shows",
      "cmd": "ssh-keygen -lf ~/.ssh/known_hosts",
      "output": "256 SHA256:KrfYaKHmZTxV2A0raOysZ16BIxcsaNXO15JEe7RWvsY 192.168.56.11 (ED25519)\n256 SHA256:T9rtscy0kmOTnkao+RnnkrX3qER6rnh1Ik/VTOqDm3o 192.168.56.12 (ED25519)"
    }
  ]
}
```

`ssh-keyscan` trusts whatever answers on that address, so compare the fingerprints with the ones the server prints on its console or that your cloud provider shows. Many tutorials set `host_key_checking = False` instead. That turns off the check that protects you from connecting to the wrong machine, so keep it on.

### Test plain SSH

```bash
ssh ubuntu@192.168.56.11 'hostname; python3 --version; sudo -n true && echo "sudo works"'
```

```text
web1
Python 3.12.3
sudo works
```

If that prints the hostname, a Python version and `sudo works`, Ansible will work too.

## Your First Ad-Hoc Command

An **ad-hoc command** runs one module on a set of hosts, straight from the command line. The `ansible.builtin.ping` module logs in, runs a little Python, and answers `pong`:

```bash
ansible all -i 192.168.56.11,192.168.56.12, -u ubuntu -m ansible.builtin.ping
```

```text
[WARNING]: Host '192.168.56.11' is using the discovered Python interpreter at '/usr/bin/python3.12', but future installation of another Python interpreter could cause a different interpreter to be discovered. See https://docs.ansible.com/ansible-core/2.21/reference_appendices/interpreter_discovery.html for more information.
[WARNING]: Host '192.168.56.12' is using the discovered Python interpreter at '/usr/bin/python3.12', but future installation of another Python interpreter could cause a different interpreter to be discovered. See https://docs.ansible.com/ansible-core/2.21/reference_appendices/interpreter_discovery.html for more information.
192.168.56.11 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.12"
    },
    "changed": false,
    "ping": "pong"
}
192.168.56.12 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.12"
    },
    "changed": false,
    "ping": "pong"
}
```

What the command means:

- `all` is the **host pattern**: run on every host in the inventory.
- `-i 192.168.56.11,192.168.56.12,` is an inline inventory. The trailing comma tells Ansible that this is a list of hosts and not the name of an inventory file.
- `-u ubuntu` is the remote user.
- `-m ansible.builtin.ping` is the module, written with its **fully qualified collection name** (FQCN): collection `ansible.builtin`, module `ping`.

`ping` here is not ICMP ping: a `SUCCESS` proves that SSH, the login and Python on the server all work. `changed: false` means the module changed nothing, which is what you expect from a check.

`discovered_interpreter_python` shows which Python Ansible found on the server, and the warnings above the results are about the same thing. ansible-core 2.21 warns whenever it uses a discovered interpreter, because installing another Python version on the server later could make the next run pick a different one. You fix that in the inventory in the next section by setting `ansible_python_interpreter`.

## Create the Project: Inventory and ansible.cfg

Typing addresses and options every time does not scale. Create a project directory for the rest of this guide:

```bash
mkdir ~/webfleet && cd ~/webfleet
```

An **inventory** lists your hosts and puts them in groups. Save this as `inventory.ini`:

```ini
[web]
web1 ansible_host=192.168.56.11
web2 ansible_host=192.168.56.12

[web:vars]
ansible_user=ubuntu
ansible_python_interpreter=/usr/bin/python3
```

`web1` and `web2` are the names Ansible shows in its output; `ansible_host` is the address it connects to. The `[web:vars]` section applies to every host in the `web` group, which for now is every host: `ansible_user` is the login user, and `ansible_python_interpreter` names the Python to use, which also silences the discovery warning. `/usr/bin/python3` exists on every current Ubuntu, Debian, Fedora and RHEL release. [Part 4](/guides/introduction-to-ansible/04-working-with-inventory) moves this into YAML with group and host variables.

Then tell Ansible to use that inventory by default. Save this as `ansible.cfg` in the same directory:

```ini
[defaults]
inventory = inventory.ini
```

Ansible reads the first configuration file it finds, in this order: the file in the `ANSIBLE_CONFIG` environment variable, `ansible.cfg` in the current directory, `~/.ansible.cfg`, then `/etc/ansible/ansible.cfg`. A project-level `ansible.cfg` keeps the settings in Git with the playbooks. Ansible ignores it, with a warning, if the directory is world-writable, because anyone could plant a configuration there.

Now commands get short. Check the inventory, then run a few commands:

```terminal
{
  "title": "the inventory at work",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/webfleet"
    },
    {
      "cmd": "ansible-inventory --graph",
      "output": "@all:\n  |--@ungrouped:\n  |--@web:\n  |  |--web1\n  |  |--web2"
    },
    {
      "comment": "the command module is the default, so -m can be left out",
      "cmd": "ansible web -a \"uptime\"",
      "output": "web1 | CHANGED | rc=0 >>\n 03:27:59 up  5:06,  1 user,  load average: 0.00, 0.03, 0.12\nweb2 | CHANGED | rc=0 >>\n 03:27:59 up  5:04,  1 user,  load average: 0.08, 0.04, 0.10"
    },
    {
      "cmd": "ansible web1 -a \"df -h /\"",
      "output": "web1 | CHANGED | rc=0 >>\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/root       2.4G  645M  1.8G  27% /"
    },
    {
      "comment": "which settings differ from the defaults, and where they come from",
      "cmd": "ansible-config dump --only-changed",
      "output": "CONFIG_FILE() = /home/dev/webfleet/ansible.cfg\nDEFAULT_HOST_LIST(/home/dev/webfleet/ansible.cfg) = ['/home/dev/webfleet/inventory.ini']\n\nGALAXY_SERVERS:"
    }
  ]
}
```

The `CHANGED` in the output does not mean that `uptime` changed anything: the `command` module cannot know what a command does, so it always reports a change. [Part 3](/guides/introduction-to-ansible/03-writing-your-first-playbook) shows how to fix that with `changed_when`.

## Run Commands as Root with become

You log in as `ubuntu`, but installing packages or editing files in `/etc` needs root. Ansible's **become** feature runs the module through `sudo` (or another method such as `su` or `doas`). Add `--become` (short: `-b`):

```terminal
{
  "title": "become runs the module with sudo",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/webfleet"
    },
    {
      "cmd": "ansible web -a \"whoami\"",
      "output": "web2 | CHANGED | rc=0 >>\nubuntu\nweb1 | CHANGED | rc=0 >>\nubuntu"
    },
    {
      "cmd": "ansible web -a \"whoami\" --become",
      "output": "web1 | CHANGED | rc=0 >>\nroot\nweb2 | CHANGED | rc=0 >>\nroot"
    }
  ]
}
```

These servers allow `sudo` without a password, as most cloud images do. If your user needs a password for `sudo`, add `--ask-become-pass` (short: `-K`), and Ansible asks for it once per run.

## Fix the First Errors

Most first-day problems are SSH problems. These are the errors you will meet, produced on purpose.

**Unknown host key.** Without an entry in `known_hosts`, SSH refuses to connect in a non-interactive run:

```bash
ansible web1 -m ansible.builtin.ping
```

```text
[ERROR]: Task failed: Failed to connect to the host via ssh: Host key verification failed.
Origin: <adhoc 'ansible.builtin.ping' task>

{'action': 'ansible.builtin.ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: Host key verification failed.",
    "unreachable": true
}
```

Fix: add the key with `ssh-keyscan` as shown above. If a server was rebuilt and its key changed, SSH prints a much louder `REMOTE HOST IDENTIFICATION HAS CHANGED` warning; remove the old entry with `ssh-keygen -R 192.168.56.11` and scan again, but only after you know why the key changed.

**Wrong user.** Ubuntu cloud images refuse `root` logins with a message. To try it, override the user with `-e`, because `-u root` alone would lose against the `ansible_user` in the inventory: variables always win over command line options, except `-e`, which wins over everything.

```bash
ansible web1 -m ansible.builtin.ping -e ansible_user=root
```

The first line of the output, which ends with the server's message:

```text
[ERROR]: Task failed: Failed to create temporary directory. In some cases, you may have been able to authenticate and did not have permissions on the target directory. Consider changing the remote tmp path in ansible.cfg to a path rooted in "/tmp", for more error information use -vvv. Failed command was: ( umask 77 && mkdir -p "` echo Please login as the user "ubuntu" rather than the user "root"./.ansible/tmp `"&& mkdir "` echo Please login as the user "ubuntu" rather than the user "root"./.ansible/tmp/ansible-tmp-1792812511.2981095-146-245083461607087 `" && echo ansible-tmp-1792812511.2981095-146-245083461607087="` echo Please login as the user "ubuntu" rather than the user "root"./.ansible/tmp/ansible-tmp-1792812511.2981095-146-245083461607087 `" ), exited with result 142, stdout output: Please login as the user "ubuntu" rather than the user "root".
```

Fix: log in as the user the image expects (`ubuntu` here; `ec2-user` on Amazon Linux, `admin` on Debian's AWS images) and use `become` for root.

**Wrong address or a firewall.** The connection times out or has no route:

```bash
ansible web1 -m ansible.builtin.ping -e ansible_host=192.168.56.99
```

```text
[ERROR]: Task failed: Failed to connect to the host via ssh: ssh: connect to host 192.168.56.99 port 22: No route to host
Origin: <adhoc 'ansible.builtin.ping' task>

{'action': 'ansible.builtin.ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ssh: connect to host 192.168.56.99 port 22: No route to host",
    "unreachable": true
}
```

Fix: check the address in the inventory, that the server runs, and that its firewall (and your cloud provider's firewall) allows port 22 from your IP address.

**No Python on the server.** Minimal images and some containers have no Python, and modules fail with `/usr/bin/python3: not found`. The `ansible.builtin.raw` module runs a plain SSH command without Python, so you can install it:

```bash
ansible web -m ansible.builtin.raw -a "apt-get update && apt-get install -y python3" --become
```

When you need more detail, add `-v` to `-vvvv` to any `ansible` or `ansible-playbook` command. With `-vvv` you see the exact `ssh` commands Ansible runs, which you can copy and run by hand.

## Summary

- Ansible needs Python on the control node and SSH plus Python on the managed nodes, and no agent.
- Install ansible-core with pipx and pin the version. Distribution packages such as Ubuntu 24.04's are often far behind.
- Get plain `ssh` working first: keys on the servers, host keys in `known_hosts`, a user with `sudo`.
- An inventory names your hosts and groups them; `ansible.cfg` in the project directory sets the defaults.
- Ad-hoc commands (`ansible <pattern> -m <module> -a <args>`) are good for checks and one-off jobs; `--become` runs them as root.

In [Part 2](/guides/introduction-to-ansible/02-fundamentals) you look at what Ansible does on each run: modules, tasks, plays and playbooks, and why running the same thing twice is safe.

## Keep Learning

- [How to fix "ssh: Could not resolve hostname"](/posts/ssh-could-not-resolve-hostname-error)
- [OpenSSH 10.6 refuses DOMAIN\user logins](/posts/openssh-10-6-domain-usernames-and-compression), which also breaks Ansible inventories that use them
- [SSH Hardening Checklist](/checklists/ssh-hardening)
