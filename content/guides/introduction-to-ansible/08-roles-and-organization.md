---
title: 'Ansible Roles and Collections: Structure a Real Project'
description: 'Turn a playbook into reusable Ansible roles, validate role arguments, install pinned collections with requirements.yml, and lay out a project for a team.'
order: 8
---

`web.yml` now has a dozen tasks, two handlers and two templates. That is about the size at which a single playbook stops being pleasant: a second project that needs nginx would copy it, and the copies would drift apart. **Roles** package tasks, handlers, templates, files and default variables into a directory with a fixed layout, so that any playbook can apply them in one line. **Collections** package roles together with modules and plugins, and are how you get modules beyond `ansible.builtin`. In this part you turn `web.yml` into a `webserver` role, write a `baseline` role that uses a module from the `community.general` collection, pin your collections in `requirements.yml`, and end with the project layout most teams use.

## Prerequisites

- The `~/webfleet` project from [Part 7](/guides/introduction-to-ansible/07-templates-and-files), with `web.yml`, its templates, and the YAML inventory.

## What a Role Contains

A role is a directory under `roles/`. Ansible loads each subdirectory by convention, so you never list the files:

| Directory                 | Contents                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `tasks/main.yml`          | The tasks the role runs                                                                       |
| `handlers/main.yml`       | The role's handlers                                                                           |
| `templates/`, `files/`    | Templates and files the role's tasks use, found without a path                                |
| `defaults/main.yml`       | Default values for the role's variables; the lowest precedence, so anything can override them |
| `vars/main.yml`           | Internal constants with high precedence; not meant to be overridden                           |
| `meta/main.yml`           | Metadata: author, supported platforms, dependencies on other roles                            |
| `meta/argument_specs.yml` | The role's input variables with their types, checked before the role runs                     |

## Create the webserver Role

`ansible-galaxy role init` creates the skeleton. This part also uses `tree` on the control node to show directories; install it with `sudo apt install tree` (or `brew install tree`) if you do not have it:

```terminal
{
  "title": "create a role skeleton",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-galaxy role init --init-path roles webserver",
      "output": "- Role webserver was created successfully"
    },
    {
      "cmd": "tree roles/webserver",
      "output": "roles/webserver\n├── README.md\n├── defaults\n│   └── main.yml\n├── files\n├── handlers\n│   └── main.yml\n├── meta\n│   └── main.yml\n├── tasks\n│   └── main.yml\n├── templates\n├── tests\n│   ├── inventory\n│   └── test.yml\n└── vars\n    └── main.yml\n\n9 directories, 8 files"
    }
  ]
}
```

You will not need all of it. Remove what this role does not use, so the next reader does not look for content in empty files:

```bash
rm -rf roles/webserver/tests roles/webserver/vars roles/webserver/files
```

### Defaults: the role's interface

Variables that a role reads should start with the role's name, so they cannot collide with another role's variables. `site_owner` and `site_port` become `webserver_owner` and `webserver_port`. Their defaults go into `roles/webserver/defaults/main.yml`:

```yaml
---
# Team named on the home page
webserver_owner: Unknown team
# Port nginx listens on
webserver_port: 80
```

And the inventory sets the real values. Replace `inventory/group_vars/web.yml` and `inventory/host_vars/web2.yml`:

```yaml
---
webserver_owner: Platform team
webserver_port: 80
baseline_firewall_ports: # read by the baseline role
  - '22'
  - '80' # keep in sync with webserver_port
```

```yaml
---
webserver_owner: Platform team (canary)
```

### Tasks and handlers

The tasks from `web.yml` move to `roles/webserver/tasks/main.yml` with the new variable names, and the platform check from `pre_tasks` becomes the role's first task. Inside a role, `template` finds its files in the role's `templates/` directory:

```yaml
---
- name: Check that the platform is supported
  ansible.builtin.assert:
    that: ansible_facts['os_family'] == "Debian"
    fail_msg: The webserver role supports Debian and Ubuntu only.

- name: Install nginx
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: true
    cache_valid_time: 3600
  tags: packages

- name: Hide the nginx version in responses
  ansible.builtin.copy:
    content: "server_tokens off;\n"
    dest: /etc/nginx/conf.d/hardening.conf
    owner: root
    group: root
    mode: '0644'
  notify: nginx config changed

- name: Add security headers
  ansible.builtin.copy:
    content: |
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
    dest: /etc/nginx/conf.d/headers.conf
    owner: root
    group: root
    mode: '0644'
  notify: nginx config changed

- name: Create the site directory
  ansible.builtin.file:
    path: /var/www/webfleet
    state: directory
    owner: root
    group: root
    mode: '0755'

- name: Publish the home page
  ansible.builtin.template:
    src: index.html.j2
    dest: /var/www/webfleet/index.html
    owner: root
    group: root
    mode: '0644'
  tags: page

- name: Configure the site
  ansible.builtin.template:
    src: webfleet.conf.j2
    dest: /etc/nginx/sites-available/webfleet
    owner: root
    group: root
    mode: '0644'
  notify: nginx config changed

- name: Enable the site
  ansible.builtin.file:
    src: /etc/nginx/sites-available/webfleet
    dest: /etc/nginx/sites-enabled/webfleet
    state: link
  notify: nginx config changed

- name: Disable the default site
  ansible.builtin.file:
    path: /etc/nginx/sites-enabled/default
    state: absent
  notify: nginx config changed

- name: Start nginx and enable it at boot
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true
```

```yaml
---
- name: Check the nginx configuration
  ansible.builtin.command: nginx -t
  changed_when: false
  listen: nginx config changed

- name: Reload nginx
  ansible.builtin.service:
    name: nginx
    state: reloaded
  listen: nginx config changed
```

Move the templates into the role and rename the variables in them:

```bash
mv templates/index.html.j2 templates/webfleet.conf.j2 roles/webserver/templates/
rmdir templates
# -i.bak works with GNU sed (Linux) and BSD sed (macOS); then remove the backups
sed -i.bak 's/site_owner/webserver_owner/' roles/webserver/templates/index.html.j2
sed -i.bak 's/site_port/webserver_port/g' roles/webserver/templates/webfleet.conf.j2
rm roles/webserver/templates/*.bak
```

### Metadata and argument validation

`meta/main.yml` describes the role. Keep `dependencies` empty: a role that silently pulls in other roles is hard to follow, and listing roles in the playbook says the same thing in plain sight.

```yaml
---
galaxy_info:
  author: webfleet team
  description: Install nginx and publish the webfleet site
  license: MIT
  min_ansible_version: '2.19'
  platforms:
    - name: Ubuntu
      versions:
        - noble
    - name: Debian
      versions:
        - bookworm
        - trixie
dependencies: []
```

`meta/argument_specs.yml` declares the role's inputs. Before the role's first task, Ansible checks the values it got against these types and stops with a clear message if one is wrong:

```yaml
---
argument_specs:
  main:
    short_description: Install nginx and publish the webfleet site
    options:
      webserver_owner:
        type: str
        default: Unknown team
        description: Team named on the home page.
      webserver_port:
        type: int
        default: 80
        description: Port nginx listens on.
```

## A Baseline Role with a Collection Module

Every server, whatever it runs, should get the same basics. Create a second role, `baseline`, that sets the login message from [Part 2](/guides/introduction-to-ansible/02-fundamentals) and turns on the `ufw` firewall with only the ports a host needs. The firewall module is not part of ansible-core: it is `community.general.ufw`, from the `community.general` collection.

The open ports are an input of the role, with SSH as the default. `roles/baseline/defaults/main.yml`:

```yaml
---
# TCP ports to open in the firewall; everything else incoming is denied
baseline_firewall_ports:
  - '22'
```

