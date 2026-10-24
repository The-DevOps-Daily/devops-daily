---
title: 'Write Your First Ansible Playbook'
description: 'Build a playbook that installs nginx on two servers, publishes a page and tests it, then add conditions, loops, tags and error handling. Real output.'
order: 3
---

Time to automate something real. In this part you write `web.yml`, a playbook that turns `web1` and `web2` into nginx web servers that each serve their own page, and that tests the result from the control node. You build it in three steps and run it after each one, so you see what every addition does. Then you add the tools you need in every playbook: conditions, loops, tags and error handling.

## Prerequisites

- The `~/webfleet` project from [Part 1](/guides/introduction-to-ansible/01-installing-and-setting-up), with `web1` and `web2` reachable.
- The basics from [Part 2](/guides/introduction-to-ansible/02-fundamentals): modules, tasks, plays, and how to read `ansible-playbook` output.

## Step 1: Install nginx

Start with two tasks: install the package, and make sure the service runs now and after a reboot. Save this as `web.yml` in `~/webfleet`:

```yaml
---
- name: Set up the web servers
  hosts: web
  become: true # every task in this play runs with sudo

  tasks:
    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: true # run apt update first...
        cache_valid_time: 3600 # ...unless it ran in the last hour

    - name: Start nginx and enable it at boot
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

Check the syntax, then run it:

```terminal
{
  "title": "check the syntax, then run",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-playbook web.yml --syntax-check",
      "output": "playbook: web.yml"
    },
    {
      "cmd": "ansible-playbook web.yml",
      "output": "PLAY [Set up the web servers] **************************************************\n\nTASK [Gathering Facts] *********************************************************\nok: [web1]\nok: [web2]\n\nTASK [Install nginx] ***********************************************************\nchanged: [web1]\nchanged: [web2]\n\nTASK [Start nginx and enable it at boot] ***************************************\nok: [web2]\nok: [web1]\n\nPLAY RECAP *********************************************************************\nweb1                       : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0\nweb2                       : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0"
    }
  ]
}
```

Both hosts report `changed` for the install. The service task is `ok`, because on Debian and Ubuntu the nginx package starts and enables the service itself, so it was already in the wanted state when the task checked. On another distribution the same task would start it. That is the point of declaring state: the task is correct either way.

## Step 2: Publish a Page

A web server should serve something. Add a variable and a task that writes the home page. The `copy` module with `content` writes a file from a string, and the `{{ }}` expressions are filled in per host:

```yaml
---
- name: Set up the web servers
  hosts: web
  become: true

  vars:
    site_owner: Platform team

  tasks:
    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: true
        cache_valid_time: 3600

    - name: Publish the home page
      ansible.builtin.copy:
        content: |
          <h1>Hello from {{ inventory_hostname }}</h1>
          <p>Run by {{ site_owner }}. Managed by Ansible.</p>
        dest: /var/www/html/index.html
        owner: root
        group: root
        mode: '0644'

    - name: Start nginx and enable it at boot
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

```terminal
{
  "title": "run it, then ask both servers for the page",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-playbook web.yml",
      "output": "PLAY RECAP *********************************************************************\nweb1                       : ok=4    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0\nweb2                       : ok=4    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0"
    },
    {
      "cmd": "curl -s http://192.168.56.11/",
      "output": "<h1>Hello from web1</h1>\n<p>Run by Platform team. Managed by Ansible.</p>"
    },
    {
      "cmd": "curl -s http://192.168.56.12/",
      "output": "<h1>Hello from web2</h1>\n<p>Run by Platform team. Managed by Ansible.</p>"
    }
  ]
}
```

Only the new task changed something; nginx was already installed, so that task reported `ok` without running `apt` again. Ubuntu's default nginx site serves `/var/www/html` and looks for `index.html` before its own welcome page, so the new file is what you see.

Always quote file modes as strings (`"0644"`). An unquoted `0644` is read by YAML as an octal number and happens to work, but `644` without the zero is the decimal number 644, which gives the file permissions you did not want. [Part 7](/guides/introduction-to-ansible/07-templates-and-files) shows the result.

## Step 3: Test the Result

A playbook that finishes without errors has not proved that the site works. Add checks that run from the control node, the way a user reaches the site. `post_tasks` run after the main tasks:

