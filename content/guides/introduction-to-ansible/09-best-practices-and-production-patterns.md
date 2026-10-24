---
title: 'Ansible Best Practices: Vault, Linting, Testing and CI'
description: 'Keep secrets in Ansible Vault, roll out changes a few hosts at a time, speed up runs, lint with ansible-lint, test roles and run every change through CI.'
order: 9
---

A playbook that works on your laptop is the start. A team needs more: secrets that are not in plain text in Git, changes that cannot take down every server at once, runs that stay fast as the fleet grows, and a pipeline that checks every change before it reaches a server. This part adds each of those to the `webfleet` project.

## Prerequisites

- The `~/webfleet` project with the `baseline` and `webserver` roles and `site.yml` from [Part 8](/guides/introduction-to-ansible/08-roles-and-organization).

## Keep Secrets in Ansible Vault

The site gets a status page at `/status`, protected with a user name and password. The password is a secret: it must not be in Git in plain text, but Ansible needs it to create the password file on the servers. **Ansible Vault** encrypts files or single values with AES-256, and Ansible decrypts them in memory during a run.

### Add the status page to the role

The `webserver` role gets two new inputs. The user name has a default; the password has none and is required, so a forgotten password stops the run instead of creating an empty one. Add them to `roles/webserver/defaults/main.yml`:

```yaml
---
# Team named on the home page
webserver_owner: Unknown team
# Port nginx listens on
webserver_port: 80
# User for the /status page; set webserver_status_password too
webserver_status_user: ops
```

and to `roles/webserver/meta/argument_specs.yml`. `no_log: true` keeps the value out of the output if the check fails:

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
      webserver_status_user:
        type: str
        default: ops
        description: User for the /status page.
      webserver_status_password:
        type: str
        required: true
        no_log: true
        description: Password for the /status page.
```

The password file is created with `community.general.htpasswd`, which needs the `passlib` Python library on the server. Install it together with nginx, and add the new task before `Configure the site` in `roles/webserver/tasks/main.yml`:

```yaml
- name: Install nginx and passlib
  ansible.builtin.apt:
    name:
      - nginx
      - python3-passlib # needed by community.general.htpasswd
    state: present
    update_cache: true
    cache_valid_time: 3600
  tags: packages

# ...

- name: Create the status page user
  community.general.htpasswd:
    path: /etc/nginx/webfleet.htpasswd
    name: '{{ webserver_status_user }}'
    password: '{{ webserver_status_password }}'
    owner: root
    group: www-data
    mode: '0640'
```

The module compares the password with the hash already in the file, so it only reports `changed` when the password really changes. Finally, add the location to `roles/webserver/templates/webfleet.conf.j2`, inside the `server` block. `stub_status` prints nginx's connection counters:

```nginx
    location = /status {
        stub_status;
        auth_basic "webfleet status";
        auth_basic_user_file /etc/nginx/webfleet.htpasswd;
    }
```

### Encrypt the password

Vault needs a password of its own. Generate a long random one and keep it outside the project, readable only by you. In a team, store it in your password manager and share it through that, never through Git:

```terminal
{
  "title": "a vault password",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "openssl rand -base64 32 > ~/.webfleet-vault-pass && chmod 600 ~/.webfleet-vault-pass"
    },
    {
      "cmd": "export ANSIBLE_VAULT_PASSWORD_FILE=~/.webfleet-vault-pass"
    }
  ]
}
```

`ANSIBLE_VAULT_PASSWORD_FILE` tells every Ansible command where the password is, so you do not type it each time. Add the `export` line to your `~/.bashrc`. Use `--ask-vault-pass` instead if you prefer to type it.

Group variables can be a directory instead of a file, and Ansible merges every file in it. Turn `inventory/group_vars/web.yml` into `inventory/group_vars/web/vars.yml`, and put the secret in `inventory/group_vars/web/vault.yml` next to it:

```bash
mkdir inventory/group_vars/web
mv inventory/group_vars/web.yml inventory/group_vars/web/vars.yml
```

```yaml
---
webserver_owner: Platform team
webserver_port: 80
baseline_firewall_ports: # read by the baseline role
  - '22'
  - '80' # keep in sync with webserver_port
