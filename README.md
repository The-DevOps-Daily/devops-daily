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

- 🚀 **Modern Tech Stack**: Built with Next.js, React and TypeScript
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

## 💛 Sponsors

<!-- sponsors:start -->

DevOps Daily is kept free by its sponsors. If your company wants to reach
engineers who choose tools, [see the sponsorship page](https://devops-daily.com/sponsorship).

### [Svix](https://link.svix.com/devopsdaily)

<a href="https://link.svix.com/devopsdaily"><picture><source media="(prefers-color-scheme: dark)" srcset="https://devops-daily.com/svix-brand-light.svg"><img src="https://devops-daily.com/svix-brand.svg" alt="Svix" height="44"></picture></a>

Svix Dispatch sends your webhooks for you: retries with exponential backoff, signed payloads, idempotency keys, and a delivery log your customers can see.

### Also sponsored by

| [Atomsized](https://atomsized.com/) | [DigitalOcean](https://m.do.co/c/2a9bba940f39) | [DevDojo](https://devdojo.com) | [SMTPfast](https://smtpfa.st) | [QuizAPI](https://quizapi.io?ref=devops-daily) |
|:--:|:--:|:--:|:--:|:--:|
| <a href="https://atomsized.com/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://devops-daily.com/atomsized-light.svg"><img src="https://devops-daily.com/atomsized.svg" alt="Atomsized" height="28"></picture></a> | <a href="https://m.do.co/c/2a9bba940f39"><img src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%202.svg" alt="DigitalOcean" height="28"></a> | <a href="https://devdojo.com"><img src="https://devops-daily.com/devdojo.svg" alt="DevDojo" height="28"></a> | <a href="https://smtpfa.st"><img src="https://devops-daily.com/smtpfast.svg" alt="SMTPfast" height="28"></a> | <a href="https://quizapi.io?ref=devops-daily"><img src="https://devops-daily.com/quizapi.svg" alt="QuizAPI" height="28"></a> |

- **[Atomsized](https://atomsized.com/)**: AWS platform engineering and GitOps
- **[DigitalOcean](https://m.do.co/c/2a9bba940f39)**: Cloud infrastructure for developers
- **[DevDojo](https://devdojo.com)**: Developer community & tools
- **[SMTPfast](https://smtpfa.st)**: Developer-first email API
- **[QuizAPI](https://quizapi.io?ref=devops-daily)**: Developer-first quiz platform

<!-- sponsors:end -->

## Tech Stack

Versions live in `package.json`; this is the shape of the thing.

- **Framework**: [Next.js](https://nextjs.org/) (App Router, static export)
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

- Node.js 22.13.1 or later (below 25)
- pnpm 10 or later (below 11)

Both are enforced by the `engines` field in `package.json`.

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
pnpm dev
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
│  ├─ categories/    # Category information
│  ├─ quizzes/       # Quiz content
│  ├─ exercises/     # Exercise content
│  ├─ news/          # News content
│  ├─ checklists/    # Checklists
│  ├─ comparisons/   # Side-by-side tool comparisons
│  ├─ flashcards/    # Flashcard decks
│  ├─ interview-questions/  # Interview question sets
│  ├─ experts/       # Expert directory entries
│  ├─ newsletters/   # Newsletter issues
│  ├─ advent-of-devops/     # Advent calendar content
│  └─ hacktoberfest/ # Hacktoberfest content
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

- `pnpm dev`: Start development server
- `pnpm build`: Build the production-ready site
- `pnpm generate-feed`: Generate the RSS feed
- `pnpm generate:images`: Generate the OG cover image for new content
- `pnpm images:all`: Generate covers, convert them to PNG and prune the SVGs
- `pnpm generate-search-index`: Rebuild the client-side search index

`pnpm build` runs the image, markdown, search and feed steps for you, so you
only need these individually when working on content locally.

## Customization

### Site Information

Update the site information in `app/layout.tsx` to customize metadata.

### Styling

The project uses Tailwind CSS for styling. Update the design tokens in:

- `tailwind.config.ts`: Configure theme colors and extensions
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

There is no pre-commit hook, so run these yourself before opening a pull
request. Installing the ESLint and Prettier extensions in your IDE gives you
the same feedback as you type.
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
- **Games**: Interactive simulators and games, built as React components rather than markdown
- **Checklists**: Step-by-step operational checklists
- **Comparisons**: Side-by-side tool comparisons
- **Flashcards**: Spaced-repetition decks
- **Interview Questions**: Practice questions by topic
- **Experts**: Directory of engineers and the stacks they work with

## 🚀 Deployment

This project is deployed on [Cloudflare Pages](https://pages.cloudflare.com/) but can be deployed on any platform that supports Next.js static exports:

- [Cloudflare Pages](https://pages.cloudflare.com/) (current)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [AWS Amplify](https://aws.amazon.com/amplify/)
- [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform/)

## 🐳 Docker

DevOps Daily can run in Docker for consistent environments. The project uses a **single multi-stage Dockerfile**; pick the mode with `--target`. Development runs the Next.js dev server on Node; production builds the static export and serves it from nginx.

### Building the Docker Image

```bash
# Build production image (static export served by nginx)
docker build --target production -t devops-daily:prod .

# Build development image (Next.js dev server with hot-reload)
docker build --target development -t devops-daily:dev .
```

### Running the Container

```bash
# Run production container
docker run -p 8080:80 devops-daily:prod

# Run in detached mode (background)
docker run -d -p 8080:80 --name devops-daily-app devops-daily:prod

# Run development container with hot-reload
docker run -p 3000:3000 -v $(pwd):/app devops-daily:dev
```

After starting the container, visit [http://localhost:8080](http://localhost:8080) for production or [http://localhost:3000](http://localhost:3000) for development.

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

- **Architecture**: Single multi-stage Dockerfile, selected with `--target`
- **Base Image**: Node.js 22.13.1 (Bookworm Slim) for the build and dev stages
- **Production Image**: `nginx:1.27-alpine` serving the static export, so it carries no Node runtime
- **Environments**: `--target development` or `--target production`
- **Security**: Runs as non-root user, includes OS security updates
- **Health Check**: Built-in health check endpoint
- **Version Pinning**: Node.js, pnpm, and nginx versions are pinned via build args for reproducible builds

#### Build Arguments

You can customize the versions used in the Docker build:

```bash
# Build production with custom versions
docker build \
  --target production \
  --build-arg NODE_VERSION=22.13.1 \
  --build-arg PNPM_VERSION=10.34.5 \
  -t devops-daily:custom .

# Build development with custom Node/pnpm versions
docker build \
  --target development \
  --build-arg NODE_VERSION=22.13.1 \
  --build-arg PNPM_VERSION=10.34.5 \
  -t devops-daily:dev .
```

### Docker Compose (Recommended)

Docker Compose is the easiest way to manage development and production environments. Each service already names the build stage it needs, so there is nothing to pass.

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
