---
title: Provisioners in Depth
description: Master Packer provisioners to customize your machine images
order: 5
---

**TLDR**: Provisioners install software and configure your images. Common ones are shell scripts, file uploads, and configuration management tools like Ansible. They run in order, and you can control which builders they apply to.

Provisioners are where the actual customization happens. This is where you install packages, copy files, configure services, and prepare the image for production use.

## Shell Provisioner

The most common provisioner. Runs shell commands or scripts:

**Inline commands**:
```hcl
provisioner "shell" {
  inline = [
    "sudo apt-get update",
    "sudo apt-get install -y nginx redis-server",
    "sudo systemctl enable nginx redis-server"
  ]
}
```

**External script**:
```hcl
provisioner "shell" {
  script = "scripts/setup-app.sh"
}
```

**Multiple scripts**:
```hcl
provisioner "shell" {
  scripts = [
    "scripts/install-dependencies.sh",
    "scripts/configure-services.sh",
    "scripts/cleanup.sh"
  ]
}
```

**Environment variables**:
```hcl
provisioner "shell" {
  environment_vars = [
    "APP_VERSION=${var.app_version}",
    "ENVIRONMENT=production"
  ]
  script = "scripts/install-app.sh"
}
```

## File Provisioner

Copies files from your computer to the image:

**Single file**:
```hcl
provisioner "file" {
  source      = "configs/nginx.conf"
  destination = "/tmp/nginx.conf"
}
```

**Directory**:
```hcl
provisioner "file" {
  source      = "app/"
  destination = "/tmp/app"
}
```

**Content from variable**:
```hcl
provisioner "file" {
  content     = templatefile("config.tpl", { db_host = var.db_host })
  destination = "/tmp/config.json"
}
```

The file provisioner uploads to temporary locations. Use a shell provisioner to move files to their final destinations:

```hcl
provisioner "file" {
  source      = "app.tar.gz"
  destination = "/tmp/app.tar.gz"
}

provisioner "shell" {
  inline = [
    "sudo tar -xzf /tmp/app.tar.gz -C /opt/",
    "sudo chown -R appuser:appuser /opt/app",
    "rm /tmp/app.tar.gz"
  ]
}
```

## Ansible Provisioner

Runs Ansible playbooks against the image:

```hcl
provisioner "ansible" {
  playbook_file = "./playbook.yml"
  extra_arguments = [
    "--extra-vars",
    "ansible_python_interpreter=/usr/bin/python3"
  ]
  ansible_env_vars = [
    "ANSIBLE_HOST_KEY_CHECKING=False"
  ]
}
```

**When to use Ansible provisioner**:
- You already have Ansible playbooks
- Complex configuration logic
- Need idempotency (running multiple times)
- Want to use Ansible roles from Galaxy

**Example playbook** (`playbook.yml`):
```yaml
---
- name: Configure web server
  hosts: default
  become: yes
  tasks:
    - name: Install packages
      apt:
        name:
          - nginx
          - postgresql-client
        state: present
        update_cache: yes
    
    - name: Copy nginx config
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: reload nginx
    
    - name: Enable nginx
      systemd:
        name: nginx
        enabled: yes
  
  handlers:
    - name: reload nginx
      systemd:
        name: nginx
        state: reloaded
```

## Chef Provisioner

Runs Chef recipes:

```hcl
provisioner "chef-solo" {
  cookbook_paths = ["cookbooks"]
  run_list       = ["recipe[nginx]", "recipe[app::deploy]"]
  json = {
    nginx = {
      port = 8080
    }
  }
}
```

## Puppet Provisioner

Applies Puppet manifests:

```hcl
provisioner "puppet-masterless" {
  manifest_file = "manifests/default.pp"
  module_paths  = ["modules"]
}
```

## Provisioner Order and Execution

Provisioners run in the order defined:

```hcl
build {
  sources = ["source.amazon-ebs.web"]
  
  # 1. Update system
  provisioner "shell" {
    inline = ["sudo apt-get update"]
  }
  
  # 2. Install base packages
  provisioner "shell" {
    inline = ["sudo apt-get install -y curl wget git"]
  }
  
  # 3. Copy application files
  provisioner "file" {
    source      = "app/"
    destination = "/tmp/app"
  }
  
  # 4. Run configuration
  provisioner "ansible" {
    playbook_file = "playbook.yml"
  }
  
  # 5. Cleanup
  provisioner "shell" {
    inline = [
      "sudo apt-get clean",
      "sudo rm -rf /tmp/*"
    ]
  }
}
```