webserver_status_password: '{{ vault_webserver_status_password }}'
```

```yaml
---
vault_webserver_status_password: lab-status-7Kp2
```

The convention is to prefix encrypted variables with `vault_` and map them to normal names in the unencrypted file. That way `grep webserver_status_password` still finds where the value comes from, without decrypting anything. Now encrypt the file:

```terminal
{
  "title": "encrypt, inspect and read the vault file",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-vault encrypt inventory/group_vars/web/vault.yml"
    },
    {
      "comment": "what Git sees",
      "cmd": "head -n 3 inventory/group_vars/web/vault.yml",
      "output": "$ANSIBLE_VAULT;1.1;AES256\n38366466363338663437373938393832346339643963363538346235373863326534306438313734\n6237333661646336373535333130313263666466663937340a656630343430633939663030646363"
    },
    {
      "comment": "what you see with the vault password",
      "cmd": "ansible-vault view inventory/group_vars/web/vault.yml",
      "output": "---\nvault_webserver_status_password: lab-status-7Kp2"
    }
  ]
}
```

Change it later with `ansible-vault edit`, which decrypts into a temporary file, opens your editor, and encrypts again. `ansible-vault rekey` changes the vault password.

### Run with the secret

Ansible decrypts the vault file in memory when it loads the inventory. To keep the output short, this run hides the tasks that reported `ok`, with the `display_ok_hosts` setting of the default output callback:

```bash
ANSIBLE_DISPLAY_OK_HOSTS=false ansible-playbook site.yml --limit web1
```

```text
PLAY [Apply the baseline to every server] **************************************
PLAY [Set up the web servers] **************************************************
TASK [webserver : Install nginx and passlib] ***********************************
changed: [web1]
TASK [webserver : Create the status page user] *********************************
changed: [web1]
TASK [webserver : Configure the site] ******************************************
changed: [web1]
RUNNING HANDLER [webserver : Reload nginx] *************************************
changed: [web1]
PLAY RECAP *********************************************************************
web1                       : ok=22   changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

```terminal
{
  "title": "the status page",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "without the password",
      "cmd": "curl -s -o /dev/null -w '%{http_code}\\n' http://192.168.56.11/status",
      "output": "401"
    },
    {
      "cmd": "curl -s -u ops:lab-status-7Kp2 http://192.168.56.11/status",
      "output": "Active connections: 1\nserver accepts handled requests\n 21 21 21\nReading: 0 Writing: 1 Waiting: 0"
    }
  ]
}
```

:::warning
Basic authentication sends the user name and password with every request, only Base64-encoded. Over plain HTTP, anyone on the network path can read them. That is acceptable on this private lab network and nowhere else: on real servers, serve `/status` only over HTTPS, or limit it to your admin addresses with nginx's `allow` and `deny` and reach it through an SSH tunnel.
:::

You can also encrypt single values instead of whole files, with `ansible-vault encrypt_string`, and paste the result into any YAML file:

```bash
ansible-vault encrypt_string --name db_password 'example-only'
```

```text
db_password: !vault |
          $ANSIBLE_VAULT;1.1;AES256
          38383166623633333162376462353431363839376263336436373334356539366539383230663532
          3961316134306163383230663861346661353638333266650a356136653332326665303561613866
          64613736613061373937376532313331383466343038653666343236393237386664623436663864
          3961666436613835310a323632613930653239643365643839343634633930383631613964396165
          6530
```

Whole encrypted files are easier to review and to rekey; encrypted values keep the variable names readable. Pick one style per project.

### Vault or a secret manager?

Vault keeps secrets next to the code, encrypted with one shared password. That fits small teams and a handful of secrets. It does not give you rotation, per-person access or an audit log of who read what, and anyone who has the vault password can read every secret in the file. When you need those, keep secrets in a secret manager and read them during the run with a lookup plugin:

```yaml
# HashiCorp Vault (community.hashi_vault collection)
webserver_status_password: "{{ lookup('community.hashi_vault.vault_kv2_get', 'webfleet/status', engine_mount_point='secret').secret.password }}"

# AWS Secrets Manager (amazon.aws collection)
webserver_status_password: "{{ lookup('amazon.aws.secretsmanager_secret', 'webfleet/status-password') }}"
```

Either way, add `no_log: true` to tasks that print secrets in their results, such as a `uri` call with a token in its body. Starting with ansible-core 2.22, Ansible also masks known secret values, such as decrypted vault content, in its output.

## Rolling Updates

