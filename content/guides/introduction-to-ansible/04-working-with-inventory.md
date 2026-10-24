---
title: 'Ansible Inventory: Hosts, Groups, Variables and Patterns'
description: 'Write Ansible inventories in INI and YAML, group hosts by role and environment, set group_vars and host_vars, and target hosts with patterns.'
order: 4
---

The inventory tells Ansible which machines exist, how to reach them, how they are grouped, and which variables belong to each. A good inventory makes playbooks simple: the playbook says "configure the web servers", and the inventory decides which servers those are in staging and in production. In this part you move the project's inventory to YAML in its own directory, add group and host variables, and learn the host patterns that pick the machines a command runs on.

## Prerequisites

- The `~/webfleet` project with `web.yml` from [Part 3](/guides/introduction-to-ansible/03-writing-your-first-playbook).

## INI and YAML Inventories

Ansible reads several inventory formats through **inventory plugins**. The two you write by hand are INI and YAML. This is the INI file from Part 1:

```ini
[web]
web1 ansible_host=192.168.56.11
web2 ansible_host=192.168.56.12

[web:vars]
ansible_user=ubuntu
ansible_python_interpreter=/usr/bin/python3
```

`ansible-inventory` prints any inventory in another format, which is a quick way to convert one:

```bash
ansible-inventory -i inventory.ini --list --yaml
```

```text
all:
  children:
    web:
      hosts:
        web1:
          ansible_host: 192.168.56.11
          ansible_python_interpreter: /usr/bin/python3
          ansible_user: ubuntu
        web2:
          ansible_host: 192.168.56.12
          ansible_python_interpreter: /usr/bin/python3
          ansible_user: ubuntu
```

