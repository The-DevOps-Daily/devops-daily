---
title: 'Packer Provisioners: Shell, File, Ansible and More'
description: 'Customize images with Packer provisioners: shell scripts and inline commands, file uploads, Ansible playbooks, retries, error handling and image cleanup.'
order: 5
---

**TLDR**: Provisioners run in the order you write them, on every source in the build. Use `shell` for commands and scripts, `file` to upload files (to `/tmp` first), and `ansible` to reuse playbooks. A failing command stops the build unless you allow it with `valid_exit_codes`, `max_retries` or the new `continue_on_error` (Packer 1.16). Add an `error-cleanup-provisioner` for steps that must run when a build fails, and finish every image with a cleanup step.

Provisioners are where the image gets its content: packages, configuration files, users and services. This part covers the provisioners you will use every day, how to control where and how they run, what happens when they fail, and the steps that turn a build machine into a clean golden image.

## Prerequisites

- A template with a working source ([Part 3](/guides/introduction-to-packer/03-writing-your-first-template) or [Part 4](/guides/introduction-to-packer/04-builders-and-platforms)).
- Basic shell scripting. For the Ansible section, Ansible installed on the machine that runs Packer.
- For the local examples on Windows, WSL: `shell-local` uses `cmd.exe` on Windows, and the examples use a Unix shell.

The runs with real output in this part use the built-in `null` builder and the `shell-local` provisioner, which runs commands on your own machine. You can repeat them without a cloud account. Ordering, environment variables, retries and error handling work the same way for the `shell` provisioner on a real build machine.

## How Provisioners Run

Packer runs the provisioners of a `build` block from top to bottom, on each source. With several sources, every build runs its own copy of the list in parallel. Each provisioner must finish before the next one starts, and a failure stops that build:

```hcl
source "null" "app" {
  communicator = "none"
}

source "null" "test" {
  communicator = "none"
}

build {
  sources = ["source.null.app", "source.null.test"]

  provisioner "shell-local" {
    environment_vars = ["APP_VERSION=1.4.0", "ENVIRONMENT=staging"]
    inline           = ["echo \"$PACKER_BUILD_NAME: installing $APP_VERSION for $ENVIRONMENT\""]
  }

  provisioner "shell-local" {
    only   = ["null.app"]
    inline = ["echo \"$PACKER_BUILD_NAME: this step runs only on null.app\""]
  }
}
```

```terminal
{
  "title": "provisioner order",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build -parallel-builds=1 .",
      "output": "null.app: output will be in this color.\nnull.test: output will be in this color.\n\n==> null.app: Running local shell script: /tmp/packer-shell841705686\n==> null.app: app: installing 1.4.0 for staging\n==> null.app: Running local shell script: /tmp/packer-shell2461522699\n==> null.app: app: this step runs only on null.app\nBuild 'null.app' finished after 54 milliseconds 520 microseconds.\n==> null.test: Running local shell script: /tmp/packer-shell1108711640\n==> null.test: test: installing 1.4.0 for staging\nBuild 'null.test' finished after 33 milliseconds 869 microseconds.\n\n==> Wait completed after 89 milliseconds 484 microseconds\n\n==> Builds finished. The artifacts of successful builds are:\n--> null.app: Did not export anything. This is the null builder\n--> null.test: Did not export anything. This is the null builder"
    }
  ]
}
```

Three things to notice:

- `environment_vars` became normal environment variables in the script. Packer adds its own, such as `PACKER_BUILD_NAME` (the source name) and `PACKER_BUILDER_TYPE`.
- `only = ["null.app"]` skipped the second step on `null.test`. `except` does the opposite.
- `-parallel-builds=1` ran the builds one after the other, which keeps this output readable. Without it, the two builds run at the same time and their lines interleave.

## Shell Provisioner

The `shell` provisioner uploads a script to the build machine over the communicator and runs it there. It is the provisioner you will use most.

### Inline Commands, Scripts and Script Lists

```hcl
# Short commands
provisioner "shell" {
  inline = [
    "sudo apt-get update",
    "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx redis-server",
    "sudo systemctl enable nginx redis-server",
  ]
}

# One script from your repository
provisioner "shell" {
  script = "scripts/setup-app.sh"
}

# Several scripts, run in this order
provisioner "shell" {
  scripts = [
    "scripts/install-dependencies.sh",
    "scripts/configure-services.sh",
    "scripts/cleanup.sh",
  ]
}
```

