---
title: 'Ansible Templates and Files with Jinja2'
description: 'Build config files with Jinja2 templates, manage files, links and permissions, edit lines safely, validate files before they go live and preview changes.'
order: 7
---

So far `web.yml` writes files from inline strings. That works for one line, but real configuration files are long, and their content depends on the host. **Templates** are files with placeholders and logic, written in Jinja2, that Ansible renders separately for every host. In this part you move the page and the nginx site into templates, preview changes with `--diff`, and use the other file modules: directories, links, permissions, single lines, and validation before a file replaces the old one.

## Prerequisites

- The `~/webfleet` project with `web.yml` and its handlers from [Part 6](/guides/introduction-to-ansible/06-handlers-and-notifications).

## Which File Module?

| Module                                                 | Use it to                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| `ansible.builtin.copy`                                 | Copy a file from the control node unchanged, or write a short string  |
| `ansible.builtin.template`                             | Render a Jinja2 template from the control node                        |
| `ansible.builtin.file`                                 | Create directories, links and empty files; set owner and mode; delete |
| `ansible.builtin.lineinfile`                           | Make sure one line is (or is not) in a file you do not fully own      |
| `ansible.builtin.blockinfile`                          | Manage a marked block of lines in such a file                         |
| `ansible.builtin.replace`                              | Replace every match of a regular expression                           |
| `ansible.builtin.get_url`, `ansible.builtin.unarchive` | Download a file; unpack an archive                                    |
| `ansible.builtin.fetch`                                | Copy a file from the hosts to the control node                        |
| `ansible.posix.synchronize`                            | Copy whole directory trees with `rsync`                               |

The rule of thumb: if Ansible owns the whole file, use `template` or `copy`. Use `lineinfile` and `blockinfile` only for files that something else owns too, such as a distribution's default configuration.

## Jinja2 in One Screen

Ansible looks for templates in a `templates/` directory next to the playbook (or inside a role). The syntax has three kinds of tags:

```jinja2
{{ site_owner }}                       {# print a value #}
{{ site_owner | upper }}               {# with a filter #}
{% if site_port != 80 %}...{% endif %} {# logic #}
{% for host in groups['web'] %}...{% endfor %}
{# a comment that is not rendered #}
```

Everything else is copied as it is. Ansible renders templates with `trim_blocks` on, so a line that holds only a `{% %}` tag leaves no empty line behind.

## Template the Home Page

Create `templates/index.html.j2`. It lists every web server and marks the one that rendered the page:

```jinja2
{# Home page of each web server. Rendered by Ansible: do not edit on the server. #}
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ inventory_hostname }} | webfleet</title>
</head>
<body>
  <h1>Hello from {{ inventory_hostname }}</h1>
  <p>Run by {{ site_owner }}. Managed by Ansible.</p>
  <h2>Web servers</h2>
  <ul>
{% for host in groups['web'] %}
    <li>{{ host }}{% if host == inventory_hostname %} (this one){% endif %}</li>
{% endfor %}
  </ul>
</body>
</html>
```

## Give the Site Its Own nginx Server Block

Ubuntu's default site serves `/var/www/html`. A dedicated server block, with its own document root, is easier to reason about. Create `templates/webfleet.conf.j2`:

```jinja2
{{ ansible_managed | comment }}
server {
    listen {{ site_port }} default_server;
    listen [::]:{{ site_port }} default_server;
    server_name {{ inventory_hostname }};

    root /var/www/webfleet;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

`ansible_managed` renders a short note (by default `Ansible managed`), and the `comment` filter turns it into a comment block, so whoever opens the file on the server knows not to edit it by hand. Add the port to `inventory/group_vars/web.yml`:

```yaml
---
site_owner: Platform team
site_port: 80
```

Now replace the page task in `web.yml` with these five tasks, which create the document root, render both templates, enable the new site and disable the default one:

```yaml
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
```

The check in `post_tasks` should follow the port too. Change its URL:

```yaml
- name: Fetch the home page from the control node
  ansible.builtin.uri:
    url: 'http://{{ ansible_host }}:{{ site_port }}/'
```

Run it with `--diff`, which shows every change to a file as a unified diff. Limit the run to the canary, `web2`, first:

```bash
ansible-playbook web.yml --diff --limit web2
```

```text
TASK [Configure the site] ******************************************************
--- before
+++ after: /home/dev/.ansible/tmp/ansible-local-2532xyplcy2/tmpjfc0ir9w/webfleet.conf.j2
@@ -0,0 +1,15 @@
+#
+# Ansible managed
+#
+server {
+    listen 80 default_server;
+    listen [::]:80 default_server;
+    server_name web2;
+
+    root /var/www/webfleet;
+    index index.html;
+
+    location / {
+        try_files $uri $uri/ =404;
+    }
+}
changed: [web2]
TASK [Enable the site] *********************************************************
RUNNING HANDLER [Check the nginx configuration] ********************************
ok: [web2]
RUNNING HANDLER [Reload nginx] *************************************************
changed: [web2]
TASK [Fetch the home page from the control node] *******************************
ok: [web2 -> localhost]
TASK [Check that the page names the host] **************************************
ok: [web2] => {
    "changed": false,
    "msg": "All assertions passed"
}
PLAY RECAP *********************************************************************
web2                       : ok=15   changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