`site.yml` runs each task on both web servers at once. For a change that could break the site, that means both servers break together. The `serial` keyword runs the whole play on a few hosts at a time: all tasks, the handlers and the `post_tasks` check, before the next batch starts. Add it to the web play in `site.yml`:

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
  serial: 1 # one host at a time; also accepts a percentage or a list such as [1, "50%"]
  max_fail_percentage: 0 # stop the rollout at the first failed host
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

```bash
ansible-playbook site.yml
```

```text
PLAY [Apply the baseline to every server] **************************************
PLAY [Set up the web servers] **************************************************
TASK [Check that the page names the host] **************************************
PLAY [Set up the web servers] **************************************************
TASK [Check that the page names the host] **************************************
PLAY RECAP *********************************************************************
web1                       : ok=20   changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
web2                       : ok=22   changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

The web play now runs twice, once per host, and `web2` is only touched after `web1` passed its check. With `max_fail_percentage: 0`, a failure on `web1` would have stopped the rollout before `web2`. `serial` takes the hosts in inventory order, so it does not know that `web2` is the canary. To start with the canary, run it on its own first (`ansible-playbook site.yml --limit web2`), check the result, then run the playbook for everyone. Behind a load balancer you would also take each host out of the pool first and put it back after the check, with tasks delegated to the load balancer:

```yaml
pre_tasks:
  - name: Take the host out of the load balancer
    ansible.builtin.uri:
      url: 'https://lb.example.com/api/pools/web/members/{{ inventory_hostname }}/disable'
      method: POST
    delegate_to: localhost
    become: false
```

Two more keywords help with ordered changes: `run_once: true` runs a task on one host of the batch (for example a database migration), and `any_errors_fatal: true` stops all hosts as soon as one fails.

## Make Runs Faster

Most of a run's time is SSH round trips. Three settings matter most:

- **`forks`** (default 5): how many hosts Ansible works on in parallel. Raise it to 20 or 50 for larger fleets, as far as your control node's CPU and memory allow.
- **Pipelining**: sends the module through the existing SSH session's standard input instead of copying a file first, which saves round trips for every task. It needs `requiretty` to be off in `sudoers`, which is the default on current distributions.
- **Fact gathering**: skip it with `gather_facts: false` where a play does not use facts, or limit it with `gather_subset`. For many runs per hour, cache facts between runs, so that a play gathers them only when the cache has none:

```ini
[defaults]
gathering = smart
fact_caching = jsonfile
fact_caching_connection = .cache/facts
fact_caching_timeout = 3600
```

Measure before you tune. Here is the same no-change run of `site.yml`, from cold SSH connections, without and with pipelining:

```terminal
{
  "title": "the same run, without and with pipelining",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "time ANSIBLE_PIPELINING=False ansible-playbook site.yml > /dev/null",
      "output": "real\t2m10.970s"
    },
    {
      "cmd": "time ANSIBLE_PIPELINING=True ansible-playbook site.yml > /dev/null",
      "output": "real\t2m4.711s"
    }
  ]
}
```

These are two small VMs on one machine, so take the numbers as an illustration; the saving grows with the number of tasks and with network latency. To see which tasks take the time, enable the `profile_tasks` callback from the `ansible.posix` collection for one run:

```bash
ANSIBLE_CALLBACKS_ENABLED=ansible.posix.profile_tasks ansible-playbook site.yml
```

The eight slowest tasks, from the end of the output:

```text
webserver : Install nginx and passlib ---------------------------------- 40.48s
baseline : Install the firewall ---------------------------------------- 17.96s
baseline : Allow the listed ports --------------------------------------- 7.25s
webserver : Configure the site ------------------------------------------ 5.89s
webserver : Publish the home page --------------------------------------- 5.36s
webserver : Add security headers ---------------------------------------- 5.30s
webserver : Hide the nginx version in responses ------------------------- 5.29s
webserver : Start nginx and enable it at boot --------------------------- 5.21s
```

The two package tasks take the longest, which is typical: `apt` reads its package database on every run, and refreshes the package lists when they are older than `cache_valid_time`. Every other task costs about five seconds on these small VMs, mostly for starting Python on the host, so on a fleet like this the number of tasks matters more than any single one. Put the settings that help in `ansible.cfg`:

```ini
[defaults]
inventory = inventory/hosts.yml
roles_path = roles
collections_path = collections
forks = 20

