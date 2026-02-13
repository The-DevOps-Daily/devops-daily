---
title: 'Networking in Linux'
description: 'Learn how to configure, monitor, and troubleshoot networks on Linux systems.'
order: 8
---

Networking is a fundamental aspect of modern computing, and Linux provides powerful tools for network configuration, monitoring, and troubleshooting. Whether you're setting up a home server, configuring a web server in the cloud, or just trying to diagnose connectivity issues, understanding Linux networking is essential.

In this part, we'll explore networking concepts and tools in Linux, from basic configuration to advanced monitoring and security.

## Network Basics in Linux

### Understanding Network Interfaces

Every network connection in Linux is made through a network interface. These can be physical (like Ethernet cards) or virtual (like VPN tunnels).

List network interfaces:

```bash
ip link show
```

Or using the older command:

```bash
ifconfig
```

Common naming conventions for interfaces:

- `eth0`, `eth1`: Traditional names for Ethernet interfaces
- `enp3s0`, `ens33`: Predictable interface names in newer distributions
- `wlan0`, `wlp3s0`: Wireless interfaces
- `lo`: Loopback interface (always present)

### Viewing Network Configuration

Check IP address configuration:

```bash
ip addr show
```

View routing table:

```bash
ip route show
```

Check DNS servers:

```bash
cat /etc/resolv.conf
```

Display network connections:

```bash
ss -tuln
```

The options mean:

- `t`: TCP connections
- `u`: UDP connections
- `l`: Show only listening sockets
- `n`: Don't resolve service names

## Network Configuration

### Temporary Configuration

Set an IP address temporarily:

```bash
sudo ip addr add 192.168.1.100/24 dev eth0
```

Bring an interface up or down:

```bash
sudo ip link set eth0 up
sudo ip link set eth0 down
```

Add a static route:

```bash
sudo ip route add 10.0.0.0/24 via 192.168.1.1
```

These changes won't persist after a reboot.

### Permanent Configuration

Network configuration files differ by distribution:

#### Debian/Ubuntu

For simple setups, edit `/etc/network/interfaces`:

```bash
sudo nano /etc/network/interfaces
```

Example static IP configuration:

```
auto eth0
iface eth0 inet static
    address 192.168.1.100
    netmask 255.255.255.0
    gateway 192.168.1.1
    dns-nameservers 8.8.8.8 8.8.4.4
```

For DHCP:

```
auto eth0
iface eth0 inet dhcp
```

Apply changes:

```bash
sudo systemctl restart networking
```

#### Newer Debian/Ubuntu with Netplan

Ubuntu 18.04 and newer use Netplan. Configuration files are in `/etc/netplan/`:

```bash
sudo nano /etc/netplan/01-netcfg.yaml
```

Example configuration:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens33:
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

Apply changes:

```bash
sudo netplan apply
```

#### RHEL/CentOS/Fedora

Edit files in `/etc/sysconfig/network-scripts/`:

```bash
sudo nano /etc/sysconfig/network-scripts/ifcfg-eth0
```

Example static IP configuration:

```
TYPE=Ethernet
BOOTPROTO=static
IPADDR=192.168.1.100
NETMASK=255.255.255.0
GATEWAY=192.168.1.1
DNS1=8.8.8.8
DNS2=8.8.4.4
DEFROUTE=yes
NAME=eth0
DEVICE=eth0
ONBOOT=yes
```

For DHCP:

```
TYPE=Ethernet
BOOTPROTO=dhcp
NAME=eth0
DEVICE=eth0
ONBOOT=yes
```

Apply changes:

```bash
sudo systemctl restart network
```

#### NetworkManager (Most Desktop Distributions)

NetworkManager provides both GUI and command-line tools for network configuration:

```bash
# Show connections
nmcli connection show

# Show device status
nmcli device status

# Connect to a network
nmcli connection up "Connection Name"

# Create a new connection
nmcli connection add con-name "Home Network" type ethernet ifname eth0 \
  ipv4.method manual ipv4.addresses 192.168.1.100/24 ipv4.gateway 192.168.1.1 \
  ipv4.dns "8.8.8.8 8.8.4.4"
```

### Configuring Wireless Networks

Connect to a WiFi network:

```bash
# Scan for available networks
sudo iwlist wlan0 scan | grep ESSID

# Connect using NetworkManager
nmcli device wifi list
nmcli device wifi connect "SSID" password "your_password"
```

Using `wpa_supplicant` directly:

```bash
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
```

Add the following:

```
network={
    ssid="Your_SSID"
    psk="Your_Password"
}
```

Connect:

```bash
sudo wpa_supplicant -B -i wlan0 -c /etc/wpa_supplicant/wpa_supplicant.conf
sudo dhclient wlan0
```

## Network Troubleshooting Tools

### Checking Connectivity

Test basic connectivity with `ping`:

```bash
ping google.com
ping -c 4 192.168.1.1
```

Trace the route packets take:

```bash
traceroute google.com
```

An alternative that works through firewalls:

```bash
mtr google.com
```

### DNS Troubleshooting

Look up DNS records:

```bash
dig google.com
dig google.com MX
dig -x 8.8.8.8
```

Query a specific DNS server:

```bash
dig @8.8.8.8 google.com
```

Check the system's hostname resolution:

```bash
getent hosts google.com
```

### Socket and Port Analysis

Check listening ports and connections:

```bash
ss -tuln
```

View programs using network connections:

```bash
sudo ss -tulnp
```

Check which process is using a specific port:

```bash
sudo lsof -i :80
```

### Network Traffic Analysis

Capture network traffic with `tcpdump`:

```bash
sudo tcpdump -i eth0 -n
```

Filter traffic by host or port:

```bash
sudo tcpdump -i eth0 host 192.168.1.100
sudo tcpdump -i eth0 port 80
```

For a more user-friendly interface, use Wireshark:

```bash
sudo apt install wireshark    # Debian/Ubuntu
sudo dnf install wireshark    # Fedora/RHEL/CentOS

# Run wireshark (GUI)
sudo wireshark
```

### Bandwidth Monitoring

Monitor bandwidth usage:

```bash
sudo apt install iftop    # Debian/Ubuntu
sudo dnf install iftop    # Fedora/RHEL/CentOS

sudo iftop -i eth0
```

For a simpler view:

```bash
sudo apt install nload    # Debian/Ubuntu
sudo dnf install nload    # Fedora/RHEL/CentOS

sudo nload eth0
```

## Network Services

### SSH (Secure Shell)

SSH is essential for remote administration of Linux systems.

Connect to a remote server:

```bash
ssh username@server_ip
```

Using a different port:

```bash
ssh -p 2222 username@server_ip
```

Using key authentication:

```bash
ssh -i /path/to/private_key username@server_ip
```

Copy files securely with `scp`:

```bash
# Copy local file to remote server
scp /path/to/local/file username@server_ip:/path/to/remote/directory

# Copy remote file to local system
scp username@server_ip:/path/to/remote/file /path/to/local/directory

# Copy entire directory recursively
scp -r /path/to/local/directory username@server_ip:/path/to/remote/directory
```

Tunnel traffic through SSH (port forwarding):

```bash
# Local port forwarding (access remote service locally)
ssh -L 8080:localhost:80 username@server_ip

# Remote port forwarding (make local service available remotely)
ssh -R 8080:localhost:80 username@server_ip

# Dynamic port forwarding (SOCKS proxy)
ssh -D 9090 username@server_ip
```

### SSH Server Configuration

Configure the SSH server by editing `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Important settings:

```
# Change default port
Port 2222

# Disable root login
PermitRootLogin no

# Allow only specific users
AllowUsers user1 user2

# Disable password authentication (use keys only)
PasswordAuthentication no

# Allow only key-based authentication
PubkeyAuthentication yes
```

After changes, restart the SSH service:

```bash
sudo systemctl restart sshd
```

### HTTP/Web Servers

Install and configure Apache:

```bash
sudo apt install apache2    # Debian/Ubuntu
sudo dnf install httpd      # Fedora/RHEL/CentOS

# Start and enable the service
sudo systemctl start apache2    # Debian/Ubuntu
sudo systemctl enable apache2

sudo systemctl start httpd      # Fedora/RHEL/CentOS
sudo systemctl enable httpd
```

Install Nginx:

```bash
sudo apt install nginx      # Debian/Ubuntu
sudo dnf install nginx      # Fedora/RHEL/CentOS

# Start and enable the service
sudo systemctl start nginx
sudo systemctl enable nginx
```

Basic Nginx configuration (`/etc/nginx/sites-available/default` or `/etc/nginx/conf.d/default.conf`):

```
server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

### DNS Servers

Install and configure BIND:

```bash
sudo apt install bind9      # Debian/Ubuntu
sudo dnf install bind       # Fedora/RHEL/CentOS

# Configure BIND
sudo nano /etc/bind/named.conf.local
```

