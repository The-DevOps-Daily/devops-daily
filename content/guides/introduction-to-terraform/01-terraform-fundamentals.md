---
title: 'What Is Terraform? Core Concepts and Workflow'
description: 'How Terraform works: providers, resources, data sources, state, the dependency graph and the init, plan and apply workflow, with a real plan explained.'
order: 1
---

**TLDR**: Terraform reads configuration files that describe the infrastructure you want, compares them with what it recorded in its **state**, and asks **providers** (plugins for AWS, Azure, DigitalOcean, GitHub and thousands of other APIs) to create, change or delete objects until reality matches the code. The workflow is always the same: write code, `terraform init`, `terraform plan`, read the plan, `terraform apply`.

Before you write any Terraform, it helps to know how it thinks. Terraform is not a script runner: you never tell it "create this, then that". You describe the end result, and Terraform works out the steps, their order and what can run in parallel. This part explains the model behind every command in the rest of the guide.

## Prerequisites

None. This part is about concepts. You install Terraform in [Part 2](/guides/introduction-to-terraform/02-installation-and-setup).

## Declarative, Not Imperative

With a shell script, you write the steps: create a network, read its ID from the output, create a subnet in it, then start a server in that subnet.

```bash
# Imperative: you run each step and pass the IDs along yourself
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query Vpc.VpcId --output text)
SUBNET_ID=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 10.0.1.0/24 \
  --query Subnet.SubnetId --output text)
aws ec2 run-instances --subnet-id "$SUBNET_ID" --image-id "$AMI_ID" --instance-type t3.micro
```

Run that script twice and you get two networks and two servers. To change the instance type later, you need a different script. To delete everything, you need a third one, and you need the IDs.

With Terraform, you write the result you want:

```hcl
# Declarative: you describe the end state
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}

resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
}
```

Run `terraform apply` twice and the second run changes nothing, because everything already matches. Change `t3.micro` to `t3.small` and Terraform changes only that setting. Run `terraform destroy` and it deletes the three objects in the right order. This property is called **idempotence**: applying the same configuration again gives the same result.

## How Terraform Works