The output puts the variables on each host, because that is how Ansible sees them after merging. When you write the file yourself, keep shared values on the group. Prefer YAML for anything beyond a few hosts: it has real data types and nests cleanly. In INI, values in a `[group:vars]` section are always strings, so `debug=false` there is the string `"false"`, which is exactly the kind of value that breaks a condition ([Part 3](/guides/introduction-to-ansible/03-writing-your-first-playbook#h3-conditions-must-be-booleans)).

## Move the Inventory into Its Own Directory

Variables do not belong in the host list. Ansible loads them automatically from two directories next to the inventory file:

- `group_vars/<group>.yml` (or a directory `group_vars/<group>/` with several files) for every host in that group;
- `host_vars/<host>.yml` for one host.

Create this layout:

```text
webfleet/
├── ansible.cfg
├── inventory/
│   ├── hosts.yml
│   ├── group_vars/
│   │   ├── all.yml
│   │   └── web.yml
│   └── host_vars/
│       └── web2.yml
└── web.yml
```

The host list, `inventory/hosts.yml`:

```yaml
---
all:
  children:
    web:
      hosts:
        web1:
          ansible_host: 192.168.56.11
        web2:
          ansible_host: 192.168.56.12
    production:
      children:
        web:
```

`web` groups the hosts by what they do; `production` groups them by environment and contains the whole `web` group as a **child group**. Later you can add a `db` group under `production` without touching `web`.

Connection settings for every host go to `inventory/group_vars/all.yml`:

```yaml
---
ansible_user: ubuntu
ansible_python_interpreter: /usr/bin/python3
```

The site owner moves from the play into `inventory/group_vars/web.yml`, because it describes the web servers, not the playbook:

```yaml
---
site_owner: Platform team
```

And `web2` gets its own value in `inventory/host_vars/web2.yml`, because it is the canary that receives changes first:

```yaml
---
site_owner: Platform team (canary)
```

Point `ansible.cfg` at the new file, and delete `inventory.ini`:

```ini
[defaults]
inventory = inventory/hosts.yml
```

Finally, remove the `vars:` block with `site_owner` from `web.yml`. A variable set in the play would win over the inventory, as [Part 5](/guides/introduction-to-ansible/05-variables-and-facts) explains.

## Check What Ansible Sees

Before you run anything against a changed inventory, look at it:

```terminal
{
  "title": "inspect the inventory",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-inventory --graph",
      "output": "@all:\n  |--@ungrouped:\n  |--@web:\n  |  |--web1\n  |  |--web2\n  |--@production:\n  |  |--@web:\n  |  |  |--web1\n  |  |  |--web2"
    },
    {
      "comment": "all variables of one host, after merging group and host variables",
      "cmd": "ansible-inventory --host web2",
      "output": "{\n    \"ansible_host\": \"192.168.56.12\",\n    \"ansible_python_interpreter\": \"/usr/bin/python3\",\n    \"ansible_user\": \"ubuntu\",\n    \"site_owner\": \"Platform team (canary)\"\n}"
    },
    {
      "comment": "the same graph with each host's variables",
      "cmd": "ansible-inventory --graph --vars web",
      "output": "@web:\n  |--web1\n  |  |--{ansible_host = 192.168.56.11}\n  |  |--{ansible_python_interpreter = /usr/bin/python3}\n  |  |--{ansible_user = ubuntu}\n  |  |--{site_owner = Platform team}\n  |--web2\n  |  |--{ansible_host = 192.168.56.12}\n  |  |--{ansible_python_interpreter = /usr/bin/python3}\n  |  |--{ansible_user = ubuntu}\n  |  |--{site_owner = Platform team (canary)}\n  |--{site_owner = Platform team}"
    }
  ]
}
```

Every inventory has two implicit groups: `all`, which contains every host, and `ungrouped`, for hosts that are in no other group. `--host` shows that `web2` got its `site_owner` from `host_vars`, which wins over the group value.

Now run the playbook. Only `web2` changes, because only its variable is new:

```bash
ansible-playbook web.yml
```

```text
TASK [Publish the home page] ***************************************************
ok: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=7    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

## Host Patterns

The first argument of `ansible`, and the `hosts:` line of a play, is a **pattern**. `--list-hosts` shows what a pattern matches without connecting to anything:

```terminal
{
  "title": "host patterns",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "a group",
      "cmd": "ansible web --list-hosts",
      "output": "  hosts (2):\n    web1\n    web2"
    },
    {
      "comment": "a group minus a host",
      "cmd": "ansible 'web:!web2' --list-hosts",
      "output": "  hosts (1):\n    web1"
    },
    {
      "comment": "hosts in both groups",
      "cmd": "ansible 'web:&production' --list-hosts",
      "output": "  hosts (2):\n    web1\n    web2"
    },
    {
      "comment": "the first host of a group",
      "cmd": "ansible 'web[0]' --list-hosts",
      "output": "  hosts (1):\n    web1"
    },
    {
      "comment": "a regular expression starts with ~",
      "cmd": "ansible '~web[12]' --list-hosts",
      "output": "  hosts (2):\n    web1\n    web2"
    }
  ]
}
```

The patterns combine: `web:db` (union), `web:&production` (intersection) and `web:!web2` (exclusion). Quote them in the shell, because `!` and `&` mean something to it. `ansible-playbook --limit` takes the same patterns, and the playbook's `hosts:` line and `--limit` are intersected, so `--limit web2` can only ever narrow a run.

## Ranges and Larger Inventories

For many similar hosts, use ranges. This file is an example only; the hosts do not exist, which `ansible-inventory` does not need:

```ini
[web]
web[01:03].example.com

[db-servers]
db-[a:b].example.com

[production:children]
web
db-servers
```

```bash
ansible-inventory -i examples/ranges.ini --graph
```

```text
[WARNING]: Invalid characters were found in group names but not replaced, use -vvvv to see details
@all:
  |--@ungrouped:
  |--@production:
  |  |--@web:
  |  |  |--web01.example.com
  |  |  |--web02.example.com
  |  |  |--web03.example.com
  |  |--@db-servers:
  |  |  |--db-a.example.com
  |  |  |--db-b.example.com