## Selective Provisioning

**Run provisioner on specific builders**:
```hcl
provisioner "shell" {
  only = ["amazon-ebs.production"]
  inline = ["echo 'Production specific setup'"]
}
```

**Exclude builders**:
```hcl
provisioner "shell" {
  except = ["docker.test"]
  inline = ["echo 'Runs on all builders except docker.test'"]
}
```

**Conditional provisioning**:
```hcl
variable "install_monitoring" {
  type    = bool
  default = true
}

provisioner "shell" {
  inline = [
    var.install_monitoring ? "sudo apt-get install -y datadog-agent" : "echo Skipping monitoring"
  ]
}
```

## Error Handling

**Pause on failure**:
```hcl
provisioner "shell" {
  pause_before = "10s"
  inline       = ["some-command"]
}
```

**Timeout**:
```hcl
provisioner "shell" {
  timeout = "30m"
  script  = "scripts/long-running-task.sh"
}
```

**Max retries**:
```hcl
provisioner "shell" {
  max_retries = 3
  inline      = ["curl -f https://api.example.com/health"]
}
```

**Continue on error** (not recommended):
```hcl
provisioner "shell" {
  inline = ["command-that-might-fail || true"]
}
```

## Common Patterns

### Wait for System to be Ready

```hcl
provisioner "shell" {
  inline = [
    "cloud-init status --wait",  # Wait for cloud-init to finish
    "sudo systemctl is-system-running --wait"  # Wait for system to be fully up
  ]
}
```

### Install from Package Repository

```hcl
provisioner "shell" {
  inline = [
    "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -",
    "sudo add-apt-repository 'deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable'",
    "sudo apt-get update",
    "sudo apt-get install -y docker-ce"
  ]
}
```

### Download and Install Binary

```hcl
provisioner "shell" {
  inline = [
    "wget https://releases.example.com/app-${var.version}.tar.gz",
    "sudo tar -xzf app-${var.version}.tar.gz -C /opt/",
    "sudo ln -s /opt/app-${var.version}/bin/app /usr/local/bin/app"
  ]
}
```

### Configure Service

```hcl
provisioner "file" {
  source      = "configs/app.service"
  destination = "/tmp/app.service"
}

provisioner "shell" {
  inline = [
    "sudo mv /tmp/app.service /etc/systemd/system/app.service",
    "sudo systemctl daemon-reload",
    "sudo systemctl enable app.service"
  ]
}
```

### Cleanup for Production

```hcl
provisioner "shell" {
  inline = [
    # Clean package manager cache
    "sudo apt-get clean",
    "sudo rm -rf /var/lib/apt/lists/*",
    
    # Remove temporary files
    "sudo rm -rf /tmp/*",
    "sudo rm -rf /var/tmp/*",
    
    # Clear logs
    "sudo find /var/log -type f -exec truncate -s 0 {} \\;",
    
    # Remove bash history
    "rm -f ~/.bash_history",
    "sudo rm -f /root/.bash_history",
    
    # Clear machine ID (important for cloud images)
    "sudo truncate -s 0 /etc/machine-id",
    "sudo rm -f /var/lib/dbus/machine-id"
  ]
}
```

## Best Practices

**Use scripts for complex logic**: Inline provisioners are good for simple commands. For anything complex, use external scripts.

**Make provisioners idempotent**: Provisioners should be safe to run multiple times during development.

**Test provisioners locally**: Use Docker builder to test provisioning logic before cloud builds.

**Separate concerns**: One provisioner per logical task (install, configure, cleanup).

**Use variables**: Don't hardcode versions or URLs. Use variables so templates are reusable.

**Check exit codes**: Shell commands fail on non-zero exit. Test commands locally first.

**Clean up thoroughly**: Remove build artifacts, package caches, and temporary files to reduce image size.

## What's Next

Provisioners customize your images. The next chapter covers variables and how to make templates reusable across different environments and use cases.