Terraform is a single binary, the **core**, plus **providers**. The core reads your configuration, builds a dependency graph, keeps the state and computes plans. It knows nothing about AWS or DigitalOcean. Each provider is a separate plugin that the core starts as a child process and talks to over gRPC. The provider knows the API of one platform: which resource types exist, which arguments they take, and how to create, read, update and delete them.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "code", "label": "*.tf files", "sub": "what you want", "icon": "gear", "tone": "slate", "detail": "Your configuration, written in HCL and kept in Git." },
      { "id": "state", "label": "state", "sub": "what Terraform manages", "icon": "database", "tone": "violet", "detail": "terraform.tfstate or a remote backend: the IDs and attributes of every object Terraform created." }
    ],
    [
      { "id": "core", "label": "Terraform core", "sub": "graph, plan, apply", "icon": "cpu", "tone": "accent", "detail": "Compares configuration, state and real objects, then decides what to create, update, replace or delete." }
    ],
    [
      { "id": "aws", "label": "AWS provider", "sub": "plugin", "icon": "box", "tone": "amber" },
      { "id": "do", "label": "DigitalOcean provider", "sub": "plugin", "icon": "box", "tone": "blue" },
      { "id": "gh", "label": "GitHub provider", "sub": "plugin", "icon": "box", "tone": "slate" }
    ],
    [
      { "id": "api", "label": "Platform APIs", "sub": "real infrastructure", "icon": "cloud", "tone": "green" }
    ]
  ],
  "edges": [["code", "core"], ["state", "core"], ["core", "aws", "gRPC"], ["core", "do", "gRPC"], ["core", "gh", "gRPC"], ["aws", "api", "HTTPS"], ["do", "api", "HTTPS"], ["gh", "api", "HTTPS"]]
}
```

`terraform init` downloads the providers your configuration needs from the [Terraform Registry](https://registry.terraform.io/browse/providers), which lists thousands of them: the big clouds, Kubernetes and Helm, DNS and CDN services, monitoring tools, Git hosting, databases, and many SaaS products. If a service has an API, someone has usually written a provider for it.

### Terraform, OpenTofu and the License

HashiCorp, now part of IBM, released Terraform 1.6 and later under the **Business Source License** (BUSL 1.1) instead of the open source MPL 2.0. You can still use it for free to manage your own infrastructure; the license restricts companies that offer Terraform in a paid hosted or embedded product that competes with HashiCorp. In response, the community forked the last MPL version into **OpenTofu**, now a CNCF project. Its `tofu` command reads the same configuration language, uses the same providers and keeps state in the same format, so almost everything in this guide works with either tool. The [guide overview](/guides/introduction-to-terraform#h2-terraform-or-opentofu) explains where they differ.

## Configuration Building Blocks

Terraform code is a set of **blocks**. You meet all of these in later parts:

| Block                        | What it does                                                                          | Part                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `terraform`                  | Settings: required Terraform version, required providers, backend                     | [2](/guides/introduction-to-terraform/02-installation-and-setup)        |
| `provider`                   | Configures a provider: region, credentials source, default tags                       | [2](/guides/introduction-to-terraform/02-installation-and-setup)        |
| `resource`                   | An object Terraform creates and manages: a server, a DNS record, a file               | [4](/guides/introduction-to-terraform/04-resources-and-data-sources)    |
| `data`                       | Reads an object that exists already, without managing it                              | [4](/guides/introduction-to-terraform/04-resources-and-data-sources)    |
| `variable`                   | An input value, set from the command line, a file or the environment                  | [6](/guides/introduction-to-terraform/06-variables-and-outputs)         |
| `output`                     | A value Terraform prints after apply and that other code can read                     | [6](/guides/introduction-to-terraform/06-variables-and-outputs)         |
| `locals`                     | Named expressions you reuse inside one module                                         | [3](/guides/introduction-to-terraform/03-configuration-language-basics) |
| `module`                     | Calls a reusable group of resources                                                   | [7](/guides/introduction-to-terraform/07-modules)                       |
| `moved`, `import`, `removed` | Refactor code, adopt existing objects, or stop managing objects without deleting them | [5](/guides/introduction-to-terraform/05-state-management)              |

A resource block has a **type** and a **name**:

```hcl
resource "aws_instance" "web_server" {
  ami           = var.ami_id
  instance_type = "t3.micro"

  tags = {
    Name = "web-server-01"
  }
}
```

- `aws_instance` is the resource type. The prefix before the first underscore (`aws`) tells Terraform which provider owns it.
- `web_server` is a local name. Together they form the **address** `aws_instance.web_server`, which is unique in the configuration and is how other code refers to it.
- The body sets **arguments**. After creation, the resource also exposes **attributes** that the provider fills in, such as `id`, `public_ip` or `arn`.

## The Dependency Graph

When one block refers to another, for example `subnet_id = aws_subnet.public.id`, Terraform records a dependency. From all the references it builds a graph, and it walks that graph to decide the order:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "aws_vpc.main", "sub": "created first", "icon": "net", "tone": "blue" },
    { "label": "aws_subnet.public", "sub": "needs the VPC ID", "icon": "net", "tone": "blue" },
    { "label": "aws_instance.web", "sub": "needs the subnet ID", "icon": "server", "tone": "amber" }
  ]
}
```

Objects that do not depend on each other are created in parallel (10 at a time by default; `-parallelism=n` changes it). On destroy, Terraform walks the graph backwards: the instance goes first, the VPC last. You rarely need to set the order yourself; [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources) shows the cases where you do.

## State: Terraform's Memory

Terraform must remember which real object belongs to which block. It keeps that mapping in the **state**: a JSON document with the ID and attributes of every object it manages. By default it is a file called `terraform.tfstate` next to your code. Teams keep it in a remote backend such as an S3 bucket or HCP Terraform instead ([Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration)).

On every plan, Terraform compares three things:

1. **The configuration**: what you want.
2. **The state**: what Terraform created last time.
3. **The real objects**: Terraform asks the provider to read each object in the state again (a **refresh**), so it notices changes someone made in the console.

The plan is the difference between what you want and what exists. State is also why you never delete `terraform.tfstate` casually: without it, Terraform no longer knows it owns those servers and tries to create them again. [Part 5](/guides/introduction-to-terraform/05-state-management) covers state in depth.

