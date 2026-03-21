---
title: 'Capturing Mobile Phone Traffic on Wireshark'
excerpt: 'Learn how to capture and analyze network traffic from your mobile phone using Wireshark. Set up a proxy or WiFi hotspot to inspect HTTP/HTTPS requests, debug mobile apps, and understand what data your phone is sending.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-02-06'
publishedAt: '2025-02-06T12:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - Wireshark
  - Mobile
  - Debugging
  - Security
---

Capturing network traffic from your mobile phone helps you debug mobile app development, analyze network usage, investigate security concerns, or understand what data your apps are sending. Wireshark, the network protocol analyzer, can capture and inspect this traffic, but mobile devices require special setup since you can't install Wireshark directly on them.

This guide shows you how to route your phone's traffic through a computer running Wireshark so you can see every packet your phone sends and receives.

## TLDR

To capture mobile traffic with Wireshark, use one of these methods: (1) Create a WiFi hotspot on your laptop, connect your phone to it, and capture on the hotspot interface. (2) Use your computer as a proxy (mitmproxy or Burp Suite), configure the proxy on your phone, and inspect HTTPS traffic with SSL inspection. (3) Use ADB for Android to create a reverse tethering setup. For encrypted HTTPS traffic, you must install a certificate authority on your phone.

## Prerequisites

You need Wireshark installed on your computer, a mobile device with WiFi capabilities, and the ability to configure network settings on your phone. For HTTPS traffic inspection, you'll need proxy software like mitmproxy. Some methods require USB debugging enabled on Android devices.

## Method 1: WiFi Hotspot Capture

The simplest method is turning your computer into a WiFi hotspot and capturing traffic on that interface.

### Setting Up on Linux

Create a WiFi hotspot and share your ethernet connection:

```bash
# Install required packages
sudo apt-get install hostapd dnsmasq

# Stop NetworkManager from interfering
sudo systemctl stop NetworkManager

# Configure hostapd for WiFi hotspot
cat > /tmp/hostapd.conf << 'EOF'
interface=wlan0
driver=nl80211
ssid=CaptureNet
hw_mode=g
channel=6
wpa=2
wpa_passphrase=wireshark123
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF

# Start hotspot
sudo hostapd /tmp/hostapd.conf &

# Configure IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1

# Set up NAT
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Configure DHCP
cat > /tmp/dnsmasq.conf << 'EOF'
interface=wlan0
dhcp-range=192.168.100.10,192.168.100.50,12h
EOF

sudo dnsmasq -C /tmp/dnsmasq.conf
```

Connect your phone to the "CaptureNet" WiFi network (password: wireshark123).

Start Wireshark and capture on `wlan0`:

```bash
sudo wireshark
# Select wlan0 interface
# Click Start
```

### Setting Up on macOS

macOS makes this easier through System Preferences:

```
1. Go to System Preferences → Sharing
2. Select "Internet Sharing"
3. Share your connection from: Ethernet
4. To computers using: WiFi
5. WiFi Options:
   Network Name: CaptureNet
   Security: WPA2 Personal
   Password: wireshark123
6. Enable Internet Sharing
```

Launch Wireshark:

```bash
# Find the interface name
ifconfig | grep -A 1 "bridge"

# Usually bridge100 on macOS
sudo wireshark
# Select bridge100
# Click Start
```

Connect your phone to CaptureNet, then browse or use apps. You'll see all traffic in Wireshark.

### Setting Up on Windows

Create a mobile hotspot:

```
1. Settings → Network & Internet → Mobile hotspot
2. Share my Internet connection from: Ethernet
3. Network name: CaptureNet
4. Network password: wireshark123
5. Turn on Mobile hotspot
```

Open Wireshark as Administrator:

```
1. Right-click Wireshark → Run as administrator
2. Look for "Microsoft Wi-Fi Direct Virtual Adapter"
3. Select it and click Start
```

Your phone's traffic now appears in Wireshark.

## Method 2: Proxy with HTTPS Decryption

For inspecting HTTPS traffic (which is encrypted), use a proxy server with SSL interception.

