---
title: Introduction to Terraform
seoTitle: 'Terraform Tutorial for Beginners: Infrastructure as Code Step by Step'
description: 'Learn Terraform 1.17 step by step: install it, write HCL, manage state, use variables and modules, set up S3 remote state with locking, and test your code.'
category:
  name: Terraform
  slug: terraform
publishedAt: '2025-04-28'
updatedAt: '2026-10-24'
author:
  name: DevOps Daily Team
  slug: devops-daily-team
tags:
  - Terraform
  - OpenTofu
  - Infrastructure as Code
  - IaC
  - HCL
  - DevOps
  - AWS
  - HashiCorp
---

Clicking through cloud consoles does not scale. Every manual change is undocumented, environments drift apart, and nobody can say who changed what or how to rebuild it after a disaster.

**Terraform** lets you describe infrastructure in code: servers, networks, databases, DNS records, Kubernetes clusters, GitHub repositories, monitoring alerts, anything with an API. You write what you want in configuration files, Terraform shows you a plan of what it will change, and then it creates, updates or deletes resources until reality matches the code. The code lives in Git, so every change is reviewed, versioned and repeatable, and one workflow works across AWS, Azure, Google Cloud, DigitalOcean and thousands of other services.

This guide takes you from your first `terraform init` to the practices production teams use: state management, modules, multiple environments, remote state with locking, CI pipelines and tests. Most examples run on your own machine with no cloud account, and the output you see comes from real runs.

## What You'll Learn

The guide has ten parts. Each builds on the previous one, but you can jump straight to the topic you need.

1. **[What Is Terraform? Core Concepts and Workflow](/guides/introduction-to-terraform/01-terraform-fundamentals)**: the declarative model, providers, resources, state, the dependency graph and how to read a plan.
2. **[How to Install Terraform and Run Your First Apply](/guides/introduction-to-terraform/02-installation-and-setup)**: install Terraform 1.17, verify the download, run `init`, `plan`, `apply` and `destroy`, set up cloud credentials and create a first cloud server.
3. **[Terraform Configuration Language (HCL) Basics](/guides/introduction-to-terraform/03-configuration-language-basics)**: blocks, types, references, templates, `for` expressions, functions and dynamic blocks, tried in `terraform console`.
4. **[Terraform Resources, Data Sources and Meta-Arguments](/guides/introduction-to-terraform/04-resources-and-data-sources)**: a web server on AWS, dependencies, `count` and `for_each`, `lifecycle` rules, provisioners and actions.
5. **[Terraform State Management: Commands, Drift and Locking](/guides/introduction-to-terraform/05-state-management)**: what state contains, the `state` commands, `moved`, `import` and `removed` blocks, drift and refresh-only plans, and state locks.
6. **[Terraform Variables and Outputs](/guides/introduction-to-terraform/06-variables-and-outputs)**: types, validation, tfvars files, which value wins, sensitive and ephemeral values, and outputs for scripts.
7. **[Terraform Modules: Write, Use and Version Them](/guides/introduction-to-terraform/07-modules)**: write a module, call it with `for_each`, use registry and Git sources, and refactor into modules without recreating anything.
8. **[Managing Multiple Environments with Terraform](/guides/introduction-to-terraform/08-working-with-multiple-environments)**: workspaces, one directory per environment, `terraform_remote_state`, Terragrunt and HCP Terraform Stacks.
9. **[Terraform Remote Backends: S3 Native Locking and Team Workflows](/guides/introduction-to-terraform/09-remote-backends-and-collaboration)**: S3 with `use_lockfile`, Azure, GCS, Postgres and HCP Terraform, state migration, OpenTofu state encryption and a GitHub Actions workflow with OIDC.
10. **[Terraform Best Practices for Production](/guides/introduction-to-terraform/10-best-practices-and-production-patterns)**: layout, version pinning, linting, `terraform test`, secrets with ephemeral values, policy as code and drift detection.

## Which Version This Guide Uses

The examples use **Terraform 1.17.0**, released on 21 October 2026, with current providers (`hashicorp/aws` 6.70, `hashicorp/local` 2.9, `hashicorp/random` 3.9, `hashicorp/tls` 4.4, `digitalocean/digitalocean` 2.106). Commands that only need your machine ran for real, and the guide shows their output. Commands that need a cloud account are shown as labelled examples, and every AWS code block passed `terraform validate` against the real AWS provider.

If you learned Terraform from an older tutorial, these changes matter most:

| Change                                                                                 | Since                   | What you do now                                                                 |
| -------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Terraform is licensed under the BUSL 1.1; OpenTofu forked the last open source version | 1.6 (2023)              | Nothing for most users; see [Terraform or OpenTofu?](#h2-terraform-or-opentofu) |
| `terraform refresh` is deprecated                                                      | 0.15.4 (2021)           | `terraform apply -refresh-only`                                                 |
| `terraform_data` replaces `null_resource`                                              | 1.4 (2023)              | Use the built-in `terraform_data` resource                                      |
| `import` blocks and generated configuration                                            | 1.5 (2023)              | Plan imports instead of running `terraform import`                              |
| `terraform test` with mock providers                                                   | 1.6, 1.7 (2023, 2024)   | Unit tests without cloud credentials                                            |
| Terraform Cloud is called **HCP Terraform**                                            | 2024                    | Same `cloud` block and `terraform login`                                        |
| Ephemeral resources and write-only arguments                                           | 1.10, 1.11 (2024, 2025) | Keep secrets out of state                                                       |
| S3 native state locking (`use_lockfile`), DynamoDB locking deprecated                  | 1.11 (2025)             | Drop the DynamoDB table                                                         |
| Actions and `terraform query`                                                          | 1.14 (2025)             | Provider-defined operations; find existing resources to import                  |
| Variables in module sources, deprecated variables and outputs                          | 1.15 (2026)             | Mirror module sources; rename inputs safely                                     |
| `lifecycle { destroy = false }`, import blocks in modules, Mermaid graphs              | 1.16 (2026)             | Forget objects instead of destroying them                                       |
| Variables in provider requirements, `-minimal-refresh`                                 | 1.17 (2026)             | Faster plans on large states                                                    |
| The legacy free plan of HCP Terraform ended                                            | March 2026              | Free tier: up to 500 managed resources                                          |

## Terraform or OpenTofu?

In August 2023, HashiCorp moved Terraform from the open source Mozilla Public License to the **Business Source License** (BUSL 1.1), starting with version 1.6. IBM completed its acquisition of HashiCorp in February 2025. For most teams nothing changed in practice: you can use Terraform for free to manage your own infrastructure, in production. The license restricts companies that offer Terraform in a paid hosted or embedded product that competes with HashiCorp, and each version converts to an open source license four years after its release.

The community forked the last MPL release into **OpenTofu**, which stays open source under MPL 2.0. It started under the Linux Foundation and became a CNCF sandbox project in April 2025. Both tools read the same HCL, use the same providers and modules from compatible registries, and store state in the same format, so moving between them is usually a matter of running `tofu init` instead of `terraform init`. They have since added different features:

|                                                        | Terraform 1.17                   | OpenTofu 1.13                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| License                                                | BUSL 1.1                         | MPL 2.0 (open source)                                                                                                                           |
| Command                                                | `terraform`                      | `tofu`                                                                                                                                          |
| Client-side state encryption                           | No; relies on backend encryption | Yes, with a passphrase or KMS ([Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration#h2-encrypt-state-with-opentofu)) |
| Variables in backend blocks                            | No                               | Yes (early evaluation)                                                                                                                          |
| `for_each` on provider configurations, `-exclude` flag | No                               | Yes                                                                                                                                             |
| Actions, `terraform query`, Stacks                     | Yes                              | No                                                                                                                                              |
| Managed service from the vendor                        | HCP Terraform                    | None; use Spacelift, env0, Scalr or Atlantis                                                                                                    |

This guide uses `terraform` in every command. Nearly everything works the same with `tofu`; where a feature exists in only one tool, the guide says so. The [Terraform vs OpenTofu comparison](/comparisons/terraform-vs-opentofu) and the post [OpenTofu in 2026: Should You Switch from Terraform](/posts/opentofu-2026-switch-from-terraform) help you choose.

## Prerequisites

- Basic comfort with a terminal on Linux, macOS or Windows.
- A text editor; the HashiCorp Terraform extension for VS Code helps.
- A rough idea of what servers, networks and DNS are.

You do not need a cloud account for most of the guide: the examples use providers that create local files and random values, which behave like cloud resources in every way that matters for learning. Some sections build real infrastructure on AWS or DigitalOcean; those cost money while the resources exist, so run `terraform destroy` when you are done. You do not need to know a programming language either. HCL is a configuration language: you describe what you want, not how to build it.

## Why Teams Use Terraform

- **Reproducible environments.** Staging and production come from the same code, and a new environment or region is a new set of variables, not a week of clicking.
- **Reviewable changes.** Infrastructure changes go through pull requests, and reviewers see the exact plan before anything happens.
- **A record of everything.** The code and its Git history document what exists and why it changed.
- **Disaster recovery.** If a region or an account is lost, the code rebuilds it.
- **One workflow for many platforms.** The same commands manage AWS, Kubernetes, DNS, monitoring and SaaS tools.

Start with [Part 1: What Is Terraform?](/guides/introduction-to-terraform/01-terraform-fundamentals), or jump to [installing Terraform](/guides/introduction-to-terraform/02-installation-and-setup) if you know the concepts.

## Keep Learning

- [Infrastructure as Code: A Beginner's Guide to IaC Fundamentals](/posts/infrastructure-as-code-fundamentals)
- [Terraform vs CloudFormation](/comparisons/terraform-vs-cloudformation) and [Terraform vs Pulumi](/comparisons/terraform-vs-pulumi)
- [Introduction to Packer](/guides/introduction-to-packer), to build the machine images Terraform launches
- [Terraform Fundamentals Quiz](/quizzes/terraform-quiz) and [Terraform Basics flashcards](/flashcards/terraform-basics)