## The Core Workflow

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Write", "sub": "edit *.tf files", "icon": "gear", "tone": "slate" },
    { "label": "terraform init", "sub": "download providers and modules", "icon": "box", "tone": "blue" },
    { "label": "terraform plan", "sub": "preview the changes", "icon": "activity", "tone": "amber" },
    { "label": "Review", "sub": "read every line", "icon": "check", "tone": "violet" },
    { "label": "terraform apply", "sub": "make the changes", "icon": "rocket", "tone": "green" }
  ]
}
```

1. **Write** or change `.tf` files.
2. **`terraform init`** prepares the working directory: it downloads providers and modules and configures the backend. Run it once per directory, and again after you add a provider or module.
3. **`terraform plan`** shows what would change. Nothing is changed yet.
4. **Review** the plan. This is the step that prevents outages.
5. **`terraform apply`** computes the plan again, asks for confirmation and makes the changes. In automation you save the plan with `plan -out=tfplan` and apply exactly that file.

`terraform destroy` deletes everything the configuration manages. It is a shortcut for `terraform apply -destroy`.

## Reading a Plan

A plan uses a symbol for each kind of change. The output below is from a real run of Terraform 1.17 on a small project that uses Terraform's built-in `terraform_data` resource and the `random` provider, so it needs no cloud account. After a first `apply`, four things changed in the configuration: the default of `app_version` went from `1.4.0` to `1.5.0`, the default of `image` went from `ubuntu-24.04` to `ubuntu-26.04`, a block called `old_cache` was deleted, and the `dns` block was added. This is the configuration after those edits:

```hcl
variable "app_version" {
  type    = string
  default = "1.5.0"
}

variable "image" {
  type    = string
  default = "ubuntu-26.04"
}

resource "random_pet" "server" {
  length = 2
}

resource "terraform_data" "app" {
  input = var.app_version
}

resource "terraform_data" "server" {
  input            = random_pet.server.id
  triggers_replace = var.image
}

resource "terraform_data" "dns" {
  input = "${random_pet.server.id}.example.com"
}
```

Terraform compares it with the state and prints the plan:

```bash
terraform plan
```

```text
terraform_data.old_cache: Refreshing state... [id=9b694bda-0a01-ba9d-0523-47d97100c21f]
terraform_data.app: Refreshing state... [id=bb4c25a8-fe79-752f-92b8-44a785613e58]
random_pet.server: Refreshing state... [id=patient-squid]
terraform_data.server: Refreshing state... [id=97e02ae2-b57a-6415-e5dc-cf658a6ad8de]

Terraform used the selected providers to generate the following execution
plan. Resource actions are indicated with the following symbols:
  + create
  ~ update in-place
  - destroy
-/+ destroy and then create replacement

Terraform will perform the following actions:

  # terraform_data.app will be updated in-place
  ~ resource "terraform_data" "app" {
        id     = "bb4c25a8-fe79-752f-92b8-44a785613e58"
      ~ input  = "1.4.0" -> "1.5.0"
      ~ output = "1.4.0" -> (known after apply)
    }

  # terraform_data.dns will be created
  + resource "terraform_data" "dns" {
      + id     = (known after apply)
      + input  = "patient-squid.example.com"
      + output = (known after apply)
    }

  # terraform_data.old_cache will be destroyed
  # (because terraform_data.old_cache is not in configuration)
  - resource "terraform_data" "old_cache" {
      - id     = "9b694bda-0a01-ba9d-0523-47d97100c21f" -> null
      - input  = "cache-v1" -> null
      - output = "cache-v1" -> null
    }

  # terraform_data.server must be replaced
-/+ resource "terraform_data" "server" {
      ~ id               = "97e02ae2-b57a-6415-e5dc-cf658a6ad8de" -> (known after apply)
      ~ output           = "patient-squid" -> (known after apply)
      ~ triggers_replace = "ubuntu-24.04" -> "ubuntu-26.04"
        # (1 unchanged attribute hidden)
    }

Plan: 2 to add, 1 to change, 2 to destroy.

─────────────────────────────────────────────────────────────────────────────

