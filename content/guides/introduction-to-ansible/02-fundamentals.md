---
title: 'Ansible Basics: Modules, Tasks, Plays and Playbooks'
description: 'See what Ansible does on every run, what modules, collections, tasks, plays and playbooks are, and why running a playbook twice is safe. With real output.'
order: 2
---

In [Part 1](/guides/introduction-to-ansible/01-installing-and-setting-up) you ran single commands on two servers. Before you write real automation, it helps to know what Ansible does with each command, and the handful of terms the rest of the guide uses: modules, collections, tasks, plays and playbooks. You also see the property that makes Ansible safe to rerun, **idempotency**, on real output.

## Prerequisites

- The `~/webfleet` project from [Part 1](/guides/introduction-to-ansible/01-installing-and-setting-up): `ansible.cfg`, `inventory.ini`, and SSH access to `web1` and `web2`.
- Run every command in this part from `~/webfleet`.

## What Happens When Ansible Runs a Task

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Read", "sub": "inventory, variables", "icon": "database", "tone": "slate" },
    { "label": "Connect", "sub": "SSH as ubuntu", "icon": "lock", "tone": "violet" },
    { "label": "Copy", "sub": "module as a Python zip", "icon": "box", "tone": "blue" },
    { "label": "Run", "sub": "python3 on the host", "icon": "cpu", "tone": "accent" },
    { "label": "Report", "sub": "JSON: changed, failed", "icon": "check", "tone": "green" }
  ]
}
```

For every task and every host, Ansible:

1. works out the variables for that host from the inventory and your playbook;
2. opens an SSH connection, or reuses one (Ansible keeps connections open for 60 seconds with SSH's `ControlPersist`);
3. packs the module and the code it needs into one self-contained Python file, called **AnsiballZ**, and copies it to a temporary directory under `~/.ansible/tmp` on the host;
4. runs it with the host's Python, with `sudo` first if the task uses `become`;
5. reads the JSON the module prints, removes the temporary files, and reports the result.

You can watch this with `-vvv`. These are the commands Ansible ran for one `ping`, with the long list of SSH options shortened to `[options]`:

```bash
ansible web1 -m ansible.builtin.ping -vvv
```

```text
<192.168.56.11> SSH: EXEC ssh [options] 192.168.56.11 '/bin/sh -c '"'"'echo ~ubuntu'"'"''
<192.168.56.11> SSH: EXEC ssh [options] 192.168.56.11 '/bin/sh -c '"'"'( umask 77 && mkdir -p "` echo /home/ubuntu/.ansible/tmp `"&& mkdir "` echo /home/ubuntu/.ansible/tmp/ansible-tmp-1792812560.610121-69-129449096889080 `" && echo ansible-tmp-1792812560.610121-69-129449096889080="` echo /home/ubuntu/.ansible/tmp/ansible-tmp-1792812560.610121-69-129449096889080 `" )'"'"''
<192.168.56.11> PUT /home/dev/.ansible/tmp/ansible-local-62l2qgk7s9/tmpi_0z1x9j TO /home/ubuntu/.ansible/tmp/ansible-tmp-1792812560.610121-69-129449096889080/AnsiballZ_ping.py
<192.168.56.11> SSH: EXEC sftp -b - [options] '[192.168.56.11]'
<192.168.56.11> SSH: EXEC ssh [options] 192.168.56.11 '/bin/sh -c '"'"'chmod u+rwx /home/ubuntu/.ansible/tmp/ansible-tmp-1792812560.610121-69-129449096889080/ /home/ubuntu/.ansible/tmp/ansible-tmp-1792812560.610121-69-129449096889080/AnsiballZ_ping.py'"'"''
<192.168.56.11> SSH: EXEC ssh [options] 192.168.56.11 '/bin/sh -c '"'"'/usr/bin/python3 /home/ubuntu/.ansible/tmp/ansible-tmp-1792812560.610121-69-129449096889080/AnsiballZ_ping.py'"'"''
<192.168.56.11> SSH: EXEC ssh [options] 192.168.56.11 '/bin/sh -c '"'"'rm -f -r /home/ubuntu/.ansible/tmp/ansible-tmp-1792812560.610121-69-129449096889080/ > /dev/null 2>&1'"'"''
```

In order: find the home directory, create a private temporary directory, upload `AnsiballZ_ping.py` over SFTP, make it executable, run it with `/usr/bin/python3`, and delete the directory.

Three consequences follow from this design:

- The managed nodes need Python (or you use the few modules that do not, such as `raw`), but no Ansible software and no running agent.
- Each task costs a few SSH round trips. That is fine for tens of hosts; [Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns) shows the settings (pipelining, forks) that matter at hundreds.
- A module's result is plain JSON with fields such as `changed` and `failed`. Ansible decides from them whether to report `ok`, `changed` or `failed`, and whether to notify handlers ([Part 6](/guides/introduction-to-ansible/06-handlers-and-notifications)).

## Modules

A **module** is one unit of work with typed options: install a package, copy a file, create a user, start a service. You will use a small set most of the time:

| Job      | Module                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Packages | `ansible.builtin.apt`, `ansible.builtin.dnf`, `ansible.builtin.package`                                  |
| Files    | `ansible.builtin.copy`, `ansible.builtin.template`, `ansible.builtin.file`, `ansible.builtin.lineinfile` |
| Services | `ansible.builtin.service`, `ansible.builtin.systemd_service`                                             |
| Users    | `ansible.builtin.user`, `ansible.builtin.group`, `ansible.posix.authorized_key`                          |
| Commands | `ansible.builtin.command`, `ansible.builtin.shell` (only when no module fits)                            |
| Checks   | `ansible.builtin.uri`, `ansible.builtin.assert`, `ansible.builtin.debug`                                 |

`ansible-doc` shows the documentation for any module installed on your control node, including examples, offline:

```terminal
{
  "title": "ansible-doc",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "how many modules ship with ansible-core",
      "cmd": "ansible-doc -t module -l ansible.builtin | wc -l",
      "output": "71"
    },
    {
      "comment": "the start of the examples section of a module's page",
      "cmd": "ansible-doc ansible.builtin.apt",
      "output": "EXAMPLES:\n- name: Install apache httpd (state=present is optional)\n  ansible.builtin.apt:\n    name: apache2\n    state: present\n\n- name: Update repositories cache and install \"foo\" package\n  ansible.builtin.apt:\n    name: foo\n    update_cache: yes\n\n- name: Remove \"foo\" package\n  ansible.builtin.apt:\n    name: foo\n    state: absent"
    }
  ]
}
```

The full page explains every option and the return values; `ansible-doc -s ansible.builtin.apt` prints a task skeleton with all options instead. The same pages are online in the [Ansible documentation](https://docs.ansible.com/ansible/latest/collections/index.html).

## Collections and Fully Qualified Names

Modules, plugins and roles are shipped in **collections**, named `namespace.collection`. ansible-core contains one, `ansible.builtin`. Everything else (`community.general`, `ansible.posix`, `amazon.aws`, `kubernetes.core` and hundreds more) you install from [Ansible Galaxy](https://galaxy.ansible.com) with `ansible-galaxy`, which [Part 8](/guides/introduction-to-ansible/08-roles-and-organization) covers.

`ansible-galaxy collection list` shows the collections installed from Galaxy. The built-in collection is part of ansible-core, so on this control node the list is still empty:

```bash
ansible-galaxy collection list
```

```text