Basic zone configuration:

```
zone "example.com" {
    type master;
    file "/etc/bind/zones/example.com.zone";
};
```

Create the zone file:

```bash
sudo mkdir -p /etc/bind/zones
sudo nano /etc/bind/zones/example.com.zone
```

Zone file content:

```
$TTL    86400
@       IN      SOA     ns1.example.com. admin.example.com. (
                  2025051401 ; Serial
                  3600       ; Refresh
                  1800       ; Retry
                  604800     ; Expire
                  86400      ; Minimum TTL
)
@       IN      NS      ns1.example.com.
@       IN      A       192.168.1.100
www     IN      A       192.168.1.100
ns1     IN      A       192.168.1.100
```

Restart BIND:

```bash
sudo systemctl restart bind9    # Debian/Ubuntu
sudo systemctl restart named    # Fedora/RHEL/CentOS
```

## Network Security

### Firewalls

#### UFW (Uncomplicated Firewall)

UFW is a user-friendly front-end for iptables (Debian/Ubuntu):

```bash
# Install UFW
sudo apt install ufw

# Check status
sudo ufw status

# Enable UFW
sudo ufw enable

# Basic rules
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Allow specific port
sudo ufw allow 8080/tcp

# Allow from specific IP
sudo ufw allow from 192.168.1.100

# Deny a service
sudo ufw deny telnet

# Delete a rule (by number)
sudo ufw status numbered
sudo ufw delete 2
```

#### firewalld

Firewalld is the default firewall on Fedora/RHEL/CentOS:

```bash
# Check status
sudo firewall-cmd --state

# List allowed services
sudo firewall-cmd --list-services

# Allow a service
sudo firewall-cmd --add-service=http --permanent

# Allow a port
sudo firewall-cmd --add-port=8080/tcp --permanent

# Apply changes
sudo firewall-cmd --reload
```

#### iptables

Direct iptables commands (low-level):

```bash
# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Drop all other incoming traffic
sudo iptables -A INPUT -j DROP

# Save rules
sudo iptables-save | sudo tee /etc/iptables.rules
```

### Secure Network Services

Restricting SSH access:

```bash
# Allow SSH only from specific IP ranges
sudo ufw allow from 192.168.1.0/24 to any port 22
```

Add firewall rules to limit connection attempts:

```bash
# Using iptables to limit SSH connection attempts
sudo iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --set
sudo iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 4 -j DROP
```

### Network Encryption

Set up WireGuard VPN (modern, fast, secure VPN):

```bash
# Install WireGuard
sudo apt install wireguard    # Debian/Ubuntu
sudo dnf install wireguard-tools    # Fedora/RHEL/CentOS

# Generate keys
wg genkey | tee privatekey | wg pubkey > publickey

# Create configuration
sudo nano /etc/wireguard/wg0.conf
```

Basic WireGuard configuration:

```
[Interface]
PrivateKey = your_private_key_here
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = peer_public_key_here
AllowedIPs = 10.0.0.2/32
```

Start WireGuard:

```bash
sudo wg-quick up wg0
```

Enable at boot:

```bash
sudo systemctl enable wg-quick@wg0
```

## Advanced Networking Topics

### Network Namespaces

Network namespaces isolate network resources, similar to how containers work:

```bash
# Create a new network namespace
sudo ip netns add test_ns

# List namespaces
ip netns list

# Execute command in namespace
sudo ip netns exec test_ns ip addr

# Create a virtual Ethernet pair
sudo ip link add veth0 type veth peer name veth1

# Move one end to the namespace
sudo ip link set veth1 netns test_ns

# Configure the interfaces
sudo ip addr add 192.168.100.1/24 dev veth0
sudo ip netns exec test_ns ip addr add 192.168.100.2/24 dev veth1

# Bring up the interfaces
sudo ip link set veth0 up
sudo ip netns exec test_ns ip link set veth1 up
sudo ip netns exec test_ns ip link set lo up
```

### Network Bridging

Create a bridge for connecting VMs or containers:

```bash
# Install bridge utilities
sudo apt install bridge-utils    # Debian/Ubuntu
sudo dnf install bridge-utils    # Fedora/RHEL/CentOS

# Create a bridge
sudo ip link add name br0 type bridge
sudo ip link set dev br0 up

# Add interfaces to the bridge
sudo ip link set dev eth0 master br0
sudo ip link set dev eth1 master br0

# Configure the bridge with an IP
sudo ip addr add 192.168.1.100/24 dev br0
```

