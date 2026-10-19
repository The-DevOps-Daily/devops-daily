---
title: 'Email APIs With Hosted MCP Servers: Who Actually Ships One'
excerpt: 'Every email provider now claims AI-agent support, but there is a real dividing line: a hosted MCP server your agent connects to with a URL, versus a package you have to run yourself. As of August 2026 the hosted club is small. Here is the roster, what each server exposes, and how to wire one into Claude in two minutes.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-28'
publishedAt: '2026-08-28T13:00:00Z'
updatedAt: '2026-08-28T13:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - MCP
  - Email
  - AI
  - SMTP
  - Agents
---

If you want an AI agent to send email, the wrong way is obvious: paste your SMTP credentials into a prompt and hope. The right way now has a standard: the **Model Context Protocol**, which lets an agent discover and call an email provider's tools (send, list domains, check suppressions) through one typed interface, with the provider's own auth in front.

But "we support MCP" hides a distinction that decides how much work lands on you. Some providers ship a **hosted MCP server**: a URL your agent connects to, nothing to install, the provider runs it. Others ship a **package**: official code, but you run the process, keep it updated, and manage its credentials yourself. For a laptop experiment the difference is minutes; for a team standardizing agent tooling, or a hosted agent platform that cannot spawn local processes at all, it is the whole decision.

As of August 2026 the hosted club is small. Here is the roster, checked against each provider's docs, plus what the local-only options look like and how to evaluate any of them.

## TLDR

- **Hosted (connect with a URL):** SMTPfast, Resend, AgentMail, and Brevo (early access).
- **Official but run-it-yourself:** Mailtrap, Mailgun (both npx), Postmark (git clone, experimental).
- **In name only:** SendGrid's official server has two documentation-lookup tools and cannot send email; Amazon SES offers a sample explicitly not for production.
- A hosted server is the only option for agent platforms that cannot run local processes, and it moves updates and process management to the provider.
- Whatever you pick, scope the API key, and check how the server handles suppressions before you let an agent near real recipients.

## Prerequisites

- An MCP-capable client (Claude, Claude Code, Cursor, or any client speaking streamable HTTP)
- An account with whichever provider you evaluate
- Five minutes per provider; that is genuinely all the hosted ones need

## Why hosted is the interesting category

An MCP server is a small process that speaks a protocol. Running one locally via `npx` is easy on a developer laptop and increasingly awkward everywhere else: hosted agent platforms and web-based clients cannot spawn your process, CI needs another dependency pinned and updated, and every local copy is another place a raw API key lives.

A hosted server inverts all of that. The provider runs the process at a stable URL, speaks current protocol over streamable HTTP, updates it when the MCP spec moves (which it does; the spec revved again in July), and your agent connects with a URL plus a credential. The email provider is already the trust boundary for your sending; the hosted server keeps it that way instead of adding a second, locally-managed copy of the boundary.

That is why the hosted column is the one worth watching, and why it is short.

## The hosted club

### SMTPfast

