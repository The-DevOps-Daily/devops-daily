---
title: 'Getting Started: Install Linux in a VM, WSL, the Cloud or on Hardware'
description: 'Get a Linux system to practise on: a virtual machine, WSL on Windows, a cloud server, a live USB or a dual boot, and the first steps after installing.'
order: 2
---

You learn Linux by using it, so the first step is a system where you can type commands, install software and break things without consequences. You do not have to replace your current operating system. A virtual machine or WSL gives you a full Linux environment in a few minutes, and a cloud server gives you the same kind of machine you will manage at work.

This part compares the options, walks through each one, and ends with the first things to do on a fresh install.

## Prerequisites

- A computer with at least 8 GB of RAM and 30 GB of free disk space for a virtual machine, or any computer with an SSH client for a cloud server.
- Administrator rights on that computer to install virtualization software or WSL.
- For a cloud server: an account with a cloud provider and a payment method.

## Choose a Distribution and Version

For this guide, install **Ubuntu 24.04 LTS** (the examples use it) or **Ubuntu 26.04 LTS**, the newest long-term release. LTS releases get security updates for five years, or ten with Ubuntu Pro, which is free for personal use on a few machines. Debian 13 and Fedora 44 work too; the guide points out where commands differ.

- **Ubuntu Server** has no desktop and is what you run in the cloud. It is the better choice for learning server work.
- **Ubuntu Desktop** includes the GNOME desktop, a browser and a graphical terminal. It suits a laptop or a VM you use every day.

Download images only from the distribution's own site (ubuntu.com, debian.org, fedoraproject.org). On a Mac with Apple Silicon, or any ARM computer, download the **ARM64** (also called `aarch64`) image; the usual `amd64` images do not run there.

## Your Options

| Option                    | Setup time       | Cost                                      | Risk to your computer                         | Best for                                               |
| ------------------------- | ---------------- | ----------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Virtual machine           | 15 to 30 minutes | Free                                      | None                                          | Learning, experiments, snapshots before risky changes  |
| WSL on Windows            | 5 minutes        | Free                                      | None                                          | Developers on Windows who want a Linux shell and tools |
| Cloud server              | 2 minutes        | A few dollars a month, often free credits | None                                          | Practising real server administration over SSH         |
| Live USB                  | 15 minutes       | A USB stick                               | None (nothing is installed)                   | Testing hardware compatibility before installing       |
| Dual boot or full install | 1 hour           | Free                                      | Possible data loss if partitioning goes wrong | Using Linux as your main system                        |

You can also run `docker run -it --rm ubuntu:24.04 bash` to get an Ubuntu shell in seconds, but a container has no systemd, no kernel of its own and a minimal set of packages. It is fine for trying commands, not for learning to run a system.

## Option 1: A Virtual Machine

A virtual machine (VM) runs a complete Linux system inside your current one. Give it 2 CPUs, 4 GB of RAM for a desktop (2 GB is enough for a server) and a 25 GB disk.

The fastest route on any operating system is **Multipass**, Canonical's tool that creates Ubuntu VMs from the command line. Install it from canonical.com/multipass (on Linux: `sudo snap install multipass`), then:

```bash
multipass launch 24.04 --name lab --cpus 2 --memory 2G --disk 20G
multipass list               # show VMs and their IP addresses
multipass shell lab          # open a shell inside the VM; type exit to come back
```

When you no longer need the VM, run these on your own machine, not inside the VM:

```bash
multipass stop lab
multipass delete --purge lab # remove it completely
```

If you prefer a graphical installer or another distribution, use the virtualization software for your system:

```tabs
{
  "title": "Virtualization software",
  "tabs": [
    {
      "label": "Windows",
      "lang": "text",
      "code": "Hyper-V (Windows Pro and Enterprise): enable it in \"Turn Windows features on or off\",\n  then use Hyper-V Quick Create, which can download Ubuntu for you.\nVirtualBox (free, open source): create a VM, attach the ISO, start it.\nVMware Workstation Pro: free for personal and commercial use since November 2024.\n\nAll of them need hardware virtualization (Intel VT-x or AMD-V/SVM)\nenabled in the computer's firmware settings."
    },
    {
      "label": "macOS",
      "lang": "text",
      "code": "UTM (free, open source): uses Apple's virtualization framework.\nVMware Fusion Pro: free for personal and commercial use.\nParallels Desktop: paid, with an easy Ubuntu installer.\nVirtualBox 7.2: runs ARM64 Linux guests on Apple Silicon; still experimental.\n\nOn Apple Silicon, use ARM64 images. x86 images only run under slow emulation."
    },
    {
      "label": "Linux",
      "lang": "bash",
      "code": "# KVM with virt-manager (Ubuntu/Debian; on Fedora: sudo dnf install @virtualization)\nsudo apt install virt-manager qemu-system libvirt-daemon-system\nsudo usermod -aG libvirt,kvm \"$USER\"     # log out and back in afterwards\nvirt-manager\n\n# Or GNOME Boxes for a simpler interface\nsudo apt install gnome-boxes"
    }
  ]
}
```