Packer writes `inline` commands to a temporary script that starts with `#!/bin/sh -e`, so the first command that fails stops the script. Use `inline` for a handful of commands and a script file for anything longer: script files are easier to read, lint (`shellcheck`) and test. Start every script with strict mode, so it fails as early as the inline version:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_VERSION="${APP_VERSION:?APP_VERSION is required}"
echo "Installing app ${APP_VERSION}"
```

### Environment Variables

```hcl
provisioner "shell" {
  environment_vars = [
    "APP_VERSION=${var.app_version}",
    "ENVIRONMENT=production",
  ]
  script = "scripts/install-app.sh"
}
```

Values from sensitive variables are hidden in Packer's output, but they still reach the build machine in plain text, on the command line of the script. Pass only what the step needs, and make sure nothing secret is written to disk in the image.

### Run Everything as Root

Cloud images log you in as an unprivileged user (`ubuntu`, `ec2-user`), so every command needs `sudo`, and `sudo` drops your environment variables. Instead of prefixing each line, change the command Packer uses to run the script:

```hcl
provisioner "shell" {
  execute_command  = "chmod +x {{ .Path }}; {{ .Vars }} sudo -E '{{ .Path }}'"
  environment_vars = ["DEBIAN_FRONTEND=noninteractive"]
  inline = [
    "apt-get update",
    "apt-get install -y nginx",
  ]
}
```

`{{ .Vars }}` expands to the environment variables and `{{ .Path }}` to the uploaded script. `sudo -E` keeps the variables, so `DEBIAN_FRONTEND` reaches `apt-get`. This works on cloud images, where the default user has passwordless `sudo`. For ISO builds with a password, use `"chmod +x {{ .Path }}; echo 'packer' | {{ .Vars }} sudo -S -E '{{ .Path }}'"`.

Run the script itself, not `sh` with the script as an argument. Many older examples use `sudo sh '{{ .Path }}'`, but then the shell ignores the script's `#!/bin/sh -e` line, and a failing command no longer stops it. The same mistake with `shell-local` shows the effect:

```hcl
source "null" "demo" {
  communicator = "none"
}

build {
  sources = ["source.null.demo"]

  provisioner "shell-local" {
    # Wrong: runs the script with sh, so the -e in its shebang is ignored
    execute_command = ["/bin/sh", "-c", "{{.Vars}} sh {{.Script}}"]
    inline          = ["false", "echo this line runs although false failed"]
  }
}
```

```terminal
{
  "title": "a shebang that is ignored",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build .",
      "output": "null.demo: output will be in this color.\n\n==> null.demo: Running local shell script: /tmp/packer-shell2080565212\n==> null.demo: this line runs although false failed\nBuild 'null.demo' finished after 25 milliseconds 995 microseconds.\n\n==> Wait completed after 26 milliseconds 176 microseconds\n\n==> Builds finished. The artifacts of successful builds are:\n--> null.demo: Did not export anything. This is the null builder"
    }
  ]
}
```