### Bonding Network Interfaces

Combine multiple network interfaces for redundancy or increased bandwidth:

```bash
# Load the bonding module
sudo modprobe bonding

# Create a bond interface
sudo ip link add bond0 type bond
sudo ip link set bond0 up

# Set the bonding mode
echo "active-backup" | sudo tee /sys/class/net/bond0/bonding/mode

# Add interfaces to the bond
sudo ip link set eth0 down
sudo ip link set eth1 down
sudo ip link set eth0 master bond0
sudo ip link set eth1 master bond0
sudo ip link set eth0 up
sudo ip link set eth1 up

# Configure the bond with an IP
sudo ip addr add 192.168.1.100/24 dev bond0
```

### Traffic Control

Limit bandwidth with `tc` (Traffic Control):

```bash
# Limit outgoing bandwidth to 1Mbps
sudo tc qdisc add dev eth0 root tbf rate 1mbit burst 32kbit latency 400ms

# Remove the limitation
sudo tc qdisc del dev eth0 root
```

## Network Configuration for Cloud Environments

When running Linux in the cloud, network configuration is often handled differently.

### Example: DigitalOcean Droplet

When you create a Droplet on DigitalOcean (use [this link](https://www.jdoqocy.com/click-101674709-15836238) to receive $200 in credits), networking is pre-configured, but you may need to make changes:

1. Configure Private Networking:

   - Private networking is enabled by default on new Droplets
   - Access your Droplet through its private IP for data transfer between Droplets in the same region

2. Configure Floating IP:

   - Assign a Floating IP to your Droplet for a static public IP that can be easily moved between Droplets

3. Configure Firewall:
   - Use DigitalOcean's Cloud Firewall or configure UFW/iptables on your Droplet
   - Basic UFW setup for a web server:

```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

## Practical Networking Examples

Let's apply what we've learned with some practical examples:

### Setting Up a Simple Web Server

```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Check that it's running
sudo systemctl status nginx

# Configure firewall to allow HTTP traffic
sudo ufw allow 'Nginx HTTP'
sudo ufw status

# Get your public IP
curl ifconfig.me

# Now you can access your web server at http://your_ip_address
```

### Creating a Secure SSH Configuration

```bash
# Create backup of original configuration
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# Edit SSH config
sudo nano /etc/ssh/sshd_config
```

Make these changes:

```
# Use a non-standard port
Port 2222

# Disable root login
PermitRootLogin no

# Disable password authentication
PasswordAuthentication no

# Limit user access
AllowUsers yourusername

# Automatic logout of idle sessions
ClientAliveInterval 300
ClientAliveCountMax 2
```

Apply changes:

```bash
# Check config for errors
sudo sshd -t

# Restart SSH service if no errors
sudo systemctl restart sshd
```

Test before logging out:

```bash
# Open a new terminal and try to connect
ssh -p 2222 yourusername@your_server_ip
```

### Setting Up Network Address Translation (NAT)

Configure a Linux machine to share its internet connection:

```bash
# Enable IP forwarding
echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward

# Make it permanent
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Configure NAT with iptables
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i eth1 -o eth0 -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o eth1 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Save iptables rules
sudo iptables-save | sudo tee /etc/iptables.rules
```

### Setting Up DNS Caching

Improve network performance with DNS caching:

```bash
# Install dnsmasq
sudo apt install dnsmasq

# Configure dnsmasq
sudo nano /etc/dnsmasq.conf
```

Add these lines:

```
# Listen on localhost
listen-address=127.0.0.1

# Use Google DNS as upstream
server=8.8.8.8
server=8.8.4.4

# Cache size
cache-size=1000
```

Configure system to use the local DNS server:

```bash
sudo nano /etc/resolv.conf
```

Change to:

```
nameserver 127.0.0.1
```

To make it permanent:

```bash
# For systems using NetworkManager
sudo nano /etc/NetworkManager/NetworkManager.conf
```

Add:

```
[main]
dns=dnsmasq
```

Restart services:

```bash
sudo systemctl restart dnsmasq
sudo systemctl restart NetworkManager
```

## Moving Forward

You now have a solid understanding of Linux networking concepts and tools. These skills will help you configure, monitor, and troubleshoot networks on any Linux system.

In the next part, we'll explore shell scripting basics, allowing you to automate tasks and build powerful tools using the Linux command line.

Linux networking capabilities range from simple configuration to advanced network services and security. Whether you're managing a single system or an entire infrastructure, these networking skills form a crucial part of your Linux toolkit.