```

`[01:03]` keeps the leading zero, and `[a:b]` works with letters. Note the warning: a group name with a dash is accepted, but it cannot be used as a variable name in templates (`groups.db-servers` is a subtraction to Jinja2). Use underscores in group names: `db_servers`. The file was only an example; delete it with `rm -r examples`.

## Separate Environments

Keep each environment in its own inventory, so that a run against staging cannot touch production by accident:

```text
inventories/
├── staging/
│   ├── hosts.yml
│   └── group_vars/
│       └── web.yml
└── production/
    ├── hosts.yml
    └── group_vars/
        └── web.yml
```

Both inventories use the same group names (`web`, `db`), so the same playbook runs against either, and the environment is chosen on the command line:

```bash
ansible-playbook -i inventories/staging web.yml
ansible-playbook -i inventories/production web.yml
```

Do not set a default inventory in `ansible.cfg` when production is one of the choices; make every run name its target. This guide keeps one inventory because the lab has one environment.

## Connection Variables

These variables control how Ansible reaches a host. Set them on a host, or on a group to apply them to many:

| Variable                                | Meaning                               | Example                                             |
| --------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| `ansible_host`                          | Address to connect to                 | `192.168.56.11`                                     |
| `ansible_port`                          | SSH port                              | `2222`                                              |
| `ansible_user`                          | Login user                            | `ubuntu`                                            |
| `ansible_ssh_private_key_file`          | Key for this host                     | `~/.ssh/web_ed25519`                                |
| `ansible_python_interpreter`            | Python on the host                    | `/usr/bin/python3`                                  |
| `ansible_become`, `ansible_become_user` | Use privilege escalation, and as whom | `true`, `postgres`                                  |
| `ansible_connection`                    | Connection plugin                     | `ssh` (default), `local`, `community.docker.docker` |
| `ansible_ssh_common_args`               | Extra SSH options                     | `-o ProxyJump=ubuntu@bastion.example.com`           |

For servers behind a bastion host, set `ansible_ssh_common_args` with `ProxyJump` on their group, or put a `Host` block with `ProxyJump` in `~/.ssh/config`. Ansible uses your SSH configuration, so both work.

Ansible also has an implicit `localhost` for the control node, which runs tasks without SSH. If you list `localhost` in the inventory yourself, set `ansible_connection: local` on it, or Ansible tries to SSH to your own machine.

## Dynamic Inventories

When hosts come and go, a static file goes stale. **Inventory plugins** build the inventory at run time from a cloud API, a CMDB or Terraform state: `amazon.aws.aws_ec2`, `azure.azcollection.azure_rm`, `google.cloud.gcp_compute` and many more. You configure one with a small YAML file instead of a host list. [Part 10](/guides/introduction-to-ansible/10-advanced-features-and-next-steps#h2-dynamic-inventories) shows how they work.

## Common Mistakes

- **Values in INI `[group:vars]` are strings.** Use YAML group variables for numbers and booleans.
- **A host in two environments.** If `web1` is in both `staging` and `production`, variables from both apply and the result depends on precedence rules. Keep environments in separate inventories.
- **`-u` loses against the inventory.** `ansible_user` in the inventory wins over `-u` on the command line; use `-e ansible_user=...` to override it for one run.
- **Dashes in group names.** Use underscores.
- **Variables in the wrong place.** Values that describe hosts belong in `group_vars` and `host_vars`; values that describe what a playbook does belong in the playbook or a role.

## Summary

- Write inventories in YAML; group hosts by role (`web`) and by environment (`production`) with child groups.
- Put variables in `group_vars/` and `host_vars/` next to the inventory; host variables win over group variables.
- `ansible-inventory --graph`, `--host` and `--list` show what Ansible will use before you run anything.
- Patterns such as `web:!web2` and `web:&production`, with `--limit`, choose which hosts a run touches.
- Keep one inventory per environment and name it on every run.

In [Part 5](/guides/introduction-to-ansible/05-variables-and-facts) you look at all the places variables come from, the order in which they win, and the facts Ansible collects about each host.

## Keep Learning

- [Configuration Management Basics](/interview-questions/junior/configuration-management-basics), interview questions
- [Can Terraform Provision On-Premises Servers?](/posts/terraform-on-premises-servers), which pairs Terraform with Ansible
