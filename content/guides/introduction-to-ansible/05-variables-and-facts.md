---
title: 'Ansible Variables, Facts and Precedence'
description: 'See where Ansible variables come from and which value wins, use facts and magic variables, register results, add custom facts and shape data with filters.'
order: 5
---

Variables are what make one playbook work for many hosts: the same `web.yml` writes a different page on `web1` and `web2` because each host has its own values. Ansible collects variables from more than twenty places, and when two of them define the same name, a fixed order decides which one wins. This part shows the places that matter, that order on real output, the **facts** Ansible gathers about each host, and the filters that turn data into the shape a task needs.

## Prerequisites

- The `~/webfleet` project with the YAML inventory from [Part 4](/guides/introduction-to-ansible/04-working-with-inventory), where `site_owner` is set in `group_vars/web.yml` and overridden in `host_vars/web2.yml`.

## Where Variables Come From

The places you will use, roughly from the most general to the most specific:

- **Role defaults** (`roles/<role>/defaults/main.yml`): the values a role uses unless you say otherwise ([Part 8](/guides/introduction-to-ansible/08-roles-and-organization)).
- **Inventory**: `group_vars/all`, then `group_vars/<group>`, then `host_vars/<host>`.
- **Facts**: what Ansible discovers about each host when it gathers facts.
- **The play**: `vars:`, `vars_files:` and `vars_prompt:`.
- **Role variables** (`roles/<role>/vars/main.yml`), and `vars:` on a block or a task.
- **Runtime**: `register` and `set_fact`, set while the play runs.
- **Extra variables**: `-e` or `--extra-vars` on the command line.

## Which Value Wins

When a name is defined in several places, the more specific source wins. The full list in the [Ansible documentation](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#understanding-variable-precedence) has 22 levels; these are the ones you meet every day, from lowest to highest:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "role defaults", "sub": "lowest", "tone": "slate" },
    { "label": "group_vars/all", "tone": "slate" },
    { "label": "group_vars/<group>", "tone": "blue" },
    { "label": "host_vars/<host>", "tone": "blue" },
    { "label": "play vars", "tone": "violet" },
    { "label": "role vars, task vars", "tone": "violet" },
    { "label": "set_fact, register", "tone": "amber" },
    { "label": "-e extra vars", "sub": "highest", "tone": "red" }
  ]
}
```

Two rules explain most surprises. Inventory variables are deliberately low, so that a playbook or role can be explicit about a value. And `-e` always wins, which makes it the tool for one-off overrides and the wrong tool for anything permanent.

See it on real output. This playbook prints `site_owner` twice, once from a play without variables and once from a play that sets it:

```yaml
---
- name: Inventory values only
  hosts: web
  gather_facts: false
  tasks:
    - name: Show site_owner
      ansible.builtin.debug:
        msg: '{{ inventory_hostname }}: {{ site_owner }}'

- name: A play that sets the variable
  hosts: web
  gather_facts: false
  vars:
    site_owner: Set in the play
  tasks:
    - name: Show site_owner
      ansible.builtin.debug:
        msg: '{{ inventory_hostname }}: {{ site_owner }}'
