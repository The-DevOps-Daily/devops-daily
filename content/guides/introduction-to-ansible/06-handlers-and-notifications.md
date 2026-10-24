---
title: 'Ansible Handlers: Restart Services Only When Needed'
description: 'Use handlers to reload nginx only when its configuration changes, test the config before a reload, and avoid the traps of failed runs and handler order.'
order: 6
---

Some changes only take effect after a service reloads: nginx reads its configuration at start and on reload. You could reload nginx at the end of every run, but that touches every server even when nothing changed. **Handlers** solve this: a task that changes something **notifies** a handler, and the handler runs once, at the end, only if a notification arrived. In this part you add nginx configuration to `web.yml`, reload nginx with a handler, make the handler test the configuration first, and see the two situations in which handlers do not run when you expect them to.

## Prerequisites

- The `~/webfleet` project with `web.yml` from [Part 3](/guides/introduction-to-ansible/03-writing-your-first-playbook) and the inventory from [Part 4](/guides/introduction-to-ansible/04-working-with-inventory).

## Add Configuration and a Handler

Right now nginx tells every client its exact version:

```bash
curl -sI http://192.168.56.11/ | grep -i '^server'
```

```text
Server: nginx/1.24.0 (Ubuntu)
```

Add two configuration files to `web.yml`: one hides the version, one adds two security headers. Both notify the same handler topic, `nginx config changed`. Then add a `handlers` section with two handlers that listen to that topic. This is the whole playbook now:

```yaml
---
- name: Set up the web servers
  hosts: web
  become: true

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

  handlers:
    - name: Check the nginx configuration
      ansible.builtin.command: nginx -t
      changed_when: false
      listen: nginx config changed

    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
      listen: nginx config changed

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

Run it:

```bash
ansible-playbook web.yml
```

```text
TASK [Hide the nginx version in responses] *************************************
changed: [web2]
changed: [web1]

TASK [Add security headers] ****************************************************
changed: [web2]
changed: [web1]

TASK [Publish the home page] ***************************************************
ok: [web2]
ok: [web1]

TASK [Start nginx and enable it at boot] ***************************************
ok: [web1]
ok: [web2]

RUNNING HANDLER [Check the nginx configuration] ********************************
ok: [web2]
ok: [web1]

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

TASK [Fetch the home page from the control node] *******************************
ok: [web1 -> localhost]
ok: [web2 -> localhost]

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
web1                       : ok=11   changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=11   changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

Read the order of events:

1. Both configuration tasks changed something on both hosts, so each sent the notification `nginx config changed` twice per host.
2. The handlers did not run right away. They ran once per host, after all tasks of the `tasks` section, and before `post_tasks`, so the test at the end saw the reloaded nginx.
3. They ran in the order they are written in the `handlers` section, not in the order of the notifications: first `nginx -t`, then the reload.

The result:

```bash
curl -sI http://192.168.56.11/ | grep -i -E '^(server|x-)'
```

```text
Server: nginx
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

Run the playbook again and nothing is notified, so no handler runs:

```bash
ansible-playbook web.yml
```

```text
PLAY RECAP *********************************************************************
web1                       : ok=9    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=9    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

## How Notifications Work

- `notify` takes a handler's `name` or a `listen` topic, or a list of them. A topic lets several handlers react to one event, and lets tasks notify "what happened" (`nginx config changed`) instead of "what to do".
- A handler runs only if the notifying task reported `changed`. `ok` and `skipped` do not notify.
- A handler runs at most once per host per flush, however many tasks notified it.
- Handlers are flushed at the end of each section of a play (`pre_tasks`, then `roles` and `tasks`, then `post_tasks`), and when a task calls `ansible.builtin.meta: flush_handlers`.
- Handler names must be unique in a play. If two roles both define `Reload nginx`, only the last one loaded can run. Give handlers in roles names that include the role, or notify a `listen` topic.

When a later task needs the new configuration, flush the handlers before it instead of waiting for the end of the section:

```yaml
- name: Switch nginx to the new upstream
  ansible.builtin.copy:
    src: upstream.conf
    dest: /etc/nginx/conf.d/upstream.conf
    mode: '0644'
  notify: nginx config changed

- name: Run the pending handlers now
  ansible.builtin.meta: flush_handlers

- name: Warm the cache through the new upstream
  ansible.builtin.uri:
    url: http://localhost/warmup
```

## Test the Configuration Before Reloading

The `Check the nginx configuration` handler runs `nginx -t` before the reload. When the check fails, the reload never happens and nginx keeps serving with the configuration it already has. Try it: break the first file with a typo, `server_tokens of;`.

```bash
ansible-playbook web.yml --limit web1
```

```text
RUNNING HANDLER [Check the nginx configuration] ********************************
fatal: [web1]: FAILED! => {"changed": false, "changed_when_result": false, "cmd": ["nginx", "-t"], "delta": "0:00:00.024931", "end": "2026-10-24 03:41:29.547712", "msg": "The command exited with a non-zero return code.", "rc": 1, "start": "2026-10-24 03:41:29.522781", "stderr": "2026/10/24 03:41:29 [emerg] 83095#83095: invalid value \"of\" in /etc/nginx/conf.d/hardening.conf:1\nnginx: configuration file /etc/nginx/nginx.conf test failed", "stderr_lines": ["2026/10/24 03:41:29 [emerg] 83095#83095: invalid value \"of\" in /etc/nginx/conf.d/hardening.conf:1", "nginx: configuration file /etc/nginx/nginx.conf test failed"], "stdout": "", "stdout_lines": []}
PLAY RECAP *********************************************************************
web1                       : ok=7    changed=1    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

The handler failed, so the reload did not run, `web1` stopped, and the site is still up with the old configuration:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.56.11/
```

