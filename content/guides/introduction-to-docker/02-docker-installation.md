---
title: Installing Docker
description: Set up Docker on your system and verify it's working correctly
order: 2
---

Before you can start building and running containers, you need to install Docker on your system. This section guides you through installing Docker on various operating systems and verifying your installation.

## Prerequisites

- Administrative or sudo access on your system
- A supported operating system (Linux, macOS, or Windows)
- Internet connection for downloading Docker packages

## Installing Docker on Ubuntu

Docker installation on Ubuntu is straightforward. We'll install Docker Community Edition (CE), which is perfect for individual developers and small teams.

First, update your package index and install prerequisite packages:

```bash
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
```

Next, add Docker's official GPG key:

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
```

Add the Docker repository to APT sources:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Now, update your package index again and install Docker:

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io
```

After installation, Docker service should start automatically. Verify it's running:

```bash
sudo systemctl status docker
```

## Installing Docker on macOS

Docker Desktop for Mac provides an easy-to-install package that includes everything you need.

1. Visit the [Docker Desktop for Mac download page](https://www.docker.com/products/docker-desktop)
2. Download the .dmg file
3. Double-click the .dmg file to open the installer
4. Drag the Docker icon to the Applications folder
5. Open Docker from your Applications folder

Docker Desktop runs a lightweight VM behind the scenes to provide Linux container functionality on macOS.

## Installing Docker on Windows

For Windows 10/11 Professional, Enterprise, or Education editions with Hyper-V capability:

1. Visit the [Docker Desktop for Windows download page](https://www.docker.com/products/docker-desktop)
2. Download the installer
3. Run the installer and follow the prompts
4. Start Docker Desktop from the Start menu

For Windows Home edition or systems without Hyper-V, Docker Desktop now uses WSL 2 (Windows Subsystem for Linux 2):

1. Install WSL 2 by following [Microsoft's instructions](https://docs.microsoft.com/en-us/windows/wsl/install)
2. Download and install Docker Desktop
3. Ensure Docker is configured to use the WSL 2 backend in Settings

## Post-Installation Steps for Linux

On Linux, you might want to add your user to the `docker` group to run Docker commands without `sudo`:

```bash
sudo usermod -aG docker $USER
```

After running this command, log out and back in for the changes to take effect.

## Running Docker in the Cloud

If you don't want to install Docker locally, you can use a cloud-based development environment. DigitalOcean's Droplets provide an excellent platform for running Docker.

You can quickly spin up a Droplet with Docker pre-installed using their One-Click Docker application. [Get $200 in free credits when you sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to test your Docker applications in the cloud.

## Verifying Your Installation

Regardless of your operating system, verify your installation by running the following command:

```bash
docker --version
```

You should see output similar to:

```
Docker version 24.0.7, build afdd53b4e3
```

To verify that Docker can pull images and run containers, try running the "hello-world" container:

```bash
docker run hello-world
```

If successful, you'll see a message indicating that your installation is working correctly:

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
...
```

## Docker Components Installed

When you install Docker, you get:

1. **Docker daemon (dockerd)**: The persistent background process that manages Docker objects
2. **Docker client (docker)**: The command-line tool that allows you to interact with Docker
3. **Docker Compose**: A tool for defining and running multi-container applications
4. **Docker content trust**: A feature for signing and verifying container images

## Updating Docker

It's good practice to keep Docker updated to benefit from security patches and new features:

- **Linux**: Update using your package manager (e.g., `sudo apt update && sudo apt upgrade`)
- **macOS/Windows**: Docker Desktop typically notifies you when updates are available

## Troubleshooting Common Installation Issues

If Docker isn't working after installation, try these steps:

1. Ensure the Docker daemon is running:

   ```bash
   sudo systemctl status docker
   ```

2. Check if your user has permissions to run Docker (Linux):

   ```bash
   groups | grep docker
   ```

3. Restart the Docker service:

   ```bash
   sudo systemctl restart docker
   ```

4. For Docker Desktop, check system requirements and restart the application

Now that you have Docker installed and verified, you're ready to start working with Docker containers and images in the next section.