[ssh_connection]
pipelining = True
```

## Lint with ansible-lint

`ansible-lint` checks playbooks and roles against a few hundred rules for syntax, deprecated features, risky patterns and style. Install it next to Ansible:

```terminal
{
  "title": "install ansible-lint",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "pipx install ansible-lint==26.10.1",
      "output": "  installed package ansible-lint 26.10.1, installed using Python 3.12.3\n  These apps are now globally available\n    - ansible-lint"
    },
    {
      "cmd": "ansible-lint --version",
      "output": "ansible-lint 26.10.1 using ansible-core:2.21.5 ansible-compat:26.10.0 ruamel-yaml:0.19.1"
    }
  ]
}
```

Rules are grouped into **profiles**, from `min` (only what breaks) through `basic`, `moderate`, `safety` and `shared` to `production`, the strictest. Set the project's profile and the paths to skip in `.ansible-lint` at the top of the project:

```yaml
---
profile: production
exclude_paths:
  - collections/
  - .cache/
```

Then run it from the project directory. With no arguments, it lints every playbook, role and variable file it finds:

```bash
ansible-lint
```

```text
Passed: 0 failure(s), 0 warning(s) in 19 files processed of 21 encountered. Profile 'production' was required, and it passed.
```

The project passes. For comparison, here is what it reports for a short playbook written the way many older tutorials do. Save it as `bad.yml` in the project:

```yaml
- hosts: web
  become: yes
  tasks:
    - apt: name=nginx state=latest
    - name: copy the config
      copy:
        src: nginx.conf
        dest: /etc/nginx/nginx.conf
        mode: 644
    - name: restart nginx
      shell: systemctl restart nginx
```

```bash
ansible-lint bad.yml
```

```text
WARNING  Listing 14 violation(s) that are fatal
name[play]: All plays should be named.
bad.yml:1:3
yaml[truthy]: Truthy value should be one of [false, true]
bad.yml:2
fqcn[action-core]: Use FQCN for builtin module actions (apt).
bad.yml:4:7 Use `ansible.builtin.apt` or `ansible.legacy.apt` instead.
name[missing]: All tasks should be named.
bad.yml:4 Task/Handler: apt name=nginx state=latest
no-free-form: Avoid using free-form when calling module actions. (apt)
bad.yml:4 apt
package-latest: Package installs should not use latest.
bad.yml:4 Task/Handler: apt name=nginx state=latest
name[casing]: All names should start with an uppercase letter.
bad.yml:5:13 Task/Handler: copy the config
risky-octal: `mode: 644` should have a string value with leading zero `mode: "01204"` or use symbolic mode.
bad.yml:5 Task/Handler: copy the config
fqcn[action-core]: Use FQCN for builtin module actions (copy).
bad.yml:6:7 Use `ansible.builtin.copy` or `ansible.legacy.copy` instead.
command-instead-of-module: systemctl used in place of systemd module
bad.yml:10 Task/Handler: restart nginx
command-instead-of-shell: Use shell only when shell functionality is required.
bad.yml:10 Task/Handler: restart nginx
name[casing]: All names should start with an uppercase letter.
bad.yml:10:13 Task/Handler: restart nginx
no-changed-when: Commands should not change things if nothing needs doing.
bad.yml:10 Task/Handler: restart nginx
fqcn[action-core]: Use FQCN for builtin module actions (shell).
bad.yml:11:7 Use `ansible.builtin.shell` or `ansible.legacy.shell` instead.
Read documentation for instructions on how to ignore specific rule violations.
# Rule Violation Summary
  1 command-instead-of-module profile:basic tags:command-shell,idiom
  1 command-instead-of-shell profile:basic tags:command-shell,idiom
  1 no-free-form profile:basic tags:syntax,risk
  1 name profile:basic tags:idiom
  1 name profile:basic tags:idiom
  1 yaml profile:basic tags:formatting,yaml
  2 name profile:basic tags:idiom
  1 package-latest profile:basic tags:idempotency
  1 risky-octal profile:basic tags:formatting
  1 no-changed-when profile:basic tags:command-shell,idempotency
  3 fqcn profile:basic tags:formatting
