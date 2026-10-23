---
title: 'Terraform Resources, Data Sources and Meta-Arguments'
description: 'Create Terraform resources, read data sources, set dependencies, and use count, for_each and lifecycle rules such as prevent_destroy and ignore_changes.'
order: 4
---

**TLDR**: A `resource` block creates and manages one kind of object; a `data` block reads an object that exists already. References between blocks set the order, and `depends_on` adds a dependency Terraform cannot see. **Meta-arguments** work on every resource: `count` and `for_each` create several copies, `provider` picks a provider configuration, and `lifecycle` changes how Terraform replaces or deletes the object (`create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`, preconditions and postconditions).

Resources are what you spend most of your time writing. This part builds a small web server on AWS to show how resources and data sources fit together, then runs the meta-arguments for real on a local project, so you can see exactly what the plan and apply output look like.

## Prerequisites

- Terraform installed ([Part 2](/guides/introduction-to-terraform/02-installation-and-setup)) and the HCL basics from [Part 3](/guides/introduction-to-terraform/03-configuration-language-basics).
- For the AWS example: an AWS account and credentials. Everything else runs locally.

## Providers and Resource Types

Every resource type belongs to a provider. You declare the provider in `required_providers` and configure it with a `provider` block:

```hcl
terraform {
  required_version = ">= 1.17"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }
}

provider "aws" {
  region = var.region

  # Added to every resource that supports tags
  default_tags {
    tags = {
      Project   = "webapp"
      ManagedBy = "terraform"
    }
  }
}

# A second configuration of the same provider, for resources that must live in another Region
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

A resource that needs the second configuration selects it with the `provider` meta-argument, for example an ACM certificate for CloudFront, which AWS only accepts in `us-east-1`:

```hcl
resource "aws_acm_certificate" "cdn" {
  provider          = aws.us_east_1
  domain_name       = "www.example.com"
  validation_method = "DNS"
}
```

The provider's documentation on the [Terraform Registry](https://registry.terraform.io/providers/hashicorp/aws/latest/docs) lists every resource type, its arguments (what you set) and its attributes (what you can read after creation). Keep it open while you write code.

## A Web Server on AWS

This configuration builds a network with two public subnets and one web server that installs Nginx at first boot. It uses the provider configuration above and these variables:

```hcl
variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}
```

First the data sources. They read information at plan time and create nothing:

```hcl
# Availability Zones that are usable in this Region
data "aws_availability_zones" "available" {
  state = "available"
}

# The newest Ubuntu 24.04 LTS image from Canonical
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical's AWS account

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
```

Then the network. `for_each` creates one subnet per Availability Zone, and `cidrsubnet` gives each one its own `/24`:

```hcl
locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = {
    Name = "webapp-vpc"
  }
}

resource "aws_subnet" "public" {
  for_each = toset(local.azs)

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, index(local.azs, each.key) + 1)
  map_public_ip_on_launch = true

  tags = {
    Name = "webapp-public-${each.key}"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}
```

The security group allows HTTP and HTTPS in and everything out. Each rule is its own resource, as the AWS provider recommends:

```hcl
resource "aws_security_group" "web" {
  name        = "webapp-web"
  description = "Web server"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "web" {
  for_each = toset(["80", "443"])

  security_group_id = aws_security_group.web.id
  description       = "TCP ${each.key} from anywhere"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.key)
  to_port           = tonumber(each.key)
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  description       = "All outbound traffic"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
```

Finally the server and two outputs:

```hcl
resource "aws_instance" "web" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[local.azs[0]].id
  vpc_security_group_ids = [aws_security_group.web.id]

  # Require IMDSv2 tokens for the instance metadata service
  metadata_options {
    http_tokens = "required"
  }

  user_data = <<-EOT
    #!/bin/bash
    apt-get update
    apt-get install -y nginx
  EOT

  # user_data runs apt-get at first boot: it needs the internet route and the
  # outbound rule (Terraform removes the security group's default egress rule)
  depends_on = [
    aws_route_table_association.public,
    aws_vpc_security_group_egress_rule.all,
  ]

  tags = {
    Name = "webapp-web"
  }
}

output "web_url" {
  value = "http://${aws_instance.web.public_dns}"
}

