---
name: 'Anoop Anilkumar'
slug: 'anoop-anilkumar'
title: 'Software Engineer'
bio: 'Software engineer with 4 years building production systems end to end — backend services in Node.js and Python, React and Next.js frontends, LLM-backed automation, and containerised deployment to the cloud. Comfortable owning a feature from data model through to release.'
avatar: '/images/experts/anoop-anilkumar.jpg'
specialties:
  - Node.js
  - Python
  - Docker
  - Kubernetes
availability: 'Available for hire'
location: 'Kollam, India'
website: 'https://anoopanil413.vercel.app/'
github: 'https://github.com/Anoopanil413'
linkedin: 'https://linkedin.com/in/anoop-anilkumar-b2185114b'
---

## About Me

I'm a full stack developer at Dignizant Technologies, building and shipping production systems across the stack. Most of my work sits on the backend: API design and service boundaries, schema and index work in PostgreSQL and MongoDB, and queued job processing with Redis.

Lately I've been putting LLMs behind schema-enforced contracts, with deterministic code doing the parts that must be right and agents doing the rest. I can help with Node.js and Python (FastAPI) services, Next.js frontends, and getting them containerised and shipped through CI.

## My Stack

### CI/CD

- **GitHub Actions** for builds, tests, and deployments
- **ruff**, **mypy**, **pytest**, and **Jest** as required checks on every pull request

### Containers

- **Docker** and **Docker Compose** for local development and consistent builds
- **Kubernetes** for running services in production
- **Nginx** as the reverse proxy in front of the apps

### Backend and Data

- **Node.js (Express)** and **Python (FastAPI)** for APIs and services
- **PostgreSQL** with **SQLAlchemy 2.0** and **Alembic** migrations as the main database
- **MongoDB** and **MySQL** where a project already uses them
- **Redis** for caching and queued background jobs
- **DuckDB** and **Parquet** for analytics workloads

### Frontend

- **React** and **Next.js** with **TypeScript** and **Tailwind CSS**
- **React Native (Expo)** for mobile

### AI and Automation

- **Claude** and **Groq** behind **Pydantic v2** schemas, so model output is validated like any other API input

### Why This Stack

I chose this combination because it lets one person own a feature from the data model to the release. Docker Compose keeps local development close to production, and GitHub Actions runs the same checks on every change.
The biggest win has been treating LLM output as untrusted input. With schema-enforced contracts and type checks in CI, a bad model response fails a validation step instead of breaking something in production.

### One Thing I'd Change

If I were starting fresh, I'd add metrics and log aggregation from day one instead of leaning on application logs, and I'd manage infrastructure with Terraform rather than setting it up by hand.