`--diff` shows the rendered server block with the `Ansible managed` comment, and the handlers reload nginx once for all three changes. Check the page:

```bash
curl -s http://192.168.56.12/
```

```text
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>web2 | webfleet</title>
</head>
<body>
  <h1>Hello from web2</h1>
  <p>Run by Platform team (canary). Managed by Ansible.</p>
  <h2>Web servers</h2>
  <ul>
    <li>web1</li>
    <li>web2 (this one)</li>
  </ul>
</body>
</html>
```

The `{% for %}` and `{% if %}` lines left no empty lines behind, because of `trim_blocks`. Now roll it out to `web1` too:

```bash
ansible-playbook web.yml
```

```text
PLAY RECAP *********************************************************************
web1                       : ok=15   changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=13   changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

## Preview Template Changes with --check --diff

Together, `--check` and `--diff` show exactly what a template change would do on each host, without doing it. Change the heading of the list in `templates/index.html.j2` to `All web servers`, then:

```bash
ansible-playbook web.yml --check --diff --tags page
```

```text
TASK [Publish the home page] ***************************************************
--- before: /var/www/webfleet/index.html
+++ after: /home/dev/.ansible/tmp/ansible-local-677ex7ene48/tmp13jdc6me/index.html.j2
@@ -7,7 +7,7 @@
 <body>
   <h1>Hello from web1</h1>
   <p>Run by Platform team. Managed by Ansible.</p>
-  <h2>Web servers</h2>
+  <h2>All web servers</h2>
   <ul>
     <li>web1 (this one)</li>
     <li>web2</li>
```

Change the heading back afterward. Review this kind of output in pull requests for production changes: it is the closest Ansible gets to Terraform's `plan`.

## Keep Templates Idempotent

A template that renders differently on every run reports `changed` on every run, notifies its handlers every time, and hides real changes in noise. The usual cause is a timestamp:

```yaml
---
- name: A template that never settles
  hosts: web1
  tasks:
    - name: Write a file with a timestamp
      ansible.builtin.copy:
        content: "Generated at {{ ansible_facts['date_time']['iso8601'] }}\n"
        dest: /tmp/stamp.txt
        mode: '0644'
```

```terminal
{
  "title": "changed on every run",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-playbook stamp.yml",
      "output": "ok: [web1]\nchanged: [web1]\nweb1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0"
    },
    {
      "cmd": "ansible-playbook stamp.yml",
      "output": "ok: [web1]\nchanged: [web1]\nweb1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0"
    }
  ]
}
```

Leave timestamps out of managed files. If you need to know when a file was last deployed, Ansible's output and your CI logs already tell you, and `ansible_managed` marks the file without changing on every run. Delete the demonstration: `rm stamp.yml` and `ansible web1 -m ansible.builtin.file -a "path=/tmp/stamp.txt state=absent"`.

## Directories, Links and Permissions

The `file` module sets the state of a path: `directory`, `link`, `touch`, `absent`, or `file` to change only its attributes. You saw `directory`, `link` and `absent` above. Its `owner`, `group` and `mode` options also exist on `copy` and `template`.

Always quote modes. YAML reads `644` as the decimal number 644, which is not `rw-r--r--`:

```yaml
---
- name: File modes
  hosts: web1
  gather_facts: false

  tasks:
    - name: Quoted mode, as intended
      ansible.builtin.file:
        path: /tmp/mode-demo-quoted
        state: touch
        mode: '0644'

    - name: Unquoted mode without the leading zero
      ansible.builtin.file:
        path: /tmp/mode-demo-unquoted
        state: touch
        mode: 644
```

```terminal
{
  "title": "\"0644\" and 644 are different modes",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-playbook modes.yml"
    },
    {
      "cmd": "ansible web1 -a \"ls -l /tmp/mode-demo-quoted /tmp/mode-demo-unquoted\"",
      "output": "web1 | CHANGED | rc=0 >>\n-rw-r--r-- 1 ubuntu ubuntu 0 Oct 24 03:45 /tmp/mode-demo-quoted\n--w----r-T 1 ubuntu ubuntu 0 Oct 24 03:46 /tmp/mode-demo-unquoted"
    }
  ]
}
```

Decimal 644 is octal 1204: write permission for the owner only, read for others, and the sticky bit. `ansible-lint` reports unquoted modes with its `risky-octal` rule. You can also write modes symbolically: `mode: "u=rw,g=r,o=r"`. Delete `modes.yml` and the two test files (`ansible web1 -m ansible.builtin.shell -a "rm -f /tmp/mode-demo-*"`) before you continue.

## Edit Lines in Files You Do Not Own

`lineinfile` makes sure one line is present, and replaces the line that matches `regexp` if there is one. `blockinfile` does the same for a block of lines between two marker comments, so it can find and update its own block later:

```yaml
- name: Set the kernel's swappiness
  ansible.builtin.lineinfile:
    path: /etc/sysctl.d/99-webfleet.conf
    regexp: '^vm\.swappiness'
    line: vm.swappiness = 10
    create: true
    mode: '0644'