output "ami_name" {
  value = data.aws_ami.ubuntu.name
}
```

Every code block in this part passes `terraform validate` with AWS provider 6.70. Together, the providers, variables, data sources, network, security group and server files above create 12 objects (the certificate is a separate example), and the server answers on the `web_url` output a minute or two after `terraform apply`. Run `terraform destroy` when you are done.

## Dependencies

Terraform reads the references in that configuration and builds this graph. Objects in the same column have no dependency on each other, so Terraform creates them in parallel:

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "vpc", "label": "aws_vpc.main", "icon": "net", "tone": "blue" },
      { "id": "azs", "label": "data.aws_availability_zones", "icon": "globe", "tone": "slate" },
      { "id": "ami", "label": "data.aws_ami.ubuntu", "icon": "box", "tone": "slate" }
    ],
    [
      { "id": "subnet", "label": "aws_subnet.public", "sub": "x2, for_each", "icon": "net", "tone": "blue" },
      { "id": "igw", "label": "aws_internet_gateway", "icon": "globe", "tone": "blue" },
      { "id": "sg", "label": "aws_security_group.web", "icon": "shield", "tone": "red" }
    ],
    [
      { "id": "rt", "label": "aws_route_table.public", "icon": "net", "tone": "blue" },
      { "id": "rules", "label": "security group rules", "sub": "x3", "icon": "shield", "tone": "red" }
    ],
    [
      { "id": "assoc", "label": "route table associations", "sub": "x2", "icon": "net", "tone": "blue" }
    ],
    [
      { "id": "web", "label": "aws_instance.web", "icon": "server", "tone": "amber", "detail": "Waits for the subnet, the security group and the AMI lookup and, through depends_on, for the route table associations and the outbound rule." }
    ]
  ],
  "edges": [["vpc", "subnet"], ["azs", "subnet"], ["vpc", "igw"], ["vpc", "sg"], ["igw", "rt"], ["vpc", "rt"], ["sg", "rules"], ["subnet", "assoc"], ["rt", "assoc"], ["assoc", "web", "depends_on"], ["rules", "web", "depends_on"], ["subnet", "web"], ["sg", "web"], ["ami", "web"]]
}
```

References cover almost every case. Add `depends_on` only when a dependency is real but invisible in the code. In the example, the instance does not refer to the route table or to the outbound rule, but its boot script needs both to download Nginx: the internet route, and outbound traffic, which a security group managed by Terraform only allows once the egress rule exists. `depends_on` makes Terraform create those first. `depends_on` takes whole resources or modules, never single attributes, and it makes plans more conservative, so use it sparingly.

