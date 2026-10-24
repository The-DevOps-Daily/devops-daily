---
title: 'Introduction to Ansible'
seoTitle: 'Ansible Tutorial for Beginners: Playbooks, Roles and Vault'
description: 'Learn Ansible step by step with ansible-core 2.21: install it, write playbooks, manage inventory, variables, handlers, templates, roles and Vault.'
category:
  name: 'DevOps'
  slug: 'devops'
publishedAt: '2024-10-24T10:00:00Z'
updatedAt: '2026-10-24T10:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Ansible
  - Automation
  - Configuration Management
  - Infrastructure as Code
  - DevOps
---

**Ansible** configures servers from a description of how they should be: which packages are installed, which files have which content, which services run. You write that description in YAML **playbooks**, and Ansible connects to your servers over SSH and changes only what differs. Run it again tomorrow and nothing changes, unless someone changed a server by hand in between, in which case Ansible puts it back. There is no agent to install on the servers and no central server to run: a laptop with Python and SSH access is enough to start.

This guide teaches Ansible from the first command to a project a team can run in production. You build one project along the way, **webfleet**: two Ubuntu servers that become nginx web servers, each serving its own page. Every part adds a piece: an inventory, a playbook, variables, handlers, templates, roles, an encrypted secret, a rolling update and a CI pipeline.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Inventory", "sub": "which hosts", "icon": "database", "tone": "slate" },
    { "label": "Playbook", "sub": "what state", "icon": "gear", "tone": "accent" },
    { "label": "ansible-playbook", "sub": "SSH, no agent", "icon": "lock", "tone": "violet" },
    { "label": "Modules", "sub": "change only what differs", "icon": "box", "tone": "blue" },
    { "label": "Servers", "sub": "web1, web2", "icon": "server", "tone": "green" }
  ]
}
```

## What You'll Learn

The guide has ten parts. Each builds on the previous one, but you can jump to the topic you need.

1. **[Install Ansible and Run Your First Commands](/guides/introduction-to-ansible/01-installing-and-setting-up)**: ansible-core 2.21 with pipx, SSH keys and host keys, an inventory, `ansible.cfg`, and the first errors you will hit.
2. **[Ansible Basics: Modules, Tasks, Plays and Playbooks](/guides/introduction-to-ansible/02-fundamentals)**: what Ansible does on each host, collections and fully qualified names, idempotency, check mode, and YAML traps.
3. **[Write Your First Ansible Playbook](/guides/introduction-to-ansible/03-writing-your-first-playbook)**: install nginx, publish a page and test it, with conditions, loops, tags and error handling.
4. **[Ansible Inventory: Hosts, Groups, Variables and Patterns](/guides/introduction-to-ansible/04-working-with-inventory)**: YAML inventories, `group_vars` and `host_vars`, host patterns and environments.
5. **[Ansible Variables, Facts and Precedence](/guides/introduction-to-ansible/05-variables-and-facts)**: where variables come from and which one wins, facts, magic variables, `register`, custom facts and filters.
6. **[Ansible Handlers: Restart Services Only When Needed](/guides/introduction-to-ansible/06-handlers-and-notifications)**: notify, listen topics, testing a configuration before a reload, and when handlers do not run.
7. **[Ansible Templates and Files with Jinja2](/guides/introduction-to-ansible/07-templates-and-files)**: templates, `--diff`, links and permissions, line edits, and `validate`.
8. **[Ansible Roles and Collections: Structure a Real Project](/guides/introduction-to-ansible/08-roles-and-organization)**: roles, argument validation, `requirements.yml` and the project layout.
9. **[Ansible Best Practices: Vault, Linting, Testing and CI](/guides/introduction-to-ansible/09-best-practices-and-production-patterns)**: Ansible Vault, rolling updates, faster runs, ansible-lint, Molecule and a GitHub Actions pipeline.
10. **[Advanced Ansible: Dynamic Inventory, Plugins and Next Steps](/guides/introduction-to-ansible/10-advanced-features-and-next-steps)**: dynamic inventories, a custom module and filter, execution environments, AAP, AWX and Terraform.

## Ansible Best Practices at a Glance

The habits that keep Ansible projects reliable, each with the part that explains it:

- **Pin ansible-core and your collections**, and install them from `requirements.yml` ([Part 1](/guides/introduction-to-ansible/01-installing-and-setting-up), [Part 8](/guides/introduction-to-ansible/08-roles-and-organization)).
- **Keep host key checking on**, and add host keys with `ssh-keyscan` after checking their fingerprints ([Part 1](/guides/introduction-to-ansible/01-installing-and-setting-up)).
- **Use modules, not `command` and `shell`**, and write their fully qualified names ([Part 2](/guides/introduction-to-ansible/02-fundamentals)).
- **Test the result**, not only the run: check the service from outside in `post_tasks` ([Part 3](/guides/introduction-to-ansible/03-writing-your-first-playbook)).
- **Put variables in one place** and read facts from `ansible_facts` ([Part 5](/guides/introduction-to-ansible/05-variables-and-facts)).
- **Reload services with handlers**, and test configuration before the reload ([Part 6](/guides/introduction-to-ansible/06-handlers-and-notifications)).
- **Preview changes with `--check --diff`**, and validate critical files before they replace the old ones ([Part 7](/guides/introduction-to-ansible/07-templates-and-files)).
- **Package work in roles** with prefixed variables and argument specs ([Part 8](/guides/introduction-to-ansible/08-roles-and-organization)).
- **Encrypt secrets**, roll out with `serial`, and lint and deploy from CI ([Part 9](/guides/introduction-to-ansible/09-best-practices-and-production-patterns)).

## Which Versions This Guide Uses

The guide was updated on 24 October 2026 for **ansible-core 2.21.5**, the current release, with **community.general 13.5.0**, **ansible.posix 2.2.2**, **ansible-lint 26.10.1** and **ansible-builder 3.2.0**. The control node runs Ubuntu 24.04 with Python 3.12, and the managed nodes are two Ubuntu 24.04.5 servers with nginx 1.24. **ansible-core 2.22** is due on 2 November 2026; it adds masking of secret values in output and needs Python 3.13 or newer on the control node. Its porting guide lists no change that affects the playbooks in this guide.

What is a real run and what is an example:

- **Real runs**: every command output in this guide (`ansible`, `ansible-playbook`, `ansible-vault`, `ansible-lint`, `ansible-builder`, `ssh`, `curl` and the rest) comes from a run in a lab: an Ubuntu 24.04 control node and two Ubuntu 24.04 virtual machines built from Ubuntu's cloud image, reached over SSH as the `ubuntu` user, the same way you reach a cloud server. Times, host keys and temporary file names are from those runs. Long outputs are shortened to the lines that matter, such as the tasks that changed and the recap; nothing in them is edited, except where the text says so.
- **Examples**: configuration for things the lab cannot run, which the text marks as such: cloud inventory plugins (they need an account), the Molecule scenario and the `ansible-navigator` run (they need a container engine), the GitHub Actions deploy job, and the Terraform files.

If you learned Ansible from an older tutorial, these changes matter most:

| Then                                        | Now                                                                      | Since                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| One big `ansible` package with every module | ansible-core plus the collections you choose                             | Ansible 2.10 (2020)                                         |
| Short module names (`apt:`)                 | Fully qualified names (`ansible.builtin.apt:`)                           | Collections, 2.10 (2020)                                    |
| `include:`                                  | `import_tasks` or `include_tasks`                                        | `include` removed in ansible-core 2.16 (2023)               |
| `callback_whitelist`                        | `callbacks_enabled`                                                      | old name removed in ansible-core 2.15 (2023)                |
| `stdout_callback = community.general.yaml`  | `callback_result_format = yaml`                                          | community.general 12.0.0 (November 2025)                    |
| Any "truthy" value in `when:`               | Conditions must be booleans; no `{{ }}` inside `when:`                   | ansible-core 2.19 (July 2025)                               |
| Facts as variables (`ansible_os_family`)    | `ansible_facts['os_family']`                                             | deprecated in 2.20 (November 2025); default changes in 2.24 |
| Python 3.11 on the control node             | Python 3.12 or newer (3.13 for 2.22)                                     | ansible-core 2.20 (November 2025)                           |
| Ansible Tower, AWX releases                 | Automation controller in AAP 2.5 and 2.6; AWX releases paused            | AAP 2.0 (2021); AWX since July 2024                         |
| `molecule init role` with drivers           | `ansible-galaxy role init`, Molecule scenarios with an Ansible inventory | Molecule 6 (2023) and later                                 |

## Prerequisites

- A Linux or macOS computer, or Windows with WSL, to run Ansible from.
- One or two Linux servers you can reach over SSH, from a cloud provider or as local VMs. [Part 1](/guides/introduction-to-ansible/01-installing-and-setting-up) shows how to get them.
- Basic comfort with the command line, SSH and a text editor. The [Introduction to Linux](/guides/introduction-to-linux) guide covers them.

You do not need to know Python. You read a little of it in Part 10, and nothing before that.

## Practice Hands-On

Test yourself with the [Ansible quiz](/quizzes/ansible-quiz) and the [Ansible Basics flashcards](/flashcards/ansible-basics), then build a complete web server setup in the [Ansible web server automation exercise](/exercises/ansible-web-server-automation). The [Configuration Management Basics](/interview-questions/junior/configuration-management-basics) interview questions check the concepts.

## Keep Learning

- [Infrastructure as Code: A Beginner's Guide](/posts/infrastructure-as-code-fundamentals)
- [Ansible vs Chef](/comparisons/ansible-vs-chef)
- [Your Automation Platform Is a Credential Honeypot: Ansible CVE-2026-11807](/posts/ansible-automation-platform-credential-leak-cve-2026-11807)
- Next guide: [Introduction to Terraform](/guides/introduction-to-terraform)

Start with [Part 1: Install Ansible and Run Your First Commands](/guides/introduction-to-ansible/01-installing-and-setting-up).