The web servers need port 80 as well, which is why `inventory/group_vars/web.yml` above sets `baseline_firewall_ports` for the `web` group. `roles/baseline/tasks/main.yml`:

```yaml
---
- name: Set the login message
  ansible.builtin.copy:
    content: |
      This server is managed by Ansible from the webfleet project.
      Manual changes may be overwritten.
    dest: /etc/motd
    owner: root
    group: root
    mode: '0644'

- name: Install the firewall
  ansible.builtin.apt:
    name: ufw
    state: present

- name: Allow the listed ports
  community.general.ufw:
    rule: allow
    port: '{{ item }}'
    proto: tcp
  loop: '{{ baseline_firewall_ports }}'

- name: Deny other incoming traffic and turn the firewall on
  community.general.ufw:
    state: enabled
    direction: incoming
    default: deny
```

The order matters: every port the host needs is open before the firewall is switched on, so neither SSH (and with it Ansible) nor the website is cut off, even for a moment. Keeping the firewall in one role also means one place to read the ports a host should have open: `ansible-inventory --host web1` shows them. The role only adds rules, though: removing a port from the list does not close it. To close one, add a task with `delete: true` for that rule, or reset the firewall and let the role add the rules again. A role can be as small as this; you do not need the full skeleton.

## Install Collections with requirements.yml

List the collections the project needs, with version ranges, in `requirements.yml`:

```yaml
---
collections:
  - name: community.general
    version: '>=13.5.0,<14.0.0'
  - name: ansible.posix
    version: '>=2.2.0,<3.0.0'
```

Then tell Ansible to keep roles and collections inside the project, so that every machine and CI job uses the same versions instead of whatever happens to be installed in `~/.ansible`. This is `ansible.cfg` now:

```ini
[defaults]
inventory = inventory/hosts.yml
roles_path = roles
collections_path = collections
```

Install them:

```bash
ansible-galaxy collection install -r requirements.yml
```

```text
Starting galaxy collection install process
Process install dependency map
Starting collection install process
Downloading https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-general-13.5.0.tar.gz to /home/dev/.ansible/tmp/ansible-local-1002lxf329p/tmp1za2ln3p/community-general-13.5.0-jjdyf6z9
Installing 'community.general:13.5.0' to '/home/dev/webfleet/collections/ansible_collections/community/general'
community.general:13.5.0 was installed successfully
Downloading https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/ansible-posix-2.2.2.tar.gz to /home/dev/.ansible/tmp/ansible-local-1002lxf329p/tmp1za2ln3p/ansible-posix-2.2.2-eka71zuy
Installing 'ansible.posix:2.2.2' to '/home/dev/webfleet/collections/ansible_collections/ansible/posix'
ansible.posix:2.2.2 was installed successfully
Downloading https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-library_inventory_filtering_v1-1.1.5.tar.gz to /home/dev/.ansible/tmp/ansible-local-1002lxf329p/tmp1za2ln3p/community-library_inventory_filtering_v1-1.1.5-9t46mo4o
Installing 'community.library_inventory_filtering_v1:1.1.5' to '/home/dev/webfleet/collections/ansible_collections/community/library_inventory_filtering_v1'
community.library_inventory_filtering_v1:1.1.5 was installed successfully
```

```bash
ansible-galaxy collection list
```

```text
# /home/dev/webfleet/collections/ansible_collections
Collection                               Version
---------------------------------------- -------
ansible.posix                            2.2.2
community.general                        13.5.0
community.library_inventory_filtering_v1 1.1.5
```

`community.general` brought a dependency of its own, `community.library_inventory_filtering_v1`. A range such as `>=13.5.0,<14.0.0` takes bug fixes and new features but no new major version, which is where collections make breaking changes: version 12.0.0 removed the old `yaml` output callback, for example, and 13.0.0 dropped support for ansible-core 2.17. For fully repeatable runs, pin exact versions (`version: 13.5.0`) and update them on purpose. `ansible-galaxy` has no lock file, so the version list is your lock file. Install collections in CI from `requirements.yml` rather than committing the `collections/` directory, and add it to `.gitignore`.

