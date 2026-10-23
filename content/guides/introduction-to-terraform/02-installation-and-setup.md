---
title: 'How to Install Terraform and Run Your First Apply'
description: 'Install Terraform 1.17 on Linux, macOS or Windows, verify the download, set up cloud credentials, and run init, plan, apply and destroy on a first project.'
order: 2
---

**TLDR**: On Ubuntu or Debian, add HashiCorp's apt repository and run `sudo apt install terraform`. On macOS, run `brew install hashicorp/tap/terraform`. On Windows, run `winget install --id Hashicorp.Terraform -e`. Or download the zip from releases.hashicorp.com, check its SHA-256 sum and put the `terraform` binary on your `PATH`. Then create a directory with a `main.tf` file and run `terraform init`, `terraform plan`, `terraform apply` and `terraform destroy`. Your first project in this part needs no cloud account.

Terraform is a single binary with no runtime dependencies. This part installs it, checks the download, runs the full workflow on a project that only creates local files, sets up credentials for the major clouds, and then shows the same workflow with a real cloud server.

## Prerequisites

- A Linux, macOS or Windows machine where you can install software.
- A terminal and a text editor. The HashiCorp Terraform extension for VS Code (or the Terraform language server in any editor) gives you syntax highlighting, completion and formatting.
- [Part 1](/guides/introduction-to-terraform/01-terraform-fundamentals) explains the concepts used here.

## Which Version to Install

Install the current release, **Terraform 1.17.0** (released on 21 October 2026). HashiCorp ships a minor release every few months and patch releases in between; the previous minor line still gets fixes for a while (1.16.7 came out the day after 1.17.0). Within 1.x, HashiCorp promises that configurations written for an earlier 1.x release keep working, so upgrading is usually safe, but read the upgrade notes of each minor release.

