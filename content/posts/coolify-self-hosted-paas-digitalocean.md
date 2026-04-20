---
title: 'Coolify: Self-Hosted PaaS on DigitalOcean - Deploy Apps Without Vendor Lock-In'
excerpt: 'Set up Coolify on a DigitalOcean droplet and get your own Vercel-like platform for deploying Next.js apps, databases, and more - with auto SSL, GitHub auto-deploy, and no per-seat pricing.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-04-04'
publishedAt: '2026-04-04T09:00:00Z'
updatedAt: '2026-04-04T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - DevOps
  - Cloud
  - Docker
  - Self-Hosted
  - Deployment
  - DigitalOcean
---

Managed platforms like Vercel, Heroku, and Netlify make deployment easy. But once your project grows, the bills grow faster. A Next.js app that costs $0 on the hobby tier suddenly costs $20/seat/month when you add a teammate. A database that was free at 500MB now costs $25/month. You end up paying $100-300/month for infrastructure you could run on a $24 VPS.

Coolify is an open-source, self-hosted platform-as-a-service that gives you the same deploy-on-push experience, but on your own server. You get automatic SSL, GitHub integration, one-click databases, a web dashboard, and zero vendor lock-in. This guide walks you through setting it up on DigitalOcean and deploying your first app.

## TLDR

- Coolify is a self-hosted alternative to Vercel/Heroku/Netlify
- Install it on a VPS with a single command
- Get auto SSL, GitHub auto-deploy, built-in databases, reverse proxy
- Manage multiple apps from one dashboard
- Cost: just the VPS ($24-48/month for a capable server vs $100-300+ on managed platforms)

## Prerequisites