```yaml
---
- name: Set up the web servers
  hosts: web
  become: true

  vars:
    site_owner: Platform team

  pre_tasks:
    - name: Stop on systems this playbook does not support
      ansible.builtin.assert:
        that: ansible_facts['os_family'] == "Debian"
        fail_msg: This playbook supports Debian and Ubuntu only.
      tags: always

  tasks:
    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: true
        cache_valid_time: 3600
      tags: packages

    - name: Publish the home page
      ansible.builtin.copy:
        content: |
          <h1>Hello from {{ inventory_hostname }}</h1>
          <p>Run by {{ site_owner }}. Managed by Ansible.</p>
        dest: /var/www/html/index.html
        owner: root
        group: root
        mode: '0644'
      tags: page

    - name: Start nginx and enable it at boot
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  post_tasks:
    - name: Fetch the home page from the control node
      ansible.builtin.uri:
        url: 'http://{{ ansible_host }}/'
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

What is new:

- **`pre_tasks`** run before `tasks`. The `assert` stops the play early on a system the playbook was not written for, instead of failing halfway through with a confusing `apt` error.
- **`delegate_to: localhost`** runs the `uri` task on the control node, but with the variables of the current host, so `{{ ansible_host }}` is `192.168.56.11` for `web1` and `192.168.56.12` for `web2`. `become: false` is needed because the play sets `become: true`, and the control node has no reason to use `sudo`.
- **`register`** stores a task's result in a variable (`home_page`), and the next task checks that its `content` has this host's heading.
- **`check_mode: false`** lets the `uri` task run even during a `--check` run. Ansible cannot know whether `uri` would change something, so it skips the module in check mode, and the `assert` would then have no page to check. A `GET` request changes nothing, so it is safe to run.
- **`tags`** label tasks so you can run a subset later.

```bash
ansible-playbook web.yml
```

```text
PLAY [Set up the web servers] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Stop on systems this playbook does not support] **************************
ok: [web1] => {
    "changed": false,
    "msg": "All assertions passed"
}
ok: [web2] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Install nginx] ***********************************************************
ok: [web1]
ok: [web2]

TASK [Publish the home page] ***************************************************
ok: [web1]
ok: [web2]

TASK [Start nginx and enable it at boot] ***************************************
ok: [web1]
ok: [web2]

TASK [Fetch the home page from the control node] *******************************
ok: [web2 -> localhost]
ok: [web1 -> localhost]

TASK [Check that the page names the host] **************************************
ok: [web1] => {
    "changed": false,
    "msg": "All assertions passed"
}
ok: [web2] => {
    "changed": false,
    "msg": "All assertions passed"
}

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=7    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

`changed=0` on both hosts: the servers were already right, and the new checks passed. This is the full playbook for now. In later parts it gets a template, handlers and a role, but the structure stays the same.

## Run Part of a Playbook

As a playbook grows, you often want to run only some of it.

```terminal
{
  "title": "limit, tags and task lists",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "only on web2",
      "cmd": "ansible-playbook web.yml --limit web2 | tail -n 3",
      "output": "PLAY RECAP *********************************************************************\nweb2                       : ok=7    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0"
    },
    {
      "comment": "which tags exist",
      "cmd": "ansible-playbook web.yml --list-tags",
      "output": "playbook: web.yml\n\n  play #1 (web): Set up the web servers\tTAGS: []\n      TASK TAGS: [always, packages, page]"
    },
    {
      "comment": "only tasks tagged page (plus the ones tagged always)",
      "cmd": "ansible-playbook web.yml --tags page",
      "output": "PLAY [Set up the web servers] **************************************************\n\nTASK [Gathering Facts] *********************************************************\nok: [web2]\nok: [web1]\n\nTASK [Stop on systems this playbook does not support] **************************\nok: [web1] => {\n    \"changed\": false,\n    \"msg\": \"All assertions passed\"\n}\nok: [web2] => {\n    \"changed\": false,\n    \"msg\": \"All assertions passed\"\n}\n\nTASK [Publish the home page] ***************************************************\nok: [web2]\nok: [web1]\n\nPLAY RECAP *********************************************************************\nweb1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0\nweb2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0"
    }
  ]
}
```

`--tags page` ran the page task and the `assert`, which is tagged `always`; untagged tasks were left out. The opposite is `--skip-tags`. Two more options help while you develop a playbook: `--start-at-task "Publish the home page"` starts at a named task, and `--step` asks before each task whether to run it.

## Conditions with when

A task with `when` runs only on hosts where the expression is true. The expression is plain Jinja2, without `{{ }}`. Facts make common conditions short. Save this as `conditions.yml`:

```yaml
---
- name: Conditions and loops
  hosts: web
  become: true

  tasks:
    - name: Install htop on Debian and Ubuntu
      ansible.builtin.apt:
        name: htop
        state: present
      when: ansible_facts['os_family'] == "Debian"

    - name: Install htop on Fedora, RHEL and similar
      ansible.builtin.dnf:
        name: htop
        state: present
      when: ansible_facts['os_family'] == "RedHat"

    - name: Warn about small servers
      ansible.builtin.debug:
        msg: "{{ inventory_hostname }} has only {{ ansible_facts['memtotal_mb'] }} MB of memory"
      when: ansible_facts['memtotal_mb'] < 1024

    - name: Show a few facts
      ansible.builtin.debug:
        msg: '{{ item }} = {{ ansible_facts[item] }}'
      loop:
        - distribution_release
        - processor_vcpus
        - kernel
      when: inventory_hostname == "web1"
```

```bash
ansible-playbook conditions.yml
```

```text
PLAY [Conditions and loops] ****************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Install htop on Debian and Ubuntu] ***************************************
changed: [web1]
changed: [web2]

TASK [Install htop on Fedora, RHEL and similar] ********************************
skipping: [web1]
skipping: [web2]

TASK [Warn about small servers] ************************************************
ok: [web1] => {
    "msg": "web1 has only 445 MB of memory"
}
ok: [web2] => {
    "msg": "web2 has only 445 MB of memory"
}

TASK [Show a few facts] ********************************************************
skipping: [web2] => (item=distribution_release)
ok: [web1] => (item=distribution_release) => {
    "msg": "distribution_release = noble"
}
skipping: [web2] => (item=processor_vcpus)
skipping: [web2] => (item=kernel)
skipping: [web2]
ok: [web1] => (item=processor_vcpus) => {
    "msg": "processor_vcpus = 1"
}
ok: [web1] => (item=kernel) => {
    "msg": "kernel = 6.8.0-147-generic"
}

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=1    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0
web2                       : ok=3    changed=1    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0
```

The `dnf` task shows `skipping` on both Ubuntu hosts. The last task shows how `loop` and `when` combine: the condition is checked for every item, which is why `web2` skips each item separately.

### Conditions must be booleans

Since ansible-core 2.19, a condition must produce `true` or `false`. Older versions accepted any "truthy" value, which hid real bugs: the string `"false"` is truthy, so this task ran even though the variable says not to.

```yaml
---
- name: A broken condition
  hosts: web1
  gather_facts: false
  vars:
    install_extras: 'false' # a string, for example from -e install_extras=false

  tasks:
    - name: Install extra tools
      ansible.builtin.debug:
        msg: Installing extras
      when: install_extras
```

```bash
ansible-playbook broken.yml
```

```text
11         msg: Installing extras
12       when: install_extras
               ^ column 13
<<< caused by >>>
Conditional result (True) was derived from value of type 'str' at '/home/dev/webfleet/broken.yml:6:21'. Conditionals must have a boolean result.
Origin: /home/dev/webfleet/broken.yml:12:13
10       ansible.builtin.debug:
11         msg: Installing extras
12       when: install_extras
               ^ column 13
Broken conditionals can be temporarily allowed with the `ALLOW_BROKEN_CONDITIONALS` configuration option.
fatal: [web1]: FAILED! => {"msg": "Task failed: A 'when' expression failed: Conditional result (True) was derived from value of type 'str' at '/home/dev/webfleet/broken.yml:6:21'. Conditionals must have a boolean result."}
```

The error names the file, line and column where the string came from. Convert the value explicitly with the `bool` filter, which understands `"false"`, `"no"`, `"0"` and their opposites:

```yaml
when: install_extras | bool
```

Other conditions that 2.19 and later reject: a template inside `when` (`when: "{{ x }} == 1"`; write `when: x == 1`), and a bare list or string (`when: my_list`; write `when: my_list | length > 0`). If an older project fails after an upgrade, the `ALLOW_BROKEN_CONDITIONALS` setting turns these errors into warnings while you fix them, but treat it as temporary.

## Loops

`loop` repeats a task for each item of a list, and `{{ item }}` holds the current one. A list of dictionaries lets each item carry several values:

```yaml
- name: Create the site directories
  ansible.builtin.file:
    path: '{{ item.path }}'
    state: directory
    mode: '{{ item.mode }}'
  loop:
    - { path: /srv/webfleet, mode: '0755' }
    - { path: /srv/webfleet/uploads, mode: '0750' }
```

