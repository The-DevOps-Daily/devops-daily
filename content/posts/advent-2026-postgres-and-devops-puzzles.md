---
title: 'Advent 2026: 24 Days of Postgres and DevOps Puzzles'
excerpt: 'Advent of Postgres and Advent of DevOps open on 1 December. One free puzzle a day: SQL on your own Postgres database, or a hands-on DevOps task.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-30'
publishedAt: '2026-11-30T15:00:00Z'
updatedAt: '2026-11-30T15:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Postgres
  - SQL
  - Docker
  - Kubernetes
  - Learning
---

On 1 December, DevOps Daily opens two Advent calendars. [Advent of Postgres](/advent-of-postgres) is new this year: 24 SQL puzzles, one a day from 1 to 24 December, which you solve on a real Postgres database that you get for free in your browser. [Advent of DevOps](/advent-of-devops) is back for its second year: 25 hands-on tasks with Docker, CI/CD, Terraform and Kubernetes, updated for 2026.

Both are free, and you do not need an account to start. You can do one of them, or both. This post explains what you get, how each calendar works, and what to do on Day 1.

## TL;DR

- Two calendars, one new day each day from 1 December.
- **Advent of Postgres**: 24 SQL puzzles. One click gives you your own Postgres database on Neon with the day's data already loaded. You write SQL on the page and check your answer there.
- **Advent of DevOps**: 25 tasks that you do on your own machine. Each one has a target, a reference solution and an explanation.
- Free, no account needed to start, and your progress is saved in your browser.
- Day 1 is "The Failed Deploys" on Advent of Postgres and "Build a Minimal Docker Image" on Advent of DevOps.

## Prerequisites

- A browser. For Advent of Postgres, that is all you need.
- Optional: `psql`, or any Postgres 14 or later, if you prefer your own tools.
- Optional: a free Neon account. A few of the later Postgres puzzles use Neon branches, and branches need a database that you have claimed into your account.
- For Advent of DevOps: a terminal, Docker, Git and a GitHub account. Later days use a local Kubernetes cluster (minikube or kind is enough), Helm and Terraform, and a few deploy to AWS with your own account.

## What you get

|                  | Advent of Postgres                                | Advent of DevOps                                    |
| ---------------- | ------------------------------------------------- | --------------------------------------------------- |
| Days             | 24, from 1 to 24 December                         | 25, from 1 to 25 December                           |
| Each day         | One SQL puzzle with one answer                    | One hands-on task with a target to hit              |
| Where you work   | In the browser, or with `psql` and your own tools | On your machine: Docker, Git, Kubernetes, Terraform |
| How you check    | Submit the answer, and the page checks it         | Compare with the reference solution                 |
| When a day opens | 00:00 UTC                                         | Midnight in your time zone                          |
| Cost             | Free                                              | Free (AWS costs on the few days that deploy there)  |

Every day on both calendars has a difficulty label: Beginner, Intermediate or Advanced. On Advent of Postgres, the first days are short and the puzzles get harder toward the end of the month.

## How Advent of Postgres works

Each puzzle is a small problem for the North Pole platform team, who are getting ready for the busiest night of the year. You get a story, the tables, and one question. The answer is a single value, such as a number or a name.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Open the day", "sub": "00:00 UTC", "icon": "globe", "tone": "slate" },
    { "label": "Create a database", "sub": "about 5 seconds", "icon": "database", "tone": "violet" },
    { "label": "Write SQL", "sub": "on the page or in psql", "icon": "cpu", "tone": "blue" },
    { "label": "Check the answer", "sub": "in your browser", "icon": "check", "tone": "green" }
  ]
}
```

1. Open the day's page. A new puzzle opens at 00:00 UTC each day.
2. Press **Create my free database**. The page asks Neon for a new Postgres database, which takes about five seconds and needs no account, and loads the day's data into it.
3. Write SQL in the editor on the page. Ctrl+Enter (Cmd+Enter on a Mac) runs it. If you prefer your own client, **Connect with psql** shows the connection string.
4. Type your answer and press **Check answer**.

Each day loads its data into its own schema, so one database is enough for the whole month.

:::note
An unclaimed database lasts 72 hours. To keep it for the month, press **Keep it for the month** and claim it into a free Neon account. Neon resets the password when you claim it, so copy the new connection string from the Neon Console and paste it when the page asks.
:::

Your browser sends your queries straight to your own database. Our small API only asks Neon to create the database and the claim link, and it stores nothing. Answers are checked in your browser against a hash of the right answer, and your progress stays in that browser.

You can also solve most days on your own Postgres. Each open day has a **Download today's data as SQL** link. For Day 1, once it is open:

```bash
# Download Day 1's data (available after 00:00 UTC on 1 December)
curl -O https://devops-daily.com/advent-of-postgres/seeds/day01.sql

# Load it into any Postgres 14 or later
createdb advent
psql -d advent -f day01.sql

# Each day has its own schema; list the tables in Day 1's schema
psql -d advent -c '\dt day01.*'
```

The early puzzles are short. The later ones need window functions, ranges and recursive queries. If those are rusty, read the [joins, CTEs and window functions chapter](/guides/introduction-to-postgres/06-advanced-queries-and-joins) of our Postgres guide, test yourself with the [SQL and database design quiz](/quizzes/sql-quiz), or practice `psql` commands in the [PostgreSQL terminal simulator](/games/postgres-terminal-simulator).

## How Advent of DevOps works

Each day is a short scenario with a task, a target, and often a sample app to start from. You do the work on your own machine, with real tools. When you are done, or stuck, press **View Solution** to see a reference solution and an explanation of why it works. Then mark the day complete. Your progress is saved in your browser, and each day page has a comment thread for questions.

The tasks cover Docker, CI/CD with GitHub Actions, Terraform, Kubernetes and Helm, observability, security and serverless. For 2026, we updated the tasks to current tool versions and replaced the parts that depended on retired tools.

In December, the calendar opens one new day at midnight in your time zone. Day 25 is a short bonus day. After December, all days stay open, so you can catch up later.

If you want to warm up for Day 1, the [Docker terminal simulator](/games/docker-terminal-simulator) lets you practice `docker build` and `docker run` in the browser.

## Start on Day 1

After 00:00 UTC on 1 December:

1. Open [Advent of Postgres, Day 1: The Failed Deploys](/advent-of-postgres/day-1). Press **Create my free database**, run the starter query, and work toward the answer.
2. Open [Advent of DevOps, Day 1: Build a Minimal Docker Image](/advent-of-devops/day-1). You need Docker on your machine.
3. Bookmark the two calendars, [Advent of Postgres](/advent-of-postgres) and [Advent of DevOps](/advent-of-devops), and come back each day.

Before then, the Postgres day pages show when they open. When you solve a day, use the share box on the page: it shares the day, not your answer.

## Summary

- Advent of Postgres: 24 SQL puzzles from 1 to 24 December, on a free Postgres database on Neon that you create with one click. No account needed, and nothing to install.
- Advent of DevOps: 25 hands-on tasks from 1 to 25 December, done with real tools on your own machine, each with a reference solution.
- Both are free, and your progress is saved in your browser.
- Day 1 opens on 1 December. Start with [Advent of Postgres](/advent-of-postgres), [Advent of DevOps](/advent-of-devops), or both.