- name: Add the lab hosts to /etc/hosts
  ansible.builtin.blockinfile:
    path: /etc/hosts
    marker: '# {mark} webfleet hosts (managed by Ansible)'
    block: |
      192.168.56.11 web1
      192.168.56.12 web2
```

Prefer a whole file in a `.d` directory, when the software supports one (as `sysctl.d`, `sudoers.d`, `sshd_config.d` and nginx's `conf.d` do), over editing lines in the main file. A whole file is easier to read, to test and to remove.

## Validate Files Before They Replace the Old Ones

`template`, `copy`, `lineinfile` and `blockinfile` take a `validate` option: a command that checks the new file, with `%s` as its path, before Ansible moves it into place. If the check fails, the old file stays. This matters most for files that can lock you out, such as `sudoers`, where a syntax error disables `sudo` for everyone. Here is a sudoers rule that lets a deploy group reload nginx, with a deliberate typo (a missing `:` after `NOPASSWD`):

```yaml
---
- name: Validate before replacing
  hosts: web1
  become: true

  tasks:
    - name: Let the deploy group reload nginx
      ansible.builtin.copy:
        content: "%webfleet-deploy ALL=(root) NOPASSWD /usr/bin/systemctl reload nginx\n"
        dest: /etc/sudoers.d/webfleet
        owner: root
        group: root
        mode: '0440'
        validate: /usr/sbin/visudo -cf %s
```

```bash
ansible-playbook sudoers.yml
```

The `fatal` line, cut after 400 characters:

```text
fatal: [web1]: FAILED! => {"changed": false, "checksum": "be3a7f2364719958191d83cd893d2ead6b183261", "exit_status": 1, "msg": "failed to validate", "stderr": "/home/ubuntu/.ansible/tmp/ansible-tmp-1792813575.2778404-879-81323113946663/.source:1:69: syntax error\n%webfleet-deploy ALL=(root) NOPASSWD /usr/bin/systemctl reload nginx\n
```

`visudo` rejected the file, so it never reached `/etc/sudoers.d/` and `sudo` keeps working. Add the missing `:` and the task passes:

```bash
ansible-playbook sudoers.yml
```

```text
ok: [web1]
changed: [web1]
```

The rule was only a demonstration. Remove it from `web1` and delete the playbook:

```bash
ansible web1 -b -m ansible.builtin.file -a "path=/etc/sudoers.d/webfleet state=absent"
rm sudoers.yml
```

Other validators: `nginx -t -c %s` for a complete `nginx.conf`, `/usr/sbin/sshd -t -f %s` for `sshd_config`, `named-checkconf %s`, `python3 -m json.tool %s`. A validator has to accept the file on its own, so it does not work for fragments that only make sense inside another file; for those, test the whole configuration in a handler as in [Part 6](/guides/introduction-to-ansible/06-handlers-and-notifications#h2-test-the-configuration-before-reloading).

## Common Mistakes

- **Unquoted file modes.** Write `"0644"`.
- **Timestamps and random values in templates.** They make every run report `changed`.
- **Editing a file with many `lineinfile` tasks.** Template the whole file, or use a `.d` drop-in.
- **No `validate` on critical files.** One typo in `sudoers` or `sshd_config` can lock you out.
- **Logic-heavy templates.** Prepare data in variables or with filters, and keep templates close to the file they produce.

## Summary

- `template` renders Jinja2 per host; `copy` copies files unchanged; `file` manages directories, links, permissions and deletion.
- Keep templates in `templates/`, mark generated files with `ansible_managed`, and keep them idempotent.
- `--diff`, with or without `--check`, shows the exact change to each file on each host.
- `lineinfile` and `blockinfile` are for files you share with others; prefer whole files in `.d` directories.
- `validate` tests a new file before it replaces the old one.

In [Part 8](/guides/introduction-to-ansible/08-roles-and-organization) you turn `web.yml` into a reusable role, add a baseline role that uses a community collection, and organize the project the way larger teams do.

## Keep Learning

- [How to change permissions for folders, subfolders and files in Linux](/posts/change-permissions-folder-subfolders-files-linux)
- [Hash rings in nginx, HAProxy and Envoy](/posts/hash-ring-points-nginx-haproxy-envoy), for when the fleet grows behind a load balancer