[SMTPfast](https://smtpfa.st)'s server is documented in the [SMTPfast docs](https://smtpfa.st/docs/mcp), hosted at `https://smtpfa.st/api/mcp`, speaks streamable HTTP, and authenticates with an API key as a Bearer token. It exposes eight tools, deliberately scoped to what an agent operating your email actually needs: `send_email`, `get_email`, `list_emails`, `list_contacts`, `list_domains`, `verify_domain`, `list_suppressions`, and `get_analytics`. Connecting from Claude Code is one line:

```bash
claude mcp add --transport http smtpfast https://smtpfa.st/api/mcp \
  --header "Authorization: Bearer $SMTPFAST_API_KEY"
```

The design bet is that a small, complete toolset beats a big one for agents: fewer tools means less for a model to misuse, and `list_suppressions` is there because the first thing a well-behaved agent should do before a send is check who it must not email.

The server also speaks the current protocol revision, 2026-07-28: fully stateless per-request metadata, `server/discover`, and cacheable tool listings, with clients on the older 2025 revisions still supported.

### Resend

[Resend's MCP server](https://resend.com/docs/mcp-server) is the most fully built out in the hosted club. The remote server lives at `https://mcp.resend.com/mcp` with two auth paths: OAuth for web clients (a browser approval flow, no key handling) and a Bearer API key for headless use. There is also an open source `resend-mcp` package if you prefer local, with stdio and HTTP transports.

The tool surface is broad: sending and inbound email, templates, contacts and segments, broadcasts and automations, domains, webhooks, API keys, and request logs. (For how the two products compare beyond MCP, pricing included, see our full [SMTPfast vs Resend comparison](/comparisons/smtpfast-vs-resend).) That makes it the strongest option if you want an agent managing your whole email operation rather than just sending, with the corresponding caveat: a large tool surface handed to an autonomous agent deserves a careful look at which tools your use case actually needs exposed.

### AgentMail

[AgentMail](https://agentmail.to) comes at the problem from the opposite direction: not an email API adding agent support, but an inbox product built for agents from the start, where each agent gets its own mailbox. Its hosted MCP server exposes around two dozen tools across inbox, thread, and send operations. If your agents need to receive and hold conversations, not just fire transactional sends, this is the specialist option.

### Brevo

[Brevo](https://developers.brevo.com) has a remote MCP endpoint in early access with a wide tool count spanning its marketing and transactional products. Early access means what it says: evaluate before depending on it, and expect movement.

## Official, but you run it

Three providers ship real, official servers that stop short of hosting:

- **Mailtrap**: a stable, officially maintained server with about 15 tools covering sending, templates and deliverability data. Local only (`npx mcp-mailtrap`).
- **Mailgun**: the widest official tool surface of the local group, 50+ tools over its API, including validation and routing. Local only, via npx.
- **Postmark**: an official but explicitly experimental server with 4 tools, installed by cloning the repo. Fine for a Postmark shop experimenting; not a platform commitment.

These are good servers with the operational tax attached: you own the process, its updates, and its copy of your credentials, in every environment where an agent runs.

## In name only

Two names you would expect on this list are technically present and practically absent. **SendGrid's** official MCP server exposes two tools that look up documentation; it cannot send an email, so any actual sending goes through community-built servers without official support. **Amazon SES** has a sample server (a Java JAR) that AWS itself says not to use in production. If either provider is your incumbent, agent integration today means either waiting or adopting community code.

## The comparison, in one table

| Provider | Hosted URL | Official status | Tools | Auth |
| --- | --- | --- | --- | --- |
| SMTPfast | Yes, `/api/mcp` | Official, stable | 8 | API key (Bearer) |
| Resend | Yes, `mcp.resend.com` | Official, stable | Broad (emails, templates, broadcasts, domains, more) | OAuth or Bearer |
| AgentMail | Yes | Official, stable | ~24 | OAuth / API key |
| Brevo | Yes | Official, early access | 30+ | API key |
| Mailtrap | No (npx) | Official, stable | 15 | API key, local |
| Mailgun | No (npx) | Official, stable | 50+ | API key, local |
| Postmark | No (git clone) | Official, experimental | 4 | API key, local |
| SendGrid | No | Docs-only, cannot send | 2 | n/a |
| Amazon SES | No | Sample, non-production | ~20 | AWS creds, local |

Statuses move fast in this space; treat the table as a snapshot (August 2026) and check the linked docs before committing.

:::warning
Whatever you connect, remember what you are handing over: `send_email` in an agent's hands is outbound communication from your domain, on your reputation. Use a scoped API key, not your admin key; confirm the server respects your suppression list on sends; and start agents against a test domain before the real one.
:::

## What to actually do

1. **Already on Resend or SMTPfast?** Connect the hosted server, it is a two-minute experiment with your existing account.
2. **On Mailgun, Mailtrap, or Postmark?** The official local servers work today; budget for running them wherever your agents live, and revisit when the vendor hosts one.
3. **On SendGrid or SES with agent plans?** This is a real gap in those platforms right now. Community servers exist, but you are taking on unofficial code with your sending credentials, which deserves a security review, not a shrug.
4. **Building agent-first products?** Look at AgentMail's inbox-per-agent model; it solves receiving, which sending-focused APIs mostly do not.

The protocol layer of AI tooling is consolidating quickly, and email is ahead of most infrastructure categories: four hosted servers is more than databases or DNS can claim today. The gap between "has an MCP story" and "runs one for you" is where the next year of this table gets decided.