- A [DigitalOcean account](https://m.do.co/c/2a9bba940f39) (use this link for $200 free credit)
- A domain name pointed to your server
- Basic familiarity with SSH and the command line
- A GitHub account with repositories you want to deploy

## What is Coolify?

**Coolify** is an open-source PaaS built on Docker. Think of it as a self-hosted Vercel that runs on any VPS. It handles:

- **Deployments** - Push to GitHub, your app deploys automatically
- **SSL certificates** - Let's Encrypt certificates provisioned and renewed automatically via Traefik
- **Reverse proxy** - Traefik routes traffic to the right container based on domain
- **Databases** - One-click PostgreSQL, MySQL, MariaDB, MongoDB, Redis
- **Monitoring** - Basic health checks, logs, and resource usage
- **Backups** - Scheduled database backups to S3-compatible storage

You get a web dashboard that looks and works like a managed platform, but everything runs on hardware you control.

## Coolify vs Managed Platforms

Here is a realistic cost comparison for a team running 3 apps with a database:

| | Vercel | Heroku | Railway | Coolify on DO |
|---|---|---|---|---|
| 3 apps | $60/mo (Pro) | $75/mo (3 dynos) | ~$15-45/mo | $0 (included) |
| PostgreSQL | $25/mo (Neon) | $25/mo (Mini) | ~$10/mo | $0 (self-hosted) |
| Redis | $10/mo | $15/mo | ~$5/mo | $0 (self-hosted) |
| SSL | Included | Included | Included | Included (Traefik) |
| Team seats | $20/seat | $0 | $0 | $0 |
| **Total (2 devs)** | **$135/mo** | **$115/mo** | **$30-60/mo** | **$24-48/mo** |

The tradeoff is clear: managed platforms save you ops time, Coolify saves you money and gives you full control. If you are comfortable with basic server administration, the savings add up fast.

Where managed platforms still win:

- **Edge functions and CDN** - Vercel's edge network is hard to beat for global latency
- **Zero ops** - You never SSH into anything
- **Scale to zero** - Serverless functions cost nothing when idle

Where Coolify wins:

- **Predictable pricing** - A $24 droplet is $24 whether you have 1 or 10 apps
- **No vendor lock-in** - Standard Docker containers, move anywhere
- **Full control** - Custom Nginx configs, cron jobs, background workers, anything
- **Data sovereignty** - Your database runs on your server, not someone else's

## Setting Up a DigitalOcean Droplet

Start by creating a droplet. You need at least 2 vCPUs and 4GB RAM for Coolify plus a couple of apps.

1. Log into [DigitalOcean](https://m.do.co/c/2a9bba940f39)
2. Create a new Droplet:
   - **Image:** Ubuntu 24.04 LTS
   - **Size:** Regular, 4GB / 2 vCPU ($24/month) - or 8GB / 4 vCPU ($48/month) if you plan to run databases
   - **Region:** Closest to your users
   - **Authentication:** SSH key (do not use password auth)
3. Note the droplet's IP address

### Point Your Domain

Before installing Coolify, point your domain to the droplet. You need two DNS records:

```text
A    @           → your-droplet-ip
A    *.coolify   → your-droplet-ip
```

The wildcard record lets Coolify automatically assign subdomains to your apps (e.g., `app1.coolify.yourdomain.com`). You can also use custom domains for each app later.

## Installing Coolify

SSH into your droplet and run the Coolify installer:

```bash
ssh root@your-droplet-ip
```

Then run the one-line installer:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This installs Docker, Docker Compose, and Coolify. The process takes 2-3 minutes.

When it finishes, you will see output like this:

```text
Congratulations! Coolify has been installed successfully! 🎉
Please visit http://your-droplet-ip:8000 to get started.
```

Open `http://your-droplet-ip:8000` in your browser and create your admin account. This is a one-time setup - the first user to register becomes the admin.

### Initial Configuration

After logging in:

1. Go to **Settings** and set your instance's domain (e.g., `coolify.yourdomain.com`)
2. Enable HTTPS - Coolify will provision an SSL certificate for its own dashboard
3. Under **Servers**, verify your localhost server shows as connected

From this point, the dashboard is accessible at `https://coolify.yourdomain.com`.

## Deploying a Next.js App

Let's deploy a Next.js application from GitHub.

### 1. Connect GitHub

Go to **Sources** > **Add Source** > **GitHub**. You can either:

- **GitHub App** (recommended) - Create a GitHub App for fine-grained permissions
- **Deploy Key** - Add a read-only SSH key to your repository

The GitHub App method is better because it enables webhook-based auto-deploy.

### 2. Create the App

Go to **Projects** > **Add New Resource** > **Public Repository** (or Private if you connected GitHub).

Configure:

- **Repository:** `https://github.com/your-username/your-nextjs-app`
- **Branch:** `main`
- **Build Pack:** Nixpacks (auto-detects Next.js)
- **Port:** `3000`

Coolify uses **Nixpacks** by default, which auto-detects your framework and generates a Docker image. For Next.js, it handles `npm install`, `npm run build`, and `npm start` automatically. No Dockerfile needed.

### 3. Set Environment Variables

Under your app's settings, add your environment variables:

```text
DATABASE_URL=postgresql://user:pass@your-db:5432/myapp
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=https://myapp.yourdomain.com
```

### 4. Configure the Domain

Under **Settings** > **Domains**, add your custom domain:

```text
myapp.yourdomain.com
```

Coolify automatically provisions an SSL certificate via Let's Encrypt and configures the Traefik reverse proxy.

### 5. Deploy

Click **Deploy** or push to your `main` branch. Coolify builds the Docker image, runs your app, and routes traffic to it. First deploy takes a few minutes. Subsequent deploys are faster thanks to Docker layer caching.

## Adding a Database

One of Coolify's strengths is one-click database provisioning.

Go to **Projects** > **Add New Resource** > **Database**. Pick your engine:

- PostgreSQL
- MySQL / MariaDB
- MongoDB
- Redis
- And more

For PostgreSQL:

1. Select **PostgreSQL**
2. Set a database name, user, and password
3. Click **Start**

Coolify creates a Docker container running PostgreSQL and gives you the connection string. Use it in your app's `DATABASE_URL`:

```text
postgresql://user:password@your-server-ip:5432/dbname
```

Since both your app and database run on the same server, there is zero network latency between them. For internal connections, use the Docker network hostname instead of the IP:

```text
postgresql://user:password@postgres-container:5432/dbname
```

### Backups

Go to your database's **Backups** tab. Configure:

- **Schedule:** Daily at 3 AM (cron: `0 3 * * *`)
- **Storage:** Local or S3-compatible (DigitalOcean Spaces, AWS S3, MinIO)
- **Retention:** Keep last 7 backups

This runs `pg_dump` on schedule and stores the output. You get automated database backups without any extra tooling.

## Managing Multiple Apps

The real power of Coolify shows when you run multiple applications. Each app gets:

- Its own Docker container
- Its own domain and SSL certificate
- Independent environment variables
- Separate deployment history and logs

A typical setup might look like this:

```text
┌─────────────────────────────────────────────┐
│              DigitalOcean Droplet            │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ Next.js │  │  API    │  │  Blog   │     │
│  │  App    │  │ Server  │  │  (Hugo) │     │
│  │ :3000   │  │ :8080   │  │ :1313   │     │
│  └────┬────┘  └────┬────┘  └────┬────┘     │
│       │            │            │           │
│  ┌────┴────────────┴────────────┴────┐      │
│  │         Traefik (Reverse Proxy)    │      │
│  │    SSL termination + routing       │      │
│  └────────────────┬──────────────────┘      │
│                   │                         │
│  ┌────────────────┴──────────────────┐      │
│  │          PostgreSQL + Redis        │      │
│  └───────────────────────────────────┘      │
└─────────────────────────────────────────────┘
```

Traefik handles all routing based on domain names. Each request hits port 443, Traefik checks the `Host` header, and forwards it to the right container. You configure this through Coolify's dashboard - no Nginx configs to edit.

## Auto-Deploy on Push

If you connected GitHub via the GitHub App method, Coolify sets up webhooks automatically. Every push to your configured branch triggers a new deployment.

The deploy flow:

1. You push to `main`
2. GitHub sends a webhook to Coolify
3. Coolify pulls the latest code
4. Nixpacks builds a new Docker image
5. Coolify performs a rolling update (zero downtime)
6. Old container is removed after the new one is healthy

You can also configure:

- **Preview deployments** for pull requests
- **Manual deploy only** for production branches
- **Deploy from specific branches** per environment

## Resource Requirements

Here is what different setups need:

| Setup | RAM | CPU | Monthly Cost |
|---|---|---|---|
| Coolify + 1 small app | 2GB | 1 vCPU | $12 |
| Coolify + 2-3 apps + PostgreSQL | 4GB | 2 vCPU | $24 |
| Coolify + 5+ apps + databases + Redis | 8GB | 4 vCPU | $48 |
| Heavy workloads (10+ apps) | 16GB | 8 vCPU | $96 |

Coolify itself uses about 500MB-1GB of RAM. Each Next.js app uses 100-300MB depending on traffic. PostgreSQL adds another 200-500MB.

For most indie developers and small teams, the **4GB droplet at $24/month** handles everything comfortably.

## When to Use Coolify vs Managed Platforms

**Use Coolify when:**

- You run multiple apps and the per-app pricing of managed platforms adds up
- You need databases without paying for managed database services
- You want full control over your infrastructure
- Data sovereignty matters (GDPR, regulatory requirements)
- You are comfortable with basic Linux administration
- Your apps do not need edge/CDN capabilities

**Use Vercel/Netlify when:**

- You need global edge functions and CDN
- You want absolute zero ops overhead
- Your team does not have anyone comfortable with server management
- You are on a free/hobby tier and do not need to scale yet

**Use Railway when:**

- You want something between fully managed and self-hosted
- You need the simplicity of managed platforms but with better pricing

## Useful Coolify Features

A few features worth knowing about:

- **Docker Compose support** - Deploy multi-container apps using your existing `docker-compose.yml`
- **Dockerfile support** - Bring your own Dockerfile if Nixpacks does not cover your use case
- **Cron jobs** - Schedule tasks directly from the dashboard
- **Persistent storage** - Mount volumes for file uploads, SQLite databases, etc.
- **Monitoring** - Basic CPU, memory, and disk usage per container
- **Notifications** - Get deploy notifications via Discord, Slack, email, or Telegram
- **Teams** - Add team members with different permission levels (no per-seat cost)
- **S3 backups** - Automated backups to DigitalOcean Spaces or any S3-compatible storage

## Key Takeaways

1. **Coolify gives you the Vercel experience on your own server** - auto-deploy, SSL, domains, databases, all from a web dashboard.
2. **The cost savings are significant** - $24/month for a droplet that can run everything vs $100+ across multiple managed services.
3. **Setup takes 10 minutes** - one command to install, then configure through the browser.
4. **No vendor lock-in** - your apps run as standard Docker containers that work anywhere.
5. **The tradeoff is real** - you are responsible for server updates, security patches, and monitoring. If you are not comfortable with that, managed platforms are worth the premium.
6. **Start with a [4GB DigitalOcean droplet](https://m.do.co/c/2a9bba940f39)** - it handles Coolify plus several apps and databases comfortably.

Coolify is not a replacement for every use case, but for indie developers and small teams running multiple projects, it cuts your infrastructure bill while keeping the deployment experience you are used to.
