---
title: 'How to Add SSH Keys to GCP Instances Using Terraform'
excerpt: "Learn how to configure SSH key access for Google Cloud Platform compute instances with Terraform, including project-wide and instance-specific keys."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-18'
publishedAt: '2025-02-18T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Google Cloud
  - GCP
  - SSH
  - Security
  - DevOps
---

Adding SSH keys to Google Cloud Platform instances with Terraform allows secure access to your VMs. GCP provides two ways to manage SSH keys: project-wide metadata that applies to all instances, and instance-specific metadata for individual VMs. Understanding both approaches helps you implement the right access control for your infrastructure.

This guide covers how to add SSH keys using Terraform for both project-level and instance-level access.

**TLDR:** Add SSH keys to GCP instances using the `metadata` argument in `google_compute_instance` with the key `ssh-keys` containing username and public key pairs in the format `username:ssh-rsa AAAA... user@example.com`. For project-wide keys, use `google_compute_project_metadata_item` with the same format. Use `file()` to load keys from files, and set `enable-oslogin=FALSE` in metadata if OS Login is preventing SSH key access.

## Basic SSH Key Configuration

Add an SSH key to a single GCP instance:

```hcl
resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral public IP
    }
  }

  metadata = {
    ssh-keys = "developer:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC... developer@example.com"
  }
}
```

The SSH key format is: `username:public-key-type public-key-data user@host`

## Loading SSH Keys From Files

Instead of hard-coding keys, load them from files:

```hcl
resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    ssh-keys = "developer:${file("~/.ssh/id_rsa.pub")}"
  }
}
```

The `file()` function reads the public key from your local file system.

## Adding Multiple SSH Keys

To add multiple users or multiple keys for the same user, join them with newlines:

```hcl
resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    ssh-keys = <<-EOT
      developer:${file("~/.ssh/developer_id_rsa.pub")}
      devops:${file("~/.ssh/devops_id_rsa.pub")}
      admin:${file("~/.ssh/admin_id_rsa.pub")}
    EOT
  }
}
```

Each line represents one SSH key entry.

## Using Variables for SSH Keys

Store SSH keys in variables for better reusability:

```hcl
variable "ssh_keys" {
  type = map(string)
  default = {
    developer = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC... developer@example.com"
    devops    = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC... devops@example.com"
  }
}

resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    ssh-keys = join("\n", [
      for username, pubkey in var.ssh_keys :
      "${username}:${pubkey}"
    ])
  }
}
```

This allows you to manage SSH keys centrally and apply them consistently across instances.

## Project-Wide SSH Keys

To add SSH keys that apply to all instances in a project, use `google_compute_project_metadata_item`:

```hcl
resource "google_compute_project_metadata_item" "ssh_keys" {
  key   = "ssh-keys"
  value = <<-EOT
    developer:${file("~/.ssh/developer_id_rsa.pub")}
    devops:${file("~/.ssh/devops_id_rsa.pub")}
  EOT
}

resource "google_compute_instance" "vm1" {
  name         = "vm-1"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  // Project-wide keys automatically apply
}

resource "google_compute_instance" "vm2" {
  name         = "vm-2"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  // Project-wide keys automatically apply here too
}
```

Both instances will have access using the project-wide SSH keys.

## Blocking Project-Wide SSH Keys

If you want an instance to only use instance-specific keys and ignore project-wide keys:

```hcl
resource "google_compute_instance" "secure_vm" {
  name         = "secure-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    block-project-ssh-keys = "true"
    ssh-keys               = "admin:${file("~/.ssh/admin_id_rsa.pub")}"
  }
}
```

The `block-project-ssh-keys = "true"` prevents project-wide keys from being applied to this instance.

## Handling OS Login

GCP's OS Login feature can interfere with SSH key metadata. If OS Login is enabled, metadata SSH keys won't work unless you disable it for the instance:

```hcl
resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    enable-oslogin = "FALSE"  # Disable OS Login to use SSH key metadata
    ssh-keys       = "developer:${file("~/.ssh/id_rsa.pub")}"
  }
}
```

If OS Login is enabled organization-wide, this setting at the instance level will override it.

## Using OS Login Instead of SSH Keys

Alternatively, use OS Login and manage access through IAM:

```hcl
resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    enable-oslogin = "TRUE"
  }
}

# Grant SSH access via IAM
resource "google_project_iam_member" "ssh_access" {
  project = var.project_id
  role    = "roles/compute.osLogin"
  member  = "user:developer@example.com"
}

# Or for sudo access
resource "google_project_iam_member" "ssh_admin_access" {
  project = var.project_id
  role    = "roles/compute.osAdminLogin"
  member  = "user:admin@example.com"
}
```

With OS Login, users authenticate using their Google Cloud identity instead of SSH keys in metadata.