If you prefer the open source fork, install **OpenTofu 1.13** instead. Its command is `tofu`, and you can replace `terraform` with `tofu` in nearly every command in this guide. The [guide overview](/guides/introduction-to-terraform#h2-terraform-or-opentofu) explains the differences.

## Install Terraform

Pick your platform. Every option installs the same `terraform` binary.

```tabs
{
  "title": "Install Terraform 1.17",
  "tabs": [
    {
      "label": "Ubuntu / Debian",
      "lang": "bash",
      "code": "# Add HashiCorp's signing key and apt repository\nwget -O - https://apt.releases.hashicorp.com/gpg | \\\n  sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg\n\necho \"deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(grep -oP '(?<=UBUNTU_CODENAME=).*' /etc/os-release || lsb_release -cs) main\" | \\\n  sudo tee /etc/apt/sources.list.d/hashicorp.list\n\nsudo apt update && sudo apt install terraform"
    },
    {
      "label": "RHEL / Rocky / Alma",
      "lang": "bash",
      "code": "sudo yum install -y yum-utils\nsudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo\nsudo yum -y install terraform\n\n# Amazon Linux uses its own repository file:\n# sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo"
    },
    {
      "label": "Fedora",
      "lang": "bash",
      "code": "wget -O- https://rpm.releases.hashicorp.com/fedora/hashicorp.repo | \\\n  sudo tee /etc/yum.repos.d/hashicorp.repo\nsudo dnf -y install terraform"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# Homebrew's main repository no longer has Terraform; use HashiCorp's tap\nbrew tap hashicorp/tap\nbrew install hashicorp/tap/terraform\n\n# Upgrade later with\nbrew upgrade hashicorp/tap/terraform"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Option 1: winget\nwinget install --id Hashicorp.Terraform -e\n\n# Option 2: Chocolatey (community package)\nchoco install terraform\n\n# Option 3: download terraform_1.17.0_windows_amd64.zip from\n# https://releases.hashicorp.com/terraform/1.17.0/ and add the folder to your PATH"
    },
    {
      "label": "OpenTofu",
      "lang": "bash",
      "code": "# macOS or Linux with Homebrew\nbrew install opentofu\n\n# Windows\nwinget install --id OpenTofu.Tofu -e\n\n# Debian, Ubuntu, RHEL and others: see the packages and the installer script at\n# https://opentofu.org/docs/intro/install/"
    }
  ]
}
```

### Notes per Platform

**Ubuntu and Debian.** The commands store HashiCorp's key in its own keyring file and reference it with `signed-by`, so the key is trusted for this repository only. Older tutorials use `apt-key add`. `apt-key` is deprecated and newer releases no longer ship it, so use the commands above. The same repository also provides `packer`, `vault` and HashiCorp's other tools.

**macOS.** After the license change in 2023, Homebrew's main repository froze Terraform at 1.5.7 and has since removed the formula. Install from HashiCorp's tap with the full `hashicorp/tap/terraform` name. OpenTofu, which is open source, is still in Homebrew's main repository as `opentofu`.

**Windows.** `winget` and Chocolatey add Terraform to your `PATH`. Open a new terminal afterwards so the change takes effect. The winget package sometimes lags a few days behind a new release.

**Several versions side by side.** If different projects need different Terraform versions, use a version manager such as `tenv`, which installs Terraform, OpenTofu and Terragrunt versions and picks the right one from a `.terraform-version` file or the `required_version` setting. The post [Upgrade Terraform to a Specific Version](/posts/upgrade-terraform-to-specific-version) shows the options.

## Manual Install With Checksum Verification

Every release has a zip file per platform and a `SHA256SUMS` file. Check the sum before you run a binary you downloaded. This run is on an arm64 Linux machine; on most x86 servers, use `linux_amd64` instead:

```terminal
{
  "title": "download, verify and install Terraform",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "TF_VERSION=1.17.0; ARCH=arm64\ncurl -fsSLO \"https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_linux_${ARCH}.zip\"\ncurl -fsSLO \"https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_SHA256SUMS\""
    },
    {
      "cmd": "grep \"linux_${ARCH}\" \"terraform_${TF_VERSION}_SHA256SUMS\" | sha256sum -c -",
      "output": "terraform_1.17.0_linux_arm64.zip: OK"
    },
    {
      "cmd": "unzip -q \"terraform_${TF_VERSION}_linux_${ARCH}.zip\" && ls",
      "output": "LICENSE.txt\nterraform\nterraform_1.17.0_SHA256SUMS\nterraform_1.17.0_linux_arm64.zip"
    },
    {
      "comment": "install for your user only; use sudo install ... /usr/local/bin/ for all users",
      "cmd": "install -D -m 0755 terraform ~/.local/bin/terraform"
    },
    {
      "cmd": "~/.local/bin/terraform version",
      "output": "Terraform v1.17.0\non linux_arm64"
    }
  ]
}
```

`sha256sum -c` must print `OK`. For a stronger check, also verify the `SHA256SUMS.sig` signature with HashiCorp's PGP key, as described on the [HashiCorp security page](https://www.hashicorp.com/en/trust/security). If `~/.local/bin` is not on your `PATH` yet, add `export PATH="$HOME/.local/bin:$PATH"` to your `~/.bashrc` or `~/.zshrc`.

## Verify the Installation

Whichever method you used, check the version and the list of commands:

```terminal
{
  "title": "check the install",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform version",
      "output": "Terraform v1.17.0\non linux_arm64"
    },
    {
      "cmd": "terraform -help",
      "output": "Usage: terraform [global options] <subcommand> [args]\n\nThe available commands for execution are listed below.\nThe primary workflow commands are given first, followed by\nless common or more advanced commands.\n\nMain commands:\n  init          Prepare your working directory for other commands\n  validate      Check whether the configuration is valid\n  plan          Show changes required by the current configuration\n  apply         Create or update infrastructure\n  destroy       Destroy previously-created infrastructure\n\nAll other commands:\n  console       Try Terraform expressions at an interactive command prompt\n  fmt           Reformat your configuration in the standard style\n  force-unlock  Release a stuck lock on the current workspace\n  get           Install or upgrade remote Terraform modules\n  graph         Generate a Graphviz graph of the steps in an operation\n  import        Associate existing infrastructure with a Terraform resource\n  login         Obtain and save credentials for a remote host\n  logout        Remove locally-stored credentials for a remote host"
    },
    {
      "cmd": "terraform -install-autocomplete"
    }
  ]
}
```

The `-help` output above is cut after the first few commands; the full list continues with `output`, `providers`, `state`, `test`, `workspace` and more. `-install-autocomplete` adds tab completion for Bash or Zsh to your shell's startup file; open a new shell to use it. Every subcommand has its own help, for example `terraform plan -help`.

## Your First Configuration (No Cloud Account Needed)

You learn the workflow faster when a mistake costs nothing. This first project uses two small providers: `random`, which generates random names, and `local`, which manages files on your own machine. Create a directory and a file called `main.tf`:

```hcl
terraform {
  required_version = ">= 1.17"

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

# A random two-word name, such as "brave-otter"
resource "random_pet" "name" {
  length = 2
}

# A file whose content uses that name
resource "local_file" "hello" {
  filename        = "${path.module}/hello.txt"
  content         = "Hello from ${random_pet.name.id}!\n"
  file_permission = "0644"
}

output "pet_name" {
  value = random_pet.name.id
}
```

What each block does:

- The **`terraform` block** sets the minimum Terraform version and lists the providers this configuration needs. `source` is the provider's registry address (`hashicorp/local` means `registry.terraform.io/hashicorp/local`), and `version` is a constraint: `~> 2.9` means "2.9 or newer, but below 3.0".
- **`random_pet.name`** creates a random name. It is stored in the state, so it stays the same on every run until you replace it.
- **`local_file.hello`** writes a file. `path.module` is the directory of this configuration. The reference `random_pet.name.id` makes Terraform create the name first.
- The **`output`** prints the name after apply.

### terraform init

`init` downloads the providers and creates a **dependency lock file**:

```terminal
{
  "title": "terraform init",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init",
      "output": "Initializing the backend...\n\nInitializing provider plugins...\n- Finding hashicorp/local versions matching \"~> 2.9\"...\n- Finding hashicorp/random versions matching \"~> 3.9\"...\n- Installing hashicorp/local v2.9.1...\n- Installed hashicorp/local v2.9.1 (signed by HashiCorp)\n- Installing hashicorp/random v3.9.1...\n- Installed hashicorp/random v3.9.1 (signed by HashiCorp)\n\nTerraform has created a lock file .terraform.lock.hcl to record the provider\nselections it made above. Include this file in your version control repository\nso that Terraform can guarantee to make the same selections by default when\nyou run \"terraform init\" in the future.\n\nTerraform has been successfully initialized!\n\nYou may now begin working with Terraform. Try running \"terraform plan\" to see\nany changes that are required for your infrastructure. All Terraform commands\nshould now work.\n\nIf you ever set or change modules or backend configuration for Terraform,\nrerun this command to reinitialize your working directory. If you forget, other\ncommands will detect it and remind you to do so if necessary."
    },
    {
      "cmd": "cat .terraform.lock.hcl",
      "output": "# This file is maintained automatically by \"terraform init\".\n# Manual edits may be lost in future updates.\n\nprovider \"registry.terraform.io/hashicorp/local\" {\n  version     = \"2.9.1\"\n  constraints = \"~> 2.9\"\n  hashes = [\n    \"h1:bek0XHcE8X713/1PR+sMKZFwLnamznJdYbORghbFRn0=\",\n    \"zh:25606c7a5e308144fb627f6e31611bb52ff72bb9ae2d27af39673ab1a6b3c1bf\",\n    \"zh:2568c4ef4dab31821f6f7040af0d1a2aa2b9455b8d9cc546598b791b8ada34cd\",\n    \"zh:25ac210f136042047975896e5e11fe6012425301c826d6b7ce22a49f96a1e0e8\",\n    \"zh:55d3a7bf01eced8e1f259b548020ef1221c5687e0fe6b5b30f81ad0b4121ff12\",\n    \"zh:6168d6934777b853c57815baa18a54101c604a6f1124ca47cd23d016c6f2f1e5\",\n    \"zh:63c0aa17c8373f761123376226debffd1f2259901ff259d4547c520def9a6787\",\n    \"zh:6d1f1572db6c85bd6d6b1b1deef247084e189816875f67e6bcc5d4736794e0a9\",\n    \"zh:78d5eefdd9e494defcb3c68d282b8f96630502cac21d1ea161f53cfe9bb483b3\",\n    \"zh:a8ea1c155bd5e0d695a28d3c0e2f542de8844e1791ea021f015a3f08e1c059e1\",\n    \"zh:ccd790f97269509ade0574ef63c955d3943cb1d812c59177bd85ce4c1d17ca0f\",\n    \"zh:dcfc17bb666e659a9daa9ff52fd8f6ec9ea519868726015e645955c372296332\",\n    \"zh:eb83abbfa7f52cba609b48cbb9a6a5cab07780a672b2020fc2ba190e699a2516\",\n    \"zh:eedffca70074ae153790fb23c4ace8d1637a60ceba4e3c42c8eaeda7c1f9d10f\",\n  ]\n}\n\nprovider \"registry.terraform.io/hashicorp/random\" {\n  version     = \"3.9.1\"\n  constraints = \"~> 3.9\"\n  hashes = [\n    \"h1:nozfr4CZq73d4HjubKJundX/8A+Mj282oS/hyNfjUPU=\",\n    \"zh:05f4734c1f0be840b711b3eff259ebc5fca436784c728955b1678078466f48d7\",\n    \"zh:0b91bf19371d012434eba1deeb6aab77158def9b39601dcbd94450b3974a2a26\",\n    \"zh:0ee6eacd47ec00183d55d726a4b6c4ce951a199f944bf22f1aa58392ebdfa7a2\",\n    \"zh:19388a4074b76a89a43a6c8328d7ae8ee2e7de3d346af51e80d3e6d3d12925f1\",\n    \"zh:23e74d48c5e2ac2e823fd527f49fee9db37d32a1990c9e3bf126ead697b843eb\",\n    \"zh:3cabf7fbd096c520064aae3aba61aba670af83ab91291a71fa1b1332929c2b7f\",\n    \"zh:5c0a3b8af0be60be4eca12ddee385cfa8babc1ec8e98cdf9de2f2274c73eabfa\",\n    \"zh:60b4f8a8ef18f52bf8e19215229dae408bee732825964092db7c989fd2de4097\",\n    \"zh:7359015acfedcbd6366f2329c854cf8d3c8ca5cd0faa89d2d37db358d6eba6c5\",\n    \"zh:78d5eefdd9e494defcb3c68d282b8f96630502cac21d1ea161f53cfe9bb483b3\",\n    \"zh:7b38758402f0e13a1071162da28994023cd2ac676e54af350c9ffd8dfa73fa7b\",\n    \"zh:7c7fbb8895eb75bb4de1f933e98553bd99c8d048c89a925ddba490aa5a67f7dc\",\n    \"zh:8c2b8c6a7ccdec16b73e2fb9f3700ea097f58c592571e4c5de60c93d2301732c\",\n  ]\n}"
    }
  ]
}
```

Terraform picked the newest versions that match your constraints and recorded them, with their checksums, in `.terraform.lock.hcl`. **Commit this file to Git.** It guarantees that your teammates and your CI system install exactly the same provider builds, and that a tampered download fails the checksum check. You change the recorded versions on purpose with `terraform init -upgrade`. The `.terraform` directory holds the downloaded provider binaries; never commit it. The post [Should .terraform.lock.hcl Be in .gitignore?](/posts/should-terraform-lock-be-in-your-gitignore) goes deeper.

### terraform fmt and terraform validate

Two quick checks before you plan anything. `fmt` rewrites files into the standard style (it printed nothing because the file is already formatted), and `validate` checks syntax, references and argument types without touching any real infrastructure:

```terminal
{
  "title": "format and validate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform fmt"
    },
    {
      "cmd": "terraform validate",
      "output": "Success! The configuration is valid."
    }
  ]
}
```

### terraform plan

```terminal
{
  "title": "terraform plan",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan",
      "output": "Terraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n  + create\n\nTerraform will perform the following actions:\n\n  # local_file.hello will be created\n  + resource \"local_file\" \"hello\" {\n      + content              = (known after apply)\n      + content_base64sha256 = (known after apply)\n      + content_base64sha512 = (known after apply)\n      + content_md5          = (known after apply)\n      + content_sha1         = (known after apply)\n      + content_sha256       = (known after apply)\n      + content_sha512       = (known after apply)\n      + directory_permission = \"0777\"\n      + file_permission      = \"0644\"\n      + filename             = \"./hello.txt\"\n      + id                   = (known after apply)\n    }\n\n  # random_pet.name will be created\n  + resource \"random_pet\" \"name\" {\n      + id        = (known after apply)\n      + length    = 2\n      + separator = \"-\"\n    }\n\nPlan: 2 to add, 0 to change, 0 to destroy.\n\nChanges to Outputs:\n  + pet_name = (known after apply)\n\n─────────────────────────────────────────────────────────────────────────────\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run \"terraform apply\" now."
    }
  ]
}
```

Both resources show `+` (create). Values the provider only knows after creation, such as the file's checksums and the pet name itself, appear as `(known after apply)`. The plan reads like a contract: if it is not what you expect, stop here and fix the code.

### terraform apply

`apply` makes a new plan, shows it again and waits for you to type `yes`:

```terminal
{
  "title": "terraform apply (the plan part of the output is not repeated here)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply",
      "output": "Do you want to perform these actions?\n  Terraform will perform the actions described above.\n  Only 'yes' will be accepted to approve.\n\n  Enter a value: yes\n\nrandom_pet.name: Creating...\nrandom_pet.name: Creation complete after 0s [id=promoted-gecko]\nlocal_file.hello: Creating...\nlocal_file.hello: Creation complete after 0s [id=5df6e89d907c1c7e727dc40436ceeb48dbce2747]\n\nApply complete! Resources: 2 added, 0 changed, 0 destroyed.\n\nOutputs:\n\npet_name = \"promoted-gecko\""
    }
  ]
}
```

Terraform created the name first, then the file, because the file refers to the name. Check the result and what Terraform recorded:

```terminal
{
  "title": "inspect the result",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cat hello.txt",
      "output": "Hello from promoted-gecko!"
    },
    {
      "cmd": "terraform output pet_name",
      "output": "\"promoted-gecko\""
    },
    {
      "cmd": "terraform state list",
      "output": "local_file.hello\nrandom_pet.name"
    },
    {
      "cmd": "ls",
      "output": "hello.txt\nmain.tf\nterraform.tfstate"
    }
  ]
}
```

`terraform.tfstate` is the state file from [Part 1](/guides/introduction-to-terraform/01-terraform-fundamentals#h2-state-terraforms-memory). Run `terraform plan` again and it reports that nothing needs to change:

```terminal
{
  "title": "a second plan finds nothing to do",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan",
      "output": "random_pet.name: Refreshing state... [id=promoted-gecko]\nlocal_file.hello: Refreshing state... [id=5df6e89d907c1c7e727dc40436ceeb48dbce2747]\n\nNo changes. Your infrastructure matches the configuration.\n\nTerraform has compared your real infrastructure against your configuration\nand found no differences, so no changes are needed."
    }
  ]
}
```

### Change Something

Edit the `content` line of `local_file.hello` so it reads `"Hello again from ${random_pet.name.id}!\n"` and plan again:

```terminal
{
  "title": "plan a change",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan",
      "output": "random_pet.name: Refreshing state... [id=promoted-gecko]\nlocal_file.hello: Refreshing state... [id=5df6e89d907c1c7e727dc40436ceeb48dbce2747]\n\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n-/+ destroy and then create replacement\n\nTerraform will perform the following actions:\n\n  # local_file.hello must be replaced\n-/+ resource \"local_file\" \"hello\" {\n      ~ content              = <<-EOT # forces replacement\n          - Hello from promoted-gecko!\n          + Hello again from promoted-gecko!\n        EOT\n      ~ content_base64sha256 = \"foRBvoJn2wTwGtnj3jtzgm827Zx1teiZv7v2tlwV/Qg=\" -> (known after apply)\n      ~ content_base64sha512 = \"IMLzfIlNEyEjtJ0EggHDHQYofmFxmsUVsem9/r+9PltP3w92PyJaWq+/46e6I2Jr28veRjELDdUb4D+oTA7Lfg==\" -> (known after apply)\n      ~ content_md5          = \"5e3ea46611dd2d6d83548247e78ad99d\" -> (known after apply)\n      ~ content_sha1         = \"5df6e89d907c1c7e727dc40436ceeb48dbce2747\" -> (known after apply)\n      ~ content_sha256       = \"7e8441be8267db04f01ad9e3de3b73826f36ed9c75b5e899bfbbf6b65c15fd08\" -> (known after apply)\n      ~ content_sha512       = \"20c2f37c894d132123b49d048201c31d06287e61719ac515b1e9bdfebfbd3e5b4fdf0f763f225a5aafbfe3a7ba23626bdbcbde46310b0dd51be03fa84c0ecb7e\" -> (known after apply)\n      ~ id                   = \"5df6e89d907c1c7e727dc40436ceeb48dbce2747\" -> (known after apply)\n        # (3 unchanged attributes hidden)\n    }\n\nPlan: 1 to add, 0 to change, 1 to destroy.\n\n─────────────────────────────────────────────────────────────────────────────\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run \"terraform apply\" now."
    }
  ]
}
```

The `local` provider cannot edit a file in place, so changing `content` **forces replacement** (`-/+`): Terraform deletes the file and writes a new one. The pet name is unchanged, so the same name appears in the new content. Cloud resources behave the same way: some arguments update in place (`~`), others replace the object, and the plan always tells you which.

Apply it without the prompt this time. `-auto-approve` skips the question, so only use it when you have just read the plan or in automation that applies a reviewed, saved plan:

```terminal
{
  "title": "apply the change",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve",
      "output": "random_pet.name: Refreshing state... [id=promoted-gecko]\nlocal_file.hello: Refreshing state... [id=5df6e89d907c1c7e727dc40436ceeb48dbce2747]\n\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n-/+ destroy and then create replacement\n\nTerraform will perform the following actions:\n\n  # local_file.hello must be replaced\n-/+ resource \"local_file\" \"hello\" {\n      ~ content              = <<-EOT # forces replacement\n          - Hello from promoted-gecko!\n          + Hello again from promoted-gecko!\n        EOT\n      ~ content_base64sha256 = \"foRBvoJn2wTwGtnj3jtzgm827Zx1teiZv7v2tlwV/Qg=\" -> (known after apply)\n      ~ content_base64sha512 = \"IMLzfIlNEyEjtJ0EggHDHQYofmFxmsUVsem9/r+9PltP3w92PyJaWq+/46e6I2Jr28veRjELDdUb4D+oTA7Lfg==\" -> (known after apply)\n      ~ content_md5          = \"5e3ea46611dd2d6d83548247e78ad99d\" -> (known after apply)\n      ~ content_sha1         = \"5df6e89d907c1c7e727dc40436ceeb48dbce2747\" -> (known after apply)\n      ~ content_sha256       = \"7e8441be8267db04f01ad9e3de3b73826f36ed9c75b5e899bfbbf6b65c15fd08\" -> (known after apply)\n      ~ content_sha512       = \"20c2f37c894d132123b49d048201c31d06287e61719ac515b1e9bdfebfbd3e5b4fdf0f763f225a5aafbfe3a7ba23626bdbcbde46310b0dd51be03fa84c0ecb7e\" -> (known after apply)\n      ~ id                   = \"5df6e89d907c1c7e727dc40436ceeb48dbce2747\" -> (known after apply)\n        # (3 unchanged attributes hidden)\n    }\n\nPlan: 1 to add, 0 to change, 1 to destroy.\nlocal_file.hello: Destroying... [id=5df6e89d907c1c7e727dc40436ceeb48dbce2747]\nlocal_file.hello: Destruction complete after 0s\nlocal_file.hello: Creating...\nlocal_file.hello: Creation complete after 0s [id=c1a525ab5f129fd80b76cf16fe396e9a027ee8e7]\n\nApply complete! Resources: 1 added, 0 changed, 1 destroyed.\n\nOutputs:\n\npet_name = \"promoted-gecko\""
    },
    {
      "cmd": "cat hello.txt",
      "output": "Hello again from promoted-gecko!"
    }
  ]
}
```

### terraform destroy

When you are done, remove everything this configuration manages:

```terminal
{
  "title": "terraform destroy (end of the output)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform destroy",
      "output": "  - pet_name = \"promoted-gecko\" -> null\n\nDo you really want to destroy all resources?\n  Terraform will destroy all your managed infrastructure, as shown above.\n  There is no undo. Only 'yes' will be accepted to confirm.\n\n  Enter a value: yes\n\nlocal_file.hello: Destroying... [id=c1a525ab5f129fd80b76cf16fe396e9a027ee8e7]\nlocal_file.hello: Destruction complete after 0s\nrandom_pet.name: Destroying... [id=promoted-gecko]\nrandom_pet.name: Destruction complete after 0s\n\nDestroy complete! Resources: 2 destroyed."
    },
    {
      "cmd": "ls",
      "output": "main.tf\nterraform.tfstate\nterraform.tfstate.backup"
    }
  ]
}
```

The file is gone, and the state file is now empty of resources (Terraform keeps it, plus a `terraform.tfstate.backup` copy of the previous state). For a cloud project, `destroy` is how you stop paying for what you created while learning.

## Set Up Cloud Credentials

Providers find credentials the same way the platform's own CLI does, so you rarely put them in Terraform code. Never write a secret into a `.tf` file: it ends up in Git. Pick the platform you use:

```tabs
{
  "title": "Credentials for the main providers",
  "tabs": [
    {
      "label": "AWS",
      "lang": "bash",
      "code": "# Recommended: short-lived credentials from IAM Identity Center (SSO)\naws configure sso --profile learn     # one time\naws sso login --profile learn         # when the session expires\nexport AWS_PROFILE=learn\n\n# Check who you are before you run terraform\naws sts get-caller-identity\n\n# If you sign in with `aws login` and a tool does not pick up the session,\n# export temporary credentials into this shell:\neval \"$(aws configure export-credentials --profile learn --format env)\""
    },
    {
      "label": "DigitalOcean",
      "lang": "bash",
      "code": "# Create a personal access token in the control panel (API > Tokens).\n# Give it an expiry date and only the scopes you need.\nexport DIGITALOCEAN_TOKEN=\"dop_v1_...\"\n\n# Optional: check the token with doctl, DigitalOcean's CLI\ndoctl auth init --access-token \"$DIGITALOCEAN_TOKEN\"\ndoctl account get"
    },
    {
      "label": "Google Cloud",
      "lang": "bash",
      "code": "# Application Default Credentials from your user account (no key file)\ngcloud auth application-default login\ngcloud config set project my-project-id\n\n# The provider block then only needs a project and region:\n#   provider \"google\" { project = \"my-project-id\"  region = \"europe-west1\" }"
    },
    {
      "label": "Azure",
      "lang": "bash",
      "code": "# The azurerm provider uses your Azure CLI login\naz login\naz account set --subscription \"My Subscription\"\n\n# The provider block needs the subscription ID since azurerm 4.0:\n#   provider \"azurerm\" { features {}  subscription_id = \"00000000-...\" }\n# (or export ARM_SUBSCRIPTION_ID)"
    }
  ]
}
```

Some rules that apply to every platform:

- **Prefer short-lived credentials.** SSO sessions, `gcloud` user logins and OIDC tokens in CI expire on their own. Long-lived access keys and service account key files are the credentials that leak.
- **Use environment variables, not provider arguments**, for anything secret. A `token = "..."` line in a provider block is a secret in Git.
- **In CI, use OpenID Connect (OIDC)** so the pipeline gets temporary cloud credentials without stored keys. [Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration) shows a GitHub Actions example.
- **Start with broad permissions in a sandbox account, then narrow them.** The post [Determining Minimum AWS Permissions for Terraform](/posts/minimum-aws-permissions-for-terraform) shows how.

## Your First Cloud Server

The same workflow creates real infrastructure. This example creates a DigitalOcean Droplet (a virtual server) with 1 vCPU and 1 GB of memory. At list price it costs $6 a month. DigitalOcean bills Droplets per second while they exist (at least 60 seconds or $0.01 per Droplet), up to that monthly price, so destroy it when you are done.

:::note
If you do not have a DigitalOcean account, you can sign up through our [referral link](https://m.do.co/c/2a9bba940f39). A new account gets DigitalOcean's standard [signup credit](https://docs.digitalocean.com/platform/billing/signup-credit/) ($5 that expires 90 days after sign-up), and you must add a payment method before you can create a Droplet. If you later spend $25 on DigitalOcean, DevOps Daily gets $25 of credit ([referral program](https://docs.digitalocean.com/platform/teams/refer-others/)).
:::

Create a new directory, `droplet`, with this `main.tf`:

```hcl
terraform {
  required_version = ">= 1.17"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.106"
    }
  }
}

# Reads the token from the DIGITALOCEAN_TOKEN environment variable
provider "digitalocean" {}

variable "ssh_key_fingerprint" {
  description = "Fingerprint of an SSH key already added to your DigitalOcean account"
  type        = string
}

resource "digitalocean_droplet" "web" {
  name       = "web-1"
  image      = "ubuntu-24-04-x64"
  region     = "fra1"
  size       = "s-1vcpu-1gb"
  ssh_keys   = [var.ssh_key_fingerprint]
  monitoring = true
  tags       = ["learn-terraform"]
}

output "droplet_ip" {
  value = digitalocean_droplet.web.ipv4_address
}
```

The provider block is empty because the provider reads `DIGITALOCEAN_TOKEN` from the environment. The Droplet logs in with your SSH key instead of a password: add your public key under **Settings > Security** in the control panel first, and pass its fingerprint when Terraform asks for the variable. `ssh-keygen -l -E md5 -f ~/.ssh/id_ed25519.pub` prints the key size, the fingerprint and the comment: copy only the fingerprint and remove its leading `MD5:`.

The plan below is a real run of this configuration with a placeholder token. Planning a new Droplet does not call the DigitalOcean API, so it works without an account; with a real token, the output is the same:

```terminal
{
  "title": "plan a Droplet",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init"
    },
    {
      "cmd": "export DIGITALOCEAN_TOKEN=placeholder-token"
    },
    {
      "cmd": "terraform plan -var 'ssh_key_fingerprint=3b:16:bf:e4:8b:00:8b:b8:59:8c:a9:d3:f0:19:45:fa'",
      "output": "Terraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n  + create\n\nTerraform will perform the following actions:\n\n  # digitalocean_droplet.web will be created\n  + resource \"digitalocean_droplet\" \"web\" {\n      + backups              = false\n      + created_at           = (known after apply)\n      + disk                 = (known after apply)\n      + graceful_shutdown    = false\n      + id                   = (known after apply)\n      + image                = \"ubuntu-24-04-x64\"\n      + ipv4_address         = (known after apply)\n      + ipv4_address_private = (known after apply)\n      + ipv6                 = false\n      + ipv6_address         = (known after apply)\n      + locked               = (known after apply)\n      + memory               = (known after apply)\n      + monitoring           = true\n      + name                 = \"web-1\"\n      + price_hourly         = (known after apply)\n      + price_monthly        = (known after apply)\n      + private_networking   = (known after apply)\n      + public_networking    = (known after apply)\n      + region               = \"fra1\"\n      + resize_disk          = true\n      + size                 = \"s-1vcpu-1gb\"\n      + ssh_keys             = [\n          + \"3b:16:bf:e4:8b:00:8b:b8:59:8c:a9:d3:f0:19:45:fa\",\n        ]\n      + status               = (known after apply)\n      + tags                 = [\n          + \"learn-terraform\",\n        ]\n      + urn                  = (known after apply)\n      + vcpus                = (known after apply)\n      + volume_ids           = (known after apply)\n      + vpc_uuid             = (known after apply)\n    }\n\nPlan: 1 to add, 0 to change, 0 to destroy.\n\nChanges to Outputs:\n  + droplet_ip = (known after apply)\n\n─────────────────────────────────────────────────────────────────────────────\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run \"terraform apply\" now."
    }
  ]
}
```

With a real token and your own fingerprint, `terraform apply` creates the server. This part of the output is an example, because it needs a real account:

```text
digitalocean_droplet.web: Creating...
digitalocean_droplet.web: Still creating... [00m10s elapsed]
digitalocean_droplet.web: Still creating... [00m20s elapsed]
digitalocean_droplet.web: Still creating... [00m30s elapsed]
digitalocean_droplet.web: Creation complete after 33s [id=512345678]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

Outputs:

droplet_ip = "203.0.113.25"
```

Connect with `ssh root@$(terraform output -raw droplet_ip)`, then run `terraform destroy` when you are done. The [Deploy a DigitalOcean Droplet with Terraform](/exercises/terraform-digitalocean-droplet) exercise walks through a slightly bigger version with a firewall.

## Files to Keep Out of Git

Add a `.gitignore` to every Terraform project before your first commit:

```gitignore
# Provider binaries and module downloads
.terraform/

# State can contain secrets; keep it in a remote backend (Part 9)
*.tfstate
*.tfstate.*

# Saved plans also contain secrets
*.tfplan
tfplan

# Crash logs and local CLI configuration
crash.log
crash.*.log
.terraformrc
terraform.rc

# Variable files that hold secrets; name them so this pattern catches them
*.secret.tfvars
*.secret.tfvars.json
```

Keep per-environment settings such as `env/prod.tfvars` in Git, because reviewers need to see them and CI needs them ([Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments)). Keep secrets out of those files: pass them as `TF_VAR_` environment variables from a secret store or your CI's secrets, or in a `*.secret.tfvars` file that the pattern above keeps out of Git.

Commit `.terraform.lock.hcl`. Older guides told you to ignore it; that is wrong for any project you share, because the lock file is what makes provider installs repeatable.

## Common Setup Problems

**`terraform: command not found`.** The directory with the binary is not on your `PATH`, or you need a new terminal after installing.

**`Failed to query available provider packages` or a timeout during `init`.** Your network blocks `registry.terraform.io` or `releases.hashicorp.com`. Behind a corporate proxy, set `HTTPS_PROXY`. In air-gapped networks, use a provider mirror (`terraform providers mirror` and a `provider_installation` block in the CLI configuration).

**`the cached package ... does not match any of the checksums recorded in the dependency lock file`.** The lock file was created on another operating system or CPU and only has checksums for that platform, or a download was corrupted. Add the missing platforms with `terraform providers lock -platform=linux_amd64 -platform=darwin_arm64 -platform=windows_amd64`. See [How to Fix Terraform Provider Checksum Mismatch Errors](/posts/terraform-failed-install-provider-checksums-mismatch).

**`No valid credential sources found` or `401 Unauthorized`.** The provider did not find credentials. Check the environment variables in the shell where you run Terraform, run the platform's "who am I" command (`aws sts get-caller-identity`, `doctl account get`, `gcloud auth list`) and check that the session has not expired.

**`Error acquiring the state lock`.** Another Terraform process is running in the same directory or against the same remote state, or a previous run crashed. [Part 5](/guides/introduction-to-terraform/05-state-management#h2-state-locking) explains what to do.

**Something else.** Run the command again with `TF_LOG=DEBUG` set to see every API call, and `TF_LOG_PATH=terraform.log` to write the log to a file. Debug logs can contain secrets, so do not paste them anywhere public.

## Summary

- Install Terraform 1.17 from HashiCorp's package repositories, HashiCorp's Homebrew tap, winget, or a verified zip.
- `init` downloads providers and writes `.terraform.lock.hcl`; commit the lock file, ignore `.terraform/`.
- `fmt`, `validate`, `plan`, `apply` and `destroy` are the commands you use every day.
- Credentials come from the environment and the platform's CLI login, never from `.tf` files.
- The workflow for a cloud server is the same as for a local file; only the provider changes.

In [Part 3](/guides/introduction-to-terraform/03-configuration-language-basics) you learn the configuration language in detail.

## Keep Learning

- [Experimenting Locally with Terraform](/posts/experimenting-locally-with-terraform)
- [How to Execute Terraform Actions Without the Interactive Prompt](/posts/execute-terraform-actions-without-prompt)
- [Terraform: Failed to install provider, does not match checksums from dependency lock file](/posts/terraform-provider-checksum-mismatch)
- [Terraform terminal simulator](/games/terraform-terminal-simulator), to practise the commands in your browser
