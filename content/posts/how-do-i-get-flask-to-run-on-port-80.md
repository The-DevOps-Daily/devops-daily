---
title: 'How do I Get Flask to Run on Port 80?'
excerpt: 'Running Flask on port 80 requires special permissions since port 80 is a privileged port. Learn the different approaches to running Flask on port 80, from using sudo to setting up reverse proxies with Nginx.'
category:
  name: 'Python'
  slug: 'python'
date: '2025-06-18'
publishedAt: '2025-06-18T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Python
  - Flask
  - Web Development
  - Networking
  - Linux
---

By default, Flask's development server runs on port 5000, but you might want to run your application on port 80 so users can access it without specifying a port number in the URL. Port 80 is the standard HTTP port, but it's also a privileged port on Unix-like systems, which means you need special permissions to bind to it.

This guide covers several approaches to running Flask on port 80, from quick development solutions to production-ready setups.

## TLDR

For development, run Flask with sudo: `sudo python app.py` and set `app.run(host='0.0.0.0', port=80)`. For production, use a reverse proxy like Nginx or Apache to forward requests from port 80 to your Flask app running on a higher port like 5000 or 8000. Never run Flask's development server in production.

## Prerequisites

You need Python and Flask installed on your system. Basic familiarity with Flask applications and command-line operations will help. If you're deploying to production, you should understand web servers and reverse proxies.

## Understanding Privileged Ports

Ports numbered 1-1023 are considered privileged ports on Unix-like systems (Linux, macOS). Only processes running as root can bind to these ports. This security measure prevents regular users from running services that could impersonate system services.

Port 80 is the standard HTTP port, which means:
- Users can access your site at `http://example.com` instead of `http://example.com:5000`
- Browsers connect to port 80 by default when you don't specify a port
- You need elevated privileges to use it

## Quick Solution: Running Flask with Sudo

The simplest way to run Flask on port 80 during development is using sudo:

```python
# app.py
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello from port 80!'

if __name__ == '__main__':
    # Bind to all interfaces on port 80
    app.run(host='0.0.0.0', port=80)
```

Run it with elevated privileges:

```bash
sudo python app.py
```

Or if using Python 3 explicitly:

```bash
sudo python3 app.py
```

You'll see output like:

```
 * Running on http://0.0.0.0:80
 * Running on http://127.0.0.1:80
 * Running on http://192.168.1.100:80
```

Now you can access your app at `http://localhost` without specifying a port.

**Important**: This approach works for development and testing, but you should never run Flask's built-in development server in production. It's not designed for security, performance, or stability under real-world load.

## Using setcap to Grant Port Binding Permissions

Instead of running your entire Python process as root, you can grant the Python interpreter permission to bind to privileged ports:

```bash
# Give Python the capability to bind to privileged ports
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/python3.10
```

Replace `python3.10` with your actual Python version:

```bash
# Find your Python path
which python3

# Example output: /usr/bin/python3.10
# Then use that path with setcap
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/python3.10
```

After setting this capability, you can run your Flask app on port 80 without sudo:

```bash
python3 app.py
```

This approach is more secure than using sudo because only the port binding operation has elevated privileges, not your entire application.

**Note**: This affects all Python scripts using that interpreter. If you're using virtual environments, you need to set the capability on the Python binary inside the virtual environment.

## Production Solution: Using a Reverse Proxy

The recommended way to run Flask in production is behind a reverse proxy like Nginx or Apache. The reverse proxy runs on port 80 and forwards requests to your Flask application running on a higher, unprivileged port.

### Setting Up with Nginx

First, run your Flask app on an unprivileged port using a production WSGI server:

```python
# app.py
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello from Flask behind Nginx!'

if __name__ == '__main__':
    # Run on port 8000 for production
    app.run(host='127.0.0.1', port=8000)
```

In production, use Gunicorn instead of Flask's development server:

```bash
# Install Gunicorn
pip install gunicorn

# Run your Flask app with Gunicorn on port 8000
gunicorn -w 4 -b 127.0.0.1:8000 app:app
```

The `-w 4` flag runs 4 worker processes for handling concurrent requests. The `-b 127.0.0.1:8000` binds to localhost on port 8000.

Configure Nginx to proxy requests from port 80 to your Flask app:

```nginx
# /etc/nginx/sites-available/flask-app
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and restart Nginx:

```bash
# Create a symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/flask-app /etc/nginx/sites-enabled/

# Test the configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

Now requests to `http://example.com` on port 80 are forwarded to your Flask app running on port 8000.

## Using systemd to Manage Your Flask Service

Create a systemd service file to automatically start your Flask app:

```ini
# /etc/systemd/system/flask-app.service
[Unit]
Description=Flask Application
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/flask-app
Environment="PATH=/var/www/flask-app/venv/bin"
ExecStart=/var/www/flask-app/venv/bin/gunicorn -w 4 -b 127.0.0.1:8000 app:app

[Install]
WantedBy=multi-user.target
```

Start and enable the service:

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Start the service
sudo systemctl start flask-app

# Enable it to start on boot
sudo systemctl enable flask-app

# Check status
sudo systemctl status flask-app
```

## Using iptables for Port Forwarding

Another approach is using iptables to forward traffic from port 80 to a higher port:

```bash
# Forward traffic from port 80 to port 5000
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 5000
```

Your Flask app runs on port 5000 without elevated privileges, but users access it on port 80:

```python
# app.py
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello via iptables forwarding!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

Run normally:

```bash
python app.py
```

Access at `http://localhost` (port 80), which forwards to port 5000.

To make iptables rules persistent across reboots:

```bash
# Install iptables-persistent
sudo apt-get install iptables-persistent

# Save current rules
sudo netfilter-persistent save
```

## Docker Approach

If you're running Flask in Docker, you can map port 80 on the host to your container's port without elevated privileges for the Flask app:

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# App runs on port 5000 inside container
EXPOSE 5000

CMD ["python", "app.py"]
```

Run the container with port mapping:

```bash
# Map host port 80 to container port 5000
sudo docker run -p 80:5000 flask-app
```

The Flask app inside the container runs on port 5000 (unprivileged), but Docker maps it to port 80 on the host.

## Security Considerations

When running Flask on port 80, keep these security practices in mind:

**Never use Flask's development server in production**: It's single-threaded, doesn't handle concurrent requests well, and has known security vulnerabilities. Always use a production WSGI server like Gunicorn, uWSGI, or Waitress.

**Run Flask as a non-privileged user**: If using a reverse proxy or systemd, configure the service to run as a dedicated user like `www-data`, not as root.

**Use HTTPS in production**: Port 80 serves unencrypted HTTP traffic. For production sites, use port 443 with SSL/TLS certificates (Let's Encrypt is free). Your reverse proxy can handle SSL termination.

**Keep Flask behind a firewall**: If your Flask app binds to `0.0.0.0:8000`, it's accessible from any network interface. Use `127.0.0.1:8000` to ensure it only accepts connections from localhost (via the reverse proxy).

## Choosing the Right Approach

Here's when to use each method:

**Development and testing**: Use `sudo python app.py` for quick local testing. It's simple and gets you running fast.

**Production deployment**: Always use a reverse proxy (Nginx or Apache) with a production WSGI server (Gunicorn). This is the industry standard for good reason - it's secure, performant, and maintainable.

**Containerized deployments**: Use Docker's port mapping to handle the privileged port binding at the container runtime level.

**Shared hosting or restricted environments**: If you can't install a reverse proxy, use iptables port forwarding or setcap.

## Common Issues and Solutions

### Permission denied when binding to port 80

Error:

```
PermissionError: [Errno 13] Permission denied
```

Solution: Either use sudo, setcap, or run your app on a higher port with a reverse proxy.

### Port 80 already in use

Error:

```
OSError: [Errno 98] Address already in use
```

Solution: Another service (likely Apache or Nginx) is already using port 80. Check what's running:

```bash
sudo lsof -i :80
# or
sudo netstat -tlnp | grep :80
```

Stop the conflicting service or configure it to proxy to your Flask app instead.

### App works locally but not externally

If you can access your app at `http://localhost` but not from other machines, check:

1. Flask is bound to `0.0.0.0`, not `127.0.0.1`
2. Your firewall allows incoming connections on port 80
3. Your cloud provider's security group permits port 80 traffic

Running Flask on port 80 is straightforward once you understand the privilege requirements. For development, sudo or setcap works fine. For production, always use a reverse proxy with a production-grade WSGI server. This combination gives you security, performance, and the ability to serve your Flask app on the standard HTTP port that users expect.