```

Refer to modules by their **fully qualified collection name** (FQCN), such as `ansible.builtin.copy` rather than `copy`. Short names still work for built-in modules, but with several collections installed a short name can resolve to a different module than you expect, and the FQCN tells the reader where to find the documentation. `ansible-lint` flags short names with its `fqcn` rule ([Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns)).

## Idempotency: Why Reruns Are Safe

Most modules are **declarative**: you describe the end state ("the package `tree` is installed"), and the module checks the current state first and only acts if it differs. Run the same module twice:

```terminal
{
  "title": "the same task, twice",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "filtered to the result line and the changed field of each host",
      "cmd": "ansible web -b -m ansible.builtin.apt -a \"name=tree state=present update_cache=true\"",
      "output": "web2 | CHANGED => {\n    \"changed\": true,\nweb1 | CHANGED => {\n    \"changed\": true,"
    },
    {
      "comment": "the second run finds tree installed and changes nothing",
      "cmd": "ansible web -b -m ansible.builtin.apt -a \"name=tree state=present\"",
      "output": "web1 | SUCCESS => {\n    \"changed\": false\nweb2 | SUCCESS => {\n    \"changed\": false"
    }
  ]
}
```

The first run reports `CHANGED` and the second only `SUCCESS` with `"changed": false`. That property, **idempotency**, is what lets you run the same playbook every day, or every hour from CI: hosts that are already right are left alone, and hosts that drifted are fixed.

The `command` and `shell` modules cannot do this, because they cannot know what a command does. They run every time and report `changed` every time:

```bash
ansible web1 -b -a "apt-get install -y tree"
```

```text
web1 | CHANGED | rc=0 >>
Reading package lists...
Building dependency tree...
Reading state information...
```

Use a module whenever one exists. When you must use `command` or `shell`, tell Ansible when the command changes something with `changed_when` and `creates`/`removes`, which [Part 3](/guides/introduction-to-ansible/03-writing-your-first-playbook) shows.

## Tasks, Plays and Playbooks

Ad-hoc commands run one module. For anything you want to repeat, write a **playbook**: a YAML file with a list of **plays**. Each play maps a group of hosts to a list of **tasks**, and each task calls one module with its options.

```yaml
---
- name: Check the web servers # a play
  hosts: web # which inventory hosts or groups it runs on
  gather_facts: true # collect facts about each host first (the default)

  tasks:
    - name: Show the operating system # a task: a name, a module, its options
      ansible.builtin.debug:
        msg: "{{ inventory_hostname }} runs {{ ansible_facts['distribution'] }} {{ ansible_facts['distribution_version'] }}"

    - name: Set the login message
      ansible.builtin.copy:
        content: |
          This server is managed by Ansible from the webfleet project.
          Manual changes may be overwritten.
        dest: /etc/motd
        owner: root
        group: root
        mode: '0644'
      become: true # only this task runs with sudo