Note: You didn't use the -out option to save this plan, so Terraform can't
guarantee to take exactly these actions if you run "terraform apply" now.
```

Terraform lists the changes in alphabetical order of address. Read them one by one:

- **`+` create**: `terraform_data.dns` is new in the configuration. Values that only exist after creation, such as the `id`, show as `(known after apply)`.
- **`~` update in-place**: `app_version` changed from `1.4.0` to `1.5.0`, and the provider can change that setting on the existing object.
- **`-` destroy**: `terraform_data.old_cache` is still in the state but no longer in the configuration, so Terraform deletes it. The plan says so in the line under the address.
- **`-/+` destroy and then create replacement**: `triggers_replace` changed, and for `terraform_data` any change to that argument means a new object. Provider resources work the same way for arguments that cannot be changed on a live object (the image of a server, the name of an S3 bucket, the engine of a database), and the plan marks the argument that causes it with `# forces replacement`. This is the line to look for before you approve a plan, because replacing a database or a server can mean downtime or data loss.
- The summary line counts a replacement as one add and one destroy: **2 to add, 1 to change, 2 to destroy**.

Two more symbols appear in some plans: `<=` means a data source is read during apply (because it depends on something that does not exist yet), and `+/-` means create the replacement first, then destroy the old object (`create_before_destroy`, covered in [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources)).

## Immutable Infrastructure

Terraform encourages replacing objects instead of changing them in place. Instead of logging in to a server to upgrade packages, you build a new image (with [Packer](/guides/introduction-to-packer), for example), change the image ID in the code, and let Terraform replace the server. Every server then matches the code, nobody wonders what was changed by hand, and rolling back means applying the previous commit.

You do not have to follow this everywhere: databases and storage buckets are usually long-lived and updated in place, and Terraform tells you in the plan which changes replace an object.

## Data Sources: Reading What Exists

A `data` block reads an object that Terraform does not manage, so you can use its attributes:

```hcl
# The newest Ubuntu 24.04 LTS image published by Canonical
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}
```

Typical uses: look up the latest machine image, a network created by another team, the current account ID or region, or a secret. Data sources never create, change or delete anything. [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources) shows more of them.

## When Terraform Is the Right Tool

Terraform is built for **provisioning**: creating and wiring together long-lived infrastructure through APIs. Other jobs have better tools:

- **Configuring software inside a server** (packages, files, services): use a machine image built with Packer, cloud-init, or a configuration management tool such as Ansible.
- **Deploying application releases** many times a day: use your platform's deployment tooling (Kubernetes with Helm or Argo CD, ECS, a PaaS). Terraform can create the cluster; it should not run every release.
- **One-off tasks** (rotate a log file, restart a service): a script or a runbook.

If you only use AWS, CloudFormation is the built-in alternative; if you prefer a general-purpose language, look at Pulumi or the AWS CDK. The [Terraform vs CloudFormation](/comparisons/terraform-vs-cloudformation), [Terraform vs Pulumi](/comparisons/terraform-vs-pulumi) and [Terraform vs OpenTofu](/comparisons/terraform-vs-opentofu) comparisons go through the trade-offs.

## Common Mistakes

- **Changing managed resources by hand.** A console edit makes the real object differ from the code (**drift**). The next plan tries to undo it. Change the code instead.
- **Approving a plan you did not read.** Look for `-/+` and `-` lines on anything that holds data.
- **Treating state as a cache you can delete.** Without it, Terraform loses track of what it owns.
- **Expecting Terraform to manage what is inside a server.** Terraform creates the server; a machine image or a configuration tool sets it up.

## Summary

- You describe the desired end state in HCL; Terraform computes the steps.
- The core builds a dependency graph and talks to providers, one plugin per platform.
- State maps your blocks to real objects; every plan compares code, state and reality.
- `init`, `plan`, review, `apply` is the workflow for every change, large or small.
- Plan symbols: `+` create, `~` update, `-/+` replace, `-` destroy, `<=` read.

In [Part 2](/guides/introduction-to-terraform/02-installation-and-setup) you install Terraform and run this workflow yourself.

## Keep Learning

- [Infrastructure as Code: A Beginner's Guide to IaC Fundamentals](/posts/infrastructure-as-code-fundamentals)
- [How are data sources used in Terraform?](/posts/how-are-data-sources-used-in-terraform)
- [Terraform Basics flashcards](/flashcards/terraform-basics)
- [Interview question: Infrastructure as Code patterns](/interview-questions/mid/infrastructure-as-code-patterns)