```

```terminal
{
  "title": "variable precedence on real output",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-playbook owner.yml",
      "output": "PLAY [Inventory values only] ***************************************************\n    \"msg\": \"web1: Platform team\"\n    \"msg\": \"web2: Platform team (canary)\"\nPLAY [A play that sets the variable] *******************************************\n    \"msg\": \"web1: Set in the play\"\n    \"msg\": \"web2: Set in the play\""
    },
    {
      "cmd": "ansible-playbook owner.yml -e 'site_owner=\"Set with -e\"'",
      "output": "PLAY [Inventory values only] ***************************************************\n    \"msg\": \"web1: Set with -e\"\n    \"msg\": \"web2: Set with -e\"\nPLAY [A play that sets the variable] *******************************************\n    \"msg\": \"web1: Set with -e\"\n    \"msg\": \"web2: Set with -e\""
    }
  ]
}
```

In the first play, `web2` shows its `host_vars` value, which wins over the group. In the second, the play's value wins over both. With `-e`, the extra variable wins everywhere. That is also why [Part 4](/guides/introduction-to-ansible/04-working-with-inventory) removed `site_owner` from the play in `web.yml`: as long as the play set it, the inventory values would never have been used.

Keep each variable in one place. If you have to search three files to know which value applies, the next person will guess wrong.

## Facts

At the start of each play, the `setup` module gathers **facts**: the distribution, kernel, CPUs, memory, disks, network interfaces and more. Look at them with an ad-hoc command and a filter:

```bash
ansible web1 -m ansible.builtin.setup -a "filter=ansible_distribution*"
```

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "ansible_distribution": "Ubuntu",
        "ansible_distribution_file_parsed": true,
        "ansible_distribution_file_path": "/etc/os-release",
        "ansible_distribution_file_variety": "Debian",
        "ansible_distribution_major_version": "24",
        "ansible_distribution_release": "noble",
        "ansible_distribution_version": "24.04"
    },
    "changed": false
}
```

In playbooks, read facts from the `ansible_facts` dictionary, **without** the `ansible_` prefix:

```yaml
---
- name: Facts you will use often
  hosts: web1
  tasks:
    - name: Show a few facts
      ansible.builtin.debug:
        msg:
          - "{{ ansible_facts['distribution'] }} {{ ansible_facts['distribution_version'] }} ({{ ansible_facts['os_family'] }} family)"
          - "{{ ansible_facts['architecture'] }}, {{ ansible_facts['processor_vcpus'] }} vCPU, {{ ansible_facts['memtotal_mb'] }} MB"
          - "Python {{ ansible_facts['python_version'] }}, kernel {{ ansible_facts['kernel'] }}"
          - "Default route via {{ ansible_facts['default_ipv4']['interface'] }}: {{ ansible_facts['default_ipv4']['address'] }}"
```

```bash
ansible-playbook facts.yml
```

```text
TASK [Show a few facts] ********************************************************
ok: [web1] => {
    "msg": [
        "Ubuntu 24.04 (Debian family)",
        "aarch64, 1 vCPU, 445 MB",
        "Python 3.12.3, kernel 6.8.0-147-generic",
        "Default route via enp0s1: 10.0.2.15"
    ]
}
```

Look at the last line. `default_ipv4` is the address of the interface that has the default route. These servers reach the internet through a second network interface, so it is `10.0.2.15` on both, not their lab address. Cloud servers with a private network behave the same way. When a template needs the address other servers should use, take it from the inventory (`ansible_host`) or from a named interface, not from `default_ipv4`.

### ansible_facts or ansible_distribution?

Older playbooks use facts as top-level variables, such as `ansible_distribution`. That still works, but it is deprecated since ansible-core 2.20, and 2.21 warns on every use:

```yaml
---
- name: The old way
  hosts: web1
  tasks:
    - name: Use an injected fact
      ansible.builtin.debug:
        msg: '{{ ansible_distribution }}'
```

```bash
ansible-playbook old-facts.yml
```

```text
TASK [Use an injected fact] ****************************************************
[DEPRECATION WARNING]: INJECT_FACTS_AS_VARS default to `True` is deprecated, top-level facts will not be auto injected after the change. This feature will be removed from ansible-core version 2.24.
Origin: /home/dev/webfleet/old-facts.yml:7:14

5     - name: Use an injected fact
6       ansible.builtin.debug:
7         msg: '{{ ansible_distribution }}'
               ^ column 14

Use `ansible_facts["fact_name"]` (no `ansible_` prefix) instead.

ok: [web1] => {
    "msg": "Ubuntu"
}
```

The setting behind it, `INJECT_FACTS_AS_VARS`, changes its default to `false` in ansible-core 2.24. Write `ansible_facts['distribution']` in new code, and search old projects for `ansible_` followed by a fact name.

### Faster runs without facts

Gathering facts costs a few seconds per host. A play that does not use them can skip it with `gather_facts: false`, and a play that needs only some can limit them with `gather_subset`:

```yaml
- name: Only what this play needs
  hosts: web
  gather_facts: true
  gather_subset:
    - '!all'
    - '!min'
    - distribution
```

[Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns#h2-make-runs-faster) shows fact caching, which keeps facts between runs.

## Magic Variables

Ansible also sets **magic variables** that describe the run itself. You cannot set them yourself:

| Variable                        | Value                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `inventory_hostname`            | The host's name in the inventory (`web1`)                    |
| `group_names`                   | The groups the current host is in                            |
| `groups`                        | Every group and its hosts, such as `groups['web']`           |
| `hostvars`                      | All variables of all hosts: `hostvars['web2']['site_owner']` |
| `ansible_play_hosts`            | The hosts of the current play that have not failed           |
| `ansible_check_mode`            | `true` during a `--check` run                                |
| `playbook_dir`, `inventory_dir` | Paths of the playbook and the inventory                      |

`hostvars` is how one host reads another host's data, for example to put every web server into a load balancer's configuration:

```bash
ansible web1 -m ansible.builtin.debug -a "msg={{ groups['web'] | map('extract', hostvars, 'ansible_host') | list }}"
```

```text
web1 | SUCCESS => {
    "msg": [
        "192.168.56.11",
        "192.168.56.12"
    ]
}
```

## Results as Variables: register and set_fact

`register` saves a task's result, and `set_fact` creates a variable from an expression. Both last for the rest of the run, for that host. This playbook reads the nginx version and stores it:

```yaml
---
- name: Register and set_fact
  hosts: web
  gather_facts: false

  tasks:
    - name: Ask nginx for its version
      ansible.builtin.command: nginx -v
      register: nginx_v
      changed_when: false

    - name: Keep only the version number
      ansible.builtin.set_fact:
        nginx_version: "{{ nginx_v.stderr | regex_search('nginx/([0-9.]+)', '\\1') | first }}"

    - name: Show it
      ansible.builtin.debug:
        msg: '{{ inventory_hostname }} runs nginx {{ nginx_version }} (exit code {{ nginx_v.rc }})'
```

```bash
ansible-playbook version.yml
```

```text
TASK [Show it] *****************************************************************
ok: [web1] => {
    "msg": "web1 runs nginx 1.24.0 (exit code 0)"
}
ok: [web2] => {
    "msg": "web2 runs nginx 1.24.0 (exit code 0)"
}
```

`nginx -v` writes to standard error, so the version is in `stderr`. A registered command result also has `stdout`, `stdout_lines`, `rc` and `changed`; run a task with `-v`, or add a `debug: var=nginx_v` task, to see every field.

## Custom Facts

A host can describe itself. Any file in `/etc/ansible/facts.d/` that ends in `.fact` is read during fact gathering: INI or JSON, or an executable that prints JSON. Use it for things only the host knows, such as the version of an application that a deployment installed:

```yaml
---
- name: Custom facts
  hosts: web1
  become: true

  tasks:
    - name: Create the facts directory
      ansible.builtin.file:
        path: /etc/ansible/facts.d
        state: directory
        mode: '0755'

    - name: Record the release
      ansible.builtin.copy:
        content: |
          [release]
          version=1.4.2
          channel=stable
        dest: /etc/ansible/facts.d/webfleet.fact
        mode: '0644'

    - name: Gather facts again to pick it up
      ansible.builtin.setup:
        filter: ansible_local

    - name: Use it
      ansible.builtin.debug:
        msg: "Release {{ ansible_facts['ansible_local']['webfleet']['release']['version'] }}"
```

```bash
ansible-playbook local-facts.yml
```

```text
TASK [Use it] ******************************************************************
ok: [web1] => {
    "msg": "Release 1.4.2"
}
```

Custom facts appear under `ansible_facts['ansible_local']`, one key per file. That key keeps its `ansible_` prefix, unlike the built-in facts.

## Filters: Shape the Data

Jinja2 **filters** transform a value: `{{ value | filter(arguments) }}`. A few cover most needs:

```yaml
---
- name: Filters you will use often
  hosts: localhost
  gather_facts: false
  vars:
    ports: [443, 80, 443]
    users:
      - { name: alice, admin: true }
      - { name: bob, admin: false }
    base: { workers: 2, log: info }
    override: { workers: 4 }
    enabled: 'yes'

  tasks:
    - name: Show the results
      ansible.builtin.debug:
        msg:
          - "default:   {{ missing_var | default('fallback') }}"
          - 'unique:    {{ ports | unique | sort }}'
          - "join:      {{ ports | unique | join(', ') }}"
          - "select:    {{ users | selectattr('admin') | map(attribute='name') | list }}"
          - 'combine:   {{ base | combine(override) }}'
          - 'bool:      {{ enabled | bool }}'
          - "ternary:   {{ (ports | length > 2) | ternary('many', 'few') }}"
          - "regex:     {{ 'web1.example.com' | regex_replace('\\..*$', '') }}"
```

```bash
ansible-playbook filters.yml
```

```text
TASK [Show the results] ********************************************************
ok: [localhost] => {
    "msg": [
        "default:   fallback",
        "unique:    [80, 443]",
        "join:      443, 80",
        "select:    ['alice']",
        "combine:   {'workers': 4, 'log': 'info'}",
        "bool:      True",
        "ternary:   many",
        "regex:     web1"
    ]
}
```

Use `| mandatory` instead of `| default` when a missing value should stop the run with a clear error. Since ansible-core 2.19, templates keep their types: `{{ ports | length }}` is the integer `3`, not the string `"3"`, and a filter that expects a string no longer quietly turns a list into text. The [filter reference](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_filters.html) lists them all.

## Extra Variables from the Command Line

`-e` takes three forms:

```bash
ansible-playbook web.yml -e site_owner=Ops        # key=value: always a string
ansible-playbook web.yml -e '{"replicas": 3}'      # JSON or YAML: keeps types
ansible-playbook web.yml -e @vars/release.yml      # a file
```

`-e replicas=3` gives the string `"3"`; use the JSON form when the type matters.

## Names to Avoid

Ansible uses some names itself, such as `environment`, `name`, `hosts`, `tags` and `vars`. Using one as a variable produces a warning and confusing results:

```bash
ansible web1 -m ansible.builtin.debug -a "var=environment" -e environment=prod
```

```text
[WARNING]: Found variable using reserved name 'environment'.
```

Use a specific name such as `app_env`. Prefixing a role's variables with the role name (`webserver_port`) avoids most clashes.

The playbooks in this part were demonstrations, not part of the project. Delete them:

```bash
rm owner.yml facts.yml old-facts.yml version.yml local-facts.yml filters.yml
```

## Common Mistakes

- **The same variable in many places.** Pick one level per variable and document it.
- **Play `vars:` that hide inventory values.** Play variables win over `group_vars` and `host_vars`.
- **Strings from `-e key=value`.** Use JSON for numbers and booleans, and `| bool` or `| int` when a value may arrive as a string.
- **Injected facts** (`ansible_os_family`) instead of `ansible_facts['os_family']`.
- **`default_ipv4` as "the server's address".** It is the default-route interface, which is often not the one you want.
- **Secrets in plain text variables.** [Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns) encrypts them with Ansible Vault.

## Summary

- Variables come from role defaults, the inventory, facts, the play, roles, runtime results and `-e`; the more specific source wins, and `-e` always wins.
- Facts describe each host; read them from `ansible_facts` without the `ansible_` prefix.
- Magic variables such as `inventory_hostname`, `groups` and `hostvars` describe the run and let hosts read each other's data.
- `register` and `set_fact` turn results into variables; custom facts let a host report its own data.
- Filters transform values; templates keep their data types since ansible-core 2.19.

In [Part 6](/guides/introduction-to-ansible/06-handlers-and-notifications) you change nginx's configuration and use handlers to reload it only when something really changed.

## Keep Learning

- [YAML and JSON Basics](/interview-questions/junior/yaml-json-basics), interview questions
- [Ansible Basics flashcards](/flashcards/ansible-basics)