```

Save it as `hello.yml` and run it with `ansible-playbook`:

```bash
ansible-playbook hello.yml
```

```text
PLAY [Check the web servers] ***************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Show the operating system] ***********************************************
ok: [web1] => {
    "msg": "web1 runs Ubuntu 24.04"
}
ok: [web2] => {
    "msg": "web2 runs Ubuntu 24.04"
}

TASK [Set the login message] ***************************************************
changed: [web2]
changed: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

How to read the output:

- **PLAY** and **TASK** lines show where Ansible is. Tasks run in order, each on all hosts in parallel (5 hosts at a time by default, set with `forks`), before the next task starts.
- **Gathering Facts** is the implicit first task: the `setup` module collects details about each host, such as its distribution, which the `debug` task uses through `ansible_facts`.
- `ok` means the host was already in the wanted state; `changed` means the module changed something; `failed` would stop that host.
- **PLAY RECAP** counts the results per host: `ok`, `changed`, `unreachable`, `failed`, `skipped`, `rescued` and `ignored`.

Run it again. Nothing changes, because `/etc/motd` already has the wanted content:

```bash
ansible-playbook hello.yml
```

```text
PLAY RECAP *********************************************************************
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

A playbook can hold several plays, for example one for the web servers and one for the databases, and they run from top to bottom. Each play can set its own `become`, variables and options.

## Preview Changes with Check Mode and Diff

Before you change production servers, ask Ansible what it would change. `--check` runs the modules in a dry-run mode that reports changes without making them, and `--diff` shows the changes to file contents. Edit the second line of the message in `hello.yml`, then:

```bash
ansible-playbook hello.yml --check --diff --limit web1
```

```text
TASK [Set the login message] ***************************************************
--- before: /etc/motd
+++ after: /etc/motd
@@ -1,2 +1,2 @@
 This server is managed by Ansible from the webfleet project.