Before you loop, check whether the module takes a list itself. `ansible.builtin.apt` does, and `name: [nginx, htop, tree]` installs all three in one `apt` transaction, which is much faster than three tasks. Older playbooks use `with_items` and other `with_*` keywords; they still work, but `loop` is the current form.

## Handle Errors

By default, a failed task stops that host for the rest of the play, while the other hosts continue. You have four tools to change that.

**`changed_when` and `failed_when`** set the result yourself, which `command` and `shell` tasks need:

```yaml
- name: Read the nginx version
  ansible.builtin.command: nginx -v
  register: nginx_version
  changed_when: false # reading something never changes the host
```

**`creates` and `removes`** make a command idempotent by checking a file first: `ansible.builtin.command: tar xf app.tar.gz` with `creates: /opt/app/bin/app` runs only while that file is missing.

**`ignore_errors: true`** lets the play continue after a failure. It hides problems, so use it only for tasks that are really optional, and prefer `failed_when` with a precise condition.

**`block`, `rescue` and `always`** work like try, catch and finally. Save this as `errors.yml`:

```yaml
---
- name: Error handling
  hosts: web1
  gather_facts: false

  tasks:
    - name: Fetch a page, recover if it fails
      block:
        - name: Fetch a page that does not exist
          ansible.builtin.uri:
            url: 'http://{{ ansible_host }}/missing'
          delegate_to: localhost
      rescue:
        - name: Report what failed
          ansible.builtin.debug:
            msg: '{{ ansible_failed_task.name }} failed with HTTP {{ ansible_failed_result.status }}'
      always:
        - name: Runs whether the block failed or not
          ansible.builtin.debug:
            msg: Done
```

```bash
ansible-playbook errors.yml
```

```text
PLAY [Error handling] **********************************************************
TASK [Fetch a page that does not exist] ****************************************
[ERROR]: Task failed: Module failed: Status code was 404 and not [200]: HTTP Error 404: Not Found
Origin: /home/dev/webfleet/errors.yml:9:11
7     - name: Fetch a page, recover if it fails
8       block:
9         - name: Fetch a page that does not exist
            ^ column 11
fatal: [web1 -> localhost]: FAILED! => {"changed": false, "connection": "close", "content_length": "162", "content_type": "text/html", "date": "Sat, 24 Oct 2026 03:35:46 GMT", "elapsed": 0, "msg": "Status code was 404 and not [200]: HTTP Error 404: Not Found", "redirected": false, "server": "nginx/1.24.0 (Ubuntu)", "status": 404, "url": "http://192.168.56.11/missing"}
TASK [Report what failed] ******************************************************
ok: [web1] => {
    "msg": "Fetch a page that does not exist failed with HTTP 404"
}
TASK [Runs whether the block failed or not] ************************************
ok: [web1] => {
    "msg": "Done"
}
PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=1    ignored=0
```

The failed task still prints its error, but `rescue` handled it, so the recap shows `failed=0` and `rescued=1`. Inside `rescue`, `ansible_failed_task` and `ansible_failed_result` describe what went wrong.

The three playbooks in this section were demonstrations, not part of the project. Delete them:

```bash
rm conditions.yml broken.yml errors.yml
```

## Common Mistakes

- **Testing only that the playbook finished.** Check the result, as the `uri` and `assert` tasks do here.
- **Using `{{ }}` in `when`, or non-boolean conditions.** Both are errors since ansible-core 2.19.
- **`become: true` on a task delegated to `localhost`.** It tries `sudo` on your control node; set `become: false` there.
- **Unquoted file modes.** Write `mode: "0644"`.
- **`ignore_errors` everywhere.** A playbook that cannot fail cannot tell you that something is broken.

## Summary

- Build playbooks in small steps and run them after each step: `changed` should appear once and then turn into `ok`.
- `pre_tasks` and `post_tasks` are the places for checks before and tests after the real work.
- `delegate_to: localhost` runs a task on the control node with the current host's variables.
- `when` takes a plain expression that must be a boolean; `loop` repeats a task over a list.
- `--limit`, `--tags`, `--start-at-task` and `--step` run part of a playbook; `block`/`rescue`/`always` handle failures.

In [Part 4](/guides/introduction-to-ansible/04-working-with-inventory) you move the inventory to YAML, add groups for environments, and give each group and host its own variables.

## Keep Learning

- [Complete Web Server Automation with Ansible](/exercises/ansible-web-server-automation), a hands-on exercise
- [Ansible Configuration Management Quiz](/quizzes/ansible-quiz)
