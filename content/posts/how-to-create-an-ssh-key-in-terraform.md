---
title: 'How to create an SSH key in Terraform?'
excerpt: 'Learn how to generate and manage SSH keys in Terraform for secure access to your infrastructure.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-03-20'
publishedAt: '2025-03-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - SSH
  - Security
  - DevOps
---

SSH keys are essential for secure access to servers and other resources. Terraform makes it easy to generate and manage SSH keys as part of your infrastructure code.

## Why Use Terraform for SSH Keys?

By managing SSH keys in Terraform, you can:

- Automate key generation and distribution.
- Ensure consistent key management across environments.
- Integrate key management into your Infrastructure as Code workflow.

## Generating an SSH Key in Terraform

Terraform provides the `tls_private_key` resource to generate SSH keys. Here's how to use it:

### Example Configuration

```hcl
resource "tls_private_key" "example" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

output "private_key" {
  value = tls_private_key.example.private_key_pem
  sensitive = true
}

output "public_key" {
  value = tls_private_key.example.public_key_openssh
}
```

### Explanation

- `algorithm`: Specifies the type of key to generate (e.g., RSA, ECDSA).
- `rsa_bits`: Defines the key length for RSA keys.
- `private_key_pem`: Outputs the private key in PEM format.
- `public_key_openssh`: Outputs the public key in OpenSSH format.

### Applying the Configuration

Run the following commands to generate the SSH key:

```bash
terraform init
terraform apply
```

Terraform will generate the key pair and display the public key in the output. The private key is marked as sensitive and will not be displayed unless explicitly requested.

## Using the SSH Key

You can use the generated SSH key to configure resources, such as EC2 instances:

```hcl
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"

  key_name = "example-key"

  provisioner "file" {
    source      = "local-file-path"
    destination = "/remote-path"

    connection {
      type        = "ssh"
      user        = "ec2-user"
      private_key = tls_private_key.example.private_key_pem
      host        = aws_instance.example.public_ip
    }
  }
}
```

## Best Practices

- Store private keys securely, such as in a secrets manager.
- Use strong algorithms and key lengths for better security.
- Rotate keys regularly to minimize security risks.

By following these steps, you can efficiently generate and manage SSH keys in Terraform, ensuring secure access to your infrastructure.