Failed: 14 failure(s), 0 warning(s) in 1 files processed of 1 encountered. Profile 'production' was required, but 'min' profile passed.
```

Delete `bad.yml` again (`rm bad.yml`): the CI pipeline below lints the whole project, and this file would fail it. Each finding names the rule, the line, and usually the fix. The summary line says which profile the file meets: this one passes only `min`, far from the `production` profile the project requires. Run `ansible-lint` locally before you push, and in CI on every pull request. To skip a rule for one line, add a `# noqa: <rule>` comment with a reason next to it; to skip it everywhere, list it under `skip_list` in `.ansible-lint`. Treat both as exceptions you can explain in a review.

## Test Roles with Molecule

`ansible-lint` reads code; it cannot tell you whether the role works. **Molecule** runs a role against a disposable test instance, usually a container, and runs it twice to prove it is idempotent. A scenario lives in the role, in `molecule/default/`, and current Molecule versions describe the test instances with a normal Ansible inventory:

```yaml
# roles/webserver/molecule/default/molecule.yml
---
ansible:
  cfg:
    defaults:
      roles_path: ${MOLECULE_PROJECT_DIRECTORY}/../
  executor:
    args:
      ansible_playbook:
        - --inventory=inventory/
dependency:
  name: galaxy
  options:
    requirements-file: ${MOLECULE_SCENARIO_DIRECTORY}/requirements.yml
scenario:
  test_sequence:
    - dependency
    - destroy
    - create
    - converge
    - idempotence
    - verify
    - destroy
```

The instances are hosts in an inventory under `molecule/default/inventory/`, for example a Podman container with `ansible_connection: containers.podman.podman`. Put them in a group named `web` as well (for example, make the `molecule` group a child of `web`), because the role's home page template lists `groups['web']`. Choose the image with care: it must contain Python, and because the `webserver` role starts nginx through systemd, it must also run systemd as its first process, so use an image built for testing Ansible roles, or virtual machines. Next to the inventory go `create.yml` and `destroy.yml`, which start and remove the instances (the [Molecule documentation](https://docs.ansible.com/projects/molecule/) has complete versions for Podman and Docker), and the two playbooks that do the testing:

```yaml
# roles/webserver/molecule/default/converge.yml
---
- name: Converge
  hosts: molecule
  become: true
  tasks:
    - name: Apply the role under test
      ansible.builtin.include_role:
        name: webserver
      vars:
        webserver_owner: Test team
        webserver_status_password: test-only
```

```yaml
# roles/webserver/molecule/default/verify.yml
---
- name: Verify
  hosts: molecule
  gather_facts: false
  tasks:
    - name: Fetch the home page inside the instance
      ansible.builtin.uri:
        url: http://localhost/
        return_content: true
      register: home_page

    - name: Check that the page shows the owner
      ansible.builtin.assert:
        that: "'Test team' in home_page.content"
```

`molecule test` runs the whole sequence, and the `idempotence` step fails if the second converge reports any change. This guide's lab has no container engine, so it shows the configuration without a run.

## Run Every Change Through CI

Put the project in Git, and let a pipeline check every pull request and run the playbook from `main`. This GitHub Actions workflow lints on every change and deploys on pushes to `main`:

```yaml
---
name: ansible

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: '3.13'
      - name: Install Ansible and ansible-lint
        run: pip install ansible-core==2.21.5 ansible-lint==26.10.1
      - name: Install collections
        run: ansible-galaxy collection install -r requirements.yml
      - name: Lint
        run: ansible-lint
      - name: Check the playbook syntax
        run: ansible-playbook site.yml --syntax-check

  deploy:
    needs: lint
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    # a runner that can reach the servers over SSH
    runs-on: [self-hosted, webfleet]
    environment: production
    concurrency: production
    steps:
      - uses: actions/checkout@v7
      - name: Install collections
        run: ansible-galaxy collection install -r requirements.yml
      - name: Write the SSH key, known hosts and vault password
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
          VAULT_PASSWORD: ${{ secrets.ANSIBLE_VAULT_PASSWORD }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$KNOWN_HOSTS" > ~/.ssh/known_hosts
          printf '%s' "$VAULT_PASSWORD" > "$RUNNER_TEMP/vault-pass"
          chmod 600 "$RUNNER_TEMP/vault-pass"
      - name: Deploy
        env:
          ANSIBLE_VAULT_PASSWORD_FILE: ${{ runner.temp }}/vault-pass
        run: ansible-playbook site.yml --diff
      - name: Remove the credentials
        if: always()
        run: rm -f ~/.ssh/id_ed25519 "$RUNNER_TEMP/vault-pass"
```

