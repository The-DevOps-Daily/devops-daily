---
title: Introduction to Packer
seoTitle: 'HashiCorp Packer Tutorial: Templates, Builds and Best Practices'
description: 'Learn HashiCorp Packer 1.16: install it, write HCL2 templates, build AWS AMIs and Docker images, use provisioners and variables, and follow best practices.'
category:
  name: Infrastructure as Code
  slug: infrastructure-as-code
publishedAt: '2025-12-14'
updatedAt: '2026-10-23'
author:
  name: DevOps Daily Team
  slug: devops-daily-team
tags:
  - Packer
  - HashiCorp Packer
  - Infrastructure as Code
  - IaC
  - Machine Images
  - DevOps
  - AWS
  - Docker
---

Building machine images by hand is slow and hard to repeat. You start a server, install packages, edit configuration files, test, and take a snapshot. A few months later nobody remembers exactly what went into that image, and two engineers who follow the same wiki page end up with two different servers.

**HashiCorp Packer** is a command-line tool that builds machine images from a template. You describe the base image, the software to install and the files to copy. Packer starts a temporary machine, runs your steps on it, saves the result as an image and deletes the temporary machine. The output can be an AWS AMI, a Google Cloud or Azure image, a DigitalOcean snapshot, a Docker image, or a VirtualBox or QEMU disk. The template lives in Git, so every image change is reviewed, versioned and repeatable, and one template can build the same image for several platforms at the same time.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "tpl", "label": "web.pkr.hcl", "sub": "template in Git", "icon": "gear", "tone": "slate", "detail": "Base image, provisioning steps and post-processors, written in HCL2." }
    ],
    [
      { "id": "packer", "label": "packer build", "sub": "temporary machines", "icon": "cpu", "tone": "accent", "detail": "Packer starts one temporary machine per source, runs the provisioners, saves an image and cleans up." }
    ],
    [
      { "id": "ami", "label": "AWS AMI", "sub": "amazon-ebs", "icon": "cloud", "tone": "amber" },
      { "id": "az", "label": "Azure image", "sub": "azure-arm", "icon": "cloud", "tone": "blue" },
      { "id": "docker", "label": "Docker image", "sub": "docker", "icon": "box", "tone": "violet" }
    ]
  ],
  "edges": [["tpl", "packer"], ["packer", "ami"], ["packer", "az"], ["packer", "docker"]]
}
```

Packer only builds images. It does not create networks or launch your servers (that is Terraform's job), and it does not keep running servers in line with a desired state (that is what Ansible, Chef or Puppet do when they run on a schedule). Most teams combine them: Packer bakes an image with everything the application needs, and Terraform launches instances from it.

## What You'll Learn

The guide has six parts. Each part builds on the previous one, but you can jump straight to the topic you need.

1. **[What Is Packer? Core Concepts and Workflow](/guides/introduction-to-packer/01-packer-fundamentals)**: builders, sources, provisioners, post-processors and plugins, what happens during `packer build`, and when Packer is the wrong tool.
2. **[How to Install Packer on Linux, macOS and Windows](/guides/introduction-to-packer/02-installation-and-setup)**: install Packer 1.16, install plugins with `packer init`, set up cloud credentials, and run `fmt` and `validate` on a first template.
3. **[Writing Your First Packer Template](/guides/introduction-to-packer/03-writing-your-first-template)**: build an Nginx web server AMI on Ubuntu 24.04, line by line, and test it.
4. **[Packer Builders: AWS, Azure, Google Cloud, Docker and More](/guides/introduction-to-packer/04-builders-and-platforms)**: configure the common builders and build the same image for several platforms from one template.
5. **[Packer Provisioners: Shell, File, Ansible and More](/guides/introduction-to-packer/05-provisioners-in-depth)**: run scripts, upload files, call Ansible, retry flaky steps and clean up images.
6. **[Packer Variables, Var Files and Best Practices](/guides/introduction-to-packer/06-variables-and-best-practices)**: variables, locals, `.pkrvars.hcl` files, secrets, project layout, image testing and CI/CD.

## Packer Best Practices at a Glance

These are the habits that separate a reliable image pipeline from a pile of snapshots. Each one links to the part that explains it.

- **Pin Packer and plugin versions.** Set `required_version` and a `~>` constraint in `required_plugins`, and commit both ([Part 2](/guides/introduction-to-packer/02-installation-and-setup)).
- **Look up base images with a data source**, not a hard-coded image ID, and filter on the vendor's account ID so you never build on an unofficial image ([Part 3](/guides/introduction-to-packer/03-writing-your-first-template)).
- **Give every image a unique, sortable name** (application, version, build time) and tag it with the Git commit ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices)).
- **Run `packer fmt -check` and `packer validate` on every pull request**, before any cloud resources are created ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices)).
- **Keep secrets out of templates and images.** Read them from the environment or a secrets manager, mark them `sensitive`, and never bake credentials into the image ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices)).
- **Wait for cloud-init, install non-interactively, and clean up at the end**, so builds do not hang and every instance from the image gets its own identity ([Part 5](/guides/introduction-to-packer/05-provisioners-in-depth)).
- **Use short-lived build credentials and restrict the temporary SSH access** instead of opening port 22 to the internet ([Part 4](/guides/introduction-to-packer/04-builders-and-platforms)).
- **Test the image before you ship it**: launch an instance from it, check the service, then promote it ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices)).
- **Clean up old images.** Every AMI keeps its EBS snapshots, and you pay for them until you delete them ([Part 3](/guides/introduction-to-packer/03-writing-your-first-template)).

## Which Version This Guide Uses

The examples use **Packer 1.16.2**, released on 22 October 2026, with the Amazon (1.8.3), Docker (1.1.4) and Ansible (1.1.6) plugins. The output of `packer version`, `init`, `fmt`, `validate`, `inspect` and `console`, and of the local builds that use the built-in `null` builder, comes from real runs of Packer 1.16.2 on Linux. A real AMI or Docker build needs a cloud account or a Docker daemon, so the guide shows that output as a labelled example in Packer's real output format.

If you learned Packer from an older tutorial, these changes matter most:

| Change                                                                           | Since         | What you do now                                                                       |
| -------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| Plugins are no longer bundled with Packer                                        | 1.10.0 (2023) | Declare each plugin in `required_plugins` and run `packer init`                       |
| Plugins load only from the plugin directory                                      | 1.11.0 (2024) | Do not drop plugin binaries next to the template; use `packer plugins install --path` |
| Official plugins download from releases.hashicorp.com                            | 1.14.0 (2025) | Run Packer 1.14 or newer to keep getting plugin updates automatically                 |
| `hcp_packer_registry` moved to the top level of the template                     | 1.13.0 (2025) | The block inside `build` still works but is deprecated                                |
| `continue_on_error`, `optional()` object attributes, `provenance` post-processor | 1.16.0 (2026) | New options covered in Parts 5 and 6                                                  |

Templates use **HCL2**. JSON templates still work, but HashiCorp recommends moving to HCL2, new features may not reach JSON, and `packer init` and data sources only work with HCL2. `packer hcl2_upgrade` converts a JSON template, and `packer fix` only applies to old JSON templates.

## Packer's License

Packer 1.10.0 and later use the **Business Source License 1.1** (BUSL), not the open source MPL 2.0 license that covered 1.9.x and earlier. The licensor named in the `LICENSE.txt` file that ships with every release is now IBM, which owns HashiCorp. For most teams nothing changes in practice:

- You can use Packer in production, for free, to build images for your own company and its affiliates.
- The restriction targets companies that offer Packer to third parties as a paid hosted or embedded product that competes with HashiCorp's paid offerings.
- Each version converts to MPL 2.0 four years after its release.

One side effect: Homebrew's main repository stopped updating Packer at 1.9.4 and has removed the formula, so on macOS you now install it from HashiCorp's own tap ([Part 2](/guides/introduction-to-packer/02-installation-and-setup)). If your company has a policy on source-available licenses, read the license text in the release archive or ask your legal team.

## Prerequisites

To follow along, you need:

- a computer running Linux, macOS or Windows, and basic comfort with a terminal;
- a text editor (an HCL syntax extension makes `.pkr.hcl` files easier to read);
- for Parts 3 and 4, an AWS account where you may create EC2 instances and AMIs (a build of the examples costs well under a dollar, plus snapshot storage until you delete the image);
- optionally Docker, to build container images locally.

You do not need a cloud account to learn the basics. Parts 2, 5 and 6 include builds that run locally with the built-in `null` builder.

## Why Build Images Instead of Configuring Servers at Boot

**Faster launches.** An instance that starts from a prepared image serves traffic as soon as it boots. An instance that installs everything at boot takes minutes, and that matters when an autoscaling group needs capacity now.

**Fewer moving parts at launch.** A boot script that runs `apt-get install` depends on package mirrors and network access at the worst possible moment. A baked image does not.

**Consistency.** Every instance from the same image is identical, and the image ID tells you exactly what is running.

**Testing and rollback.** You test an image once, then launch hundreds of instances from it. If a new image is bad, you roll back by launching the previous image ID.

**Immutable infrastructure.** You stop patching servers in place. To change something, you build a new image and replace the instances.

The trade-off: every change needs a new image build (a few minutes), and you need a process to retire old images. Dynamic settings such as database endpoints or secrets still belong in configuration you inject at boot, not in the image.

Start with [Part 1: What Is Packer?](/guides/introduction-to-packer/01-packer-fundamentals), or jump to [installing Packer](/guides/introduction-to-packer/02-installation-and-setup) if you already know the concepts.

## Keep Learning

- [Infrastructure as Code: A Beginner's Guide to IaC Fundamentals](/posts/infrastructure-as-code-fundamentals)
- [Introduction to Terraform](/guides/introduction-to-terraform), to launch servers from the images you build
- [Interview question: immutable infrastructure](/interview-questions/mid/immutable-infrastructure)
