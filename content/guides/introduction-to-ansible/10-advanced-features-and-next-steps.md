---
title: 'Advanced Ansible: Dynamic Inventory, Plugins and Next Steps'
description: 'Build dynamic inventories, write a custom module and filter plugin, change the output format, build execution environments, and see where AAP and AWX fit.'
order: 10
---

You can now build and run a real Ansible project. This last part covers the features you reach for when the basics are not enough: inventories that come from an API instead of a file, your own modules and filters, other output formats, and execution environments that package Ansible with its dependencies. It ends with the tools around Ansible, such as Ansible Automation Platform, AWX and Terraform, and with what to learn next.

## Prerequisites

- The `~/webfleet` project from [Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns), with the roles, the vault file and `ANSIBLE_VAULT_PASSWORD_FILE` set.

## Dynamic Inventories

A static `hosts.yml` is fine while servers are long-lived. When autoscaling groups, Terraform runs or a CMDB create and remove servers, the inventory has to come from the source of truth at run time. Ansible does that with **inventory plugins**: you write a small YAML file that names the plugin and its options, and pass that file wherever you would pass an inventory.

### Build groups from variables: constructed

The built-in `ansible.builtin.constructed` plugin adds groups and variables on top of another inventory, using expressions. Save this as `inventory/groups.constructed.yml`:

```yaml
---
plugin: ansible.builtin.constructed
strict: true
use_vars_plugins: true # also see group_vars and host_vars
groups:
  canary: "'canary' in webserver_owner"
keyed_groups:
  - key: webserver_port | string # group names are built from strings
    prefix: port
```

Pass both sources; Ansible reads them in order, so the constructed file sees the hosts from `hosts.yml`:

```bash
ansible-inventory -i inventory/hosts.yml -i inventory/groups.constructed.yml --graph
```

```text
@all:
  |--@ungrouped:
  |--@web:
  |  |--web1
  |  |--web2
  |--@production:
  |  |--@web:
  |  |  |--web1
  |  |  |--web2
  |--@port_80:
  |  |--web1
  |  |--web2
  |--@canary:
  |  |--web2
```

The new `canary` group follows the data: give another host an owner with "canary" in it, and it joins the group without anyone editing a group list. The `| string` matters: since ansible-core 2.19, values keep their types, and a `keyed_groups` key that is a number stops the plugin with `Invalid group name format`. Cloud inventory plugins have the same `groups`, `keyed_groups` and `compose` options.

### From a cloud API

Every major cloud has an inventory plugin in its collection: `amazon.aws.aws_ec2`, `azure.azcollection.azure_rm`, `google.cloud.gcp_compute`, `digitalocean.cloud.droplets` and more. This file, for example `inventory/do.droplets.yml`, lists every Droplet in a DigitalOcean account, uses the public IPv4 address to connect, and groups the Droplets by region and image:

```yaml
---
plugin: digitalocean.cloud.droplets
# the API token comes from the DIGITALOCEAN_TOKEN environment variable
attributes:
  - networks
  - region
  - image
compose:
  ansible_host: networks.v4 | selectattr("type", "eq", "public") | map(attribute="ip_address") | first
keyed_groups:
  - key: region.slug
    prefix: region
  - key: image.slug | default("custom", true)
    prefix: image
```

Install the collection and the `pydo` library it uses first (`ansible-galaxy collection install digitalocean.cloud`, and with a pipx install, `pipx inject ansible-core pydo`), then use the file like any inventory: `ansible-inventory -i inventory/do.droplets.yml --graph`. Most cloud plugins also support `cache: true`, so that repeated runs do not call the API every time.

### Your own source: an inventory script

When no plugin exists for your source, the simplest option is an executable that prints JSON. Ansible runs it with `--list` and expects groups, hosts and a `_meta.hostvars` section. This script reads a file exported from a CMDB. Save the export as `examples/cmdb.json`:

```json
[
  { "name": "app1", "ip": "10.0.1.21", "role": "app", "env": "staging" },
  { "name": "app2", "ip": "10.0.1.22", "role": "app", "env": "production" },
  { "name": "db1", "ip": "10.0.2.31", "role": "db", "env": "production" }
]
```

and the script next to it as `examples/cmdb_inventory.py`:

```python
#!/usr/bin/env python3
"""Ansible inventory from a CMDB export: groups by role and by environment."""
import json
import pathlib
import sys

SOURCE = pathlib.Path(__file__).with_name("cmdb.json")

def build():
    inventory = {"_meta": {"hostvars": {}}}
    for server in json.loads(SOURCE.read_text()):
        for group in (server["role"], server["env"]):
            inventory.setdefault(group, {"hosts": []})["hosts"].append(server["name"])
        inventory["_meta"]["hostvars"][server["name"]] = {"ansible_host": server["ip"]}
    return inventory

if __name__ == "__main__":
    if sys.argv[1:] == ["--list"]:
        print(json.dumps(build()))
    elif sys.argv[1:2] == ["--host"]:
        print(json.dumps({}))  # all host variables are in _meta already
    else:
        sys.exit("usage: cmdb_inventory.py --list | --host <name>")
```

Ansible runs a script only if it is executable:

```terminal
{
  "title": "an inventory script",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "chmod +x examples/cmdb_inventory.py"
    },
    {
      "cmd": "ansible-inventory -i examples/cmdb_inventory.py --graph",
      "output": "@all:\n  |--@ungrouped:\n  |--@app:\n  |  |--app1\n  |  |--app2\n  |--@staging:\n  |  |--app1\n  |--@production:\n  |  |--app2\n  |  |--db1\n  |--@db:\n  |  |--db1"
    }
  ]
}
```

For anything larger, write an inventory plugin in Python instead, which gets caching, `constructed`-style options and a YAML configuration file for free. The `examples/` directory was only a demonstration; delete it with `rm -r examples`.

## Write a Custom Module