During a graphical installation, accept the defaults unless you have a reason not to: erase the virtual disk (it is only a file on your computer), create a user, and on Ubuntu Server tick **Install OpenSSH server** so you can connect from your own terminal later.

Take a **snapshot** of the VM after the installation. When an experiment goes wrong, you roll back in seconds instead of reinstalling.

## Option 2: WSL on Windows

The **Windows Subsystem for Linux** (WSL 2) runs a real Linux kernel in a lightweight VM that Windows manages for you. It works on Windows 11 and on Windows 10 version 2004 and later. Open **PowerShell as Administrator**:

```powershell
wsl --install                     # installs WSL and Ubuntu; restart if asked
wsl --list --online               # distributions you can install
wsl --install -d Ubuntu-24.04     # a specific distribution
wsl --list --verbose              # installed distributions and their WSL version
wsl --update                      # update the WSL kernel and tools
wsl --shutdown                    # stop all distributions
```

After the restart, Ubuntu opens and asks you to create a Linux username and password. They are separate from your Windows account; the password is what `sudo` asks for.

Things to know about WSL:

- **systemd** is enabled in current Ubuntu images, so `systemctl` works. If an older distribution does not have it, add `[boot]` and `systemd=true` to `/etc/wsl.conf` and run `wsl --shutdown`.
- **Files**: your Windows drives appear under `/mnt/c`, `/mnt/d` and so on, and Windows can open the Linux files at `\\wsl$\Ubuntu-24.04\home\<you>`. Keep your projects in the Linux home directory: file access across the boundary is much slower.
- **Networking** is mostly automatic. Services you start in WSL are reachable from Windows at `localhost`.
- WSL is great for development tools. To practise server administration (boot, disks, firewalls), a VM or a cloud server is closer to the real thing.

## Option 3: A Cloud Server

A small cloud VM costs a few dollars a month, often less while you have trial credits, and behaves exactly like the servers you will manage at work. Every provider follows the same steps:

1. Create an account. For DigitalOcean, you can use [this DigitalOcean referral link](https://m.do.co/c/2a9bba940f39): new accounts that sign up through it get DigitalOcean's standard [sign-up credit](https://docs.digitalocean.com/platform/billing/signup-credit/) (the page lists the current amount), and you add a payment method before you create a Droplet. AWS, Google Cloud, Azure, Hetzner and others have their own free tiers or credits.
2. Create a server (DigitalOcean calls it a **Droplet**, AWS an **EC2 instance**) with **Ubuntu 24.04 LTS** and the smallest size.
3. Pick a region close to you.
4. Add your **SSH public key** instead of a password. If you do not have one yet, run `ssh-keygen -t ed25519` on your computer and paste the contents of `~/.ssh/id_ed25519.pub` ([Part 6](/guides/introduction-to-linux/06-user-management) explains keys).
5. Create the server and copy its public IP address.

Connect from your terminal (macOS, Linux, or Windows PowerShell, which includes an SSH client):

```bash
ssh root@203.0.113.10        # DigitalOcean and many others log you in as root
ssh ubuntu@203.0.113.10      # AWS and some others use a default user called ubuntu
```

The first time, SSH asks you to confirm the server's **host key fingerprint**; type `yes`. Then follow the [new server checklist](/guides/introduction-to-linux/10-system-administration) in Part 10: create your own user, turn off root and password logins, enable the firewall.

:::warning
A cloud server is reachable from the whole internet from its first minute, and bots start trying passwords within minutes. Use SSH keys, keep the system updated, and **delete servers you no longer use**: they keep costing money, and nobody patches a forgotten server.
:::

## Option 4: Live USB, Dual Boot or a Full Install

To run Linux directly on a computer, write the installation image to a USB stick:

1. Download the ISO and its `SHA256SUMS` file, and check the download. For example (example output):

   ```bash
   sha256sum -c SHA256SUMS --ignore-missing
   ```

   ```text
   ubuntu-24.04.5-desktop-amd64.iso: OK
   ```

2. Write the image to a USB stick of 8 GB or more with **balenaEtcher** (Windows, macOS, Linux), **Rufus** (Windows) or **Fedora Media Writer**. On Linux, `sudo dd if=ubuntu.iso of=/dev/sdX bs=4M status=progress oflag=sync` works too; check the device name with `lsblk` first, because `dd` overwrites whatever you point it at.
3. Restart the computer and open its boot menu (usually **F12**, **F10**, **F2** or **Esc** at power-on) to boot from the USB stick.
4. Choose **Try Ubuntu** to run a live session without installing anything, which is a good way to check that Wi-Fi, graphics and sound work.

For a **dual boot** next to Windows, prepare first:

- Back up your data.
- If the Windows drive uses **BitLocker** or device encryption, write down the recovery key before you change anything.
- Turn off **Fast Startup** in Windows' power settings, so Windows does not keep the disk locked.
- Leave **Secure Boot on**: Ubuntu, Fedora and Debian boot with it. Only some third-party drivers, such as NVIDIA's, need an extra step: the installer asks you to set a password and confirm it at the next boot (MOK enrollment).

Then start the installer, choose **Install Ubuntu alongside Windows** (or shrink the Windows partition by hand), and finish the installation. At every boot, the GRUB menu lets you pick the system.

## Desktop Environments

On a desktop installation, the **desktop environment** decides how windows, menus and settings look. Ubuntu and Fedora Workstation use **GNOME**; Kubuntu and Fedora KDE use **KDE Plasma**; Linux Mint uses **Cinnamon**; **Xfce** is a light option for older hardware; Pop!\_OS uses **COSMIC**. The command line works the same on all of them. Open a terminal with **Ctrl+Alt+T** on Ubuntu, or search for "Terminal".

## First Steps After Installing

Whichever option you chose, open a terminal and do these once:

```bash
# 1. Install all updates (Part 5 explains apt and dnf)
sudo apt update && sudo apt full-upgrade        # Fedora/RHEL: sudo dnf upgrade
sudo reboot                                     # if a kernel update was installed

# 2. Check what you are running
cat /etc/os-release
uname -r

# 3. Install tools this guide uses
sudo apt install curl git htop tree jq python3-venv     # Fedora: sudo dnf install curl git htop tree jq

# 4. Set the time zone (servers usually stay on UTC)
timedatectl
sudo timedatectl set-timezone Europe/Berlin     # pick yours from: timedatectl list-timezones
```

On Ubuntu, security updates install automatically (unattended-upgrades); Part 10 shows how to check and configure that. On a server, continue with SSH keys and the firewall before anything else.

## Troubleshooting

**The VM does not start or is very slow.** Hardware virtualization is probably off. Enable **Intel VT-x** or **AMD-V** (sometimes called **SVM Mode**) in the firmware settings. On Windows, VirtualBox and VMware can run next to Hyper-V, but older versions could not; update them.

**WSL reports error 0x80370102.** Virtualization is disabled in the firmware, or the **Virtual Machine Platform** feature is off. Enable both and restart.

**The USB stick does not show up in the boot menu.** Re-create it with another tool, try another USB port, and check whether the firmware is set to boot UEFI devices.

**Wi-Fi or graphics do not work after installing.** Connect with a cable if you can, then open **Software & Updates**, **Additional Drivers**, or run `sudo ubuntu-drivers install`, which installs the recommended proprietary drivers (for NVIDIA graphics, for example). As a temporary workaround for a black screen, add `nomodeset` to the kernel line in the GRUB menu.

**The clock is wrong after booting Windows.** Linux stores UTC in the hardware clock and Windows stores local time. Run `timedatectl set-local-rtc 1` on Linux, or better, set Windows to use UTC.

## Common Mistakes

- **Downloading an `amd64` image for an ARM computer**, or the other way round.
- **Installing without a backup** when you resize or overwrite partitions.
- **Leaving password logins on** for a cloud server.
- **Forgetting a cloud server** that keeps running and costing money.
- **Doing everything as root.** Create a normal user and use `sudo` (Part 6).

## Summary

- Practise on a VM (Multipass is the fastest), WSL on Windows, or a small cloud server; none of them risks your current system.
- Use an LTS release such as Ubuntu 24.04 or 26.04, and the ARM64 image on ARM hardware.
- For a real installation: verify the ISO, back up, keep the BitLocker recovery key, and leave Secure Boot on.
- After installing: update, reboot if needed, install basic tools, and secure servers before anything else.

Next: [The Linux Command Line Interface](/guides/introduction-to-linux/03-command-line-interface), where you start using the terminal.

## Keep Learning

- Exercise: [Creating and connecting to your first Linux server](/exercises/cloud-server-setup)
- [Linux Terminal simulator](/games/linux-terminal), if you want to try commands before you install anything
- [Introduction to Docker](/guides/introduction-to-docker), once you have a Linux system to run it on