`ansible-doc` now knows the new modules too: `ansible-doc community.general.ufw`.

## Use the Roles in a Playbook

`site.yml` becomes the project's entry point. It applies `baseline` to every host and `webserver` to the web servers, and keeps the end-to-end check from Part 3 in `post_tasks`, which run after the roles' handlers have reloaded nginx:

```yaml
---
- name: Apply the baseline to every server
  hosts: all
  become: true
  roles:
    - role: baseline

- name: Set up the web servers
  hosts: web
  become: true
  roles:
    - role: webserver

  post_tasks:
    - name: Fetch the home page from the control node
      ansible.builtin.uri:
        url: 'http://{{ ansible_host }}:{{ webserver_port }}/'
        return_content: true
      register: home_page
      delegate_to: localhost
      become: false
      check_mode: false # a GET changes nothing, so it also runs with --check

    - name: Check that the page names the host
      ansible.builtin.assert:
        that: ('<h1>Hello from ' ~ inventory_hostname ~ '</h1>') in home_page.content
        fail_msg: '{{ ansible_host }} did not serve its own page'
```

`web.yml` and `hello.yml` are replaced by the roles, so delete them:

```bash
rm web.yml hello.yml
```

Run it:

```bash
ansible-playbook site.yml
```

The output, with most of the `webserver` tasks (all `ok`) left out:

```text
PLAY [Apply the baseline to every server] **************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [baseline : Set the login message] ****************************************
ok: [web1]
ok: [web2]

TASK [baseline : Install the firewall] *****************************************
changed: [web1]
changed: [web2]

TASK [baseline : Allow the listed ports] ***************************************
changed: [web1] => (item=22)
changed: [web2] => (item=22)
changed: [web1] => (item=80)
changed: [web2] => (item=80)

TASK [baseline : Deny other incoming traffic and turn the firewall on] *********
changed: [web1]
changed: [web2]

PLAY [Set up the web servers] **************************************************
TASK [webserver : Validating arguments against arg spec 'main' - Install nginx and publish the webfleet site] ***
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=19   changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=19   changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

Task names are prefixed with their role (`baseline : Allow the listed ports`), which makes long runs easy to follow. The only changes are the firewall's: the login message was already the one from Part 2, and the `webserver` role found nginx, the files and the site exactly as `web.yml` had left them, so it reported `ok` and no handler ran. Moving tasks into a role changes how they are organized, not what they do.

Now see the argument check at work. Pass a port that is not a number:

```bash
ansible-playbook site.yml --limit web1 -e webserver_port=eighty
```

```text
TASK [webserver : Validating arguments against arg spec 'main' - Install nginx and publish the webfleet site] ***
[ERROR]: Task failed: Action failed: Validation of arguments failed:
argument 'webserver_port' is of type str and we were unable to convert to int: "'eighty'" cannot be converted to an int
Origin: <unknown>
```

The role stopped before its first task, with the variable's name and the expected type, instead of failing later inside an nginx configuration file.

## roles, import_role and include_role

There are three ways to apply a role, and the difference is when Ansible reads it:

|                                | `roles:`                        | `ansible.builtin.import_role`   | `ansible.builtin.include_role`             |
| ------------------------------ | ------------------------------- | ------------------------------- | ------------------------------------------ |
| Where                          | Play keyword                    | A task                          | A task                                     |
| Loaded                         | At parse time (static)          | At parse time (static)          | When the task runs (dynamic)               |
| `when` and `tags`              | Apply to every task in the role | Apply to every task in the role | Apply to the include itself                |
| `loop`                         | No                              | No                              | Yes, so you can apply a role once per item |
| `--list-tasks` shows its tasks | Yes                             | Yes                             | No                                         |

Use `roles:` by default. Use `import_role` to put a role between other tasks, and `include_role` when you need a loop or a role name that comes from a variable. A loop only makes sense with a role written to be applied several times, for example a `vhost` role that writes one nginx site per call, with its own file names and document root for each:

```yaml
- name: Add one nginx site per item
  ansible.builtin.include_role:
    name: vhost
  vars:
    vhost_name: '{{ item.name }}'
    vhost_port: '{{ item.port }}'
  loop:
    - { name: docs, port: 8080 }
    - { name: status, port: 8081 }