When no module does what you need and `command` would not be idempotent, write a module. A module is a Python script that reads its options, does its job, and prints JSON. Put it in a `library/` directory next to your playbook (or in a role's `library/`), and Ansible finds it. This one records the deployed release in a JSON file on each server, and reports a change only when the release differs:

```python
#!/usr/bin/python
"""Ansible module: record the deployed release in a JSON file."""

DOCUMENTATION = r"""
module: release_marker
short_description: Record the deployed release in a JSON file
description:
  - Writes the release version and channel to a JSON file, and reports a change only when they differ.
options:
  version:
    description: Release version.
    type: str
    required: true
  channel:
    description: Release channel.
    type: str
    default: stable
    choices: [stable, canary]
  path:
    description: File to write.
    type: path
    default: /etc/webfleet/release.json
author: webfleet team
"""

EXAMPLES = r"""
- name: Record the release
  release_marker:
    version: 1.4.2
"""

RETURN = r"""
release:
  description: The release that is now recorded.
  returned: always
  type: dict
"""

import json
import os
import tempfile

from ansible.module_utils.basic import AnsibleModule

def main():
    module = AnsibleModule(
        argument_spec=dict(
            version=dict(type="str", required=True),
            channel=dict(type="str", default="stable", choices=["stable", "canary"]),
            path=dict(type="path", default="/etc/webfleet/release.json"),
        ),
        supports_check_mode=True,
    )
    path = os.path.abspath(module.params["path"])
    wanted = {"version": module.params["version"], "channel": module.params["channel"]}

    current = None
    if os.path.exists(path):
        with open(path) as f:
            try:
                current = json.load(f)
            except ValueError:
                current = None

    result = {"changed": current != wanted, "path": path, "release": wanted}
    if module._diff:
        result["diff"] = {
            "before": json.dumps(current, indent=2, sort_keys=True) + "\n" if current else "",
            "after": json.dumps(wanted, indent=2, sort_keys=True) + "\n",
        }

    if result["changed"] and not module.check_mode:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # a new, unique temporary file in the same directory, then an atomic rename
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".release_marker.")
        with os.fdopen(fd, "w") as f:
            json.dump(wanted, f, indent=2, sort_keys=True)
            f.write("\n")
        module.atomic_move(tmp, path)

    module.exit_json(**result)

if __name__ == "__main__":
    main()
```

The parts every module has:

- `DOCUMENTATION`, `EXAMPLES` and `RETURN` in YAML, which `ansible-doc` reads.
- `AnsibleModule` with an `argument_spec`, which checks types, defaults and choices before your code runs.
- `supports_check_mode=True`, honored by computing `changed` first and skipping the write in check mode.
- `module.exit_json()` on success or `module.fail_json(msg=...)` on failure. Since ansible-core 2.19, an unexpected Python exception also comes back as a normal failed result with the traceback, so you do not need a `try`/`except` around everything.

`ansible-doc` shows the documentation of the local module:

```bash
ansible-doc -M library release_marker
```

```text
> MODULE release_marker (/home/dev/webfleet/library/release_marker.py)

  Writes the release version and channel to a JSON file, and reports a
  change only when they differ.

OPTIONS (red indicates it is required):

   channel  Release channel.
        choices: [stable, canary]
        default: stable
        type: str

   path    File to write.
        default: /etc/webfleet/release.json
        type: path

   version  Release version.
        type: str

AUTHOR: webfleet team

EXAMPLES:
```

Use it in a playbook, `release.yml`:

```yaml
---
- name: Record the release on the web servers
  hosts: web
  become: true
  gather_facts: false

  tasks:
    - name: Record the release
      release_marker:
        version: '{{ release_version }}'
        channel: "{{ 'canary' if 'canary' in webserver_owner else 'stable' }}"
```

```terminal
{
  "title": "a custom module: changed, ok, and a preview",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-playbook release.yml -e release_version=1.4.2",
      "output": "changed: [web1]\nchanged: [web2]"
    },
    {
      "comment": "the same release again: nothing to do",
      "cmd": "ansible-playbook release.yml -e release_version=1.4.2",
      "output": "ok: [web1]\nok: [web2]"
    },
    {
      "comment": "what a new release would change on web1",
      "cmd": "ansible-playbook release.yml -e release_version=1.5.0 --check --diff --limit web1",
      "output": "--- before\n+++ after\n@@ -1,4 +1,4 @@\n {\n   \"channel\": \"stable\",\n-  \"version\": \"1.4.2\"\n+  \"version\": \"1.5.0\"\n }\n\nchanged: [web1]"
    }
  ]
}
```

When a module grows, or you want to share it, move it into a collection and test it with `ansible-test`, the test runner that ships with ansible-core.

## Write a Filter Plugin

A **filter plugin** adds Jinja2 filters, for data shaping that would make a template hard to read. Put a Python file with a `FilterModule` class in `filter_plugins/`:

```python
"""Jinja2 filters for the webfleet project."""

def nginx_upstream(addresses, port=80):
    """Turn a list of addresses into the server lines of an nginx upstream block."""
    return "\n".join(f"server {address}:{port};" for address in addresses)

class FilterModule:
    def filters(self):
        return {"nginx_upstream": nginx_upstream}
```

Use it like any built-in filter. Ansible loads `filter_plugins/` (and `library/`) next to the playbook it runs; ad-hoc commands do not, unless you set `library` and `filter_plugins` in `ansible.cfg`. This playbook, `upstream.yml`, renders the upstream lines for the web servers:

```yaml
---
- name: Use the custom filter
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Show the upstream servers for the web group
      ansible.builtin.debug:
        msg: "{{ groups['web'] | map('extract', hostvars, 'ansible_host') | nginx_upstream(80) }}"
```

```bash
ansible-playbook upstream.yml
```

```text
TASK [Show the upstream servers for the web group] *****************************
ok: [localhost] => {
    "msg": "server 192.168.56.11:80;\nserver 192.168.56.12:80;"
}
```

`upstream.yml` was only a demonstration; delete it (`rm upstream.yml`).

Filters run on the control node, during templating. Lookup plugins (`lookup('...')`) read data from outside, such as files, environment variables or secret managers, and test plugins add `is ...` tests. All of them live in directories next to the playbook while you develop them, and in a collection when you share them.

## Change the Output: Callback Plugins

**Callback plugins** react to events during a run: they print the output, time tasks, or send results somewhere. The default output callback can print task results as YAML instead of JSON, which is easier to read for multi-line values:

```bash
ANSIBLE_CALLBACK_RESULT_FORMAT=yaml ansible-playbook release.yml -e release_version=1.4.2 --limit web1 -v
```

```text
TASK [Record the release] ******************************************************
ok: [web1] =>
    changed: false
    gid: 0
    group: root
    mode: '0644'
    owner: root
    path: /etc/webfleet/release.json
    release:
        channel: stable
        version: 1.4.2
    size: 48
    state: file
    uid: 0
```

Set it permanently with `callback_result_format = yaml` under `[defaults]` in `ansible.cfg`. Older guides use `stdout_callback = community.general.yaml` for this; that plugin was removed in `community.general` 12.0.0. To enable extra callbacks, such as `ansible.posix.profile_tasks` from [Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns#h2-make-runs-faster), list them in `callbacks_enabled`, which replaced the old `callback_whitelist`:

```ini
[defaults]
callback_result_format = yaml
callbacks_enabled = ansible.posix.profile_tasks, ansible.posix.timer
```

`ansible.builtin.junit` writes JUnit XML that CI systems can display as test results, and `ansible.posix.json` prints the whole run as one JSON document for other tools.

## Execution Environments

Your project depends on a Python version, ansible-core, collections, and Python libraries on the control node. On a laptop that drifts; on ten laptops and a CI runner it drifts ten different ways. An **execution environment** (EE) is a container image that holds all of it, so every run uses the same versions. Ansible Automation Platform runs every job in one, and the command line tools work with them too:

- **ansible-builder** builds an EE image from a definition file.
- **ansible-navigator** runs playbooks inside an EE, with Podman or Docker.

The definition for this project, `execution-environment.yml`:

```yaml
---
version: 3
images:
  base_image:
    name: quay.io/fedora/fedora:44 # ansible-builder needs an RPM-based image
dependencies:
  python_interpreter: # the Fedora image has no Python; install it with dnf
    package_system: python3
    python_path: /usr/bin/python3
  ansible_core:
    package_pip: ansible-core==2.21.5
  ansible_runner:
    package_pip: ansible-runner
  galaxy: requirements.yml
  system:
    - openssh-clients # Ansible connects with the ssh command
```

`ansible-builder create` writes the build context: the image definition and the files it copies in. That step needs no container engine, so you can review exactly what will be built. The definition is a `Containerfile` when Podman is installed and a `Dockerfile` otherwise, as on this control node:

```terminal
{
  "title": "generate the build context",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "pipx install ansible-builder==3.2.0",
      "output": "  installed package ansible-builder 3.2.0, installed using Python 3.12.3\n  These apps are now globally available\n    - ansible-builder"
    },
    {
      "cmd": "ansible-builder create",
      "output": "Complete! The build context can be found at: /home/dev/webfleet/context"
    },
    {
      "cmd": "find context -type f | sort",
      "output": "context/Dockerfile\ncontext/_build/bindep.txt\ncontext/_build/requirements.yml\ncontext/_build/scripts/assemble\ncontext/_build/scripts/check_ansible\ncontext/_build/scripts/check_galaxy\ncontext/_build/scripts/entrypoint\ncontext/_build/scripts/install-from-bindep\ncontext/_build/scripts/introspect.py\ncontext/_build/scripts/pip_install"
    },
    {
      "cmd": "grep -E '^(ARG|FROM)' context/Dockerfile | head -n 9",
      "output": "ARG EE_BASE_IMAGE=\"quay.io/fedora/fedora:44\"\nARG PYCMD=\"/usr/bin/python3\"\nARG PYPKG=\"python3\"\nARG PKGMGR_PRESERVE_CACHE=\"\"\nARG ANSIBLE_GALAXY_CLI_COLLECTION_OPTS=\"\"\nARG ANSIBLE_GALAXY_CLI_ROLE_OPTS=\"\"\nARG ANSIBLE_INSTALL_REFS=\"ansible-core==2.21.5 ansible-runner\"\nARG PKGMGR=\"/usr/bin/dnf\"\nFROM $EE_BASE_IMAGE AS base"
    }
  ]
}
```

`ansible-builder build --tag webfleet-ee:1.0` then builds the image with Podman or Docker, and you push it to a registry like any other image. To run the project in it, tell ansible-navigator which image to use and give the container what lives outside the project: the vault password file, and a collection path that includes the collections built into the image, because `ansible.cfg` points `collections_path` at the project's own `collections/` directory:

```bash
ansible-builder build --tag webfleet-ee:1.0
ansible-navigator run site.yml --mode stdout \
  --execution-environment-image webfleet-ee:1.0 --pull-policy never \
  --execution-environment-volume-mounts "$HOME/.webfleet-vault-pass:/tmp/vault-pass:ro" \
  --set-environment-variable ANSIBLE_VAULT_PASSWORD_FILE=/tmp/vault-pass \
  --set-environment-variable ANSIBLE_COLLECTIONS_PATH=/usr/share/ansible/collections
```

ansible-navigator mounts your `~/.ssh` directory and your `ssh-agent` socket into the container by itself, so the SSH key and `known_hosts` work as before. The lab has no container engine, so this command is shown without output. The `ansible-dev-tools` Python package installs ansible-builder, ansible-navigator, ansible-lint, Molecule and `ansible-creator` (which scaffolds new collections and playbook projects) in one go, and is also published as a container image.

## Automation Platforms: AAP and AWX

Running playbooks from CI works well for one team. Organizations with many teams usually want a web interface, role-based access to credentials, schedules, an API, and a central log of every run. That is what an automation platform adds on top of ansible-core:

- **Red Hat Ansible Automation Platform (AAP)** is the commercial product. Releases 2.5 and 2.6 are current in October 2026, and Red Hat lists 2.7 as the next one. Its parts are **automation controller** (formerly Ansible Tower) for jobs, inventories, credentials and schedules; **Event-Driven Ansible**, which starts automation from events such as monitoring alerts; **automation hub** for certified and private collections and EEs; and the **platform gateway**, the single web interface and API in front of them since 2.5.
- **AWX** is the open-source upstream of automation controller. Its last release was 24.6.1 in July 2024, and releases are paused while the project is refactored into a new architecture, so check its status before you build on it.
- The rest of the ecosystem includes Semaphore UI, an open-source web interface for Ansible, and general CI systems such as GitHub Actions, GitLab CI or Jenkins, running `ansible-playbook` as in [Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns#h2-run-every-change-through-ci).

Whatever you choose, the platform holds the keys to every server it manages. Patch it quickly and limit who can log in; [this CVE in Event-Driven Ansible](/posts/ansible-automation-platform-credential-leak-cve-2026-11807) shows why.

## Ansible and Terraform

Terraform and Ansible overlap less than it seems. Terraform is best at creating infrastructure and tracking it in state: networks, servers, DNS records, managed databases. Ansible is best at what happens inside the servers: packages, files, users, services and ordered rollouts. Many teams use both, with Terraform first:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "terraform apply", "sub": "creates servers", "icon": "cloud", "tone": "violet" },
    { "label": "state", "sub": "addresses, tags", "icon": "database", "tone": "slate" },
    { "label": "inventory plugin", "sub": "reads the state", "icon": "gear", "tone": "blue" },
    { "label": "ansible-playbook", "sub": "configures them", "icon": "server", "tone": "green" }
  ]
}
```

The glue is the inventory. Either use the cloud's inventory plugin with the tags Terraform sets, or declare Ansible hosts in Terraform with the `ansible/ansible` provider and read them with the `cloud.terraform.terraform_provider` inventory plugin:

```hcl
terraform {
  required_providers {
    ansible = {
      source  = "ansible/ansible"
      version = "~> 1.5"
    }
  }
}