You can draw the graph of any configuration with `terraform graph`. Since Terraform 1.16 it also writes [Mermaid](https://mermaid.js.org/), which GitHub and many wikis render. Here is the graph of a small local project used in the next sections. Create a directory called `resources` with this `main.tf`, in which a configuration file depends on a random name and a deployment step depends on the file:

```hcl
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.9"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}

variable "release" {
  type    = string
  default = "v1"
}

resource "random_pet" "app" {
  length = 2
}

resource "local_file" "config" {
  filename = "${path.module}/app.conf"
  content  = "name=${random_pet.app.id}\nrelease=${var.release}\n"
}

# Stands in for a deployment step: runs a command when it is created
resource "terraform_data" "deploy" {
  input = local_file.config.content_sha256

  provisioner "local-exec" {
    command = "echo deploying ${random_pet.app.id}"
  }

  lifecycle {
    replace_triggered_by = [local_file.config]
  }
}
```

After `terraform init`, draw the graph:

```terminal
{
  "title": "terraform graph",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform graph -format=mermaid",
      "output": "flowchart LR\n  local_file.config[\"local_file.config\"]\n  random_pet.app[\"random_pet.app\"]\n  terraform_data.deploy[\"terraform_data.deploy\"]\n  local_file.config --> random_pet.app\n  terraform_data.deploy --> local_file.config"
    }
  ]
}
```

Each arrow points from a resource to something it depends on: the file needs the name, and the deployment step needs the file. Without `-format`, `terraform graph` writes the Graphviz DOT format; pipe it to `dot -Tsvg > graph.svg` if you have Graphviz installed.

## Meta-Arguments on a Local Project

The rest of this part runs on your own machine. `local_file`, `random_pet` and Terraform's built-in `terraform_data` resource behave like cloud resources in every way that matters here: they are created, updated, replaced and destroyed, and they live in the state.

### Provisioners and replace_triggered_by

`terraform_data.deploy` above has a **provisioner**: a command Terraform runs on the machine where it runs (`local-exec`) or on a new server over SSH (`remote-exec`) after creating the resource. Apply the project:

```terminal
{
  "title": "apply with a local-exec provisioner (end of the output)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve",
      "output": "random_pet.app: Creating...\nrandom_pet.app: Creation complete after 0s [id=better-chimp]\nlocal_file.config: Creating...\nlocal_file.config: Creation complete after 0s [id=a29baebed8717f0b6d6634dd4d3d202e7b8f7d1e]\nterraform_data.deploy: Creating...\nterraform_data.deploy: Provisioning with 'local-exec'...\nterraform_data.deploy (local-exec): Executing: [\"/bin/sh\" \"-c\" \"echo deploying better-chimp\"]\nterraform_data.deploy (local-exec): deploying better-chimp\nterraform_data.deploy: Creation complete after 2s [id=25e61b9c-f551-a067-5673-b450608baf07]\n\nApply complete! Resources: 3 added, 0 changed, 0 destroyed."
    }
  ]
}
```

Now change the release. `local_file.config` must be replaced because its content changes, and `replace_triggered_by` replaces `terraform_data.deploy` with it, which runs the provisioner again:

```terminal
{
  "title": "replace_triggered_by in a plan",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -no-color -var release=v2 | grep -E '^  #|^Plan'",
      "output": "  # local_file.config must be replaced\n  # terraform_data.deploy will be replaced due to changes in replace_triggered_by\nPlan: 2 to add, 0 to change, 2 to destroy."
    }
  ]
}
```

The `grep` keeps only the summary lines of each change. Provisioners are a last resort: Terraform cannot plan what a script does, a failed script **taints** the resource (it is replaced on the next apply), and the script does not run again unless the resource is replaced. To configure servers, prefer a machine image or cloud-init `user_data`; to run a command when something changes, use an [action](#h3-actions) or your CI pipeline.

### count and for_each

`count` creates a number of copies and gives each an index; `for_each` takes a map or a set of strings and gives each copy a key. In a new directory, `copies`, this `main.tf` creates the same three files both ways:

```hcl
variable "sites" {
  type    = list(string)
  default = ["blog", "shop", "docs"]
}

resource "local_file" "by_count" {
  count    = length(var.sites)
  filename = "${path.module}/count/${var.sites[count.index]}.conf"
  content  = "server_name ${var.sites[count.index]}.example.com;\n"
}

resource "local_file" "by_key" {
  for_each = toset(var.sites)
  filename = "${path.module}/for_each/${each.key}.conf"
  content  = "server_name ${each.key}.example.com;\n"
}

output "count_files" {
  value = local_file.by_count[*].filename
}

output "for_each_files" {
  value = { for site, f in local_file.by_key : site => f.filename }
}
```

```terminal
{
  "title": "create the copies",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init"
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "\nOutputs:\n\ncount_files = [\n  \"./count/blog.conf\",\n  \"./count/shop.conf\",\n  \"./count/docs.conf\",\n]\nfor_each_files = {\n  \"blog\" = \"./for_each/blog.conf\"\n  \"docs\" = \"./for_each/docs.conf\"\n  \"shop\" = \"./for_each/shop.conf\"\n}"
    },
    {
      "cmd": "terraform state list",
      "output": "local_file.by_count[0]\nlocal_file.by_count[1]\nlocal_file.by_count[2]\nlocal_file.by_key[\"blog\"]\nlocal_file.by_key[\"docs\"]\nlocal_file.by_key[\"shop\"]"
    }
  ]
}
```

The addresses tell the story: `by_count[0]` to `by_count[2]` are numbered, `by_key["blog"]` and friends are named. Now remove `blog`, the first site, and plan:

```terminal
{
  "title": "remove the first item",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -no-color -var 'sites=[\"shop\", \"docs\"]' | grep -E '^  #|^Plan'",
      "output": "  # local_file.by_count[0] must be replaced\n  # local_file.by_count[1] must be replaced\n  # local_file.by_count[2] will be destroyed\n  # (because index [2] is out of range for count)\n  # local_file.by_key[\"blog\"] will be destroyed\n  # (because key [\"blog\"] is not in for_each map)\nPlan: 2 to add, 0 to change, 4 to destroy."
    }
  ]
}
```

With `count`, every element after the removed one shifts down by one index: `by_count[0]` now has to become `shop`, `by_count[1]` becomes `docs`, and `by_count[2]` is deleted. Three changes for one removal, and for real servers or databases "must be replaced" means downtime or data loss. With `for_each`, only `by_key["blog"]` goes away.

The rules that follow:

- Use **`for_each`** whenever the copies have an identity (a name, a region, a user). Keys must be known at plan time, so build them from variables and literals, not from attributes of resources that do not exist yet.
- Use **`count`** for "N identical things" and for the on/off switch `count = var.create_dns ? 1 : 0`. Refer to the optional resource with `one(aws_route53_record.www[*].fqdn)` or `aws_route53_record.www[0]`.
- To switch an existing resource from `count` to `for_each` without recreating anything, use `moved` blocks ([Part 5](/guides/introduction-to-terraform/05-state-management#h3-rename-with-a-moved-block)).
- More patterns are in [How to Reference Resources Created With for_each](/posts/terraform-referencing-for-each-resources) and [How to Get List Index When Using for_each](/posts/terraform-get-list-index-for-each).

### lifecycle

The `lifecycle` block changes how Terraform handles one resource. The next examples use another new directory, `lifecycle`, with this `main.tf`:

```hcl
variable "image" {
  type    = string
  default = "ubuntu-24.04"
}

# Stands in for a server: a new name whenever the image changes
resource "random_pet" "server" {
  keepers = {
    image = var.image
  }

  lifecycle {
    create_before_destroy = true

    precondition {
      condition     = startswith(var.image, "ubuntu-")
      error_message = "Only Ubuntu images are supported, got \"${var.image}\"."
    }
  }
}

# Stands in for a database you must never delete by accident
resource "local_file" "database" {
  filename = "${path.module}/database.txt"
  content  = "important data\n"

  lifecycle {
    prevent_destroy = true
  }
}
```

```terminal
{
  "title": "the starting point",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init"
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 2 added, 0 changed, 0 destroyed."
    }
  ]
}
```

**`create_before_destroy`**. By default, Terraform deletes the old object before it creates the replacement. For a server behind a load balancer, that is downtime. With `create_before_destroy`, the plan shows `+/-` and the old object is kept (as a "deposed" object) until the new one exists:

```terminal
{
  "title": "create_before_destroy",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve -var image=ubuntu-26.04",
      "output": "local_file.database: Refreshing state... [id=6f7857f54de73fbaa36b94c29c7965e041f7f996]\nrandom_pet.server: Refreshing state... [id=suitable-lionfish]\n\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n+/- create replacement and then destroy\n\nTerraform will perform the following actions:\n\n  # random_pet.server must be replaced\n+/- resource \"random_pet\" \"server\" {\n      ~ id        = \"suitable-lionfish\" -> (known after apply)\n      ~ keepers   = { # forces replacement\n          ~ \"image\" = \"ubuntu-24.04\" -> \"ubuntu-26.04\"\n        }\n        # (2 unchanged attributes hidden)\n    }\n\nPlan: 1 to add, 0 to change, 1 to destroy.\nrandom_pet.server: Creating...\nrandom_pet.server: Creation complete after 0s [id=rapid-wasp]\nrandom_pet.server (deposed object 832e56d9): Destroying... [id=suitable-lionfish]\nrandom_pet.server: Destruction complete after 0s\n\nApply complete! Resources: 1 added, 0 changed, 1 destroyed."
    }
  ]
}
```

Two warnings: the new object must be able to exist next to the old one (a fixed name that must be unique, such as an S3 bucket name or a security group name, breaks this, so use `name_prefix` where the provider offers it), and the setting spreads to the resources it depends on.

**`precondition` and `postcondition`**. A precondition is checked before Terraform plans the resource and stops the run with your message. A postcondition checks the result after a resource or data source is read or created, for example that an AMI lookup returned an image for the right CPU architecture:

```terminal
{
  "title": "a failing precondition",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -var image=debian-13",
      "output": "local_file.database: Refreshing state... [id=6f7857f54de73fbaa36b94c29c7965e041f7f996]\nrandom_pet.server: Refreshing state... [id=rapid-wasp]\n\nPlanning failed. Terraform encountered an error while generating this plan.\n\n╷\n│ Error: Resource precondition failed\n│\n│   on main.tf line 16, in resource \"random_pet\" \"server\":\n│   16:       condition     = startswith(var.image, \"ubuntu-\")\n│     ├────────────────\n│     │ var.image is \"debian-13\"\n│\n│ Only Ubuntu images are supported, got \"debian-13\".\n╵"
    }
  ]
}
```

Use variable validation ([Part 6](/guides/introduction-to-terraform/06-variables-and-outputs#h2-validate-input)) for rules about one input, and preconditions for rules that combine inputs with data sources or other resources.

**`prevent_destroy`**. Any plan that would delete the object fails, including `terraform destroy`:

```terminal
{
  "title": "prevent_destroy (end of the output)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform destroy -auto-approve",
      "output": "╷\n│ Error: Instance cannot be destroyed\n│\n│   on main.tf line 23:\n│   23: resource \"local_file\" \"database\" {\n│\n│ Resource local_file.database has lifecycle.prevent_destroy set, but the\n│ plan calls for this resource to be destroyed. To avoid this error and\n│ continue with the plan, either disable lifecycle.prevent_destroy or reduce\n│ the scope of the plan using the -target option.\n╵"
    }
  ]
}
```

It protects against mistakes in code and in commands. It does not protect against someone deleting the block together with its `lifecycle` setting, and it does not stop deletion in the cloud console, so also turn on the provider's own protection where it exists (`deletion_protection` on RDS and load balancers, `disable_api_termination` on EC2).

**`ignore_changes`**. Tells Terraform to stop comparing some arguments, for values that something else manages on purpose:

```hcl
resource "aws_autoscaling_group" "web" {
  name_prefix         = "webapp-"
  min_size            = 2
  max_size            = 10
  vpc_zone_identifier = [for s in aws_subnet.public : s.id]

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }

  lifecycle {
    # Scaling policies change the desired capacity at runtime
    ignore_changes = [desired_capacity]
  }
}

resource "aws_launch_template" "web" {
  name_prefix   = "webapp-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  metadata_options {
    http_tokens = "required"
  }
}
```

`ignore_changes = all` turns Terraform into a "create once" tool for that resource. Use it rarely, because drift in ignored arguments becomes invisible.

**`replace_triggered_by`** replaces the resource when another resource or attribute changes, as `terraform_data.deploy` showed above.

**`destroy = false`** (Terraform 1.16 and later) makes Terraform forget the object instead of deleting it when the resource is replaced, when you run `terraform destroy`, or when an instance drops out of `count` or `for_each`. The setting lives in the resource block, so deleting the whole block deletes the protection too; to stop managing a resource you remove from the code, use a `removed` block, shown in [Part 5](/guides/introduction-to-terraform/05-state-management#h3-stop-managing-an-object-without-deleting-it).

### Actions

Terraform 1.14 added **actions**: operations a provider defines that are not create, read, update or delete. Examples in the big providers are invalidating a CloudFront cache, invoking a Lambda function or stopping an EC2 instance. You declare an `action` block and trigger it from a resource's lifecycle or run it on demand with `terraform apply -invoke=action.<type>.<name>`. The `local` provider ships `local_command`. In a new directory, `actions`:

```hcl
resource "local_file" "page" {
  filename = "${path.module}/index.html"
  content  = "<h1>Hello</h1>\n"

  lifecycle {
    action_trigger {
      events  = [after_create, after_update]
      actions = [action.local_command.purge_cache]
    }
  }
}

action "local_command" "purge_cache" {
  config {
    command   = "echo"
    arguments = ["cache purged for index.html"]
  }
}
```

```terminal
{
  "title": "an action triggered after create",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init"
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Terraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n  + create\n\nTerraform will perform the following actions:\n\n  # local_file.page will be created\n  + resource \"local_file\" \"page\" {\n      + content              = <<-EOT\n            <h1>Hello</h1>\n        EOT\n      + content_base64sha256 = (known after apply)\n      + content_base64sha512 = (known after apply)\n      + content_md5          = (known after apply)\n      + content_sha1         = (known after apply)\n      + content_sha256       = (known after apply)\n      + content_sha512       = (known after apply)\n      + directory_permission = \"0777\"\n      + file_permission      = \"0777\"\n      + filename             = \"./index.html\"\n      + id                   = (known after apply)\n    }\n\n    # Actions to be invoked after this change in order:\n    # action.local_command.purge_cache\n    action \"local_command\" \"purge_cache\" {\n        config {\n            arguments = [\n                \"cache purged for index.html\",\n            ]\n            command   = \"echo\"\n        }\n    }\n\n\nPlan: 1 to add, 0 to change, 0 to destroy. Actions: 1 to invoke.\nlocal_file.page: Creating...\nAction started: action.local_command.purge_cache (triggered by local_file.page)\nAction action.local_command.purge_cache (triggered by local_file.page):\n\ncache purged for index.html\n\n\nAction complete: action.local_command.purge_cache (triggered by local_file.page)\nlocal_file.page: Creation complete after 0s [id=3d31058e6d934226269e50c4b1447ca1be16b544]\n\nApply complete! Resources: 1 added, 0 changed, 0 destroyed. Actions: 1 invoked."
    }
  ]
}
```

The plan counts actions separately ("Actions: 1 to invoke"). Actions replace many uses of provisioners and `terraform_data` tricks, but only where a provider offers the action you need.

## Data Sources

A data source reads information during the plan. You have seen `aws_ami` and `aws_availability_zones`; these are also common:

```hcl
# Who and where am I?
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# A VPC created by another team or another Terraform configuration, found by tag
data "aws_vpc" "shared" {
  tags = {
    Name = "shared-services"
  }
}

data "aws_subnets" "shared_private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.shared.id]
  }

  tags = {
    Tier = "private"
  }

  lifecycle {
    postcondition {
      condition     = length(self.ids) > 0
      error_message = "No private subnets found in the shared VPC."
    }
  }
}

output "deploy_target" {
  value = "${data.aws_caller_identity.current.account_id} in ${data.aws_region.current.region}"
}
```

A data source that looks up one object, such as `aws_vpc` or `aws_ami`, fails the plan when it finds nothing, and also when it finds more than one match unless it has a way to pick one (`most_recent = true` on `aws_ami` picks the newest image). That is usually what you want: the code depends on that object existing. Lookups that return a list, such as `aws_subnets`, succeed with an empty list instead, so add a `postcondition` when you need at least one result, as `aws_subnets.shared_private` does above. Two habits help:

- **Filter precisely.** `most_recent = true` plus a name pattern and an `owners` list for images; tags or names for networks.
- **Avoid data sources for things in the same configuration.** If Terraform creates the VPC, refer to `aws_vpc.main` directly. A data source that reads it back depends on timing and can fail on the first apply.

When a data source depends on a resource that changes in the same plan, Terraform reads it during apply instead and shows it with `<=` in the plan. The post [How are data sources used in Terraform?](/posts/how-are-data-sources-used-in-terraform) has more examples.

## Targeting and Forcing Replacement

Two flags change what one run does without changing the code:

- `terraform apply -replace=aws_instance.web` replaces one object even though nothing changed, for example a server in a bad state. It replaces the old `terraform taint` command.
- `terraform apply -target=aws_instance.web` limits the run to one resource and its dependencies. Terraform prints a warning every time, because the rest of the configuration is not checked. Use it to recover from errors, not as a habit. The post [I would like to run Terraform only for a specific resource](/posts/i-would-like-to-run-terraform-only-for-a-specific-resource) covers the details.

## Common Mistakes

- **Using `count` for things with an identity.** Removing one element shifts every index after it. Use `for_each`.
- **`for_each` over values unknown at plan time.** `for_each = toset(aws_instance.web[*].id)` fails on the first plan. Use keys you write yourself.
- **Hard-coded image IDs.** AMI IDs differ per Region and go stale. Look them up with a data source or pass them in from your image pipeline.
- **Unique names plus `create_before_destroy`.** The new object cannot be created while the old one holds the name.
- **Provisioners for configuration management.** They run once, are not planned, and taint resources when they fail.

## Summary

- Resources create and manage objects; data sources read existing ones.
- References define the order; `depends_on` covers hidden dependencies; `terraform graph -format=mermaid` draws it.
- Prefer `for_each` over `count` for anything with an identity.
- `lifecycle` controls replacement order (`create_before_destroy`), safety (`prevent_destroy`, preconditions), drift you accept (`ignore_changes`) and linked replacement (`replace_triggered_by`).
- Actions run provider-defined operations from the lifecycle of a resource or on demand.

In [Part 5](/guides/introduction-to-terraform/05-state-management) you look inside the state that records all of these objects.

## Keep Learning

- [AWS VPC with Terraform](/exercises/terraform-aws-vpc) exercise
- [How to create an SSH key in Terraform?](/posts/how-to-create-an-ssh-key-in-terraform)
- [Can Terraform Be Used to Provision On-Premises Servers?](/posts/terraform-on-premises-servers)
- [Build a Terraform Provider for Your API with the Plugin Framework](/posts/build-a-terraform-provider-plugin-framework)