-Manual changes may be overwritten.
+Manual changes are overwritten on the next run.

changed: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

Nothing changed on `web1`: the recap counts the change that _would_ happen. `--limit web1` restricted the run to one host. Undo the edit in `hello.yml` before you go on, or the next real run applies it.

Check mode is only as good as the modules: most built-in modules support it, but modules that cannot predict their result, such as `command`, `shell` and `uri`, are skipped in check mode, and a task that depends on an earlier task's real result can fail. Treat a check run as a preview, not a guarantee.

Three more options are useful before a run:

```terminal
{
  "title": "inspect a playbook without running it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-playbook hello.yml --syntax-check",
      "output": "playbook: hello.yml"
    },
    {
      "cmd": "ansible-playbook hello.yml --list-hosts",
      "output": "playbook: hello.yml\n\n  play #1 (web): Check the web servers\tTAGS: []\n    pattern: ['web']\n    hosts (2):\n      web1\n      web2"
    },
    {
      "cmd": "ansible-playbook hello.yml --list-tasks",
      "output": "playbook: hello.yml\n\n  play #1 (web): Check the web servers\tTAGS: []\n    tasks:\n      Show the operating system\tTAGS: []\n      Set the login message\tTAGS: []"
    }
  ]
}
```

## YAML in Five Minutes

Playbooks, inventories and variable files are YAML. You need only a little of it, but the mistakes are easy to make:

```yaml
# a mapping (key: value); a space after the colon is required
name: web1

# a list: one item per line, each starting with "- "
packages:
  - nginx
  - tree

# indentation (spaces only, never tabs) shows what belongs to what
nginx:
  port: 80
  user: www-data

# multi-line strings: | keeps line breaks, > folds them into spaces
motd: |
  line one
  line two

# a value that starts with {{ must be quoted, or YAML reads it as a mapping
greeting: '{{ inventory_hostname }}'
```

Two traps catch everyone once. First, YAML 1.1, which Ansible uses, reads `yes`, `no`, `on` and `off` (in any case) as booleans, so a country code `NO` becomes `false`:

```bash
ansible localhost -m ansible.builtin.debug -a "var=country" -e '{"country": NO}'
```

```text
localhost | SUCCESS => {
    "country": false
}
```

Quote strings that could be read as something else (`"NO"`, `"0644"`, `"1.10"`), and write booleans as `true` and `false`. Second, a colon followed by a space inside an unquoted value starts a new mapping, so quote any string that contains `": "`.

To see how a YAML parser reads tricky input step by step, try the [YAML parsing simulator](/games/yaml-parsing-simulator).

## Common Mistakes

- **Using `command` or `shell` when a module exists.** You lose idempotency, check mode and readable output. Search `ansible-doc -l` first.
- **Forgetting `become`.** Tasks that write to `/etc` or install packages fail with a permission error. Set `become: true` on the task or the play.
- **Tabs or uneven indentation in YAML.** The error points at a line near the problem, not always at it. An editor with YAML support, or `ansible-playbook --syntax-check`, catches most of these.
- **Short module names.** Write `ansible.builtin.copy`, not `copy`.

## Summary

- For each task and host, Ansible connects over SSH, copies the module as one Python file, runs it and reads its JSON result.
- Modules do the work; collections ship them; use fully qualified names like `ansible.builtin.apt`.
- Declarative modules are idempotent: they act only when the current state differs, so reruns are safe. `command` and `shell` are not.
- A playbook is a list of plays; a play maps hosts to tasks; a task calls one module.
- `--check --diff` previews changes, and `--syntax-check`, `--list-hosts` and `--list-tasks` inspect a playbook without running it.

In [Part 3](/guides/introduction-to-ansible/03-writing-your-first-playbook) you write a real playbook that turns both servers into nginx web servers, with conditions, error handling and a test at the end.

## Keep Learning

- [Ansible Basics flashcards](/flashcards/ansible-basics)
- [Infrastructure as Code: A Beginner's Guide](/posts/infrastructure-as-code-fundamentals)
- [Ansible vs Chef](/comparisons/ansible-vs-chef), an agentless push model against an agent-based pull model
