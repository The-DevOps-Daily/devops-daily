# DevOps Daily

> A modern, open-source content platform for DevOps professionals, featuring articles, guides, exercises, news and resources to help you level up your DevOps skills.

![DevOps Daily](https://devops-daily.com/og-image.png)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-contributor%20covenant-purple.svg)](CODE_OF_CONDUCT.md)
[![GitHub issues](https://img.shields.io/github/issues/The-DevOps-Daily/devops-daily)](https://github.com/The-DevOps-Daily/devops-daily/issues)

Visit the live site at **[devops-daily.com](https://devops-daily.com)**

## 🌟 About

DevOps Daily is a community-driven platform dedicated to providing high-quality DevOps content. We believe in learning by doing and sharing knowledge with the community. This project powers the devops-daily.com website and is built with modern web technologies, deployed on [Cloudflare Pages](https://pages.cloudflare.com/) for optimal performance and reliability.

## ✨ Features

- 🚀 **Modern Tech Stack**: Built with Next.js 15, React 19, and TypeScript
- � **Rich Content**: Articles, multi-part guides, exercises, quizzes, and interactive games
- �📱 **Fully Responsive**: Optimized experience across all devices
- 🌓 **Dark Mode**: Beautiful light and dark theme support
- 🔍 **SEO Optimized**: Comprehensive meta tags, structured data, and sitemap
- 🖥️ **Syntax Highlighting**: Beautiful code blocks with highlight.js
- 🗂️ **Smart Organization**: Content categorized by tags, categories, and authors
- 🎮 **Interactive Learning**: Quizzes and exercises for hands-on learning
- 📊 **RSS Feed**: Stay updated with the latest content
- 🎨 **Beautiful UI**: Built with Tailwind CSS and shadcn/ui components
- 🔧 **PWA Support**: Install as a Progressive Web App for offline access

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide Icons](https://lucide.dev/)
- **Content**: Markdown with [gray-matter](https://github.com/jonschlinkert/gray-matter)
- **Markdown Rendering**: [marked](https://marked.js.org/)
- **Syntax Highlighting**: [highlight.js](https://highlightjs.org/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm and pnpm 9.0.0 or later

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/The-DevOps-Daily/devops-daily.git
cd devops-daily
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Start the development server:**

```bash
npm run dev
```

4. **Open your browser:**

Visit [http://localhost:3000](http://localhost:3000) to see the site running locally.

That's it! You're ready to start contributing. 🎉

## Project Structure

```
devopsdaily/
├─ app/              # Next.js app directory (routes)
├─ components/       # React components
├─ content/          # Markdown content files
│  ├─ posts/         # Blog posts
│  ├─ guides/        # Multi-part guides
│  ├─ authors/       # Author information
│  └─ categories/    # Category information
│  └─ quizzes/       # Quiz content
│  └─ exercises/     # Exercise content
│  └─ news/          # News content
├─ lib/              # Utility functions and data fetching
├─ public/           # Static assets
│  ├─ images/        # Image files
│  └─ fonts/         # Font files
└─ scripts/          # Build and generation scripts
```

## Content Management

### Adding a New Post

1. Create a new Markdown file in `content/posts/`, e.g., `my-post.md`
2. Add frontmatter and content:

```markdown
---
title: 'My Post Title'
slug: 'my-post'
excerpt: 'A short description of the post'
date: '2025-05-15'
publishedAt: '2025-05-15T12:00:00Z'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
author:
  name: 'John Doe'
  slug: 'john-doe'
tags: ['kubernetes', 'devops', 'containers']
---

# My Post Title

Content goes here in Markdown format.
```

### Adding a Guide

1. Create a directory in `content/guides/`, e.g., `content/guides/kubernetes-guide/`
2. Add an `index.md` file for the guide overview:

```markdown
---
title: 'Kubernetes Guide'
slug: 'kubernetes-guide'
description: 'A guide to Kubernetes'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
publishedAt: '2025-05-15T12:00:00Z'
author:
  name: 'John Doe'
  slug: 'john-doe'
tags: ['kubernetes', 'containers', 'orchestration']
---

# Kubernetes Guide

This guide will help you learn Kubernetes from basics to advanced topics.
```

3. Add part files (e.g., `part-1.md`, `part-2.md`) in the same directory:

```markdown
---
title: 'Kubernetes Basics'
slug: 'part-1'
order: 1
description: 'Introduction to Kubernetes concepts'
---

# Kubernetes Basics

Content for part 1 goes here.
```

## Scripts

The project includes several utility scripts:

- `pnpm run dev`: Start development server
- `pnpm run build`: Build the production-ready site
- `pnpm run generate-feed`: Generate RSS feed
- `pnpm run generate-images`: Generate placeholder images for content

## Customization

### Site Information

Update the site information in `app/layout.tsx` to customize metadata.

### Styling

The project uses Tailwind CSS for styling. Update the design tokens in:

- `tailwind.config.js`: Configure theme colors and extensions
- `app/globals.css`: Global styles and custom CSS

### Components

UI components are built with shadcn/ui and can be customized in the `components/ui` directory.

## Linting Workflow

The project uses ESLint and Prettier for code quality and formatting. Here are the key commands for your development workflow:

```bash
# Run ESLint to check for issues
npm run lint

# Format code with Prettier
npm run format

# Verify code is properly formatted
npm run check-format
```

All linting checks run automatically during the pre-commit hook via Husky and lint-staged to ensure code quality standards are maintained.

Install the ESLint and Prettier extensions in your IDE for real-time feedback while coding.

## 🤝 Contributing

We welcome contributions from the community! Whether you want to:

- 📝 Write a new article or guide
- 🐛 Fix a bug or typo
- ✨ Add a new feature
- 📚 Improve documentation
- 🎨 Enhance the design

Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and formatting (`pnpm run lint && pnpm run format`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 Content Types

DevOps Daily supports multiple content types:

- **Posts**: Standard blog articles covering DevOps topics
- **Guides**: Multi-part comprehensive guides for in-depth learning
- **Exercises**: Hands-on practical exercises to reinforce learning
- **Quizzes**: Interactive quizzes to test your knowledge
- **News**: Curated DevOps news and updates
- **Games**: Fun interactive games for learning DevOps concepts

## 🚀 Deployment

This project is deployed on [Cloudflare Pages](https://pages.cloudflare.com/) but can be deployed on any platform that supports Next.js static exports:

- [Cloudflare Pages](https://pages.cloudflare.com/) (current)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [AWS Amplify](https://aws.amazon.com/amplify/)
- [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform/)

## 🐳 Docker

You can run DevOps Daily in a Docker container for consistent development and deployment environments.

### Building the Docker Image

```bash
# Build the Docker image
docker build -t devops-daily .

# Build with a specific tag
docker build -t devops-daily:v1.0.0 .
```

### Running the Container

```bash
# Run the container
docker run -p 3000:80 devops-daily

# Run in detached mode (background)
docker run -d -p 3000:80 --name devops-daily-app devops-daily

# Run with custom port mapping
docker run -p 8080:80 devops-daily
```

After starting the container, visit [http://localhost:3000](http://localhost:3000) (or your custom port) to see the site.

### Container Management

```bash
# Stop the container
docker stop devops-daily-app

# Start the container
docker start devops-daily-app

# Remove the container
docker rm devops-daily-app

# View logs
docker logs devops-daily-app

# View logs in real-time
docker logs -f devops-daily-app
```

### Docker Image Details

- **Base Image**: Node.js 20.18.1 (Bullseye Slim) for building, Nginx 1.27 (Alpine) for serving
- **Multi-stage Build**: Optimized for minimal image size
- **Security**: Runs as non-root user, includes OS security updates
- **Health Check**: Built-in health check endpoint
- **Port**: Exposes port 80 (production) or 3000 (development)
- **Version Pinning**: Node.js, pnpm, and nginx versions are pinned via build args for reproducible builds

#### Build Arguments

You can customize the versions used in the Docker build:

```bash
# Build with custom versions
docker build \
  --build-arg NODE_VERSION=20.18.1 \
  --build-arg PNPM_VERSION=10.11.1 \
  --build-arg NGINX_VERSION=1.27-alpine \
  -t devops-daily:custom .
```

### Docker Compose (Recommended for Local Development)

Docker Compose provides an easier way to manage the development environment with hot-reload support.

#### Quick Start

```bash
# Start development server with hot-reload
docker compose up dev

# Start in background
docker compose up -d dev

# View logs
docker compose logs -f dev

# Stop all services
docker compose down
```

#### Available Services

| Service | Port | Description                        |
| ------- | ---- | ---------------------------------- |
| `dev`   | 3000 | Development server with hot-reload |
| `prod`  | 8080 | Production build served via nginx  |

#### Development Mode

```bash
# Start development server (with hot-reload)
docker compose up dev

# Rebuild after dependency changes
docker compose up dev --build

# Run in background
docker compose up -d dev
```

The development server mounts your local files, so any changes you make will automatically trigger a reload.

#### Production Mode

```bash
# Build and run production version
docker compose up prod --build

# Run in background
docker compose up -d prod
```

#### Useful Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# View logs for a specific service
docker compose logs -f dev

# Rebuild a specific service
docker compose build dev

# Run a one-off command in the dev container
docker compose run --rm dev pnpm lint
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgements

- [shadcn/ui](https://ui.shadcn.com/) - Beautiful and accessible UI components
- [Lucide Icons](https://lucide.dev/) - Icon set
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Next.js](https://nextjs.org/) - React framework
- All our amazing [contributors](https://github.com/The-DevOps-Daily/devops-daily/graphs/contributors)

## 💬 Community

- **Website**: [devops-daily.com](https://devops-daily.com)
- **GitHub Issues**: [Report bugs or request features](https://github.com/The-DevOps-Daily/devops-daily/issues)
- **Pull Requests**: [Contribute to the project](https://github.com/The-DevOps-Daily/devops-daily/pulls)

---

<div align="center">
  <strong>Built with ❤️ for the DevOps community</strong>
  <br>
  <sub>Help us make DevOps Daily better by contributing!</sub>
</div>
