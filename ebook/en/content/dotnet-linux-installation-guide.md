# Installing .NET on Linux

.NET is a free, cross-platform, open-source developer platform for building many different types of applications, including web, mobile, desktop, games, and IoT applications. You can write .NET apps using C#, F#, or Visual Basic. This guide explains how to install the .NET SDK or Runtime on various Linux distributions.

## Table of Contents

1.  [Prerequisites](#1-prerequisites)
2.  [SDK vs. Runtime](#2-sdk-vs-runtime)
3.  [Installation Methods](#3-installation-methods)
    *   [Using a Package Manager](#31-using-a-package-manager)
        *   [Ubuntu and Debian](#311-ubuntu-and-debian)
        *   [Red Hat Enterprise Linux (RHEL), CentOS Stream, and Fedora](#312-red-hat-enterprise-linux-rhel-centos-stream-and-fedora)
        *   [openSUSE Leap and SUSE Linux Enterprise Server (SLES)](#313-opensuse-leap-and-suse-linux-enterprise-server-sles)
    *   [Using Snap](#32-using-snap)
    *   [Manual Installation (Scripted or Binary Extraction)](#33-manual-installation-scripted-or-binary-extraction)
4.  [Verifying the Installation](#4-verifying-the-installation)
5.  [Troubleshooting and Considerations](#5-troubleshooting-and-considerations)
6.  [Next Steps](#6-next-steps)

## 1. Prerequisites

Before installing .NET on your Linux system, ensure you have the following:
*   A supported Linux distribution. The specific versions supported can vary by .NET release.
*   `sudo` privileges or access to an account with `sudo` privileges to install packages and update system repositories.
*   An internet connection to download the SDK and runtime packages.
*   Basic terminal knowledge to run commands.
*   Updated system packages to avoid compatibility issues. It is a good practice to update your package lists before installing new software by running `sudo apt update` (Debian/Ubuntu) or `sudo dnf update` (RHEL/Fedora).

## 2. SDK vs. Runtime

When installing .NET, you typically have two main options:

*   **.NET SDK (Software Development Kit)**: Install the SDK if you plan to develop, build, and run .NET applications. The SDK includes the runtime.
*   **.NET Runtime**: Install the runtime if you only need to run .NET applications that were built with .NET but do not include the runtime itself. If you're installing the Runtime, it's often recommended to install the ASP.NET Core Runtime, as it includes both the .NET and ASP.NET Core runtimes.

In a production environment, you usually only need the runtime, while in a development environment, you would need the SDK.

## 3. Installation Methods

There are several ways to install .NET on Linux, including using a package manager, Snap, or manual installation. Microsoft recommends using a package manager where possible.

### 3.1. Using a Package Manager

This is the recommended method for installing .NET, as it simplifies updates and dependency management. You'll typically need to add Microsoft's package signing key and repository to your system first.

#### 3.1.1. Ubuntu and Debian

For Ubuntu and Debian-based distributions, you use `apt` (Advanced Package Tool).

1.  **Update your package list and install necessary dependencies**:
    ```bash
    sudo apt update
    sudo apt install -y apt-transport-https wget
    ```
   

2.  **Add the Microsoft package signing key and repository**:
    ```bash
    wget https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
    sudo dpkg -i packages-microsoft-prod.deb
    rm packages-microsoft-prod.deb
    sudo apt update
    ```
    *(Replace `ubuntu` with `debian` and `$(lsb_release -rs)` with your Debian version, e.g., `12` for Debian 12, if needed. For Debian, the command for adding the repository might be slightly different depending on the version.)*

3.  **Install the .NET SDK or Runtime**:
    *   **Install SDK**:
        ```bash
        sudo apt install -y dotnet-sdk-8.0 # Replace 8.0 with the desired version (e.g., 9.0, 6.0)
        ```
       
    *   **Install ASP.NET Core Runtime**:
        ```bash
        sudo apt install -y aspnetcore-runtime-8.0 # Replace 8.0 with the desired version
        ```
       
    *   **Install .NET Runtime (without ASP.NET Core)**:
        ```bash
        sudo apt install -y dotnet-runtime-8.0 # Replace 8.0 with the desired version
        ```
       

    *(Note: If you install the SDK, the corresponding runtime is installed automatically as a required dependency.)*

#### 3.1.2. Red Hat Enterprise Linux (RHEL), CentOS Stream, and Fedora

For RHEL, CentOS Stream, and Fedora, you use `dnf` (Dandified YUM) or `yum`.

1.  **Install required dependencies (if not already present)**:
    ```bash
    sudo dnf install -y wget
    ```
    

2.  **Add the Microsoft package repository**:
    ```bash
    wget https://packages.microsoft.com/config/rhel/$(rpm -E %rhel)/packages-microsoft-prod.rpm -O packages-microsoft-prod.rpm
    sudo rpm -Uvh packages-microsoft-prod.rpm
    sudo dnf update
    ```
    *(Replace `rhel` with `fedora` and `$(rpm -E %rhel)` with `$(rpm -E %fedora)` if you are on Fedora.)*

3.  **Install the .NET SDK or Runtime**:
    *   **Install SDK**:
        ```bash
        sudo dnf install -y dotnet-sdk-8.0 # Replace 8.0 with the desired version (e.g., 9.0)
        ```
       
    *   **Install ASP.NET Core Runtime**:
        ```bash
        sudo dnf install -y aspnetcore-runtime-8.0 # Replace 8.0 with the desired version
        ```
       
    *   **Install .NET Runtime**:
        ```bash
        sudo dnf install -y dotnet-runtime-8.0 # Replace 8.0 with the desired version
        ```
       

    *(RHEL and CentOS Stream also include .NET in their AppStream repositories.)*

#### 3.1.3. openSUSE Leap and SUSE Linux Enterprise Server (SLES)

For openSUSE Leap and SLES, you use `zypper`.

1.  **Add the Microsoft package repository**:
    Microsoft provides instructions for adding their package repository. This usually involves adding a `.repo` file.
    *(Specific commands for openSUSE/SLES may vary slightly based on the version. Refer to Microsoft's documentation for the exact `zypper addrepo` commands and GPG key import for your specific SUSE version.)*

2.  **Install the .NET SDK or Runtime**:
    *   **Install SDK**:
        ```bash
        sudo zypper install dotnet-sdk-8.0 # Replace 8.0 with the desired version (e.g., 6.0)
        ```
       
    *   **Install ASP.NET Core Runtime**:
        ```bash
        sudo zypper install aspnetcore-runtime-8.0 # Replace 8.0 with the desired version
        ```
    *   **Install .NET Runtime**:
        ```bash
        sudo zypper install dotnet-runtime-8.0 # Replace 8.0 with the desired version
        ```

    *(The packages added to package manager feeds are named in a format like `{product}-{type}-{version}`. Example: `aspnetcore-runtime-9.0` for ASP.NET Core 9.0 runtime, `dotnet-sdk-5.0` for .NET 5 SDK.)*

### 3.2. Using Snap

Snap packages offer an alternative way to install .NET, providing sandboxed applications with automatic updates. Snap packages are often provided and maintained by Canonical (for Ubuntu) or other community members.

1.  **Ensure Snapd is installed**:
    On most modern Linux distributions, `snapd` is pre-installed. If not, you can usually install it via your distribution's package manager (e.g., `sudo apt install snapd` on Debian/Ubuntu, `sudo dnf install snapd` on Fedora).

2.  **Install the .NET SDK or Runtime via Snap**:
    *   **Install .NET SDK**:
        ```bash
        sudo snap install dotnet-sdk --classic
        # To install a specific version, use --channel (e.g., --channel=8.0/stable)
        ```
       
    *   **Install .NET Runtime**:
        ```bash
        sudo snap install dotnet-runtime --classic
        # To install a specific version, use --channel (e.g., --channel=8.0/stable)
        ```
       

    *(The `--classic` flag is often required for .NET snaps due to their need for broader system access.)*
    *(Snap can also be used to install specific versions side-by-side.)*

### 3.3. Manual Installation (Scripted or Binary Extraction)

Manual installation is useful if your Linux distribution isn't officially supported, or if you need a specific version that isn't available in package repositories (e.g., preview versions).

*   **Scripted Install**: Use the `install-dotnet.sh` script provided by Microsoft.
*   **Manual Binary Extraction**: Download the .NET binaries (tar.gz files) from the official .NET website and extract them to a desired location, then configure your PATH environment variable.

*(These methods might require manual installation of dependencies.)*

## 4. Verifying the Installation

After installing the .NET SDK or Runtime, you can verify the installation by running the following commands in your terminal:

*   **Check SDK versions**:
    ```bash
    dotnet --list-sdks
    ```
   
*   **Check Runtime versions**:
    ```bash
    dotnet --list-runtimes
    ```
   
*   **Check the installed .NET version (for the default SDK)**:
    ```bash
    dotnet --version
    ```
   

You should see the version numbers of the installed SDKs and runtimes.

## 5. Troubleshooting and Considerations

*   **Package Mix-ups**: Be cautious when using multiple package feeds (e.g., Ubuntu's native feed and Microsoft's feed) to install .NET, as this can lead to package mix-up problems. Microsoft recommends using only one source.
*   **Unsupported Versions**: When a Linux distribution version falls out of support, .NET may no longer be officially supported with that version. However, the installation instructions might still help you get it running.
*   **Dependencies**: If you install .NET manually, you might need to install additional system dependencies.
*   **`Unable to find package` errors**: This could happen if the requested version isn't available in the configured repositories or if you're trying to install on an unsupported architecture (e.g., Arm not supported by Microsoft's x64 package feed).

## 6. Next Steps

Once .NET is installed, you can start developing applications. For example, to create a new console application:

1.  **Create a new console application**:
    ```bash
    dotnet new console -o MyFirstApp
    ```
   
2.  **Navigate to the application directory**:
    ```bash
    cd MyFirstApp
    ```
   
3.  **Run the application**:
    ```bash
    dotnet run
    ```
    You should see "Hello, World!" output in your terminal.