### Using mitmproxy

mitmproxy is an interactive HTTPS proxy that can decrypt SSL/TLS traffic.

Install mitmproxy:

```bash
# Linux/macOS
pip install mitmproxy

# Or use package manager
sudo apt-get install mitmproxy  # Ubuntu/Debian
brew install mitmproxy          # macOS
```

Start mitmproxy:

```bash
# Start in web interface mode
mitmweb
```

This starts a proxy on port 8080 and a web interface at http://127.0.0.1:8081.

### Configure Your Phone

**On iOS:**

```
Settings → WiFi → (tap the i next to your network)
→ Configure Proxy → Manual
  Server: [your computer's IP, e.g., 192.168.1.100]
  Port: 8080
```

**On Android:**

```
Settings → Network & Internet → WiFi
→ Long-press your network → Modify network
→ Advanced options → Proxy → Manual
  Proxy hostname: [your computer's IP]
  Proxy port: 8080
```

### Install mitmproxy Certificate

To decrypt HTTPS, install mitmproxy's certificate on your phone.

On your phone's browser, visit: `http://mitm.it`

This shows platform-specific installation instructions.

**iOS:**
1. Tap the Apple icon to download the certificate
2. Go to Settings → Profile Downloaded → Install
3. Enter your passcode
4. Go to Settings → General → About → Certificate Trust Settings
5. Enable full trust for mitmproxy

**Android:**
1. Download the certificate from http://mitm.it
2. Settings → Security → Encryption & credentials → Install a certificate
3. Choose CA certificate
4. Select the downloaded certificate

Now mitmproxy can decrypt HTTPS traffic.

Visit mitmweb at `http://127.0.0.1:8081` to see captured requests:

```
Flow List:
GET https://api.example.com/users
  ← 200 application/json

POST https://api.example.com/login
  Request: {"username":"alice","password":"***"}
  ← 200 application/json
  Response: {"token":"abc123..."}
```

### Export to Wireshark

Save mitmproxy captures for Wireshark analysis:

```bash
# Start mitmproxy in dump mode, save to file
mitmdump -w capture.mitm

# Convert to pcap format
# (mitmproxy can export flows which Wireshark can read)
```

Or use tcpdump alongside mitmproxy:

```bash
# Capture packets on the proxy port
sudo tcpdump -i any port 8080 -w mobile_traffic.pcap

# Open in Wireshark
wireshark mobile_traffic.pcap
```

## Method 3: ADB Reverse Tethering (Android Only)

For Android devices with USB debugging enabled, use ADB to route traffic through your computer.

### Enable USB Debugging

On your Android phone:

```
Settings → About phone
→ Tap "Build number" 7 times
→ Go back to Settings → Developer options
→ Enable "USB debugging"
```

### Set Up Reverse Tethering

Install ADB:

```bash
# Linux
sudo apt-get install android-tools-adb

# macOS
brew install android-platform-tools

# Windows
# Download from https://developer.android.com/studio/releases/platform-tools
```

Connect phone via USB and verify:

```bash
adb devices
```

Output:

```
List of devices attached
ABC123DEF456    device
```

Enable reverse tethering:

```bash
# Route phone's traffic through USB
adb reverse tcp:8080 tcp:8080

# Or create a SOCKS proxy
adb reverse tcp:1080 tcp:1080
```

Configure a proxy on your phone to use `localhost:8080`, then traffic routes through your computer.

Start Wireshark and capture on the loopback interface:

```bash
sudo wireshark
# Select "Loopback: lo" or "lo0"
# Filter: tcp.port == 8080
```

## Filtering Mobile Traffic in Wireshark

Once you're capturing, filter to see only relevant traffic.

### Filter by IP Address

Find your phone's IP address:

**iOS:** Settings → WiFi → (tap the i) → IP Address

**Android:** Settings → About phone → Status → IP Address

Filter in Wireshark:

```
ip.addr == 192.168.100.15
```

This shows all traffic to and from your phone.

### Filter by Domain

See traffic to a specific domain:

```
http.host contains "api.example.com"
```