## Dynamic SSH Key Management

Generate and manage SSH keys dynamically:

```hcl
resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    ssh-keys = "developer:${tls_private_key.ssh.public_key_openssh}"
  }
}

# Save private key to local file
resource "local_file" "private_key" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = "${path.module}/ssh-key.pem"
  file_permission = "0600"
}

output "ssh_command" {
  value = "ssh -i ${local_file.private_key.filename} developer@${google_compute_instance.vm.network_interface[0].access_config[0].nat_ip}"
}
```

This generates a new SSH key pair and configures the instance automatically.

## SSH Keys With Instance Templates

For managed instance groups, add SSH keys to the instance template:

```hcl
resource "google_compute_instance_template" "default" {
  name         = "app-template"
  machine_type = "e2-medium"

  disk {
    source_image = "debian-cloud/debian-11"
    auto_delete  = true
    boot         = true
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    ssh-keys = join("\n", [
      for username, pubkey in var.ssh_keys :
      "${username}:${pubkey}"
    ])
  }
}

resource "google_compute_instance_group_manager" "default" {
  name = "app-igm"
  zone = "us-central1-a"

  version {
    instance_template = google_compute_instance_template.default.id
  }

  base_instance_name = "app"
  target_size        = 3
}
```

All instances created from the template will have the same SSH keys.

## Service Account SSH Access

If using service accounts for SSH access:

```hcl
resource "google_service_account" "vm_sa" {
  account_id   = "vm-service-account"
  display_name = "VM Service Account"
}

resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  service_account {
    email  = google_service_account.vm_sa.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }
}

# Grant service account SSH access
resource "google_project_iam_member" "sa_ssh" {
  project = var.project_id
  role    = "roles/compute.osLogin"
  member  = "serviceAccount:${google_service_account.vm_sa.email}"
}
```

## Debugging SSH Key Issues

If SSH keys aren't working, check:

**1. Verify metadata was applied:**

```bash
gcloud compute instances describe my-vm --zone=us-central1-a --format="get(metadata.items)"
```

**2. Check OS Login status:**

```bash
gcloud compute instances describe my-vm --zone=us-central1-a --format="get(metadata.items.enable-oslogin)"
```

**3. Test SSH connection:**

```bash
ssh -i ~/.ssh/id_rsa developer@<instance-external-ip>
```

**4. Check SSH logs on the instance:**

```bash
gcloud compute ssh my-vm --zone=us-central1-a --command="sudo tail -f /var/log/auth.log"
```

## Security Best Practices

**Use unique keys per user:**

```hcl
variable "team_ssh_keys" {
  type = map(string)
  default = {
    alice = "ssh-rsa AAAAB3... alice@company.com"
    bob   = "ssh-rsa AAAAB3... bob@company.com"
    carol = "ssh-rsa AAAAB3... carol@company.com"
  }
}
```

**Never commit private keys to version control:**

```bash
# .gitignore
*.pem
*_rsa
*.key
ssh-key*
```

**Use strong key types:**

```bash
# Generate a strong ED25519 key
ssh-keygen -t ed25519 -C "user@example.com"
```

**Rotate keys regularly:**

```hcl
# Use lifecycle to update SSH keys
resource "google_compute_instance" "vm" {
  # ... config ...

  lifecycle {
    create_before_destroy = true
  }
}
```

## Complete Example

Here's a complete example with best practices:

```hcl
variable "project_id" {
  type = string
}

variable "ssh_users" {
  type = map(string)
  default = {
    developer = "~/.ssh/developer_ed25519.pub"
    devops    = "~/.ssh/devops_ed25519.pub"
  }
}

locals {
  ssh_keys = join("\n", [
    for username, keyfile in var.ssh_users :
    "${username}:${file(keyfile)}"
  ])
}

resource "google_compute_instance" "app" {
  name         = "app-server"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
      size  = 20
    }
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral public IP
    }
  }

  metadata = {
    enable-oslogin         = "FALSE"
    block-project-ssh-keys = "true"
    ssh-keys               = local.ssh_keys
  }

  tags = ["ssh-enabled"]
}

# Firewall rule for SSH
resource "google_compute_firewall" "ssh" {
  name    = "allow-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]  # Restrict this in production
  target_tags   = ["ssh-enabled"]
}

output "instance_ip" {
  value = google_compute_instance.app.network_interface[0].access_config[0].nat_ip
}

output "ssh_command" {
  value = "ssh developer@${google_compute_instance.app.network_interface[0].access_config[0].nat_ip}"
}
```

Adding SSH keys to GCP instances with Terraform is straightforward using the metadata argument. Choose between instance-specific keys for granular control or project-wide keys for ease of management. Make sure to handle OS Login settings appropriately and follow security best practices for key management.