Notes on the choices:

- The **lint** job needs no secrets, so it also runs safely on pull requests from forks.
- The **deploy** job runs on a self-hosted runner because GitHub's hosted runners cannot reach private servers. The `production` environment lets you require an approval before it runs, and `concurrency` stops two deployments from overlapping.
- The host keys come from a secret too, so the job never has to trust a key on first use.
- The self-hosted runner has Ansible installed already. On a hosted runner, add the same install step as in the lint job.

The pipeline works from a Git repository, so put the project into one if it is not there yet, and keep installed collections and caches out of it with a `.gitignore`:

```text
collections/
.cache/
```

```bash
git init -b main
```

```text
Initialized empty Git repository in /home/dev/webfleet/.git/
```

Then commit and push as usual. [actionlint](https://github.com/rhysd/actionlint) checks the workflow file itself:

```bash
actionlint .github/workflows/ansible.yml
```

```text
.github/workflows/ansible.yml:33:28: label "webfleet" is unknown. available labels are "windows-latest", "windows-latest-8-cores", "windows-2025", "windows-2025-vs2026", "windows-2022", "windows-11-arm", "ubuntu-slim", "ubuntu-latest", "ubuntu-latest-4-cores", "ubuntu-latest-8-cores", "ubuntu-latest-16-cores", "ubuntu-24.04", "ubuntu-24.04-arm", "ubuntu-22.04", "ubuntu-22.04-arm", "macos-latest", "macos-latest-xlarge", "macos-latest-large", "macos-26-intel", "macos-26-xlarge", "macos-26-large", "macos-26", "macos-15-intel", "macos-15-xlarge", "macos-15-large", "macos-15", "macos-14-xlarge", "macos-14-large", "macos-14", "self-hosted", "x64", "arm", "arm64", "linux", "macos", "windows". if it is a custom label for self-hosted runner, set list of labels in actionlint.yaml config file [runner-label]
   |
33 |     runs-on: [self-hosted, webfleet]
   |                            ^~~~~~~~~
```

It does not know the `webfleet` label of the self-hosted runner. Declare custom runner labels in `.github/actionlint.yaml`:

```yaml
---
self-hosted-runner:
  labels:
    - webfleet
```

```bash
actionlint .github/workflows/ansible.yml; echo "exit code: $?"
```

```text
exit code: 0
```

No output and exit code 0 mean no problems. Add actionlint to the lint job if you change workflows often.

To catch **drift**, changes someone made by hand on a server, schedule a second workflow that runs `ansible-playbook site.yml --check --diff` every night and alerts when the recap shows `changed` for any host.

## Common Mistakes

- **Secrets in plain text in Git**, even "temporarily". Encrypt them before the first commit; Git keeps history.
- **The vault password in the repository**, or in `ansible.cfg` that points at a file in the repository.
- **Changing all hosts at once.** Use `serial` with a health check in `post_tasks` for anything that restarts a service.
- **Running playbooks from laptops for production.** Run them from CI or an automation platform, so there is one place, one version of the code, and a log.
- **Silencing lint rules without a reason.** Every `noqa` should say why.

## Summary

- Encrypt secrets with Ansible Vault, prefix them with `vault_`, keep the vault password outside the repository, and move to a secret manager when you need rotation and auditing.
- `serial` and `max_fail_percentage` turn a run into a rolling update with a check after each batch.
- Raise `forks`, enable pipelining and skip unneeded facts; measure with `profile_tasks`.
- `ansible-lint` with the `production` profile catches deprecated and risky code; Molecule tests that a role converges and is idempotent.
- A CI pipeline lints every change and deploys from `main`, with credentials only in the deploy job.

In [Part 10](/guides/introduction-to-ansible/10-advanced-features-and-next-steps), the last part, you write a dynamic inventory, a custom module and a filter plugin, build an execution environment, and see where Ansible Automation Platform, AWX and Terraform fit.

## Keep Learning

- [HashiCorp Vault secrets management checklist](/checklists/hashicorp-vault-secrets-management)
- [Secrets management guide](/posts/secrets-management-guide)
- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup)
- [Your Automation Platform Is a Credential Honeypot](/posts/ansible-automation-platform-credential-leak-cve-2026-11807), on what an Ansible control plane holds