The build reports success although `false` failed. Without the custom `execute_command`, the same provisioner stops at `false` and the build fails, as in [What a Failure Looks Like](#h3-what-a-failure-looks-like).

### Reboots

Kernel updates need a reboot before the next steps. Tell Packer that the connection will drop, then give the machine time to come back:

```hcl
provisioner "shell" {
  inline            = ["sudo reboot"]
  expect_disconnect = true
}

provisioner "shell" {
  pause_before = "30s"
  inline       = ["uname -r"]
}
```

`expect_disconnect = true` stops Packer from treating the lost connection as an error. The next provisioner reconnects; `start_retry_timeout` (default 5 minutes) is how long it keeps trying.

### Other Useful Options

- **`valid_exit_codes`**: exit codes that count as success, for example `[0, 2]` for `cloud-init status --wait` (see [Common Patterns](#h2-common-patterns)).
- **`remote_folder`**: where Packer uploads the script, `/tmp` by default. Change it if `/tmp` is mounted `noexec` on hardened images.
- **`skip_clean`**: keep the uploaded script on the machine after it runs, for debugging.
- **`pause_after`**: wait after the script, for example to let a service settle.

Since Packer 1.13, an `inline` list can also hold a complete script that starts with its own shebang, such as the output of `templatefile()`.

## File Provisioner

The `file` provisioner copies files and directories from your machine to the build machine:

```hcl
# One file
provisioner "file" {
  source      = "configs/nginx.conf"
  destination = "/tmp/nginx.conf"
}

# A directory: no trailing slash, so it arrives as /tmp/app
provisioner "file" {
  source      = "app"
  destination = "/tmp"
}

# Only the directory's contents: trailing slash, so they land in /tmp/app-files
provisioner "file" {
  source      = "app/"
  destination = "/tmp/app-files"
}
```

Rules worth knowing:

- **The trailing slash matters.** `source = "app"` uploads the directory into the destination; `source = "app/"` uploads its contents. The destination directory must already exist.
- **Uploads run as the SSH user**, who usually cannot write to `/etc` or `/opt`. Upload to `/tmp`, then move the files with a shell provisioner and `sudo`.
- **`content`** writes a string instead of a local file. Combine it with `templatefile()` to render a configuration file from variables:

```hcl
provisioner "file" {
  content     = templatefile("templates/app.conf.tpl", { db_host = var.db_host, db_port = 5432 })
  destination = "/tmp/app.conf"
}
```

You can test template rendering with `packer console` before a build:

```terminal
{
  "title": "render a template",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cat templates/app.conf.tpl",
      "output": "server ${db_host}:${db_port}"
    },
    {
      "cmd": "echo 'templatefile(\"templates/app.conf.tpl\", { db_host = var.db_host, db_port = 5432 })' | packer console .",
      "output": "server db.internal:5432"
    }
  ]
}
```

- **`direction = "download"`** copies a file from the build machine to your machine, for example a package list or a build log you want to keep next to the image.

## Ansible Provisioners

If you already manage servers with Ansible, reuse the same roles to bake images. The Ansible plugin has two provisioners:

- **`ansible`** runs `ansible-playbook` on the machine that runs Packer and connects to the build machine over SSH. Nothing extra is installed in the image. This is the usual choice.
- **`ansible-local`** uploads the playbook and runs Ansible on the build machine itself, so Ansible must be installed in the image (often by an earlier shell provisioner). Use it when Packer cannot reach the machine over SSH directly.

```hcl
packer {
  required_plugins {
    ansible = {
      version = "~> 1.1"
      source  = "github.com/hashicorp/ansible"
    }
  }
}

build {
  sources = ["source.amazon-ebs.web"]

  provisioner "ansible" {
    playbook_file = "./playbook.yml"
    galaxy_file   = "./requirements.yml" # install roles and collections first
    user          = "ubuntu"
    use_proxy     = false # connect straight to the instance

    extra_arguments = [
      "--extra-vars", "app_version=${var.app_version}",
    ]
    ansible_env_vars = [
      "ANSIBLE_HOST_KEY_CHECKING=False",
    ]
  }
}
```

A playbook for Packer targets the host `default`, the name the provisioner gives the build machine in its generated inventory:

```yaml
- name: Configure the web server image
  hosts: default
  become: true

  tasks:
    - name: Install packages
      ansible.builtin.apt:
        name:
          - nginx
          - postgresql-client
        state: present
        update_cache: true

    - name: Install the Nginx configuration
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        owner: root
        group: root
        mode: '0644'
      notify: Reload nginx

    - name: Enable nginx at boot
      ansible.builtin.systemd_service:
        name: nginx
        enabled: true

  handlers:
    - name: Reload nginx
      ansible.builtin.systemd_service:
        name: nginx
        state: reloaded
```

- **`use_proxy = false`** makes Ansible connect directly to the instance's address with the SSH key Packer created. The default (`true`) routes Ansible through a local SSH proxy inside Packer; you need it only when the build machine has no reachable IP address, as with the Docker builder.
- **`user`** is the SSH user Ansible logs in as. Set it to the image's default user.
- **`galaxy_file`** installs roles and collections from a requirements file before the playbook runs.
- **`ansible_env_vars`** and **`extra_arguments`** pass settings and variables to `ansible-playbook`, exactly as on the command line.

Packer checks that `ansible-playbook` is installed when it validates the template, so install Ansible on CI runners before `packer validate`.

## Chef, Puppet and Other Tools

The Chef, Puppet, Salt, Converge and InSpec plugins are archived on GitHub and receive no updates. If you use one of these tools, install it with a `shell` provisioner and run it in local mode, for example `sudo chef-client --local-mode` or `sudo puppet apply manifests/site.pp`, after uploading the code with a `file` provisioner.

On Windows, use the built-in `powershell` provisioner for scripts and `windows-restart` to reboot and wait for the machine to return ([Part 4](/guides/introduction-to-packer/04-builders-and-platforms#h2-communicators)).

To debug a build interactively, the built-in `breakpoint` provisioner pauses the build until you press Enter, so you can SSH into the build machine and look around.

## Handling Failures

### What a Failure Looks Like

When a command exits with a non-zero code, the provisioner fails, the build stops, and Packer runs the cleanup. An `error-cleanup-provisioner` block runs only in that case, for example to collect logs or notify someone:

```hcl
source "null" "demo" {
  communicator = "none"
}

build {
  sources = ["source.null.demo"]

  provisioner "shell-local" {
    inline = ["echo installing", "false", "echo never printed"]
  }

  provisioner "shell-local" {
    inline = ["echo this step never runs"]
  }

  error-cleanup-provisioner "shell-local" {
    inline = ["echo collecting logs because the build failed"]
  }
}
```

```terminal
{
  "title": "a failing provisioner",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build .",
      "output": "null.demo: output will be in this color.\n\n==> null.demo: Running local shell script: /tmp/packer-shell1205854676\n==> null.demo: installing\n==> null.demo: Provisioning step had errors: Running the cleanup provisioner, if present...\n==> null.demo: Running local shell script: /tmp/packer-shell703861548\n==> null.demo: collecting logs because the build failed\nBuild 'null.demo' errored after 46 milliseconds 408 microseconds: Script exited with non-zero exit status: 1. Allowed exit codes are: [0]\n\n==> Wait completed after 46 milliseconds 615 microseconds\n\n==> Some builds didn't complete successfully and had errors:\n--> null.demo: Script exited with non-zero exit status: 1. Allowed exit codes are: [0]\n\n==> Builds finished but no artifacts were created."
    }
  ]
}
```

`false` exited with code 1, so the inline script stopped before `echo never printed`, the second provisioner never ran, and the cleanup provisioner did. The build exits with a non-zero code, which fails a CI job.

### Retries

Some steps fail now and then for reasons outside your control: a package mirror times out, a service takes a while to start. `max_retries` runs the provisioner again:

```hcl
source "null" "demo" {
  communicator = "none"
}

build {
  sources = ["source.null.demo"]

  provisioner "shell-local" {
    max_retries = 2
    inline      = ["test -f /tmp/service-ready || { echo not ready; exit 1; }"]
  }
}
```

```terminal
{
  "title": "max_retries",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build .",
      "output": "null.demo: output will be in this color.\n\n==> null.demo: Running local shell script: /tmp/packer-shell2916074754\n==> null.demo: not ready\n==> null.demo: Provisioner failed with \"Script exited with non-zero exit status: 1. Allowed exit codes are: [0]\", retrying with 2 trie(s) left\n==> null.demo: Running local shell script: /tmp/packer-shell1387873082\n==> null.demo: not ready\n==> null.demo: Provisioner failed with \"Script exited with non-zero exit status: 1. Allowed exit codes are: [0]\", retrying with 1 trie(s) left\n==> null.demo: Running local shell script: /tmp/packer-shell3785090158\n==> null.demo: not ready\n==> null.demo: retry limit reached.\n==> null.demo: Provisioning step had errors: Running the cleanup provisioner, if present...\nBuild 'null.demo' errored after 81 milliseconds 487 microseconds: Script exited with non-zero exit status: 1. Allowed exit codes are: [0]\n\n==> Wait completed after 81 milliseconds 657 microseconds\n\n==> Some builds didn't complete successfully and had errors:\n--> null.demo: Script exited with non-zero exit status: 1. Allowed exit codes are: [0]\n\n==> Builds finished but no artifacts were created."
    }
  ]
}
```

Retries help with flaky networks; they do not fix a broken script. Keep `max_retries` low and make retried scripts safe to run twice (idempotent).

### Continue After a Failure

Packer 1.16 added `continue_on_error`. When it is `true`, a failed provisioner logs a warning and the build carries on:

```hcl
source "null" "demo" {
  communicator = "none"
}

build {
  sources = ["source.null.demo"]

  provisioner "shell-local" {
    continue_on_error = true
    inline            = ["echo optional step", "false"]
  }

  provisioner "shell-local" {
    inline = ["echo the build goes on"]
  }
}
```

```terminal
{
  "title": "continue_on_error",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build .",
      "output": "null.demo: output will be in this color.\n\n==> null.demo: Running local shell script: /tmp/packer-shell2212685212\n==> null.demo: optional step\n==> null.demo: Warning: Provisioner failed with \"Script exited with non-zero exit status: 1. Allowed exit codes are: [0]\", but continue_on_error is set; continuing the build.\n==> null.demo: Running local shell script: /tmp/packer-shell2952309161\n==> null.demo: the build goes on\nBuild 'null.demo' finished after 54 milliseconds 469 microseconds.\n\n==> Wait completed after 54 milliseconds 634 microseconds\n\n==> Builds finished. The artifacts of successful builds are:\n--> null.demo: Did not export anything. This is the null builder"
    }
  ]
}
```

Use it for steps that are nice to have, such as warming a cache. For a single command inside a script, `|| true` does the same job. Never use either to hide a failure you do not understand.

### Timeouts and Pauses

```hcl
provisioner "shell" {
  pause_before = "10s" # wait before starting
  timeout      = "30m" # fail the provisioner if it runs longer
  script       = "scripts/long-running-task.sh"
}
```

### Debugging a Failed Build

- `packer build -on-error=ask .` stops at the failure and asks whether to clean up, abort (leave everything running) or retry the step.
- `packer build -debug .` pauses before each step and saves the temporary SSH key in the current directory, so you can log in to the build machine.
- `PACKER_LOG=1 packer build .` prints detailed logs, including the commands sent to the machine.

Resources left running after `abort` cost money until you delete them. Tag the build instance (`run_tags` on AWS) so you can find them.

## Conditional Steps

Provisioner blocks cannot be switched on and off with a variable directly. Use `only` and `except` to pick sources, and put feature switches into the script:

```hcl
variable "install_monitoring" {
  type    = bool
  default = true
}

provisioner "shell" {
  environment_vars = ["INSTALL_MONITORING=${var.install_monitoring}"]
  script           = "scripts/monitoring.sh" # checks [ "$INSTALL_MONITORING" = "true" ]
}
```

## Common Patterns

### Wait for cloud-init

On cloud images, cloud-init is still configuring the machine when SSH comes up. Wait for it before you use `apt` or `dnf`:

```hcl
provisioner "shell" {
  inline           = ["cloud-init status --wait"]
  valid_exit_codes = [0, 2] # 2 = finished with recoverable errors
}
```

### Install From a Third-Party Package Repository

Use a dedicated keyring and `signed-by`, not the deprecated `apt-key`. This installs Docker Engine from Docker's repository:

```hcl
provisioner "shell" {
  execute_command  = "chmod +x {{ .Path }}; {{ .Vars }} sudo -E '{{ .Path }}'"
  environment_vars = ["DEBIAN_FRONTEND=noninteractive"]
  inline = [
    "install -m 0755 -d /etc/apt/keyrings",
    "curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc",
    "chmod a+r /etc/apt/keyrings/docker.asc",
    "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable\" > /etc/apt/sources.list.d/docker.list",
    "apt-get update",
    "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
  ]
}
```

### Download and Verify a Binary

Always check a checksum, so a compromised or truncated download fails the build instead of ending up in every server:

```hcl
provisioner "shell" {
  environment_vars = ["APP_VERSION=${var.app_version}", "APP_SHA256=${var.app_sha256}"]
  inline = [
    "curl -fsSL -o /tmp/app.tar.gz https://releases.example.com/app/$APP_VERSION/app-linux-amd64.tar.gz",
    "echo \"$APP_SHA256  /tmp/app.tar.gz\" | sha256sum -c -",
    "sudo tar -xzf /tmp/app.tar.gz -C /usr/local/bin app",
    "rm -f /tmp/app.tar.gz",
  ]
}
```

### Install a systemd Service

```hcl
provisioner "file" {
  source      = "files/app.service"
  destination = "/tmp/app.service"
}

provisioner "shell" {
  inline = [
    "sudo install -m 0644 /tmp/app.service /etc/systemd/system/app.service",
    "sudo systemctl daemon-reload",
    "sudo systemctl enable app.service",
  ]
}
```

`enable` without `--now` is deliberate: the service starts on the instances launched from the image, with their own configuration, not on the build machine.

### Clean Up Before the Image Is Saved

The last provisioner should remove everything that must not be copied into every instance:

```hcl
provisioner "shell" {
  execute_command = "chmod +x {{ .Path }}; {{ .Vars }} sudo -E '{{ .Path }}'"
  inline = [
    # Package caches
    "apt-get clean",
    "rm -rf /var/lib/apt/lists/*",

    # Temporary files you uploaded
    "rm -rf /tmp/app /tmp/*.conf",

    # Logs and shell history from the build
    "find /var/log -type f -exec truncate -s 0 {} +",
    "rm -f /root/.bash_history /home/*/.bash_history",

    # Let cloud-init run again on the next boot, and give each instance a new machine ID
    "cloud-init clean --logs --machine-id",

    # SSH host keys: every instance must generate its own
    "rm -f /etc/ssh/ssh_host_*",
  ]
}
```

- **`cloud-init clean --machine-id`** sets `/etc/machine-id` to `uninitialized`, so systemd creates a new ID at first boot. Instances that share a machine ID can get the same DHCP lease ID and confuse log and monitoring tools.
- **SSH host keys** are regenerated by cloud-init on the first boot of a new instance. Without that, every server from the image would have the same host key.
- **The temporary SSH key**: Packer deletes the private key after the build, but its public key stays in the user's `authorized_keys` file unless you set `ssh_clear_authorized_keys = true` in the source. Set it, so the image carries no stale keys.

On Azure, end with `waagent -deprovision+user` instead ([Part 4](/guides/introduction-to-packer/04-builders-and-platforms#h2-azure-arm-builder)); on Windows, end with sysprep.

## Best Practices

- **Prefer scripts over long inline lists**, keep them in Git next to the template, and lint them with `shellcheck`.
- **Make provisioners idempotent**, so a retry or a rerun during development does no harm.
- **One provisioner per logical step** (install, configure, clean up): failures are easier to read.
- **Install non-interactively** and pin versions where reproducibility matters.
- **Test locally first**: the same scripts with a `docker` source and `discard = true` give you feedback in seconds ([Part 4](/guides/introduction-to-packer/04-builders-and-platforms#h2-building-for-several-platforms)).
- **Clean up last**, and keep secrets out of the image entirely.

## Summary

- Provisioners run in order on every source; `only` and `except` limit them to some sources.
- `shell` runs commands and scripts (`/bin/sh -e` for inline); `execute_command` with `sudo -E` runs them as root with your variables.
- `file` uploads as the SSH user: mind the trailing slash, upload to `/tmp`, then move with `sudo`.
- `ansible` reuses playbooks; set `use_proxy = false` for direct SSH.
- `max_retries`, `continue_on_error`, `error-cleanup-provisioner` and `-on-error` control failures.
- Finish with a cleanup step that resets cloud-init, the machine ID and SSH host keys.

In [Part 6](/guides/introduction-to-packer/06-variables-and-best-practices), you make templates reusable with variables and var files, and build images in CI.

## Keep Learning

- [Introduction to Ansible](/guides/introduction-to-ansible)
- [Complete Web Server Automation with Ansible](/exercises/ansible-web-server-automation) (exercise)
- [Ansible Basics flashcards](/flashcards/ansible-basics) and the [Ansible quiz](/quizzes/ansible-quiz)
- [Interview question: configuration management basics](/interview-questions/junior/configuration-management-basics)
- [Introduction to Bash](/guides/introduction-to-bash), for provisioning scripts
