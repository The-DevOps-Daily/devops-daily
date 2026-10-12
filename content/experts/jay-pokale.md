---
name: 'Jay Pokale'
slug: 'jay-pokale'
title: 'Engineer & Researcher'
bio: 'Researcher at IIT Hyderabad working on GraphRAG security, semantic-cache integrity and continual learning. Builds AI developer tooling, including Chisle, an open-source token-cost cutter for AI coding agents.'
avatar: '/images/experts/jay-pokale.jpg'
specialties:
  - Docker
  - GitHub Actions
  - Cloudflare Workers
  - Vercel
  - RAG and LLM systems
location: 'Nagpur, India'
website: 'https://jaypokale.me'
github: 'JayPokale'
---

## About Me

I work where AI systems meet the infrastructure that runs them: RAG pipelines, LLM evaluation, and the CI and deployment plumbing around them. My open-source project [Chisle](https://github.com/JayPokale/Chisle) cuts the token bill of AI coding agents and publishes its benchmarks, including the runs it loses.

I'm also a competitive programmer (LeetCode top 1%, Codeforces Expert) and founded Dare2Solve, a math community with 20,000+ members.

Happy to talk about containerizing Python and Node services, GitHub Actions pipelines, and deploying AI apps to serverless platforms.

## My Stack

### Local Development

- **Arch Linux + zsh** on a laptop with a 6 GB NVIDIA GPU
- **Docker** to run databases and services the same way locally and in CI
- **Ollama** to run open-weight models (Gemma 4) locally for prototyping and evals

### CI/CD

- **GitHub Actions** for tests, linting and release pipelines

### Hosting

- **Vercel** for Next.js front ends
- **Cloudflare Workers** for small APIs at the edge

### Data

- **MongoDB** for document-shaped app data
- **MySQL** where the data is relational

### Why This Stack

Most of what I build is either a web app or an AI pipeline. This stack keeps both cheap and simple: managed hosting for the front end and edge APIs, so there are no servers to look after, and local models for AI work, so experiments cost nothing and data stays on my machine.

### One Thing I'd Change

Pin and review every install script instead of piping `curl` into `sh`. Auto-updaters that installers add quietly are part of your supply chain too.