Or for HTTPS:

```
tls.handshake.extensions_server_name contains "api.example.com"
```

### Filter by Protocol

Show only HTTP traffic:

```
http
```

Show only HTTPS (TLS):

```
tls
```

Show DNS queries:

```
dns
```

### Useful Mobile-Specific Filters

App Store traffic (iOS):

```
http.host contains "apple.com"
```

Google Play traffic (Android):

```
http.host contains "play.google.com"
```

Social media apps:

```
http.host contains "facebook" or http.host contains "instagram"
```

## Analyzing Captured Traffic

### Following TCP Streams

Right-click a packet → Follow → TCP Stream

This shows the entire conversation between your phone and a server:

```
GET /api/users HTTP/1.1
Host: api.example.com
User-Agent: MyApp/1.0 (iPhone; iOS 15.0)

HTTP/1.1 200 OK
Content-Type: application/json

{"users":[{"id":1,"name":"Alice"}]}
```

### Viewing HTTP Requests

Filter for HTTP:

```
http.request
```

See all outgoing HTTP requests from your phone, including:
- URLs accessed
- Headers sent
- POST data
- User-Agent strings
- Cookies

### Extracting Files

Wireshark can extract files from HTTP traffic:

```
File → Export Objects → HTTP
```

This lists all files transferred over HTTP (images, JSON responses, HTML, etc.). Select files and save them.

### Statistics

See a summary of your phone's traffic:

```
Statistics → Protocol Hierarchy
```

Shows traffic breakdown by protocol:

```
Frame (100%)
  Ethernet (100%)
    IPv4 (98%)
      TCP (80%)
        TLS (50%)
        HTTP (30%)
      UDP (18%)
        DNS (15%)
    IPv6 (2%)
```

## Debugging Mobile Apps

### Identifying API Endpoints

Filter for your app's traffic and look for API calls:

```
http.request.method == "POST"
```

See all POST requests, often used for API interactions.

### Checking Request Headers

Look for authentication tokens, API keys, or custom headers:

```
http.authorization
```

Shows Authorization headers with bearer tokens or API keys.

### Analyzing Response Times

Use Wireshark's time features:

```
Right-click a request → Follow → TCP Stream
```

Look at the timestamps to see how long the server took to respond.

Or use:

```
Statistics → Service Response Time → HTTP
```

This shows average response times for different URLs.

## Security and Privacy Considerations

**Only analyze your own device and traffic.** Capturing someone else's network traffic without permission is illegal in most jurisdictions.

**Be careful with credentials:** Captured traffic may contain passwords, API keys, and personal data. Handle capture files securely and delete them when done.

**Remove certificates after testing:** After finishing with mitmproxy or similar tools, remove the installed certificate from your phone:

**iOS:** Settings → General → VPN & Device Management → Remove certificate

**Android:** Settings → Security → Trusted credentials → User → Remove

**Don't use untrusted proxies:** Only route your traffic through computers you control. Public proxies can intercept your data.

**HTTPS limitations:** Modern apps use certificate pinning, which prevents proxy interception even with a trusted certificate installed. You may not be able to decrypt all HTTPS traffic from all apps.

## Troubleshooting

### No traffic appears in Wireshark

- Verify your phone is connected to the hotspot/proxy
- Check you're capturing on the correct interface
- Make sure your phone isn't using cellular data instead of WiFi

### HTTPS traffic shows as encrypted

- Install and trust the mitmproxy certificate on your phone
- Some apps use certificate pinning and can't be intercepted
- Try using the app's developer or debug version if available

### Proxy connection fails

- Verify the IP address and port are correct on your phone
- Make sure your computer's firewall allows incoming connections on port 8080
- Check that the proxy server is actually running

Capturing mobile traffic with Wireshark requires routing your phone's data through a computer, either via a WiFi hotspot or proxy server. For basic HTTP traffic, a simple hotspot works. For HTTPS inspection, use a proxy like mitmproxy with a trusted certificate. This technique is invaluable for mobile app development, debugging network issues, and understanding what your apps are really doing behind the scenes.