resource "ansible_host" "web" {
  count  = 2
  name   = "web${count.index + 1}"
  groups = ["web"]
  variables = {
    ansible_host = digitalocean_droplet.web[count.index].ipv4_address
  }
}
```

```yaml
# inventory/terraform.yml
---
plugin: cloud.terraform.terraform_provider
project_path: ../terraform
```

The plugin runs `terraform show` on the state, so the `terraform` binary must be installed on the control node.

Avoid running Ansible from inside Terraform with `local-exec` provisioners: a failed playbook then fails the `terraform apply`, and Terraform cannot track what Ansible changed. The [Introduction to Terraform](/guides/introduction-to-terraform) guide covers the Terraform side.

## What to Learn Next

You have the core of Ansible. Where to go from here depends on what you automate:

- **More of the language**: `async` and `poll` for long tasks, `delegate_to` and `run_once` for orchestration, the `assemble` and `slurp` modules, and lookup plugins.
- **Collections of your own**: package roles, modules and plugins with `ansible-galaxy collection init` or `ansible-creator`, test them with `ansible-test`, and publish them to Galaxy or a private automation hub.
- **Windows**: the `ansible.windows` and `community.windows` collections, over WinRM or SSH.
- **Network devices**: `ansible.netcommon` and the vendor collections (`cisco.ios`, `arista.eos`, `junipernetworks.junos`) use network connection plugins instead of Python on the device.
- **Kubernetes and containers**: `kubernetes.core` and `community.docker`.
- **Events**: `ansible-rulebook`, the open-source engine behind Event-Driven Ansible.
- **Certification**: Red Hat's EX294 exam (Red Hat Certified Advanced System Administrator in Ansible) tests playbooks, roles, Vault and system administration with Ansible, and is part of the path to Red Hat Certified Engineer (RHCE).

## Summary

- Inventory plugins build the inventory at run time; `constructed` adds groups from expressions, cloud plugins read the provider's API, and a script that prints JSON covers everything else.
- A module is a Python script with an `argument_spec`, check mode support and a JSON result; put it in `library/`.
- Filter, lookup and callback plugins extend templating and output; the default callback prints YAML with `callback_result_format = yaml`.
- Execution environments package Ansible and its dependencies in a container image; `ansible-builder` builds them and `ansible-navigator` runs them.
- AAP (and AWX upstream) adds a web interface, credentials, schedules and audit logs; Terraform creates the servers that Ansible then configures.

That is the end of the guide. Go back to [the overview](/guides/introduction-to-ansible) for the full list of parts, or start automating your own servers with the `webfleet` project as a template.

## Keep Learning

- [Introduction to Terraform](/guides/introduction-to-terraform)
- [Ansible vs Chef](/comparisons/ansible-vs-chef)
- [Ansible Configuration Management Quiz](/quizzes/ansible-quiz)
- [GitOps Implementation Checklist](/checklists/gitops-implementation)