```

The `webserver` role in this project is not such a role: it always writes `/etc/nginx/sites-available/webfleet`, so a second call would overwrite the first.

## The Project Layout

```bash
tree -a -I collections
```

```text
.
├── ansible.cfg
├── inventory
│   ├── group_vars
│   │   ├── all.yml
│   │   └── web.yml
│   ├── host_vars
│   │   └── web2.yml
│   └── hosts.yml
├── requirements.yml
├── roles
│   ├── baseline
│   │   ├── defaults
│   │   │   └── main.yml
│   │   └── tasks
│   │       └── main.yml
│   └── webserver
│       ├── README.md
│       ├── defaults
│       │   └── main.yml
│       ├── handlers
│       │   └── main.yml
│       ├── meta
│       │   ├── argument_specs.yml
│       │   └── main.yml
│       ├── tasks
│       │   └── main.yml
│       └── templates
│           ├── index.html.j2
│           └── webfleet.conf.j2
└── site.yml
```

This is the layout most teams converge on, plus a few things later parts add: secrets in `inventory/group_vars/web/` ([Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns)), linting configuration, and one inventory per environment. Keep playbooks thin: a playbook says which roles go on which hosts, and the roles hold the work.

## Roles and Collections from Galaxy

[Ansible Galaxy](https://galaxy.ansible.com) hosts thousands of community roles and collections. Some are excellent, some are abandoned, and all of them run as root on your servers. Before you use one, check its last release, its open issues, its supported platforms, and read its tasks. Pin the version in `requirements.yml`, under `roles:` for standalone roles:

```yaml
---
roles:
  - name: geerlingguy.docker
    version: 8.0.0
collections:
  - name: community.general
    version: 13.5.0
```

`ansible-galaxy install -r requirements.yml` installs both kinds. When you want to share your own roles between projects, package them in a collection: `ansible-galaxy collection init` creates the skeleton, and a collection can hold roles, modules, plugins and playbooks together, with one version number.

## Common Mistakes

- **Role variables without a prefix.** `port` in one role and `port` in another overwrite each other. Use `webserver_port`.
- **Values that must be overridden in `vars/`.** `vars/main.yml` wins over the inventory; put overridable values in `defaults/`.
- **Deep role dependencies in `meta/main.yml`.** Prefer listing the roles in the playbook.
- **Collections from wherever.** Without `requirements.yml` and `collections_path`, each machine runs different versions.
- **Checks inside the role before the handlers ran.** Handlers flush after the roles; put end-to-end checks in `post_tasks`, or call `meta: flush_handlers` first.

## Summary

- A role is a directory with a fixed layout: `tasks`, `handlers`, `templates`, `files`, `defaults`, `vars` and `meta`.
- Prefix role variables with the role name, put their defaults in `defaults/main.yml`, and declare them in `meta/argument_specs.yml` to get type checks.
- Collections bring modules beyond `ansible.builtin`; list them with versions in `requirements.yml` and install them into the project.
- A thin `site.yml` maps roles to groups; `post_tasks` test the result after the handlers ran.

In [Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns) you make the project ready for a team: secrets in Ansible Vault, `ansible-lint`, tests, rolling updates and a CI pipeline.

## Keep Learning

- [Terraform Repository Structure Checklist](/checklists/terraform-repo-structure), the same questions for Terraform projects
- [Top GitHub DevOps learning repositories](/posts/top-github-devops-learning-repos-2026)
