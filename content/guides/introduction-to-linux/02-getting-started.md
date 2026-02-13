---
title: 'Getting Started with Linux'
description: 'Install Linux and set up your environment through various methods, including dual-booting, virtual machines, and cloud platforms.'
order: 2
---

There are multiple ways to start using Linux, from creating a full installation on your hardware to spinning up a cloud server. In this part, we'll explore your options and help you choose the best approach for your needs.

## Choose Your Linux Distribution

Before installation, you'll need to decide which Linux distribution to use. For beginners, these distributions offer good starting points:

- **Ubuntu**: User-friendly with excellent documentation and community support
- **Fedora**: Relatively user-friendly while staying current with latest technologies
- **Linux Mint**: Familiar interface for Windows users with pre-installed multimedia codecs
- **Pop!\_OS**: Optimized for developers and makers with a clean, minimalist approach

For this guide, we'll use **Ubuntu** in our examples, as it's widely used and well-documented, but the concepts apply to most distributions.

## Installation Options

You have several ways to run Linux:

1. **Dual boot**: Install Linux alongside your current operating system
2. **Full installation**: Replace your current OS with Linux
3. **Virtual machine**: Run Linux inside your current OS
4. **Linux in the cloud**: Use a Linux server in the cloud
5. **Windows Subsystem for Linux (WSL)**: Run Linux directly in Windows
6. **Live USB**: Run Linux without installing anything

Let's look at each approach in more detail.

## Option 1: Dual Boot

Dual booting lets you choose between Linux and your existing OS (like Windows) when you start your computer.

### Pros:

- Full performance for both operating systems
- Access to all hardware capabilities
- Can use either OS at any time (but not simultaneously)

### Cons:

- Requires rebooting to switch between systems
- More complicated setup
- Small risk of data loss during partitioning

### Basic Dual Boot Setup:

1. Back up all important data on your existing system
2. Download the Ubuntu ISO file from the [official website](https://ubuntu.com/download/desktop)
3. Create a bootable USB drive using [Rufus](https://rufus.ie/) (Windows) or [Etcher](https://www.balena.io/etcher/) (macOS/Linux)
4. Free up disk space by shrinking your existing partition
5. Boot from the USB drive and follow the installation prompts
6. Choose "Install alongside [existing OS]" when prompted

This creates a boot menu that appears when you start your computer, letting you choose which operating system to use.

## Option 2: Virtual Machine

Virtual machines (VMs) let you run Linux inside your existing operating system.

### Pros:

- No need to repartition your drive
- Can run alongside your regular OS
- Easy to create, delete, or reset
- Great for testing and learning

### Cons:

- Performance overhead
- Limited access to hardware
- Uses more system resources

### Setting Up a Virtual Machine:

1. Download and install virtualization software:

   - [VirtualBox](https://www.virtualbox.org/) (free, works on Windows, macOS, and Linux)
   - [VMware Workstation Player](https://www.vmware.com/products/workstation-player.html) (free for non-commercial use)

2. Download an Ubuntu ISO file

3. Create a new virtual machine:

```
# VirtualBox example commands (if using command line)
VBoxManage createvm --name "Ubuntu" --ostype Ubuntu_64 --register
VBoxManage modifyvm "Ubuntu" --memory 2048 --cpus 2
VBoxManage createhd --filename "Ubuntu.vdi" --size 20000
VBoxManage storagectl "Ubuntu" --name "SATA Controller" --add sata
VBoxManage storageattach "Ubuntu" --storagectl "SATA Controller" --port 0 --device 0 --type hdd --medium "Ubuntu.vdi"
```

Most users will prefer the graphical interface, but these commands show what's happening behind the scenes.

4. Start the VM and select your ISO file when prompted
5. Follow the on-screen installation instructions

## Option 3: Linux in the Cloud

Cloud providers let you create Linux servers in minutes without needing physical hardware.

### Pros:

- No local hardware requirements
- Accessible from anywhere
- Easy to scale resources up or down
- Perfect for hosting services or learning server administration

### Cons:

- Ongoing costs (though often inexpensive)
- Requires internet connection
- Not ideal for desktop applications

### Setting Up a Cloud Linux Server:

DigitalOcean provides one of the simplest ways to get started with a Linux server:

1. Sign up for a DigitalOcean account (use [this link](https://www.jdoqocy.com/click-101674709-15836238) to receive $200 in credits for 60 days)
2. Create a new Droplet (DigitalOcean's term for a virtual server)
3. Select Ubuntu as the operating system
4. Choose the smallest plan for learning ($4-5/month, or free with credits)
5. Select a datacenter region close to you
6. Add your SSH key (recommended) or choose password authentication
7. Click "Create Droplet"

Within a minute, you'll have a fully functional Linux server. Connect to it using SSH:

```bash
ssh root@your_server_ip
```

This approach is ideal for learning server administration or hosting web applications.

## Option 4: Windows Subsystem for Linux (WSL)

If you're using Windows 10 or 11, WSL lets you run a Linux environment without dual booting or virtual machines.

### Pros:

- Easy installation through Windows
- Good integration with Windows file system
- Better performance than most virtual machines
- No rebooting required

### Cons:

- Some limitations with system-level operations
- Not a complete Linux system
- Windows-specific solution

### Setting Up WSL:

1. Open PowerShell as Administrator and run:

```powershell
wsl --install
```

2. Restart your computer
3. WSL will finish installing Ubuntu by default
4. Create a username and password when prompted

You can now launch Ubuntu from the Start menu or by typing `wsl` in a command prompt.

## Option 5: Live USB

A live USB lets you try Linux without installing anything on your computer.

### Pros:

- No changes to your existing system
- Good way to test compatibility
- Useful for computer repair and recovery

### Cons:

- Slower performance
- Changes don't persist after reboot (unless configured with persistence)
- Limited functionality for some tasks

### Creating a Live USB:

1. Download the Ubuntu ISO file
2. Use Rufus (Windows) or Etcher (macOS/Linux) to create a bootable USB drive
3. Boot your computer from the USB drive
4. Select "Try Ubuntu" instead of "Install Ubuntu"

This gives you a fully functional Ubuntu desktop running directly from the USB drive.

## First Login and Desktop Environment

After installation, you'll be greeted by the login screen. Enter the username and password you created during setup.

Ubuntu uses the GNOME desktop environment by default, which includes:

- A dock on the left (or bottom) for frequently used applications
- Activities overview for accessing all applications
- System tray with notifications and quick settings
- Applications menu

Other distributions might use different desktop environments:

- **KDE Plasma**: Feature-rich, highly customizable
- **XFCE**: Lightweight, traditional desktop
- **Cinnamon**: Traditional layout similar to Windows
- **MATE**: Classic GNOME 2 experience

Most desktop environments share common elements like a panel, application menu, and system tray, but may organize them differently.

## Essential First Steps After Installation

Once you've installed Linux, consider these important next steps:

### 1. Update Your System

Open a terminal and run:

```bash
sudo apt update
sudo apt upgrade
```

This updates your package lists and installs the latest versions of all packages.

### 2. Install Essential Software

Ubuntu includes most basics, but you might want to add:

```bash
sudo apt install build-essential git curl wget unzip
```

For development tools, consider:

```bash
sudo apt install python3-pip nodejs npm
```

### 3. Configure System Settings

Open the Settings application to:

- Connect to Wi-Fi networks
- Configure displays
- Set up language and regional formats
- Customize appearance

### 4. Explore the File Manager

Navigate through your files using the file manager (Nautilus in Ubuntu). Key locations to explore:

- `/home/yourusername` - Your personal files
- `/etc` - System configuration files
- `/usr` - Installed applications

## Troubleshooting Common Installation Issues

### Boot Issues

If your system doesn't boot properly:

- Verify that Secure Boot is disabled in BIOS/UEFI
- Check boot order in BIOS settings
- Try nomodeset boot option for graphics issues

### Wi-Fi Problems

If Wi-Fi isn't working:

- Some wireless cards need proprietary drivers
- Connect to Ethernet if possible and run:
  ```bash
  sudo ubuntu-drivers autoinstall
  ```
- Check Additional Drivers in Software & Updates

### Graphics Issues

For display problems:

- Check for additional drivers
- For NVIDIA graphics:
  ```bash
  sudo apt install nvidia-driver-xxx
  ```
  (replace xxx with the recommended version)

## Moving Forward

Now that you have Linux up and running, we've covered the installation basics to get you started. In the next part, we'll explore the Linux command line interface, which is where you'll unlock the true power of Linux.

Whether you're using a desktop installation, virtual machine, or cloud server, the command line skills you'll learn will be applicable across all Linux environments.