```text
200
```

The broken file is still on disk, though. If nginx restarted now, for example after a reboot, it would not start. Fix the typo and run again: the file changes back, the handlers are notified, and this time they pass.

```bash
ansible-playbook web.yml --limit web1
```

```text
RUNNING HANDLER [Check the nginx configuration] ********************************
ok: [web1]
RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
PLAY RECAP *********************************************************************
web1                       : ok=11   changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

When a module writes the complete configuration file, its `validate` option is stronger: it tests the new file before it replaces the old one, so a broken file never reaches its place. [Part 7](/guides/introduction-to-ansible/07-templates-and-files#h2-validate-files-before-they-replace-the-old-ones) uses it for a `sudoers` file. For files that nginx includes, like these, the handler check is the practical option.

## When Handlers Do Not Run

The classic trap: a task changes a configuration file and notifies a handler, then a later task fails. By default, a host that fails runs no handlers, so the reload never happens. On the next run the configuration task reports `ok`, because the file is already right, so nothing notifies the handler again. The new configuration sits on disk, unused, until something else restarts the service.

```yaml
---
- name: A failure after a notification
  hosts: web1
  become: true

  tasks:
    - name: Change the configuration
      ansible.builtin.copy:
        content: "gzip_comp_level 5;\n"
        dest: /etc/nginx/conf.d/gzip.conf
        mode: '0644'
      notify: Reload nginx

    - name: A later task fails
      ansible.builtin.command: /bin/false
      changed_when: false

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

```bash
ansible-playbook gotcha.yml
```

The output, with the long `fatal` line cut after 72 characters:

```text
TASK [Gathering Facts] *********************************************************
ok: [web1]
TASK [Change the configuration] ************************************************
changed: [web1]
TASK [A later task fails] ******************************************************
fatal: [web1]: FAILED! => {"changed": false, "changed_when_result": fals
PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

No `RUNNING HANDLER` line: the reload was lost, and running the playbook again does not bring it back, because the file is already in place. Reload nginx by hand to apply it (`ansible web1 -b -a "systemctl reload nginx"`). To avoid the problem, run with `--force-handlers`, or set `force_handlers: true` on the play, and notified handlers run even on a host where a task failed. To see it, delete the file so that the task changes it again, then run with the option:

```bash
ansible web1 -b -m ansible.builtin.file -a "path=/etc/nginx/conf.d/gzip.conf state=absent"
```

```text
web1 | CHANGED => {
    "changed": true,
    "path": "/etc/nginx/conf.d/gzip.conf",
    "state": "absent"
}
```

```bash
ansible-playbook gotcha.yml --force-handlers
```

The output, with the long `fatal` line cut after 72 characters:

```text
TASK [Gathering Facts] *********************************************************
ok: [web1]
TASK [Change the configuration] ************************************************
changed: [web1]
TASK [A later task fails] ******************************************************
fatal: [web1]: FAILED! => {"changed": false, "changed_when_result": fals
RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

This time the handler ran although a task failed. `gotcha.yml` was only a demonstration; delete it, and remove its file from `web1`:

```bash
ansible web1 -b -m ansible.builtin.file -a "path=/etc/nginx/conf.d/gzip.conf state=absent"
ansible web1 -b -a "systemctl reload nginx"
rm gotcha.yml
```

The second case is check mode: with `--check`, a task that would change reports `changed`, and its handlers are shown as if they ran, but nothing is reloaded.

## Reload or Restart?

Prefer a reload when the service supports one. nginx reloads its configuration without dropping open connections; a restart stops the process and briefly refuses new ones. Some changes need a restart anyway, such as a new nginx module or, for many databases, a memory setting. Give each its own handler and notify the one that fits:

```yaml
handlers:
  - name: Reload nginx
    ansible.builtin.service:
      name: nginx
      state: reloaded

  - name: Restart nginx
    ansible.builtin.service:
      name: nginx
      state: restarted
```

For a fleet behind a load balancer, combine handlers with `serial`, which runs the whole play on a few hosts at a time, so that only part of the fleet reloads at once. [Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns#h2-rolling-updates) shows it.

## Common Mistakes

- **Restarting in a regular task.** A task with `state: restarted` restarts every time. Use a handler.
- **Notifying a name that does not exist.** The playbook fails with `The requested handler 'Reload nginix' was not found`. Topics with `listen` make typos less likely, because one name covers several handlers.
- **Expecting notification order to matter.** Handlers run in the order of the `handlers` section.
- **A failed run that leaves changed files behind.** Use `--force-handlers`, or check the service after a failed run.
- **A command in a handler without `changed_when`.** `nginx -t` changes nothing; say so.

## Summary

- Tasks notify handlers by name or by `listen` topic; a handler runs once per host, at the end of the section, and only if a notifying task changed something.
- Handlers run in the order they are defined; `meta: flush_handlers` runs them early.
- Test the configuration in a handler before the reload, so a broken file never reaches the running service.
- A failed task cancels pending handlers on that host; `--force-handlers` changes that.

In [Part 7](/guides/introduction-to-ansible/07-templates-and-files) you replace the inline file contents with Jinja2 templates, give the site its own nginx server block, and use the other file modules.

## Keep Learning

- [Production Deployment Checklist](/checklists/production-deployment)
- [Zero-downtime deployments: strategies compared](/posts/deployment-strategies-guide)
